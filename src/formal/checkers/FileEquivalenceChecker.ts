// src/formal/checkers/FileEquivalenceChecker.ts
import { EquivalenceChecker as BaseEquivalenceChecker } from '../EquivalenceChecker.js';
import { Z3Verifier } from '../Z3Verifier.js';
import { ASTComparator } from '../../core/ASTComparator.js';
import { SignatureComparator } from '../../core/SignatureComparator.js';
import { CallGraphComparator } from '../../core/CallGraphComparator.js';
import fs from 'fs';
import path from 'path';

export interface FileEquivalenceOptions {
  formalVerification?: boolean;
  structuralCheck?: boolean;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  timeout?: number;
  maxDepth?: number;
  checkSignatures?: boolean;
  checkCallGraph?: boolean;
  generateDiff?: boolean;
}

export interface FileEquivalenceResult {
  isEquivalent: boolean;
  confidence: number;
  method: 'ast' | 'signature' | 'callgraph' | 'formal' | 'combined';
  differences: any[];
  signatureChanges?: any[];
  callGraphChanges?: any[];
  formalResult?: any;
  time: number;
  report: string;
}

export class FileEquivalenceChecker {
  private readonly astComparator: ASTComparator;
  private readonly signatureComparator: SignatureComparator;
  private readonly callGraphComparator: CallGraphComparator;
  private z3Verifier: Z3Verifier | null = null;
  private baseChecker: BaseEquivalenceChecker | null = null;
  private initialized = false;
  private readonly options: FileEquivalenceOptions;
  private startTime = 0;

  constructor(options: FileEquivalenceOptions = {}, z3Verifier?: Z3Verifier) {
    this.options = {
      formalVerification: true,
      structuralCheck: true,
      ignoreWhitespace: true,
      ignoreComments: true,
      timeout: 30000,
      maxDepth: 10,
      checkSignatures: true,
      checkCallGraph: true,
      generateDiff: true,
      ...options,
    };

    this.astComparator = new ASTComparator();
    this.signatureComparator = new SignatureComparator();
    this.callGraphComparator = new CallGraphComparator();

    if (z3Verifier) {
      this.z3Verifier = z3Verifier;
      this.initialized = true;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.z3Verifier) {
      this.z3Verifier = new Z3Verifier();
      await this.z3Verifier.initialize();
    }

    this.baseChecker = new BaseEquivalenceChecker(
      {
        formalVerification: this.options.formalVerification,
        structuralCheck: this.options.structuralCheck,
        ignoreWhitespace: this.options.ignoreWhitespace,
        ignoreComments: this.options.ignoreComments,
        timeout: this.options.timeout,
      },
      this.z3Verifier
    );

    this.initialized = true;
  }

  /**
   * Проверяет эквивалентность двух файлов
   */
  async checkFileEquivalence(
    originalPath: string,
    modifiedPath: string,
    options: FileEquivalenceOptions = {}
  ): Promise<FileEquivalenceResult> {
    this.startTime = Date.now();
    const mergedOptions = { ...this.options, ...options };
    const timeout = mergedOptions.timeout || 30000;

    console.log('\n' + '='.repeat(70));
    console.log('🔍 ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ ФАЙЛОВ');
    console.log('='.repeat(70));
    console.log(`📄 Оригинал: ${path.basename(originalPath)}`);
    console.log(`📄 Измененный: ${path.basename(modifiedPath)}`);
    console.log(`📋 Метод: AST + Сигнатуры + Граф вызовов + Формальная верификация`);
    console.log(`⏱️ Таймаут: ${timeout}ms`);
    console.log('='.repeat(70));

    if (Date.now() - this.startTime > timeout) {
      return this.createTimeoutResult();
    }

    await this.initialize();

    // Проверяем существование файлов
    if (!fs.existsSync(originalPath)) {
      return this.createErrorResult(`Оригинальный файл не найден: ${originalPath}`);
    }

    if (!fs.existsSync(modifiedPath)) {
      return this.createErrorResult(`Измененный файл не найден: ${modifiedPath}`);
    }

    // Быстрая проверка: если файлы идентичны
    const originalContent = fs.readFileSync(originalPath, 'utf-8');
    const modifiedContent = fs.readFileSync(modifiedPath, 'utf-8');

    if (originalContent === modifiedContent) {
      console.log('✅ Файлы идентичны');
      return this.createSuccessResult('ast', 1.0, [], 'Файлы полностью идентичны');
    }

    const differences: any[] = [];
    let finalConfidence = 1.0;

    // ============================================
    // ЭТАП 1: AST-сравнение (быстрый, структурный)
    // ============================================
    console.log('\n📐 ШАГ 1: AST-сравнение...');

    if (Date.now() - this.startTime > timeout) {
      return this.createTimeoutResult();
    }

    const astResult = this.astComparator.compareFiles(originalPath, modifiedPath, {
      ignoreWhitespace: mergedOptions.ignoreWhitespace,
      ignoreComments: mergedOptions.ignoreComments,
    });

    console.log(
      `   Результат: ${astResult.isEquivalent ? '✅ ЭКВИВАЛЕНТНЫ' : `❌ ${astResult.differences.length} различий`}`
    );
    console.log(`   Уверенность: ${(astResult.confidence * 100).toFixed(1)}%`);

    differences.push(...astResult.differences);
    finalConfidence = Math.min(finalConfidence, astResult.confidence);

    if (astResult.isEquivalent) {
      console.log('✅ AST-сравнение пройдено, файлы структурно эквивалентны');
      return this.createSuccessResult(
        'ast',
        astResult.confidence,
        differences,
        'AST структурно эквивалентны'
      );
    }

    // ============================================
    // ЭТАП 2: Сравнение сигнатур
    // ============================================
    let signatureChanges: any[] = [];

    if (mergedOptions.checkSignatures !== false) {
      console.log('\n📝 ШАГ 2: Сравнение сигнатур...');

      if (Date.now() - this.startTime > timeout) {
        return this.createTimeoutResult();
      }

      const project = (this.baseChecker as any)?.project || (await import('ts-morph')).Project;
      const proj = new project({
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

      const sourceFile1 = proj.addSourceFileAtPath(originalPath);
      const sourceFile2 = proj.addSourceFileAtPath(modifiedPath);

      const sigs1 = this.signatureComparator.extractAllSignatures(sourceFile1);
      const sigs2 = this.signatureComparator.extractAllSignatures(sourceFile2);

      const sigComparison = this.signatureComparator.compareAllSignatures(sigs1, sigs2);
      signatureChanges = sigComparison.changes;

      const hasCriticalChanges = sigComparison.changes.some(c => c.impact === 'high');
      const hasChanges = sigComparison.changes.length > 0;

      console.log(`   Изменений сигнатур: ${sigComparison.changes.length}`);
      console.log(`   Отсутствует функций: ${sigComparison.missing.length}`);
      console.log(`   Добавлено функций: ${sigComparison.added.length}`);

      if (hasCriticalChanges) {
        console.log('   ⚠️ Обнаружены критические изменения сигнатур');
        finalConfidence = Math.min(finalConfidence, 0.5);
      } else if (hasChanges) {
        console.log('   ℹ️ Обнаружены не критические изменения сигнатур');
        finalConfidence = Math.min(finalConfidence, 0.8);
      }

      // Сохраняем сигнатуры для отчета
      if (sigComparison.missing.length > 0) {
        differences.push({
          type: 'missing_functions',
          items: sigComparison.missing,
          impact: 'high',
          message: `Отсутствуют функции: ${sigComparison.missing.join(', ')}`,
        });
      }

      if (sigComparison.added.length > 0) {
        differences.push({
          type: 'added_functions',
          items: sigComparison.added,
          impact: 'medium',
          message: `Добавлены функции: ${sigComparison.added.join(', ')}`,
        });
      }

      // Если есть критические изменения, возвращаем результат
      if (hasCriticalChanges) {
        return this.createDetailedResult(
          false,
          'signature',
          finalConfidence,
          differences,
          signatureChanges,
          undefined,
          'Критические изменения сигнатур'
        );
      }
    }

    // ============================================
    // ЭТАП 3: Сравнение графа вызовов
    // ============================================
    let callGraphChanges: any[] = [];

    if (mergedOptions.checkCallGraph !== false) {
      console.log('\n🕸️ ШАГ 3: Сравнение графа вызовов...');

      if (Date.now() - this.startTime > timeout) {
        return this.createTimeoutResult();
      }

      const project = (this.baseChecker as any)?.project || (await import('ts-morph')).Project;
      const proj = new project({
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

      const sourceFile1 = proj.addSourceFileAtPath(originalPath);
      const sourceFile2 = proj.addSourceFileAtPath(modifiedPath);

      const graph1 = this.callGraphComparator.buildCallGraph(sourceFile1);
      const graph2 = this.callGraphComparator.buildCallGraph(sourceFile2);

      const graphComparison = this.callGraphComparator.compareGraphs(graph1, graph2);
      callGraphChanges = graphComparison.changes;

      console.log(`   Изменений в графе: ${graphComparison.changes.length}`);
      console.log(`   Узлов: ${graph1.nodes.size} → ${graph2.nodes.size}`);
      console.log(`   Ребер: ${graph1.edges.length} → ${graph2.edges.length}`);

      if (!graphComparison.isEquivalent) {
        finalConfidence = Math.min(finalConfidence, 0.7);
        console.log('   ⚠️ Обнаружены изменения в графе вызовов');

        differences.push({
          type: 'callgraph_changes',
          items: graphComparison.changes,
          impact: 'medium',
          message: `Изменения в графе вызовов: ${graphComparison.changes.length} изменений`,
        });
      }
    }

    // ============================================
    // ЭТАП 4: Формальная верификация через Z3
    // ============================================
    let formalResult = null;

    if (mergedOptions.formalVerification !== false) {
      console.log('\n🔬 ШАГ 4: Формальная верификация через Z3...');

      if (Date.now() - this.startTime > timeout) {
        console.log('   ⚠️ Таймаут, пропускаем Z3 верификацию');
      } else if (this.baseChecker) {
        try {
          const result = await this.baseChecker.checkFileEquivalence(originalPath, modifiedPath, {
            formalVerification: true,
            structuralCheck: false,
            ignoreWhitespace: mergedOptions.ignoreWhitespace,
            ignoreComments: mergedOptions.ignoreComments,
          });

          formalResult = result;

          if (result.isEquivalent) {
            console.log('   ✅ Формальная верификация ПРОЙДЕНА');
            finalConfidence = Math.min(finalConfidence, 0.95);
          } else {
            console.log('   ❌ Формальная верификация НЕ ПРОЙДЕНА');
            finalConfidence = Math.min(finalConfidence, 0.3);

            if (result.counterexample) {
              console.log(
                `   Контрпример: ${JSON.stringify(Object.fromEntries(result.counterexample))}`
              );
            }

            differences.push({
              type: 'formal_verification_failed',
              impact: 'high',
              message: 'Формальная верификация не пройдена',
              counterexample: result.counterexample,
            });
          }
        } catch (error) {
          console.error('   ❌ Ошибка формальной верификации:', error);
          finalConfidence = Math.min(finalConfidence, 0.5);
        }
      }
    }

    // ============================================
    // ИТОГОВЫЙ РЕЗУЛЬТАТ
    // ============================================
    const isEquivalent =
      differences.filter(d => d.impact === 'high').length === 0 &&
      differences.filter(d => d.type === 'formal_verification_failed').length === 0;

    const report = this.generateReport({
      isEquivalent,
      confidence: finalConfidence,
      method: 'combined',
      differences,
      signatureChanges,
      callGraphChanges,
      formalResult,
      time: Date.now() - this.startTime,
      report: '',
    });

    const result: FileEquivalenceResult = {
      isEquivalent,
      confidence: finalConfidence,
      method: 'combined',
      differences,
      signatureChanges: signatureChanges.length > 0 ? signatureChanges : undefined,
      callGraphChanges: callGraphChanges.length > 0 ? callGraphChanges : undefined,
      formalResult: formalResult || undefined,
      time: Date.now() - this.startTime,
      report,
    };

    console.log('\n' + '='.repeat(70));
    console.log(`📊 ИТОГ: ${isEquivalent ? '✅ ЭКВИВАЛЕНТНЫ' : '❌ НЕ ЭКВИВАЛЕНТНЫ'}`);
    console.log(`   Уверенность: ${(finalConfidence * 100).toFixed(1)}%`);
    console.log(`   Время: ${(result.time / 1000).toFixed(2)}с`);
    console.log('='.repeat(70) + '\n');

    return result;
  }

  /**
   * Проверяет эквивалентность двух функций
   */
  async checkFunctionEquivalence(
    original: string,
    modified: string,
    contract: any
  ): Promise<FileEquivalenceResult> {
    this.startTime = Date.now();

    console.log('\n' + '='.repeat(70));
    console.log('🔍 ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ ФУНКЦИЙ');
    console.log('='.repeat(70));

    await this.initialize();

    if (!this.baseChecker) {
      return this.createErrorResult('Base checker not initialized');
    }

    const result = await this.baseChecker.checkFunctionEquivalence(
      original,
      modified,
      contract,
      this.options
    );

    const report = this.generateReport({
      isEquivalent: result.isEquivalent,
      confidence: result.confidence || 0.5,
      method: 'formal',
      differences: result.differences || [],
      time: result.time,
      report: '',
    });

    return {
      isEquivalent: result.isEquivalent,
      confidence: result.confidence || 0.5,
      method: 'formal',
      differences: result.differences || [],
      formalResult: result,
      time: result.time,
      report,
    };
  }

  /**
   * Создает результат успешной проверки
   */
  private createSuccessResult(
    method: 'ast' | 'signature' | 'callgraph' | 'formal' | 'combined',
    confidence: number,
    differences: any[],
    message: string
  ): FileEquivalenceResult {
    const result: FileEquivalenceResult = {
      isEquivalent: true,
      confidence,
      method,
      differences,
      time: Date.now() - this.startTime,
      report: `✅ ${message}`,
    };
    result.report = this.generateReport(result);
    return result;
  }

  /**
   * Создает детализированный результат
   */
  private createDetailedResult(
    isEquivalent: boolean,
    method: 'ast' | 'signature' | 'callgraph' | 'formal' | 'combined',
    confidence: number,
    differences: any[],
    signatureChanges?: any[],
    callGraphChanges?: any[],
    message?: string
  ): FileEquivalenceResult {
    const result: FileEquivalenceResult = {
      isEquivalent,
      confidence,
      method,
      differences,
      signatureChanges,
      callGraphChanges,
      time: Date.now() - this.startTime,
      report: message || (isEquivalent ? '✅ Файлы эквивалентны' : '❌ Файлы не эквивалентны'),
    };
    result.report = this.generateReport(result);
    return result;
  }

  /**
   * Создает результат при ошибке
   */
  private createErrorResult(error: string): FileEquivalenceResult {
    const result: FileEquivalenceResult = {
      isEquivalent: false,
      confidence: 0,
      method: 'ast',
      differences: [
        {
          type: 'error',
          impact: 'high',
          message: error,
        },
      ],
      time: Date.now() - this.startTime,
      report: `❌ Ошибка: ${error}`,
    };
    result.report = this.generateReport(result);
    return result;
  }

  /**
   * Создает результат при таймауте
   */
  private createTimeoutResult(): FileEquivalenceResult {
    const result: FileEquivalenceResult = {
      isEquivalent: false,
      confidence: 0.3,
      method: 'ast',
      differences: [
        {
          type: 'timeout',
          impact: 'high',
          message: 'Превышен таймаут проверки',
        },
      ],
      time: Date.now() - this.startTime,
      report: '⚠️ Превышен таймаут проверки',
    };
    result.report = this.generateReport(result);
    return result;
  }

  /**
   * Генерирует отчет о проверке
   */
  private generateReport(result: {
    isEquivalent: boolean;
    confidence: number;
    method: string;
    differences: any[];
    signatureChanges?: any[];
    callGraphChanges?: any[];
    formalResult?: any;
    time: number;
    report?: string;
  }): string {
    let report = '';
    report += '='.repeat(70) + '\n';
    report += '🔍 ОТЧЕТ О ПРОВЕРКЕ ЭКВИВАЛЕНТНОСТИ\n';
    report += '='.repeat(70) + '\n\n';

    report += `📊 СТАТУС: ${result.isEquivalent ? '✅ ЭКВИВАЛЕНТНЫ' : '❌ НЕ ЭКВИВАЛЕНТНЫ'}\n`;
    report += `📊 УВЕРЕННОСТЬ: ${(result.confidence * 100).toFixed(1)}%\n`;
    report += `📊 МЕТОД: ${result.method}\n`;
    report += `⏱️ ВРЕМЯ: ${(result.time / 1000).toFixed(2)}с\n\n`;

    if (result.differences.length > 0) {
      report += '📋 РАЗЛИЧИЯ:\n';
      for (const diff of result.differences) {
        const icon = diff.impact === 'high' ? '🔴' : diff.impact === 'medium' ? '🟡' : '🟢';
        report += `   ${icon} ${diff.type}: ${diff.message}\n`;
        if (diff.items && diff.items.length > 0) {
          for (const item of diff.items.slice(0, 5)) {
            report += `      - ${item}\n`;
          }
          if (diff.items.length > 5) {
            report += `      ... и еще ${diff.items.length - 5}\n`;
          }
        }
      }
      report += '\n';
    }

    if (result.signatureChanges && result.signatureChanges.length > 0) {
      report += '📝 ИЗМЕНЕНИЯ СИГНАТУР:\n';
      for (const change of result.signatureChanges.slice(0, 5)) {
        const icon = change.impact === 'high' ? '🔴' : change.impact === 'medium' ? '🟡' : '🟢';
        report += `   ${icon} ${change.name}\n`;
        for (const detail of change.details?.paramChanges || []) {
          report += `      ${detail}\n`;
        }
      }
      if (result.signatureChanges.length > 5) {
        report += `   ... и еще ${result.signatureChanges.length - 5} изменений\n`;
      }
      report += '\n';
    }

    if (result.callGraphChanges && result.callGraphChanges.length > 0) {
      report += '🔄 ИЗМЕНЕНИЯ В ГРАФЕ ВЫЗОВОВ:\n';
      for (const change of result.callGraphChanges.slice(0, 5)) {
        const icon = change.type === 'added_edge' ? '➕' : '➖';
        report += `   ${icon} ${change.from} → ${change.to}\n`;
      }
      if (result.callGraphChanges.length > 5) {
        report += `   ... и еще ${result.callGraphChanges.length - 5} изменений\n`;
      }
      report += '\n';
    }

    if (result.formalResult) {
      report += '🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:\n';
      report += `   Статус: ${result.formalResult.isValid ? '✅ ПРОЙДЕНА' : '❌ НЕ ПРОЙДЕНА'}\n`;
      if (result.formalResult.counterexample) {
        report += `   Контрпример: ${JSON.stringify(Object.fromEntries(result.formalResult.counterexample))}\n`;
      }
      report += '\n';
    }

    report += '='.repeat(70) + '\n';
    report += `📅 Сгенерировано: ${new Date().toISOString()}\n`;
    report += '='.repeat(70) + '\n';

    return report;
  }

  /**
   * Сохраняет отчет в файл
   */
  async saveReport(result: FileEquivalenceResult, outputPath: string): Promise<void> {
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
          differences: result.differences,
          signatureChanges: result.signatureChanges,
          callGraphChanges: result.callGraphChanges,
          formalResult: result.formalResult,
          time: result.time,
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
      content = result.report;
    }

    fs.writeFileSync(outputPath, content);
    console.log(`📄 Отчет сохранен: ${outputPath}`);
  }

  /**
   * Проверяет, эквивалентны ли файлы
   */
  isEquivalent(result: FileEquivalenceResult): boolean {
    if (!result) return false;
    return result.isEquivalent === true && (result.confidence || 0) > 0.7;
  }

  /**
   * Проверяет, нужен ли ручной обзор
   */
  needsReview(result: FileEquivalenceResult): boolean {
    if (!result) return true;
    if (!result.isEquivalent) return true;
    if (result.confidence < 0.8) return true;
    if (result.differences && result.differences.length > 0) return true;
    if (result.signatureChanges && result.signatureChanges.length > 0) return true;
    if (result.callGraphChanges && result.callGraphChanges.length > 0) return true;
    return false;
  }

  /**
   * Возвращает уровень уверенности
   */
  confidenceLevel(result: FileEquivalenceResult): 'high' | 'medium' | 'low' {
    if (result.confidence >= 0.9) return 'high';
    if (result.confidence >= 0.6) return 'medium';
    return 'low';
  }

  async dispose(): Promise<void> {
    if (this.z3Verifier) {
      await this.z3Verifier.dispose();
    }
    this.initialized = false;
  }

  /**
   * Получить экземпляр AST компаратора
   */
  getASTComparator(): ASTComparator {
    return this.astComparator;
  }

  /**
   * Получить экземпляр компаратора сигнатур
   */
  getSignatureComparator(): SignatureComparator {
    return this.signatureComparator;
  }

  /**
   * Получить экземпляр компаратора графов
   */
  getCallGraphComparator(): CallGraphComparator {
    return this.callGraphComparator;
  }
}

// Экспорт утилит
export function isEquivalencePassed(result: FileEquivalenceResult): boolean {
  if (!result) return false;
  return result.isEquivalent && result.confidence >= 0.7;
}

export function hasCriticalIssues(result: FileEquivalenceResult): boolean {
  if (!result) return true;
  return result.differences.some(d => d.impact === 'high');
}

export function getSummary(result: FileEquivalenceResult): string {
  if (!result) return '❌ No result';
  const status = result.isEquivalent ? '✅ PASSED' : '❌ FAILED';
  const confidence = (result.confidence * 100).toFixed(1);
  return `${status} (${confidence}% confidence, ${result.differences.length} differences)`;
}

