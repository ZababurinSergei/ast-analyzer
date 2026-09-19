// packages/ast-analyzer/src/reporters/json/utils/path-resolver.ts

import path from 'path';

// ============================================================
// РЕЗОЛВЕР ПУТЕЙ ИМПОРТОВ
// ============================================================
//
// Модуль предоставляет две функции:
//   - resolveImportPath      — расширенный резолвер (для графа импортов)
//   - resolveImportPathOld   — упрощённый резолвер (для consumers и import/export flow)
//
// Обе функции работают с плоской картой `graph`:
//   { "./src/a.ts": ["./src/b.ts"], "./src/b.ts": [] }
//
// Особенности:
//   - Поддержка относительных путей (./, ../)
//   - Поддержка алиасов (@/, #/, ~/)
//   - Поддержка index-файлов (./foo → ./foo/index.ts)
//   - Поддержка разных расширений (.ts, .tsx, .js, .jsx, .vue, .mjs, .cjs)
//   - Fallback по имени файла для внешних модулей
// ============================================================

// ============================================================
// РАСШИРЕННЫЙ РЕЗОЛВЕР
// ============================================================

/**
 * Расширенный резолвинг путей импортов.
 *
 * Поддерживает:
 *   - Относительные пути (./, ../)
 *   - Алиасы (@/, #/, ~/)
 *   - Поиск по имени файла (для внешних модулей)
 *   - Index-файлы в директориях
 *
 * Используется в:
 *   - buildImportGraph (compact-entity-reporter.ts)
 *   - collectImporters (importers-collector.ts)
 *
 * @param fromModule — путь к файлу-источнику импорта
 * @param importPath — путь из import/export (может быть относительным, алиасом или именем пакета)
 * @param graph — плоская карта графа зависимостей
 * @returns абсолютный или нормализованный путь к целевому модулю, либо null
 */
export function resolveImportPath(
  fromModule: string,
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  if (!fromModule || !importPath) return null;

  // ============================================================
  // 1. АЛИАСЫ (@/, #/, ~/)
  // ============================================================
  if (
    importPath.startsWith('@/') ||
    importPath.startsWith('#/') ||
    importPath.startsWith('~/')
  ) {
    return resolveAliasImport(importPath, graph);
  }

  // ============================================================
  // 2. ОТНОСИТЕЛЬНЫЕ ПУТИ (./, ../)
  // ============================================================
  if (importPath.startsWith('.')) {
    return resolveRelativeImport(fromModule, importPath, graph);
  }

  // ============================================================
  // 3. ВНЕШНИЕ ПАКЕТЫ (или поиск по имени файла)
  // ============================================================
  return resolveByName(importPath, graph);
}

// ============================================================
// ПОДФУНКЦИИ РАСШИРЕННОГО РЕЗОЛВЕРА
// ============================================================

/**
 * Резолвинг алиасов (@/, #/, ~/).
 *
 * Стратегия:
 *   1. Прямая замена "@/" на "src/" и поиск по графу
 *   2. Поиск с расширениями (.ts, .tsx, .js, .jsx, .vue)
 *   3. Поиск по basename (например, "@/components/ui" → любой файл с "components/ui")
 */
function resolveAliasImport(
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  // Заменяем префикс алиаса на "src/"
  const actualPath = importPath.replace(/^[@#~]\//, 'src/');

  // 1. Прямой поиск по графу
  for (const modulePath of Object.keys(graph)) {
    if (modulePath.endsWith(actualPath) || modulePath.includes(actualPath)) {
      return modulePath;
    }
  }

  // 2. Поиск с расширениями
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
  for (const ext of extensions) {
    const candidate = actualPath + ext;
    for (const modulePath of Object.keys(graph)) {
      if (modulePath.endsWith(candidate) || modulePath.includes(candidate)) {
        return modulePath;
      }
    }
  }

  // 3. Поиск с index-файлами
  for (const ext of extensions) {
    const candidate = `${actualPath}/index${ext}`;
    for (const modulePath of Object.keys(graph)) {
      if (modulePath.endsWith(candidate) || modulePath.includes(candidate)) {
        return modulePath;
      }
    }
  }

  return null;
}

/**
 * Резолвинг относительных путей (./, ../).
 *
 * Стратегия:
 *   1. Прямой поиск (./foo → ./foo)
 *   2. Поиск с расширениями (./foo → ./foo.ts)
 *   3. Поиск с index-файлами (./foo → ./foo/index.ts)
 */
function resolveRelativeImport(
  fromModule: string,
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  const fromDir = path.dirname(fromModule);
  let resolved = path.join(fromDir, importPath);

  // Нормализуем слеши (Windows → Unix)
  resolved = resolved.replace(/\\/g, '/');

  // 1. Прямой поиск
  if (graph[resolved]) {
    return resolved;
  }

  // 2. Поиск с расширениями
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (graph[candidate]) {
      return candidate;
    }
  }

  // 3. Поиск с index-файлами
  for (const ext of extensions) {
    const candidate = path.join(resolved, `index${ext}`).replace(/\\/g, '/');
    if (graph[candidate]) {
      return candidate;
    }
  }

  return null;
}

/**
 * Поиск модуля по имени файла (для внешних пакетов).
 *
 * Стратегия:
 *   1. Извлекаем basename из importPath
 *   2. Ищем модуль с таким же basename в графе
 *   3. Сравниваем и полное имя, и basename без расширения
 *
 * Пример:
 *   importPath = "lodash/debounce"
 *   → basename = "debounce"
 *   → ищем модуль "./node_modules/lodash/debounce.js"
 */
function resolveByName(
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  const fileName = path.basename(importPath);
  const baseName = fileName.replace(/\.[^.]+$/, '');

  if (!baseName) return null;

  for (const modulePath of Object.keys(graph)) {
    const moduleFileName = path.basename(modulePath);
    const moduleBaseName = moduleFileName.replace(/\.[^.]+$/, '');

    if (moduleBaseName === baseName || moduleFileName === fileName) {
      return modulePath;
    }
  }

  return null;
}

// ============================================================
// УПРОЩЁННЫЙ РЕЗОЛВЕР
// ============================================================

/**
 * Упрощённый резолвер путей импортов.
 *
 * Отличия от resolveImportPath:
 *   - Работает с относительными путями вручную (через split, а не path.join)
 *   - Более простой алгоритм (без алиасов и сложной логики)
 *   - Используется там, где importPath известен как относительный
 *
 * Используется в:
 *   - computeExportConsumers (export-consumers.ts)
 *   - buildImportExportFlow (flows.ts)
 *   - getImportedName (importers-collector.ts)
 *
 * @param fromModule — путь к файлу-источнику
 * @param importPath — путь из import/export
 * @param graph — плоская карта графа зависимостей
 * @returns путь к модулю или null
 */
export function resolveImportPathOld(
  fromModule: string,
  importPath: string,
  graph: Record<string, string[]>
): string | null {
  if (!fromModule || !importPath) return null;

  // ============================================================
  // 1. ПРЯМОЙ ПОИСК В ГРАФЕ
  // ============================================================
  if (graph[importPath]) {
    return importPath;
  }

  // ============================================================
  // 2. ПОИСК ПО ИМЕНИ ФАЙЛА (basename)
  // ============================================================
  const fileName = importPath.split('/').pop() || '';
  const baseName = fileName.replace(/\.[^.]+$/, '');

  if (baseName) {
    for (const modulePath of Object.keys(graph)) {
      const moduleFileName = modulePath.split('/').pop() || '';
      const moduleBaseName = moduleFileName.replace(/\.[^.]+$/, '');

      // 2.1. Совпадение по basename
      if (moduleBaseName === baseName || moduleFileName === fileName) {
        return modulePath;
      }

      // 2.2. importPath заканчивается на /baseName (директория)
      if (importPath.endsWith('/' + baseName) || importPath === baseName) {
        const indexPath = `${importPath}/index.ts`;
        if (graph[indexPath]) {
          return indexPath;
        }
      }
    }
  }

  // ============================================================
  // 3. ОТНОСИТЕЛЬНЫЕ ПУТИ
  // ============================================================
  if (importPath.startsWith('.')) {
    const fromDir = fromModule.split('/').slice(0, -1).join('/');
    const resolved = `${fromDir}/${importPath}`;

    // Ищем с расширениями
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (graph[candidate]) {
        return candidate;
      }
    }

    // Ищем index-файлы
    for (const ext of extensions) {
      const candidate = `${resolved}/index${ext}`;
      if (graph[candidate]) {
        return candidate;
      }
    }
  }

  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  resolveImportPath,
  resolveImportPathOld,
};