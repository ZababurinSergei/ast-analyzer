// src/reporters/modules/packages.ts
import type { EnhancedEntityInfo } from '../../types.js';
import { ensureArray, safeString, safeNumber, safeBoolean } from './utils.js';

/**
 * Строит пакеты (модули) из графа и сущностей
 */
export function buildPackages(
  _rootKey: string,
  _graph: Record<string, string[]>,
  entitiesMap: Record<string, EnhancedEntityInfo>,
  _projectRoot: string,
  _options?: { includeBody?: boolean }
): Record<string, any> {
  const packages: Record<string, any> = {};

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    // Определяем язык по расширению
    let language: 'typescript' | 'javascript' | 'vue' | 'jsx' = 'javascript';
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) language = 'typescript';
    else if (modulePath.endsWith('.vue')) language = 'vue';
    else if (modulePath.endsWith('.jsx')) language = 'jsx';

    const isEntry = modulePath === _rootKey;

    // Безопасное извлечение сущностей
    const functions = ensureArray(entities.functions);
    const classes = ensureArray(entities.classes);
    const constants = ensureArray(entities.constants);
    const interfaces = ensureArray(entities.interfaces);
    const types = ensureArray(entities.types);
    const variables = ensureArray(entities.variables);

    // Строим экспорты
    const exportsMap: Record<string, any> = {};

    // Функции
    for (const func of functions) {
      const f = func as any;
      if (f?.isExported && f?.name) {
        exportsMap[f.name] = {
          direction: 'outward',
          type: 'function',
          isAsync: safeBoolean(f.isAsync),
          params: ensureArray(f.params).map(safeString),
          returns: safeString(f.returnType || 'any'),
          line: safeNumber(f.line),
          consumers: [],
          id: f.id || `func_${simpleHash(modulePath)}_${f.name}`,
          vscode: f.vscode || `vscode://file/${modulePath}:${f.line}`,
        };
      }
    }

    // Константы
    for (const constItem of constants) {
      const c = constItem as any;
      if (c?.isExported && c?.name) {
        exportsMap[c.name] = {
          direction: 'outward',
          type: 'constant',
          value: c.value,
          line: safeNumber(c.line),
          consumers: [],
        };
      }
    }

    // Переменные
    for (const varItem of variables) {
      const v = varItem as any;
      if (v?.isExported && v?.name) {
        exportsMap[v.name] = {
          direction: 'outward',
          type: 'variable',
          value: v.value,
          line: safeNumber(v.line),
          consumers: [],
        };
      }
    }

    // Классы
    for (const cls of classes) {
      const c = cls as any;
      if (c?.isExported && c?.name) {
        exportsMap[c.name] = {
          direction: 'outward',
          type: 'class',
          methods: ensureArray(c.methods).map(safeString),
          line: safeNumber(c.line),
          consumers: [],
        };
      }
    }

    // Интерфейсы
    for (const intf of interfaces) {
      const i = intf as any;
      if (i?.isExported && i?.name) {
        exportsMap[i.name] = {
          direction: 'outward',
          type: 'interface',
          properties: ensureArray(i.properties).map(safeString),
          line: safeNumber(i.line),
          consumers: [],
        };
      }
    }

    // Типы
    for (const type of types) {
      const t = type as any;
      if (t?.isExported && t?.name) {
        exportsMap[t.name] = {
          direction: 'outward',
          type: 'type',
          definition: safeString(t.definition || ''),
          line: safeNumber(t.line),
          consumers: [],
        };
      }
    }

    // Строим импорты
    const importsMap: Record<string, any> = {};
    const imports = ensureArray(entities.imports);

    for (const imp of imports) {
      const i = imp as any;
      if (i?.source) {
        importsMap[i.source] = {
          direction: 'inward',
          type: 'import',
          specifiers: ensureArray(i.specifiers).map((s: any) =>
            typeof s === 'string' ? s : s.imported || s.local || ''
          ),
          functions: {},
        };
      }
    }

    // Собираем статистику файла
    const fileStats = {
      size: 0,
      lines: 0,
      functions: functions.length,
      classes: classes.length,
      constants: constants.length,
      interfaces: interfaces.length,
      types: types.length,
      variables: variables.length,
    };

    // Формируем пакет
    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      displayPath: modulePath,
      type: 'module',
      language,
      isEntry,
      imports: importsMap,
      exports: exportsMap,
      entities: {
        functions: functions.map((func: any) => ({
          name: func?.name || 'anonymous',
          line: safeNumber(func?.line),
          isAsync: safeBoolean(func?.isAsync),
          isExported: safeBoolean(func?.isExported),
          params: ensureArray(func?.params).map(safeString),
          returnType: safeString(func?.returnType || 'any'),
          calls: ensureArray(func?.calls),
          calledBy: ensureArray(func?.calledBy),
          body: func?.body || '',
          startLine: safeNumber(func?.startLine || func?.line || 0),
          endLine: safeNumber(func?.endLine || func?.line || 0),
          isMethod: safeBoolean(func?.isMethod),
          className: safeString(func?.className || ''),
          isNested: safeBoolean(func?.isNested),
          parentFunction: safeString(func?.parentFunction || ''),
          isArrow: safeBoolean(func?.isArrow),
          isEventHandler: safeBoolean(func?.isEventHandler),
          eventType: safeString(func?.eventType || ''),
          depth: safeNumber(func?.depth || 0),
          complexity: safeNumber(func?.complexity || 1),
          security: func?.security || {
            hasEval: false,
            hasProcessEnv: false,
            hasSensitiveData: false,
            hasExec: false,
            hasPassword: false,
          },
          id: func?.id || `func_${simpleHash(modulePath)}_${func?.name || 'anonymous'}`,
          vscode: func?.vscode || `vscode://file/${modulePath}:${func?.line || 0}`,
          callsInfo: ensureArray(func?.callsInfo),
          calledByInfo: ensureArray(func?.calledByInfo),
          importedBy: ensureArray(func?.importedBy),
          signature: func?.signature || '',
          _safeInfo: null,
        })),
        constants: constants.map((c: any) => ({
          name: safeString(c?.name || 'unknown'),
          line: safeNumber(c?.line),
          isExported: safeBoolean(c?.isExported),
          type: safeString(c?.type || 'any'),
          value: c?.value,
          _safeInfo: null,
        })),
        variables: variables.map((v: any) => ({
          name: safeString(v?.name || 'unknown'),
          line: safeNumber(v?.line),
          isExported: safeBoolean(v?.isExported),
          type: safeString(v?.type || 'any'),
          value: v?.value,
          _safeInfo: null,
        })),
        interfaces: interfaces.map((i: any) => ({
          name: safeString(i?.name || 'unknown'),
          properties: ensureArray(i?.properties).map(safeString),
          line: safeNumber(i?.line),
          startLine: safeNumber(i?.startLine || i?.line || 0),
          endLine: safeNumber(i?.endLine || i?.line || 0),
          isExported: safeBoolean(i?.isExported),
          extends: ensureArray(i?.extends).map(safeString),
          _safeInfo: null,
        })),
        types: types.map((t: any) => ({
          name: safeString(t?.name || 'unknown'),
          definition: safeString(t?.definition || 'unknown'),
          line: safeNumber(t?.line),
          isExported: safeBoolean(t?.isExported),
          _safeInfo: null,
        })),
        classes: classes.map((c: any) => ({
          name: safeString(c?.name || 'unknown'),
          methods: ensureArray(c?.methods).map(safeString),
          properties: ensureArray(c?.properties).map(safeString),
          line: safeNumber(c?.line),
          startLine: safeNumber(c?.startLine || c?.line || 0),
          endLine: safeNumber(c?.endLine || c?.line || 0),
          isExported: safeBoolean(c?.isExported),
          extends: safeString(c?.extends || ''),
          implements: ensureArray(c?.implements).map(safeString),
          _safeInfo: null,
        })),
      },
      fileStats,
      vscode: `vscode://file/${modulePath}`,
    };
  }

  return packages;
}

/**
 * Вспомогательная функция для генерации хэша
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

// Экспорт по умолчанию
export default { buildPackages };
