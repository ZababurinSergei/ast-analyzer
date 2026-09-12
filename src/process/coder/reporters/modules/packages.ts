// src/reporters/modules/packages.ts

import path from 'path';
import fs from 'fs';
import { idManager } from '../../core/IdManager.js';
import type {
  EnhancedPackageInfo,
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedClassInfo,
  EnhancedConstantInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedVariableInfo,
  VueAnalysis,
} from '../../types.js';

/**
 * Создает безопасную копию объекта, удаляя циклические ссылки и _safeInfo
 */
function safeCopy<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => safeCopy(item)) as T;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Пропускаем _safeInfo и другие служебные поля
    if (key === '_safeInfo' || key === '__proto__' || key === 'constructor') {
      continue;
    }
    result[key] = safeCopy(value);
  }
  return result as T;
}

/**
 * Строит пакеты из графа и сущностей
 */
export function buildPackages(
  rootKey: string,
  _graph: Record<string, string[]>,
  entitiesMap: Record<string, EnhancedEntityInfo>,
  projectRoot: string,
  options?: { includeBody?: boolean }
): Record<string, EnhancedPackageInfo> {
  const packages: Record<string, EnhancedPackageInfo> = {};
  const includeBody = options?.includeBody !== false;

  // 1. Определяем язык по расширению файла
  function detectLanguage(modulePath: string): 'typescript' | 'javascript' | 'vue' | 'jsx' {
    if (modulePath.endsWith('.vue')) return 'vue';
    if (modulePath.endsWith('.tsx')) return 'jsx';
    if (modulePath.endsWith('.jsx')) return 'jsx';
    if (modulePath.endsWith('.ts')) return 'typescript';
    return 'javascript';
  }

  // 2. Собираем статистику файла
  function getFileStats(modulePath: string): { size: number; lines: number } {
    try {
      const absPath = path.resolve(projectRoot, modulePath);
      if (fs.existsSync(absPath)) {
        const stat = fs.statSync(absPath);
        if (stat.size > 1024 * 1024) {
          return { size: stat.size, lines: Math.floor(stat.size / 50) };
        }
        const content = fs.readFileSync(absPath, 'utf-8');
        return { size: content.length, lines: content.split('\n').length };
      }
    } catch (error) {
      // Игнорируем ошибки
    }
    return { size: 0, lines: 0 };
  }

  // 3. Строим пакеты
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const language = detectLanguage(modulePath);
    const isEntry = modulePath === rootKey;
    const fileStats = getFileStats(modulePath);

    // ✅ БЕЗОПАСНОЕ ПРЕОБРАЗОВАНИЕ СУЩНОСТЕЙ
    const functions = (entities.functions || []).map((func: EnhancedFunctionInfo) => {
      // ✅ Генерируем ID с номером строки через idManager
      // ID используется как ключ в packages, но не сохраняется в теле объекта
      idManager.getFunctionId({
        filePath: modulePath,
        funcName: func.name || 'anonymous',
        line: func.line || 0,
        parentFunction: func.parentFunction,
        depth: func.depth || 0,
        type: 'function',
      });

      // ❌ Убираем поле id из тела объекта - оно будет ключом
      const result = {
        name: func.name || 'anonymous',
        params: func.params || [],
        paramTypes: func.paramTypes || [],
        line: func.line || 0,
        startLine: func.startLine || func.line || 0,
        endLine: func.endLine || func.line || 0,
        isAsync: func.isAsync || false,
        isExported: func.isExported || false,
        isMethod: func.isMethod || false,
        className: func.className || '',
        calls: func.calls || [],
        calledBy: func.calledBy || [],
        returnType: func.returnType || 'any',
        body: includeBody ? func.body || '' : '',
        isNested: func.isNested || false,
        parentFunction: func.parentFunction || '',
        isArrow: func.isArrow || false,
        isEventHandler: func.isEventHandler || false,
        eventType: func.eventType || '',
        depth: func.depth || 0,
        complexity: func.complexity || 1,
        security: func.security || {
          hasEval: false,
          hasProcessEnv: false,
          hasSensitiveData: false,
          hasExec: false,
          hasPassword: false,
        },
        vscode: func.vscode || `vscode://file/${modulePath}:${func.line || 0}`,
        signature: func.signature || '',
        callsInfo: func.callsInfo || [],
        calledByInfo: func.calledByInfo || [],
        importedBy: func.importedBy || [],
      };

      return safeCopy(result);
    });

    const classes = (entities.classes || []).map((cls: EnhancedClassInfo) => {
      // ✅ Генерируем ID для класса с номером строки (не сохраняем в теле)
      idManager.getClassId(modulePath, cls.name || 'anonymous', cls.line || 0);
      // ❌ Убираем поле id из тела объекта
      return safeCopy({
        name: cls.name || 'anonymous',
        line: cls.line || 0,
        startLine: cls.startLine || cls.line || 0,
        endLine: cls.endLine || cls.line || 0,
        isExported: cls.isExported || false,
        methods: cls.methods || [],
        properties: cls.properties || [],
        extends: cls.extends,
        implements: cls.implements || [],
        vscode: `vscode://file/${modulePath}:${cls.line || 0}`,
      });
    });

    const constants = (entities.constants || []).map((constItem: EnhancedConstantInfo) => {
      // ✅ Генерируем ID для константы с номером строки (не сохраняем в теле)
      idManager.getConstantId(modulePath, constItem.name || 'unknown', constItem.line || 0);
      // ❌ Убираем поле id из тела объекта
      return safeCopy({
        name: constItem.name || 'unknown',
        line: constItem.line || 0,
        isExported: constItem.isExported || false,
        type: constItem.type || 'any',
        value: constItem.value,
        vscode: `vscode://file/${modulePath}:${constItem.line || 0}`,
      });
    });

    const variables = (entities.variables || []).map((varItem: EnhancedVariableInfo) => {
      // ✅ Генерируем ID для переменной с номером строки (не сохраняем в теле)
      idManager.getFunctionId({
        filePath: modulePath,
        funcName: varItem.name || 'unknown',
        line: varItem.line || 0,
        type: 'function',
      });
      // ❌ Убираем поле id из тела объекта
      return safeCopy({
        name: varItem.name || 'unknown',
        line: varItem.line || 0,
        isExported: varItem.isExported || false,
        type: varItem.type || 'any',
        value: varItem.value,
        vscode: `vscode://file/${modulePath}:${varItem.line || 0}`,
      });
    });

    const interfaces = (entities.interfaces || []).map((intf: EnhancedInterfaceInfo) => {
      // ✅ Генерируем ID для интерфейса с номером строки (не сохраняем в теле)
      idManager.getInterfaceId(modulePath, intf.name || 'unknown', intf.line || 0);
      // ❌ Убираем поле id из тела объекта
      return safeCopy({
        name: intf.name || 'unknown',
        properties: intf.properties || [],
        line: intf.line || 0,
        startLine: intf.startLine || intf.line || 0,
        endLine: intf.endLine || intf.line || 0,
        isExported: intf.isExported || false,
        extends: intf.extends || [],
        vscode: `vscode://file/${modulePath}:${intf.line || 0}`,
      });
    });

    const types = (entities.types || []).map((type: EnhancedTypeInfo) => {
      // ✅ Генерируем ID для типа с номером строки (не сохраняем в теле)
      idManager.getTypeId(modulePath, type.name || 'unknown', type.line || 0);
      // ❌ Убираем поле id из тела объекта
      return safeCopy({
        name: type.name || 'unknown',
        definition: type.definition || 'unknown',
        line: type.line || 0,
        isExported: type.isExported || false,
        vscode: `vscode://file/${modulePath}:${type.line || 0}`,
      });
    });

    // ✅ Собираем импорты
    const imports: Record<string, any> = {};
    for (const imp of entities.imports || []) {
      if (imp.source) {
        const specifiers = (imp.specifiers || [])
          .map((s: any) => {
            if (typeof s === 'string') return s;
            return s.imported || s.local || '';
          })
          .filter(Boolean);

        imports[imp.source] = {
          direction: 'inward',
          type: 'import',
          specifiers,
          functions: {},
          isTypeOnly: imp.isTypeOnly || false,
        };
      }
    }

    // ✅ Собираем экспорты
    const exports: Record<string, any> = {};
    for (const func of functions) {
      if (func.isExported && func.name) {
        // ❌ Убираем поле id из тела объекта
        exports[func.name] = {
          direction: 'outward',
          type: 'function',
          isAsync: func.isAsync || false,
          params: func.params || [],
          returns: func.returnType || 'any',
          line: func.line || 0,
          consumers: [],
          vscode: func.vscode,
          signature: func.signature || '',
        };
      }
    }

    for (const cls of classes) {
      if (cls.isExported && cls.name) {
        // ❌ Убираем поле id из тела объекта
        exports[cls.name] = {
          direction: 'outward',
          type: 'class',
          methods: cls.methods || [],
          line: cls.line || 0,
          consumers: [],
          vscode: cls.vscode,
          extends: cls.extends,
        };
      }
    }

    for (const constItem of constants) {
      if (constItem.isExported && constItem.name) {
        // ❌ Убираем поле id из тела объекта
        exports[constItem.name] = {
          direction: 'outward',
          type: 'constant',
          value: constItem.value,
          line: constItem.line || 0,
          consumers: [],
          vscode: constItem.vscode,
        };
      }
    }

    for (const intf of interfaces) {
      if (intf.isExported && intf.name) {
        // ❌ Убираем поле id из тела объекта
        exports[intf.name] = {
          direction: 'outward',
          type: 'interface',
          properties: intf.properties || [],
          line: intf.line || 0,
          consumers: [],
          vscode: intf.vscode,
          extends: intf.extends,
        };
      }
    }

    for (const type of types) {
      if (type.isExported && type.name) {
        // ❌ Убираем поле id из тела объекта
        exports[type.name] = {
          direction: 'outward',
          type: 'type',
          definition: type.definition || '',
          line: type.line || 0,
          consumers: [],
          vscode: type.vscode,
        };
      }
    }

    // ✅ ВЫЧИСЛЯЕМ СЛОЖНОСТЬ
    let totalComplexity = 0;
    let maxComplexity = 0;
    const complexityMap: Record<string, number> = {};
    for (const func of functions) {
      const comp = func.complexity || 1;
      totalComplexity += comp;
      if (comp > maxComplexity) maxComplexity = comp;
      if (func.name) {
        complexityMap[func.name] = comp;
      }
    }

    // ✅ ВЫЧИСЛЯЕМ ПРОБЛЕМЫ БЕЗОПАСНОСТИ
    const securityIssues: string[] = [];
    for (const func of functions) {
      if (func.security?.hasEval) securityIssues.push(`${func.name}: uses eval()`);
      if (func.security?.hasExec) securityIssues.push(`${func.name}: uses exec()`);
      if (func.security?.hasPassword) securityIssues.push(`${func.name}: contains password/secret`);
      if (func.security?.hasProcessEnv) securityIssues.push(`${func.name}: uses process.env`);
    }

    const security = {
      hasEval: functions.some(f => f.security?.hasEval),
      hasProcessEnv: functions.some(f => f.security?.hasProcessEnv),
      hasSensitiveData: functions.some(f => f.security?.hasSensitiveData),
      hasExec: functions.some(f => f.security?.hasExec),
      issues: securityIssues,
    };

    // ✅ АНАЛИЗ VUE (если есть)
    let vueAnalysis: VueAnalysis | undefined;
    try {
      // Проверяем, есть ли Vue-специфичные данные в сущностях
      const vueData = (entities as any).vueAnalysis;
      if (vueData) {
        vueAnalysis = {
          props: vueData.props || { names: [], types: {}, required: {}, defaults: {} },
          emits: vueData.emits || { names: [], types: {} },
          slots: vueData.slots || [],
          composables: vueData.composables || [],
          templateComplexity: vueData.templateComplexity || 0,
          scriptType: vueData.scriptType || 'options',
          isTS: vueData.isTS || false,
          stats: vueData.stats || { scriptLines: 0, templateLines: 0, styleCount: 0 },
        };
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    // ✅ ФОРМИРУЕМ ПАКЕТ
    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      displayPath: modulePath,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
      entities: {
        functions,
        constants,
        variables,
        interfaces,
        types,
        classes,
      },
      fileStats: {
        size: fileStats.size,
        lines: fileStats.lines,
        functions: functions.length,
        classes: classes.length,
        constants: constants.length,
        interfaces: interfaces.length,
        types: types.length,
        variables: variables.length,
      },
      complexity: {
        average: functions.length > 0 ? totalComplexity / functions.length : 0,
        max: maxComplexity,
        functions: complexityMap,
      },
      security,
      vscode: `vscode://file/${modulePath}`,
      vueAnalysis,
    };

    // ✅ Добавляем исходный код (опционально)
    if (includeBody) {
      try {
        const absPath = path.resolve(projectRoot, modulePath);
        if (fs.existsSync(absPath)) {
          const content = fs.readFileSync(absPath, 'utf-8');
          packages[modulePath].sourceCode = content;
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }
  }

  return packages;
}

/**
 * Экспорт по умолчанию
 */
export default {
  buildPackages,
};
