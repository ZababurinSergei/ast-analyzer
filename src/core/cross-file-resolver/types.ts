// src/core/cross-file-resolver/types.ts
// ============================================================
// ТИПЫ ДЛЯ CROSS-FILE RESOLVER (P3)
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0 (диагностика unresolved):
//   - ✅ ДОБАВЛЕНО: тип `UnresolvedReason` — причина, по которой
//     вызов остался unresolved. Используется в
//     `resolveCrossFileCalls` для сбора статистики и вывода ТОП-20
//     причин в verbose-режиме.
//   - ✅ ДОБАВЛЕНО: поле `unresolvedByReason?` в `ResolveStats` —
//     агрегированная статистика по причинам (для отчётов).
//   - ✅ ДОБАВЛЕНО: `reason` в `ResolvedCallee` (опционально) —
//     для отладки, почему конкретный символ не разрешился.
//   - ✅ УТОЧНЕНО: docstring на русском, примеры.
//
// ИЗМЕНЕНИЯ v1.0.1 (типизация filePathToFileId):
//   - ✅ ДОБАВЛЕНО: `filePathToFileId` в ResolveStats (не нужно —
//     это внутренний индекс, оставлено для обратной совместимости).
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия. Типы для оркестратора cross-file resolver.
//
// НАЗНАЧЕНИЕ
// ----------
// Модуль резолвит межфайловые вызовы через ts-morph.
//
// ВХОД:
//   - entitiesMap: Record<filePath, EntitiesResult>
//   - options: CrossFileResolverOptions
//
// ВЫХОД:
//   - calls: CrossFileCall[]     — разрешённые вызовы
//   - stats: ResolveStats         — метрики
//
// АРХИТЕКТУРА
// -----------
//   1. ProjectManager — создаёт ts-morph Project, добавляет файлы
//   2. SymbolResolver — резолвит callee → declaration через symbols
//   3. ResolveCache   — кэширует результаты
//   4. index.ts       — оркестратор
//
// РИСКИ
// -----
//   - Долгая инициализация Project (10k+ файлов)
//   - .vue с <script setup> требует виртуальных SourceFile
//   - Алиасы из tsconfig должны быть загружены в Project
//   - unresolved rate может быть высоким (до 78%), если tsconfig
//     не подхватился или файлы не в Project
// ============================================================

// ============================================================
// ОСНОВНЫЕ ТИПЫ
// ============================================================

/**
 * Разрешённый межфайловый вызов.
 *
 * Содержит всё, что нужно для обогащения `calls[]` в `compact-reporter`.
 *
 * ════════════════════════════════════════════════════════════
 * ЖИЗНЕННЫЙ ЦИКЛ
 * ════════════════════════════════════════════════════════════
 *
 *   1. resolveCrossFileCalls() возвращает CrossFileCall[]
 *   2. compact-reporter.ts фильтрует по isCrossFile === true
 *   3. Обогащает full.calls[] через merge с дедупликацией
 *   4. codec-encode.ts кодирует в compact.gr.c
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // a.ts
 *   export function foo() { return 1; }
 *
 *   // b.ts
 *   import { foo } from './a';
 *   export function bar() { foo(); }
 *
 *   // Результат:
 *   {
 *     fromFunctionId: 'fn2',           // bar
 *     toFunctionId: 'fn1',             // foo
 *     line: 3,
 *     column: 26,
 *     callKind: 'direct',
 *     calleeName: 'foo',
 *     isCrossFile: true,
 *     targetFileId: 'f1',              // a.ts
 *   }
 */
export interface CrossFileCall {
  /** ID вызывающей функции (fn1, fn2, ...) */
  fromFunctionId: string;

  /** ID вызываемой функции (fn1, fn2, ...) */
  toFunctionId: string;

  /** Строка вызова в исходном файле (1-based) */
  line: number;

  /** Колонка вызова в исходном файле (1-based) */
  column: number;

  /**
   * Вид вызова.
   *
   * ════════════════════════════════════════════════════════════
   * ЗНАЧЕНИЯ
   * ════════════════════════════════════════════════════════════
   *
   *   - `'direct'`       — прямой вызов `foo()`
   *   - `'method'`       — вызов метода `obj.foo()` или `this.foo()`
   *   - `'constructor'`  — вызов конструктора `new Foo()`
   *   - `'new'`          — синоним `'constructor'` (для совместимости)
   *   - `'callback'`     — колбэк (если вызов найден внутри колбэка)
   */
  callKind: 'direct' | 'method' | 'constructor' | 'new' | 'callback';

  /** Имя callee (для отладки и UI) */
  calleeName?: string;

  /** Является ли вызов межфайловым (from.fileId !== to.fileId) */
  isCrossFile: boolean;

  /** ID файла-цели (f1, f2, ...) */
  targetFileId: string;
}

/**
 * Опции резолвера.
 *
 * ════════════════════════════════════════════════════════════
 * ДЕФОЛТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   includeVue: true
 *   includeJs: true
 *   cache: true
 *   maxFiles: 5000
 *   verbose: false
 */
export interface CrossFileResolverOptions {
  /** Корень проекта (абсолютный или относительный путь) */
  projectRoot: string;

  /** Путь к tsconfig.json (если есть; иначе — автопоиск) */
  tsConfigPath?: string;

  /** Включать .vue-файлы (по умолчанию true) */
  includeVue?: boolean;

  /** Включать .js/.jsx (по умолчанию true) */
  includeJs?: boolean;

  /** Использовать кэш (по умолчанию true) */
  cache?: boolean;

  /** Максимум файлов для анализа (защита от больших проектов) */
  maxFiles?: number;

  /** Подробный вывод */
  verbose?: boolean;

  /**
   * Коллбэк прогресса.
   *
   * Вызывается каждые N обработанных файлов (обычно N=100).
   *
   * @param processed — количество обработанных файлов
   * @param total     — общее количество файлов
   */
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Метрики резолвера.
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗОВАНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   const { calls, stats } = await resolveCrossFileCalls(...);
 *   console.log(`Найдено ${stats.crossFileCalls} межфайловых вызовов`);
 *   console.log(`Cache hit rate: ${stats.cacheHits / (stats.cacheHits + stats.cacheMisses)}`);
 */
export interface ResolveStats {
  /** Всего вызовов найдено (CallExpression + NewExpression) */
  totalCalls: number;

  /** Разрешено внутри файла (from.fileId === to.fileId) */
  sameFileCalls: number;

  /** Разрешено между файлами (from.fileId !== to.fileId) */
  crossFileCalls: number;

  /** Не разрешено (symbol не найден, dynamic key, и т.д.) */
  unresolvedCalls: number;

  /**
   * ✅ v1.1.0: агрегированная статистика по причинам unresolved.
   *
   * Ключ — причина, значение — количество.
   *
   * Если unresolvedCalls === 0, это поле может быть undefined
   * или пустым объектом.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   {
   *     symbol_not_found: 720,       // 92.4% — основная проблема
   *     no_enclosing_function: 40,   // 5.1% — вызовы на top-level
   *     no_target_line: 19,          // 2.5% — offset mismatch
   *   }
   *
   * Если `symbol_not_found` доминирует — проблема в tsconfig
   * и/или путях алиасов.
   */
  unresolvedByReason?: Partial<Record<UnresolvedReason, number>>;

  /** Попаданий в кэш (call site уже резолвился) */
  cacheHits: number;

  /** Промахов кэша (call site резолвится впервые) */
  cacheMisses: number;

  /** Общее время выполнения (мс) */
  durationMs: number;

  /** Время инициализации Project (мс) */
  initDurationMs: number;

  /** Время резолвинга (мс) */
  resolveDurationMs: number;

  /** Количество файлов, добавленных в Project (не .vue) */
  filesAdded: number;

  /** Количество .vue-файлов, добавленных как виртуальные SourceFile */
  vueFilesAdded: number;

  /** Ошибки при добавлении файлов */
  addFileErrors: number;
}

/**
 * Результат разрешения callee.
 *
 * ════════════════════════════════════════════════════════════
 * ЖИЗНЕННЫЙ ЦИКЛ
 * ════════════════════════════════════════════════════════════
 *
 *   1. SymbolResolver.resolveCallee(node) возвращает ResolvedCallee | null
 *   2. index.ts использует filePath + line для поиска toFunctionId
 *   3. line → funcId через lineToFuncId Map
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ line, А НЕ node
 * ════════════════════════════════════════════════════════════
 *
 *   ts-morph Node нельзя кэшировать между вызовами — они
 *   инвалидируются при изменении файла. Поэтому сохраняем
 *   только примитивы (filePath, line, column, name).
 */
export interface ResolvedCallee {
  /** Путь к файлу-цели (абсолютный) */
  filePath: string;

  /** Строка объявления в файле-цели (1-based) */
  line: number;

  /** Колонка объявления в файле-цели (1-based) */
  column: number;

  /** Имя функции/метода/класса */
  name: string;

  /**
   * Вид сущности.
   *
   * ════════════════════════════════════════════════════════════
   * ЗНАЧЕНИЯ
   * ════════════════════════════════════════════════════════════
   *
   *   - `'function'`    — FunctionDeclaration
   *   - `'method'`      — MethodDeclaration или PropertyDeclaration с arrow
   *   - `'constructor'` — ClassDeclaration (через new)
   *   - `'arrow'`       — VariableDeclaration с arrow/function init
   *   - `'unknown'`     — не удалось классифицировать
   */
  kind: 'function' | 'method' | 'constructor' | 'arrow' | 'unknown';

  /** ID символа в ts-morph (для кэша, опционально) */
  symbolId?: string;

  /**
   * ✅ v1.1.0: причина, по которой резолвинг не удался.
   *
   * Заполняется только если resolved === null (используется
   * для диагностики). В успешном случае — undefined.
   */
  reason?: UnresolvedReason;
}

/**
 * Промежуточный результат для одного файла.
 *
 * Используется внутри `processSourceFile` в `index.ts`.
 * Не экспортируется наружу, но полезен для unit-тестов.
 */
export interface FileResolutionResult {
  /** Путь к файлу (оригинальный, не виртуальный) */
  filePath: string;

  /** Разрешённые вызовы в этом файле */
  calls: CrossFileCall[];

  /** Общее количество вызовов в файле */
  totalCalls: number;

  /** Количество разрешённых внутри файла */
  sameFileCalls: number;

  /** Количество разрешённых между файлами */
  crossFileCalls: number;

  /** Количество не разрешённых */
  unresolvedCalls: number;
}

/**
 * Mapping для .vue-файлов.
 *
 * ════════════════════════════════════════════════════════════
 * ПРОБЛЕМА
 * ════════════════════════════════════════════════════════════
 *
 *   .vue-файл нельзя добавить в ts-morph Project напрямую —
 *   это не .ts/.js-файл. Решение: извлечь <script setup>
 *   (или <script>) и создать виртуальный SourceFile:
 *
 *     /path/to/Component.vue.__script__.ts
 *
 *   Но line numbers в виртуальном файле НЕ совпадают с
 *   line numbers в оригинальном .vue. Например:
 *
 *     <!-- Component.vue -->
 *     <template>...</template>          ← строки 1-N
 *     <script setup>                    ← строка N+1
 *     const x = 1;                      ← строка N+2 → виртуальная 1
 *     </script>                         ← строка N+3
 *
 *   Значит, нужен offset: virtualLine + offset = originalLine.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   Оригинал (.vue):
 *     строка 10: <script setup>
 *     строка 11:   const foo = () => {}
 *     строка 12: </script>
 *
 *   Виртуальный (.vue.__script__.ts):
 *     строка 1:   const foo = () => {}
 *
 *   Mapping:
 *     offset = 10 (виртуальная 1 = оригинальная 11)
 *     originalPath = '/path/to/Component.vue'
 *     virtualPath = '/path/to/Component.vue.__script__.ts'
 */
export interface VueLineMapping {
  /**
   * Смещение виртуальной строки относительно оригинальной.
   *
   * Формула: originalLine = virtualLine + offset.
   *
   * Пример: если <script setup> начинается на строке 10,
   * то offset = 10 (виртуальная 1 → оригинальная 11).
   */
  offset: number;

  /** Оригинальный путь к .vue (абсолютный) */
  originalPath: string;

  /** Путь к виртуальному SourceFile (абсолютный) */
  virtualPath: string;
}

// ============================================================
// ✅ v1.1.0: UNRESOLVED REASON
// ============================================================
//
// Причина, по которой вызов остался unresolved.
//
// Используется в диагностике `resolveCrossFileCalls`.
// Позволяет понять, почему в реальных проектах unresolved rate
// может доходить до 78%.
//
// ════════════════════════════════════════════════════════════
// ЗНАЧЕНИЯ
// ════════════════════════════════════════════════════════════
//
//   - 'symbol_not_found'       — ts-morph не смог разрешить символ
//                                 (файл не в Project, алиас не резолвится,
//                                  динамический ключ и т.д.)
//   - 'no_enclosing_function'  — не удалось найти enclosing function
//                                 (вызов на top-level модуля)
//   - 'no_target_file'         — целевой файл не входит в entitiesMap
//   - 'no_target_line'         — в целевом файле нет функции на этой строке
//   - 'no_target_file_id'      — targetFileId не найден в filePathToFileId
//
// ════════════════════════════════════════════════════════════
// РЕКОМЕНДАЦИИ ПО ДИАГНОСТИКЕ
// ════════════════════════════════════════════════════════════
//
//   • Если доминирует `symbol_not_found` (> 80%):
//       → проблема в tsconfig.json и/или путях алиасов
//       → проверьте compilerOptions.paths и baseUrl
//       → проверьте, что tsConfigPath передан в resolveCrossFileCalls
//
//   • Если много `no_enclosing_function`:
//       → это вызовы на top-level модуля (инициализация)
//       → это НЕ ошибка, так и должно быть
//
//   • Если много `no_target_line`:
//       → проблема с offset для .vue (lineOffset)
//       → проверьте VueLineMapping
//
// ⚠️ ВСЕГДА добавляйте новые значения в конец — это сохраняет
// совместимость с сохранёнными отчётами.
// ============================================================

export type UnresolvedReason =
  | 'symbol_not_found'
  | 'no_enclosing_function'
  | 'no_target_file'
  | 'no_target_line'
  | 'no_target_file_id';

// ============================================================
// ВНУТРЕННИЕ ТИПЫ
// ============================================================

/**
 * Запись в кэше символов.
 *
 * Используется внутри `SymbolResolver.symbolCache`.
 *
 * ════════════════════════════════════════════════════════════
 * КЛЮЧ
 * ════════════════════════════════════════════════════════════
 *
 *   - `sym:<fullyQualifiedName>`   — для Identifier
 *   - `prop:<fullyQualifiedName>`  — для PropertyAccess
 *   - `elem:<fullyQualifiedName>`  — для ElementAccess
 *
 * ════════════════════════════════════════════════════════════
 * ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   - `ResolvedCallee` — символ разрешён
 *   - `null`           — символ не разрешён (кэшируем отрицательный результат)
 */
export interface SymbolCacheEntry {
  /** Ключ кэша (`sym:...`, `prop:...`, `elem:...`) */
  key: string;

  /** Разрешённый callee или null */
  value: ResolvedCallee | null;
}

/**
 * Результат `resolveCallee` с диагностикой.
 *
 * Используется внутри `SymbolResolver` для отладки.
 * Не экспортируется наружу.
 */
export interface ResolveCalleeResult {
  /** Разрешённый callee или null */
  resolved: ResolvedCallee | null;

  /**
   * Причина, если resolved === null.
   *
   * Примеры:
   *   - 'symbol not found'
   *   - 'dynamic key (ElementAccess with non-literal)'
   *   - 'no declarations'
   *   - 'declaration kind not supported'
   */
  reason?: string;
}

// ============================================================
// РЕЭКСПОРТ ТИПОВ ДЛЯ УДОБСТВА
// ============================================================
// Потребители могут импортировать всё из одного места:
//
//   import type {
//     CrossFileCall,
//     ResolveStats,
//     ResolvedCallee,
//     UnresolvedReason,
//   } from './core/cross-file-resolver/types.js';
// ============================================================

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
//
// Все типы экспортируются через `export interface` / `export type`
// выше. Default-экспорт оставлен пустым для совместимости с
// инструментами, которые ожидают default export.
//
// Использование:
//   import type { CrossFileCall } from './types.js';           // ✅ рекомендуется
//   import types from './types.js';                             // ⚠️ не рекомендуется
// ============================================================

export default {
  // Типы экспортируются автоматически через `export interface`.
  // Значение по умолчанию оставлено пустым.
};
