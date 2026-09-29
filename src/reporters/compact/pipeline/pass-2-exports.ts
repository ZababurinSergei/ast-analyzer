// src/reporters/compact/pipeline/pass-2-exports.ts
// ============================================
// ПРОХОД 2: ЭКСПОРТЫ + РЕЭКСПОРТЫ + ИМПОРТЫ
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика второго прохода вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: resolveToFileId, getImportTypeFromSpecifierType
//     из ../entities/imports.ts (единый источник).
//   - ✅ 100% поведение сохранено.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Второй проход pipeline'а. Отвечает за:
//
//     1. Экспорты       — с типами named/default/type
//     2. Реэкспорты     — export { X } from './foo'
//                        export * from './foo'
//                        export { default } from './foo'
//     3. Импорты        — с резолвингом toFileId
//                        (локальный/external/unresolved)
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. Экспорты ищут functionId через ctx.functionMap.
//
//      Если functionId не найден — экспорт ПРОПУСКАЕТСЯ.
//      Это совпадает с оригиналом: экспорт без функции
//      бесполезен для графа связей.
//
//   2. Экспорт с isReExport === true попадает в ctx.reExports,
//      а НЕ в ctx.exports.
//
//      Тип реэкспорта:
//        • isStarReExport      → 'all'
//        • isDefaultReExport   → 'default'
//        • иначе               → 'named'
//
//   3. Обычный экспорт: тип определяется через
//        • exp.isDefault                    → 'default'
//        • exp.isTypeOnly/interface/type    → 'type'
//        • иначе                            → 'named'
//
//   4. Импорты имеют СЛОЖНУЮ логику определения toFileId:
//
//      Приоритет:
//        a. Если toFileIdFromAst.startsWith('external:')  → используем как есть
//        b. Если toFileIdFromAst.startsWith('unresolved:') → используем как есть
//        c. Иначе — resolveToFileId(imp.source, filePath, ...)
//        d. Если не удалось — toFileIdFromAst || `unresolved:${imp.source}`
//
//      Затем нормализация: если результат не fN/external:/unresolved: —
//      заменяем на `unresolved:${imp.source}`.
//
//   5. isExternal — ПРОИЗВОДНОЕ от resolvedToFileId:
//        • startsWith('external:') → true
//        • иначе                   → false
//
//      Это инвариант I4/I5 из verify-roundtrip.ts.
//
//   6. packageName вычисляется для внешних импортов:
//        • '@scope/pkg'  → '@scope/pkg'
//        • 'lodash'      → 'lodash'
//        • 'lodash/get'  → 'lodash'
//
//   7. specifiersStructured (приоритетный путь) vs specifiers
//      (legacy-путь через строки/объекты):
//
//      Если есть specifiersStructured — используем его.
//      Иначе — парсим specifiers как строки/объекты.
//
//   8. isReExport / isStarReExport пробрасываются из imp.
//
//      Это важно для графа: `export { X } from './foo'` создаёт
//      ребро в imports[] с флагом isReExport = true.
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ОБХОДА
// ════════════════════════════════════════════════════════════
//
//   Идём по ctx.sortedFilePaths. Это гарантирует, что
//   exports[]/imports[]/reExports[] идут в одном порядке
//   между прогонами.
//
// ════════════════════════════════════════════════════════════
// СЧЁТЧИК emptyNameFix
// ════════════════════════════════════════════════════════════
//
//   Если у импорта нет ни importedName, ни localName —
//   мы используем fallback (basename источника без расширения).
//   Каждый такой случай увеличивает counters.emptyNameFix.
//
//   В конце прохода, если emptyNameFix > 0 — выводим
//   диагностику в verbose-режиме.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   pass2Exports(ctx);
//
//   ctx.exports   → [{ id: 'e1', exportName: 'foo', ... }]
//   ctx.reExports → [{ id: 're1', exportName: '*', ... }]
//   ctx.imports   → [{ id: 'i1', toFileId: 'f2', ... }]
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts             — CollectContext + getRelativePath
//   • ./collect-full-json.ts   — вызывает этот проход третьим
//   • ../entities/imports.ts   — resolveToFileId + getImportTypeFromSpecifierType
//   • ../codec/codec-types.ts  — ExportData, ReExportData, ImportData
// ============================================

import path from 'path';
import type { ExportData, ImportData, ReExportData } from '../../codec/codec-types.js';
import { resolveToFileId, getImportTypeFromSpecifierType } from '../entities/imports.js';
import type { CollectContext } from './context.js';
import { getRelativePath } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 2: экспорты, реэкспорты, импорты.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого filePath из ctx.sortedFilePaths:
 *
 *     1. Получить entities, module, file
 *     2. Обработать экспорты:
 *        2.1. Если isReExport → добавить в ctx.reExports
 *        2.2. Иначе → добавить в ctx.exports
 *     3. Обработать импорты:
 *        3.1. Определить resolvedToFileId (приоритет: AST → resolve)
 *        3.2. Определить isExternal (производное от toFileId)
 *        3.3. Вычислить packageName (для внешних)
 *        3.4. Обработать specifiersStructured (если есть)
 *        3.5. Иначе — обработать specifiers (legacy)
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.exports, ctx.reExports, ctx.imports,
 *   ctx.counters.{export, reExport, import, emptyNameFix}
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass2Exports(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    // ────────────────────────────────────────────────────────────
    // Обход всех файлов в стабильном порядке
    // ────────────────────────────────────────────────────────────
    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        const relativePath = getRelativePath(ctx, filePath);
        const dirName = path.basename(path.dirname(relativePath)) || 'root';

        const module = ctx.moduleMap.get(dirName);
        const file = ctx.fileMap.get(relativePath);

        // Если модуль или файл не найдены — пропускаем.
        // Такое возможно, если pass1 не обработал файл (например,
        // entities === null). В этом случае экспорт/импорт бесполезен.
        if (!module || !file) continue;

        // ════════════════════════════════════════════════════════
        // 1. ЭКСПОРТЫ и РЕЭКСПОРТЫ
        // ════════════════════════════════════════════════════════
        const exportsList = entities.exports || [];

        for (const exp of exportsList) {
            if (!exp || !exp.name) continue;

            // ── Резолвинг functionId через functionMap ──
            //
            // Если функции с таким именем нет — экспорт бесполезен
            // для графа связей (нет цели). Пропускаем.
            //
            // ⚠️ Берём [0] — если несколько функций с одинаковым
            //    именем, берём первую. Это совпадает с оригиналом.
            const funcDataArray = ctx.functionMap.get(exp.name);
            const funcData = funcDataArray && funcDataArray.length > 0 ? funcDataArray[0] : undefined;

            // ── Метаданные экспорта ──
            const expLine = exp.loc?.start?.line ?? exp.line ?? 0;
            const localName = exp.localName ?? exp.name;
            const isTypeOnly = exp.isTypeOnly ?? false;
            const isStarReExport = exp.isStarReExport ?? false;
            const isDefaultReExport = exp.isDefaultReExport ?? false;

            // ────────────────────────────────────────────────────────
            // 1.1. РЕЭКСПОРТ (isReExport === true)
            // ────────────────────────────────────────────────────────
            //
            // Пример: export { X } from './foo'
            //         export * from './foo'
            //         export { default } from './foo'
            //
            // Тип:
            //   • isStarReExport    → 'all'
            //   • isDefaultReExport → 'default'
            //   • иначе             → 'named'
            // ────────────────────────────────────────────────────────
            if (exp.isReExport && exp.source) {
                if (!funcData) continue;

                counters.reExport++;

                let reType: 'named' | 'default' | 'all' = 'named';
                if (isStarReExport) reType = 'all';
                else if (isDefaultReExport || exp.isDefault) reType = 'default';

                ctx.reExports.push({
                    id: `re${counters.reExport}`,
                    moduleId: module.id,
                    functionId: funcData.id,
                    source: exp.source,
                    exportName: exp.name,
                    line: expLine,
                    type: reType,
                    isDefault: exp.isDefault || isDefaultReExport,
                    isTypeOnly,
                    isStarReExport,
                } as ReExportData);

                continue;
            }

            // ────────────────────────────────────────────────────────
            // 1.2. ОБЫЧНЫЙ ЭКСПОРТ
            // ────────────────────────────────────────────────────────
            //
            // Пример: export function foo() {}
            //         export const FOO = ...
            //         export default function foo() {}
            //         export interface Props {}
            //
            // Тип:
            //   • exp.isDefault                  → 'default'
            //   • isTypeOnly || interface/type   → 'type'
            //   • иначе                          → 'named'
            // ────────────────────────────────────────────────────────
            if (!funcData) continue;

            counters.export++;

            let exportType: 'named' | 'default' | 'type' = 'named';
            if (exp.isDefault) exportType = 'default';
            else if (isTypeOnly || exp.type === 'interface' || exp.type === 'type') {
                exportType = 'type';
            }

            ctx.exports.push({
                id: `e${counters.export}`,
                moduleId: module.id,
                fileId: file.id,
                functionId: funcData.id,
                exportName: exp.name,
                localName,
                line: expLine,
                type: exportType,
                isDefault: exp.isDefault || false,
                isTypeOnly,
                isReExport: false,
                isStarReExport: false,
                isDefaultReExport: false,
                source: undefined,
            } as ExportData);
        }

        // ════════════════════════════════════════════════════════
        // 2. ИМПОРТЫ
        // ════════════════════════════════════════════════════════
        const importsList = entities.imports || [];

        for (const imp of importsList) {
            if (!imp || !imp.source) continue;

            // ── Метаданные импорта ──
            const specifiersStructured = (imp as any).specifiersStructured || [];
            const specifiers = imp.specifiers || [];
            const isReExport = (imp as any).isReExport === true;
            const isStarReExport = (imp as any).isStarReExport === true;

            const toFileIdFromAst = (imp as any).toFileId as string | undefined;

            // ────────────────────────────────────────────────────────
            // 2.1. РЕЗОЛВИНГ toFileId
            // ────────────────────────────────────────────────────────
            //
            // Приоритет:
            //   a. 'external:...'   → используем как есть
            //   b. 'unresolved:...' → используем как есть
            //   c. resolveToFileId() — из AST-parser
            //   d. toFileIdFromAst || `unresolved:${imp.source}`
            //
            // ⚠️ ПОЧЕМУ приоритет a/b: если AST-parser уже пометил
            //    импорт как external/unresolved, повторный резолвинг
            //    бессмысленен.
            // ────────────────────────────────────────────────────────
            let resolvedToFileId: string | null = null;

            if (
                toFileIdFromAst?.startsWith('external:') ||
                toFileIdFromAst?.startsWith('unresolved:')
            ) {
                resolvedToFileId = toFileIdFromAst;
            } else {
                resolvedToFileId = resolveToFileId(
                    imp.source,
                    filePath,
                    ctx.sourceToFileIdMap,
                    ctx.fileMap
                );
                if (!resolvedToFileId) {
                    resolvedToFileId = toFileIdFromAst || `unresolved:${imp.source}`;
                }
            }

            // ────────────────────────────────────────────────────────
            // 2.2. isExternal — ПРОИЗВОДНОЕ от toFileId
            // ────────────────────────────────────────────────────────
            //
            // ⚠️ ИНВАРИАНТ I4/I5 (verify-roundtrip.ts):
            //   isExternal === true  ⇔  toFileId.startsWith('external:')
            //
            //   НИКОГДА не устанавливаем isExternal независимо от
            //   toFileId. Только через startsWith.
            // ────────────────────────────────────────────────────────
            const isExternal = resolvedToFileId?.startsWith('external:') === true;

            // ────────────────────────────────────────────────────────
            // 2.3. packageName (для внешних)
            // ────────────────────────────────────────────────────────
            //
            // Пример:
            //   external:@scope/pkg    → '@scope/pkg'
            //   external:lodash        → 'lodash'
            //   external:lodash/get    → 'lodash'
            //
            // ⚠️ Fallback на imp.packageName — если по какой-то причине
            //    toFileId не содержит package (редкий случай).
            // ────────────────────────────────────────────────────────
            let packageName: string | undefined;
            if (isExternal && resolvedToFileId) {
                const pkgPart = resolvedToFileId.slice('external:'.length);
                packageName = pkgPart || undefined;
            } else if (isExternal) {
                packageName = (imp as any).packageName;
            }

            // ────────────────────────────────────────────────────────
            // 2.4. Нормализация: если toFileId не fN/external/unresolved
            // ────────────────────────────────────────────────────────
            //
            // Если resolveToFileId вернул что-то странное (например,
            // относительный путь без fN-префикса) — заменяем на
            // 'unresolved:source'.
            //
            // ⚠️ Это гарантирует, что все toFileId в imports[]
            //    имеют вид: fN, external:X, unresolved:X, null.
            //    Проверяется в checkTfIndices (verify-consistency).
            // ────────────────────────────────────────────────────────
            if (
                resolvedToFileId &&
                !/^f\d+$/.test(resolvedToFileId) &&
                !resolvedToFileId.startsWith('external:') &&
                !resolvedToFileId.startsWith('unresolved:')
            ) {
                resolvedToFileId = `unresolved:${imp.source}`;
            }

            // Если null и не external — тоже помечаем как unresolved.
            if (resolvedToFileId === null && !isExternal) {
                resolvedToFileId = `unresolved:${imp.source}`;
            }

            const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

            // ────────────────────────────────────────────────────────
            // 2.5. Обработка specifiersStructured (приоритетный путь)
            // ────────────────────────────────────────────────────────
            //
            // Это современный путь: AST-parser отдаёт структурированные
            // specifiers с полями { imported, local, type }.
            // ────────────────────────────────────────────────────────
            if (specifiersStructured.length > 0) {
                for (const spec of specifiersStructured) {
                    let importedName = spec.imported || '';
                    let localName = spec.local || '';

                    // ── Fallback для пустых имён ──
                    if (!importedName && !localName) {
                        if (
                            spec.type === 'ExportAllSpecifier' ||
                            spec.type === 'ImportNamespaceSpecifier'
                        ) {
                            importedName = '*';
                            localName = '*';
                        } else if (spec.type === 'ImportDefaultSpecifier') {
                            importedName = 'default';
                            localName = path.basename(imp.source).replace(/\.[^.]+$/, '');
                        } else {
                            const fallbackName = path.basename(imp.source).replace(/\.[^.]+$/, '');
                            importedName = fallbackName;
                            localName = fallbackName;
                        }
                        counters.emptyNameFix++;
                    } else if (!importedName) {
                        importedName = localName;
                    } else if (!localName) {
                        localName = importedName;
                    }

                    counters.import++;

                    // ── Определение type ──
                    const baseType = getImportTypeFromSpecifierType(spec.type);

                    const importData: ImportData = {
                        id: `i${counters.import}`,
                        fromFileId: file.id,
                        toFileId: resolvedToFileId,
                        source: imp.source,
                        importedName,
                        localName,
                        line: impLine,
                        type: baseType,
                        isDefault: spec.type === 'ImportDefaultSpecifier',
                        isNamespace:
                            spec.type === 'ImportNamespaceSpecifier' ||
                            spec.type === 'ExportAllSpecifier',
                        isTypeOnly: imp.isTypeOnly || false,
                        isExternal,
                        packageName,
                    };

                    // ── Проброс isReExport/isStarReExport ──
                    if (isReExport) {
                        importData.isReExport = true;
                        if (isStarReExport) importData.isStarReExport = true;
                    }

                    ctx.imports.push(importData);
                }
            }
                // ────────────────────────────────────────────────────────
                // 2.6. Обработка specifiers (legacy-путь)
                // ────────────────────────────────────────────────────────
                //
                // Если specifiersStructured пуст — парсим specifiers
                // как массив строк/объектов. Поддерживаем оба формата.
            // ────────────────────────────────────────────────────────
            else if (Array.isArray(specifiers) && specifiers.length > 0) {
                for (const spec of specifiers as unknown[]) {
                    let importedName = '';
                    let localName = '';
                    let importType: 'named' | 'default' | 'namespace' = 'named';
                    let isDefault = false;
                    let isNamespace = false;

                    // ── Формат 1: строка "a as b" или "a" ──
                    if (typeof spec === 'string') {
                        const specStr = spec as string;
                        const match = specStr.match(/^(.+?)\s+as\s+(.+)$/);
                        if (match) {
                            importedName = match[1] || '';
                            localName = match[2] || '';
                        } else {
                            importedName = specStr.trim();
                            localName = specStr.trim();
                        }

                        // Специальные случаи
                        if (importedName === 'default') {
                            importType = 'default';
                            isDefault = true;
                        } else if (importedName === '*') {
                            importType = 'namespace';
                            isNamespace = true;
                        }
                    }
                    // ── Формат 2: объект { imported, local, type } ──
                    else if (spec && typeof spec === 'object') {
                        const specObj = spec as {
                            imported?: string;
                            local?: string;
                            type?: string;
                        };
                        importedName = specObj.imported || specObj.local || '';
                        localName = specObj.local || specObj.imported || '';

                        if (specObj.type === 'ImportDefaultSpecifier') {
                            importType = 'default';
                            isDefault = true;
                        } else if (specObj.type === 'ImportNamespaceSpecifier') {
                            importType = 'namespace';
                            isNamespace = true;
                        } else if (specObj.type === 'ExportAllSpecifier') {
                            importType = 'namespace';
                            isNamespace = true;
                        }
                    }

                    // ── Fallback для пустых имён ──
                    if (!importedName && !localName) {
                        if (isReExport) {
                            importedName = '*';
                            localName = '*';
                            importType = 'namespace';
                            isNamespace = true;
                        } else {
                            const fallbackName = path.basename(imp.source).replace(/\.[^.]+$/, '');
                            importedName = fallbackName;
                            localName = fallbackName;
                        }
                        counters.emptyNameFix++;
                    } else if (!importedName) {
                        importedName = localName;
                    } else if (!localName) {
                        localName = importedName;
                    }

                    counters.import++;

                    const importData: ImportData = {
                        id: `i${counters.import}`,
                        fromFileId: file.id,
                        toFileId: resolvedToFileId,
                        source: imp.source,
                        importedName,
                        localName,
                        line: impLine,
                        type: importType,
                        isDefault,
                        isNamespace,
                        isTypeOnly: imp.isTypeOnly || false,
                        isExternal,
                        packageName,
                    };

                    // ── Проброс isReExport/isStarReExport ──
                    if (isReExport) {
                        importData.isReExport = true;
                        if (isStarReExport) importData.isStarReExport = true;
                    }

                    ctx.imports.push(importData);
                }
            }
                // ────────────────────────────────────────────────────────
                // 2.7. Fallback: только isReExport (без specifiers)
                // ────────────────────────────────────────────────────────
                //
                // Случай: `export * from './foo'` без specifiers.
                // Создаём ОДНУ запись в imports[] с importedName = '*'.
                //
                // ⚠️ Проверка на дубликаты: если такой же isReExport уже
                //    есть для этого файла и source — пропускаем.
            // ────────────────────────────────────────────────────────
            else {
                if (isReExport) {
                    const alreadyExists = ctx.imports.some(
                        existing =>
                            existing.fromFileId === file.id &&
                            existing.source === imp.source &&
                            existing.isReExport === true
                    );

                    if (alreadyExists) continue;

                    counters.import++;
                    counters.emptyNameFix++;

                    const importData: ImportData = {
                        id: `i${counters.import}`,
                        fromFileId: file.id,
                        toFileId: resolvedToFileId,
                        source: imp.source,
                        importedName: '*',
                        localName: '*',
                        line: impLine,
                        type: 'namespace',
                        isDefault: false,
                        isNamespace: true,
                        isTypeOnly: imp.isTypeOnly || false,
                        isExternal,
                        packageName,
                        isReExport: true,
                    };

                    if (isStarReExport) {
                        importData.isStarReExport = true;
                    }

                    ctx.imports.push(importData);
                }
            }
        }
    }

    // ────────────────────────────────────────────────────────────
    // Verbose-логирование
    // ────────────────────────────────────────────────────────────
    if (ctx.verbose) {
        console.log(
            `   ✅ Второй проход: ${ctx.exports.length} экспортов, ` +
            `${ctx.reExports.length} реэкспортов, ` +
            `${ctx.imports.length} импортов`
        );

        if (counters.emptyNameFix > 0) {
            console.log(`   🔧 Исправлено пустых имён импортов: ${counters.emptyNameFix}`);
        }
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass2Exports;
