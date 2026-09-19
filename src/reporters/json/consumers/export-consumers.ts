// packages/ast-analyzer/src/reporters/json/consumers/export-consumers.ts

import type { EntitiesResult } from '../../../types.js';
import { resolveImportPathOld } from '../utils/path-resolver.js';
import { findFunctionCallers } from '../importers/importers-collector.js';

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Запись о consumer (потребителе) экспорта.
 *
 * consumer — это модуль, который:
 *   - импортирует этот экспорт напрямую (type: 'import')
 *   - вызывает экспортированную функцию (type: 'call')
 *   - импортирует через star-реэкспорт (viaReExport задан)
 */
interface ConsumerEntry {
  /** Модуль-потребитель */
  module: string;
  /** Направление связи (всегда 'inward') */
  direction: 'inward';
  /** Тип связи: импорт или вызов */
  type: 'import' | 'call';
  /** Имя импортируемого/вызываемого экспорта */
  specifier: string;
  /** Локальное имя (если импорт с алиасом) */
  localName?: string;
  /** Строка вызова (только для type: 'call') */
  line?: number;
  /**
   * Модуль, через который прошёл star-реэкспорт.
   * Задан, если consumer импортирует не напрямую, а через
   * промежуточный модуль с `export * from`.
   */
  viaReExport?: string;
}

// ============================================================
// ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Вычисляет consumers для всех экспортов на основе графа зависимостей.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ТАКОЕ CONSUMER
 * ════════════════════════════════════════════════════════════
 *
 * Consumer — это модуль, который использует экспорт из другого модуля.
 * Например, если `src/index.ts` делает `export { foo } from './utils'`,
 * а `src/app.ts` делает `import { foo } from './index'`, то:
 *   - для экспорта `foo` модуля `utils` consumer = `app`
 *     (через `viaReExport = index`)
 *   - для экспорта `foo` модуля `index` consumer = `app` (напрямую)
 *
 * ════════════════════════════════════════════════════════════
 * ТРИ ЭТАПА АНАЛИЗА
 * ════════════════════════════════════════════════════════════
 *
 * 1. Анализ импортов:
 *    Если модуль A импортирует имя X из модуля B,
 *    то A становится consumer экспорта X модуля B.
 *
 * 2. Анализ вызовов функций:
 *    Если функция в модуле A вызывает экспортированную
 *    функцию из модуля B (в т.ч. через алиас), то A
 *    становится consumer экспорта этой функции.
 *
 * 3. Обработка star-реэкспортов:
 *    Если модуль A делает `export * from B`, то все импортёры
 *    A автоматически становятся consumers экспортов B
 *    (с пометкой `viaReExport = A`).
 *
 * ════════════════════════════════════════════════════════════
 * МУТАЦИЯ
 * ════════════════════════════════════════════════════════════
 *
 * Функция МУТИРУЕТ `exportsMap`, добавляя в каждый экспорт
 * поле `consumers: ConsumerEntry[]`. Вызывающий код должен
 * передать `exportsMap` по ссылке (не копию).
 *
 * @param graph        — граф зависимостей { modulePath → [deps] }
 * @param entitiesMap  — карта сущностей по модулям
 * @param exportsMap   — карта экспортов (мутируется)
 */
export function computeExportConsumers(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  exportsMap: Record<string, Record<string, any>>
): void {
  analyzeImportConsumers(graph, entitiesMap, exportsMap);
  analyzeCallConsumers(graph, entitiesMap, exportsMap);
  analyzeStarReExportConsumers(graph, entitiesMap, exportsMap);
}

// ============================================================
// ЭТАП 1: АНАЛИЗ ИМПОРТОВ
// ============================================================

/**
 * Для каждого импорта в каждом модуле:
 *   - резолвит путь источника
 *   - находит соответствующий экспорт в целевом модуле
 *   - добавляет модуль-импортёр в consumers этого экспорта
 *
 * Дедупликация: `(module, type: 'import', specifier)` уникален.
 */
function analyzeImportConsumers(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  exportsMap: Record<string, Record<string, any>>
): void {
  for (const [modulePath] of Object.entries(graph)) {
    const entities = entitiesMap[modulePath];
    if (!entities) continue;

    const imports = entities.imports || [];

    for (const imp of imports) {
      const source = imp.source;
      if (!source) continue;

      // Резолвим путь импорта до модуля в графе
      const resolvedModule = resolveImportPathOld(modulePath, source, graph);
      if (!resolvedModule) continue;

      const targetExports = exportsMap[resolvedModule];
      if (!targetExports) continue;

      // Обрабатываем каждый specifier в импорте
      for (const spec of imp.specifiers) {
        const specObj = typeof spec === 'string' ? { imported: spec, local: spec } : spec;

        const importedName = specObj.imported || specObj.local || '';
        if (!importedName) continue;

        const targetExport = targetExports[importedName];
        if (!targetExport) continue;

        addConsumer(targetExport, {
          module: modulePath,
          direction: 'inward',
          type: 'import',
          specifier: importedName,
          localName: specObj.local || specObj.imported,
        });
      }
    }
  }
}

// ============================================================
// ЭТАП 2: АНАЛИЗ ВЫЗОВОВ ФУНКЦИЙ
// ============================================================

/**
 * Для каждой экспортированной функции в каждом модуле:
 *   - находит все модули, которые её вызывают
 *   - добавляет их в consumers этого экспорта
 *
 * Учитывает алиасы через `getImportedName`.
 *
 * Дедупликация: `(module, type: 'call')` уникален.
 */
function analyzeCallConsumers(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  exportsMap: Record<string, Record<string, any>>
): void {
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    const targetExports = exportsMap[modulePath];
    if (!targetExports) continue;

    for (const func of entities.functions || []) {
      if (!func.isExported || !func.name) continue;

      const exportName = func.name;
      const targetExport = targetExports[exportName];
      if (!targetExport) continue;

      // Находим все модули, которые вызывают эту функцию
      const callers = findFunctionCallers(func.name, entitiesMap, graph);

      for (const caller of callers) {
        // Пропускаем self-вызовы (модуль сам себя вызывает)
        if (caller.module === modulePath) continue;

        addConsumer(targetExport, {
          module: caller.module,
          direction: 'inward',
          type: 'call',
          specifier: func.name,
          line: caller.line,
        });
      }
    }
  }
}

// ============================================================
// ЭТАП 3: ОБРАБОТКА STAR-РЕЭКСПОРТОВ
// ============================================================

/**
 * Для каждого модуля, который делает `export * from B`:
 *   - находим всех импортёров этого модуля (из graph)
 *   - для каждого импортёра и каждого экспорта B
 *     добавляем импортёра в consumers с пометкой viaReExport
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   src/index.ts:    export * from './utils';
 *   src/utils.ts:    export function foo() {}
 *   src/app.ts:      import { foo } from './index';
 *
 * В этом случае:
 *   - foo в utils имеет consumer = app (через viaReExport = index)
 *   - foo в index имеет consumer = app (напрямую, из этапа 1)
 *
 * Это позволяет понимать реальные зависимости при переименовании
 * или перемещении экспортов.
 */
function analyzeStarReExportConsumers(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  exportsMap: Record<string, Record<string, any>>
): void {
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    // Находим все star-реэкспорты в этом модуле
    const starReExports = (entities.exports || []).filter((exp: any) => {
      return exp.isStarReExport === true && exp.source;
    }) as any[];

    if (starReExports.length === 0) continue;

    // Для каждого star-реэкспорта обрабатываем целевой модуль
    for (const reExport of starReExports) {
      const targetModule = resolveImportPathOld(modulePath, reExport.source, graph);
      if (!targetModule) continue;

      const targetExports = exportsMap[targetModule];
      if (!targetExports) continue;

      // Находим всех импортёров текущего модуля
      const importers = graph[modulePath] || [];

      for (const importer of importers) {
        // Проверяем, что importer действительно импортирует
        // из текущего модуля (а не просто числится в graph)
        const importerEntities = entitiesMap[importer];
        if (!importerEntities) continue;

        const hasImport = (importerEntities.imports || []).some(imp => {
          const resolved = resolveImportPathOld(importer, imp.source, graph);
          return resolved === modulePath;
        });

        if (!hasImport) continue;

        // Добавляем importer как consumer для всех экспортов target модуля
        for (const exportName of Object.keys(targetExports)) {
          const targetExport = targetExports[exportName];
          if (!targetExport) continue;

          addConsumer(targetExport, {
            module: importer,
            direction: 'inward',
            type: 'import',
            specifier: exportName,
            viaReExport: modulePath,
          });
        }
      }
    }
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Добавляет consumer в экспорт, избегая дубликатов.
 *
 * Дедупликация:
 *   - Для type: 'import'  — ключ `(module, type, specifier, viaReExport)`
 *   - Для type: 'call'    — ключ `(module, type)`
 *
 * Это означает:
 *   - один модуль может импортировать один экспорт только один раз
 *   - один модуль может вызывать один экспорт только один раз
 *     (даже если вызовов несколько, consumer добавляется один)
 *   - через разные star-реэкспорты можно попасть один и тот же экспорт
 *     разными путями — это допустимо
 */
function addConsumer(targetExport: any, consumer: ConsumerEntry): void {
  if (!targetExport.consumers) {
    targetExport.consumers = [];
  }

  const isDuplicate = targetExport.consumers.some((existing: any) => {
    // Базовая проверка по модулю и типу
    if (existing.module !== consumer.module) return false;
    if (existing.type !== consumer.type) return false;

    // Для вызовов — дополнительная проверка не нужна,
    // одного consumer на модуль достаточно
    if (consumer.type === 'call') return true;

    // Для импортов — проверяем specifier и viaReExport
    if (existing.specifier !== consumer.specifier) return false;
    if (existing.viaReExport !== consumer.viaReExport) return false;

    return true;
  });

  if (!isDuplicate) {
    targetExport.consumers.push(consumer);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default computeExportConsumers;
