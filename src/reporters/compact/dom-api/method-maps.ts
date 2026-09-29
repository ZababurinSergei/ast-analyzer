// src/reporters/compact/dom-api/method-maps.ts
// ============================================================
// КАРТЫ DOM-МЕТОДОВ / СВОЙСТВ / НАБЛЮДАТЕЛЕЙ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Содержит три карты для детектора DOM API-вызовов:
//
//   1. DOM_METHOD_MAP_LOCAL     — 33 метода
//   2. DOM_PROPERTY_MAP_LOCAL   — 13 свойств
//   3. DOM_OBSERVER_MAP_LOCAL   — 4 наблюдателя
//
// Итого: 50 записей = 50 категорий в legend.codes.domApiCategory.
//
// Используется в detector.ts::detectDomApiCallsForFunction().
//
// ════════════════════════════════════════════════════════════
// СТРУКТУРА КАЖДОЙ КАРТЫ
// ════════════════════════════════════════════════════════════
//
//   DOM_METHOD_MAP_LOCAL:
//     ключ  = имя метода ('appendChild', 'addEventListener')
//     значение = DomMethodInfoLocal { category, effect }
//
//   DOM_PROPERTY_MAP_LOCAL:
//     ключ  = имя свойства ('innerHTML', 'classList')
//     значение = DomMethodInfoLocal { category, effect }
//
//   DOM_OBSERVER_MAP_LOCAL:
//     ключ  = имя конструктора ('MutationObserver')
//     значение = category (строка)
//
// ════════════════════════════════════════════════════════════
// СИНХРОНИЗАЦИЯ
// ════════════════════════════════════════════════════════════
//
//   Все три карты синхронизированы с:
//     • src/core/dom-api-detector.ts (эталон)
//     • src/reporters/codec/codec-legend.ts (коды категорий)
//
//   Если добавили метод/свойство/наблюдатель — синхронизируйте
//   с core/dom-api-detector.ts и codec-legend.ts.
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЛОКАЛЬНЫЕ КОПИИ
// ════════════════════════════════════════════════════════════
//
//   Изначально карты жили в core/dom-api-detector.ts, но
//   compact-reporter.ts их дублировал локально, чтобы избежать
//   циклических импортов через reporters → core → reporters.
//
//   При рефакторинге мы сохранили локальные копии в этой
//   подсистеме, чтобы pipeline не зависел от core/.
// ============================================================

// ✅ Тип определён в ./types.ts, чтобы избежать циклического
//    импорта (method-maps.ts → types.ts, но не наоборот).
import type { DomMethodInfoLocal } from './types.js';

// ============================================================
// 1. DOM_METHOD_MAP_LOCAL — 33 метода
// ============================================================
//
// Сгруппировано по категориям:
//   • Слушатели событий       — 3
//   • Создание / вставка       — 9
//   • Содержимое               — 3
//   • Атрибуты                 — 5
//   • Запросы                  — 9
//   • Прочее                   — 4
//
// Итого: 33 маппинга методов.
//
// ⚠️ Наблюдатели (MutationObserver и др.) НЕ здесь — они
//    в DOM_OBSERVER_MAP_LOCAL, потому что обрабатываются
//    через NewExpression, а не CallExpression.
// ============================================================

export const DOM_METHOD_MAP_LOCAL: Record<string, DomMethodInfoLocal> = {
    // ==========================================================
    // СЛУШАТЕЛИ СОБЫТИЙ (3)
    // ==========================================================
    //
    // effect = 'mixed' для add/removeEventListener, потому что
    // они и подписываются (write), и сохраняют ссылку на handler
    // (read).
    //
    // dispatchEvent — только write (инициирует событие).
    // ==========================================================

    addEventListener: { category: 'add-event-listener', effect: 'mixed' },
    removeEventListener: { category: 'remove-event-listener', effect: 'mixed' },
    dispatchEvent: { category: 'dispatch-event', effect: 'write' },

    // ==========================================================
    // СОЗДАНИЕ / ВСТАВКА (9)
    // ==========================================================

    createElement: { category: 'create-element', effect: 'write' },
    appendChild: { category: 'append-child', effect: 'write' },
    insertBefore: { category: 'insert-before', effect: 'write' },
    removeChild: { category: 'remove-child', effect: 'write' },
    replaceChild: { category: 'replace-child', effect: 'write' },
    cloneNode: { category: 'clone-node', effect: 'write' },
    importNode: { category: 'import-node', effect: 'write' },
    adoptNode: { category: 'adopt-node', effect: 'write' },

    // ==========================================================
    // СОДЕРЖИМОЕ (3)
    // ==========================================================
    //
    // insertAdjacentHTML / Element / Text — три варианта вставки
    // относительно существующего узла.
    // ==========================================================

    insertAdjacentHTML: { category: 'insert-adjacent-html', effect: 'write' },
    insertAdjacentElement: { category: 'insert-adjacent-element', effect: 'write' },
    insertAdjacentText: { category: 'insert-adjacent-text', effect: 'write' },

    // ==========================================================
    // АТРИБУТЫ (5)
    // ==========================================================
    //
    // getAttribute / hasAttribute — только read (не влияют на UI).
    // setAttribute / removeAttribute / toggleAttribute — write.
    // ==========================================================

    setAttribute: { category: 'set-attribute', effect: 'write' },
    removeAttribute: { category: 'remove-attribute', effect: 'write' },
    getAttribute: { category: 'get-attribute', effect: 'read' },
    hasAttribute: { category: 'has-attribute', effect: 'read' },
    toggleAttribute: { category: 'toggle-attribute', effect: 'write' },

    // ==========================================================
    // ЗАПРОСЫ (9)
    // ==========================================================
    //
    // Все запросы — effect = 'read' (только чтение DOM).
    // В isHtmlVisible они НЕ попадают.
    // ==========================================================

    querySelector: { category: 'query-selector', effect: 'read' },
    querySelectorAll: { category: 'query-selector-all', effect: 'read' },
    getElementById: { category: 'get-element-by-id', effect: 'read' },
    getElementsByClassName: { category: 'get-elements-by-class', effect: 'read' },
    getElementsByTagName: { category: 'get-elements-by-tag', effect: 'read' },
    getElementsByName: { category: 'get-elements-by-name', effect: 'read' },
    closest: { category: 'closest', effect: 'read' },
    matches: { category: 'matches', effect: 'read' },
    getRootNode: { category: 'get-root-node', effect: 'read' },

    // ==========================================================
    // ПРОЧЕЕ (4)
    // ==========================================================

    focus: { category: 'focus', effect: 'write' },
    blur: { category: 'blur', effect: 'write' },
    scrollIntoView: { category: 'scroll-into-view', effect: 'write' },
    scrollTo: { category: 'scroll-to', effect: 'write' },
    click: { category: 'click-programmatic', effect: 'write' },
};

// ============================================================
// 2. DOM_PROPERTY_MAP_LOCAL — 13 свойств
// ============================================================
//
// Обрабатываются через BinaryExpression (`=`) в detector.ts:
//   el.innerHTML = '...'
//   el.style.color = 'red'
//   el.classList.add('active')
//
// ⚠️ Отличие от методов: свойство не вызывается как функция,
//    а присваивается. Поэтому детектор проверяет:
//      - node — BinaryExpression с operator '='
//      - left — PropertyAccessExpression
//      - propName ∈ DOM_PROPERTY_MAP_LOCAL
//
// Сгруппировано:
//   • Содержимое       — 4
//   • Прочие свойства  — 9
// ============================================================

export const DOM_PROPERTY_MAP_LOCAL: Record<string, DomMethodInfoLocal> = {
    // ==========================================================
    // СОДЕРЖИМОЕ (4)
    // ==========================================================

    innerHTML: { category: 'inner-html', effect: 'write' },
    outerHTML: { category: 'outer-html', effect: 'write' },
    textContent: { category: 'text-content', effect: 'write' },
    innerText: { category: 'inner-text', effect: 'write' },

    // ==========================================================
    // ПРОЧИЕ СВОЙСТВА (9)
    // ==========================================================
    //
    // ⚠️ 'set-property' — общий код для многих свойств:
    //     className, value, checked, disabled, src, href.
    //     Это ожидаемо: детализация до конкретного свойства
    //     не нужна для UI-маркировки.
    //
    // ⚠️ 'dataset', 'style-set', 'class-list' — отдельные коды,
    //     потому что они часто используются и важны для
    //     фильтрации.
    // ==========================================================

    className: { category: 'set-property', effect: 'write' },
    dataset: { category: 'dataset', effect: 'write' },
    style: { category: 'style-set', effect: 'write' },
    classList: { category: 'class-list', effect: 'write' },
    value: { category: 'set-property', effect: 'write' },
    checked: { category: 'set-property', effect: 'write' },
    disabled: { category: 'set-property', effect: 'write' },
    src: { category: 'set-property', effect: 'write' },
    href: { category: 'set-property', effect: 'write' },
};

// ============================================================
// 3. DOM_OBSERVER_MAP_LOCAL — 4 наблюдателя
// ============================================================
//
// Обрабатываются через NewExpression в detector.ts:
//   new MutationObserver(callback)
//   new ResizeObserver(callback)
//
// ⚠️ Значение — просто строка category (не DomMethodInfoLocal),
//    потому что у наблюдателей всегда effect = 'write'.
//
// Использование:
//   const ctorName = node.getExpression().getText();
//   const category = DOM_OBSERVER_MAP_LOCAL[ctorName];
//   if (category) { ... }
// ============================================================

export const DOM_OBSERVER_MAP_LOCAL: Record<string, string> = {
    MutationObserver: 'mutation-observer',
    ResizeObserver: 'resize-observer',
    IntersectionObserver: 'intersection-observer',
    PerformanceObserver: 'performance-observer',
};
