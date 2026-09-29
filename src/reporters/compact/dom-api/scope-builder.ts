// src/reporters/compact/dom-api/scope-builder.ts
// ============================================================
// ПОСТРОЕНИЕ SCOPE ДЛЯ ФУНКЦИИ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Строит ScopeInternal для одной функции. Scope содержит:
//   • locals   — локальные переменные
//   • imports  — импорты
//   • globals  — глобальные имена
//   • refs     — Vue ref-ы
//
// Используется в detector.ts::detectDomApiCallsForFunction().
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ
// ════════════════════════════════════════════════════════════
//
//   1. entitiesMap[scriptPath] — Variables, Constants, Functions,
//      Imports. Это основной источник.
//
//   2. ts-morph SourceFile — рекурсивный обход VariableDeclaration
//      для обнаружения ref/computed/DOM-элементов.
//
// ════════════════════════════════════════════════════════════
// FALLBACK-ПОИСК SOURCEFILE
// ════════════════════════════════════════════════════════════
//
//   1. tsProject.getSourceFile(scriptPath)       — виртуальный
//   2. tsProject.getSourceFile(originalAbsolutePath) — реальный
//   3. tsProject.addSourceFileAtPath(originalAbsolutePath) — с диска
//   4. tsProject.addSourceFileAtPath(scriptPath) — с диска
//
//   Если ничего не нашли — scope.sourceFile = null.
//   В этом случае detector вернёт [] для функции, но scope
//   всё равно возвращается (не null), чтобы вызывающий код
//   мог использовать locals/imports/refs.
//
// ════════════════════════════════════════════════════════════
// ОБРАБОТКА ОШИБОК
// ════════════════════════════════════════════════════════════
//
//   Функция НЕ бросает исключений и НЕ возвращает null.
//   При любой ошибке возвращает ScopeInternal с тем, что
//   успело заполниться.
// ============================================================

import fs from 'fs';
import { Node as TsNode } from 'ts-morph';
import type { EntitiesResult } from '../../../types.js';
import type { ScopeInternal, ScopeLocal } from './types.js';

// ============================================================
// ЭВРИСТИКИ
// ============================================================

/**
 * Проверяет, является ли CallExpression вызовом Vue ref-фабрики.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ ФАБРИКИ
 * ════════════════════════════════════════════════════════════
 *
 *   • ref()         — Vue 3
 *   • shallowRef()  — Vue 3
 *   • computed()    — Vue 3
 *   • reactive()    — Vue 3
 *   • customRef()   — Vue 3
 *   • toRef()       — Vue 3
 *   • toRefs()      — Vue 3
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   isRefCall(callExpression)  // для `ref(null)` → true
 *   isRefCall(callExpression)  // для `foo()`    → false
 */
export function isRefCall(node: any): boolean {
    if (!TsNode.isCallExpression(node)) return false;
    const expr = node.getExpression();
    if (!TsNode.isIdentifier(expr)) return false;
    const name = expr.getText();
    return ['ref', 'shallowRef', 'computed', 'reactive', 'customRef', 'toRef', 'toRefs'].includes(name);
}

/**
 * Проверяет, является ли CallExpression созданием DOM-элемента.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ ВЫЗОВЫ
 * ════════════════════════════════════════════════════════════
 *
 *   • document.createElement(...)
 *   • document.querySelector(...)
 *   • document.getElementById(...)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const el = document.createElement('div');
 *   // → isDomElementCreation(init) === true
 */
export function isDomElementCreation(node: any): boolean {
    if (!TsNode.isCallExpression(node)) return false;
    const expr = node.getExpression();
    if (!TsNode.isPropertyAccessExpression(expr)) return false;
    const text = expr.getText();
    return text === 'document.createElement' || text === 'document.querySelector' ||
        text === 'document.getElementById';
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит scope для функции.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создать ScopeInternal с пустыми locals/imports/refs
 *      и предзаполненным globals.
 *
 *   2. Заполнить locals/imports/refs из entitiesMap[scriptPath]:
 *      a. variables[] → locals (subkind: 'constant')
 *      b. constants[] → locals (subkind: 'constant')
 *      c. functions[] → locals (functionId, subkind: 'function')
 *      d. imports[]   → imports (sourceFileId = imp.toFileId)
 *      e. variables[] с именами *Ref/*El → refs
 *
 *   3. Найти SourceFile через ts-morph (см. fallback-поиск).
 *
 *   4. Если SourceFile найден — обойти VariableDeclaration
 *      рекурсивно и дополнить locals/refs:
 *      a. isRefCall(init)          → locals.isRef = true, refs.add
 *      b. isDomElementCreation(init) → locals.isDomElement = true
 *
 *   5. Вернуть ScopeInternal.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   _fn                  — узел функции (не используется)
 *   scriptPath           — виртуальный путь (.vue.__dom__.ts)
 *   fileId               — ID файла (f1, f2, ...)
 *   entitiesMap          — карта { filePath → EntitiesResult }
 *   tsProject            — ts-morph Project
 *   originalAbsolutePath — реальный путь (.vue или .ts)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const scope = buildScopeForFunction(
 *     fn,
 *     '/abs/path/App.vue.__dom__.ts',
 *     'f18',
 *     entitiesMap,
 *     tsProject,
 *     '/abs/path/App.vue'
 *   );
 *   // scope.locals.get('dataTableRef')?.isRef === true
 */
export function buildScopeForFunction(
    _fn: any,
    scriptPath: string,
    fileId: string,
    entitiesMap: Record<string, EntitiesResult>,
    tsProject: any,
    originalAbsolutePath?: string
): ScopeInternal | null {
    // ────────────────────────────────────────────────────────
    // Шаг 1: базовый ScopeInternal
    // ────────────────────────────────────────────────────────
    const scope: ScopeInternal = {
        fileId,
        sourceFile: null,
        locals: new Map(),
        imports: new Map(),
        globals: new Set([
            'window', 'document', 'globalThis', 'console', 'Math', 'JSON',
            'Object', 'Array', 'Promise', 'Date', 'RegExp', 'Error',
            'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Number',
            'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        ]),
        refs: new Set(),
    };

    // ────────────────────────────────────────────────────────
    // Шаг 2: заполнение из entitiesMap
    // ────────────────────────────────────────────────────────

    // 2.1. Найти entities по scriptPath или originalAbsolutePath
    const entities =
        entitiesMap[scriptPath] ?? entitiesMap[originalAbsolutePath ?? ''] ?? null;

    if (entities) {
        // 2.2. Variables → locals (subkind: 'constant')
        for (const v of entities.variables || []) {
            if (v.name) scope.locals.set(v.name, { subkind: 'constant' });
        }

        // 2.3. Constants → locals (subkind: 'constant')
        for (const c of entities.constants || []) {
            if (c.name) scope.locals.set(c.name, { subkind: 'constant' });
        }

        // 2.4. Functions → locals (functionId, subkind: 'function')
        for (const f of entities.functions || []) {
            if (f.name) {
                scope.locals.set(f.name, { functionId: f.id, subkind: 'function' });
            }
        }
    }

    // 2.5. Imports → imports (sourceFileId = imp.toFileId)
    if (entities) {
        for (const imp of entities.imports || []) {
            for (const spec of imp.specifiers || []) {
                const s = typeof spec === 'string' ? { local: spec, imported: spec } : spec;
                if (s.local) {
                    scope.imports.set(s.local, { sourceFileId: (imp as any).toFileId });
                }
            }
        }
    }

    // 2.6. Эвристика refs: имена *Ref/*El
    if (entities) {
        for (const v of entities.variables || []) {
            if (v.name && (v.name.endsWith('Ref') || v.name.endsWith('El'))) {
                scope.refs.add(v.name);
            }
        }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3-4: SourceFile через ts-morph + обход VariableDeclaration
    // ────────────────────────────────────────────────────────
    try {
        // 3.1. Поиск SourceFile по scriptPath
        let sf = tsProject.getSourceFile(scriptPath);

        // 3.2. Fallback: originalAbsolutePath
        if (!sf && originalAbsolutePath) {
            sf = tsProject.getSourceFile(originalAbsolutePath);
        }

        // 3.3. Fallback: добавить с диска по originalAbsolutePath
        if (!sf && originalAbsolutePath && fs.existsSync(originalAbsolutePath)) {
            try {
                sf = tsProject.addSourceFileAtPath(originalAbsolutePath);
            } catch {
                // ignore
            }
        }

        // 3.4. Fallback: добавить с диска по scriptPath
        if (!sf && fs.existsSync(scriptPath)) {
            try {
                sf = tsProject.addSourceFileAtPath(scriptPath);
            } catch {
                // ignore
            }
        }

        // 4. Обход VariableDeclaration, если SourceFile найден
        if (sf) {
            scope.sourceFile = sf;

            sf.forEachDescendant((node: any) => {
                if (TsNode.isVariableDeclaration(node)) {
                    const name = node.getName();
                    if (name && !scope.locals.has(name)) {
                        const init = node.getInitializer();
                        const isRef = init ? isRefCall(init) : false;
                        const isDom = init ? isDomElementCreation(init) : false;

                        const local: ScopeLocal = {
                            isRef,
                            isDomElement: isDom,
                            subkind: 'constant',
                        };
                        scope.locals.set(name, local);

                        if (isRef) scope.refs.add(name);
                    }
                }
            });
        } else if (process.env.AST_DEBUG_VUE === 'true') {
            // 3.5. Диагностика
            console.warn(
                `   ⚠️ buildScopeForFunction: SourceFile не найден ни по scriptPath, ни по originalAbsolutePath`
            );
            console.warn(`      scriptPath: ${scriptPath}`);
            console.warn(`      originalAbsolutePath: ${originalAbsolutePath ?? '<не задан>'}`);
        }
    } catch (err) {
        // 4.5. Обработка исключений — не возвращаем null, продолжаем
        if (process.env.AST_DEBUG_VUE === 'true') {
            console.warn(`   ⚠️ buildScopeForFunction: exception:`, err);
        }
    }

    return scope;
}
