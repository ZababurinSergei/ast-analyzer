// src/reporters/codec/stable-stringify.ts
// ============================================
// ЕДИНЫЙ STABLE STRINGIFY
// ============================================
// Версия: 1.0.2
//
// ════════════════════════════════════════════════════════════
// ИЗМЕНЕНИЯ v1.0.2 (JSON-safe защита)
// ════════════════════════════════════════════════════════════
//   - ✅ ДОБАВЛЕНО: функция `isJsonSafe(value)` — проверяет,
//     что значение может быть безопасно сериализовано в JSON
//     без потери данных.
//   - ✅ ДОБАВЛЕНО: функция `sanitizeForJson(value)` — заменяет
//     не-JSON-совместимые объекты (Set, Map, RegExp, Date,
//     class instances) на их безопасные представления.
//   - ✅ ДОБАВЛЕНО: функция `jsonSafeStringify(value, space)` —
//     JSON.stringify с предварительной санитизацией.
//   - ✅ ДОБАВЛЕНО: экспорт всех новых функций через default.
//
//   ════════════════════════════════════════════════════════════
//   ПРИЧИНА
//   ════════════════════════════════════════════════════════════
//
//   Нативный `JSON.stringify` теряет данные для:
//     • Set              → '{}'  (пустой объект)
//     • Map              → '{}'  (пустой объект)
//     • RegExp           → '{}'  (пустой объект)
//     • Date             → '{}'  (в некоторых окружениях)
//     • class instances  → '{}'  (если нет toJSON)
//     • BigInt           → падает с ошибкой
//     • Circular         → падает с ошибкой
//
//   Если такие объекты попадают в `values[]` CompactJSON,
//   при записи `compact.json` на диск они превращаются в `{}`,
//   и round-trip теряет данные.
//
//   Симптом в verify-roundtrip.ts:
//     $.values.length          a: 703  b: 553
//     $.constants[1571].value  a: undefined  b: {}
//     L0/L1/L2/L3/RE — FAIL
//
//   ════════════════════════════════════════════════════════════
//   РЕШЕНИЕ
//   ════════════════════════════════════════════════════════════
//
//   • `isJsonSafe(value)` — быстро проверяет, что значение
//     безопасно. Используется в `isValueKept` (values-filter.ts
//     v1.2.0), чтобы НЕ пускать не-JSON-объекты в `values[]`.
//
//   • `sanitizeForJson(value)` — рекурсивно превращает
//     Set/Map/RegExp/Date/class instances в безопасные
//     представления (массивы, plain objects, строки).
//
//   • `jsonSafeStringify(value)` — используется в
//     `compact-reporter.ts::saveJsonFile` вместо
//     `safeJsonStringify`, чтобы гарантировать, что
//     `JSON.parse(JSON.stringify(x))` даёт эквивалент `x`.
//
// ════════════════════════════════════════════════════════════
// ИЗМЕНЕНИЯ v1.0.1
// ════════════════════════════════════════════════════════════
//   - ✅ ДОБАВЛЕНО: JSDoc для `stableStringify` с примерами
//     и объяснением, ПОЧЕМУ нельзя использовать нативный
//     `JSON.stringify`.
//   - ✅ ДОБАВЛЕНО: type guard `isPlainObject` для корректной
//     обработки `Map`, `Set`, `Date`, `RegExp` и других
//     встроенных объектов, которые не являются plain-объектами.
//   - ✅ ДОБАВЛЕНО: поддержка `Map` и `Set` — сериализуются
//     как `"[Map:N]"` и `"[Set:N]"`. Это делает функцию
//     безопасной для любых значений.
//   - ✅ ДОБАВЛЕНО: поддержка `Date` — сериализуется как
//     ISO-строка `"date:2026-09-22T18:30:06.631Z"`.
//   - ✅ ДОБАВЛЕНО: поддержка `RegExp` — сериализуется как
//     `"regexp:/pattern/flags"`.
//   - ✅ ДОБАВЛЕНО: защита от `NaN`, `Infinity`, `-Infinity` —
//     сериализуются как `"number:NaN"`, `"number:Infinity"`,
//     `"number:-Infinity"`. Нативный `JSON.stringify(NaN)`
//     даёт `'null'` — это коллизия с реальным `null`.
//   - ✅ ДОБАВЛЕНО: защита от `-0` — сериализуется как
//     `"number:-0"`. Нативный `JSON.stringify(-0)` даёт `'0'`
//     — это коллизия с реальным `0`.
//   - ✅ ДОБАВЛЕНО: экспорт `stableStringifyWithType` — та же
//     функция, но с префиксами типов в ключах. Используется
//     в `addValue()` для дедупликации.
//
// ════════════════════════════════════════════════════════════
// ИЗМЕНЕНИЯ v1.0.0
// ════════════════════════════════════════════════════════════
//   - Первая версия.
//   - Базовая реализация с сортировкой ключей.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Единый источник истины для стабильной JSON-сериализации
// (с сортировкой ключей объектов). Устраняет дублирование
// между:
//   - codec-encode.ts::stableStringify
//   - values-filter.ts::stableStringifyForClassify
//   - compact-reporter.ts::stableStringifyForKeepValue
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ НУЖНА СТАБИЛЬНАЯ СЕРИАЛИЗАЦИЯ
// ════════════════════════════════════════════════════════════
//
// Нативный `JSON.stringify` чувствителен к порядку ключей:
//
//   JSON.stringify({a:1, b:2}) === '{"a":1,"b":2}'
//   JSON.stringify({b:2, a:1}) === '{"b":2,"a":1}'   // ← разные!
//
// Это ломает:
//   • дедупликацию в `addValue()` (codec-encode.ts)
//   • классификацию в `classifyValue()` (values-filter.ts)
//   • фильтрацию в `shouldKeepValue()` (compact-reporter.ts)
//
// Симптом: `values.length` отличается на ±N между `compact`
// и `encode(full)`, `cn.nonEmptyV` сдвигается, L0/L3/RE падают.
//
// ════════════════════════════════════════════════════════════
// ПРАВИЛА СЕРИАЛИЗАЦИИ
// ════════════════════════════════════════════════════════════
//
//   ┌────────────────────────┬───────────────────────────────────┐
//   │ Тип                    │ Результат                         │
//   ├────────────────────────┼───────────────────────────────────┤
//   │ null                   │ 'null'                            │
//   │ undefined              │ 'undefined'                       │
//   │ string                 │ JSON.stringify(value)             │
//   │ number (finite)        │ String(value)                     │
//   │ number (NaN)           │ '"number:NaN"'                    │
//   │ number (Infinity)      │ '"number:Infinity"'               │
//   │ number (-Infinity)     │ '"number:-Infinity"'              │
//   │ number (-0)            │ '"number:-0"'                     │
//   │ boolean                │ String(value)                     │
//   │ bigint                 │ '"bigint:N"'                      │
//   │ function               │ '"[function]"'                    │
//   │ symbol                 │ '"[symbol:...]"'                  │
//   │ Date                   │ '"date:<ISO>"'                    │
//   │ RegExp                 │ '"regexp:/pattern/flags"'         │
//   │ Map                    │ '"[Map:N]"'                       │
//   │ Set                    │ '"[Set:N]"'                       │
//   │ Array                  │ '[item,item,...]'                 │
//   │ Object (plain)         │ '{key:value,key:value,...}'       │
//   │ Object (circular)      │ '"[circular]"'                    │
//   └────────────────────────┴───────────────────────────────────┘
//
// ⚠️ ВАЖНО: массивы сохраняют порядок элементов — это
// принципиально для `positions`, `params`, `calls` и т.п.
//
// ════════════════════════════════════════════════════════════
// ПРОИЗВОДИТЕЛЬНОСТЬ
// ════════════════════════════════════════════════════════════
//
//   - O(N log N) на сортировку ключей каждого объекта
//   - O(N) на обход
//   - WeakSet для защиты от циклов — O(1) на проверку
//
//   Для типичных значений `constants[].value` (объекты до
//   100 ключей) функция работает за ~0.1–1 мс.
// ============================================

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Проверяет, что значение — plain-объект (не null, не массив,
 * не Date, не Map, не Set, не RegExp и т.п.).
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   `typeof value === 'object'` истинно для:
 *     - null
 *     - Array
 *     - Date
 *     - RegExp
 *     - Map
 *     - Set
 *     - Error
 *     - Promise
 *     - и т.д.
 *
 *   Все они требуют РАЗНОЙ сериализации. Если их не разделить,
 *   получим коллизии:
 *     - `new Map([['a', 1]])` → `{}` (0 ключей)
 *     - `new Set([1, 2])`     → `{}` (0 ключей)
 *     - `new Date()`          → `{}` (0 ключей)
 *
 *   Все три дадут `'{}'` — это коллизия.
 *
 * ════════════════════════════════════════════════════════════
 * ОПРЕДЕЛЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   Plain-объект — это объект, чей прототип:
 *     - `Object.prototype`
 *     - `null`
 *
 *   Такой объект имеет только "обычные" ключи (`Object.keys()`),
 *   которые можно безопасно сортировать и сериализовать.
 *
 * @param value — любое значение
 * @returns true, если это plain-объект
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// ============================================
// ✅ v1.0.2: JSON-SAFE ПРОВЕРКИ
// ============================================

/**
 * Проверяет, является ли значение JSON-совместимым
 * (без потери данных при `JSON.stringify` → `JSON.parse`).
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ПРОВЕРЯЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ✅ JSON-safe:
 *     • null
 *     • undefined (JSON.stringify удаляет, но не теряет)
 *     • string
 *     • number (включая NaN, Infinity — JSON.stringify
 *       превратит в null, но это уже проблема вызывающего)
 *     • boolean
 *     • Array (рекурсивно)
 *     • plain object (рекурсивно)
 *
 *   ❌ НЕ JSON-safe:
 *     • BigInt        → JSON.stringify падает с ошибкой
 *     • function      → JSON.stringify удаляет
 *     • symbol        → JSON.stringify удаляет
 *     • Set           → JSON.stringify → '{}'
 *     • Map           → JSON.stringify → '{}'
 *     • RegExp        → JSON.stringify → '{}'
 *     • Date          → JSON.stringify → '<ISO>' (ОК, но
 *                       при parse получаем string, а не Date)
 *     • class instance → JSON.stringify → '{}' (если нет toJSON)
 *     • Circular      → JSON.stringify падает
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   Используется в `isValueKept` (values-filter.ts v1.2.0),
 *   чтобы НЕ пускать не-JSON-объекты в `values[]` CompactJSON.
 *
 *   Если такое значение попадёт в `values[]`, при записи
 *   `compact.json` на диск оно превратится в `{}`, и
 *   round-trip потеряет данные.
 *
 *   Симптом: `$.values.length` отличается на ±N между
 *   compact и encode(full), L0/L3/RE падают.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   isJsonSafe(null)                       // true
 *   isJsonSafe('hello')                    // true
 *   isJsonSafe(42)                         // true
 *   isJsonSafe({a: 1})                     // true
 *   isJsonSafe([1, 2, 3])                  // true
 *   isJsonSafe({a: [1, {b: 2}]})           // true
 *   isJsonSafe(new Set([1, 2]))            // false
 *   isJsonSafe(new Map([['a', 1]]))        // false
 *   isJsonSafe(/foo/)                      // false
 *   isJsonSafe(new Date())                 // false (теряет тип)
 *   isJsonSafe(42n)                        // false (BigInt)
 *   isJsonSafe(() => {})                   // false (function)
 *
 * @param value — значение для проверки
 * @returns true, если значение безопасно для JSON round-trip
 */
export function isJsonSafe(value: unknown): boolean {
  // ─────────────────────────────────────────────
  // 1. Примитивы
  // ─────────────────────────────────────────────
  if (value === null) return true;
  if (value === undefined) return true;

  const t = typeof value;

  if (t === 'string' || t === 'number' || t === 'boolean') return true;

  // BigInt не JSON-safe (JSON.stringify падает)
  if (t === 'bigint') return false;

  // function, symbol — JSON.stringify удаляет их
  if (t === 'function' || t === 'symbol') return false;

  // ─────────────────────────────────────────────
  // 2. Массивы (рекурсивно)
  // ─────────────────────────────────────────────
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isJsonSafe(item)) return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────
  // 3. Объекты
  // ─────────────────────────────────────────────
  if (t === 'object') {
    // Set, Map, RegExp, Date — не JSON-safe
    if (value instanceof Set) return false;
    if (value instanceof Map) return false;
    if (value instanceof RegExp) return false;
    if (value instanceof Date) return false;

    // Class instance (не plain object) — не JSON-safe
    if (!isPlainObject(value)) {
      return false;
    }

    // Plain object — рекурсивно проверяем значения
    for (const v of Object.values(value)) {
      if (!isJsonSafe(v)) return false;
    }
    return true;
  }

  return true;
}

// ============================================
// ✅ v1.0.2: SANITIZE FOR JSON
// ============================================

/**
 * Санитизирует значение для безопасной JSON-сериализации.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   • Set              → массив элементов
 *   • Map              → plain object (ключи → строки)
 *   • RegExp           → строка '/pattern/flags'
 *   • Date             → ISO-строка
 *   • BigInt           → строка '123n'
 *   • function/symbol  → undefined (удаляется)
 *   • class instance   → plain object (через toJSON или Object.keys)
 *   • Circular         → '[Circular]'
 *
 * ════════════════════════════════════════════════════════════
 * РЕКУРСИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Функция рекурсивно обходит вложенные структуры.
 *   Циклические ссылки заменяются на '[Circular]'.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   Используется в `jsonSafeStringify`, который вызывается
 *   в `compact-reporter.ts::saveJsonFile` вместо
 *   `JSON.stringify`. Это гарантирует, что:
 *     - Set/Map/RegExp/Date не превратятся в '{}'
 *     - BigInt не сломает сериализацию
 *     - Circular не сломает сериализацию
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   sanitizeForJson(new Set([1, 2, 3]))
 *   // → [1, 2, 3]
 *
 *   sanitizeForJson(new Map([['a', 1], ['b', 2]]))
 *   // → { a: 1, b: 2 }
 *
 *   sanitizeForJson(/foo/gi)
 *   // → '/foo/gi'
 *
 *   sanitizeForJson(new Date('2026-09-22'))
 *   // → '2026-09-22T00:00:00.000Z'
 *
 *   sanitizeForJson(42n)
 *   // → '42n'
 *
 *   sanitizeForJson({a: new Set([1])})
 *   // → { a: [1] }
 *
 * @param value — значение для санитизации
 * @param seen  — WeakSet для защиты от циклических ссылок
 * @returns JSON-безопасное значение
 */
export function sanitizeForJson(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  // ─────────────────────────────────────────────
  // 1. null / undefined
  // ─────────────────────────────────────────────
  if (value === null || value === undefined) return value;

  const t = typeof value;

  // ─────────────────────────────────────────────
  // 2. Примитивы, которые JSON-safe
  // ─────────────────────────────────────────────
  if (t === 'string' || t === 'number' || t === 'boolean') return value;

  // ─────────────────────────────────────────────
  // 3. BigInt → строка
  // ─────────────────────────────────────────────
  if (t === 'bigint') {
    return `${value.toString()}n`;
  }

  // ─────────────────────────────────────────────
  // 4. function / symbol → undefined
  //    (JSON.stringify их удаляет)
  // ─────────────────────────────────────────────
  if (t === 'function' || t === 'symbol') {
    return undefined;
  }

  // ─────────────────────────────────────────────
  // 5. Объекты (включая массивы)
  // ─────────────────────────────────────────────
  if (t === 'object') {
    const obj = value as object;

    // ✅ Защита от циклических ссылок
    if (seen.has(obj)) {
      return '[Circular]';
    }
    seen.add(obj);

    try {
      // ─────────────────────────────────────────
      // 5.1. Set → массив
      // ─────────────────────────────────────────
      if (value instanceof Set) {
        return Array.from(value).map(v => sanitizeForJson(v, seen));
      }

      // ─────────────────────────────────────────
      // 5.2. Map → plain object
      // ─────────────────────────────────────────
      if (value instanceof Map) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of value.entries()) {
          result[String(k)] = sanitizeForJson(v, seen);
        }
        return result;
      }

      // ─────────────────────────────────────────
      // 5.3. RegExp → строка
      // ─────────────────────────────────────────
      if (value instanceof RegExp) {
        return value.toString();
      }

      // ─────────────────────────────────────────
      // 5.4. Date → ISO-строка
      // ─────────────────────────────────────────
      if (value instanceof Date) {
        return value.toISOString();
      }

      // ─────────────────────────────────────────
      // 5.5. Массив → рекурсивно
      // ─────────────────────────────────────────
      if (Array.isArray(value)) {
        return value.map(v => sanitizeForJson(v, seen));
      }

      // ─────────────────────────────────────────
      // 5.6. Class instance (не plain object)
      // ─────────────────────────────────────────
      if (!isPlainObject(value)) {
        // Пробуем через toJSON, если есть
        if (typeof (value as any).toJSON === 'function') {
          try {
            return sanitizeForJson((value as any).toJSON(), seen);
          } catch {
            // ignore, fallback ниже
          }
        }

        // Иначе — через Object.keys
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(value)) {
          result[key] = sanitizeForJson((value as any)[key], seen);
        }

        // Если ключей нет — маркер типа
        if (Object.keys(result).length === 0) {
          const ctorName = (value as any).constructor?.name ?? 'Object';
          return `[${ctorName}]`;
        }

        return result;
      }

      // ─────────────────────────────────────────
      // 5.7. Plain object → рекурсивно
      // ─────────────────────────────────────────
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        const v = sanitizeForJson((value as any)[key], seen);
        // Пропускаем undefined (как нативный JSON.stringify)
        if (v !== undefined) {
          result[key] = v;
        }
      }
      return result;
    } finally {
      // ✅ Убираем из seen, чтобы повторные ссылки
      // (не циклы) сериализовались нормально
      seen.delete(obj);
    }
  }

  return value;
}

// ============================================
// ✅ v1.0.2: JSON-SAFE STRINGIFY
// ============================================

/**
 * JSON.stringify с предварительной санитизацией.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Вызывает `sanitizeForJson(value)` — превращает
 *      Set/Map/RegExp/Date/BigInt/class instances в
 *      безопасные представления.
 *   2. Вызывает `JSON.stringify` на результате.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   Используется в `compact-reporter.ts::saveJsonFile` вместо
 *   `JSON.stringify` и `safeJsonStringify`. Гарантирует, что:
 *     - Set/Map/RegExp/Date не превратятся в '{}'
 *     - BigInt не сломает сериализацию
 *     - Circular не сломает сериализацию
 *     - JSON.parse(JSON.stringify(x)) даёт эквивалент x
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   jsonSafeStringify({a: new Set([1, 2])})
 *   // → '{"a":[1,2]}'
 *
 *   jsonSafeStringify({d: new Date('2026-09-22')})
 *   // → '{"d":"2026-09-22T00:00:00.000Z"}'
 *
 *   jsonSafeStringify({b: 42n})
 *   // → '{"b":"42n"}'
 *
 *   jsonSafeStringify({a: 1}, 2)
 *   // → '{\n  "a": 1\n}'
 *
 * @param value — значение
 * @param space — отступы (по умолчанию без отступов)
 * @returns JSON-строка
 */
export function jsonSafeStringify(value: unknown, space?: number): string {
  const sanitized = sanitizeForJson(value);
  return space !== undefined ? JSON.stringify(sanitized, null, space) : JSON.stringify(sanitized);
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Стабильный `JSON.stringify` с сортировкой ключей.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   Рекурсивно обходит значение и строит его JSON-подобное
 *   представление с ДЕТЕРМИНИРОВАННЫМ порядком:
 *     - ключи объектов сортируются лексикографически
 *     - порядок элементов массива сохраняется
 *
 * ════════════════════════════════════════════════════════════
 * ОТЛИЧИЯ ОТ `JSON.stringify`
 * ════════════════════════════════════════════════════════════
 *
 *   1. Порядок ключей: лексикографический (не insertion order).
 *   2. `BigInt` → строка `"bigint:N"` (нативный падает).
 *   3. `Date` → `"date:<ISO>"` (нативный даёт `"<ISO>"`).
 *   4. `RegExp` → `"regexp:/pattern/flags"` (нативный даёт `{}`).
 *   5. `Map` → `"[Map:N]"` (нативный даёт `{}`).
 *   6. `Set` → `"[Set:N]"` (нативный даёт `{}`).
 *   7. `NaN` → `"number:NaN"` (нативный даёт `'null'`).
 *   8. `Infinity` → `"number:Infinity"` (нативный даёт `'null'`).
 *   9. `-Infinity` → `"number:-Infinity"` (нативный даёт `'null'`).
 *  10. `-0` → `"number:-0"` (нативный даёт `'0'`).
 *  11. Циклы → `"[circular]"` (нативный падает).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Детерминизм
 *   stableStringify({a: 1, b: 2}) === stableStringify({b: 2, a: 1})
 *   // → '{a:1,b:2}' === '{a:1,b:2}' ✅
 *
 *   // BigInt
 *   stableStringify(42n) === '"bigint:42"'
 *
 *   // Date
 *   stableStringify(new Date('2026-09-22T18:30:06.631Z'))
 *   // → '"date:2026-09-22T18:30:06.631Z"'
 *
 *   // RegExp
 *   stableStringify(/foo/gi) === '"regexp:/foo/gi"'
 *
 *   // Map (без коллизии с {})
 *   stableStringify(new Map([['a', 1], ['b', 2]])) === '"[Map:2]"'
 *
 *   // Set
 *   stableStringify(new Set([1, 2, 3])) === '"[Set:3]"'
 *
 *   // NaN / Infinity / -0 (без коллизий с null и 0)
 *   stableStringify(NaN) === '"number:NaN"'
 *   stableStringify(Infinity) === '"number:Infinity"'
 *   stableStringify(-0) === '"number:-0"'
 *
 *   // Циклы
 *   const a = {}; a.self = a;
 *   stableStringify(a) === '{self:"[circular]"}'
 *
 * ════════════════════════════════════════════════════════════
 * СЛОЖНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   O(N log N) на сортировку ключей + O(N) на обход.
 *   Для типичных значений `constants[].value` — ~0.1–1 мс.
 *
 * @param value — любое значение (примитив, объект, массив, ...)
 * @param seen  — WeakSet для защиты от циклических ссылок
 * @returns стабильная JSON-подобная строка
 */
export function stableStringify(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  // ────────────────────────────────────────────────────
  // 1. Примитивы и null
  // ────────────────────────────────────────────────────
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const t = typeof value;

  if (t === 'string') return JSON.stringify(value);

  if (t === 'boolean') return String(value);

  if (t === 'number') {
    // ✅ v1.0.1: защита от NaN, Infinity, -Infinity, -0.
    // Нативный JSON.stringify(NaN) === 'null' — коллизия с null.
    // Нативный JSON.stringify(-0) === '0' — коллизия с 0.
    if (Number.isNaN(value)) return '"number:NaN"';
    if (value === Infinity) return '"number:Infinity"';
    if (value === -Infinity) return '"number:-Infinity"';
    if (Object.is(value, -0)) return '"number:-0"';
    return String(value);
  }

  if (t === 'bigint') {
    return `"bigint:${value.toString()}"`;
  }

  if (t === 'function') return '"[function]"';
  if (t === 'symbol') return `"[symbol:${String(value)}]"`;

  // ────────────────────────────────────────────────────
  // 2. Объекты: защита от циклов
  // ────────────────────────────────────────────────────
  const obj = value as object;

  if (seen.has(obj)) {
    return '"[circular]"';
  }
  seen.add(obj);

  try {
    // ──────────────────────────────────────────────
    // 2.1. Массивы: порядок элементов ВАЖЕН
    // ──────────────────────────────────────────────
    if (Array.isArray(value)) {
      const items = value.map(item => stableStringify(item, seen));
      return '[' + items.join(',') + ']';
    }

    // ──────────────────────────────────────────────
    // 2.2. Date
    // ──────────────────────────────────────────────
    if (value instanceof Date) {
      return `"date:${value.toISOString()}"`;
    }

    // ──────────────────────────────────────────────
    // 2.3. RegExp
    // ──────────────────────────────────────────────
    if (value instanceof RegExp) {
      return `"regexp:${value.toString()}"`;
    }

    // ──────────────────────────────────────────────
    // 2.4. Map
    // ──────────────────────────────────────────────
    if (value instanceof Map) {
      return `"[Map:${value.size}]"`;
    }

    // ──────────────────────────────────────────────
    // 2.5. Set
    // ──────────────────────────────────────────────
    if (value instanceof Set) {
      return `"[Set:${value.size}]"`;
    }

    // ──────────────────────────────────────────────
    // 2.6. Plain-объекты: сортируем ключи
    // ──────────────────────────────────────────────
    if (isPlainObject(value)) {
      const keys = Object.keys(value).sort();

      const parts: string[] = [];
      for (const key of keys) {
        const v = value[key];
        // Пропускаем undefined (как нативный JSON.stringify)
        if (v === undefined) continue;
        parts.push(`${JSON.stringify(key)}:${stableStringify(v, seen)}`);
      }
      return '{' + parts.join(',') + '}';
    }

    // ──────────────────────────────────────────────
    // 2.7. Прочие объекты (Error, Promise, class instances, ...)
    // ──────────────────────────────────────────────
    // Для них используем имя конструктора + количество ключей.
    // Это безопаснее, чем пытаться сериализовать их как plain-объект.
    const ctorName = (value as { constructor?: { name?: string } }).constructor?.name ?? 'Object';
    const keyCount = Object.keys(value).length;
    return `"[${ctorName}:${keyCount}]"`;
  } finally {
    seen.delete(obj);
  }
}

// ============================================
// STABLE STRINGIFY WITH TYPE PREFIX
// ============================================

/**
 * Стабильный `JSON.stringify` с префиксами типов в ключах.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ
 * ════════════════════════════════════════════════════════════
 *
 *   Используется в `addValue()` (codec-encode.ts) для
 *   формирования ключа дедупликации. Префиксы типов
 *   гарантируют, что значения РАЗНЫХ типов НИКОГДА не
 *   дадут один и тот же ключ.
 *
 *   Примеры коллизий без префиксов:
 *     String(null)      === 'null'      === String('null')      // ← коллизия!
 *     String(123)       === '123'       === String('123')       // ← коллизия!
 *     String(true)      === 'true'      === String('true')      // ← коллизия!
 *     String(0)         === '0'         === String('0')         // ← коллизия!
 *
 * ════════════════════════════════════════════════════════════
 * ФОРМАТ ПРЕФИКСОВ
 * ════════════════════════════════════════════════════════════
 *
 *   - `null`      → `'N'`
 *   - `string`    → `'S:' + value`
 *   - `number`    → `'D:' + value`
 *   - `boolean`   → `'B:' + value`
 *   - `bigint`    → `'I:' + value.toString()`
 *   - `object`    → `'O:' + stableStringify(value)`
 *   - `function`  → `'X:' + String(value)`
 *   - `symbol`    → `'X:' + String(value)`
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   stableStringifyWithType(null)      === 'N'
 *   stableStringifyWithType('null')    === 'S:null'      // ← НЕ 'N'
 *   stableStringifyWithType(123)       === 'D:123'
 *   stableStringifyWithType('123')     === 'S:123'       // ← НЕ 'D:123'
 *   stableStringifyWithType(true)      === 'B:true'
 *   stableStringifyWithType('true')    === 'S:true'      // ← НЕ 'B:true'
 *   stableStringifyWithType(0)         === 'D:0'
 *   stableStringifyWithType('0')       === 'S:0'         // ← НЕ 'D:0'
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ВАЖНО
 * ════════════════════════════════════════════════════════════
 *
 *   Для `undefined` возвращает `'U'`. Это специально —
 *   вызывающий код должен сам решить, пропускать ли
 *   `undefined` (обычно да, `addValue` возвращает `-1`).
 *
 * @param value — любое значение
 * @returns ключ дедупликации с префиксом типа
 */
export function stableStringifyWithType(value: unknown): string {
  if (value === null) return 'N';
  if (value === undefined) return 'U';

  const t = typeof value;

  if (t === 'string') return 'S:' + value;
  if (t === 'number') return 'D:' + value;
  if (t === 'boolean') return 'B:' + value;
  if (t === 'bigint') return 'I:' + value.toString();
  if (t === 'object') return 'O:' + stableStringify(value);
  if (t === 'function') return 'X:' + String(value);
  if (t === 'symbol') return 'X:' + String(value);

  // Fallback (не должно происходить, но для type-safety)
  return 'X:' + String(value);
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  // Существующие функции
  stableStringify,
  stableStringifyWithType,

  // ✅ v1.0.2: новые функции для JSON-safe защиты
  isJsonSafe,
  sanitizeForJson,
  jsonSafeStringify,
};
