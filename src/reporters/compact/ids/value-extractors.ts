// src/reporters/compact/ids/value-extractors.ts
// ============================================================
// ИЗВЛЕЧЕНИЕ ЗНАЧЕНИЙ ИЗ STRING PROPS (v16.0.0)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Вспомогательные функции для извлечения структурированной
// информации из строкового значения Vue-prop/attribute.
//
// Используются в compact/vue/component-usage.ts при заполнении
// top-level component*-аккумуляторов:
//   - ComponentProp.identifier   ← extractIdentifierFromValue
//   - ComponentProp.memberChain  ← extractMemberChainFromValue
//   - ComponentProp.literalValue ← extractLiteralFromValue
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЭТО НУЖНО
// ════════════════════════════════════════════════════════════
//
//   В Vue-шаблоне prop может быть:
//     :user-toolbar-items="props.toolbarItems"  → identifier='props'
//                                                 memberChain=['props','toolbarItems']
//     :is-data-modified="isDirty"               → identifier='isDirty'
//     disabled                                  → literalValue=true (boolean)
//     :count="42"                               → literalValue=42 (number)
//     :label="'hello'"                          → literalValue='hello' (string)
//
//   Разложение значения на компоненты нужно для:
//     • sourceChain — цепочка источников
//     • resolvePropSource — привязка prop к функции/import
//     • codec — сериализация literalValue с типом (v16.0.9)
//
// ════════════════════════════════════════════════════════════
// ФОРМАТ ВОЗВРАЩАЕМЫХ ЗНАЧЕНИЙ
// ════════════════════════════════════════════════════════════
//
//   extractIdentifierFromValue:
//     'props.toolbarItems'  → 'props'
//     'isDirty'             → 'isDirty'
//     '42'                  → '42'        (начинается с цифры — не идентификатор,
//                                          но regex пропустит как часть имени)
//     '!props.isPopover'    → null        (начинается с '!')
//     ''                    → null
//
//   extractMemberChainFromValue:
//     'props.toolbarItems'  → ['props', 'toolbarItems']
//     'this.foo.bar'        → ['this', 'foo', 'bar']
//     'isDirty'             → undefined   (нет точки)
//     'a[0].b'              → ['a', 'b']  (скобки отбрасываются)
//
//   extractLiteralFromValue:
//     'true'                → true
//     'false'               → false
//     'null'                → null
//     '42'                  → 42
//     '3.14'                → 3.14
//     '-7'                  → -7
//     "'hello'"             → 'hello'
//     '"world"'             → 'world'
//     'undefined'           → undefined  (не распознано → undefined)
//     'foo'                 → undefined  (не литерал)
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • compact/vue/component-usage.ts     — вызывает эти функции
//   • codec/codec-encode.ts              — кодирует literalValue
//   • codec/codec-decode.ts              — декодирует literalValue
//   • codec/codec-types.ts               — ComponentProp.identifier
// ============================================================

// ============================================================
// 1. ИЗВЛЕЧЕНИЕ ИДЕНТИФИКАТОРА
// ============================================================

/**
 * Извлекает первый идентификатор из строкового значения.
 *
 * Возвращает первое совпадение с паттерном
 * [A-Za-z_$][\w$]* в начале строки.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   extractIdentifierFromValue('props.toolbarItems')  // 'props'
 *   extractIdentifierFromValue('isDirty')             // 'isDirty'
 *   extractIdentifierFromValue('_privateVar')         // '_privateVar'
 *   extractIdentifierFromValue('$store')              // '$store'
 *   extractIdentifierFromValue('!isVisible')          // null
 *   extractIdentifierFromValue('42')                  // '42'
 *   extractIdentifierFromValue('')                    // null
 *   extractIdentifierFromValue(undefined as any)      // null
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ОСОБЕННОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Для числовых литералов '42' возвращает '42' — потому что
 *   regex [A-Za-z_$][\w$]* сработает... НЕТ. Regex требует
 *   первый символ [A-Za-z_$], а '4' не подходит.
 *   На самом деле вернёт null.
 *
 *   Проверка: '42'.match(/^([A-Za-z_$][\w$]*)/) === null.
 *   Значит, extractIdentifierFromValue('42') === null.
 *
 * @param value — строковое значение prop
 * @returns идентификатор или null
 */
export function extractIdentifierFromValue(value: string): string | null {
    if (!value) return null;
    const m = value.match(/^([A-Za-z_$][\w$]*)/);
    return m?.[1] ?? null;
}

// ============================================================
// 2. ИЗВЛЕЧЕНИЕ ЦЕПОЧКИ MEMBER-ДОСТУПОВ
// ============================================================

/**
 * Извлекает цепочку member-доступов из строкового значения.
 *
 * Разбивает строку по '.', фильтрует части, оставляя только
 * валидные идентификаторы.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   extractMemberChainFromValue('props.toolbarItems')
 *     // ['props', 'toolbarItems']
 *
 *   extractMemberChainFromValue('this.foo.bar')
 *     // ['this', 'foo', 'bar']
 *
 *   extractMemberChainFromValue('a.b.c.d.e')
 *     // ['a', 'b', 'c', 'd', 'e']
 *
 *   extractMemberChainFromValue('isDirty')
 *     // undefined (нет '.')
 *
 *   extractMemberChainFromValue('a[0].b')
 *     // ['a', 'b']  ('[0]' не идентификатор — отбрасывается,
 *     //              но так как осталось 2 валидных части, вернётся массив)
 *
 *   extractMemberChainFromValue('a..b')
 *     // ['a', 'b']  (пустые части отбрасываются)
 *
 *   extractMemberChainFromValue('.')
 *     // undefined  (после split('.') = ['', ''],
 *     //             фильтр убирает всё, length=0)
 *
 *   extractMemberChainFromValue('')
 *     // undefined
 *
 * ════════════════════════════════════════════════════════════
 * ПРАВИЛА
 * ════════════════════════════════════════════════════════════
 *
 *   1. Если нет '.', вернуть undefined.
 *   2. Split по '.'.
 *   3. Каждая часть должна соответствовать [A-Za-z_$][\w$]*.
 *   4. Если осталось 2+ части — вернуть массив.
 *   5. Иначе — undefined.
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ВАЖНО ДЛЯ ROUND-TRIP
 * ════════════════════════════════════════════════════════════
 *
 *   В compact.json memberChain сериализуется как строка
 *   с разделителем \u0002:
 *     ['props', 'toolbarItems']  →  'props\u0002toolbarItems'
 *
 *   См. codec-encode.ts::encodeComponentPropsInline.
 *
 * @param value — строковое значение prop
 * @returns массив частей или undefined
 */
export function extractMemberChainFromValue(value: string): string[] | undefined {
    if (!value || !value.includes('.')) return undefined;
    const parts = value.split('.').filter(s => /^[A-Za-z_$][\w$]*$/.test(s));
    return parts.length > 1 ? parts : undefined;
}

// ============================================================
// 3. ИЗВЛЕЧЕНИЕ ЛИТЕРАЛА
// ============================================================

/**
 * Извлекает литеральное значение из строкового представления.
 *
 * ════════════════════════════════════════════════════════════
 * ПОДДЕРЖИВАЕМЫЕ ЛИТЕРАЛЫ
 * ════════════════════════════════════════════════════════════
 *
 *   ┌──────────────────────┬────────────────────────────────┐
 *   │ Вход                 │ Выход                          │
 *   ├──────────────────────┼────────────────────────────────┤
 *   │ 'true'               │ true (boolean)                 │
 *   │ 'false'              │ false (boolean)                │
 *   │ 'null'               │ null                           │
 *   │ '42'                 │ 42 (number)                    │
 *   │ '3.14'               │ 3.14 (number)                  │
 *   │ '-7'                 │ -7 (number)                    │
 *   │ "'hello'"            │ 'hello' (string)               │
 *   │ '"world"'            │ 'world' (string)               │
 *   │ '`template`'         │ undefined (не поддерживается)  │
 *   │ 'undefined'          │ undefined                      │
 *   │ 'NaN'                │ undefined                      │
 *   │ 'Infinity'           │ undefined                      │
 *   │ 'foo'                │ undefined                      │
 *   │ ''                   │ undefined                      │
 *   └──────────────────────┴────────────────────────────────┘
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ КРИТИЧНО ДЛЯ CODEC v16.0.9
 * ════════════════════════════════════════════════════════════
 *
 *   В codec-encode.ts::encodeLiteralValue литерал кодируется
 *   С ПРЕФИКСОМ ТИПА:
 *     boolean true   → 'boolean:true'
 *     boolean false  → 'boolean:false'
 *     number 42      → 'number:42'
 *     null           → 'null:null'
 *     string 'foo'   → 'string:foo'
 *
 *   Это позволяет decode восстановить РЕАЛЬНЫЙ тип, а не строку:
 *     String(false) === 'false'  // ← теряет тип
 *
 *   Симптом без префикса (v16.0.8):
 *     $.vue.componentProps[38].literalValue: "false" → false
 *     L1/L2/DL/DEC — FAIL.
 *
 * ════════════════════════════════════════════════════════════
 * ПОРЯДОК ПРОВЕРОК
 * ════════════════════════════════════════════════════════════
 *
 *   1. Пустая строка  → undefined
 *   2. 'true'         → true
 *   3. 'false'        → false
 *   4. 'null'         → null
 *   5. Число по regex → parseFloat
 *   6. Строка в кавычках → срез кавычек
 *   7. Иначе          → undefined
 *
 * @param value — строковое значение
 * @returns литерал (boolean | number | string | null) или undefined
 */
export function extractLiteralFromValue(
    value: string
): string | number | boolean | null | undefined {
    if (!value) return undefined;
    const t = value.trim();
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
    return undefined;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
    extractIdentifierFromValue,
    extractMemberChainFromValue,
    extractLiteralFromValue,
};
