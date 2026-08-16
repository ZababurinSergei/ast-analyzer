// src/formal/checkers/RefactoringEquivalenceChecker.ts
// Облегченная версия для проверки эквивалентности рефакторинга
// Использует новые core-компоненты: ASTComparator, SignatureComparator, CallGraphComparator

import type { SourceFile } from 'ts-morph';
import { Project, Node } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import { Z3Verifier, type FunctionContract } from '../Z3Verifier.js';
import { ASTComparator, type ASTDifference } from '../../core/ASTComparator.js';
import {
  SignatureComparator,
  type FunctionSignature,
  type SignatureChange,
} from '../../core/SignatureComparator.js';
import {
  CallGraphComparator,
  type CallGraph,
  type CallGraphChange,
} from '../../core/CallGraphComparator.js';

// ============================================
// ТИПЫ
// ============================================

export interface RefactoringEquivalenceResult {
  isEquivalent: boolean;
  totalFunctions: number;
  verifiedFunctions: number;
  failedFunctions: {
    name: string;
    reason: string;
    counterexample?: Map<string, any>;
    originalBehavior?: string;
    refactoredBehavior?: string;
    diff?: string;
  }[];
  missingFunctions: string[];
  addedFunctions: string[];
  signatureChanges: SignatureChange[];
  callGraphChanges: CallGraphChange[];
  astDifferences: ASTDifference[];
  verificationDetails: {
    functionName: string;
    isEquivalent: boolean;
    time: number;
    error?: string;
    method: 'formal' | 'structural' | 'semantic';
  }[];
  report: string;
  summary: {
    functionsChecked: number;
    functionsVerified: number;
    functionsFailed: number;
    functionsAdded: number;
    functionsRemoved: number;
    signatureChanges: number;
    callGraphChanges: number;
    astDifferencesCount: number;
    totalTime: number;
  };
}

export interface EquivalenceCheckOptions {
  formalVerification?: boolean;
  structuralCheck?: boolean;
  semanticCheck?: boolean;
  checkCallGraph?: boolean;
  checkSignatures?: boolean;
  checkAST?: boolean;
  maxDepth?: number;
  timeout?: number;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  generateDiff?: boolean;
}

// ============================================
// ОСНОВНОЙ КЛАСС
// ============================================

export class RefactoringEquivalenceChecker {
  private project: Project;
  private astComparator: ASTComparator;
  private signatureComparator: SignatureComparator;
  private callGraphComparator: CallGraphComparator;
  private z3Verifier: Z3Verifier | null = null;
  private options: EquivalenceCheckOptions;
  private initialized = false;
  private z3Provided = false;

  constructor(options: EquivalenceCheckOptions = {}, z3Verifier?: Z3Verifier) {
    this.options = {
      formalVerification: true,
      structuralCheck: true,
      semanticCheck: true,
      checkCallGraph: true,
      checkSignatures: true,
      checkAST: true,
      maxDepth: 10,
      timeout: 30000,
      ignoreWhitespace: true,
      ignoreComments: true,
      generateDiff: true,
      ...options,
    };

    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        jsx: 2,
      },
      useInMemoryFileSystem: false,
    });

    this.astComparator = new ASTComparator();
    this.signatureComparator = new SignatureComparator();
    this.callGraphComparator = new CallGraphComparator();

    if (z3Verifier) {
      this.z3Verifier = z3Verifier;
      this.z3Provided = true;
      this.initialized = true;
    } else {
      this.z3Verifier = new Z3Verifier();
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('✅ RefactoringEquivalenceChecker already initialized');
      return;
    }

    if (this.z3Provided) {
      this.initialized = true;
      console.log(
        '✅ RefactoringEquivalenceChecker marked as initialized (Z3 provided externally)'
      );
      return;
    }

    await this.z3Verifier!.initialize();
    this.initialized = true;
    console.log('✅ RefactoringEquivalenceChecker initialized');
  }

  async dispose(): Promise<void> {
    if (this.z3Provided) {
      this.initialized = false;
      console.log('✅ RefactoringEquivalenceChecker disposed (Z3 kept alive)');
      return;
    }

    if (this.z3Verifier) {
      await this.z3Verifier.dispose();
      this.z3Verifier = null;
    }
    this.initialized = false;
  }

  /**
   * Проверяет эквивалентность исходного файла и рефакторинга (разбитого на модули)
   */
  async checkRefactoringEquivalence(
    originalFilePath: string,
    refactoredFilePath: string,
    modulesDir?: string
  ): Promise<RefactoringEquivalenceResult> {
    const startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🔬 ФОРМАЛЬНАЯ ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ РЕФАКТОРИНГА');
    console.log('='.repeat(70));
    console.log(`📄 Исходный файл: ${path.basename(originalFilePath)}`);
    console.log(`📄 Рефакторинг: ${path.basename(refactoredFilePath)}`);
    if (modulesDir) {
      console.log(`📁 Модули: ${modulesDir}`);
    }
    console.log(`🔧 Опции: ${JSON.stringify(this.options, null, 2)}`);

    const result: RefactoringEquivalenceResult = {
      isEquivalent: true,
      totalFunctions: 0,
      verifiedFunctions: 0,
      failedFunctions: [],
      missingFunctions: [],
      addedFunctions: [],
      signatureChanges: [],
      callGraphChanges: [],
      astDifferences: [],
      verificationDetails: [],
      report: '',
      summary: {
        functionsChecked: 0,
        functionsVerified: 0,
        functionsFailed: 0,
        functionsAdded: 0,
        functionsRemoved: 0,
        signatureChanges: 0,
        callGraphChanges: 0,
        astDifferencesCount: 0,
        totalTime: 0,
      },
    };

    try {
      // ШАГ 1: Извлекаем функции из исходного файла
      console.log('\n📊 ШАГ 1: Извлечение функций из исходного файла...');
      const sourceFile1 = this.project.addSourceFileAtPath(originalFilePath);
      if (!sourceFile1) {
        throw new Error(`Не удалось загрузить файл: ${originalFilePath}`);
      }
      const sigs1 = this.signatureComparator.extractAllSignatures(sourceFile1);
      const functions1 = this.extractAllFunctions(sourceFile1);
      console.log(`   ✅ Найдено: ${sigs1.size} функций`);

      // ШАГ 2: Извлекаем функции из рефакторинга
      console.log('\n📊 ШАГ 2: Извлечение функций из рефакторинга...');
      const refactoredFiles = [refactoredFilePath];
      if (modulesDir && fs.existsSync(modulesDir)) {
        const moduleFiles = fs
          .readdirSync(modulesDir)
          .filter(
            (f: string) =>
              f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.mjs') || f.endsWith('.cjs')
          );
        console.log(`   📁 Найдено модулей: ${moduleFiles.length}`);
        refactoredFiles.push(...moduleFiles.map((f: string) => path.join(modulesDir, f)));
      }

      const allSigs2 = new Map<string, FunctionSignature>();
      const allFunctions2 = new Map<string, { node: Node; body?: string }>();
      for (const file of refactoredFiles) {
        if (!fs.existsSync(file)) continue;
        const sourceFile = this.project.addSourceFileAtPath(file);
        if (sourceFile) {
          const sigs = this.signatureComparator.extractAllSignatures(sourceFile);
          for (const [name, sig] of sigs) {
            allSigs2.set(name, sig);
          }
          const funcs = this.extractAllFunctions(sourceFile);
          for (const [name, func] of funcs) {
            allFunctions2.set(name, func);
          }
        }
      }
      console.log(`   ✅ Найдено: ${allSigs2.size} функций`);

      // ШАГ 3: AST сравнение (если включено)
      if (this.options.checkAST) {
        console.log('\n📊 ШАГ 3: Сравнение AST...');
        const astResult = this.astComparator.compareFiles(originalFilePath, refactoredFilePath, {
          ignoreWhitespace: this.options.ignoreWhitespace,
          ignoreComments: this.options.ignoreComments,
        });
        result.astDifferences = astResult.differences;
        result.summary.astDifferencesCount = astResult.differences.length;

        if (astResult.isEquivalent) {
          console.log(
            `   ✅ AST эквивалентны (confidence: ${(astResult.confidence * 100).toFixed(1)}%)`
          );
        } else {
          console.log(`   ⚠️ Найдено ${astResult.differences.length} различий в AST`);
          for (const diff of astResult.differences.slice(0, 3)) {
            console.log(`      📝 ${diff.type}: ${diff.original || '?'} → ${diff.modified || '?'}`);
          }
          if (astResult.differences.length > 3) {
            console.log(`      ... и ещё ${astResult.differences.length - 3} различий`);
          }
        }
      }

      // ШАГ 4: Сравнение сигнатур (если включено)
      if (this.options.checkSignatures) {
        console.log('\n📊 ШАГ 4: Сравнение сигнатур...');
        const sigComparison = this.signatureComparator.compareAllSignatures(sigs1, allSigs2);
        result.missingFunctions = sigComparison.missing;
        result.addedFunctions = sigComparison.added;
        result.signatureChanges = sigComparison.changes;
        result.summary.signatureChanges = sigComparison.changes.length;
        result.summary.functionsRemoved = sigComparison.missing.length;
        result.summary.functionsAdded = sigComparison.added.length;

        console.log(`   ✅ Сигнатуры проверены. Изменений: ${sigComparison.changes.length}`);
        if (sigComparison.missing.length > 0) {
          console.log(`   ❌ Отсутствует функций: ${sigComparison.missing.length}`);
        }
        if (sigComparison.added.length > 0) {
          console.log(`   ➕ Добавлено функций: ${sigComparison.added.length}`);
        }
      }

      // ШАГ 5: Сравнение графа вызовов (если включено)
      if (this.options.checkCallGraph) {
        console.log('\n📊 ШАГ 5: Сравнение графа вызовов...');
        const graph1 = this.callGraphComparator.buildCallGraph(sourceFile1);

        // Строим граф для рефакторинга (объединяем все файлы)
        const graph2: CallGraph = { nodes: new Set<string>(), edges: [], entryPoints: [] };
        for (const file of refactoredFiles) {
          if (!fs.existsSync(file)) continue;
          const sourceFile = this.project.addSourceFileAtPath(file);
          if (sourceFile) {
            const g = this.callGraphComparator.buildCallGraph(sourceFile);
            for (const node of g.nodes) graph2.nodes.add(node);
            graph2.edges.push(...g.edges);
            graph2.entryPoints.push(...g.entryPoints);
          }
        }

        const graphComparison = this.callGraphComparator.compareGraphs(graph1, graph2);
        result.callGraphChanges = graphComparison.changes;
        result.summary.callGraphChanges = graphComparison.changes.length;

        console.log(`   ✅ Изменений в графе: ${graphComparison.changes.length}`);
        if (!graphComparison.isEquivalent) {
          console.log(`   ⚠️ Найдено ${graphComparison.changes.length} изменений в графе вызовов`);
          for (const change of graphComparison.changes.slice(0, 3)) {
            const icon = change.type === 'added_edge' ? '➕' : '➖';
            console.log(`      ${icon} ${change.from} → ${change.to}`);
          }
        }
      }

      // ШАГ 6: Проверка эквивалентности поведения (формальная верификация)
      if (this.options.formalVerification || this.options.structuralCheck) {
        console.log('\n📊 ШАГ 6: Проверка эквивалентности поведения...');
        result.totalFunctions = sigs1.size;

        for (const [name, sig] of sigs1) {
          const refSig = allSigs2.get(name);
          if (!refSig) continue;

          const origFunc = functions1.get(name);
          const refFunc = allFunctions2.get(name);

          if (!origFunc || !refFunc) {
            result.failedFunctions.push({
              name,
              reason: 'Функция не найдена в рефакторинге',
            });
            continue;
          }

          console.log(`\n🔍 Проверка: ${name}`);

          try {
            // Сначала пробуем структурное сравнение
            let isEquivalent = false;
            let method: 'formal' | 'structural' | 'semantic' = 'structural';
            let time = 0;

            if (this.options.structuralCheck) {
              const nodeResult = this.astComparator.compareNodes(origFunc.node, refFunc.node, {
                ignoreWhitespace: this.options.ignoreWhitespace,
                ignoreComments: this.options.ignoreComments,
              });
              isEquivalent = nodeResult.isEquivalent;
              time = Date.now() - startTime;
              method = 'structural';
            }

            // Если структурно не эквивалентны, пробуем формальную верификацию
            if (!isEquivalent && this.options.formalVerification && this.z3Verifier) {
              console.log(`   🔬 Запуск формальной верификации для ${name}...`);
              const contract = this.createContractFromSignature(sig);
              const verifyResult = await this.z3Verifier.verifyFunction(contract);
              isEquivalent = verifyResult.isValid;
              time = verifyResult.time || 0;
              method = 'formal';

              if (!isEquivalent && verifyResult.counterexample) {
                result.failedFunctions.push({
                  name,
                  reason: 'Формальная верификация не пройдена',
                  counterexample: verifyResult.counterexample,
                  originalBehavior: origFunc.body?.substring(0, 200),
                  refactoredBehavior: refFunc.body?.substring(0, 200),
                  diff: this.generateDiff(origFunc.body || '', refFunc.body || ''),
                });
              }
            }

            result.verificationDetails.push({
              functionName: name,
              isEquivalent,
              time,
              method,
            });

            if (isEquivalent) {
              result.verifiedFunctions++;
              console.log(`  ✅ Эквивалентна (${time}ms)`);
            } else if (!result.failedFunctions.some((f: { name: string }) => f.name === name)) {
              result.failedFunctions.push({
                name,
                reason: 'Поведение отличается',
                originalBehavior: origFunc.body?.substring(0, 200),
                refactoredBehavior: refFunc.body?.substring(0, 200),
                diff: this.generateDiff(origFunc.body || '', refFunc.body || ''),
              });
              console.log(`  ❌ НЕ ЭКВИВАЛЕНТНА`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.failedFunctions.push({
              name,
              reason: `Ошибка верификации: ${errorMsg}`,
            });
            console.log(`  ❌ Ошибка: ${errorMsg}`);
          }
        }

        result.summary.functionsChecked = result.totalFunctions;
        result.summary.functionsVerified = result.verifiedFunctions;
        result.summary.functionsFailed = result.failedFunctions.length;
      }

      // ШАГ 7: Итоговая оценка эквивалентности
      console.log('\n📊 ШАГ 7: Итоговая оценка...');

      const hasMissingFunctions = result.missingFunctions.length > 0;
      const hasFailedVerifications = result.failedFunctions.length > 0;
      const hasCriticalSignatureChanges = result.signatureChanges.some(
        (change: SignatureChange) => change.impact === 'high'
      );
      const hasSignificantASTDifferences = result.astDifferences.some(
        (diff: ASTDifference) => diff.impact === 'high'
      );

      result.isEquivalent =
        !hasMissingFunctions &&
        !hasFailedVerifications &&
        !hasCriticalSignatureChanges &&
        !hasSignificantASTDifferences;

      if (result.addedFunctions.length > 0) {
        console.log(
          `   ℹ️ Добавлено ${result.addedFunctions.length} новых функций (это допустимо)`
        );
      }

      if (result.missingFunctions.length > 0) {
        console.log(`   ❌ Отсутствует ${result.missingFunctions.length} функций`);
      }

      if (result.failedFunctions.length > 0) {
        console.log(`   ❌ Ошибок верификации: ${result.failedFunctions.length}`);
      }

      if (result.signatureChanges.length > 0) {
        const critical = result.signatureChanges.filter(
          (c: SignatureChange) => c.impact === 'high'
        );
        if (critical.length > 0) {
          console.log(`   ❌ Критических изменений сигнатур: ${critical.length}`);
        } else {
          console.log(`   ⚠️ Изменений сигнатур: ${result.signatureChanges.length}`);
        }
      }

      // ШАГ 8: Генерация отчета
      console.log('\n📊 ШАГ 8: Генерация отчета...');
      result.summary.totalTime = Date.now() - startTime;
      result.report = this.generateReport(result);

      console.log('\n' + '='.repeat(70));
      if (result.isEquivalent) {
        console.log('✅ РЕФАКТОРИНГ ЭКВИВАЛЕНТЕН!');
        console.log(
          `   ✅ Верифицировано: ${result.verifiedFunctions}/${result.totalFunctions} функций`
        );
        console.log(`   ⏱️ Время: ${(result.summary.totalTime / 1000).toFixed(2)} сек`);
      } else {
        console.log('❌ РЕФАКТОРИНГ НЕ ЭКВИВАЛЕНТЕН!');
        if (result.failedFunctions.length > 0) {
          console.log(`   ❌ Ошибок верификации: ${result.failedFunctions.length}`);
        }
        if (result.missingFunctions.length > 0) {
          console.log(`   ❌ Отсутствует функций: ${result.missingFunctions.length}`);
        }
        if (result.signatureChanges.length > 0) {
          console.log(`   📝 Изменений сигнатур: ${result.signatureChanges.length}`);
        }
        if (result.astDifferences.length > 0) {
          console.log(`   📝 AST различий: ${result.astDifferences.length}`);
        }
        console.log(`   ⏱️ Время: ${(result.summary.totalTime / 1000).toFixed(2)} сек`);
      }
      console.log('='.repeat(70) + '\n');

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Критическая ошибка при проверке эквивалентности:', errorMsg);
      result.isEquivalent = false;
      result.report = this.generateErrorReport(errorMsg);
      return result;
    }
  }

  /**
   * Извлекает все функции из файла с сохранением узлов и тела
   */
  private extractAllFunctions(sourceFile: SourceFile): Map<string, { node: Node; body?: string }> {
    const functions = new Map<string, { node: Node; body?: string }>();

    // Функции
    for (const func of sourceFile.getFunctions()) {
      const name = func.getName();
      if (name) {
        functions.set(name, {
          node: func,
          body: func.getBody()?.getText(),
        });
      }
    }

    // Методы классов
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;
      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          const fullName = `${className}.${methodName}`;
          functions.set(fullName, {
            node: method,
            body: method.getBody()?.getText(),
          });
        }
      }
    }

    // Стрелочные функции в переменных
    for (const varDecl of sourceFile.getVariableDeclarations()) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const name = varDecl.getName();
        functions.set(name, {
          node: initializer,
          body: initializer.getBody()?.getText(),
        });
      }
    }

    return functions;
  }

  /**
   * Создает контракт из сигнатуры для Z3
   */
  private createContractFromSignature(sig: FunctionSignature): FunctionContract {
    const params = sig.params.map((name: string) => ({
      name,
      type: this.inferParamType(name, sig),
    }));

    let returnType: 'int' | 'bool' | 'string' | 'void' = 'void';
    if (sig.returnType.includes('number') || sig.returnType.includes('int')) {
      returnType = 'int';
    } else if (sig.returnType.includes('boolean') || sig.returnType.includes('bool')) {
      returnType = 'bool';
    } else if (sig.returnType.includes('string')) {
      returnType = 'string';
    }

    return {
      name: sig.name,
      params,
      returnType,
      preconditions: [],
      postconditions: [],
      invariants: [],
    };
  }

  /**
   * Определяет тип параметра по имени и контексту
   */
  private inferParamType(name: string, sig: FunctionSignature): 'int' | 'bool' | 'string' {
    const index = sig.params.indexOf(name);
    if (index !== -1 && index < sig.paramTypes.length) {
      const type = sig.paramTypes[index];
      if (type && (type.includes('number') || type.includes('int'))) return 'int';
      if (type && (type.includes('boolean') || type.includes('bool'))) return 'bool';
      if (type && type.includes('string')) return 'string';
    }
    return 'int';
  }

  /**
   * Генерирует diff между двумя строками
   */
  private generateDiff(original: string, modified: string): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    let diff = '';
    const maxLen = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLen; i++) {
      const orig = originalLines[i] || '';
      const mod = modifiedLines[i] || '';

      if (orig !== mod) {
        if (orig && mod) {
          diff += `  - ${orig}\n  + ${mod}\n`;
        } else if (orig) {
          diff += `  - ${orig}\n`;
        } else if (mod) {
          diff += `  + ${mod}\n`;
        }
      }
    }

    return diff;
  }

  /**
   * Генерирует полный отчет
   */
  private generateReport(result: RefactoringEquivalenceResult): string {
    let report = '';
    report += '='.repeat(70) + '\n';
    report += '🔬 ОТЧЕТ О ФОРМАЛЬНОЙ ПРОВЕРКЕ ЭКВИВАЛЕНТНОСТИ\n';
    report += '='.repeat(70) + '\n\n';

    report += '📊 СТАТИСТИКА:\n';
    report += `   • Проверено функций: ${result.summary.functionsChecked}\n`;
    report += `   • Верифицировано: ${result.summary.functionsVerified}\n`;
    report += `   • Ошибок: ${result.summary.functionsFailed}\n`;
    report += `   • Добавлено функций: ${result.summary.functionsAdded}\n`;
    report += `   • Удалено функций: ${result.summary.functionsRemoved}\n`;
    report += `   • Изменений сигнатур: ${result.summary.signatureChanges}\n`;
    report += `   • Изменений в графе: ${result.summary.callGraphChanges}\n`;
    report += `   • AST различий: ${result.summary.astDifferencesCount}\n`;
    report += `   • Статус: ${result.isEquivalent ? '✅ ЭКВИВАЛЕНТЕН' : '❌ НЕ ЭКВИВАЛЕНТЕН'}\n`;
    report += `   • Время: ${(result.summary.totalTime / 1000).toFixed(2)} сек\n\n`;

    if (result.missingFunctions.length > 0) {
      report += '❌ ОТСУТСТВУЮЩИЕ ФУНКЦИИ:\n';
      for (const name of result.missingFunctions) {
        report += `   • ${name}\n`;
      }
      report += '\n';
    }

    if (result.addedFunctions.length > 0) {
      report += '➕ ДОБАВЛЕННЫЕ ФУНКЦИИ:\n';
      for (const name of result.addedFunctions) {
        report += `   • ${name}\n`;
      }
      report += '\n';
    }

    if (result.signatureChanges.length > 0) {
      report += '📝 ИЗМЕНЕНИЯ СИГНАТУР:\n';
      for (const change of result.signatureChanges) {
        const icon = change.impact === 'high' ? '🔴' : change.impact === 'medium' ? '🟡' : '🟢';
        report += `   ${icon} ${change.name} (${change.impact} impact):\n`;
        report += `     Оригинал: ${this.signatureToString(change.original)}\n`;
        report += `     Изменено: ${this.signatureToString(change.modified)}\n`;
      }
      report += '\n';
    }

    if (result.failedFunctions.length > 0) {
      report += '❌ ФУНКЦИИ С ОШИБКАМИ:\n';
      for (const failed of result.failedFunctions) {
        report += `   • ${failed.name}: ${failed.reason}\n`;
        if (failed.counterexample) {
          report += `     Контрпример: ${JSON.stringify(Object.fromEntries(failed.counterexample))}\n`;
        }
        if (failed.diff) {
          report += `     Diff:\n${failed.diff}\n`;
        }
      }
      report += '\n';
    }

    if (result.callGraphChanges.length > 0) {
      report += '🔄 ИЗМЕНЕНИЯ В ГРАФЕ ВЫЗОВОВ:\n';
      for (const change of result.callGraphChanges) {
        const icon = change.type === 'added_edge' ? '➕' : '➖';
        report += `   ${icon} ${change.from} → ${change.to}\n`;
      }
      report += '\n';
    }

    if (result.astDifferences.length > 0) {
      report += '📋 AST РАЗЛИЧИЯ:\n';
      for (const diff of result.astDifferences.slice(0, 10)) {
        const icon = diff.impact === 'high' ? '🔴' : diff.impact === 'medium' ? '🟡' : '🟢';
        report += `   ${icon} [${diff.type}] at line ${diff.location.line || '?'}\n`;
        if (diff.original) report += `     Оригинал: ${diff.original}\n`;
        if (diff.modified) report += `     Изменено: ${diff.modified}\n`;
      }
      if (result.astDifferences.length > 10) {
        report += `   ... и ещё ${result.astDifferences.length - 10} различий\n`;
      }
      report += '\n';
    }

    if (result.verificationDetails.length > 0) {
      report += '📋 ДЕТАЛИ ВЕРИФИКАЦИИ:\n';
      report += '   Имя функции | Статус | Метод | Время (мс)\n';
      report += '   ' + '-'.repeat(60) + '\n';
      for (const detail of result.verificationDetails) {
        const status = detail.isEquivalent ? '✅' : '❌';
        report += `   ${detail.functionName.padEnd(20)} | ${status} | ${detail.method.padEnd(8)} | ${detail.time}\n`;
      }
      report += '\n';
    }

    report += '='.repeat(70) + '\n';
    report += `📅 Время проверки: ${new Date().toISOString()}\n`;
    report += `🔧 Версия: 2.0.0 (использует core-компоненты)\n`;

    return report;
  }

  /**
   * Генерирует отчет об ошибке
   */
  private generateErrorReport(error: string): string {
    let report = '';
    report += '='.repeat(70) + '\n';
    report += '❌ ОШИБКА ПРИ ПРОВЕРКЕ ЭКВИВАЛЕНТНОСТИ\n';
    report += '='.repeat(70) + '\n\n';
    report += `Ошибка: ${error}\n\n`;
    report += '='.repeat(70) + '\n';
    report += `📅 Время проверки: ${new Date().toISOString()}\n`;
    return report;
  }

  /**
   * Преобразует сигнатуру в строку
   */
  private signatureToString(sig: FunctionSignature): string {
    const params = sig.params.join(', ');
    const asyncStr = sig.isAsync ? 'async ' : '';
    return `${asyncStr}${sig.name}(${params}) => ${sig.returnType}`;
  }

  /**
   * Экспортирует отчет в JSON
   */
  exportToJSON(result: RefactoringEquivalenceResult): string {
    return JSON.stringify(
      {
        isEquivalent: result.isEquivalent,
        summary: result.summary,
        missingFunctions: result.missingFunctions,
        addedFunctions: result.addedFunctions,
        signatureChanges: result.signatureChanges.map((c: SignatureChange) => ({
          name: c.name,
          impact: c.impact,
          details: c.details,
        })),
        callGraphChanges: result.callGraphChanges,
        astDifferences: result.astDifferences.map((d: ASTDifference) => ({
          type: d.type,
          impact: d.impact,
          location: d.location,
          original: d.original,
          modified: d.modified,
        })),
        failedFunctions: result.failedFunctions.map(
          (f: { name: string; reason: string; counterexample?: Map<string, any> }) => ({
            name: f.name,
            reason: f.reason,
            counterexample: f.counterexample ? Object.fromEntries(f.counterexample) : null,
          })
        ),
        verificationDetails: result.verificationDetails,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Сохраняет отчет в файл
   */
  async saveReport(result: RefactoringEquivalenceResult, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const extension = path.extname(outputPath);
    let content: string;

    if (extension === '.json') {
      content = this.exportToJSON(result);
    } else {
      content = result.report;
    }

    fs.writeFileSync(outputPath, content);
    console.log(`\n📄 Отчет сохранен: ${outputPath}`);
  }

  /**
   * Проверяет эквивалентность конкретной функции
   */
  async checkFunctionEquivalence(
    originalFile: string,
    refactoredFile: string,
    functionName: string
  ): Promise<any> {
    const sourceFile1 = this.project.addSourceFileAtPath(originalFile);
    const sourceFile2 = this.project.addSourceFileAtPath(refactoredFile);

    if (!sourceFile1 || !sourceFile2) {
      throw new Error(`Не удалось загрузить файлы: ${originalFile}, ${refactoredFile}`);
    }

    const func1 = sourceFile1.getFunction(functionName);
    const func2 = sourceFile2.getFunction(functionName);

    if (!func1 || !func2) {
      throw new Error(`Функция ${functionName} не найдена в одном из файлов`);
    }

    const sig1 = this.signatureComparator.extractSignature(func1);
    const sig2 = this.signatureComparator.extractSignature(func2);

    if (!sig1 || !sig2) {
      throw new Error(`Не удалось извлечь сигнатуру функции ${functionName}`);
    }

    const contract = this.createContractFromSignature(sig1);

    if (this.options.formalVerification && this.z3Verifier) {
      return this.z3Verifier.verifyFunction(contract);
    }

    const nodeResult = this.astComparator.compareNodes(func1, func2, {
      ignoreWhitespace: this.options.ignoreWhitespace,
      ignoreComments: this.options.ignoreComments,
    });

    return {
      isValid: nodeResult.isEquivalent,
      confidence: nodeResult.confidence,
      differences: nodeResult.differences,
      method: 'structural',
    };
  }
}

// ============================================
// ЭКСПОРТ УТИЛИТ
// ============================================

export function isRefactoringEquivalent(result: RefactoringEquivalenceResult): boolean {
  return result.isEquivalent && result.failedFunctions.length === 0;
}

export function needsRefactoringReview(result: RefactoringEquivalenceResult): boolean {
  return !result.isEquivalent && result.signatureChanges.length > 0;
}

export function hasCriticalIssues(result: RefactoringEquivalenceResult): boolean {
  return result.failedFunctions.length > 0 || result.missingFunctions.length > 0;
}

// ============================================
// DEFAULT ЭКСПОРТ
// ============================================

export default {
  RefactoringEquivalenceChecker,
  isRefactoringEquivalent,
  needsRefactoringReview,
  hasCriticalIssues,
};
