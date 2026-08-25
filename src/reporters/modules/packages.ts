// src/reporters/modules/packages.ts

import type { EntitiesResult } from './types.js';

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ОПРЕДЕЛЕНИЯ ЯЗЫКА
// ============================================================

function detectLanguage(modulePath: string): 'typescript' | 'javascript' | 'vue' | 'jsx' {
  if (modulePath.endsWith('.vue')) return 'vue';
  if (modulePath.endsWith('.tsx')) return 'jsx';
  if (modulePath.endsWith('.jsx')) return 'jsx';
  if (modulePath.endsWith('.ts')) return 'typescript';
  return 'javascript';
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ ПОСТРОЕНИЯ ПАКЕТОВ
// ============================================================

export function buildPackages(
  rootKey: string,
  _graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _projectRoot: string,
  _options?: { includeBody?: boolean }
): Record<string, any> {
  const packages: Record<string, any> = {};

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const language = detectLanguage(modulePath);
    const isEntry = modulePath === rootKey;

    // ============================================
    // СТРОИМ ИМПОРТЫ ИЗ entities.imports
    // ============================================
    const imports: Record<string, any> = {};
    for (const imp of entities.imports || []) {
      if (imp.source) {
        imports[imp.source] = {
          direction: 'inward',
          type: imp.isTypeOnly ? 'type-import' : 'import',
          specifiers: imp.specifiers || [],
          functions: {},
        };
      }
    }

    // ============================================
    // СТРОИМ ЭКСПОРТЫ (включая функции-константы)
    // ============================================
    const exports: Record<string, any> = {};

    // 1. Обычные функции
    for (const func of entities.functions || []) {
      if (func.isExported && func.name) {
        exports[func.name] = {
          direction: 'outward',
          type: 'function',
          isAsync: func.isAsync || false,
          params: func.params || [],
          returns: func.returnType || 'any',
          line: func.line || 0,
          consumers: [],
        };
      }
    }

    // 2. Константы (которые не являются функциями)
    for (const constItem of entities.constants || []) {
      if (constItem.isExported && constItem.name) {
        // Проверяем, не является ли это функцией (уже добавлена)
        if (!exports[constItem.name]) {
          exports[constItem.name] = {
            direction: 'outward',
            type: 'constant',
            value: constItem.value,
            line: constItem.line || 0,
            consumers: [],
          };
        }
      }
    }

    // 3. Переменные
    for (const varItem of entities.variables || []) {
      if (varItem.isExported && varItem.name && !exports[varItem.name]) {
        exports[varItem.name] = {
          direction: 'outward',
          type: 'variable',
          value: varItem.value,
          line: varItem.line || 0,
          consumers: [],
        };
      }
    }

    // 4. Классы
    for (const cls of entities.classes || []) {
      if (cls.isExported && cls.name && !exports[cls.name]) {
        exports[cls.name] = {
          direction: 'outward',
          type: 'class',
          methods: cls.methods || [],
          line: cls.line || 0,
          consumers: [],
        };
      }
    }

    // 5. Интерфейсы
    for (const intf of entities.interfaces || []) {
      if (intf.isExported && intf.name && !exports[intf.name]) {
        exports[intf.name] = {
          direction: 'outward',
          type: 'interface',
          properties: intf.properties || [],
          line: intf.line || 0,
          consumers: [],
        };
      }
    }

    // 6. Типы
    for (const type of entities.types || []) {
      if (type.isExported && type.name && !exports[type.name]) {
        exports[type.name] = {
          direction: 'outward',
          type: 'type',
          definition: type.definition || '',
          line: type.line || 0,
          consumers: [],
        };
      }
    }

    // ============================================
    // СОЗДАЁМ ПАКЕТ
    // ============================================
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
        functions: entities.functions || [],
        constants: entities.constants || [],
        variables: entities.variables || [],
        interfaces: entities.interfaces || [],
        types: entities.types || [],
        classes: entities.classes || [],
      },
      fileStats: {
        size: 0,
        lines: 0,
        functions: (entities.functions || []).length,
        classes: (entities.classes || []).length,
        constants: (entities.constants || []).length,
        interfaces: (entities.interfaces || []).length,
        types: (entities.types || []).length,
        variables: (entities.variables || []).length,
      },
      vscode: `vscode://file/${modulePath}`,
    };
  }

  return packages;
}
