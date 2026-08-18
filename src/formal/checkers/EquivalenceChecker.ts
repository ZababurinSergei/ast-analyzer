// src/formal/checkers/EquivalenceChecker.ts

import type { FunctionContract } from '../Z3Verifier.js';
import { Z3Verifier, range, eq, or } from '../Z3Verifier.js';
import { Project, ScriptTarget, ModuleKind, type SourceFile, Node } from 'ts-morph';
import { ASTComparator, type ASTDifference } from '../../core/ASTComparator.js';
import fs from 'fs';
import path from 'path';

// ============================================
// ТИПЫ
// ============================================

export interface EquivalenceResult {
  isEquivalent: boolean;
  confidence: number;
  method: 'formal' | 'structural' | 'formal+structural' | 'ast-only';
  proof?: string;
  counterexample?: Map<string, any>;
  differences?: CodeDifference[];
  time: number;
  formalResult?: {
    isValid: boolean;
    counterexample?: Map<string, any>;
    time: number;
    error?: string;
    results?: any[];
  };
  astResult?: {
    isEquivalent: boolean;
    differences: CodeDifference[];
    confidence: number;
  };
}

export interface CodeDifference {
  type: 'added' | 'removed' | 'modified' | 'moved' | 'semantic';
  location: { start: number; end: number; line?: number };
  original?: string;
  modified?: string;
  impact: 'high' | 'medium' | 'low';
  astNodeType?: string;
}

export interface EquivalenceOptions {
  formalVerification?: boolean;
  timeout?: number;
  maxDepth?: number;
  structuralCheck?: boolean;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  requireBoth?: boolean;
  fallbackToStructural?: boolean;
  detailedReport?: boolean;
}

interface FunctionSignature {
  name: string;
  params: string[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  body: string;
  startLine: number;
  endLine: number;
  isArrow: boolean;
  paramTypes: string[];
}

interface FunctionMatch {
  name: string;
  original: FunctionSignature;
  modified: FunctionSignature;
  contract: FunctionContract;
}

// ============================================
// ОСНОВНОЙ КЛАСС
// ============================================

export class EquivalenceChecker {
  private z3Verifier: Z3Verifier | null = null;
  private project: Project;
  private astComparator: ASTComparator;
  private initialized = false;
  private options: EquivalenceOptions;
  private originalCode1 = '';
  private originalCode2 = '';
  private initPromise: Promise<void> | null = null;
  private initLock = false;
  private z3Provided = false;

  constructor(options: EquivalenceOptions = {}, z3Verifier?: Z3Verifier) {
    this.options = {
      formalVerification: true,
      structuralCheck: true,
      ignoreWhitespace: true,
      ignoreComments: true,
      requireBoth: false,
      fallbackToStructural: true,
      timeout: 30000,
      maxDepth: 10,
      detailedReport: true,
      ...options,
    };

    if (z3Verifier) {
      this.z3Verifier = z3Verifier;
      this.z3Provided = true;
      this.initialized = true;
      console.log('✅ EquivalenceChecker using provided Z3Verifier (already initialized)');
    }

    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.ESNext,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        jsx: 2,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
      },
      useInMemoryFileSystem: true,
    });

    this.astComparator = new ASTComparator();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ EquivalenceChecker already initialized');
      return;
    }

    if (this.z3Provided && this.z3Verifier) {
      this.initialized = true;
      console.log('✅ EquivalenceChecker marked as initialized (Z3 provided externally)');
      return;
    }

    if (this.initPromise) {
      console.log('⏳ EquivalenceChecker initialization in progress, waiting...');
      await this.initPromise;
      return;
    }

    if (this.initLock) {
      return;
    }

    this.initLock = true;

    try {
      this.initPromise = this.doInitialize();
      await this.initPromise;
    } finally {
      this.initLock = false;
    }
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('🔧 Initializing EquivalenceChecker...');

      if (!this.z3Verifier) {
        this.z3Verifier = new Z3Verifier();
        await this.z3Verifier.initialize();
      } else if (!this.z3Provided) {
        await this.z3Verifier.initialize();
      }

      this.initialized = true;
      console.log('✅ EquivalenceChecker initialized successfully');
    } catch (error) {
      this.initialized = false;
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  async dispose(): Promise<void> {
    if (this.z3Provided) {
      this.initialized = false;
      console.log('✅ EquivalenceChecker disposed (Z3 kept alive)');
      return;
    }

    if (this.z3Verifier) {
      await this.z3Verifier.dispose();
      this.z3Verifier = null;
    }
    this.initialized = false;
    this.initPromise = null;
    this.initLock = false;
  }

  private async getZ3Verifier(): Promise<Z3Verifier> {
    await this.initialize();
    if (!this.z3Verifier) {
      throw new Error('Z3 verifier not initialized');
    }
    return this.z3Verifier;
  }

  /**
   * Извлекает тело функции из строки кода
   */
  private extractFunctionBody(code: string): string {
    const trimmed = code.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed.slice(1, -1).trim();
    }
    if (trimmed.startsWith('return ')) {
      return trimmed;
    }
    return `return ${trimmed}`;
  }

  /**
   * Создает контракт с телом функции для Z3 верификации эквивалентности
   * Связывает result с обоими выражениями через постусловия
   */
  private createEquivalenceContract(
    name: string,
    originalBody: string,
    modifiedBody: string,
    paramNames: string[]
  ): FunctionContract {
    console.log(`\n📋 Creating equivalence contract for: ${name}`);
    console.log(`   Original body: "${originalBody}"`);
    console.log(`   Modified body: "${modifiedBody}"`);
    console.log(`   Params: ${paramNames.join(', ')}`);

    const params = paramNames.map(p => ({
      name: p,
      type: 'int' as const,
    }));

    const originalExpr = this.extractFunctionBody(originalBody);
    const modifiedExpr = this.extractFunctionBody(modifiedBody);

    console.log(`   Extracted original expression: "${originalExpr}"`);
    console.log(`   Extracted modified expression: "${modifiedExpr}"`);

    // Создаем предусловия с использованием range
    const preconditions: any[] = [];
    for (const param of params) {
      preconditions.push(range(param.name, -1000, 1000));
      console.log(`   📌 Added precondition: range(${param.name}, -1000, 1000)`);
    }

    // Постусловия:
    // 1. result должен быть равен оригинальному выражению
    // 2. result должен быть равен модифицированному выражению
    // Из 1 и 2 следует, что originalExpr == modifiedExpr
    const postconditions: any[] = [
      eq('result', originalExpr),
      eq('result', modifiedExpr)
    ];

    console.log(`   📌 Added postcondition: result == ${originalExpr}`);
    console.log(`   📌 Added postcondition: result == ${modifiedExpr}`);

    // Инварианты: параметры остаются в диапазоне
    const invariants: any[] = [];
    if (params.length > 0) {
      for (const param of params) {
        invariants.push(range(param.name, -1000, 1000));
        console.log(`   📌 Added invariant: range(${param.name}, -1000, 1000)`);
      }
    }

    const contract = {
      name: `${name}_equivalence`,
      params,
      returnType: 'int' as const,
      preconditions,
      postconditions,
      invariants,
    };

    console.log(`   ✅ Contract created:`);
    console.log(`      - ${preconditions.length} preconditions`);
    console.log(`      - ${postconditions.length} postconditions`);
    console.log(`      - ${invariants.length} invariants`);
    console.log(`      - ${params.length} params`);

    return contract;
  }

  async checkFileEquivalence(
    originalPath: string,
    modifiedPath: string,
    options: EquivalenceOptions = {}
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.options, ...options };
    const timeout = mergedOptions.timeout || 30000;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 CHECKING FILE EQUIVALENCE`);
    console.log(`${'='.repeat(70)}`);
    console.log(`📄 Original: ${path.basename(originalPath)}`);
    console.log(`📄 Modified: ${path.basename(modifiedPath)}`);
    console.log(`📋 Method: STRUCTURAL (AST) + FORMAL (Z3 for expressions)`);
    console.log(`⏱️ Timeout: ${timeout}ms`);
    console.log(`${'='.repeat(70)}`);

    if (Date.now() - startTime > timeout) {
      return {
        isEquivalent: false,
        confidence: 0,
        method: 'structural',
        time: Date.now() - startTime,
        differences: [
          {
            type: 'modified',
            location: { start: 0, end: 0, line: 1 },
            original: 'Timeout',
            modified: 'Analysis timed out',
            impact: 'high',
            astNodeType: 'timeout',
          },
        ],
      };
    }

    this.originalCode1 = await this.loadFile(originalPath);
    this.originalCode2 = await this.loadFile(modifiedPath);

    if (this.originalCode1 === this.originalCode2) {
      console.log('✅ Files are identical');
      return {
        isEquivalent: true,
        confidence: 1.0,
        method: 'structural',
        time: Date.now() - startTime,
      };
    }

    const sourceFile1 = this.project.createSourceFile('temp1.ts', this.originalCode1, {
      overwrite: true,
    });
    const sourceFile2 = this.project.createSourceFile('temp2.ts', this.originalCode2, {
      overwrite: true,
    });

    let astResult: {
      isEquivalent: boolean;
      differences: CodeDifference[];
      confidence: number;
    } | null = null;

    if (mergedOptions.structuralCheck !== false) {
      if (Date.now() - startTime > timeout) {
        return {
          isEquivalent: false,
          confidence: 0.5,
          method: 'structural',
          time: Date.now() - startTime,
          differences: [
            {
              type: 'modified',
              location: { start: 0, end: 0, line: 1 },
              original: 'Timeout during AST analysis',
              modified: 'Analysis timed out',
              impact: 'high',
              astNodeType: 'timeout',
            },
          ],
        };
      }

      console.log('\n📐 STEP 1: Structural check via AST (SECONDARY)...');

      try {
        const result = this.astComparator.compareFiles(
          sourceFile1.getFilePath(),
          sourceFile2.getFilePath(),
          {
            ignoreWhitespace: mergedOptions.ignoreWhitespace,
            ignoreComments: mergedOptions.ignoreComments,
          }
        );

        const differences: CodeDifference[] = result.differences.map((diff: ASTDifference) => ({
          type: diff.type,
          location: diff.location,
          original: diff.original,
          modified: diff.modified,
          impact: diff.impact,
          astNodeType: diff.nodeKind || diff.nodeType,
        }));

        astResult = {
          isEquivalent: result.isEquivalent,
          differences,
          confidence: result.confidence,
        };

        console.log(
          `   ✅ AST check: ${astResult.isEquivalent ? 'PASSED ✅' : `HAS ${astResult.differences.length} DIFFERENCES`}`
        );
        if (!astResult.isEquivalent && astResult.differences.length > 0) {
          for (const diff of astResult.differences.slice(0, 3)) {
            console.log(`      📝 ${diff.type}: ${diff.original || '?'} → ${diff.modified || '?'}`);
          }
          if (astResult.differences.length > 3) {
            console.log(`      ... and ${astResult.differences.length - 3} more`);
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ AST check failed: ${error}`);
        astResult = {
          isEquivalent: true,
          differences: [],
          confidence: 0.5,
        };
      }
    }

    // ⭐ STEP 2: ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ ЧЕРЕЗ Z3 (ОСНОВНОЙ МЕТОД)
    let formalResult: {
      isValid: boolean;
      counterexample?: Map<string, any>;
      time: number;
      error?: string;
      results?: any[];
    } | null = null;

    console.log('\n🔬 STEP 2: Formal verification via Z3 (PRIMARY)...');

    if (Date.now() - startTime > timeout) {
      console.log('\n⚠️ Timeout before Z3 analysis, skipping...');
      formalResult = {
        isValid: false,
        time: Date.now() - startTime,
        error: 'Timeout before Z3 analysis',
      };
    } else {
      try {
        const z3 = await this.getZ3Verifier();

        const functions1 = this.extractFunctionsAST(sourceFile1);
        const functions2 = this.extractFunctionsAST(sourceFile2);

        console.log(
          `   📊 Found ${functions1.length} functions in original, ${functions2.length} in modified`
        );

        const matchedFunctions = this.matchFunctions(functions1, functions2);

        if (matchedFunctions.length === 0) {
          console.log('   ⚠️ No matching functions found');
          formalResult = {
            isValid: false,
            time: Date.now() - startTime,
            error: 'No matching functions found',
          };
        } else {
          console.log(`   ✅ Matched ${matchedFunctions.length} functions`);

          const verificationResults: any[] = [];
          let allValid = true;
          let counterexample: Map<string, any> | undefined;

          for (const match of matchedFunctions) {
            console.log(`      🔍 Verifying equivalence: ${match.name} (Z3)`);

            try {
              // ⭐ Создаем контракт для проверки эквивалентности
              const contract = this.createEquivalenceContract(
                match.name,
                match.original.body,
                match.modified.body,
                match.original.params
              );

              // ⭐ Проверяем, является ли функция простой математической
              const isSimple =
                this.isSimpleMathFunction(match.original.body) &&
                this.isSimpleMathFunction(match.modified.body);

              console.log(`         📝 Simple: ${isSimple}`);
              console.log(`         📝 Original: ${match.original.body}`);
              console.log(`         📝 Modified: ${match.modified.body}`);

              const result = await z3.verifyFunction(contract);

              verificationResults.push({
                name: match.name,
                isValid: result.isValid,
                counterexample: result.counterexample,
                time: result.time || 0,
                error: result.error,
                isSimple,
              });

              if (!result.isValid) {
                allValid = false;
                counterexample = result.counterexample;
                console.log(`         ❌ NOT EQUIVALENT`);
                if (result.counterexample) {
                  console.log(
                    `            Counterexample: ${JSON.stringify(Object.fromEntries(result.counterexample))}`
                  );
                }
              } else {
                console.log(`         ✅ EQUIVALENT`);
              }
            } catch (error) {
              allValid = false;
              console.log(`         ❌ ERROR: ${error}`);
              verificationResults.push({
                name: match.name,
                isValid: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          formalResult = {
            isValid: allValid,
            counterexample,
            time: Date.now() - startTime,
            results: verificationResults,
          };

          console.log(
            `   ✅ Formal verification: ${allValid ? 'ALL EQUIVALENT 🎉' : 'SOME NOT EQUIVALENT ❌'}`
          );
        }
      } catch (error) {
        console.warn(`   ⚠️ Formal verification failed: ${error}`);
        formalResult = {
          isValid: false,
          time: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // ⭐ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ: Z3 - основной метод
    let isEquivalent: boolean;
    let confidence: number;
    let method: 'formal' | 'structural' | 'formal+structural' | 'ast-only';

    if (formalResult) {
      isEquivalent = formalResult.isValid;
      confidence = formalResult.isValid ? 0.95 : 0.95;
      method = 'formal';

      if (formalResult.isValid) {
        console.log('\n🎯 Z3 says FUNCTIONS ARE EQUIVALENT');
      } else {
        console.log('\n🎯 Z3 says FUNCTIONS ARE NOT EQUIVALENT');
        if (formalResult.counterexample) {
          console.log(
            `   Counterexample found: ${JSON.stringify(Object.fromEntries(formalResult.counterexample))}`
          );
        }
      }

      if (formalResult.error && astResult) {
        console.log('\n⚠️ Z3 failed, falling back to AST');
        isEquivalent = astResult.isEquivalent;
        confidence = astResult.confidence * 0.8;
        method = 'ast-only';
      }
    } else if (astResult) {
      isEquivalent = astResult.isEquivalent;
      confidence = astResult.confidence * 0.7;
      method = 'ast-only';
      console.log('\n🎯 Using AST (Z3 not available)');
    } else {
      isEquivalent = false;
      confidence = 0.3;
      method = 'structural';
      console.log('\n❌ No verification methods available');
    }

    const allDifferences: CodeDifference[] = [];

    if (formalResult && !formalResult.isValid) {
      allDifferences.push({
        type: 'semantic',
        location: { start: 0, end: 0, line: 1 },
        original: 'Formal equivalence check failed',
        modified: 'Functions are not semantically equivalent',
        impact: 'high',
        astNodeType: 'formal',
      });
    }

    if (astResult && !astResult.isEquivalent && !formalResult?.isValid) {
      allDifferences.push(...astResult.differences);
    }

    const uniqueDifferences = this.uniqueDifferences(allDifferences);

    const result: EquivalenceResult = {
      isEquivalent,
      confidence,
      method,
      counterexample: formalResult?.counterexample,
      differences: uniqueDifferences.length > 0 ? uniqueDifferences : undefined,
      time: Date.now() - startTime,
      formalResult: formalResult || undefined,
      astResult: astResult || undefined,
    };

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 FINAL RESULT: ${isEquivalent ? '✅ EQUIVALENT' : '❌ NOT EQUIVALENT'}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(`   Method: ${method}`);
    console.log(`   Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(70)}\n`);

    return result;
  }

  async checkFunctionEquivalence(
    originalFunction: string,
    modifiedFunction: string,
    contract: FunctionContract,
    options: EquivalenceOptions = {}
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.options, ...options };
    const timeout = mergedOptions.timeout || 30000;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 CHECKING FUNCTION EQUIVALENCE: ${contract.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Method: FORMAL (Z3) - PRIMARY, AST - SECONDARY`);
    console.log(`${'='.repeat(60)}`);

    if (Date.now() - startTime > timeout) {
      return {
        isEquivalent: false,
        confidence: 0,
        method: 'structural',
        time: Date.now() - startTime,
        differences: [
          {
            type: 'modified',
            location: { start: 0, end: 0, line: 1 },
            original: 'Timeout',
            modified: 'Analysis timed out',
            impact: 'high',
            astNodeType: 'timeout',
          },
        ],
      };
    }

    this.originalCode1 = originalFunction;
    this.originalCode2 = modifiedFunction;

    let astResult: {
      isEquivalent: boolean;
      differences: CodeDifference[];
      confidence: number;
    } | null = null;

    // AST - secondary check
    if (mergedOptions.structuralCheck !== false) {
      console.log('\n📐 STEP 1: Structural check via AST (SECONDARY)...');

      try {
        const wrapInBraces = (body: string): string => {
          const trimmed = body.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return body;
          }
          return `{ ${trimmed} }`;
        };

        const originalWrapped = wrapInBraces(originalFunction);
        const modifiedWrapped = wrapInBraces(modifiedFunction);

        const sourceFile1 = this.project.createSourceFile(
          'func1.ts',
          `function test(): number ${originalWrapped}`,
          { overwrite: true }
        );
        const sourceFile2 = this.project.createSourceFile(
          'func2.ts',
          `function test(): number ${modifiedWrapped}`,
          { overwrite: true }
        );

        const func1 = sourceFile1.getFunctions()[0];
        const func2 = sourceFile2.getFunctions()[0];

        if (func1 && func2) {
          const result = this.astComparator.compareNodes(func1, func2, {
            ignoreWhitespace: mergedOptions.ignoreWhitespace,
            ignoreComments: mergedOptions.ignoreComments,
          });

          const differences: CodeDifference[] = result.differences.map((diff: ASTDifference) => ({
            type: diff.type,
            location: diff.location,
            original: diff.original,
            modified: diff.modified,
            impact: diff.impact,
            astNodeType: diff.nodeKind || diff.nodeType,
          }));

          astResult = {
            isEquivalent: result.isEquivalent,
            differences,
            confidence: result.confidence,
          };

          console.log(
            `   ✅ AST check: ${astResult.isEquivalent ? 'PASSED ✅' : `HAS ${astResult.differences.length} DIFFERENCES`}`
          );
        } else {
          astResult = {
            isEquivalent: false,
            differences: [
              {
                type: 'modified',
                location: { start: 0, end: 0, line: 1 },
                original: 'Could not parse original function',
                modified: 'Could not parse modified function',
                impact: 'high',
                astNodeType: 'parse',
              },
            ],
            confidence: 0.5,
          };
          console.log('   ❌ AST check: FAILED to parse functions');
        }
      } catch (error) {
        console.warn(`   ⚠️ AST check failed: ${error}`);
        astResult = {
          isEquivalent: true,
          differences: [],
          confidence: 0.5,
        };
      }
    }

    // ⭐ STEP 2: ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ ЧЕРЕЗ Z3 (ОСНОВНОЙ МЕТОД)
    let formalResult: {
      isValid: boolean;
      counterexample?: Map<string, any>;
      time: number;
      error?: string;
    } | null = null;

    console.log('\n🔬 STEP 2: Formal verification via Z3 (PRIMARY)...');

    if (Date.now() - startTime > timeout) {
      console.log('\n⚠️ Timeout before Z3 analysis, skipping...');
      formalResult = {
        isValid: false,
        time: Date.now() - startTime,
        error: 'Timeout before Z3 analysis',
      };
    } else {
      try {
        const z3 = await this.getZ3Verifier();

        const paramNames = contract.params.map(p => p.name);

        // ⭐ Создаем контракт для проверки эквивалентности
        const equivalenceContract = this.createEquivalenceContract(
          contract.name,
          originalFunction,
          modifiedFunction,
          paramNames
        );

        // ⭐ Проверяем, является ли функция простой математической
        const isSimple =
          this.isSimpleMathFunction(originalFunction) &&
          this.isSimpleMathFunction(modifiedFunction);

        console.log(`   📝 Simple: ${isSimple}`);
        console.log(`   📝 Original: ${originalFunction}`);
        console.log(`   📝 Modified: ${modifiedFunction}`);

        const result = await z3.verifyFunction(equivalenceContract);

        formalResult = {
          isValid: result.isValid,
          counterexample: result.counterexample,
          time: result.time || 0,
          error: result.error,
        };

        if (result.isValid) {
          console.log('   ✅ Functions are EQUIVALENT (Z3)');
        } else {
          console.log('   ❌ Functions are NOT EQUIVALENT (Z3)');
          if (result.counterexample) {
            console.log(
              `      Counterexample: ${JSON.stringify(Object.fromEntries(result.counterexample))}`
            );
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Formal verification failed: ${error}`);
        formalResult = {
          isValid: false,
          time: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // ⭐ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ: Z3 - основной метод
    let isEquivalent: boolean;
    let confidence: number;
    let method: 'formal' | 'structural' | 'formal+structural' | 'ast-only';

    if (formalResult) {
      isEquivalent = formalResult.isValid;
      confidence = formalResult.isValid ? 0.95 : 0.95;
      method = 'formal';

      if (formalResult.isValid) {
        console.log('\n🎯 Z3 says FUNCTIONS ARE EQUIVALENT');
      } else {
        console.log('\n🎯 Z3 says FUNCTIONS ARE NOT EQUIVALENT');
        if (formalResult.counterexample) {
          console.log(
            `   Counterexample found: ${JSON.stringify(Object.fromEntries(formalResult.counterexample))}`
          );
        }
      }

      if (formalResult.error && astResult) {
        console.log('\n⚠️ Z3 failed, falling back to AST');
        isEquivalent = astResult.isEquivalent;
        confidence = astResult.confidence * 0.8;
        method = 'ast-only';
      }
    } else if (astResult) {
      isEquivalent = astResult.isEquivalent;
      confidence = astResult.confidence * 0.7;
      method = 'ast-only';
      console.log('\n🎯 Using AST (Z3 not available)');
    } else {
      isEquivalent = false;
      confidence = 0.3;
      method = 'structural';
      console.log('\n❌ No verification methods available');
    }

    const result: EquivalenceResult = {
      isEquivalent,
      confidence,
      method,
      counterexample: formalResult?.counterexample,
      differences: !isEquivalent && astResult?.differences ? astResult.differences : undefined,
      time: Date.now() - startTime,
      formalResult: formalResult || undefined,
      astResult: astResult || undefined,
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 FINAL RESULT: ${isEquivalent ? '✅ EQUIVALENT' : '❌ NOT EQUIVALENT'}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(`   Method: ${method}`);
    console.log(`   Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
  }

  async checkExpressionEquivalence(
    original: string,
    modified: string,
    variables: Map<string, 'int' | 'bool' | 'string'>
  ): Promise<EquivalenceResult> {
    const startTime = Date.now();
    const timeout = this.options.timeout || 30000;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 CHECKING EXPRESSION EQUIVALENCE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Method: FORMAL (Z3) - PRIMARY`);
    console.log(`${'='.repeat(60)}`);

    this.originalCode1 = original;
    this.originalCode2 = modified;

    if (Date.now() - startTime > timeout) {
      return {
        isEquivalent: false,
        confidence: 0,
        method: 'formal',
        time: Date.now() - startTime,
        differences: [
          {
            type: 'modified',
            location: { start: 0, end: 0, line: 1 },
            original: 'Timeout',
            modified: 'Analysis timed out',
            impact: 'high',
            astNodeType: 'timeout',
          },
        ],
      };
    }

    console.log('\n🔬 STEP 1: Formal verification via Z3...');

    let formalResult: {
      isValid: boolean;
      counterexample?: Map<string, any>;
      time: number;
      error?: string;
    } | null = null;

    try {
      const z3 = await this.getZ3Verifier();
      const verifyResult = await z3.verifyEquivalence(original, modified, variables);

      formalResult = {
        isValid: verifyResult.isValid,
        counterexample: verifyResult.counterexample,
        time: verifyResult.time || 0,
        error: verifyResult.error,
      };

      if (verifyResult.isValid) {
        console.log('   ✅ Expression VERIFIED formally');
      } else {
        console.log('   ❌ Expression FAILED formal verification');
        if (verifyResult.counterexample) {
          console.log(
            `      Counterexample: ${JSON.stringify(Object.fromEntries(verifyResult.counterexample))}`
          );
        }
      }

      return {
        isEquivalent: verifyResult.isValid,
        confidence: verifyResult.isValid ? 1.0 : 0.95,
        method: 'formal',
        counterexample: verifyResult.counterexample,
        time: Date.now() - startTime,
        formalResult: formalResult || undefined,
      };
    } catch (error) {
      console.warn(`   ⚠️ Formal verification failed: ${error}`);
      return {
        isEquivalent: false,
        confidence: 0.5,
        method: 'formal',
        time: Date.now() - startTime,
        formalResult: {
          isValid: false,
          time: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        },
        differences: [
          {
            type: 'modified',
            location: { start: 0, end: 0, line: 1 },
            original: 'Formal verification error',
            modified: error instanceof Error ? error.message : String(error),
            impact: 'high',
            astNodeType: 'error',
          },
        ],
      };
    }
  }

  /**
   * Проверяет, является ли функция простой математической
   * Используется для определения, можно ли применять Z3
   */
  private isSimpleMathFunction(body: string): boolean {
    if (!body) return false;

    const lines = body.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    if (lines.length > 5) return false;

    const complexPatterns = [
      /for\s*\(/,
      /while\s*\(/,
      /if\s*\([^)]*\)\s*{/,
      /switch\s*\(/,
      /try\s*{/,
      /catch\s*\(/,
      /new\s+\w+\s*\(/,
    ];

    for (const pattern of complexPatterns) {
      if (pattern.test(body)) return false;
    }

    const mathPatterns = [
      /return\s*[a-zA-Z_]\s*[+\-*/]\s*[a-zA-Z_]/,
      /return\s*[a-zA-Z_]\s*[+\-*/]\s*\d+/,
      /return\s*\d+\s*[+\-*/]\s*\d+/,
    ];

    for (const pattern of mathPatterns) {
      if (pattern.test(body)) return true;
    }

    if (/return\s+[^;]+;/.test(body)) {
      const expr = body.match(/return\s+([^;]+);/)?.[1] || '';
      if (!/[{}()\[\],]/.test(expr) && !/function/.test(expr)) {
        return true;
      }
    }

    return false;
  }

  private createSimpleContract(
    original: FunctionSignature,
    _modified: FunctionSignature,
    name: string
  ): FunctionContract {
    const params = original.params.map((p: string) => ({
      name: p,
      type: 'int' as const,
    }));

    let returnType: 'int' | 'bool' | 'string' | 'void' = 'int';
    if (original.returnType.includes('boolean') || original.returnType.includes('bool')) {
      returnType = 'bool';
    } else if (original.returnType.includes('string')) {
      returnType = 'string';
    } else if (original.returnType === 'void' || original.returnType === 'undefined') {
      returnType = 'void';
    }

    const preconditions: any[] = [];
    const postconditions: any[] = [];

    for (const param of params) {
      preconditions.push(range(param.name, -1000, 1000));
    }

    if (returnType === 'int') {
      postconditions.push(range('result', -1000000, 1000000));
    } else if (returnType === 'bool') {
      postconditions.push(or(eq('result', true), eq('result', false)));
    }

    return {
      name,
      params,
      returnType,
      preconditions,
      postconditions,
      invariants: [],
    };
  }

  private extractFunctionsAST(sourceFile: SourceFile): FunctionSignature[] {
    const functions: FunctionSignature[] = [];

    try {
      const allFunctions = sourceFile.getFunctions();

      for (const func of allFunctions) {
        try {
          const name = func.getName();
          if (!name) continue;

          const params = func.getParameters();
          const paramNames = params.map((p: any) => {
            try {
              return p.getName();
            } catch {
              return 'unknown';
            }
          });
          const paramTypes = params.map((p: any) => {
            try {
              return p.getType().getText();
            } catch {
              return 'any';
            }
          });

          let returnType = 'any';
          try {
            returnType = func.getReturnType().getText();
          } catch {
            // Используем 'any' по умолчанию
          }

          let body = '';
          try {
            const bodyNode = func.getBody();
            if (bodyNode) {
              body = bodyNode.getText();
            }
          } catch {
            // Игнорируем ошибки получения тела
          }

          let isAsync = false;
          let isExported = false;
          try {
            isAsync = func.isAsync();
            isExported = func.isExported();
          } catch {
            // Игнорируем
          }

          functions.push({
            name,
            params: paramNames,
            returnType,
            isAsync,
            isExported,
            body,
            startLine: 0,
            endLine: 0,
            isArrow: false,
            paramTypes,
          });
        } catch (error) {
          // Игнорируем ошибки для отдельных функций
        }
      }

      try {
        const varDeclarations = sourceFile.getVariableDeclarations();
        for (const varDecl of varDeclarations) {
          try {
            const initializer = varDecl.getInitializer();
            if (initializer && Node.isArrowFunction(initializer)) {
              const name = varDecl.getName();
              const params = initializer.getParameters();
              const paramNames = params.map((p: any) => {
                try {
                  return p.getName();
                } catch {
                  return 'unknown';
                }
              });
              const paramTypes = params.map((p: any) => {
                try {
                  return p.getType().getText();
                } catch {
                  return 'any';
                }
              });

              let returnType = 'any';
              try {
                returnType = initializer.getReturnType().getText();
              } catch {
                // Используем 'any' по умолчанию
              }

              let body = '';
              try {
                const bodyNode = initializer.getBody();
                if (bodyNode) {
                  body = bodyNode.getText();
                }
              } catch {
                // Игнорируем
              }

              let isAsync = false;
              let isExported = false;
              try {
                isAsync = initializer.isAsync();
                isExported = varDecl.isExported();
              } catch {
                // Игнорируем
              }

              functions.push({
                name,
                params: paramNames,
                returnType,
                isAsync,
                isExported,
                body,
                startLine: 0,
                endLine: 0,
                isArrow: true,
                paramTypes,
              });
            }
          } catch (error) {
            // Игнорируем ошибки для отдельных переменных
          }
        }
      } catch (error) {
        // Игнорируем ошибки обхода переменных
      }

      try {
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
          try {
            const className = cls.getName();
            if (!className) continue;

            const methods = cls.getMethods();
            for (const method of methods) {
              try {
                const name = method.getName();
                if (!name) continue;

                const fullName = `${className}.${name}`;
                const params = method.getParameters();
                const paramNames = params.map((p: any) => {
                  try {
                    return p.getName();
                  } catch {
                    return 'unknown';
                  }
                });
                const paramTypes = params.map((p: any) => {
                  try {
                    return p.getType().getText();
                  } catch {
                    return 'any';
                  }
                });

                let returnType = 'any';
                try {
                  returnType = method.getReturnType().getText();
                } catch {
                  // Используем 'any' по умолчанию
                }

                let body = '';
                try {
                  const bodyNode = method.getBody();
                  if (bodyNode) {
                    body = bodyNode.getText();
                  }
                } catch {
                  // Игнорируем
                }

                let isAsync = false;
                try {
                  isAsync = method.isAsync();
                } catch {
                  // Игнорируем
                }

                functions.push({
                  name: fullName,
                  params: paramNames,
                  returnType,
                  isAsync,
                  isExported: false,
                  body,
                  startLine: 0,
                  endLine: 0,
                  isArrow: false,
                  paramTypes,
                });
              } catch (error) {
                // Игнорируем ошибки для отдельных методов
              }
            }
          } catch (error) {
            // Игнорируем ошибки для отдельных классов
          }
        }
      } catch (error) {
        // Игнорируем ошибки обхода классов
      }
    } catch (error) {
      console.warn(`   ⚠️ Failed to extract functions: ${error}`);
    }

    const unique = new Map<string, FunctionSignature>();
    for (const func of functions) {
      const key = `${func.name}(${func.params.join(',')})`;
      if (!unique.has(key)) {
        unique.set(key, func);
      }
    }

    return Array.from(unique.values());
  }

  private matchFunctions(
    functions1: FunctionSignature[],
    functions2: FunctionSignature[]
  ): FunctionMatch[] {
    const matches: FunctionMatch[] = [];

    for (const orig of functions1) {
      const mod = functions2.find((f: FunctionSignature) => f.name === orig.name);
      if (mod) {
        const contract = this.createSimpleContract(orig, mod, orig.name);
        matches.push({
          name: orig.name,
          original: orig,
          modified: mod,
          contract,
        });
      }
    }

    return matches;
  }

  private uniqueDifferences(diffs: CodeDifference[]): CodeDifference[] {
    const seen = new Set<string>();
    const result: CodeDifference[] = [];

    for (const diff of diffs) {
      const key = `${diff.type}:${diff.original || ''}:${diff.modified || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(diff);
      }
    }

    return result;
  }

  private async loadFile(filePath: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  generateReport(result: EquivalenceResult): string {
    let report = '';
    report += '='.repeat(70) + '\n';
    report += '🔍 EQUIVALENCE CHECK REPORT\n';
    report += '='.repeat(70) + '\n';
    report += `Status: ${result.isEquivalent ? '✅ EQUIVALENT' : '❌ NOT EQUIVALENT'}\n`;
    report += `Method: ${result.method}\n`;
    report += `Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
    report += `Time: ${result.time}ms\n`;

    if (result.formalResult) {
      report += '\n' + '='.repeat(70) + '\n';
      report += '🔬 FORMAL VERIFICATION (Z3)\n';
      report += '='.repeat(70) + '\n';
      report += `Status: ${result.formalResult.isValid ? '✅ EQUIVALENT' : '❌ NOT EQUIVALENT'}\n`;
      report += `Time: ${result.formalResult.time}ms\n`;
      if (result.formalResult.error) {
        report += `Error: ${result.formalResult.error}\n`;
      }
      if (result.formalResult.counterexample) {
        report += '\n📋 Counterexample:\n';
        for (const [key, value] of result.formalResult.counterexample) {
          report += `   ${key} = ${value}\n`;
        }
      }
      if (result.formalResult.results) {
        report += '\n📋 Verification results:\n';
        for (const r of result.formalResult.results) {
          const status = r.isValid ? '✅' : '❌';
          report += `   ${status} ${r.name}: ${r.isValid ? 'EQUIVALENT' : 'NOT EQUIVALENT'}\n`;
          if (r.counterexample) {
            report += `      Counterexample: ${JSON.stringify(Object.fromEntries(r.counterexample))}\n`;
          }
        }
      }
    }

    if (result.astResult) {
      report += '\n' + '='.repeat(70) + '\n';
      report += '📐 STRUCTURAL CHECK (AST)\n';
      report += '='.repeat(70) + '\n';
      report += `Status: ${result.astResult.isEquivalent ? '✅ PASSED' : '❌ HAS DIFFERENCES'}\n`;
      report += `Confidence: ${(result.astResult.confidence * 100).toFixed(1)}%\n`;
      if (!result.astResult.isEquivalent && result.astResult.differences.length > 0) {
        report += '\n📝 Differences:\n';
        for (const diff of result.astResult.differences.slice(0, 10)) {
          report += `   • [${diff.type}] at line ${diff.location.line || '?'}\n`;
          if (diff.original) report += `     Original: ${diff.original}\n`;
          if (diff.modified) report += `     Modified: ${diff.modified}\n`;
          if (diff.astNodeType) report += `     Node: ${diff.astNodeType}\n`;
        }
        if (result.astResult.differences.length > 10) {
          report += `   ... and ${result.astResult.differences.length - 10} more differences\n`;
        }
      }
    }

    if (result.differences && result.differences.length > 0) {
      report += '\n' + '='.repeat(70) + '\n';
      report += '📋 ALL DIFFERENCES\n';
      report += '='.repeat(70) + '\n';
      for (const diff of result.differences.slice(0, 10)) {
        report += `   • [${diff.type}] at line ${diff.location.line || '?'}\n`;
        if (diff.original) report += `     Original: ${diff.original}\n`;
        if (diff.modified) report += `     Modified: ${diff.modified}\n`;
        if (diff.astNodeType) report += `     Node: ${diff.astNodeType}\n`;
      }
      if (result.differences.length > 10) {
        report += `   ... and ${result.differences.length - 10} more differences\n`;
      }
    }

    report += '='.repeat(70) + '\n';
    report += `📅 Generated: ${new Date().toISOString()}\n`;
    report += `🔧 Version: 3.0.0 (Z3 Primary + AST Secondary)\n`;
    report += '='.repeat(70) + '\n';

    return report;
  }

  async saveReport(result: EquivalenceResult, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const extension = path.extname(outputPath);
    let content: string;

    if (extension === '.json') {
      content = JSON.stringify(
        {
          isEquivalent: result.isEquivalent,
          confidence: result.confidence,
          method: result.method,
          time: result.time,
          formalResult: result.formalResult,
          astResult: result.astResult,
          differences: result.differences,
          timestamp: new Date().toISOString(),
        },
        (_, value) => {
          if (value instanceof Map) {
            return Object.fromEntries(value);
          }
          return value;
        },
        2
      );
    } else {
      content = this.generateReport(result);
    }

    await fs.promises.writeFile(outputPath, content);
    console.log(`📄 Report saved: ${outputPath}`);
  }

  isEquivalent(result: EquivalenceResult): boolean {
    if (!result) return false;
    return result.isEquivalent === true && (result.confidence || 0) > 0.7;
  }

  needsReview(result: EquivalenceResult): boolean {
    if (!result) return true;
    if (!result.isEquivalent) return true;
    if (result.confidence < 0.85) return true;
    if (result.differences && result.differences.length > 0) return true;
    return false;
  }

  confidenceLevel(result: EquivalenceResult): 'high' | 'medium' | 'low' {
    if (result.confidence >= 0.9) return 'high';
    if (result.confidence >= 0.7) return 'medium';
    return 'low';
  }
}

// ============================================
// ЭКСПОРТ УТИЛИТ
// ============================================

export function isEquivalent(result: EquivalenceResult): boolean {
  if (!result) return false;
  return result.isEquivalent === true && (result.confidence || 0) > 0.7;
}

export function needsReview(result: EquivalenceResult): boolean {
  if (!result) return true;
  if (!result.isEquivalent) return true;
  if (result.confidence < 0.85) return true;
  if (result.differences && result.differences.length > 0) return true;
  return false;
}

export function confidenceLevel(result: EquivalenceResult): 'high' | 'medium' | 'low' {
  if (result.confidence >= 0.9) return 'high';
  if (result.confidence >= 0.7) return 'medium';
  return 'low';
}
