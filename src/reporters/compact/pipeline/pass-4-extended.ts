// src/reporters/compact/pipeline/pass-4-extended.ts
// ============================================
// ПРОХОД 4: TEMPLATES + EXTENDED + LEXICAL LINKS
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика 4-го, 5-го, 6-го блоков вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: buildCompactIdToGlobalFnIdMap
//     из ../calls/compact-id-map.ts (единый источник).
//   - ✅ 100% поведение сохранено.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Четвёртый проход pipeline'а. ОБЪЕДИНЯЕТ три логических блока,
//   которые в оригинале шли последовательно в collectFullJSON:
//
//     A. СБОР VUE-ШАБЛОНОВ (templates[])
//        • Идёт по .vue-файлам
//        • Извлекает templateReactivityDeps, templateEventHandlers,
//          templateDynamicComponents, templateRefs, templateCssVariables,
//          templateDeepSelectors, templateUsedComponents, templateSlots,
//          templateDirectives, templateConditionals, templateComplexity
//        • Обогащает conditionals через conditionalCounter
//
//     B. РАСШИРЕННЫЕ СЕКЦИИ (lifecycle/effects/injections/reactivity/types/typeRefs)
//        • Идёт по всем файлам
//        • Извлекает templateLifecycle, templateEffects,
//          templateInjections, templateReactivity, typesGraph, typeRefsGraph
//        • Резолвит functionId через ctx.functionMap
//
//     C. LEXICAL LINKS (lexicalLinks[])
//        • Строит карту compactIdToGlobalFnId через
//          buildCompactIdToGlobalFnIdMap()
//        • Идёт по entities.lexicalLinks
//        • Резолвит parentFunctionId/childFunctionId через карту
//
//   ПОЧЕМУ ОБЪЕДИНЕНЫ В ОДИН МОДУЛЬ:
//     • Все три блока идут по sortedFilePaths
//     • Все три работают с templateXxx/xxxGraph полями entities
//     • Разделение на 3 файла создало бы дублирование обхода
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. Блок A (templates) выполняется ДО блока B, потому что:
//      • conditionalsCounter инкрементируется именно здесь
//      • шаблоны нужны для статистики (totalConditionals)
//
//   2. Блок C (lexicalLinks) выполняется ПОСЛЕ A и B, потому что:
//      • требует ПОЛНЫЙ ctx.functions (для buildCompactIdToGlobalFnIdMap)
//      • ctx.functions заполнен в pass1Modules (уже до нас)
//      • НО: buildCompactIdToGlobalFnIdMap вызывается один раз
//        в блоке C, а не в начале модуля — чтобы гарантировать,
//        что ctx.functions уже содержит все функции
//
//   3. Обход по .vue-файлам (блок A) — отдельный цикл,
//      потому что проверка filePath.endsWith('.vue') делается
//      только для шаблонов. Для остальных блоков идём по всем.
//
//   4. Флаг hasTemplate:
//      Проверяется сумма длин всех templateXxx-полей. Если 0 —
//      файл пропускается (не создаём пустой TemplateData).
//
//   5. Функциональные поля (functionId/callbackFunctionId) в
//      lifecycle/effects/reactivity резолвятся через
//      ctx.functionMap.get(name)?.[0]?.id ?? ''.
//
//      Если функции нет в карте — ставим '', а не undefined.
//      Это важно для codec (encodeField может ругаться на
//      undefined в некоторых версиях).
//
//   6. Типы/typeRefs (typesGraph/typeRefsGraph) —
//      moduleId и fileId берутся из локального module/file
//      (в отличие от functionId, который резолвится через карту).
//
//   7. LEXICAL LINKS:
//      • parentFunctionId может быть null (top-level)
//      • childFunctionId ОБЯЗАТЕЛЬНО должен быть найден,
//        иначе link пропускается
//      • Дедупликация НЕ делается: каждый link — уникален
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ОБХОДА
// ════════════════════════════════════════════════════════════
//
//   Все три блока идут по ctx.sortedFilePaths. Это гарантирует,
//   что templates[], lifecycle[], effects[], injections[],
//   reactivity[], types[], typeRefs[], lexicalLinks[]
//   идут в одном порядке между прогонами.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   pass4Extended(ctx);
//
//   ctx.templates      → [{ fileId: 'f1', conditionals: [...], ... }]
//   ctx.lifecycle      → [{ id: 'lc1', hookName: 'onMounted', ... }]
//   ctx.effects        → [{ id: 'ef1', effectType: 'timer', ... }]
//   ctx.injections     → [{ id: 'in1', kind: 'provide', ... }]
//   ctx.reactivity     → [{ id: 'rx1', kind: 'computed', ... }]
//   ctx.types          → [{ id: 't1', kind: 'interface', ... }]
//   ctx.typeRefs       → [{ id: 'tr1', typeName: 'Props', ... }]
//   ctx.lexicalLinks   → [{ id: 'lx1', relation: 'callback', ... }]
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts                    — CollectContext + getRelativePath
//   • ./collect-full-json.ts          — вызывает этот проход вторым
//   • ../calls/compact-id-map.ts      — buildCompactIdToGlobalFnIdMap
//   • ../codec/codec-types.ts         — TemplateData, LifecycleHook, ...
// ============================================

import path from 'path';
import type {
    TemplateData,
    TemplateConditional,
    LifecycleHook,
    EffectEdge,
    InjectionEdge,
    ReactivityEdge,
    TypeNodeData,
    TypeRefData,
    LexicalLink,
} from '../../codec/codec-types.js';
import { buildCompactIdToGlobalFnIdMap } from '../calls/compact-id-map.js';
import type { CollectContext } from './context.js';
import { getRelativePath } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 4: templates + extended + lexicalLinks.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   A. collectTemplates(ctx)         — templates[] из .vue
 *   B. collectExtendedSections(ctx)  — lifecycle/effects/.../typeRefs
 *   C. collectLexicalLinks(ctx)      — lexicalLinks[]
 *
 *   Порядок A → B → C важен:
 *     • A до B: conditionalCounter идёт раньше остальных счётчиков
 *     • C после B: buildCompactIdToGlobalFnIdMap требует
 *       ПОЛНЫЙ ctx.functions (заполнен в pass1Modules)
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.templates, ctx.lifecycle, ctx.effects, ctx.injections,
 *   ctx.reactivity, ctx.types, ctx.typeRefs, ctx.lexicalLinks,
 *   ctx.counters.{conditional, lifecycle, effect, injection,
 *                 reactivity, type, typeRef, lexical}
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass4Extended(ctx: CollectContext): void {
    collectTemplates(ctx);
    collectExtendedSections(ctx);
    collectLexicalLinks(ctx);
}

// ════════════════════════════════════════════════════════════════
// БЛОК A: TEMPLATES (Vue-шаблоны)
// ════════════════════════════════════════════════════════════════

/**
 * Сбор Vue-шаблонов из .vue-файлов.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого filePath в sortedFilePaths:
 *     1. Если это не .vue — пропустить
 *     2. Получить entities, module, file
 *     3. Проверить флаг hasTemplate — если шаблон пуст, пропустить
 *     4. Обогатить conditionals через conditionalCounter
 *     5. Создать TemplateData
 *
 * ════════════════════════════════════════════════════════════
 * ФЛАГ hasTemplate
 * ════════════════════════════════════════════════════════════
 *
 *   Суммируем длины всех templateXxx-полей + templateComplexity.
 *   Если сумма === 0 — это не Vue-компонент с шаблоном
 *   (иконка, презентационный компонент). Пропускаем.
 *
 *   Это симметрично с analyzeTemplateByRegex + traverseVueAST
 *   в modes/vue-analyzer/template.ts.
 */
function collectTemplates(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        // ── Только .vue-файлы ──
        if (!filePath.endsWith('.vue')) continue;

        const relativePath = getRelativePath(ctx, filePath);
        const dirName = path.basename(path.dirname(relativePath)) || 'root';

        const module = ctx.moduleMap.get(dirName);
        const file = ctx.fileMap.get(relativePath);
        if (!module || !file) continue;

        const e = entities as any;

        // ────────────────────────────────────────────────────────
        // Проверка: есть ли данные шаблона
        // ────────────────────────────────────────────────────────
        //
        // Считаем сумму длин всех templateXxx + templateComplexity.
        // Если 0 — файл без шаблона (иконка). Пропускаем.
        // ────────────────────────────────────────────────────────
        const hasTemplate =
            (e.templateReactivityDeps?.length || 0) +
            (e.templateEventHandlers?.length || 0) +
            (e.templateDynamicComponents?.length || 0) +
            (e.templateRefs?.length || 0) +
            (e.templateCssVariables?.length || 0) +
            (e.templateDeepSelectors?.length || 0) +
            (e.templateUsedComponents?.length || 0) +
            (e.templateSlots?.length || 0) +
            (e.templateDirectives?.length || 0) +
            (e.templateConditionals?.length || 0) +
            (e.templateComplexity || 0) >
            0;

        if (!hasTemplate) continue;

        // ────────────────────────────────────────────────────────
        // Обогащение conditionals
        // ────────────────────────────────────────────────────────
        //
        // Каждому conditionals-элементу присваиваем глобальный id
        // (cd1, cd2, ...) и fileId. Это нужно для:
        //   • compact.cd (глобальный массив conditionals)
        //   • round-trip: id и fileId восстанавливаются в decode
        // ────────────────────────────────────────────────────────
        const fileConditionals = e.templateConditionals || [];
        const enrichedConditionals: TemplateConditional[] = fileConditionals.map((cd: any) => {
            counters.conditional++;
            return {
                id: `cd${counters.conditional}`,
                directive: cd.directive,
                fileId: file.id,
                line: cd.line,
                conditionExpression: cd.conditionExpression,
                renderedComponent: cd.renderedComponent,
            };
        });

        // ────────────────────────────────────────────────────────
        // Создание TemplateData
        // ────────────────────────────────────────────────────────
        //
        // ⚠️ КЛЮЧЕВОЕ ПРАВИЛО: vt (Vue template) — это ОТДЕЛЬНАЯ
        //    СУЩНОСТЬ, а не агрегатор связей. Здесь мы храним
        //    ССЫЛКИ (имена/примитивы), а не дубликаты объектов.
        //
        //    Рёбра (event → handler, templateRef → expose) создаются
        //    позже, в compact-reporter, на основе этих ссылок.
        // ────────────────────────────────────────────────────────
        const templateData: TemplateData = {
            fileId: file.id,
            moduleId: module.id,
            reactivityDeps: e.templateReactivityDeps || [],
            eventHandlers: e.templateEventHandlers || [],
            dynamicComponents: (e.templateDynamicComponents || []).map((d: any) => ({
                isExpression: d.isExpression || '',
                line: d.line || 0,
                resolvedComponents: d.resolvedComponents || [],
            })),
            directives: e.templateDirectives || [],
            usedComponents: e.templateUsedComponents || [],
            templateRefs: (e.templateRefs || []).map((ref: any) => ({
                refValue: ref.refValue || '',
                tag: ref.tag || '',
                line: ref.line || 0,
                exposedMethods: ref.exposedMethods || [],
            })),
            cssVariables: e.templateCssVariables || [],
            deepSelectors: e.templateDeepSelectors || [],
            slots: e.templateSlots || [],
            complexity: e.templateComplexity || 0,
            conditionals: enrichedConditionals,
        };

        ctx.templates.push(templateData);
    }

    // ── Verbose ──
    if (ctx.verbose && ctx.templates.length > 0) {
        console.log(`   🎨 Vue-шаблонов: ${ctx.templates.length}`);

        // totalConditionals через сумму по templates[]
        let totalCd = 0;
        for (const t of ctx.templates) totalCd += (t.conditionals ?? []).length;
        console.log(`   🎯 Conditionals: ${totalCd}`);
    }
}

// ════════════════════════════════════════════════════════════════
// БЛОК B: EXTENDED SECTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Сбор расширенных секций.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО СОБИРАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   • templateLifecycle   → ctx.lifecycle[]
 *   • templateEffects     → ctx.effects[]
 *   • templateInjections  → ctx.injections[]
 *   • templateReactivity  → ctx.reactivity[]
 *   • typesGraph          → ctx.types[]
 *   • typeRefsGraph       → ctx.typeRefs[]
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Для каждого filePath в sortedFilePaths:
 *     1. Получить entities, module, file
 *     2. Для каждого templateLifecycle:
 *        • Резолвить functionId через functionMap
 *        • Резолвить callbackFunctionId
 *        • Создать LifecycleHook
 *     3. Для каждого templateEffects:
 *        • Резолвить functionId
 *        • Создать EffectEdge
 *     4. Для каждого templateInjections:
 *        • Создать InjectionEdge (без functionId — только fileId)
 *     5. Для каждого templateReactivity:
 *        • Резолвить functionId
 *        • Создать ReactivityEdge
 *     6. Для каждого typesGraph:
 *        • Создать TypeNodeData (moduleId + fileId локально)
 *     7. Для каждого typeRefsGraph:
 *        • Создать TypeRefData (moduleId + fileId локально)
 *
 * ════════════════════════════════════════════════════════════
 * РЕЗОЛВИНГ functionId
 * ════════════════════════════════════════════════════════════
 *
 *   Для lifecycle/effects/reactivity резолвим через
 *   ctx.functionMap.get(name)?.[0]?.id ?? ''.
 *
 *   Если функции нет в карте — ставим '' (пустая строка),
 *   а не undefined. Это важно для codec (стабильность
 *   сериализации).
 *
 *   Injections НЕ резолвят functionId — там только fileId.
 *   Types/typeRefs НЕ резолвят functionId — там moduleId + fileId.
 */
function collectExtendedSections(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        const relativePath = getRelativePath(ctx, filePath);
        const dirName = path.basename(path.dirname(relativePath)) || 'root';

        const module = ctx.moduleMap.get(dirName);
        const file = ctx.fileMap.get(relativePath);
        if (!module || !file) continue;

        const e = entities as any;

        // ────────────────────────────────────────────────────────
        // LIFECYCLE
        // ────────────────────────────────────────────────────────
        //
        // templateLifecycle → ctx.lifecycle
        //
        // Резолвит:
        //   • functionId         — через functionMap
        //   • callbackFunctionId — через functionMap (опционально)
        // ────────────────────────────────────────────────────────
        for (const lc of e.templateLifecycle || []) {
            counters.lifecycle++;

            const funcArray = ctx.functionMap.get(lc.functionName);
            const func = funcArray?.[0];

            const callbackFuncArray = lc.callbackFunctionName
                ? ctx.functionMap.get(lc.callbackFunctionName)
                : undefined;
            const callbackFunc = callbackFuncArray?.[0];

            ctx.lifecycle.push({
                id: `lc${counters.lifecycle}`,
                hookName: lc.hookName,
                functionId: func?.id || '',
                line: lc.line || 0,
                callbackFunctionId: callbackFunc?.id,
                isSetupContext: lc.isSetupContext || false,
            } as LifecycleHook);
        }

        // ────────────────────────────────────────────────────────
        // EFFECTS
        // ────────────────────────────────────────────────────────
        //
        // templateEffects → ctx.effects
        //
        // Резолвит functionId через functionMap.
        // ────────────────────────────────────────────────────────
        for (const ef of e.templateEffects || []) {
            counters.effect++;

            const funcArray = ctx.functionMap.get(ef.functionName);
            const func = funcArray?.[0];

            ctx.effects.push({
                id: `ef${counters.effect}`,
                effectType: ef.effectType,
                functionId: func?.id || '',
                line: ef.line || 0,
                targetName: ef.targetName || '',
                metaValue: ef.metaValue,
            } as EffectEdge);
        }

        // ────────────────────────────────────────────────────────
        // INJECTIONS
        // ────────────────────────────────────────────────────────
        //
        // templateInjections → ctx.injections
        //
        // ⚠️ Здесь НЕТ functionId — только fileId.
        //    Injection — это связь файла (provide/inject),
        //    а не функции.
        // ────────────────────────────────────────────────────────
        for (const inj of e.templateInjections || []) {
            counters.injection++;

            ctx.injections.push({
                id: `in${counters.injection}`,
                kind: inj.kind,
                fileId: file.id,
                line: inj.line || 0,
                key: inj.key || '',
                isSymbolKey: inj.isSymbolKey || false,
                hasDefault: inj.hasDefault || false,
            } as InjectionEdge);
        }

        // ────────────────────────────────────────────────────────
        // REACTIVITY
        // ────────────────────────────────────────────────────────
        //
        // templateReactivity → ctx.reactivity
        //
        // Резолвит functionId через functionMap.
        // ────────────────────────────────────────────────────────
        for (const rx of e.templateReactivity || []) {
            counters.reactivity++;

            const funcArray = ctx.functionMap.get(rx.functionName);
            const func = funcArray?.[0];

            ctx.reactivity.push({
                id: `rx${counters.reactivity}`,
                kind: rx.kind,
                functionId: func?.id || '',
                line: rx.line || 0,
                reads: rx.reads || [],
                writes: rx.writes || [],
                isWriteable: rx.isWriteable || false,
            } as ReactivityEdge);
        }

        // ────────────────────────────────────────────────────────
        // TYPES
        // ────────────────────────────────────────────────────────
        //
        // typesGraph → ctx.types
        //
        // ⚠️ moduleId и fileId берутся из локального module/file,
        //    а НЕ резолвятся через карту (в отличие от functionId).
        // ────────────────────────────────────────────────────────
        for (const ty of e.typesGraph || []) {
            counters.type++;

            ctx.types.push({
                id: `t${counters.type}`,
                kind: ty.kind,
                name: ty.name || '',
                moduleId: module.id,
                fileId: file.id,
                line: ty.line || 0,
                members: ty.members || [],
                extendsTypes: ty.extendsTypes || [],
            } as TypeNodeData);
        }

        // ────────────────────────────────────────────────────────
        // TYPE REFS
        // ────────────────────────────────────────────────────────
        //
        // typeRefsGraph → ctx.typeRefs
        //
        // ⚠️ moduleId и fileId берутся из локального module/file.
        // ────────────────────────────────────────────────────────
        for (const tr of e.typeRefsGraph || []) {
            counters.typeRef++;

            ctx.typeRefs.push({
                id: `tr${counters.typeRef}`,
                typeName: tr.typeName || '',
                moduleId: module.id,
                fileId: file.id,
                line: tr.line || 0,
                usageKind: tr.usageKind,
            } as TypeRefData);
        }
    }

    // ── Verbose ──
    if (
        ctx.verbose &&
        ctx.lifecycle.length +
        ctx.effects.length +
        ctx.injections.length +
        ctx.reactivity.length +
        ctx.types.length +
        ctx.typeRefs.length >
        0
    ) {
        console.log(`   🧬 Lifecycle: ${ctx.lifecycle.length}`);
        console.log(`   ⚡ Effects: ${ctx.effects.length}`);
        console.log(`   💉 Injections: ${ctx.injections.length}`);
        console.log(`   🔄 Reactivity: ${ctx.reactivity.length}`);
        console.log(`   📐 Types: ${ctx.types.length}`);
        console.log(`   🔗 TypeRefs: ${ctx.typeRefs.length}`);
    }
}

// ════════════════════════════════════════════════════════════════
// БЛОК C: LEXICAL LINKS
// ════════════════════════════════════════════════════════════════

/**
 * Сбор лексических связей (parent → child).
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ТАКОЕ LEXICAL LINKS
 * ════════════════════════════════════════════════════════════
 *
 *   Статические связи между функциями, описывающие
 *   вложенность в AST (кто внутри кого объявлен).
 *
 *   Отличие от callGraph:
 *     • callGraph   — динамическая связь (кто кого вызывает)
 *     • lexicalLinks — статическая связь (кто внутри кого)
 *
 *   ПРИМЕР:
 *     function outer() {
 *       arr.map(x => x);  // ← callback → outer
 *     }
 *
 *     lexicalLinks: [{
 *       id: 'lx1',
 *       parentFunctionId: 'fn1',  // outer
 *       childFunctionId: 'fn2',   // callback
 *       relation: 'callback',
 *       line: 2,
 *       argumentIndex: 0,
 *       calleeName: 'map',
 *     }]
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ ИСПОЛЬЗУЕТСЯ КАРТА compactIdToGlobalFnId
 * ════════════════════════════════════════════════════════════
 *
 *   В entities.lexicalLinks поля parentFunctionId/childFunctionId
 *   содержат compact ID (типа 'f1_42', 'func_abc_foo_10').
 *
 *   В FullJSON ID должен быть 'fn1', 'fn2', ...
 *
 *   Поэтому buildCompactIdToGlobalFnIdMap() строит карту:
 *     compact ID → global fnN
 *
 *   Она строится в НАЧАЛЕ этого блока — после того как
 *   ctx.functions полностью заполнен (в pass1Modules).
 *
 * ════════════════════════════════════════════════════════════
 * ПРАВИЛА
 * ════════════════════════════════════════════════════════════
 *
 *   • parentFunctionId может быть null (top-level функция)
 *   • childFunctionId ОБЯЗАТЕЛЬНО должен быть найден в карте,
 *     иначе link пропускается
 *   • Дедупликация НЕ делается: каждый link — уникален
 *   • counters.lexical увеличивается на каждый добавленный link
 */
function collectLexicalLinks(ctx: CollectContext): void {
    const { entitiesMap, sortedFilePaths, counters } = ctx;

    // ────────────────────────────────────────────────────────
    // Построение карты compactId → globalFnId
    // ────────────────────────────────────────────────────────
    //
    // ⚠️ ВАЖНО: карта строится ЗДЕСЬ, а не в начале модуля,
    //    потому что требует ПОЛНЫЙ ctx.functions. К моменту
    //    вызова pass4Extended ctx.functions уже заполнен
    //    (pass1Modules идёт первым).
    // ────────────────────────────────────────────────────────
    const compactIdToGlobalFnId = buildCompactIdToGlobalFnIdMap(
        entitiesMap,
        ctx.functions,
        ctx.fileMap,
        ctx.projectRoot
    );

    // ────────────────────────────────────────────────────────
    // Обход всех файлов
    // ────────────────────────────────────────────────────────
    for (const filePath of sortedFilePaths) {
        const entities = entitiesMap[filePath];
        if (!entities) continue;

        const localLinks = (entities as any).lexicalLinks || [];

        for (const link of localLinks) {
            if (!link) continue;

            // ── Резолвинг parentFunctionId ──
            //
            // Может быть null (top-level). Если задан — ищем в карте.
            const parentGlobalId = link.parentFunctionId
                ? compactIdToGlobalFnId.get(link.parentFunctionId) ?? null
                : null;

            // ── Резолвинг childFunctionId ──
            //
            // ⚠️ ОБЯЗАТЕЛЬНО должен быть найден. Если нет — пропускаем link.
            const childGlobalId = compactIdToGlobalFnId.get(link.childFunctionId);
            if (!childGlobalId) continue;

            counters.lexical++;
            ctx.lexicalLinks.push({
                id: `lx${counters.lexical}`,
                parentFunctionId: parentGlobalId,
                childFunctionId: childGlobalId,
                relation: link.relation,
                line: link.line,
                argumentIndex: link.argumentIndex,
                calleeName: link.calleeName,
            } as LexicalLink);
        }
    }

    // ── Verbose ──
    if (ctx.verbose && ctx.lexicalLinks.length > 0) {
        console.log(`   🧩 LexicalLinks: ${ctx.lexicalLinks.length}`);
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass4Extended;
