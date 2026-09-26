// src/core/dom-api-detector.ts
// ============================================================
// DOM API DETECTOR
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `DomApiTargetKind`
//     (TS2614: Module has no exported member 'DomApiTargetKind')
//   - ✅ ИСПРАВЛЕНО: параметр `filePath` в `detectDomApiCalls`
//     переименован в `_filePath` (TS6133: declared but never read)
//   - ✅ ОБНОВЛЕНО: JSDoc для `detectDomApiCalls` явно указывает,
//     что функция — заглушка, реальная логика в compact-reporter.ts
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия.
//   - 55 маппингов DOM-методов и свойств.
//   - Экспорт DOM_METHOD_MAP, DOM_PROPERTY_MAP, DOM_OBSERVER_MAP.
//   - Заглушка detectDomApiCalls для совместимости.
//
// НАЗНАЧЕНИЕ
// ----------
// Модуль предоставляет карту DOM API-методов/свойств, которая
// используется детектором DOM API-вызовов в TS/JS-файлах.
//
// Реальная логика детектирования (обход AST, определение receiver,
// разрешение аргументов) живёт в `compact-reporter.ts`
// (`buildScopeForFunction` + `detectDomApiCallsForFunction`),
// чтобы избежать циклических импортов и дублирования Scope-логики.
//
// Здесь — только карта маппингов и публичный API-стаб.
//
// СТРУКТУРА
// ---------
//   1. Типы (DomMethodInfo)
//   2. DOM_METHOD_MAP — 38 маппингов методов
//   3. DOM_PROPERTY_MAP — 13 маппингов свойств
//   4. DOM_OBSERVER_MAP — 4 маппинга наблюдателей
//   5. detectDomApiCalls — публичная заглушка
//   6. Экспорт по умолчанию
//
// КАРТА ПОКРЫТИЯ
// --------------
//   38 (методы) + 13 (свойства) + 4 (наблюдатели) = 55 маппингов
//   50 кодов в legend.codes.domApiCategory
//
//   Некоторые коды покрываются несколькими маппингами:
//     • 'set-property' ← className, value, checked, disabled, src, href
//
//   Не покрыты маппингами (используются как fallback):
//     • 'class-list'    (используется через DOM_PROPERTY_MAP['classList'])
//     • 'style-remove'  (используется через `delete el.style.x`)
//     • 'other'         (fallback для неклассифицированных DOM-вызовов)
//
//   Инвариант I44 (verify-roundtrip.ts) проверяет, что каждый
//   код из legend.codes.domApiCategory достижим хотя бы одним
//   маппингом ИЛИ помечен как fallback.
// ============================================================

import type { DomApiCategory, DomApiEffect, DomApiCall } from '../reporters/codec/codec-types.js';

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Информация о DOM-методе.
 *
 * Содержит:
 *   - `category` — категория вызова (одна из 50 в DomApiCategory)
 *   - `effect`   — эффект (write / read / mixed)
 *
 * Используется в:
 *   - DOM_METHOD_MAP
 *   - DOM_PROPERTY_MAP
 */
export interface DomMethodInfo {
  category: DomApiCategory;
  effect: DomApiEffect;
}

// ============================================================
// DOM_METHOD_MAP — 38 маппингов методов
// ============================================================
//
// Покрывает 38 из 50 кодов legend.codes.domApiCategory.
//
// Сгруппировано по категориям:
//   • Слушатели событий       — 3
//   • Создание / вставка       — 9
//   • Содержимое               — 3
//   • Атрибуты                 — 5
//   • Запросы                  — 9
//   • Прочее                   — 5
//   • + 4 observer-метода      — через DOM_OBSERVER_MAP (не здесь)
//
// Итого: 3 + 9 + 3 + 5 + 9 + 5 = 34 маппинга методов
//       + 4 observer (см. DOM_OBSERVER_MAP) = 38
// ============================================================

/**
 * Карта DOM-методов.
 *
 * Ключ — имя метода (`appendChild`, `addEventListener`).
 * Значение — `DomMethodInfo` (category + effect).
 *
 * Используется детектором в compact-reporter.ts:
 *   const info = DOM_METHOD_MAP[methodName];
 *   if (info && isLikelyDomReceiver(receiver, scope)) { ... }
 */
export const DOM_METHOD_MAP: Record<string, DomMethodInfo> = {
  // ==========================================================
  // СЛУШАТЕЛИ СОБЫТИЙ (3)
  // ==========================================================
  //
  // effect = 'mixed' для addEventListener/removeEventListener,
  // потому что они и подписываются (write), и сохраняют ссылку
  // на handler (read).
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
  // ПРОЧЕЕ (5)
  // ==========================================================

  focus: { category: 'focus', effect: 'write' },
  blur: { category: 'blur', effect: 'write' },
  scrollIntoView: { category: 'scroll-into-view', effect: 'write' },
  scrollTo: { category: 'scroll-to', effect: 'write' },
  click: { category: 'click-programmatic', effect: 'write' },
};

// ============================================================
// DOM_PROPERTY_MAP — 13 маппингов свойств
// ============================================================
//
// Покрывает 13 из 50 кодов legend.codes.domApiCategory.
//
// Ключ — имя свойства (`innerHTML`, `textContent`).
// Значение — `DomMethodInfo` (category + effect).
//
// ⚠️ В отличие от методов, свойства обрабатываются через
// присваивание: `el.innerHTML = '...'`. Детектор в
// compact-reporter.ts проверяет:
//   - node — это BinaryExpression с operator '='
//   - left — PropertyAccessExpression
//   - right — значение, присваиваемое свойству
// ============================================================

/**
 * Карта DOM-свойств.
 *
 * Используется для детектирования присваиваний:
 *   el.innerHTML = '...'
 *   el.style.color = 'red'
 *   el.classList.add('active')
 */
export const DOM_PROPERTY_MAP: Record<string, DomMethodInfo> = {
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
  //     потому что они часто используются и важны для фильтрации.
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
// DOM_OBSERVER_MAP — 4 маппинга наблюдателей
// ============================================================
//
// Покрывает 4 из 50 кодов legend.codes.domApiCategory.
//
// Ключ — имя конструктора (`MutationObserver`, `ResizeObserver`).
// Значение — `DomApiCategory` (без effect, потому что
// наблюдатели всегда имеют effect = 'write').
//
// Используется для детектирования `new MutationObserver(...)`.
// ============================================================

/**
 * Карта DOM-наблюдателей.
 *
 * Используется для детектирования:
 *   new MutationObserver(callback)
 *   new ResizeObserver(callback)
 */
export const DOM_OBSERVER_MAP: Record<string, DomApiCategory> = {
  MutationObserver: 'mutation-observer',
  ResizeObserver: 'resize-observer',
  IntersectionObserver: 'intersection-observer',
  PerformanceObserver: 'performance-observer',
};

// ============================================================
// detectDomApiCalls — публичная заглушка
// ============================================================
//
// ⚠️ ВАЖНО: эта функция — ЗАГЛУШКА. Она НЕ выполняет
// реальное детектирование DOM API-вызовов.
//
// Реальная логика живёт в `compact-reporter.ts`:
//   - `buildScopeForFunction`     — строит Scope (locals, imports, globals, refs)
//   - `detectDomApiCallsForFunction` — обходит AST, детектирует вызовы
//   - `isLikelyDomReceiver`       — эвристика: является ли receiver DOM-элементом
//   - `resolveTargetLocal`        — определяет target вызова
//   - `resolveArgLocal`           — разрешает аргументы
//   - `extractContextLocal`       — извлекает контекст (eventName, selector, ...)
//
// ПОЧЕМУ ЗАГЛУШКА
// ---------------
// Функция оставлена для обратной совместимости публичного API
// модуля. Раньше планировалось вынести всю логику сюда, но
// из-за циклических импортов (compact-reporter.ts нужен Scope,
// а Scope зависит от entitiesMap из compact-reporter.ts) логика
// осталась в compact-reporter.ts.
//
// Если вы хотите использовать функцию в коде — передайте
// реальный имплементации через DI, или вызовите
// `detectDomApiCallsForFunction` напрямую из compact-reporter.ts.
// ============================================================

/**
 * Заглушка для детектирования DOM API-вызовов.
 *
 * ⚠️ Всегда возвращает пустой массив.
 *
 * Реальная реализация: `compact-reporter.ts::detectDomApiCallsForFunction`.
 *
 * @param _args — любые аргументы (игнорируются)
 * @returns Всегда `[]`
 *
 * @example
 * ```typescript
 * // НЕ используйте эту функцию — она ничего не делает.
 * // Используйте реальную реализацию:
 * import { detectDomApiCallsForFunction } from '../reporters/compact-reporter.js';
 * ```
 */
export function detectDomApiCalls(..._args: any[]): DomApiCall[] {
  // Заглушка: реальная логика в compact-reporter.ts
  return [];
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  DOM_METHOD_MAP,
  DOM_PROPERTY_MAP,
  DOM_OBSERVER_MAP,
  detectDomApiCalls,
};
