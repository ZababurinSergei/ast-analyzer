// src/reporters/compact/pipeline/pass-1-modules.ts
// ============================================
// ПРОХОД 1: МОДУЛИ + ФАЙЛЫ + ФУНКЦИИ + КЛАССЫ + КОНСТАНТЫ
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика первого прохода вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ 100% поведение сохранено (порядок, счётчики, sourceToFileIdMap).
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Первый проход pipeline'а. Отвечает за:
//
//     1. Модули     — по имени директории
//     2. Файлы      — по относительному пути от projectRoot
//     3. Функции    — с parentFunctionId и vueKind
//     4. Классы
//     5. Константы  — с фильтрацией valuesMode
//
//   Также заполняет индексы, которые используют последующие
//   проходы:
//     • moduleMap         — dirName → ModuleData
//     • fileMap           — relativePath → FileData
//     • functionMap       — funcName → FunctionData[]
//     • sourceToFileIdMap — все ключи → fileId
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. sourceToFileIdMap заполняется 9 ключами на файл:
//        • absolutePath
//        • normalizedAbsolutePath (с прямыми слэшами)
//        • relativePath
//        • normalizedRelativePath
//        • basename
//        • basename без расширения
//        • relativePath без расширения
//        • исходный filePath (как пришёл в entitiesMap)
//        • normalizedPath
//
//      Это нужно для того, чтобы resolveToFileId (в pass2)
//      мог найти файл по любому формату пути.
//
//   2. parentFunctionId резолвится через локальную карту
//      localCompactIdToGlobalFnId (пробрасывается из v15.1.0).
//
//      ПРИЧИНА: func.id (из entity-extractor) — это compact ID
//      (типа 'f1_42' или 'func_abc_foo_10'), а в FullJSON ID
//      должен быть 'fn1', 'fn2', ...
//
//      Поэтому мы строим карту "compact ID → global fnN" через
//      previewCounter и потом резолвим parentFunctionId.
//
//   3. vueKind заполняется значением 'function' по умолчанию,
//      если в func.vueKind ничего нет. Это нужно для
//      симметрии с compact.fns.vk (RLE 0..6).
//
//   4. isEventHandler / isNested / isSelf пробрасываются
//      только если === true (не пишем false — экономия места).
//
//   5. Константы фильтруются через isValueKept(cn.value, valuesMode).
//      В режиме 'relations' длинные строки/объекты отбрасываются.
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ОБХОДА
// ════════════════════════════════════════════════════════════
//
//   Идём по ctx.sortedFilePaths (отсортированные ключи entitiesMap).
//   Это ГАРАНТИРУЕТ стабильный порядок модулей/файлов/функций
//   между прогонами — критично для round-trip (L4, RE, ENC).
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   const ctx = createCollectContext(...);
//   pass1Modules(ctx);
//
//   ctx.modules   → [{ id: 'm1', name: 'src', ... }]
//   ctx.files     → [{ id: 'f1', path: 'src/utils.ts', ... }]
//   ctx.functions → [{ id: 'fn1', name: 'foo', ... }]
//   ctx.classes   → [{ id: 'cls1', name: 'MyClass', ... }]
//   ctx.constants → [{ id: 'cn1', name: 'CONFIG', ... }]
//   ctx.moduleMap     → Map<'src', ModuleData>
//   ctx.fileMap       → Map<'src/utils.ts', FileData>
//   ctx.functionMap   → Map<'foo', [FunctionData]>
//   ctx.sourceToFileIdMap → Map<'/abs/src/utils.ts', 'f1'>
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts          — CollectContext + getRelativePath
//   • ./collect-full-json.ts — вызывает этот проход первым
//   • ../codec/codec-types.ts — FunctionData, ClassData, ...
//   • ../codec/values-filter.ts — isValueKept
// ============================================

import path from 'path';
import type {
    ClassData,
    ConstantData,
    FunctionData,
    VueKind,
} from '../../codec/codec-types.js';
import { isValueKept } from '../../codec/values-filter.js';
import type { CollectContext } from './context.js';
import { getRelativePath } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 1: модули, файлы, функции, классы, константы.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого filePath из ctx.sortedFilePaths:
 *
 *     1. Получить entities из ctx.entitiesMap
 *     2. Вычислить relativePath через getRelativePath
 *     3. Определить/создать модуль (по dirName)
 *     4. Определить/создать файл (по relativePath)
 *     5. Заполнить sourceToFileIdMap (9 ключей)
 *     6. Обработать функции
 *        6.1. Построить localCompactIdToGlobalFnId (preview)
 *        6.2. Для каждой функции:
 *              - увеличить counters.function
 *              - резолвить parentFunctionId
 *              - определить vueKind
 *              - создать FunctionData
 *              - добавить в ctx.functions и ctx.functionMap
 *     7. Обработать классы
 *     8. Обработать константы (с isValueKept)
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.modules, ctx.files, ctx.functions,
 *   ctx.classes, ctx.constants,
 *   ctx.moduleMap, ctx.fileMap, ctx.functionMap,
 *   ctx.sourceToFileIdMap,
 *   ctx.counters.{module, file, function, class, constant}
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass1Modules(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    // ────────────────────────────────────────────────────────────
    // Обход всех файлов в стабильном порядке
    // ────────────────────────────────────────────────────────────
    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        // Абсолютный путь — для sourceToFileIdMap
        const absolutePath = path.resolve(filePath);

        // Относительный путь от projectRoot — для FileData.path
        const relativePath = getRelativePath(ctx, filePath);

        // ────────────────────────────────────────────────────────
        // 1. МОДУЛЬ (по имени директории)
        // ────────────────────────────────────────────────────────
        //
        // dirName = basename(dirname(relativePath)) || 'root'
        //
        // Пример:
        //   relativePath = 'src/utils/helpers.ts'
        //   dirName      = 'utils'
        //
        // Если модуль уже есть в moduleMap — переиспользуем.
        // Иначе — создаём с новым id (m1, m2, ...).
        // ────────────────────────────────────────────────────────
        const dirName = path.basename(path.dirname(relativePath)) || 'root';
        let module = ctx.moduleMap.get(dirName);

        if (!module) {
            counters.module++;
            module = {
                id: `m${counters.module}`,
                name: dirName,
                path: dirName,
                fileIds: [],
            };
            ctx.moduleMap.set(dirName, module);
            ctx.modules.push(module);
        }

        // ────────────────────────────────────────────────────────
        // 2. ФАЙЛ (по relativePath)
        // ────────────────────────────────────────────────────────
        //
        // Если файл уже есть в fileMap — переиспользуем.
        // Иначе — создаём с новым id (f1, f2, ...) и привязываем
        // к модулю.
        // ────────────────────────────────────────────────────────
        let file = ctx.fileMap.get(relativePath);

        if (!file) {
            counters.file++;
            file = {
                id: `f${counters.file}`,
                path: relativePath,
                moduleId: module.id,
            };
            ctx.fileMap.set(relativePath, file);
            ctx.files.push(file);
            module.fileIds.push(file.id);
        }

        // ────────────────────────────────────────────────────────
        // 3. sourceToFileIdMap (9 ключей на файл)
        // ────────────────────────────────────────────────────────
        //
        // Этот индекс используется в pass2Exports (resolveToFileId)
        // для резолва путей импортов.
        //
        // ⚠️ ВАЖНО: заполняется для КАЖДОГО файла, даже если
        //    он уже был в fileMap (на случай, если entitiesMap
        //    содержит один и тот же файл под разными путями —
        //    например, абсолютным и относительным).
        // ────────────────────────────────────────────────────────

        const normalizedPath = relativePath;
        const normalizedAbs = absolutePath.replace(/\\/g, '/');

        // Ключ 1: исходный filePath (как пришёл в entitiesMap)
        ctx.sourceToFileIdMap.set(filePath, file.id);

        // Ключ 2: relativePath (от projectRoot)
        ctx.sourceToFileIdMap.set(relativePath, file.id);

        // Ключ 3: normalizedPath (с прямыми слэшами)
        ctx.sourceToFileIdMap.set(normalizedPath, file.id);

        // Ключ 4: absolutePath
        ctx.sourceToFileIdMap.set(absolutePath, file.id);

        // Ключ 5: normalizedAbsolutePath
        ctx.sourceToFileIdMap.set(normalizedAbs, file.id);

        // Ключ 6: basename (например, 'helpers.ts')
        ctx.sourceToFileIdMap.set(path.basename(relativePath), file.id);

        // Ключ 7: basename без расширения ('helpers')
        const baseNoExt = path.basename(relativePath).replace(/\.[^.]+$/, '');
        ctx.sourceToFileIdMap.set(baseNoExt, file.id);

        // Ключ 8: relativePath без расширения ('src/utils/helpers')
        ctx.sourceToFileIdMap.set(relativePath.replace(/\.[^.]+$/, ''), file.id);

        // ────────────────────────────────────────────────────────
        // 4. ФУНКЦИИ
        // ────────────────────────────────────────────────────────
        //
        // ⚠️ КРИТИЧНО: parentFunctionId в func — это compact ID
        //    (например, 'f1_42' из IdManager.generateCompactId).
        //    В FullJSON ID должен быть 'fn1', 'fn2', ...
        //
        //    Поэтому сначала строим preview-карту:
        //      compact ID → global fnN
        //
        //    Через previewCounter, который НЕ увеличивает реальный
        //    counters.function. Это нужно, потому что есть два
        //    цикла: первый — preview, второй — реальный.
        // ────────────────────────────────────────────────────────
        const funcs = entities.functions || [];

        const localCompactIdToGlobalFnId = new Map<string, string>();
        {
            let previewCounter = counters.function;
            for (const func of funcs) {
                if (!func || !func.name) continue;
                previewCounter++;
                if (func.id) {
                    localCompactIdToGlobalFnId.set(func.id, `fn${previewCounter}`);
                }
            }
        }

        // Реальный цикл: создаём FunctionData и добавляем в ctx
        for (const func of funcs) {
            if (!func || !func.name) continue;

            counters.function++;

            // ── Резолвинг parentFunctionId ──
            //
            // Если rawParent найден в preview-карте — используем
            // global fnN. Иначе — null (top-level или ошибка).
            const rawParent = (func as any).parentFunctionId as string | null | undefined;
            const resolvedParentFunctionId =
                rawParent && localCompactIdToGlobalFnId.has(rawParent)
                    ? localCompactIdToGlobalFnId.get(rawParent)!
                    : null;

            // ── vueKind (v15.5.0) ──
            //
            // Если в func.vueKind ничего нет — ставим 'function'
            // (симметрия с compact.fns.vk, где 0 = 'function').
            const rawVueKind = (func as any).vueKind as VueKind | undefined | null;
            const vueKind: VueKind = rawVueKind ?? 'function';

            // ── Создание FunctionData ──
            const funcData: FunctionData = {
                id: `fn${counters.function}`,
                name: func.name,
                moduleId: module.id,
                fileId: file.id,
                line: func.line || 0,

                // Базовые флаги
                isExported: func.isExported || false,
                isAsync: func.isAsync || false,
                isArrow: func.isArrow || false,
                isMethod: func.isMethod || false,

                // Параметры и возвращаемый тип
                params: func.params || [],
                returnType: func.returnType,

                // v15.1.0 (P0): parentFunctionId
                parentFunctionId: resolvedParentFunctionId,

                // v15.5.0: vueKind
                vueKind,
            };

            // ── Дополнительные флаги (только если true) ──
            //
            // Не пишем false — экономия места в JSON.
            // encodeFlags() в codec-encode.ts корректно работает с undefined.
            if (func.isEventHandler) funcData.isEventHandler = true;
            if (func.isNested) funcData.isNested = true;
            if ((func as any).isSelf) funcData.isSelf = true;

            ctx.functions.push(funcData);

            // ── Индекс functionMap ──
            //
            // Используется в pass2Exports (exports/imports) и
            // pass3Calls (calls) для резолва по имени.
            //
            // ⚠️ Может быть несколько функций с одинаковым именем
            //    (например, foo в разных файлах). Поэтому храним
            //    массив и берём [0] в потребителях.
            if (!ctx.functionMap.has(func.name)) {
                ctx.functionMap.set(func.name, []);
            }
            ctx.functionMap.get(func.name)!.push(funcData);
        }

        // ────────────────────────────────────────────────────────
        // 5. КЛАССЫ
        // ────────────────────────────────────────────────────────
        const classesList = entities.classes || [];
        for (const cls of classesList) {
            if (!cls || !cls.name) continue;

            counters.class++;
            ctx.classes.push({
                id: `cls${counters.class}`,
                name: cls.name,
                moduleId: module.id,
                fileId: file.id,
                line: cls.line || 0,
                isExported: cls.isExported || false,
                methods: cls.methods || [],
            } as ClassData);
        }

        // ────────────────────────────────────────────────────────
        // 6. КОНСТАНТЫ
        // ────────────────────────────────────────────────────────
        //
        // ⚠️ valuesMode фильтрует value через isValueKept:
        //    • 'full'      — все значения
        //    • 'relations' — только короткие (см. VALUE_THRESHOLDS)
        //
        // Если значение отфильтровано — value = undefined.
        // Это симметрично compact.cn.nonEmptyV (не будет индекса).
        // ────────────────────────────────────────────────────────
        const constantsList = entities.constants || [];
        for (const cn of constantsList) {
            if (!cn || !cn.name) continue;

            counters.constant++;

            // Фильтрация значения по valuesMode
            const valueToStore = isValueKept(cn.value, ctx.valuesMode) ? cn.value : undefined;

            ctx.constants.push({
                id: `cn${counters.constant}`,
                name: cn.name,
                moduleId: module.id,
                fileId: file.id,
                line: cn.line || 0,
                isExported: cn.isExported || false,
                value: valueToStore,
            } as ConstantData);
        }
    }

    // ────────────────────────────────────────────────────────────
    // Verbose-логирование
    // ────────────────────────────────────────────────────────────
    if (ctx.verbose) {
        console.log(
            `   ✅ Первый проход: ${ctx.modules.length} модулей, ` +
            `${ctx.files.length} файлов, ` +
            `${ctx.functions.length} функций`
        );
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass1Modules;
