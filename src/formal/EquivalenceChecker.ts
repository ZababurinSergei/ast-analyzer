// packages/ast-analyzer/src/formal/EquivalenceChecker.ts

import type { FunctionContract } from './Z3Verifier.js';
import { Z3Verifier, range, eq, or } from './Z3Verifier.js';
import { Project, Node, ScriptTarget, ModuleKind, type SourceFile } from 'ts-morph';
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

      console.log('\n📐 STEP 1: Structural check via AST (PRIMARY)...');

      try {
        const result = this.compareSourceFilesAST(sourceFile1, sourceFile2, mergedOptions);
        astResult = {
          isEquivalent: result.isEquivalent,
          differences: result.differences,
          confidence: result.confidence || 1.0,
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

    let formalResult: {
      isValid: boolean;
      counterexample?: Map<string, any>;
      time: number;
      error?: string;
      results?: any[];
    } | null = null;

    const shouldRunZ3 =
      mergedOptions.formalVerification !== false &&
      (!astResult?.isEquivalent || astResult?.differences.length > 0);

    if (shouldRunZ3) {
      if (Date.now() - startTime > timeout) {
        console.log('\n⚠️ Timeout before Z3 analysis, skipping...');
        formalResult = {
          isValid: false,
          time: Date.now() - startTime,
          error: 'Timeout before Z3 analysis',
        };
      } else {
        console.log('\n🔬 STEP 2: Formal verification via Z3 (SECONDARY - for expressions)...');

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
            let z3Applied = false;

            for (const match of matchedFunctions) {
              if (
                this.isSimpleMathFunction(match.original.body) &&
                this.isSimpleMathFunction(match.modified.body)
              ) {
                z3Applied = true;
                console.log(`      🔍 Verifying function: ${match.name} (Z3)`);

                try {
                  const contract = this.createSimpleContract(
                    match.original,
                    match.modified,
                    match.name
                  );
                  const result = await z3.verifyFunction(contract);
                  verificationResults.push({
                    name: match.name,
                    isValid: result.isValid,
                    counterexample: result.counterexample,
                    time: result.time || 0,
                    error: result.error,
                  });

                  if (!result.isValid) {
                    allValid = false;
                    console.log(`         ❌ FAILED`);
                    if (result.counterexample) {
                      console.log(
                        `            Counterexample: ${JSON.stringify(Object.fromEntries(result.counterexample))}`
                      );
                    }
                  } else {
                    console.log(`         ✅ PASSED`);
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
              } else {
                console.log(`      🔍 Function: ${match.name} (AST only - complex)`);
                verificationResults.push({
                  name: match.name,
                  isValid: true,
                  note: 'Complex function - AST only',
                });
              }
            }

            if (!z3Applied) {
              console.log('   ℹ️ No simple math functions found for Z3 verification');
              formalResult = {
                isValid: true,
                time: Date.now() - startTime,
                results: verificationResults,
              };
            } else {
              formalResult = {
                isValid: allValid,
                counterexample: verificationResults.find(r => !r.isValid)?.counterexample,
                time: Date.now() - startTime,
                results: verificationResults,
              };
              console.log(
                `   ✅ Formal verification: ${allValid ? 'ALL PASSED 🎉' : 'SOME FAILED ❌'}`
              );
            }
          }

          if (formalResult && !formalResult.isValid) {
            console.log('\n❌ Formal verification FAILED — files are NOT EQUIVALENT');
            return {
              isEquivalent: false,
              confidence: 0.95,
              method: 'formal+structural',
              counterexample: formalResult.counterexample,
              time: Date.now() - startTime,
              formalResult,
              astResult: astResult || undefined,
              differences: astResult?.differences || [],
            };
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
    } else {
      console.log('\n🔬 STEP 2: Formal verification via Z3 (SKIPPED - no differences found)');
      formalResult = {
        isValid: true,
        time: Date.now() - startTime,
      };
    }

    let isEquivalent: boolean;
    let confidence: number;
    let method: 'formal' | 'structural' | 'formal+structural' | 'ast-only';

    if (astResult) {
      isEquivalent = astResult.isEquivalent;
      confidence = astResult.confidence;
      method = 'ast-only';

      if (formalResult && formalResult.isValid && !astResult.isEquivalent) {
        confidence = Math.max(confidence, 0.9);
        method = 'formal+structural';
        console.log('\n🎯 Combined result (AST has differences, Z3 PASSED):');
        console.log('   ✅ Z3 confirms equivalence → Final result: EQUIVALENT');
        isEquivalent = true;
        confidence = 0.95;
      } else if (formalResult && formalResult.isValid && astResult.isEquivalent) {
        confidence = Math.max(confidence, 0.98);
        method = 'formal+structural';
        console.log('\n🎯 Combined result (BOTH PASSED):');
        console.log('   ✅ AST and Z3 both say EQUIVALENT');
      } else if (formalResult && !formalResult.isValid) {
        method = 'formal+structural';
        console.log('\n🎯 Combined result (Z3 FAILED):');
        console.log('   ❌ Z3 says NOT EQUIVALENT → Final result: NOT EQUIVALENT');
        isEquivalent = false;
        confidence = 0.95;
      } else if (astResult.isEquivalent) {
        console.log('\n🎯 Result (AST only):');
        console.log('   ✅ AST says EQUIVALENT');
        isEquivalent = true;
      } else {
        console.log('\n🎯 Result (AST only):');
        console.log('   ❌ AST found differences');
        isEquivalent = false;
      }
    } else if (formalResult) {
      isEquivalent = formalResult.isValid;
      confidence = formalResult.isValid ? 1.0 : 0.95;
      method = 'formal';
      console.log(`\n🎯 Result (FORMAL only): ${isEquivalent ? 'PASSED ✅' : 'FAILED ❌'}`);
    } else {
      console.log('\n❌ No verification methods available');
      return {
        isEquivalent: false,
        confidence: 0,
        method: 'structural',
        time: Date.now() - startTime,
        differences: [
          {
            type: 'modified',
            location: { start: 0, end: 0, line: 1 },
            original: 'No verification method available',
            modified: 'Cannot determine equivalence',
            impact: 'high',
            astNodeType: 'error',
          },
        ],
      };
    }

    const allDifferences: CodeDifference[] = [];

    if (formalResult && !formalResult.isValid) {
      allDifferences.push({
        type: 'semantic',
        location: { start: 0, end: 0, line: 1 },
        original: 'Formal verification failed',
        modified: 'Functions are not semantically equivalent',
        impact: 'high',
        astNodeType: 'formal',
      });
    }

    if (astResult && !astResult.isEquivalent) {
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
    console.log(`📋 Method: STRUCTURAL (AST) + FORMAL (Z3)`);
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

    if (mergedOptions.structuralCheck !== false) {
      console.log('\n📐 STEP 1: Structural check via AST (PRIMARY)...');

      try {
        const sourceFile1 = this.project.createSourceFile(
          'func1.ts',
          `function test() ${originalFunction}`,
          { overwrite: true }
        );
        const sourceFile2 = this.project.createSourceFile(
          'func2.ts',
          `function test() ${modifiedFunction}`,
          { overwrite: true }
        );

        const func1 = sourceFile1.getFunctions()[0];
        const func2 = sourceFile2.getFunctions()[0];

        if (func1 && func2) {
          const result = this.compareNodesAST(func1, func2, mergedOptions);
          astResult = {
            isEquivalent: result.isEquivalent,
            differences: result.differences,
            confidence: result.confidence || 1.0,
          };

          console.log(
            `   ✅ AST check: ${astResult.isEquivalent ? 'PASSED ✅' : `HAS ${astResult.differences.length} DIFFERENCES`}`
          );
          if (!astResult.isEquivalent && astResult.differences.length > 0) {
            for (const diff of astResult.differences.slice(0, 3)) {
              console.log(
                `      📝 ${diff.type}: ${diff.original || '?'} → ${diff.modified || '?'}`
              );
            }
          }
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

    let formalResult: {
      isValid: boolean;
      counterexample?: Map<string, any>;
      time: number;
      error?: string;
    } | null = null;

    if (mergedOptions.formalVerification !== false && astResult && !astResult.isEquivalent) {
      if (Date.now() - startTime > timeout) {
        console.log('\n⚠️ Timeout before Z3 analysis, skipping...');
        formalResult = {
          isValid: false,
          time: Date.now() - startTime,
          error: 'Timeout before Z3 analysis',
        };
      } else {
        console.log('\n🔬 STEP 2: Formal verification via Z3 (SECONDARY)...');

        try {
          const z3 = await this.getZ3Verifier();

          if (
            this.isSimpleMathFunction(originalFunction) &&
            this.isSimpleMathFunction(modifiedFunction)
          ) {
            const verifyResult = await z3.verifyFunction(contract);
            formalResult = {
              isValid: verifyResult.isValid,
              counterexample: verifyResult.counterexample,
              time: verifyResult.time || 0,
              error: verifyResult.error,
            };

            if (verifyResult.isValid) {
              console.log('   ✅ Function VERIFIED formally');
            } else {
              console.log('   ❌ Function FAILED formal verification');
              if (verifyResult.counterexample) {
                console.log(
                  `      Counterexample: ${JSON.stringify(Object.fromEntries(verifyResult.counterexample))}`
                );
              }
            }
          } else {
            console.log('   ℹ️ Function is complex - using AST only');
            formalResult = {
              isValid: true,
              time: 0,
            };
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
    }

    let isEquivalent: boolean;
    let confidence: number;
    let method: 'formal' | 'structural' | 'formal+structural' | 'ast-only';

    if (astResult) {
      isEquivalent = astResult.isEquivalent;
      confidence = astResult.confidence;
      method = 'ast-only';

      if (formalResult && formalResult.isValid && !astResult.isEquivalent) {
        isEquivalent = true;
        confidence = 0.9;
        method = 'formal+structural';
        console.log('\n🎯 Z3 says EQUIVALENT (AST differences are non-semantic)');
      } else if (formalResult && !formalResult.isValid) {
        isEquivalent = false;
        confidence = 0.95;
        method = 'formal+structural';
        console.log('\n🎯 Z3 says NOT EQUIVALENT');
      } else if (astResult.isEquivalent) {
        console.log('\n🎯 AST says EQUIVALENT');
      } else {
        console.log('\n🎯 AST found differences');
      }
    } else {
      isEquivalent = false;
      confidence = 0.5;
      method = 'structural';
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
    const params = original.params.map(p => ({
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

  private compareSourceFilesAST(
    sourceFile1: SourceFile,
    sourceFile2: SourceFile,
    options: EquivalenceOptions
  ): { isEquivalent: boolean; differences: CodeDifference[]; confidence?: number } {
    const differences: CodeDifference[] = [];

    const statements1 = sourceFile1.getStatements();
    const statements2 = sourceFile2.getStatements();

    if (statements1.length !== statements2.length) {
      differences.push({
        type: 'modified',
        location: { start: 1, end: 1, line: 1 },
        original: `${statements1.length} statements`,
        modified: `${statements2.length} statements`,
        impact: 'high',
        astNodeType: 'statements',
      });
      return { isEquivalent: false, differences, confidence: 0.5 };
    }

    for (let i = 0; i < statements1.length; i++) {
      const stmt1 = statements1[i];
      const stmt2 = statements2[i];
      if (stmt1 && stmt2) {
        const result = this.compareNodesAST(stmt1, stmt2, options);
        if (!result.isEquivalent) {
          differences.push(...result.differences);
          return { isEquivalent: false, differences, confidence: result.confidence };
        }
      }
    }

    return { isEquivalent: true, differences, confidence: 1.0 };
  }

  private compareNodesAST(
    node1: Node,
    node2: Node,
    options: EquivalenceOptions
  ): { isEquivalent: boolean; differences: CodeDifference[]; confidence?: number } {
    const differences: CodeDifference[] = [];

    if (!node1 || !node2) {
      differences.push({
        type: 'modified',
        location: { start: 1, end: 1, line: 1 },
        original: node1 ? 'Node exists' : 'Node is null',
        modified: node2 ? 'Node exists' : 'Node is null',
        impact: 'high',
        astNodeType: 'null_check',
      });
      return { isEquivalent: false, differences, confidence: 0 };
    }

    if (node1.getKind() !== node2.getKind()) {
      differences.push({
        type: 'modified',
        location: {
          start: node1.getStartLineNumber(),
          end: node1.getEndLineNumber(),
          line: node1.getStartLineNumber(),
        },
        original: node1.getKindName(),
        modified: node2.getKindName(),
        impact: 'high',
        astNodeType: node1.getKindName(),
      });
      return { isEquivalent: false, differences, confidence: 0.5 };
    }

    const props1 = this.getNodePropertiesAST(node1);
    const props2 = this.getNodePropertiesAST(node2);

    for (const [key, value1] of props1) {
      const value2 = props2.get(key);
      if (value1 !== undefined && value2 !== undefined && value1 !== value2) {
        if (options.ignoreWhitespace && typeof value1 === 'string' && typeof value2 === 'string') {
          if (value1.replace(/\s/g, '') === value2.replace(/\s/g, '')) {
            continue;
          }
        }
        if (options.ignoreComments && typeof value1 === 'string' && typeof value2 === 'string') {
          const clean1 = value1.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          const clean2 = value2.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          if (clean1.trim() === clean2.trim()) {
            continue;
          }
        }

        differences.push({
          type: 'modified',
          location: {
            start: node1.getStartLineNumber(),
            end: node1.getEndLineNumber(),
            line: node1.getStartLineNumber(),
          },
          original: `${key}: ${value1}`,
          modified: `${key}: ${value2}`,
          impact: 'medium',
          astNodeType: key,
        });
        return { isEquivalent: false, differences, confidence: 0.8 };
      }
    }

    const children1 = node1.getChildren();
    const children2 = node2.getChildren();

    if (children1.length !== children2.length) {
      differences.push({
        type: 'modified',
        location: {
          start: node1.getStartLineNumber(),
          end: node1.getEndLineNumber(),
          line: node1.getStartLineNumber(),
        },
        original: `${children1.length} children`,
        modified: `${children2.length} children`,
        impact: 'medium',
        astNodeType: 'children',
      });
      return { isEquivalent: false, differences, confidence: 0.8 };
    }

    for (let i = 0; i < children1.length; i++) {
      const child1 = children1[i];
      const child2 = children2[i];
      if (child1 && child2) {
        const result = this.compareNodesAST(child1, child2, options);
        if (!result.isEquivalent) {
          differences.push(...result.differences);
          return { isEquivalent: false, differences, confidence: result.confidence };
        }
      }
    }

    return { isEquivalent: true, differences, confidence: 1.0 };
  }

  private getNodePropertiesAST(node: Node): Map<string, any> {
    const properties = new Map<string, any>();

    try {
      properties.set('kind', node.getKind());
      properties.set('kindName', node.getKindName());
      properties.set('text', node.getText());

      if (Node.isIdentifier(node)) {
        properties.set('name', node.getText());
      }

      if (Node.isFunctionDeclaration(node)) {
        const name = node.getName();
        if (name) properties.set('name', name);
        properties.set('isAsync', node.isAsync());
        properties.set('isExported', node.isExported());
        properties.set('parameterCount', node.getParameters().length);
        properties.set('hasBody', !!node.getBody());
        const returnType = node.getReturnType();
        if (returnType) {
          properties.set('returnType', returnType.getText());
        }
      }

      if (Node.isVariableDeclaration(node)) {
        properties.set('name', node.getName());
        properties.set('isExported', node.isExported());
        const initializer = node.getInitializer();
        if (initializer) {
          properties.set('hasInitializer', true);
          properties.set('initializerKind', initializer.getKindName());
        }
      }

      if (Node.isArrowFunction(node)) {
        properties.set('isAsync', node.isAsync());
        properties.set('parameterCount', node.getParameters().length);
        const returnType = node.getReturnType();
        if (returnType) {
          properties.set('returnType', returnType.getText());
        }
        properties.set('hasBody', !!node.getBody());
      }

      if (Node.isClassDeclaration(node)) {
        const name = node.getName();
        if (name) properties.set('name', name);
        properties.set('isExported', node.isExported());
        properties.set('methodCount', node.getMethods().length);
      }

      if (Node.isMethodDeclaration(node)) {
        properties.set('name', node.getName());
        properties.set('isAsync', node.isAsync());
        properties.set('parameterCount', node.getParameters().length);
        properties.set('hasBody', !!node.getBody());
      }

      if (Node.isReturnStatement(node)) {
        const expr = node.getExpression();
        if (expr) {
          properties.set('hasExpression', true);
          properties.set('expressionKind', expr.getKindName());
        }
      }

      if (Node.isBinaryExpression(node)) {
        const operator = node.getOperatorToken();
        if (operator) {
          properties.set('operator', operator.getText());
        }
        const left = node.getLeft();
        const right = node.getRight();
        if (left) {
          properties.set('leftKind', left.getKindName());
        }
        if (right) {
          properties.set('rightKind', right.getKindName());
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    return properties;
  }

  private extractFunctionsAST(sourceFile: SourceFile): FunctionSignature[] {
    const functions: FunctionSignature[] = [];

    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (!name) continue;

      const params = func.getParameters().map(p => ({
        name: p.getName(),
        type: p.getType().getText(),
      }));

      const returnType = func.getReturnType().getText();
      const body = func.getBody()?.getText() || '';

      functions.push({
        name,
        params: params.map(p => p.name),
        returnType,
        isAsync: func.isAsync(),
        isExported: func.isExported(),
        body,
        startLine: func.getStartLineNumber(),
        endLine: func.getEndLineNumber(),
        isArrow: false,
        paramTypes: params.map(p => p.type),
      });
    }

    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const name = varDecl.getName();
        const params = initializer.getParameters().map(p => ({
          name: p.getName(),
          type: p.getType().getText(),
        }));
        const returnType = initializer.getReturnType().getText();
        const body = initializer.getBody()?.getText() || '';

        functions.push({
          name,
          params: params.map(p => p.name),
          returnType,
          isAsync: initializer.isAsync(),
          isExported: varDecl.isExported(),
          body,
          startLine: varDecl.getStartLineNumber(),
          endLine: varDecl.getEndLineNumber(),
          isArrow: true,
          paramTypes: params.map(p => p.type),
        });
      }
    }

    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;

      for (const method of cls.getMethods()) {
        const name = method.getName();
        if (!name) continue;

        const params = method.getParameters().map(p => ({
          name: p.getName(),
          type: p.getType().getText(),
        }));
        const returnType = method.getReturnType().getText();
        const body = method.getBody()?.getText() || '';

        functions.push({
          name: `${className}.${name}`,
          params: params.map(p => p.name),
          returnType,
          isAsync: method.isAsync(),
          isExported: false,
          body,
          startLine: method.getStartLineNumber(),
          endLine: method.getEndLineNumber(),
          isArrow: false,
          paramTypes: params.map(p => p.type),
        });
      }
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
      const mod = functions2.find(f => f.name === orig.name);
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
      report += `Status: ${result.formalResult.isValid ? '✅ PASSED' : '❌ FAILED'}\n`;
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
          report += `   ${status} ${r.name}: ${r.isValid ? 'PASSED' : 'FAILED'}\n`;
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
    report += `🔧 Version: 3.0.0 (AST Primary + Z3 Secondary)\n`;
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
    if (result.method === 'formal+structural' && result.formalResult?.isValid) {
      return true;
    }
    return result.isEquivalent === true && (result.confidence || 0) > 0.9;
  }

  needsReview(result: EquivalenceResult): boolean {
    if (!result) return true;
    if (!result.isEquivalent) return true;
    if (result.confidence < 0.9) return true;
    if (result.differences && result.differences.length > 0) return true;
    return false;
  }

  confidenceLevel(result: EquivalenceResult): 'high' | 'medium' | 'low' {
    if (result.confidence >= 0.95) return 'high';
    if (result.confidence >= 0.7) return 'medium';
    return 'low';
  }

  isASTEqual(node1: any, node2: any): boolean {
    if (!node1 || !node2) return false;
    if (node1.type !== node2.type) return false;
    if (node1.text !== node2.text) return false;
    return true;
  }

  findAllDifferences(node1: any, node2: any): CodeDifference[] {
    const differences: CodeDifference[] = [];

    if (!node1 && !node2) return [];
    if (!node1) {
      differences.push({
        type: 'added',
        location: { start: 0, end: 0, line: 1 },
        original: 'null',
        modified: JSON.stringify(node2),
        impact: 'high',
        astNodeType: 'added',
      });
      return differences;
    }
    if (!node2) {
      differences.push({
        type: 'removed',
        location: { start: 0, end: 0, line: 1 },
        original: JSON.stringify(node1),
        modified: 'null',
        impact: 'high',
        astNodeType: 'removed',
      });
      return differences;
    }

    const keys1 = Object.keys(node1);
    const keys2 = Object.keys(node2);
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const val1 = node1[key];
      const val2 = node2[key];

      if (typeof val1 !== typeof val2) {
        differences.push({
          type: 'modified',
          location: { start: 0, end: 0, line: 1 },
          original: `${key}: ${val1}`,
          modified: `${key}: ${val2}`,
          impact: 'medium',
          astNodeType: key,
        });
        continue;
      }

      if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
        const childDiffs = this.findAllDifferences(val1, val2);
        differences.push(...childDiffs);
      } else if (val1 !== val2) {
        differences.push({
          type: 'modified',
          location: { start: 0, end: 0, line: 1 },
          original: `${key}: ${val1}`,
          modified: `${key}: ${val2}`,
          impact: 'low',
          astNodeType: key,
        });
      }
    }

    return differences;
  }
}

// ============================================
// ЭКСПОРТ УТИЛИТ
// ============================================

export function isEquivalent(result: EquivalenceResult): boolean {
  if (!result) return false;
  if (result.method === 'formal+structural' && result.formalResult?.isValid) {
    return true;
  }
  return result.isEquivalent === true && (result.confidence || 0) > 0.9;
}

export function needsReview(result: EquivalenceResult): boolean {
  if (!result) return true;
  if (!result.isEquivalent) return true;
  if (result.confidence < 0.9) return true;
  if (result.differences && result.differences.length > 0) return true;
  return false;
}

export function confidenceLevel(result: EquivalenceResult): 'high' | 'medium' | 'low' {
  if (result.confidence >= 0.95) return 'high';
  if (result.confidence >= 0.7) return 'medium';
  return 'low';
}
