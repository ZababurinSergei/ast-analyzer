// packages/ast-analyzer/src/formal/RefactoringEquivalenceChecker.ts

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';
import { Z3Verifier, type FunctionContract, range, eq, or, neq } from './Z3Verifier.js';
import { EquivalenceChecker, type EquivalenceResult } from './EquivalenceChecker.js';

export interface FunctionSignature {
  name: string;
  params: string[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  isMethod?: boolean;
  className?: string;
}

export interface FunctionBehavior {
  signature: FunctionSignature;
  body: string;
  contract: FunctionContract;
  sourceFile: string;
  lineStart: number;
  lineEnd: number;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  type: 'direct' | 'method' | 'property' | 'import';
  line?: number;
}

export interface CallGraph {
  nodes: Map<string, FunctionBehavior>;
  edges: CallGraphEdge[];
  entryPoints: string[];
  exports: string[];
}

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
  signatureChanges: {
    name: string;
    original: FunctionSignature;
    modified: FunctionSignature;
    impact: 'high' | 'medium' | 'low';
  }[];
  callGraphChanges: {
    type: 'added_edge' | 'removed_edge' | 'changed';
    from: string;
    to: string;
    original?: string;
    modified?: string;
  }[];
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
    totalTime: number;
  };
}

export interface EquivalenceCheckOptions {
  formalVerification?: boolean;
  structuralCheck?: boolean;
  semanticCheck?: boolean;
  checkCallGraph?: boolean;
  checkSignatures?: boolean;
  maxDepth?: number;
  timeout?: number;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  generateDiff?: boolean;
}

export class RefactoringEquivalenceChecker {
  private verifier: Z3Verifier;
  private equivalenceChecker: EquivalenceChecker;
  private project: Project;
  private options: EquivalenceCheckOptions;
  private callGraphs: Map<string, CallGraph> = new Map();
  private startTime = 0;

  constructor(options: EquivalenceCheckOptions = {}) {
    this.options = {
      formalVerification: true,
      structuralCheck: true,
      semanticCheck: true,
      checkCallGraph: true,
      checkSignatures: true,
      maxDepth: 10,
      timeout: 30000,
      ignoreWhitespace: true,
      ignoreComments: true,
      generateDiff: true,
      ...options,
    };

    this.verifier = new Z3Verifier();
    this.equivalenceChecker = new EquivalenceChecker();
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
  }

  async initialize(): Promise<void> {
    await this.verifier.initialize();
    await this.equivalenceChecker.initialize();
  }

  async dispose(): Promise<void> {
    await this.verifier.dispose();
  }

  /**
   * Сравнивает исходный файл с разбитым на модули
   */
  async checkRefactoringEquivalence(
    originalFilePath: string,
    refactoredFilePath: string,
    modulesDir?: string
  ): Promise<RefactoringEquivalenceResult> {
    this.startTime = Date.now();

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
        totalTime: 0,
      },
    };

    try {
      // 1. Извлекаем функции из исходного файла
      console.log('\n📊 ШАГ 1: Извлечение функций из исходного файла...');
      const originalFunctions = await this.extractFunctions(originalFilePath);
      console.log(`   ✅ Найдено: ${originalFunctions.size} функций`);

      // 2. Извлекаем функции из рефакторинга (основной файл + модули)
      console.log('\n📊 ШАГ 2: Извлечение функций из рефакторинга...');
      const refactoredFunctions = await this.extractAllFunctions(refactoredFilePath, modulesDir);
      console.log(`   ✅ Найдено: ${refactoredFunctions.size} функций`);

      // 3. Строим графы вызовов
      if (this.options.checkCallGraph) {
        console.log('\n📊 ШАГ 3: Построение графов вызовов...');
        const originalGraph = await this.buildCallGraphFromFunctions(originalFunctions);
        const refactoredGraph = await this.buildCallGraphFromFunctions(refactoredFunctions);
        this.callGraphs.set('original', originalGraph);
        this.callGraphs.set('refactored', refactoredGraph);
        console.log(
          `   ✅ Исходный граф: ${originalGraph.nodes.size} узлов, ${originalGraph.edges.length} ребер`
        );
        console.log(
          `   ✅ Рефакторинг граф: ${refactoredGraph.nodes.size} узлов, ${refactoredGraph.edges.length} ребер`
        );
      }

      // 4. Сравниваем сигнатуры
      if (this.options.checkSignatures) {
        console.log('\n📊 ШАГ 4: Сравнение сигнатур функций...');
        this.compareSignatures(originalFunctions, refactoredFunctions, result);
        console.log(`   ✅ Сигнатуры проверены. Изменений: ${result.signatureChanges.length}`);
      }

      // 5. Проверяем эквивалентность поведения
      console.log('\n📊 ШАГ 5: Проверка эквивалентности поведения...');
      await this.verifyFunctionEquivalence(originalFunctions, refactoredFunctions, result);
      console.log(
        `   ✅ Верифицировано: ${result.verifiedFunctions}/${result.totalFunctions} функций`
      );

      // 6. Проверяем эквивалентность графа вызовов
      if (this.options.checkCallGraph) {
        console.log('\n📊 ШАГ 6: Проверка эквивалентности графа вызовов...');
        this.compareCallGraphs(result);
        console.log(`   ✅ Изменений в графе: ${result.callGraphChanges.length}`);
      }

      // 7. Проверяем контракты функций
      console.log('\n📊 ШАГ 7: Проверка контрактов функций...');
      await this.verifyFunctionContracts(originalFunctions, refactoredFunctions, result);

      // 8. ИТОГОВАЯ ОЦЕНКА ЭКВИВАЛЕНТНОСТИ
      // Файлы считаются эквивалентными, если:
      // - Нет отсутствующих функций
      // - Нет ошибок верификации (failedFunctions)
      // - Нет критических изменений сигнатур
      const hasMissingFunctions = result.missingFunctions.length > 0;
      const hasFailedVerifications = result.failedFunctions.length > 0;
      const hasCriticalSignatureChanges = result.signatureChanges.some(
        change => change.impact === 'high'
      );

      result.isEquivalent =
        !hasMissingFunctions && !hasFailedVerifications && !hasCriticalSignatureChanges;

      // Если есть добавленные функции, это не считается ошибкой, но может быть предупреждением
      if (result.addedFunctions.length > 0) {
        console.log(
          `   ℹ️ Добавлено ${result.addedFunctions.length} новых функций (это допустимо)`
        );
      }

      // 9. Генерируем отчет
      console.log('\n📊 ШАГ 8: Генерация отчета...');
      result.summary.totalTime = Date.now() - this.startTime;
      result.report = this.generateReport(result);

      console.log('\n' + '='.repeat(70));
      if (result.isEquivalent) {
        console.log('✅ РЕФАКТОРИНГ ЭКВИВАЛЕНТЕН!');
        console.log(
          `   ✅ Верифицировано: ${result.verifiedFunctions}/${result.totalFunctions} функций`
        );
        console.log(`   ⏱️  Время: ${(result.summary.totalTime / 1000).toFixed(2)} сек`);
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
        console.log(`   ⏱️  Время: ${(result.summary.totalTime / 1000).toFixed(2)} сек`);
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
   * Извлекает все функции из файла
   */
  private async extractFunctions(filePath: string): Promise<Map<string, FunctionBehavior>> {
    const functions = new Map<string, FunctionBehavior>();

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Файл не найден: ${filePath}`);
      return functions;
    }

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      if (!sourceFile) {
        console.warn(`⚠️ Не удалось загрузить файл: ${filePath}`);
        return functions;
      }

      const filePathResolved = sourceFile.getFilePath();

      // Собираем функции
      for (const func of sourceFile.getFunctions()) {
        const name = func.getName();
        if (!name) continue;

        const signature = this.extractSignature(func);
        const body = func.getBody()?.getText() || '';
        const contract = await this.inferContract(func);

        functions.set(name, {
          signature,
          body,
          contract,
          sourceFile: filePathResolved,
          lineStart: func.getStartLineNumber(),
          lineEnd: func.getEndLineNumber(),
        });
      }

      // Собираем методы классов
      for (const cls of sourceFile.getClasses()) {
        const className = cls.getName();
        if (!className) continue;

        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          if (!methodName) continue;

          const fullName = `${className}.${methodName}`;
          const signature = this.extractSignature(method);
          signature.isMethod = true;
          signature.className = className;

          const body = method.getBody()?.getText() || '';
          const contract = await this.inferContract(method);

          functions.set(fullName, {
            signature,
            body,
            contract,
            sourceFile: filePathResolved,
            lineStart: method.getStartLineNumber(),
            lineEnd: method.getEndLineNumber(),
          });
        }
      }

      // Собираем стрелочные функции в переменных
      for (const varDecl of sourceFile.getVariableDeclarations()) {
        const initializer = varDecl.getInitializer();
        if (initializer && Node.isArrowFunction(initializer)) {
          const name = varDecl.getName();
          const signature: FunctionSignature = {
            name,
            params: initializer.getParameters().map((p: any) => p.getName()),
            returnType: initializer.getReturnType().getText(),
            isAsync: initializer.isAsync(),
            isExported: varDecl.isExported(),
          };

          const body = initializer.getBody()?.getText() || '';
          const contract = await this.inferContract(initializer);

          functions.set(name, {
            signature,
            body,
            contract,
            sourceFile: filePathResolved,
            lineStart: varDecl.getStartLineNumber(),
            lineEnd: varDecl.getEndLineNumber(),
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ Ошибка при извлечении функций из ${filePath}:`, error);
    }

    return functions;
  }

  /**
   * Извлекает все функции из рефакторинга (основной файл + модули)
   */
  private async extractAllFunctions(
    mainFilePath: string,
    modulesDir?: string
  ): Promise<Map<string, FunctionBehavior>> {
    const allFunctions = new Map<string, FunctionBehavior>();

    // Основной файл
    const mainFunctions = await this.extractFunctions(mainFilePath);
    for (const [name, func] of mainFunctions) {
      allFunctions.set(name, func);
    }

    // Модули
    if (modulesDir && fs.existsSync(modulesDir)) {
      const moduleFiles = fs
        .readdirSync(modulesDir)
        .filter(
          f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.mjs') || f.endsWith('.cjs')
        );

      console.log(`   📁 Найдено модулей: ${moduleFiles.length}`);

      for (const moduleFile of moduleFiles) {
        const modulePath = path.join(modulesDir, moduleFile);
        const moduleFunctions = await this.extractFunctions(modulePath);

        for (const [name, func] of moduleFunctions) {
          // Если функция уже есть, проверяем конфликт
          if (allFunctions.has(name)) {
            console.warn(`⚠️ Конфликт: функция '${name}' найдена в нескольких файлах`);
            // Добавляем с префиксом модуля
            const moduleName = moduleFile.replace(/\.[^.]+$/, '');
            const prefixedName = `${moduleName}.${name}`;
            allFunctions.set(prefixedName, {
              ...func,
              signature: { ...func.signature, name: prefixedName },
            });
          } else {
            allFunctions.set(name, func);
          }
        }
      }
    }

    return allFunctions;
  }

  /**
   * Извлекает сигнатуру функции
   */
  private extractSignature(node: any): FunctionSignature {
    try {
      const name = node.getName() || 'anonymous';
      const params = node.getParameters().map((p: any) => p.getName());
      const returnType = node.getReturnType()?.getText() || 'any';

      return {
        name,
        params,
        returnType,
        isAsync: node.isAsync(),
        isExported: node.isExported(),
      };
    } catch (error) {
      return {
        name: 'unknown',
        params: [],
        returnType: 'any',
        isAsync: false,
        isExported: false,
      };
    }
  }

  /**
   * Выводит контракт из функции
   */
  private async inferContract(node: any): Promise<FunctionContract> {
    try {
      const params = node.getParameters().map((p: any) => {
        const type = this.inferParamType(p);
        return { name: p.getName(), type };
      });

      const returnType = this.inferReturnType(node);

      // Извлекаем JSDoc для предусловий и постусловий
      const preconditions: any[] = [];
      const postconditions: any[] = [];
      const invariants: any[] = [];

      const jsDocs = node.getJsDocs();
      for (const jsDoc of jsDocs) {
        const tags = jsDoc.getTags();
        for (const tag of tags) {
          const tagName = tag.getTagName();
          const comment = tag.getCommentText();

          if (tagName === 'param' && comment) {
            const paramMatch = comment.match(/(\w+)\s*-\s*([^<]+)/);
            if (paramMatch) {
              const paramName = paramMatch[1];
              const description = paramMatch[2];

              if (description.includes('positive') || description.includes('>0')) {
                preconditions.push(range(paramName, 1, Number.MAX_SAFE_INTEGER));
              }
              if (description.includes('non-negative') || description.includes('>=0')) {
                preconditions.push(range(paramName, 0, Number.MAX_SAFE_INTEGER));
              }
              if (description.includes('not null') || description.includes('non-null')) {
                preconditions.push(neq(paramName, null));
              }
            }
          }

          if (tagName === 'returns' && comment) {
            if (comment.includes('positive')) {
              postconditions.push(range('result', 1, Number.MAX_SAFE_INTEGER));
            }
            if (comment.includes('non-negative')) {
              postconditions.push(range('result', 0, Number.MAX_SAFE_INTEGER));
            }
            if (comment.includes('not null')) {
              postconditions.push(neq('result', null));
            }
          }

          if (tagName === 'invariant' && comment) {
            invariants.push({ type: 'invariant', description: comment });
          }
        }
      }

      // Добавляем стандартные постусловия
      if (returnType !== 'void') {
        if (returnType === 'int') {
          postconditions.push(range('result', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
        }
        if (returnType === 'bool') {
          postconditions.push(or(eq('result', true), eq('result', false)));
        }
      }

      return {
        name: node.getName() || 'anonymous',
        params,
        returnType,
        preconditions,
        postconditions,
        invariants,
      };
    } catch (error) {
      return {
        name: 'unknown',
        params: [],
        returnType: 'void',
        preconditions: [],
        postconditions: [],
        invariants: [],
      };
    }
  }

  private inferParamType(param: any): 'int' | 'bool' | 'string' {
    try {
      const type = param.getType();
      if (type.isNumber()) return 'int';
      if (type.isBoolean()) return 'bool';
      if (type.isString()) return 'string';
      return 'int';
    } catch {
      return 'int';
    }
  }

  private inferReturnType(node: any): 'int' | 'bool' | 'string' | 'void' {
    try {
      const type = node.getReturnType();
      if (type.isNumber()) return 'int';
      if (type.isBoolean()) return 'bool';
      if (type.isString()) return 'string';
      return 'void';
    } catch {
      return 'void';
    }
  }

  /**
   * Сравнивает сигнатуры функций
   */
  private compareSignatures(
    original: Map<string, FunctionBehavior>,
    refactored: Map<string, FunctionBehavior>,
    result: RefactoringEquivalenceResult
  ): void {
    const originalNames = new Set(original.keys());
    const refactoredNames = new Set(refactored.keys());

    // Ищем отсутствующие функции
    for (const name of originalNames) {
      if (!refactoredNames.has(name)) {
        result.missingFunctions.push(name);
        result.summary.functionsRemoved++;
        result.isEquivalent = false;
      }
    }

    // Ищем добавленные функции
    for (const name of refactoredNames) {
      if (!originalNames.has(name)) {
        result.addedFunctions.push(name);
        result.summary.functionsAdded++;
        // Добавление функций не считается ошибкой
      }
    }

    // Сравниваем сигнатуры существующих функций
    for (const name of originalNames) {
      if (!refactoredNames.has(name)) continue;

      const orig = original.get(name)!;
      const ref = refactored.get(name)!;

      const sigDiff = this.compareSignaturesDetailed(orig.signature, ref.signature);
      if (sigDiff.hasChanges) {
        result.signatureChanges.push({
          name,
          original: orig.signature,
          modified: ref.signature,
          impact: this.assessSignatureImpact(sigDiff),
        });
        result.summary.signatureChanges++;
        // Изменение сигнатуры НЕ делает файл неэквивалентным (если это не high impact)
        // Но high impact изменения должны быть отмечены
        if (sigDiff.returnTypeChanged || sigDiff.asyncChanged) {
          result.isEquivalent = false;
        }
      }
    }
  }

  private compareSignaturesDetailed(
    a: FunctionSignature,
    b: FunctionSignature
  ): {
    hasChanges: boolean;
    paramChanges: string[];
    returnTypeChanged: boolean;
    asyncChanged: boolean;
  } {
    const paramChanges: string[] = [];

    if (a.params.length !== b.params.length) {
      paramChanges.push(`Параметры: ${a.params.length} → ${b.params.length}`);
    } else {
      for (let i = 0; i < a.params.length; i++) {
        if (a.params[i] !== b.params[i]) {
          paramChanges.push(`Параметр ${i + 1}: ${a.params[i]} → ${b.params[i]}`);
        }
      }
    }

    const returnTypeChanged = a.returnType !== b.returnType;
    const asyncChanged = a.isAsync !== b.isAsync;

    return {
      hasChanges: paramChanges.length > 0 || returnTypeChanged || asyncChanged,
      paramChanges,
      returnTypeChanged,
      asyncChanged,
    };
  }

  private assessSignatureImpact(diff: {
    paramChanges: string[];
    returnTypeChanged: boolean;
    asyncChanged: boolean;
  }): 'high' | 'medium' | 'low' {
    if (diff.returnTypeChanged || diff.asyncChanged) return 'high';
    if (diff.paramChanges.length > 0) return 'medium';
    return 'low';
  }

  /**
   * Проверяет эквивалентность поведения функций
   */
  private async verifyFunctionEquivalence(
    original: Map<string, FunctionBehavior>,
    refactored: Map<string, FunctionBehavior>,
    result: RefactoringEquivalenceResult
  ): Promise<void> {
    result.totalFunctions = original.size;

    for (const [name, origFunc] of original) {
      const refFunc = refactored.get(name);

      if (!refFunc) {
        // Функция отсутствует - уже отмечено
        continue;
      }

      console.log(`\n🔍 Проверка: ${name}`);

      try {
        let equivalenceResult: EquivalenceResult;

        if (this.options.formalVerification) {
          // Формальная верификация через Z3
          equivalenceResult = await this.equivalenceChecker.checkFunctionEquivalence(
            origFunc.body,
            refFunc.body,
            origFunc.contract
          );
        } else if (this.options.structuralCheck) {
          // Структурная проверка
          equivalenceResult = await this.equivalenceChecker.checkFileEquivalence(
            origFunc.sourceFile,
            refFunc.sourceFile,
            {
              ignoreWhitespace: this.options.ignoreWhitespace,
              ignoreComments: this.options.ignoreComments,
            }
          );
        } else {
          // Семантическая проверка
          equivalenceResult = await this.equivalenceChecker.checkFunctionEquivalence(
            origFunc.body,
            refFunc.body,
            origFunc.contract
          );
        }

        result.verificationDetails.push({
          functionName: name,
          isEquivalent: equivalenceResult.isEquivalent,
          time: equivalenceResult.time,
          method: this.options.formalVerification
            ? 'formal'
            : this.options.structuralCheck
              ? 'structural'
              : 'semantic',
        });

        if (equivalenceResult.isEquivalent) {
          result.verifiedFunctions++;
          console.log(`  ✅ Эквивалентна (${equivalenceResult.time}ms)`);
        } else {
          const diff = this.options.generateDiff
            ? this.generateDiff(origFunc.body, refFunc.body)
            : undefined;

          result.failedFunctions.push({
            name,
            reason: 'Поведение отличается',
            counterexample: equivalenceResult.counterexample,
            originalBehavior: origFunc.body.substring(0, 200),
            refactoredBehavior: refFunc.body.substring(0, 200),
            diff,
          });
          result.summary.functionsFailed++;
          console.log(`  ❌ НЕ ЭКВИВАЛЕНТНА`);
          if (equivalenceResult.counterexample) {
            console.log(
              `     Контрпример: ${JSON.stringify(Object.fromEntries(equivalenceResult.counterexample))}`
            );
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.failedFunctions.push({
          name,
          reason: `Ошибка верификации: ${errorMsg}`,
        });
        result.summary.functionsFailed++;
        console.log(`  ❌ Ошибка: ${errorMsg}`);
      }
    }

    result.summary.functionsChecked = result.totalFunctions;
    result.summary.functionsVerified = result.verifiedFunctions;

    // Если есть failedFunctions, файл не эквивалентен
    if (result.failedFunctions.length > 0) {
      result.isEquivalent = false;
    }
  }

  /**
   * Проверяет контракты функций
   */
  private async verifyFunctionContracts(
    original: Map<string, FunctionBehavior>,
    refactored: Map<string, FunctionBehavior>,
    result: RefactoringEquivalenceResult
  ): Promise<void> {
    for (const [name, origFunc] of original) {
      const refFunc = refactored.get(name);
      if (!refFunc) continue;

      // Проверяем предусловия
      const origPreconditions = origFunc.contract.preconditions;
      const refPreconditions = refFunc.contract.preconditions;

      if (origPreconditions.length !== refPreconditions.length) {
        result.failedFunctions.push({
          name,
          reason: `Количество предусловий изменилось: ${origPreconditions.length} → ${refPreconditions.length}`,
        });
        result.isEquivalent = false;
      }

      // Проверяем постусловия
      const origPostconditions = origFunc.contract.postconditions;
      const refPostconditions = refFunc.contract.postconditions;

      if (origPostconditions.length !== refPostconditions.length) {
        result.failedFunctions.push({
          name,
          reason: `Количество постусловий изменилось: ${origPostconditions.length} → ${refPostconditions.length}`,
        });
        result.isEquivalent = false;
      }

      // Проверяем инварианты
      const origInvariants = origFunc.contract.invariants;
      const refInvariants = refFunc.contract.invariants;

      if (origInvariants.length !== refInvariants.length) {
        result.failedFunctions.push({
          name,
          reason: `Количество инвариантов изменилось: ${origInvariants.length} → ${refInvariants.length}`,
        });
        result.isEquivalent = false;
      }
    }
  }

  /**
   * Строит граф вызовов из функций
   */
  private async buildCallGraphFromFunctions(
    functions: Map<string, FunctionBehavior>
  ): Promise<CallGraph> {
    const graph: CallGraph = {
      nodes: new Map(),
      edges: [],
      entryPoints: [],
      exports: [],
    };

    for (const [name, func] of functions) {
      graph.nodes.set(name, func);
      if (func.signature.isExported) {
        graph.exports.push(name);
      }
    }

    // Анализируем вызовы в каждой функции
    for (const [name, func] of functions) {
      const body = func.body;

      // Ищем вызовы функций
      const callRegex = /\b(\w+)\s*\(/g;
      let match;
      while ((match = callRegex.exec(body)) !== null) {
        const callee = match[1];
        if (callee && functions.has(callee) && callee !== name) {
          graph.edges.push({
            from: name,
            to: callee,
            type: 'direct',
            line: this.getLineNumber(body, match.index),
          });
        }
      }

      // Ищем вызовы методов
      const methodRegex = /\b(\w+)\.(\w+)\s*\(/g;
      while ((match = methodRegex.exec(body)) !== null) {
        const object = match[1];
        const method = match[2];
        const fullName = `${object}.${method}`;
        if (functions.has(fullName)) {
          graph.edges.push({
            from: name,
            to: fullName,
            type: 'method',
            line: this.getLineNumber(body, match.index),
          });
        }
      }
    }

    // Находим точки входа (экспортируемые функции, которые не вызываются внутри)
    const calledFunctions = new Set(graph.edges.map(e => e.to));
    for (const exp of graph.exports) {
      if (!calledFunctions.has(exp)) {
        graph.entryPoints.push(exp);
      }
    }

    return graph;
  }

  private getLineNumber(text: string, position: number): number {
    const lines = text.substring(0, position).split('\n');
    return lines.length;
  }

  /**
   * Сравнивает графы вызовов
   */
  private compareCallGraphs(result: RefactoringEquivalenceResult): void {
    const originalGraph = this.callGraphs.get('original');
    const refactoredGraph = this.callGraphs.get('refactored');

    if (!originalGraph || !refactoredGraph) {
      return;
    }

    // Сравниваем ребра
    const originalEdges = new Set(originalGraph.edges.map(e => `${e.from}->${e.to}`));
    const refactoredEdges = new Set(refactoredGraph.edges.map(e => `${e.from}->${e.to}`));

    // Находим удаленные ребра
    for (const edge of originalEdges) {
      if (edge && !refactoredEdges.has(edge)) {
        const [from, to] = edge.split('->');
        if (from && to) {
          result.callGraphChanges.push({
            type: 'removed_edge',
            from,
            to,
          });
          // Удаление ребер НЕ делает файл неэквивалентным (если только это не критично)
        }
      }
    }

    // Находим добавленные ребра
    for (const edge of refactoredEdges) {
      if (edge && !originalEdges.has(edge)) {
        const [from, to] = edge.split('->');
        if (from && to) {
          result.callGraphChanges.push({
            type: 'added_edge',
            from,
            to,
          });
          // Добавление ребер не считается ошибкой
        }
      }
    }

    result.summary.callGraphChanges = result.callGraphChanges.length;
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
   * Генерирует отчет
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
        report += `   • ${change.name} (${change.impact} impact):\n`;
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

    if (result.verificationDetails.length > 0) {
      report += '📋 ДЕТАЛИ ВЕРИФИКАЦИИ:\n';
      report += '   Имя функции | Статус | Метод | Время (мс)\n';
      report += '   ' + '-'.repeat(60) + '\n';
      for (const detail of result.verificationDetails) {
        const status = detail.isEquivalent ? '✅' : '❌';
        const method = detail.method || 'formal';
        report += `   ${detail.functionName.padEnd(20)} | ${status} | ${method.padEnd(8)} | ${detail.time}\n`;
      }
      report += '\n';
    }

    report += '='.repeat(70) + '\n';
    report += `📅 Время проверки: ${new Date().toISOString()}\n`;
    report += `🔧 Версия: 2.0.0\n`;

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

  private signatureToString(sig: FunctionSignature): string {
    const params = sig.params.join(', ');
    const asyncStr = sig.isAsync ? 'async ' : '';
    return `${asyncStr}${sig.name}(${params}) => ${sig.returnType}`;
  }

  /**
   * Проверяет эквивалентность конкретной функции
   */
  async checkFunctionEquivalence(
    originalFile: string,
    refactoredFile: string,
    functionName: string
  ): Promise<EquivalenceResult> {
    const origFunc = await this.extractFunction(originalFile, functionName);
    const refFunc = await this.extractFunction(refactoredFile, functionName);

    if (!origFunc || !refFunc) {
      throw new Error(`Function ${functionName} not found in one of the files`);
    }

    return this.equivalenceChecker.checkFunctionEquivalence(
      origFunc.body,
      refFunc.body,
      origFunc.contract
    );
  }

  private async extractFunction(
    filePath: string,
    functionName: string
  ): Promise<FunctionBehavior | null> {
    const functions = await this.extractFunctions(filePath);
    return functions.get(functionName) || null;
  }

  /**
   * Экспортирует отчет в JSON
   */
  exportToJSON(result: RefactoringEquivalenceResult): string {
    return JSON.stringify(
      result,
      (_key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        return value;
      },
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
}

// Экспорт утилит для удобства
export function isEquivalent(result: RefactoringEquivalenceResult): boolean {
  return result.isEquivalent && result.failedFunctions.length === 0;
}

export function needsReview(result: RefactoringEquivalenceResult): boolean {
  return !result.isEquivalent && result.signatureChanges.length > 0;
}

export function hasCriticalIssues(result: RefactoringEquivalenceResult): boolean {
  return result.failedFunctions.length > 0 || result.missingFunctions.length > 0;
}
