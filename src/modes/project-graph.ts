// modes/project-graph.ts
import path from 'path';
import fs from 'fs';
import { parseFile, resolveFilePath, isExternalModule } from '../core/ast-parser.js';
import { IGNORE_NODE_MODULES } from '../config.js';
import { walk } from 'estree-walker';

/**
 * Рекурсивно собирает импорты из AST
 */
function collectImports(ast: any): string[] {
  const imports: string[] = [];
  if (!ast) return imports;

  walk(ast, {
    enter(node: any) {
      // Статический импорт
      if (
        (node.type === 'ImportDeclaration' ||
          node.type === 'ExportNamedDeclaration' ||
          node.type === 'ExportAllDeclaration') &&
        node.source
      ) {
        imports.push(node.source.value);
      }
      // Динамический импорт
      if (node.type === 'ImportExpression' && node.source && node.source.type === 'Literal') {
        imports.push(node.source.value);
      }
      // require() вызовы
      if (
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.name === 'require' &&
        node.arguments[0] &&
        node.arguments[0].type === 'Literal'
      ) {
        imports.push(node.arguments[0].value);
      }
    },
  });

  return imports;
}

/**
 * Собирает реэкспорты из AST (export ... from)
 */
function collectReExports(ast: any): string[] {
  const reExports: string[] = [];
  if (!ast) return reExports;

  walk(ast, {
    enter(node: any) {
      // export { something } from './file'
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.source &&
        node.specifiers &&
        node.specifiers.length > 0
      ) {
        reExports.push(node.source.value);
      }
      // export * from './file'
      if (node.type === 'ExportAllDeclaration' && node.source) {
        reExports.push(node.source.value);
      }
      // export { default } from './file'
      if (node.type === 'ExportDefaultDeclaration' && node.source) {
        reExports.push(node.source.value);
      }
    },
  });

  return reExports;
}

/**
 * Собирает все именованные экспорты из файла (для раскрытия export *)
 */
function collectNamedExports(ast: any): string[] {
  const exports: string[] = [];
  if (!ast) return exports;

  walk(ast, {
    enter(node: any) {
      // export const x = ...
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exports.push(decl.id.name);
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exports.push(decl.id.name);
        } else if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((d: any) => {
            if (d.id && d.id.name) exports.push(d.id.name);
          });
        }
      }
      // export { x, y }
      if (node.type === 'ExportNamedDeclaration' && node.specifiers && !node.source) {
        node.specifiers.forEach((spec: any) => {
          if (spec.exported) exports.push(spec.exported.name);
        });
      }
      // export default
      if (node.type === 'ExportDefaultDeclaration') {
        exports.push('default');
      }
    },
  });

  return exports;
}

/**
 * Раскрывает реэкспорт папки: находит index.ts и возвращает пути ко всем экспортируемым файлам
 */
function expandFolderReExport(folderPath: string, _baseDir: string): string[] {
  const resolvedFiles: string[] = [];

  // Ищем index файл в папке
  for (const ext of ['.ts', '.js', '.mjs', '.cjs']) {
    const indexPath = path.join(folderPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      console.log(`   📂 Раскрываем папку: ${path.basename(folderPath)} → index${ext}`);

      // Парсим index файл
      const ast = parseFile(indexPath);
      if (ast) {
        // Собираем все экспорты из index файла
        const exports = collectNamedExports(ast);
        // Также собираем реэкспорты
        const reExports = collectReExports(ast);

        console.log(`      Найдено экспортов: ${exports.length}, реэкспортов: ${reExports.length}`);

        // Для каждого реэкспорта из index файла резолвим путь
        for (const re of reExports) {
          const resolved = resolveFilePath(path.dirname(indexPath), re);
          if (resolved) {
            resolvedFiles.push(resolved);
            console.log(`      → ${re} → ${path.basename(resolved)}`);
          }
        }
      }
      break;
    }
  }

  return resolvedFiles;
}

/**
 * Строит граф зависимостей проекта от точки входа
 */
export function buildProjectGraph(
  entryPoint: string,
  maxDepth = Infinity
): { rootKey: string; graph: Record<string, string[]> } {
  const graph: Record<string, string[]> = {};
  const visited = new Set<string>();
  const rootAbsPath = path.resolve(entryPoint);
  const queue: { path: string; depth: number; isRoot: boolean }[] = [];

  queue.push({ path: rootAbsPath, depth: 1, isRoot: true });

  while (queue.length > 0) {
    const { path: currentPath, depth, isRoot } = queue.shift()!;

    if (depth > maxDepth) continue;
    if (visited.has(currentPath)) continue;
    visited.add(currentPath);

    const relativeKey = path.relative(process.cwd(), currentPath) || currentPath;
    if (!graph[relativeKey]) {
      graph[relativeKey] = [];
    }

    const ast = parseFile(currentPath);
    if (!ast) {
      console.log(`   ⚠️ Не удалось получить AST для: ${path.basename(currentPath)}`);
      continue;
    }

    const currentDir = path.dirname(currentPath);

    // Собираем импорты
    const imports = collectImports(ast);

    // Для корневого файла собираем реэкспорты
    let reExports: string[] = [];
    if (isRoot) {
      reExports = collectReExports(ast);
      if (reExports.length > 0) {
        console.log(`   📤 Корневой файл: найдено реэкспортов: ${reExports.length}`);
        reExports.forEach(re => console.log(`      - ${re}`));
      }
    }

    // Объединяем все зависимости
    let allDeps = [...imports, ...reExports];
    allDeps = [...new Set(allDeps)];

    if (allDeps.length > 0) {
      console.log(`   📦 ${path.basename(currentPath)}: ${allDeps.length} зависимостей`);
    }

    // Обрабатываем каждую зависимость
    for (const target of allDeps) {
      // Проверяем, не является ли это алиасом (нужно разрешить)
      const isAlias = target.startsWith('@') || target.startsWith('#') || target.startsWith('~');

      // Пропускаем только настоящие внешние npm-пакеты
      if (!isAlias && IGNORE_NODE_MODULES && isExternalModule(target)) {
        console.log(`      ⏭️ Пропуск внешнего: ${target}`);
        continue;
      }

      // Пытаемся разрешить путь
      let resolvedPath = resolveFilePath(currentDir, target);

      // Если не разрешился, пробуем как директорию
      if (!resolvedPath) {
        const asDirectory = path.resolve(currentDir, target);
        if (fs.existsSync(asDirectory) && fs.statSync(asDirectory).isDirectory()) {
          console.log(`   📁 Директория (не разрешена): ${target} → ${path.basename(asDirectory)}`);
          resolvedPath = asDirectory;
        }
      }

      if (resolvedPath) {
        // Проверяем, является ли это директорией
        if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
          console.log(`   📁 Раскрываем директорию: ${target}`);
          const expanded = expandFolderReExport(resolvedPath, currentDir);
          for (const exp of expanded) {
            const depKey = path.relative(process.cwd(), exp);
            console.log(`      ✅ Добавлен: ${path.basename(exp)}`);
            if (!graph[relativeKey].includes(depKey)) {
              graph[relativeKey].push(depKey);
            }
            queue.push({ path: exp, depth: depth + 1, isRoot: false });
          }
        } else {
          const depKey = path.relative(process.cwd(), resolvedPath);
          console.log(`      ✅ Разрешён: ${target} → ${path.basename(resolvedPath)}`);

          if (!graph[relativeKey].includes(depKey)) {
            graph[relativeKey].push(depKey);
          }

          queue.push({ path: resolvedPath, depth: depth + 1, isRoot: false });
        }
      } else {
        console.log(`      ❌ Не удалось разрешить: ${target}`);
        if (!graph[relativeKey].includes(target)) {
          graph[relativeKey].push(target);
        }
      }
    }
  }

  return { rootKey: path.relative(process.cwd(), rootAbsPath) || rootAbsPath, graph };
}
