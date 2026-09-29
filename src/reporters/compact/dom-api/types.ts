// src/reporters/compact/dom-api/types.ts
// ============================================================
// ТИПЫ DOM API-ПОДСИСТЕМЫ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Внутренние типы для DOM API-детектора. Используются в:
//   • scope-builder.ts — buildScopeForFunction
//   • heuristics.ts    — isLikelyDomReceiver
//   • resolvers.ts     — resolveTargetLocal, resolveArgLocal,
//                        extractContextLocal
//   • detector.ts      — detectDomApiCallsForFunction
//
// НЕ ЭКСПОРТИРУЮТСЯ наружу через dom-api/index.ts — это
// внутренние типы подсистемы.
//
// СОДЕРЖИМОЕ
// ----------
//   • ScopeLocal        — локальная переменная в scope
//   • ScopeInternal     — полный scope функции
//   • DomMethodInfoLocal — информация о DOM-методе
//
// ⚠️ ВАЖНО: DomMethodInfoLocal определён здесь, а не в
//    method-maps.ts, чтобы избежать циклического импорта
//    (method-maps.ts импортирует тип из types.ts).
// ============================================================

// ============================================================
// SCOPE LOCAL
// ============================================================
//
// Описывает одну локальную переменную внутри scope функции.
//
// ════════════════════════════════════════════════════════════
// ПОЛЯ
// ════════════════════════════════════════════════════════════
//
//   functionId     — ID функции (fn42), если переменная —
//                    ссылка на функцию в entitiesMap.
//
//   subkind        — подвид переменной:
//                      • 'ref'      — Vue ref / shallowRef / computed
//                      • 'computed' — Vue computed
//                      • 'watch'    — Vue watch / watchEffect
//                      • 'function' — локальная функция
//                      • 'method'   — метод класса
//                      • 'constant' — const / let / var
//
//   isRef          — является ли переменная Vue ref-ом.
//                    Устанавливается через isRefCall().
//
//   isDomElement   — является ли переменная DOM-элементом.
//                    Устанавливается через isDomElementCreation().
//
//   typeHint       — подсказка типа (для отладки).
//                    Сейчас не заполняется, оставлено
//                    для будущего расширения.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   const dataTableRef = ref(null);
//   // → { isRef: true, subkind: 'constant' }
//
//   const el = document.createElement('div');
//   // → { isDomElement: true, subkind: 'constant' }
//
//   const handleClick = () => {};
//   // → { functionId: 'fn42', subkind: 'function' }
// ============================================================

export interface ScopeLocal {
    /** ID функции (fn1, fn2, ...) */
    functionId?: string;

    /** Подвид переменной */
    subkind?: 'ref' | 'computed' | 'watch' | 'function' | 'method' | 'constant';

    /** Vue ref */
    isRef?: boolean;

    /** DOM-элемент */
    isDomElement?: boolean;

    /** Подсказка типа (для будущего расширения) */
    typeHint?: string;
}

// ============================================================
// SCOPE INTERNAL
// ============================================================
//
// Полный scope функции. Строится в buildScopeForFunction.
//
// ════════════════════════════════════════════════════════════
// ПОЛЯ
// ════════════════════════════════════════════════════════════
//
//   fileId       — ID файла (f1, f2, ...).
//
//   sourceFile   — ts-morph SourceFile или null.
//                  Заполняется только если удалось найти файл
//                  в Project по scriptPath или originalAbsolutePath.
//                  Если null — DOM-детектор вернёт [] для функции.
//
//   locals       — Map<имя, ScopeLocal>.
//                  Заполняется из entitiesMap (variables, constants,
//                  functions) + рекурсивно из SourceFile
//                  (VariableDeclaration).
//
//   imports      — Map<localName, { functionId?, sourceFileId? }>.
//                  Заполняется из entitiesMap (imports).
//                  Сейчас sourceFileId = imp.toFileId,
//                  functionId не заполняется (оставлено для
//                  будущего расширения).
//
//   globals      — Set имён глобальных объектов:
//                    window, document, console, Math, JSON,
//                    Object, Array, Promise, Date, RegExp, Error,
//                    Map, Set, WeakMap, WeakSet, Symbol, Number,
//                    String, Boolean, parseInt, parseFloat,
//                    isNaN, isFinite.
//                  Используется для отсеивания в isLikelyDomReceiver.
//
//   refs         — Set имён Vue ref-ов.
//                  Заполняется эвристикой: имена, оканчивающиеся
//                  на 'Ref' или 'El', + результаты isRefCall()
//                  на init-выражениях.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   {
//     fileId: 'f18',
//     sourceFile: <ts-morph SourceFile>,
//     locals: Map {
//       'dataTableRef' => { isRef: true, subkind: 'constant' },
//       'handleClick'  => { functionId: 'fn42', subkind: 'function' },
//     },
//     imports: Map {
//       'ref'     => { sourceFileId: 'external:vue' },
//       'onMounted' => { sourceFileId: 'external:vue' },
//     },
//     globals: Set { 'window', 'document', 'console', ... },
//     refs: Set { 'dataTableRef', 'contextMenuRef' },
//   }
// ============================================================

export interface ScopeInternal {
    /** ID файла (f1, f2, ...) */
    fileId: string;

    /** ts-morph SourceFile или null */
    sourceFile: any;

    /** Локальные переменные */
    locals: Map<string, ScopeLocal>;

    /** Импорты: localName → { functionId?, sourceFileId? } */
    imports: Map<string, { functionId?: string; sourceFileId?: string }>;

    /** Глобальные имена (window, document, ...) */
    globals: Set<string>;

    /** Имена Vue ref-ов */
    refs: Set<string>;
}

// ============================================================
// DOM METHOD INFO LOCAL
// ============================================================
//
// Информация о DOM-методе или DOM-свойстве.
// Используется в method-maps.ts для построения карт:
//   • DOM_METHOD_MAP_LOCAL
//   • DOM_PROPERTY_MAP_LOCAL
//
// ════════════════════════════════════════════════════════════
// ПОЛЯ
// ════════════════════════════════════════════════════════════
//
//   category — категория DOM API-вызова (строка, соответствует
//              legend.codes.domApiCategory):
//                • 'add-event-listener'
//                • 'remove-event-listener'
//                • 'query-selector'
//                • 'inner-html'
//                • 'set-attribute'
//                • ... (всего 50 категорий)
//
//   effect   — эффект вызова:
//                • 'write' — влияет на UI (изменяет DOM)
//                • 'read'  — только читает DOM
//                • 'mixed' — комбинированный (addEventListener
//                            и подписывается, и сохраняет handler)
//
// ════════════════════════════════════════════════════════════
// ПРИМЕРЫ
// ════════════════════════════════════════════════════════════
//
//   DOM_METHOD_MAP_LOCAL['appendChild']
//   // → { category: 'append-child', effect: 'write' }
//
//   DOM_METHOD_MAP_LOCAL['querySelector']
//   // → { category: 'query-selector', effect: 'read' }
//
//   DOM_METHOD_MAP_LOCAL['addEventListener']
//   // → { category: 'add-event-listener', effect: 'mixed' }
// ============================================================

export interface DomMethodInfoLocal {
    /** Категория DOM API-вызова (см. legend.codes.domApiCategory) */
    category: string;

    /** Эффект вызова */
    effect: 'write' | 'read' | 'mixed';
}
