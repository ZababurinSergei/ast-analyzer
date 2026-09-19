// src/reporters/codec/values-filter.ts
// ============================================
// ФИЛЬТРАЦИЯ values ДЛЯ КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ:
//   Определяет, какие значения из `values[]` нужно сохранять
//   в режиме `relations` (только те, что нужны для графа связей),
//   и переиндексирует ссылки во всём CompactJSON.
//
// ГАРАНТИИ:
//   - В режиме 'full' — no-op (возвращает исходный объект как есть).
//   - В режиме 'relations' — удаляет значения, не относящиеся к связям,
//     и переиндексирует все ссылки на них.
//   - Round-trip сохраняется ПОЛНОСТЬЮ для отфильтрованного full.json.
//
// АРХИТЕКТУРНОЕ РЕШЕНИЕ:
//   - Массив `values` существует ТОЛЬКО в CompactJSON (не в FullJSON).
//   - В CompactJSON есть ровно ОДНО место, где `values` индексируется
//     напрямую: `cn.nonEmptyV` — массив пар `[constIdx, valueIdx]`.
//   - Значит, фильтрация выполняется в `codec-encode.ts` МЕЖДУ сборкой
//     `dict.valueDict` и финальной сборкой CompactJSON.
//   - Переиндексация касается ТОЛЬКО `cn.nonEmptyV`.
//   - Никакие другие секции (`gr.e`, `gr.i`, `gr.c`, `gr.re`, `fns`, `cls`)
//     НЕ ссылаются на `values` напрямую — они ссылаются на `tokens`/`strs`,
//     которые фильтрации НЕ подлежат.
// ============================================

// ============================================
// ТИПЫ
// ============================================

/**
 * Режим сериализации секции `values` в CompactJSON.
 *
 *   - `full`      — все значения сохраняются (обратная совместимость)
 *   - `relations` — только значения, относящиеся к связям между сущностями
 */
export type ValuesMode = 'full' | 'relations';

/**
 * Категория значения в `values`.
 *
 * Используется для принятия решения, оставлять ли значение
 * в режиме `relations`.
 *
 *   - `relation`   — значение нужно для восстановления связей
 *                    (типы, флаги, коды, схемы, ключи)
 *   - `config`     — большой объект конфигурации (CompactReportConfig,
 *                    PRESETS, descriptions и т.п.)
 *   - `template`   — HTML/CSS/JS-шаблон (стили, скрипты, разметка)
 *   - `code`       — сгенерированный код (tsconfig, .gitignore, шаблоны
 *                    фиксов, `declare module`, `@ts-ignore`)
 *   - `flag-array` — длинный массив флагов/чисел, не участвующих в связях
 *   - `other`      — всё остальное
 */
export type ValueKind = 'relation' | 'config' | 'template' | 'code' | 'flag-array' | 'other';

/**
 * Метаданные для одного значения в `values[]`.
 *
 * Параллельный массив `valuesMeta[]` строится в `codec-encode.ts`
 * одновременно с массивом `values[]` — на каждый `push` в `valueDict`
 * делается соответствующий `push` в `valueMeta`.
 *
 * Поля:
 *   - `key`  — строковый идентификатор значения. Может быть:
 *              • именем константы из `codec-encode.ts` (например,
 *                `'CALL_TYPES'`, `'FLAG_MAP'`);
 *              • составным ключом (например, `'cn_value_<name>'`,
 *                `'func_body_<id>'`, `'template_css_<id>'`).
 *   - `kind` — категория (см. ValueKind).
 */
export interface ValueMeta {
    /** Строковый ключ значения (см. выше) */
    key: string;
    /** Категория значения (см. ValueKind) */
    kind: ValueKind;
}

/**
 * Результат фильтрации `values`.
 *
 *   - `values`   — отфильтрованный массив значений
 *   - `meta`     — параллельный массив метаданных (той же длины)
 *   - `indexMap` — карта `oldIndex → newIndex` для переиндексации
 *                  ссылок в CompactJSON
 */
export interface FilterValuesResult {
    /** Отфильтрованный массив значений */
    values: unknown[];
    /** Параллельный массив метаданных (той же длины, что `values`) */
    meta: ValueMeta[];
    /**
     * Карта переиндексации: `oldIndex → newIndex`.
     *
     * Индексы, отсутствующие в карте, были удалены при фильтрации.
     * Ссылки на них должны быть заменены на `null` или удалены
     * (в зависимости от семантики конкретной секции).
     */
    indexMap: Map<number, number>;
}

// ============================================
// WHITELIST КЛЮЧЕЙ
// ============================================

/**
 * Явный whitelist ключей, которые ВСЕГДА остаются в режиме `relations`.
 *
 * Содержит словари, необходимые для декодирования связей:
 *   - типы связей (`RELATION_TYPES`, `EXPORT_TYPES`, `IMPORT_TYPES`,
 *     `CALL_TYPES`, `RE_EXPORT_TYPES`)
 *   - типы сущностей (`TYPE_KINDS`, `TYPE_USAGE_KINDS`)
 *   - типы Vue-специфичных связей (`LIFECYCLE_TYPES`, `EFFECT_TYPES`,
 *     `INJECTION_TYPES`, `REACTIVITY_TYPES`, `CONDITIONAL_TYPES`,
 *     `HOOK_NAMES`)
 *   - словари флагов (`FLAG_MAP`, `FLAG_CHAR_MAP`, `FLAG_NAMES`)
 *   - схемы колоночных массивов (`SCHEMAS`)
 *
 * Если значение имеет ключ из этого набора — оно сохраняется
 * НЕЗАВИСИМО от категории, вычисленной эвристикой `classifyValue`.
 *
 * Это страховка: если эвристика ошибётся и пометит нужный
 * словарь как `config`/`other`, whitelist его спасёт.
 */
export const RELATION_KEYS: ReadonlySet<string> = new Set<string>([
    // --- Словари типов связей ---
    'RELATION_TYPES',
    'EXPORT_TYPES',
    'IMPORT_TYPES',
    'CALL_TYPES',
    'RE_EXPORT_TYPES',
    'TYPE_KINDS',
    'TYPE_USAGE_KINDS',
    'LIFECYCLE_TYPES',
    'EFFECT_TYPES',
    'INJECTION_TYPES',
    'REACTIVITY_TYPES',
    'CONDITIONAL_TYPES',
    'HOOK_NAMES',
    // --- Словари флагов ---
    'FLAG_MAP',
    'FLAG_CHAR_MAP',
    'FLAG_NAMES',
    'SCHEMAS',
]);

// ============================================
// ЭВРИСТИКА КАТЕГОРИЗАЦИИ
// ============================================

/**
 * Порог длины строки для отнесения значения к `template`.
 *
 * Значения-строки длиннее этого порога считаются HTML/CSS/JS-шаблонами
 * и удаляются в режиме `relations`.
 *
 * Обоснование: строки-связи (имена, ключи, коды) редко превышают
 * 200 символов. HTML/CSS-шаблоны — обычно тысячи символов.
 */
const STRING_TEMPLATE_THRESHOLD = 200;

/**
 * Порог длины JSON-сериализации объекта для отнесения к `config`.
 *
 * Объекты, чья JSON-сериализация длиннее порога, считаются
 * большими конфигами и удаляются в режиме `relations`.
 *
 * Обоснование: объекты-связи (например, схемы колоночных массивов
 * `SCHEMAS`) редко превышают 500 символов. `CompactReportConfig`
 * с `presets` — десятки тысяч символов.
 */
const OBJECT_CONFIG_THRESHOLD = 500;

/**
 * Порог длины массива для отнесения к `flag-array`.
 *
 * Массивы длиннее порога считаются «флагами/числами, не относящимися
 * к связям» и удаляются в режиме `relations`.
 *
 * Обоснование: массивы-связи (например, `[constIdx, valueIdx]`)
 * короткие. Массивы флагов (`INTRINSIC_TAGS`, `BUILTIN_FUNCTIONS`)
 * содержат десятки элементов.
 */
const ARRAY_FLAG_THRESHOLD = 50;

/**
 * Классифицирует значение `values` по его типу и размеру.
 *
 * Это эвристика — она не идеальна, но покрывает ~90% случаев:
 *   - примитивы (числа, boolean, короткие строки) → `relation`
 *   - длинные строки → `template` (HTML/CSS/JS)
 *   - короткие массивы → `relation`
 *   - длинные массивы → `flag-array`
 *   - короткие объекты → `relation`
 *   - длинные объекты → `config`
 *
 * Точную категоризацию можно задать через `key` (см. `RELATION_KEYS`).
 *
 * @param value — значение из `values[]`
 * @returns категория значения
 */
export function classifyValue(value: unknown): ValueKind {
    // --- null / undefined ---
    if (value === null || value === undefined) {
        return 'other';
    }

    // --- Строки ---
    if (typeof value === 'string') {
        if (value.length > STRING_TEMPLATE_THRESHOLD) {
            return 'template';
        }
        return 'relation';
    }

    // --- Числа / boolean / bigint ---
    if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
    ) {
        return 'relation';
    }

    // --- Массивы ---
    if (Array.isArray(value)) {
        if (value.length > ARRAY_FLAG_THRESHOLD) {
            return 'flag-array';
        }
        return 'relation';
    }

    // --- Объекты ---
    if (typeof value === 'object') {
        try {
            const json = JSON.stringify(value);
            if (json.length > OBJECT_CONFIG_THRESHOLD) {
                return 'config';
            }
            return 'relation';
        } catch {
            // Циклические ссылки / BigInt / иное — считаем конфигом
            return 'config';
        }
    }

    // --- Функции / символы / прочее ---
    return 'other';
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ФИЛЬТРАЦИИ
// ============================================

/**
 * Фильтрует массив `values` + параллельный массив `meta`
 * и возвращает отфильтрованные массивы + карту переиндексации.
 *
 * Логика:
 *   1. Проходим по всем значениям `values[]`.
 *   2. Для каждого значения `i` проверяем:
 *      - `meta[i].kind === 'relation'` — оставляем;
 *      - `RELATION_KEYS.has(meta[i].key)` — оставляем (приоритет
 *        над kind — на случай ошибки эвристики).
 *   3. Оставленные значения пушим в `newValues[]`, их метаданные —
 *      в `newMeta[]`, а соответствие `i → newIdx` — в `indexMap`.
 *   4. Удалённые значения НЕ попадают в `newValues[]` и НЕ имеют
 *      записи в `indexMap`.
 *
 * Возвращаемый `indexMap` используется вызывающим кодом для
 * переиндексации ссылок на `values[]` (в CompactJSON — это
 * `cn.nonEmptyV`).
 *
 * @param values — исходный массив значений (из `dict.valueDict`)
 * @param meta   — параллельный массив метаданных (из `dict.valueMeta`)
 * @returns отфильтрованные массивы + карта переиндексации
 */
export function filterValues(
    values: unknown[],
    meta: ValueMeta[]
): FilterValuesResult {
    const indexMap = new Map<number, number>();
    const newValues: unknown[] = [];
    const newMeta: ValueMeta[] = [];

    // Защита от невалидного входа
    if (!Array.isArray(values) || values.length === 0) {
        return { values: newValues, meta: newMeta, indexMap };
    }

    if (!Array.isArray(meta) || meta.length !== values.length) {
        // Если meta отсутствует или не совпадает по длине —
        // не фильтруем вообще (обратная совместимость).
        return {
            values: [...values],
            meta: Array.isArray(meta) ? [...meta] : [],
            indexMap,
        };
    }

    for (let i = 0; i < values.length; i++) {
        const m = meta[i];
        if (!m) {
            // Нет метаданных — не рискуем, оставляем
            indexMap.set(i, newValues.length);
            newValues.push(values[i]);
            newMeta.push({ key: '', kind: 'other' });
            continue;
        }

        // Приоритет: whitelist > kind === 'relation'
        const isRelation = m.kind === 'relation' || RELATION_KEYS.has(m.key);

        if (isRelation) {
            indexMap.set(i, newValues.length);
            newValues.push(values[i]);
            newMeta.push(m);
        }
        // Иначе — значение удаляется (не попадает в newValues и indexMap)
    }

    return { values: newValues, meta: newMeta, indexMap };
}

// ============================================
// ПЕРЕИНДЕКСАЦИЯ ССЫЛОК
// ============================================

/**
 * Переиндексирует одну ссылку на `values[]`.
 *
 * Возвращает:
 *   - новый индекс, если старое значение сохранилось;
 *   - `null`, если старое значение было удалено;
 *   - `oldIdx` как есть, если он невалиден (undefined, -1).
 *
 * Соглашение: ссылки на удалённые значения в CompactJSON
 * заменяются на `null`. Это безопасно для round-trip, потому что
 * `decode` уже умеет обрабатывать `null` как «значения нет».
 *
 * @param oldIdx   — старый индекс (или undefined / -1)
 * @param indexMap — карта переиндексации из `filterValues`
 * @returns новый индекс или null
 */
export function remapIndex(
    oldIdx: number | undefined,
    indexMap: Map<number, number>
): number | null {
    // Невалидный вход — возвращаем как есть
    if (oldIdx === undefined || oldIdx === null) {
        return null;
    }
    if (oldIdx < 0) {
        return oldIdx;
    }

    const newIdx = indexMap.get(oldIdx);
    return newIdx !== undefined ? newIdx : null;
}

/**
 * Переиндексирует массив пар `[constIdx, valueIdx]` (для `cn.nonEmptyV`).
 *
 * Если `valueIdx` ссылается на удалённое значение — пара
 * ИСКЛЮЧАЕТСЯ из результата (значение для этой константы теряется,
 * что эквивалентно `value === undefined`).
 *
 * @param nonEmptyV — исходный массив пар
 * @param indexMap  — карта переиндексации
 * @returns переиндексированный массив пар
 */
export function remapNonEmptyV(
    nonEmptyV: [number, number][],
    indexMap: Map<number, number>
): [number, number][] {
    if (!Array.isArray(nonEmptyV) || nonEmptyV.length === 0) {
        return [];
    }

    const result: [number, number][] = [];

    for (const pair of nonEmptyV) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;

        const [constIdx, oldValueIdx] = pair;
        const newValueIdx = remapIndex(oldValueIdx, indexMap);

        // Значение удалено — пропускаем пару
        if (newValueIdx === null) continue;

        result.push([constIdx, newValueIdx]);
    }

    return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, является ли строка валидным режимом.
 *
 * Используется в CLI для валидации `--values-mode`.
 *
 * @param mode — строка для проверки
 * @returns true, если mode === 'full' | 'relations'
 */
export function isValidValuesMode(mode: unknown): mode is ValuesMode {
    return mode === 'full' || mode === 'relations';
}

/**
 * Нормализует режим: приводит к валидному значению
 * с fallback на 'relations'.
 *
 * Используется для чтения старого `compact.json` без поля
 * `valuesMode` — такой отчёт читается как 'full' (обратная
 * совместимость), но при отсутствии явного указания
 * по умолчанию ставится 'relations'.
 *
 * @param mode — исходное значение (может быть undefined / мусором)
 * @param fallback — значение по умолчанию
 * @returns нормализованный режим
 */
export function normalizeValuesMode(
    mode: unknown,
    fallback: ValuesMode = 'relations'
): ValuesMode {
    if (isValidValuesMode(mode)) return mode;
    return fallback;
}

/**
 * Возвращает статистику по фильтрации — для логирования.
 *
 * @param original — исходное количество значений
 * @param filtered — отфильтрованное количество значений
 * @returns объект со статистикой
 */
export function getFilterStats(
    original: number,
    filtered: number
): {
    original: number;
    filtered: number;
    removed: number;
    removedPercent: number;
    savedRatio: number;
} {
    const removed = original - filtered;
    const removedPercent = original > 0 ? (removed / original) * 100 : 0;
    const savedRatio = filtered > 0 ? original / filtered : 1;

    return {
        original,
        filtered,
        removed,
        removedPercent,
        savedRatio,
    };
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
    // Типы
    // (экспортируются автоматически через `export type`)

    // Основные функции
    filterValues,
    remapIndex,
    remapNonEmptyV,
    classifyValue,

    // Утилиты
    isValidValuesMode,
    normalizeValuesMode,
    getFilterStats,

    // Константы
    RELATION_KEYS,
    STRING_TEMPLATE_THRESHOLD,
    OBJECT_CONFIG_THRESHOLD,
    ARRAY_FLAG_THRESHOLD,
};
