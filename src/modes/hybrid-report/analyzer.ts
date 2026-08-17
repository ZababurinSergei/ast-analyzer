// src/modes/hybrid-report/analyzer.ts

import fs from 'fs';
import path from 'path';
import type { HybridFunction, HybridModule } from './types.js';

/**
 * Анализирует отдельный модуль (файл) и извлекает:
 * - Функции (с их вызовами и параметрами)
 * - Импорты (с именами импортируемых сущностей)
 * - Экспорты
 * - Компоненты (для Vue/React)
 * - Композаблы (для Vue)
 *
 * @param filePath - Путь к файлу для анализа
 * @param level - Уровень вложенности модуля (0 = корень)
 * @returns HybridModule или null в случае ошибки
 */
export function analyzeModule(filePath: string, level: number = 0): HybridModule | null {
  const absPath = path.resolve(filePath);

  // Проверяем существование файла
  if (!fs.existsSync(absPath)) {
    console.warn(`  ⚠️ Файл не существует: ${filePath}`);
    return null;
  }

  let content: string;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch (error) {
    console.warn(`  ⚠️ Не удалось прочитать файл: ${filePath}`, error);
    return null;
  }

  const name = path.basename(filePath);

  // Определяем тип файла
  let type: 'vue' | 'ts' | 'js' | 'tsx' | 'jsx' = 'js';
  if (filePath.endsWith('.vue')) type = 'vue';
  else if (filePath.endsWith('.tsx')) type = 'tsx';
  else if (filePath.endsWith('.jsx')) type = 'jsx';
  else if (filePath.endsWith('.ts')) type = 'ts';

  const functions: HybridFunction[] = [];
  const imports: string[] = [];
  const exports: string[] = [];
  const components: string[] = [];
  const composables: string[] = [];

  // ============================================
  // 1. ИЗВЛЕЧЕНИЕ ИМПОРТОВ С ПОЛНОЙ ИНФОРМАЦИЕЙ
  // ============================================
  const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  if (importMatches) {
    for (const imp of importMatches) {
      const sourceMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (sourceMatch && sourceMatch[1]) {
        const source = sourceMatch[1];
        imports.push(source);

        // Извлекаем импортируемые имена
        const namesMatch = imp.match(/import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+)|(\*\s+as\s+\w+))/);
        if (namesMatch) {
          let importedNames: string[] = [];
          if (namesMatch[1]) {
            // Named imports: import { a, b } from '...'
            importedNames = namesMatch[1].split(',').map((s: string) => s.trim());
          } else if (namesMatch[2]) {
            // Default import: import x from '...'
            importedNames = [namesMatch[2]];
          }

          // Добавляем импортированные функции как внешние
          for (const importedName of importedNames) {
            if (importedName && !functions.find((f: HybridFunction) => f.name === importedName)) {
              functions.push({
                name: importedName,
                line: 0,
                isExported: false,
                isAsync: false,
                calls: [],
                calledBy: [],
                params: [],
                returnType: undefined,
                body: '',
                startLine: 0,
                endLine: 0,
                exportSource: 'external',
                exportModule: source,
              });
            }
          }
        }
      }
    }
  }

  // ============================================
  // 2. ИЗВЛЕЧЕНИЕ ЭКСПОРТОВ
  // ============================================
  const exportMatches = content.match(
    /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/g
  );
  if (exportMatches) {
    for (const exp of exportMatches) {
      const nameMatch = exp.match(/(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/);
      if (nameMatch && nameMatch[1]) {
        exports.push(nameMatch[1]);
      }
    }
  }

  // ============================================
  // 3. ИЗВЛЕЧЕНИЕ ФУНКЦИЙ С ПОЛНОЙ ИНФОРМАЦИЕЙ
  // ============================================
  const functionMatches = content.match(
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*{([\s\S]*?)(?=\n\s*\})/g
  );
  if (functionMatches) {
    for (const func of functionMatches) {
      const nameMatch = func.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      const paramsMatch = func.match(/\(([^)]*)\)/);
      const bodyMatch = func.match(/{\s*([\s\S]*?)\s*}/);

      const isExported = func.trim().startsWith('export');
      const isAsync = func.includes('async');

      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1];
        const params =
          paramsMatch && paramsMatch[1]
            ? paramsMatch[1]
                .split(',')
                .map((p: string) => p.trim())
                .filter((p: string) => p)
            : [];
        const body = bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : '';

        // Находим вызовы внутри функции
        const calls: string[] = [];
        if (body) {
          const callMatches = body.match(/\b(\w+)\s*\(/g);
          if (callMatches) {
            for (const call of callMatches) {
              const calledName = call.replace(/\s*\(/, '');
              if (calledName && calledName !== name) {
                calls.push(calledName);
              }
            }
          }
        }

        // Определяем источник экспорта
        let exportSource: 'self' | 'external' | 're-export' = 'self';
        let exportModule: string | undefined;
        if (isExported) {
          exportSource = 'self';
        } else {
          // Проверяем, импортирована ли функция
          for (const imp of imports) {
            if (imp.includes(name) || imp.endsWith(name)) {
              exportSource = 'external';
              exportModule = imp;
              break;
            }
          }
        }

        const line = content.substring(0, func.indexOf(name)).split('\n').length;
        const startLine = content.substring(0, func.indexOf(name)).split('\n').length;
        const endLine = startLine + func.split('\n').length;

        functions.push({
          name,
          line,
          isExported,
          isAsync,
          calls: [...new Set(calls)],
          calledBy: [],
          params,
          returnType: undefined,
          body: body.length > 200 ? body.substring(0, 200) + '...' : body,
          startLine,
          endLine,
          exportSource,
          exportModule,
        });
      }
    }
  }

  // ============================================
  // 4. ИЗВЛЕЧЕНИЕ СТРЕЛОЧНЫХ ФУНКЦИЙ
  // ============================================
  const arrowMatches = content.match(
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{([\s\S]*?)(?=\n\s*\})/g
  );
  if (arrowMatches) {
    for (const arrow of arrowMatches) {
      const nameMatch = arrow.match(/(?:export\s+)?(?:const|let)\s+(\w+)/);
      const bodyMatch = arrow.match(/{\s*([\s\S]*?)\s*}/);
      const isExported = arrow.trim().startsWith('export');
      const isAsync = arrow.includes('async');

      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1];
        const body = bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : '';
        const calls: string[] = [];

        if (body) {
          const callMatches = body.match(/\b(\w+)\s*\(/g);
          if (callMatches) {
            for (const call of callMatches) {
              const calledName = call.replace(/\s*\(/, '');
              if (calledName && calledName !== name) {
                calls.push(calledName);
              }
            }
          }
        }

        const line = content.substring(0, arrow.indexOf(name)).split('\n').length;
        functions.push({
          name,
          line,
          isExported,
          isAsync,
          calls: [...new Set(calls)],
          calledBy: [],
          params: [],
          returnType: undefined,
          body: body.length > 200 ? body.substring(0, 200) + '...' : body,
          startLine: line,
          endLine: line + arrow.split('\n').length,
          exportSource: isExported ? 'self' : 'self',
          exportModule: undefined,
        });
      }
    }
  }

  // ============================================
  // 5. ИЗВЛЕЧЕНИЕ КОМПОНЕНТОВ (VUE)
  // ============================================
  if (type === 'vue') {
    // Импорты Vue компонентов
    const componentImports = content.match(/import\s+(\w+)\s+from\s+['"][^'"]+\.vue['"]/g);
    if (componentImports) {
      for (const imp of componentImports) {
        const nameMatch = imp.match(/import\s+(\w+)/);
        if (nameMatch && nameMatch[1]) {
          components.push(nameMatch[1]);
        }
      }
    }

    // Composables (use*)
    const composableMatches = content.match(/\b(use\w+)\s*\(/g);
    if (composableMatches) {
      for (const comp of composableMatches) {
        const name = comp.replace(/\s*\(/, '');
        if (name && !composables.includes(name)) {
          composables.push(name);
        }
      }
    }
  }

  // ============================================
  // 6. ИЗВЛЕЧЕНИЕ КОМПОНЕНТОВ (REACT/JSX)
  // ============================================
  if (type === 'tsx' || type === 'jsx') {
    const jsxTags = content.match(/<([A-Z][a-zA-Z0-9]*)/g);
    if (jsxTags) {
      for (const tag of jsxTags) {
        const name = tag.replace('<', '');
        if (
          name &&
          !components.includes(name) &&
          !['div', 'span', 'p', 'a', 'button', 'input'].includes(name)
        ) {
          components.push(name);
        }
      }
    }
  }

  // ============================================
  // 7. НАХОЖДЕНИЕ СВЯЗЕЙ МЕЖДУ ФУНКЦИЯМИ
  // ============================================
  for (const func of functions) {
    for (const otherFunc of functions) {
      if (func.name !== otherFunc.name && func.calls.includes(otherFunc.name)) {
        otherFunc.calledBy.push(func.name);
      }
    }
  }

  // ============================================
  // 8. ВОЗВРАТ РЕЗУЛЬТАТА
  // ============================================
  return {
    path: filePath,
    name,
    type,
    level,
    exports,
    imports,
    functions,
    components,
    composables,
    dependencies: [],
    dependents: [],
  };
}
