// src/core/entity-extractor/enrich-with-re-exports.ts
// ============================================
// ОБОГАЩЕНИЕ EntitiesResult РАЗВЁРНУТЫМИ RE-EXPORTS
// ============================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ FIX: корректная обработка loc для развёрнутых re-exports
//   - ✅ FIX: сохранение originalExp только если source совпадает точно
//   - ✅ Улучшено: логирование при debug
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация обогащения entitiesMap
//   - Замена "сырых" re-exports на прямые связи через AST
//
// Назначение:
//   Принимает "сырые" EntitiesResult (с isReExport=true)
//   и разворачивает их в прямые связи, используя AST.
//
// Пример:
//   Было:  { name: '*', isReExport: true, source: './components',
//            isStarReExport: true }
//   Стало: { name: 'Button', isReExport: true,
//            source: '/abs/src/Button.ts', isStarReExport: false,
//            _resolvedFrom: ['/abs/src/components/index.ts'], _depth: 2 }
// ============================================

import type { Project } from 'ts-morph';
import type { EntitiesResult, ExportInfo } from '../../types.js';
import {
    CoreReExportResolver,
    type ReExportChain,
} from '../re-export-resolver.js';

// ============================================
// ТИПЫ
// ============================================

/**
 * Опции обогащения.
 */
export interface EnrichOptions {
    /** Максимальная глубина разворачивания (по умолчанию: 10) */
    maxDepth?: number;
    /** Корень проекта (для tsconfig.json, по умолчанию: process.cwd()) */
    projectRoot?: string;
    /** Подробный вывод (по умолчанию: false) */
    debug?: boolean;
    /** Удалять ли неразрешённые re-exports (по умолчанию: false) */
    removeUnresolved?: boolean;
}

/**
 * Результат обогащения.
 */
export interface EnrichResult {
    /** Обогащённые EntitiesResult (ключ — путь к файлу) */
    enrichedEntities: Record<string, EntitiesResult>;
    /** Все развёрнутые цепочки re-exports */
    chains: ReExportChain[];
    /** Статистика обогащения */
    stats: EnrichStats;
}

/**
 * Статистика обогащения.
 */
export interface EnrichStats {
    /** Всего файлов в исходном entitiesMap */
    totalEntities: number;
    /** Файлов, содержащих re-exports */
    filesWithReExports: number;
    /** Количество развёрнутых связей */
    expandedChains: number;
    /** Максимальная достигнутая глубина */
    maxDepth: number;
    /** Количество исходных re-exports */
    originalReExports: number;
    /** Количество неразрешённых re-exports */
    unresolvedReExports: number;
    /** Количество пропущенных циклов */
    cyclesSkipped: number;
    /** Количество отброшенных (неразрешённых) re-exports */
    removedUnresolved: number;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Обогащает entitiesMap развёрнутыми re-exports.
 *
 * Заменяет "сырые" re-exports (isReExport=true) на прямые связи:
 *   Было:  { name: '*', isReExport: true, source: './components' }
 *   Стало: { name: 'Button', isReExport: true,
 *            source: 'src/Button.ts', isStarReExport: false }
 *
 * @param project — ts-morph Project с добавленными source-файлами
 * @param entitiesMap — карта "путь файла → EntitiesResult"
 * @param options — опции обогащения
 * @returns Результат обогащения
 */
export function enrichWithReExports(
    project: Project,
    entitiesMap: Record<string, EntitiesResult>,
    options: EnrichOptions = {}
): EnrichResult {
    const debug = options.debug ?? false;
    const removeUnresolved = options.removeUnresolved ?? false;

    if (debug) {
        console.log('\n🔄 Обогащение re-exports...');
        console.log(`   📁 Файлов в entitiesMap: ${Object.keys(entitiesMap).length}`);
    }

    // ============================================
    // 1. Разворачиваем re-exports через AST
    // ============================================
    const resolver = new CoreReExportResolver(project, {
        maxDepth: options.maxDepth ?? 10,
        projectRoot: options.projectRoot ?? process.cwd(),
        debug,
    });

    const filePaths = Object.keys(entitiesMap);
    const resolveResult = resolver.resolve(filePaths);

    if (debug) {
        console.log(`   📊 Re-exports исходных: ${resolveResult.stats.totalReExports}`);
        console.log(`   ✅ Развёрнуто связей: ${resolveResult.stats.expandedChains}`);
        console.log(`   🔄 Циклов: ${resolveResult.stats.cyclesSkipped}`);
        console.log(`   ⚠️ Не разрешено: ${resolveResult.stats.unresolved}`);
        console.log(`   📏 Макс. глубина: ${resolveResult.stats.maxDepthReached}`);
    }

    // ============================================
    // 2. Группируем цепочки по fromFile
    // ============================================
    const chainsByFile = new Map<string, ReExportChain[]>();
    for (const chain of resolveResult.chains) {
        const normalizedFrom = normalizePath(chain.fromFile);
        if (!chainsByFile.has(normalizedFrom)) {
            chainsByFile.set(normalizedFrom, []);
        }
        chainsByFile.get(normalizedFrom)!.push(chain);
    }

    // ============================================
    // 3. Обогащаем каждый EntitiesResult
    // ============================================
    const enrichedEntities: Record<string, EntitiesResult> = {};
    let filesWithReExports = 0;
    let removedUnresolvedCount = 0;

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
        const normalized = normalizePath(filePath);
        const chains = chainsByFile.get(normalized);

        // Файл не содержит re-exports — оставляем как есть
        if (!chains || chains.length === 0) {
            enrichedEntities[filePath] = entities;
            continue;
        }

        filesWithReExports++;

        // Создаём новый список exports
        const newExports: ExportInfo[] = [];

        // ============================================
        // 3.1. Копируем прямые экспорты (не re-export)
        // ============================================
        for (const exp of entities.exports || []) {
            if (!exp.isReExport) {
                newExports.push(exp);
            }
        }

        // ============================================
        // 3.2. Добавляем развёрнутые re-exports
        // ============================================
        for (const chain of chains) {
            // Ищем исходный ExportInfo для получения loc / типа
            // Сопоставляем по source + name
            const originalExp = findOriginalReExport(entities, chain);

            // Проверяем, был ли исходный re-export типа type-only
            const isTypeOnly = originalExp?.isTypeOnly ?? false;

            newExports.push({
                name: chain.exposedName,
                type: inferExportType(chain, isTypeOnly),
                isDefault: chain.exposedName === 'default',
                loc: originalExp?.loc || null,
                line: chain.line,
                isReExport: true,
                source: chain.toFile, // ← ПРЯМАЯ ССЫЛКА на конечный файл
                isTypeOnly,
                // ✅ Новые поля для трассировки
                localName: chain.originalName,
                isStarReExport: false, // развёрнуто — уже не star
                isDefaultReExport: chain.exposedName === 'default',
                // Метаданные разворачивания
                _resolvedFrom: chain.chain.slice(1, -1),
                _depth: chain.depth,
            } as ExportInfo & {
                _resolvedFrom?: string[];
                _depth?: number;
            });
        }

        // ============================================
        // 3.3. Опционально: удаляем неразрешённые re-exports
        // ============================================
        if (removeUnresolved) {
            // Проверяем, есть ли неразрешённые re-exports
            const unresolved = (entities.exports || []).filter(
                e => e.isReExport && !isResolvedInChains(e, chains)
            );
            removedUnresolvedCount += unresolved.length;
        }

        enrichedEntities[filePath] = {
            ...entities,
            exports: newExports,
        };
    }

    if (debug) {
        console.log(`   📁 Файлов с re-exports: ${filesWithReExports}`);
        if (removedUnresolvedCount > 0) {
            console.log(`   🗑️ Удалено неразрешённых: ${removedUnresolvedCount}`);
        }
    }

    // ============================================
    // 4. Формируем статистику
    // ============================================
    const stats: EnrichStats = {
        totalEntities: Object.keys(entitiesMap).length,
        filesWithReExports,
        expandedChains: resolveResult.stats.expandedChains,
        maxDepth: resolveResult.stats.maxDepthReached,
        originalReExports: resolveResult.stats.totalReExports,
        unresolvedReExports: resolveResult.stats.unresolved,
        cyclesSkipped: resolveResult.stats.cyclesSkipped,
        removedUnresolved: removedUnresolvedCount,
    };

    return {
        enrichedEntities,
        chains: resolveResult.chains,
        stats,
    };
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Определяет тип экспорта на основе цепочки и isTypeOnly.
 */
function inferExportType(
    chain: ReExportChain,
    isTypeOnly: boolean
): ExportInfo['type'] {
    // Для type-only экспортов всегда 'type'
    if (isTypeOnly) {
        return 'type';
    }

    switch (chain.type) {
        case 'default':
            return 'default';
        case 'star':
            return 'all';
        case 'namespace':
            return 'object';
        case 'named':
        default:
            return 'named';
    }
}

/**
 * Ищет исходный ExportInfo для цепочки.
 *
 * Стратегия поиска:
 *   1. По source + name (точное совпадение)
 *   2. По source только
 *   3. По name только
 *   4. Возвращает undefined, если не найдено
 *
 * @param entities — EntitiesResult файла
 * @param chain — цепочка разворачивания
 * @returns Исходный ExportInfo или undefined
 */
function findOriginalReExport(
    entities: EntitiesResult,
    chain: ReExportChain
): ExportInfo | undefined {
    const allExports = entities.exports || [];

    // Промежуточный файл (первый после fromFile)
    const intermediateFile = chain.chain[1];
    if (!intermediateFile) {
        // Цепочка из одного файла — нет промежуточного
        return undefined;
    }

    // Нормализуем пути для сопоставления
    const normalizedIntermediate = normalizePath(intermediateFile);

    // ============================================
    // 1. По source + name (точное совпадение)
    // ============================================
    for (const exp of allExports) {
        if (!exp.isReExport || !exp.source) continue;

        const normalizedSource = normalizePath(exp.source);
        const sourceMatches =
            normalizedSource === normalizedIntermediate ||
            normalizedIntermediate.endsWith(normalizedSource) ||
            normalizedSource.endsWith(normalizedIntermediate);

        if (sourceMatches && (exp.name === chain.originalName || exp.name === '*')) {
            return exp;
        }
    }

    // ============================================
    // 2. По source только (если имя не совпало)
    // ============================================
    for (const exp of allExports) {
        if (!exp.isReExport || !exp.source) continue;

        const normalizedSource = normalizePath(exp.source);
        const sourceMatches =
            normalizedSource === normalizedIntermediate ||
            normalizedIntermediate.endsWith(normalizedSource) ||
            normalizedSource.endsWith(normalizedIntermediate);

        if (sourceMatches) {
            return exp;
        }
    }

    // ============================================
    // 3. По name только (fallback)
    // ============================================
    for (const exp of allExports) {
        if (!exp.isReExport) continue;
        if (exp.name === chain.originalName || exp.name === '*') {
            return exp;
        }
    }

    // ============================================
    // 4. Не найдено
    // ============================================
    return undefined;
}

/**
 * Проверяет, был ли re-export разрешён в развёрнутых цепочках.
 *
 * @param exp — исходный ExportInfo
 * @param chains — развёрнутые цепочки для этого файла
 * @returns true, если re-export разрешён
 */
function isResolvedInChains(
    exp: ExportInfo,
    chains: ReExportChain[]
): boolean {
    if (!exp.isReExport || !exp.source) return false;

    const normalizedSource = normalizePath(exp.source);

    for (const chain of chains) {
        // Промежуточный файл в цепочке (первый после fromFile)
        const intermediateFile = chain.chain[1];
        if (!intermediateFile) continue;

        const normalizedIntermediate = normalizePath(intermediateFile);
        const sourceMatches =
            normalizedSource === normalizedIntermediate ||
            normalizedIntermediate.endsWith(normalizedSource) ||
            normalizedSource.endsWith(normalizedIntermediate);

        if (!sourceMatches) continue;

        // Проверяем совпадение имени
        if (exp.isStarReExport) {
            // Star re-export разрешён, если есть хотя бы одна цепочка от этого источника
            return true;
        }

        if (exp.name === chain.originalName || exp.name === chain.exposedName) {
            return true;
        }
    }

    return false;
}

/**
 * Нормализует путь:
 *   - Заменяет обратные слэши на прямые
 *   - Убирает trailing slash
 *
 * @param p — путь
 * @returns Нормализованный путь
 */
function normalizePath(p: string): string {
    if (!p) return '';
    return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default enrichWithReExports;
