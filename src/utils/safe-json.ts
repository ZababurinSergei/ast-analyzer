// src/utils/safe-json.ts
// ============================================
// БЕЗОПАСНАЯ СЕРИАЛИЗАЦИЯ JSON
// ============================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ:
//   Единая точка сериализации JSON во всём проекте.
//   Решает проблемы, которые не умеет нативный JSON.stringify:
//     - BigInt         → строка (иначе TypeError)
//     - Map            → объект
//     - Set            → массив
//     - циклические ссылки → '[Circular]'
//     - опасные ключи  → удаляются (__proto__, constructor, _safeInfo)
//
// ИСПОЛЬЗОВАНИЕ:
//   import { safeJsonStringify } from '../utils/safe-json.js';
//
//   fs.writeFileSync(path, safeJsonStringify(data), 'utf-8');
//   const json = safeJsonStringify(data, 0); // без отступов
//
// ЗАЧЕМ:
//   Ранее логика сериализации дублировалась в:
//     - reporters/compact-reporter.ts
//     - reporters/json/builders/save-optimized.ts
//     - reporters/json/builders/save-package-lock.ts
//   Причём НИ ОДНА из них не обрабатывала BigInt — это приводило
//   к падению с ошибкой "Do not know how to serialize a BigInt"
//   при генерации отчёта для проектов, где есть BigInt-литералы.
// ============================================

/**
 * Ключи, которые нужно удалять при сериализации.
 *
 * - `_safeInfo`   — служебное поле внутреннего формата
 * - `__proto__`   — опасно при парсинге JSON
 * - `constructor` — опасно при парсинге JSON
 */
const DANGEROUS_KEYS = new Set(['_safeInfo', '__proto__', 'constructor']);

/**
 * Безопасная сериализация значения в JSON.
 *
 * Отличия от нативного `JSON.stringify`:
 *   1. `BigInt` → строка (нативный падает с TypeError)
 *   2. `Map`    → объект (нативный падает или даёт `{}`)
 *   3. `Set`    → массив (нативный падает или даёт `{}`)
 *   4. Циклические ссылки → строка `'[Circular]'`
 *   5. Опасные ключи (`__proto__`, `constructor`, `_safeInfo`) → удаляются
 *
 * @param value  — значение для сериализации
 * @param indent — количество пробелов для отступа (по умолчанию 2)
 * @returns строка JSON
 *
 * @example
 * ```typescript
 * const data = {
 *   id: 123n,                       // BigInt
 *   map: new Map([['a', 1]]),       // Map
 *   set: new Set([1, 2, 3]),        // Set
 * };
 *
 * safeJsonStringify(data);
 * // '{\n  "id": "123",\n  "map": {\n    "a": 1\n  },\n  "set": [1, 2, 3]\n}'
 * ```
 */
export function safeJsonStringify(value: unknown, indent: number = 2): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    value,
    (key, val) => {
      // ─────────────────────────────────────────────
      // 1. BigInt → строка
      // ─────────────────────────────────────────────
      // Нативный JSON.stringify падает с ошибкой:
      //   TypeError: Do not know how to serialize a BigInt
      // ─────────────────────────────────────────────
      if (typeof val === 'bigint') {
        return val.toString();
      }

      // ─────────────────────────────────────────────
      // 2. Map → объект
      // ─────────────────────────────────────────────
      if (val instanceof Map) {
        return Object.fromEntries(val);
      }

      // ─────────────────────────────────────────────
      // 3. Set → массив
      // ─────────────────────────────────────────────
      if (val instanceof Set) {
        return Array.from(val);
      }

      // ─────────────────────────────────────────────
      // 4. Опасные ключи → удаляем
      // ─────────────────────────────────────────────
      if (DANGEROUS_KEYS.has(key)) {
        return undefined;
      }

      // ─────────────────────────────────────────────
      // 5. Циклические ссылки → '[Circular]'
      // ─────────────────────────────────────────────
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }

      return val;
    },
    indent
  );
}

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ
// ============================================

/**
 * Безопасная сериализация без отступов (компактный JSON).
 * Удобно для отправки по сети или хранения в одну строку.
 */
export function safeJsonCompact(value: unknown): string {
  return safeJsonStringify(value, 0);
}

/**
 * Безопасный парсинг JSON.
 *
 * Оборачивает `JSON.parse` в try/catch и возвращает `fallback`
 * при ошибке (вместо исключения).
 *
 * @param text     — строка JSON
 * @param fallback — значение по умолчанию при ошибке
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  safeJsonStringify,
  safeJsonCompact,
  safeJsonParse,
};
