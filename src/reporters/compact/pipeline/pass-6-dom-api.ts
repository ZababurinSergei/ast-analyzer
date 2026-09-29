// src/reporters/compact/pipeline/pass-6-dom-api.ts
// ============================================
// ПРОХОД 6: DOM API
// ============================================
// Версия: 16.1.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.1.0 (рефакторинг: выделение в отдельный модуль):
//   - ✅ ПЕРЕПИСАНО: логика DOM API вынесена из
//     collectFullJSON в отдельный модуль.
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ИСПОЛЬЗУЕТСЯ: detectDomApiCallsForFunction
//     из ../dom-api/detector.js (единый источник).
//   - ✅ ИСПОЛЬЗУЕТСЯ: parseVueFile из modes/vue-analyzer
//     (для извлечения <script setup>).
//   - ✅ 100% поведение сохранено.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Шестой (последний) проход pipeline'а. Отвечает за:
//
//     1. Анализ DOM API-вызовов в функциях
//        (addEventListener, querySelector, createElement, ...)
//
//     2. Заполнение top-level ctx.domApiCalls[]
//
//     3. Обогащение каждой функции (fn):
//        • fn.htmlUsage[]        — список HTML-вызовов
//        • fn.isHtmlVisible      — влияет ли функция на UI
//        • fn.domApiCalls[]      — массив ID вызовов (d1, d2, ...)
//        • fn.domApiUsagesAsHandler[] — обратная связь:
//          функция — обработчик DOM-события
//
// ════════════════════════════════════════════════════════════
// КЛЮЧЕВЫЕ МОМЕНТЫ
// ════════════════════════════════════════════════════════════
//
//   1. ДЛЯ .vue-ФАЙЛОВ ИЗВЛЕКАЕТСЯ <script setup>
//
//      Функции из .vue-файлов лежат в <script setup>.
//      Чтобы ts-morph мог их найти, мы:
//        a. Читаем .vue через parseVueFile()
//        b. Извлекаем scriptSetup.content || script.content
//        c. Создаём ВИРТУАЛЬНЫЙ SourceFile: `${absPath}.__dom__.ts`
//        d. detectDomApiCallsForFunction работает с ним
//
//      ⚠️ ПОЧЕМУ parseVueFile, А НЕ REGEX:
//        Regex ломается на generic="T extends Record<string, unknown>"
//        в <script setup>. parseVueFile использует @vue/compiler-sfc,
//        который корректно обрабатывает все атрибуты.
//
//   2. ORIGINALABSOLUTEPATH — FALLBACK
//
//      detectDomApiCallsForFunction принимает:
//        • scriptPath        — виртуальный путь (.__dom__.ts)
//        • originalAbsolutePath — реальный путь (.vue)
//
//      Если виртуальный SourceFile не найден в tsProject —
//      buildScopeForFunction пробует originalAbsolutePath.
//
//      Это защита от рассинхрона: parseVueFile мог вернуть
//      другой scriptPath, чем был создан в tsProject.
//
//   3. TS-MORPH PROJECT
//
//      Один общий TsMorphProject на весь проход. Все
//      виртуальные SourceFile создаются в нём через
//      tsProject.createSourceFile(scriptPath, script, { overwrite: true }).
//
//      createSourceFile перезаписывает существующий файл,
//      если он уже был (защита от повторного вызова pipeline).
//
//   4. ГЛОБАЛЬНЫЙ ID-COUNTER
//
//      domIdCounter = { value: 0 } — один на весь проход.
//      Каждый DOM API-вызов получает уникальный ID: d1, d2, ...
//
//      ⚠️ Счётчик ПЕРЕДАЁТСЯ по ссылке в
//      detectDomApiCallsForFunction, который его мутирует
//      (idCounter.value++).
//
//   5. ОБРАТНАЯ СВЯЗЬ fn.domApiUsagesAsHandler
//
//      Если DOM API-вызов — это addEventListener('click', handler),
//      и handler найден в ctx.functions, то в функцию handler
//      добавляется запись:
//
//        {
//          callId: 'd5',           // ID вызова
//          category: 'add-event-listener',
//          eventName: 'click',
//          target: 'ref:btn',
//          line: 42,
//        }
//
//      Это позволяет UI показать: "эта функция — обработчик
//      клика по кнопке btn".
//
//   6. ФИЛЬТРАЦИЯ effect === 'read'
//
//      При заполнении fn.htmlUsage мы ПРОПУСКАЕМ вызовы
//      с effect === 'read' (querySelector, getAttribute).
//
//      Это правильно: чтение не влияет на UI. В htmlUsage
//      попадают только write/mixed вызовы.
//
//      ⚠️ НО: fn.domApiCalls[] содержит ВСЕ вызовы (включая read).
//         Это используется для статистики (totalDomApiCalls).
//
//   7. fn.isHtmlVisible
//
//      Устанавливается в true, если fn.htmlUsage.length > 0.
//
//      Используется в:
//        • statistics.totalHtmlVisibleFns
//        • compact.fns.hv (RLE 0/1)
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ВЫЗОВОВ
// ════════════════════════════════════════════════════════════
//
//   Для каждой функции fn из ctx.functions:
//
//     1. Найти sfcFile по fn.fileId
//     2. Вычислить absolutePath через projectRoot + sfcFile.path
//     3. Если absolutePath.endsWith('.vue'):
//        a. parseVueFile(absolutePath)
//        b. Извлечь scriptSetup.content || script.content
//        c. Если пусто — skip (skippedFns++)
//        d. scriptPath = `${absolutePath}.__dom__.ts`
//        e. tsProject.createSourceFile(scriptPath, script, { overwrite: true })
//     4. detectDomApiCallsForFunction(
//          fn,
//          scriptPath,
//          fn.fileId,
//          entitiesMap,
//          tsProject,
//          domIdCounter,
//          absolutePath
//        )
//     5. Добавить вызовы в ctx.domApiCalls
//
//   После цикла — обогащение fn.htmlUsage/isHtmlVisible/
//   domApiCalls/domApiUsagesAsHandler.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   pass6DomApi(ctx);
//
//   ctx.domApiCalls → [
//     {
//       id: 'd1',
//       functionId: 'fn1',
//       fileId: 'f1',
//       category: 'add-event-listener',
//       effect: 'mixed',
//       method: 'addEventListener',
//       target: 'ref:btn',
//       targetKind: 'ref',
//       args: ["'click'", 'handleClick'],
//       argResolutions: [...],
//       line: 42,
//       column: 8,
//       context: {
//         eventName: 'click',
//         handlerFunctionId: 'fn5',
//         handlerSource: 'local',
//       },
//     }
//   ]
//
//   fn1.htmlUsage → [
//     {
//       kind: 'dom-api',
//       usageId: 'd1',
//       tag: 'ref:btn',
//       target: 'addEventListener',
//       line: 42,
//       column: 8,
//       domApiCategory: 'add-event-listener',
//       domApiMethod: 'addEventListener',
//       domApiTarget: 'ref:btn',
//       domApiContext: { eventName: 'click', ... },
//     }
//   ]
//
//   fn1.isHtmlVisible → true
//   fn1.domApiCalls → ['d1']
//   fn5.domApiUsagesAsHandler → [
//     {
//       callId: 'd1',
//       category: 'add-event-listener',
//       eventName: 'click',
//       target: 'ref:btn',
//       line: 42,
//     }
//   ]
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts                          — CollectContext
//   • ./collect-full-json.ts                — вызывает этот проход шестым
//   • ../dom-api/detector.ts                — detectDomApiCallsForFunction
//   • ../dom-api/scope-builder.ts           — buildScopeForFunction
//   • ../dom-api/heuristics.ts              — isLikelyDomReceiver
//   • ../dom-api/resolvers.ts               — resolveTargetLocal и др.
//   • ../dom-api/method-maps.ts             — DOM_METHOD_MAP_LOCAL и др.
//   • ../dom-api/types.ts                   — ScopeInternal, ScopeLocal
//   • ../../../modes/vue-analyzer/parser.ts — parseVueFile
// ============================================

import fs from 'fs';
import path from 'path';
import { Project as TsMorphProject } from 'ts-morph';
import { parseVueFile } from '../../../modes/vue-analyzer/parser.js';
import { detectDomApiCallsForFunction } from '../dom-api/detector.js';
import type { CollectContext } from './context.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ ПРОХОДА
// ============================================================

/**
 * Проход 6: DOM API.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создать TsMorphProject (один на весь проход)
 *   2. Для каждой функции fn из ctx.functions:
 *      a. Найти sfcFile (fileId → FileData)
 *      b. Вычислить absolutePath
 *      c. Если .vue — извлечь <script setup> через parseVueFile
 *      d. Создать виртуальный SourceFile `.__dom__.ts`
 *      e. detectDomApiCallsForFunction() → calls[]
 *      f. Добавить calls в ctx.domApiCalls
 *   3. Обогатить fn.htmlUsage/isHtmlVisible/domApiCalls
 *   4. Обогатить handler-fn.domApiUsagesAsHandler
 *
 * ════════════════════════════════════════════════════════════
 * МУТИРУЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ctx.domApiCalls
 *   ctx.functions[].htmlUsage
 *   ctx.functions[].isHtmlVisible
 *   ctx.functions[].domApiCalls
 *   ctx.functions[].domApiUsagesAsHandler
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param ctx — контекст сбора (мутируется)
 */
export function pass6DomApi(ctx: CollectContext): void {
    const { files, functions, entitiesMap, projectRoot, verbose } = ctx;

    // ────────────────────────────────────────────────────────────
    // Шаг 1: Создание ts-morph Project
    // ────────────────────────────────────────────────────────────
    //
    // Один Project на весь проход. Все виртуальные SourceFile
    // для .vue-файлов создаются в нём.
    //
    // ⚠️ compilerOptions:
    //   • target: 99  — ESNext
    //   • module: 99  — ESNext
    //   • jsx: 2      — React JSX (не TSX)
    //   • allowJs     — разрешить .js
    //   • skipLibCheck — ускорить
    //
    // ⚠️ НЕ используется tsConfigFilePath — там могут быть
    //    paths/baseUrl, которые приведут к циклической
    //    загрузке. Для DOM API достаточно базовых опций.
    // ────────────────────────────────────────────────────────────
    const tsProject = new TsMorphProject({
        compilerOptions: {
            target: 99,
            module: 99,
            allowJs: true,
            checkJs: false,
            skipLibCheck: true,
            jsx: 2,
        },
    });

    // ────────────────────────────────────────────────────────────
    // Verbose-логирование старта
    // ────────────────────────────────────────────────────────────
    if (verbose) {
        console.log(`   🔧 DOM API: анализ ${functions.length} функций...`);
    }

    // ────────────────────────────────────────────────────────────
    // Счётчики для диагностики
    // ────────────────────────────────────────────────────────────
    let analyzedFns = 0;
    let skippedFns = 0;

    // ⚠️ Глобальный ID-счётчик для DOM API-вызовов (d1, d2, ...).
    //    Передаётся по ссылке в detectDomApiCallsForFunction,
    //    который его мутирует.
    const domIdCounter = { value: 0 };

    // ════════════════════════════════════════════════════════════
    // Шаг 2: Обход всех функций
    // ════════════════════════════════════════════════════════════
    for (const fn of functions) {
        // ── 2.1. Найти sfcFile по fn.fileId ──
        const sfcFile = files.find(f => f.id === fn.fileId);
        if (!sfcFile) continue;

        // ── 2.2. Вычислить absolutePath ──
        //
        // sfcFile.path — относительный от projectRoot.
        // path.resolve(projectRoot, sfcFile.path) → абсолютный.
        const absolutePath = path.resolve(projectRoot, sfcFile.path);
        if (!fs.existsSync(absolutePath)) continue;

        // ── 2.3. Для .vue — извлечь <script setup> ──
        //
        // ⚠️ parseVueFile используется, потому что regex ломается
        //    на generic-атрибутах вида <script setup generic="...">.
        //
        //    parseVueFile — обёртка над @vue/compiler-sfc parse(),
        //    которая корректно обрабатывает все атрибуты.
        let scriptPath = absolutePath;

        if (absolutePath.endsWith('.vue')) {
            try {
                const parsed = parseVueFile(absolutePath);
                if (!parsed) {
                    if (verbose) {
                        console.warn(`   ⚠️ parseVueFile вернул null для ${sfcFile.path}`);
                    }
                    skippedFns++;
                    continue;
                }

                // ── Извлечь script ──
                const script =
                    parsed.descriptor.scriptSetup?.content ||
                    parsed.descriptor.script?.content ||
                    '';

                if (!script.trim()) {
                    if (verbose) {
                        console.warn(`   ⚠️ Пустой <script> в ${sfcFile.path}`);
                    }
                    skippedFns++;
                    continue;
                }

                // ── Создать виртуальный SourceFile ──
                //
                // ⚠️ overwrite: true — защита от повторного вызова
                //    pipeline (createSourceFile не падает на существующий,
                //    а перезаписывает).
                scriptPath = `${absolutePath}.__dom__.ts`;
                tsProject.createSourceFile(scriptPath, script, { overwrite: true });

                // ── Диагностика AST_DEBUG_VUE ──
                if (process.env.AST_DEBUG_VUE === 'true') {
                    const hasDefineProps = /\bdefineProps\b/.test(script);
                    const hasDefineEmits = /\bdefineEmits\b/.test(script);
                    const hasDefineExpose = /\bdefineExpose\b/.test(script);
                    console.log(
                        `   📜 ${path.basename(absolutePath)}: script ${script.length} chars, ` +
                        `defineProps=${hasDefineProps}, defineEmits=${hasDefineEmits}, defineExpose=${hasDefineExpose}`
                    );
                }
            } catch (err) {
                if (verbose) {
                    console.warn(`   ⚠️ Не удалось извлечь script из ${sfcFile.path}: ${err}`);
                }
                skippedFns++;
                continue;
            }
        }

        // ── 2.4. Детектирование DOM API-вызовов ──
        //
        // detectDomApiCallsForFunction:
        //   1. Строит scope через buildScopeForFunction
        //      (locals/imports/globals/refs)
        //   2. Находит targetFn в SourceFile по fn.name
        //   3. Обходит targetFn.forEachDescendant:
        //      a. CallExpression → DOM_METHOD_MAP_LOCAL
        //      b. BinaryExpression '=' → DOM_PROPERTY_MAP_LOCAL
        //      c. NewExpression → DOM_OBSERVER_MAP_LOCAL
        //   4. Для каждого совпадения проверяет isLikelyDomReceiver
        //   5. Собирает DomApiCall с args/argResolutions/context
        //
        // ⚠️ originalAbsolutePath — fallback для buildScopeForFunction,
        //    если виртуальный scriptPath не найден в tsProject.
        try {
            const calls = detectDomApiCallsForFunction(
                fn,
                scriptPath,
                fn.fileId,
                entitiesMap,
                tsProject,
                domIdCounter,
                absolutePath
            );
            ctx.domApiCalls.push(...calls);
            analyzedFns++;
        } catch (err) {
            if (verbose) {
                console.warn(`   ⚠️ DOM API analysis failed for ${fn.name}: ${err}`);
            }
            skippedFns++;
        }
    }

    // ────────────────────────────────────────────────────────────
    // Verbose-логирование результатов цикла
    // ────────────────────────────────────────────────────────────
    if (verbose) {
        console.log(`   📊 DOM API: проанализировано ${analyzedFns}, пропущено ${skippedFns}`);

        if (ctx.domApiCalls.length > 0) {
            console.log(`   🖥  DomApiCalls: ${ctx.domApiCalls.length}`);
        } else {
            console.warn(
                `   ⚠️ DOM API: 0 вызовов при ${analyzedFns} проанализированных функциях — ` +
                `проверьте isLikelyDomReceiver`
            );
        }
    }

    // ════════════════════════════════════════════════════════════
    // Шаг 3: Обогащение функций
    // ════════════════════════════════════════════════════════════
    //
    // Для каждой функции:
    //   • Собрать её DOM API-вызовы (по functionId)
    //   • Заполнить htmlUsage[] (только write/mixed)
    //   • Установить isHtmlVisible
    //   • Заполнить domApiCalls[] (ВСЕ вызовы, включая read)
    //   • Обогатить handler-функции через domApiUsagesAsHandler
    // ════════════════════════════════════════════════════════════
    for (const fn of functions) {
        // ── Собрать DOM API-вызовы этой функции ──
        const calls = ctx.domApiCalls.filter((c: any) => c.functionId === fn.id);

        // ── Инициализировать htmlUsage ──
        if (!(fn as any).htmlUsage) (fn as any).htmlUsage = [];

        // ── Заполнить htmlUsage (только write/mixed) ──
        //
        // ⚠️ ВЫЗОВЫ С effect === 'read' ПРОПУСКАЮТСЯ.
        //    Это правильно: чтение не влияет на UI.
        //
        //    НО: они остаются в fn.domApiCalls[] (см. ниже)
        //    для статистики.
        for (const call of calls) {
            if (call.effect === 'read') continue;

            (fn as any).htmlUsage.push({
                kind: 'dom-api',
                usageId: call.id,
                tag: call.target,
                target: call.method,
                line: call.line,
                column: call.column,
                domApiCategory: call.category,
                domApiMethod: call.method,
                domApiTarget: call.target,
                domApiContext: call.context,
            });
        }

        // ── isHtmlVisible ──
        //
        // true, если htmlUsage непусто (есть хоть один write/mixed вызов).
        (fn as any).isHtmlVisible = (fn as any).htmlUsage.length > 0;

        // ── domApiCalls[] — ВСЕ вызовы (включая read) ──
        //
        // ⚠️ Это отличается от htmlUsage:
        //    • htmlUsage — только write/mixed (для UI)
        //    • domApiCalls — ВСЕ вызовы (для статистики)
        (fn as any).domApiCalls = calls.map((c: any) => c.id);

        // ── Обогатить handler-функции ──
        //
        // Если вызов — addEventListener('click', handlerFn),
        // добавляем в handlerFn.domApiUsagesAsHandler запись
        // с информацией об этом вызове.
        //
        // Это обратная связь: "эта функция — обработчик
        // клика по кнопке X".
        for (const call of calls) {
            if (call.category === 'add-event-listener' && call.context?.handlerFunctionId) {
                const handlerFn = functions.find(f => f.id === call.context.handlerFunctionId);

                if (handlerFn) {
                    // Инициализировать массив
                    if (!(handlerFn as any).domApiUsagesAsHandler) {
                        (handlerFn as any).domApiUsagesAsHandler = [];
                    }

                    (handlerFn as any).domApiUsagesAsHandler.push({
                        callId: call.id,
                        category: call.category,
                        eventName: call.context.eventName || '?',
                        target: call.target,
                        line: call.line,
                    });
                }
            }
        }
    }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default pass6DomApi;
