// packages/ast-analyzer/src/reporters/json/graphs/module-graph.ts

import fs from 'fs';
import path from 'path';
import type { GraphData, EntitiesResult } from '../../../types.js';
import type { ModuleNode, ModuleEdge, ModuleGraph } from '../../modules/types.js';

// ============================================================
// ТИПЫ
// ============================================================

interface FileStats {
  size: number;
  lines: number;
}

type ModuleLanguage = 'javascript' | 'typescript' | 'vue' | 'jsx' | 'unknown';

// ============================================================
// ОСНОВНАЯ ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит граф модулей проекта.
 *
 * ════════════════════════════════════════════════════════════
 * НАЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 * Возвращает объект ModuleGraph с двумя массивами:
 *   - `nodes` — все модули проекта (файлы) с метаданными:
 *       id, name, path, type, level, metadata {size, lines, language, isEntry}
 *   - `edges` — все связи между модулями (imports):
 *       from, to, type ('import' | 'external'), specifiers[]
 *
 * ════════════════════════════════════════════════════════════
 * СХЕМА РАБОТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   1. collectAllModules(data)        → Set<string> всех модулей
 *   2. buildModuleNode(module, data)  → ModuleNode для каждого
 *   3. buildModuleEdges(data, entities) → ModuleEdge[] из графа
 *
 * ════════════════════════════════════════════════════════════
 * ОСОБЕННОСТИ
 * ════════════════════════════════════════════════════════════
 *
 * - Уровень (`level`) модуля: 0 для корневого, 1 для остальных
 *   (в текущей версии — упрощённая логика; для полноценной
 *   многоуровневой иерархии нужен BFS — можно добавить позже).
 *
 * - Размер и количество строк файла читаются с диска. Если файл
 *   не читается — size и lines остаются 0 (без падения).
 *
 * - Тип ребра (`type`) определяется эвристикой:
 *     • `to.startsWith('@') || to.includes('/')` → 'external'
 *     • иначе                                   → 'import'
 *
 * - `specifiers` заполняются из экспортируемых функций исходного
 *   модуля — это эвристика, полноценный резолвинг имён импортов
 *   делается в других модулях (`buildImportGraph`).
 *
 * @param data     — объект GraphData { rootKey, graph }
 * @param entities — EntitiesResult корневого файла (для specifiers)
 * @returns ModuleGraph { nodes, edges }
 */
export function buildModuleGraph(
  data: GraphData,
  entities: EntitiesResult
): ModuleGraph {
  // Шаг 1: Собираем все уникальные модули
  const allModules = collectAllModules(data);

  // Шаг 2: Строим узлы
  const nodes: ModuleNode[] = [];
  for (const modulePath of allModules) {
    nodes.push(buildModuleNode(modulePath, data));
  }

  // Шаг 3: Строим рёбра
  const edges = buildModuleEdges(data, entities);

  return { nodes, edges };
}

// ============================================================
// ШАГ 1: СБОР ВСЕХ МОДУЛЕЙ
// ============================================================

/**
 * Собирает множество всех модулей, которые встречаются в графе:
 *   - rootKey
 *   - все ключи graph
 *   - все значения (зависимости)
 *
 * Возвращает Set<string> — гарантирует уникальность.
 */
function collectAllModules(data: GraphData): Set<string> {
  const allModules = new Set<string>();

  // Корневой модуль
  allModules.add(data.rootKey);

  // Все модули и их зависимости
  for (const [key, deps] of Object.entries(data.graph)) {
    allModules.add(key);

    const depsArray = deps as string[];
    for (const dep of depsArray) {
      allModules.add(dep);
    }
  }

  return allModules;
}

// ============================================================
// ШАГ 2: ПОСТРОЕНИЕ УЗЛА МОДУЛЯ
// ============================================================

/**
 * Строит ModuleNode для одного модуля.
 *
 * Читает размер и количество строк файла с диска (безопасно —
 * при ошибке возвращает 0/0). Определяет язык по расширению.
 * Помечает корневой модуль как `isEntry: true`.
 */
function buildModuleNode(modulePath: string, data: GraphData): ModuleNode {
  const isEntry = modulePath === data.rootKey;
  const language = detectLanguage(modulePath);
  const { size, lines } = getFileStatsSafe(modulePath);

  return {
    id: modulePath,
    name: path.basename(modulePath),
    path: modulePath,
    type: modulePath.endsWith('.vue') ? 'vue' : 'module',
    level: isEntry ? 0 : 1,
    metadata: {
      size,
      lines,
      language,
      isEntry,
    },
  };
}

// ============================================================
// ШАГ 3: ПОСТРОЕНИЕ РЁБЕР МОДУЛЯ
// ============================================================

/**
 * Строит ModuleEdge[] из графа зависимостей.
 *
 * Для каждого ребра:
 *   - определяет тип (`import` | `external`)
 *   - заполняет `specifiers` (имена экспортируемых сущностей,
 *     которые могут быть импортированы)
 */
function buildModuleEdges(
  data: GraphData,
  entities: EntitiesResult
): ModuleEdge[] {
  const edges: ModuleEdge[] = [];

  for (const [from, deps] of Object.entries(data.graph)) {
    const depsArray = deps as string[];

    for (const to of depsArray) {
      const isExternal = isExternalTarget(to);
      const specifiers = extractSpecifiersFromEntity(to, entities);

      edges.push({
        from,
        to,
        type: isExternal ? 'external' : 'import',
        specifiers:
          specifiers.length > 0
            ? specifiers
            : [path.basename(to).replace(/\.[^.]+$/, '')],
      });
    }
  }

  return edges;
}

// ============================================================
// УТИЛИТЫ
// ============================================================

/**
 * Определяет, является ли целевой модуль внешним.
 *
 * Эвристика:
 *   - начинается с '@' → scoped-пакет (`@scope/pkg`)
 *   - содержит '/'     → вложенный путь (может быть и внутренним,
 *                        но в текущей версии считаем внешним)
 */
function isExternalTarget(target: string): boolean {
  return target.startsWith('@') || target.includes('/');
}

/**
 * Извлекает имена экспортируемых сущностей, которые могут
 * соответствовать целевому модулю.
 *
 * ВНИМАНИЕ: это упрощённая эвристика — она проверяет, содержит ли
 * путь `to` имя экспортируемой сущности. Полноценный резолвинг
 * делается в `buildImportGraph` (в compact-entity-reporter.ts).
 */
function extractSpecifiersFromEntity(
  to: string,
  entities: EntitiesResult
): string[] {
  const specifiers: string[] = [];

  for (const entity of entities.functions) {
    if (
      entity.isExported &&
      (to.includes(entity.name) || entity.name.includes(to))
    ) {
      specifiers.push(entity.name);
    }
  }

  return specifiers;
}

/**
 * Определяет язык программирования по расширению файла.
 */
function detectLanguage(modulePath: string): ModuleLanguage {
  if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) {
    return 'typescript';
  }
  if (modulePath.endsWith('.vue')) {
    return 'vue';
  }
  if (modulePath.endsWith('.jsx')) {
    return 'jsx';
  }
  if (
    modulePath.endsWith('.js') ||
    modulePath.endsWith('.mjs') ||
    modulePath.endsWith('.cjs')
  ) {
    return 'javascript';
  }
  return 'unknown';
}

/**
 * Безопасно читает размер и количество строк файла.
 *
 * Если файл не существует, не читается или является директорией —
 * возвращает { size: 0, lines: 0 } без выброса исключения.
 */
function getFileStatsSafe(modulePath: string): FileStats {
  try {
    const absPath = path.resolve(modulePath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return { size: 0, lines: 0 };
    }

    const content = fs.readFileSync(absPath, 'utf-8');
    return {
      size: content.length,
      lines: content.split('\n').length,
    };
  } catch {
    // Игнорируем ошибки: права доступа, ENOENT и т.д.
    return { size: 0, lines: 0 };
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default buildModuleGraph;