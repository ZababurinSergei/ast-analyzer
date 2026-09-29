// src/reporters/compact/calls/compact-id-map.ts
// ============================================================
// КАРТА COMPACT ID → GLOBAL FN ID
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Строит Map<func.id, 'fn42'> для проброса lexicalLinks
// из compact-формата в global-формат.
//
// ════════════════════════════════════════════════════════════
// ПРОБЛЕМА, КОТОРУЮ РЕШАЕТ ФУНКЦИЯ
// ════════════════════════════════════════════════════════════
//
//   В EntitiesResult.lexicalLinks (из entity-extractor) поля
//   parentFunctionId / childFunctionId хранятся в COMPACT
//   формате: func.id, который сгенерирован в
//   `idManager.generateCompactId()` и выглядит как:
//     'f142_704'    (f{индекс}_{строка})
//
//   В FullJSON.functions[].id используется GLOBAL формат:
//     'fn42'        (fn{счётчик})
//
//   В FullJSON.lexicalLinks[].parentFunctionId/childFunctionId
//   должны быть GLOBAL ID (fn*), потому что:
//     • Codec.encode(full) сохраняет их в lx.p / lx.c
//     • Codec.decode(compact) ожидает их как индексы в functions[]
//
//   Значит, при сборе lexicalLinks в pass-4-extended.ts нам
//   нужно КОНВЕРТИРОВАТЬ compact id → global id.
//
//   Эта функция строит такую карту.
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   Для каждого файла из entitiesMap:
//     1. Резолвим относительный путь от projectRoot.
//     2. Находим FileData по этому пути в fileMap.
//     3. Для каждой функции из entities.functions:
//        a. Ищем соответствующую FunctionData в functions[]:
//             • fileId === file.id
//             • line === func.line (0, если нет)
//             • name === func.name
//        b. Если нашли — map.set(func.id, globalFn.id)
//
//   func.id — это compact id (f142_704).
//   globalFn.id — это global id (fn42).
//
// ════════════════════════════════════════════════════════════
// СЛОЖНОСТЬ
// ════════════════════════════════════════════════════════════
//
//   O(N * M), где:
//     N = количество файлов
//     M = количество функций в файле
//
//   Внутри — functions.find() по 3 полям. Для типичных проектов
//   (< 10 000 функций) это ~1 мс.
//
//   Если проекту нужно быстрее — можно построить индекс
//   Map<`${fileId}:${line}:${name}`, FunctionData> один раз
//   и использовать его.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   entitiesMap = {
//     '/abs/src/App.vue': {
//       functions: [
//         { id: 'f18_10', name: 'handleClick', line: 10 },
//         { id: 'f18_20', name: 'handleSave',  line: 20 },
//       ],
//     },
//   }
//
//   functions = [
//     { id: 'fn42', name: 'handleClick', fileId: 'f18', line: 10 },
//     { id: 'fn43', name: 'handleSave',  fileId: 'f18', line: 20 },
//   ]
//
//   fileMap = Map { 'src/App.vue' => { id: 'f18', ... } }
//
//   buildCompactIdToGlobalFnIdMap(entitiesMap, functions, fileMap, projectRoot)
//   // → Map {
//   //     'f18_10' => 'fn42',
//   //     'f18_20' => 'fn43',
//   //   }
//
//   Это позволяет в pass-4-extended.ts делать:
//     const parentGlobalId = map.get(link.parentFunctionId) ?? null;
//     const childGlobalId  = map.get(link.childFunctionId);
// ============================================================

import path from 'path';
import type { EntitiesResult } from '../../../types.js';
import type { FunctionData, FileData } from '../../codec/codec-types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит карту compactId → globalFnId.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   entitiesMap  — { filePath → EntitiesResult }
 *   functions    — FunctionData[] (уже собранные в pass-1)
 *   fileMap      — Map<relativePath, FileData>
 *   projectRoot  — корень проекта (для резолва путей)
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Map<string, string> — func.id (compact) → FunctionData.id (global).
 *
 *   Функции, для которых не найдено соответствие в functions[],
 *   НЕ попадают в карту. Это означает, что их lexicalLinks
 *   будут отфильтрованы в pass-4-extended.ts:
 *     `if (!childGlobalId) continue;`
 *
 * @param entitiesMap — карта сущностей
 * @param functions   — глобальный массив FunctionData
 * @param fileMap     — карта путей файлов
 * @param projectRoot — корень проекта
 * @returns Map<compactId, globalFnId>
 */
export function buildCompactIdToGlobalFnIdMap(
    entitiesMap: Record<string, EntitiesResult>,
    functions: FunctionData[],
    fileMap: Map<string, FileData>,
    projectRoot: string
): Map<string, string> {
    const map = new Map<string, string>();

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
        if (!entities) continue;

        // 1. Резолвим относительный путь от projectRoot
        const absolutePath = path.resolve(filePath);
        const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

        // 2. Находим FileData
        const file = fileMap.get(relativePath);
        if (!file) continue;

        // 3. Проходим по функциям
        const funcs = entities.functions || [];
        for (const func of funcs) {
            // Пропускаем функции без id (не должно быть в норме)
            if (!func || !func.id) continue;

            // 4. Ищем соответствующую FunctionData по 3 полям
            const globalFn = functions.find(
                f =>
                    f.fileId === file.id &&
                    f.line === (func.line || 0) &&
                    f.name === func.name
            );

            // 5. Если нашли — сохраняем маппинг
            if (globalFn) {
                map.set(func.id, globalFn.id);
            }
        }
    }

    return map;
}
