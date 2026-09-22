// scripts/verify-consistency.ts
// ============================================
// Проверка согласованности index.json ↔ index.full.json
// ============================================
// Версия: 2.6.0
//
// ИЗМЕНЕНИЯ v2.6.0 (fix: ложное срабатывание values[] consistency):
//   - ✅ ИСПРАВЛЕНО: `checkValuesConsistency` больше НЕ сравнивает
//     `expectedKept` с `compactValues.length` напрямую.
//     Причина: `compact.values[]` — ДЕДУПЛИЦИРОВАННЫЙ словарь
//     (см. `addValue` в codec-encode.ts, dedupKey по
//     stableStringify). Если 100 констант имеют значение
//     `"relation"`, в values[] оно попадёт 1 раз, а
//     expectedKept посчитает 100.
//
//     СИМПТОМ (до фикса):
//       expectedKept=1955 > compact.values.length=547 — рассинхрон
//
//   - ✅ ДОБАВЛЕНО: проверка по МНОЖЕСТВАМ уникальных значений:
//       • `expectedUniqueKept` — множество уникальных значений
//         из full.constants[], которые должны сохраниться
//         (по isValueKept + canonicalizeForComparison).
//       • `actualInCompact` — множество значений, фактически
//         присутствующих в compact.values[].
//       • Проверка: `expectedUniqueKept ⊆ actualInCompact`.
//     Это корректно учитывает дедупликацию.
//
//   - ✅ ДОБАВЛЕНО: функция `canonicalizeForComparison(value)` —
//     единый ключ для сравнения значений, синхронизированный
//     с dedupKey в `addValue()` (codec-encode.ts v15.4.4).
//
//   - ✅ ДОБАВЛЕНО: диагностика `dedupRatio` —
//     `expectedKept / uniqueCount`. Показывает, насколько
//     активно работает дедупликация.
//
//   - ✅ СИНХРОНИЗИРОВАНО с codec-encode.ts v15.4.4
//     (addValue + isValueKept) и values-filter.ts v1.2.0.
//
// ИЗМЕНЕНИЯ v2.5.0 (JSON-safe проверки):
//   - ✅ ДОБАВЛЕНО: проверка, что full.constants[].value
//     содержит только JSON-safe значения.
//   - ✅ ДОБАВЛЕНО: проверка, что compact.values[]
//     не теряет данные при JSON round-trip.
//
// ИЗМЕНЕНИЯ v2.4.0 (проверка values[]):
//   - ✅ ДОБАВЛЕНО: проверка согласованности values[] между
//     compact и full.
//   - ✅ ДОБАВЛЕНО: функция checkValuesConsistency(compact, full).
//   - ✅ ДОБАВЛЕНО: секция «СОГЛАСОВАННОСТЬ VALUES».
//
// ИЗМЕНЕНИЯ v2.3.0 (проверка инварианта isExternal ↔ toFileId):
//   - ✅ ДОБАВЛЕНО: проверка `imports[].isExternal ↔ toFileId` —
//     ловит рассинхрон, когда toFileId="external:@/components",
//     а isExternal=false (регрессия v15.0.6 в compact-reporter.ts).
//   - ✅ ДОБАВЛЕНО: функция `checkImportsIsExternalConsistency(full)`.
//   - ✅ ДОБАВЛЕНО: секция «СОГЛАСОВАННОСТЬ IMPORTS».
//
// ИЗМЕНЕНИЯ v2.2.0 (устранение дублирования conditionals):
//   - ✅ УБРАНО: 'conditionals' из sectionNames в compareSections.
//   - ✅ ИСПРАВЛЕНО: checkConditionalsDedup — считает через
//     countConditionals(full) / countConditionals(decoded).
//   - ✅ ДОБАВЛЕНО: helper countConditionals(full: FullJSON): number.
//
// ИЗМЕНЕНИЯ v2.1.0 (под CODEC v15.0.1):
//   - ✅ ДОБАВЛЕНО: проверка conditionals dedup (compact.cd).
//
// ИЗМЕНЕНИЯ v2.0.0 (под CODEC v14.0.0):
//   - ✅ ДОБАВЛЕНО: проверка секций templates/lifecycle/effects/
//     injections/reactivity/conditionals/types/typeRefs.
//
// Назначение
// ----------
// Этот скрипт проверяет, что compact (index.json) и full
// (index.full.json) собраны из ОДНИХ И ТЕХ ЖЕ исходников.
//
// Использование
// -------------
//   npx tsx scripts/verify-consistency.ts
//   npx tsx scripts/verify-consistency.ts --compact example/index.json --full example/index.full.json
//   npx tsx scripts/verify-consistency.ts -v --max-diffs 50
// ============================================

import * as fs from 'fs';
import * as path from 'path';

import { encode } from '../src/reporters/codec/codec-encode.js';
import { decode } from '../src/reporters/codec/codec-decode.js';
import { deepEqual, collectDiffs } from '../src/reporters/codec/codec-verify.js';

// ✅ v2.4.0: импорт isValueKept для проверки values[]
import { isValueKept } from '../src/reporters/codec/values-filter.js';

// ✅ v2.5.0: импорт isJsonSafe для JSON-safe проверок
import { isJsonSafe, stableStringify } from '../src/reporters/codec/stable-stringify.js';

import type { FullJSON, CompactJSON } from '../src/reporters/codec/codec-types.js';

// Локальный diffObjects = collectDiffs с basePath='$'
function diffObjects(a: unknown, b: unknown, limit = 20) {
  return collectDiffs(a, b, '$', limit);
}

// ============================================
// АРГУМЕНТЫ КОМАНДНОЙ СТРОКИ
// ============================================

interface Args {
  compact: string;
  full: string;
  verbose: boolean;
  maxDiffs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    compact: 'ast-graph-viewer/index.json',
    full: 'ast-graph-viewer/index.full.json',
    verbose: false,
    maxDiffs: 20,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--verbose') args.verbose = true;
    else if (a === '--compact' && argv[i + 1]) args.compact = argv[++i]!;
    else if (a === '--full' && argv[i + 1]) args.full = argv[++i]!;
    else if (a === '--max-diffs' && argv[i + 1]) args.maxDiffs = parseInt(argv[++i]!, 10);
  }

  return args;
}

// ============================================
// ЦВЕТА
// ============================================

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const OK = `${C.green}✅${C.reset}`;
const FAIL = `${C.red}❌${C.reset}`;
const WARN = `${C.yellow}⚠️${C.reset}`;
const INFO = `${C.blue}ℹ️${C.reset}`;

// ============================================
// УТИЛИТЫ
// ============================================

function printHeader(title: string): void {
  console.log('');
  console.log('='.repeat(70));
  console.log(`  ${C.bold}${title}${C.reset}`);
  console.log('='.repeat(70));
}

function printSection(title: string): void {
  console.log('');
  console.log(`  ${C.bold}${title}${C.reset}`);
  console.log('  ' + '-'.repeat(66));
}

function printResult(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? OK : FAIL;
  const suffix = detail ? ` ${C.dim}${detail}${C.reset}` : '';
  console.log(`  ${mark} ${label}${suffix}`);
}

function formatSize(bytes: number): string {
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
  return bytes + ' B';
}

function readJson(filePath: string): any {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Файл не найден: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf-8');
  return JSON.parse(raw);
}

// ============================================
// stripServiceFields / stripForByteCompare
// ============================================

/**
 * Удаляет служебные поля, которые не должны участвовать в сравнении
 * `decode(compact) ≟ full`:
 *   - edges         — производное поле, добавляется только при
 *                     `includeEdges: true` в decode
 *   - edgesStats    — статистика edges
 *   - __codec       — служебное
 *   - legend        — легенда есть только в compact
 *   - поля, начинающиеся с `__`
 */
function stripServiceFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const { __codec, legend, ...rest } = obj;
  const clean: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    if (k === 'edges' || k === 'edgesStats') continue;
    clean[k] = v;
  }
  return clean;
}

/**
 * Для сравнения `encode(full) ≟ compact`:
 *   - удаляем legend  — легенда есть в compact, но не в full
 *   - удаляем __codec
 *   - удаляем edges/edgesStats
 *   - удаляем undefined/пустые, чтобы не считать их за расхождения
 */
function stripForByteCompare(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const { legend, __codec, ...rest } = obj;
  const clean: any = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('__')) continue;
    if (k === 'edges' || k === 'edgesStats') continue;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    clean[k] = v;
  }
  return clean;
}

// ============================================
// ✅ v2.2.0: ПОДСЧЁТ CONDITIONALS ЧЕРЕЗ templates[]
// ============================================

/**
 * Считает все conditionals внутри templates[].
 *
 * ⚠️ v2.2.0: conditionals больше НЕ существуют на верхнем уровне
 * FullJSON. Единственное место хранения — templates[].conditionals.
 */
function countConditionals(full: FullJSON): number {
  let count = 0;
  for (const t of full.templates ?? []) {
    count += (t.conditionals ?? []).length;
  }
  return count;
}

// ============================================
// ✅ v2.3.0: ПРОВЕРКА isExternal ↔ toFileId
// ============================================

/**
 * Проверяет, что для всех импортов выполняется инвариант:
 *
 *   toFileId.startsWith('external:')   →  isExternal === true
 *   toFileId.startsWith('unresolved:') →  isExternal === false
 *   /^f\d+$/.test(toFileId)            →  isExternal === false
 *   toFileId === null                  →  isExternal === false
 *
 * @param full — FullJSON для проверки
 * @returns { ok, violations, detail }
 */
function checkImportsIsExternalConsistency(full: FullJSON): {
  ok: boolean;
  violations: string[];
  detail: string;
} {
  const imports = full.imports ?? [];
  const violations: string[] = [];

  for (const imp of imports) {
    if (!imp || !imp.id) continue;

    const toFileId = imp.toFileId;
    const isExternal = imp.isExternal === true;

    // Определяем, каким должен быть isExternal по toFileId
    let expectedExternal: boolean;
    let kind: string;

    if (toFileId === null || toFileId === undefined) {
      expectedExternal = false;
      kind = 'null';
    } else if (toFileId.startsWith('external:')) {
      expectedExternal = true;
      kind = 'external:';
    } else if (toFileId.startsWith('unresolved:')) {
      expectedExternal = false;
      kind = 'unresolved:';
    } else if (/^f\d+$/.test(toFileId)) {
      expectedExternal = false;
      kind = 'local-f*';
    } else {
      // Невалидный префикс
      violations.push(
        `${imp.id}: toFileId="${toFileId}" — невалидный префикс (ожидается external:*, unresolved:*, f*, null)`
      );
      continue;
    }

    if (isExternal !== expectedExternal) {
      violations.push(
        `${imp.id}: isExternal=${isExternal}, toFileId="${toFileId}" (${kind}) — ожидается isExternal=${expectedExternal}`
      );
      if (violations.length >= 50) break;
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    detail:
      violations.length === 0
        ? `${imports.length} импортов согласованы`
        : `${violations.length} нарушений из ${imports.length}`,
  };
}

// ============================================
// ✅ v2.6.0: CANONICALIZE FOR COMPARISON
// ============================================

/**
 * ✅ v2.6.0: канонизирует значение для сравнения по множеству.
 *
 * Использует stableStringify — порядко-независимую сериализацию.
 * Это ТОТ ЖЕ ключ, что используется в `addValue` для дедупликации:
 *   dedupKey = 'O:' + stableStringify(value)
 *
 * Поэтому сравнение «значение из full.constants[] присутствует
 * в compact.values[]» корректно.
 *
 * Формат ключа (синхронизирован с `addValue` в codec-encode.ts):
 *   null      → 'N'
 *   undefined → 'U'
 *   string    → 'S:' + value
 *   number    → 'D:' + value
 *   boolean   → 'B:' + value
 *   bigint    → 'I:' + value.toString()
 *   object    → 'O:' + stableStringify(value)
 *   function  → 'X:' + String(value)
 *   symbol    → 'X:' + String(value)
 */
function canonicalizeForComparison(value: unknown): string {
  if (value === undefined) return 'U';
  if (value === null) return 'N';

  const t = typeof value;
  if (t === 'string') return 'S:' + value;
  if (t === 'number') return 'D:' + value;
  if (t === 'boolean') return 'B:' + value;
  if (t === 'bigint') return 'I:' + value.toString();
  if (t === 'object') return 'O:' + stableStringify(value);
  if (t === 'function') return 'X:' + String(value);
  if (t === 'symbol') return 'X:' + String(value);

  return 'X:' + String(value);
}

// ============================================
// ✅ v2.6.0: ПРОВЕРКА СОГЛАСОВАННОСТИ VALUES
// ============================================

/**
 * ✅ v2.6.0: проверяет согласованность values[] между compact и full.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ПРОВЕРЯЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Каждое УНИКАЛЬНОЕ значение из full.constants[].value,
 *      которое проходит `isValueKept(value, mode)`, должно
 *      присутствовать в compact.values[] (по canonicalizeForComparison-ключу).
 *
 *      ⚠️ ВАЖНО: дедупликация учитывается. Если 100 констант
 *      имеют значение `"relation"`, оно должно быть в
 *      compact.values[] ОДИН раз (не 100).
 *
 *   2. Диагностика `dedupRatio` = expectedKept / uniqueCount
 *      показывает, насколько активно работает дедупликация.
 *
 * ════════════════════════════════════════════════════════════
 * ЧЕГО НЕ ПРОВЕРЯЕТ (в отличие от v2.5.0)
 * ════════════════════════════════════════════════════════════
 *
 *   ❌ `expectedKept <= compact.values.length` — НЕВЕРНАЯ проверка.
 *      Причина: `compact.values[]` — дедуплицированный словарь,
 *      а `expectedKept` — количество констант (с повторами).
 *
 *      До v2.6.0 это давало ложное срабатывание:
 *        expectedKept=1955 > compact.values.length=547
 *
 * @param compact — CompactJSON
 * @param full    — FullJSON
 * @param limit   — максимум примеров в violations
 * @returns { ok, detail, violations, expectedKept, uniqueCount, actualUnique }
 */
function checkValuesConsistency(
  compact: CompactJSON,
  full: FullJSON,
  limit: number = 20
): {
  ok: boolean;
  detail: string;
  violations: string[];
  expectedKept: number;
  uniqueCount: number;
  actualUnique: number;
} {
  const violations: string[] = [];
  const mode = full.valuesMode ?? 'relations';

  const compactValues = compact.values || [];

  // ✅ v2.6.0: множество УНИКАЛЬНЫХ значений в compact.values[]
  const compactValueSet = new Set<string>();
  for (const v of compactValues) {
    compactValueSet.add(canonicalizeForComparison(v));
  }

  // ✅ v2.6.0: множество УНИКАЛЬНЫХ значений, которые ДОЛЖНЫ
  // быть в compact (по full.constants[] + isValueKept)
  const expectedUniqueKept = new Set<string>();

  let expectedKeptTotal = 0; // счётчик констант (с повторами)
  let expectedRemovedTotal = 0;

  for (const cn of full.constants || []) {
    if (cn.value === undefined) continue;

    const kept = isValueKept(cn.value, mode);

    if (kept) {
      expectedKeptTotal++;
      expectedUniqueKept.add(canonicalizeForComparison(cn.value));
    } else {
      expectedRemovedTotal++;
    }
  }

  // ✅ v2.6.0: главная проверка — каждое ожидаемое уникальное
  // значение должно присутствовать в compact.values[].
  for (const expectedKey of expectedUniqueKept) {
    if (!compactValueSet.has(expectedKey)) {
      violations.push(`Уникальное значение ${expectedKey} отсутствует в compact.values[]`);
      if (violations.length >= limit) break;
    }
  }

  // ✅ v2.6.0: диагностика дедупликации
  const expectedUniqueCount = expectedUniqueKept.size;
  const actualUniqueCount = compactValueSet.size;
  const dedupRatio =
    expectedUniqueCount > 0 ? (expectedKeptTotal / expectedUniqueCount).toFixed(2) : '1.00';

  const ok = violations.length === 0;

  const detail = ok
    ? `expectedKept=${expectedKeptTotal} (уникальных=${expectedUniqueCount}), ` +
    `compact.values=${actualUniqueCount} (dedup=${dedupRatio}x), ` +
    `removed=${expectedRemovedTotal}`
    : `${violations.length} нарушений ` +
    `(expectedKept=${expectedKeptTotal}, unique=${expectedUniqueCount}, ` +
    `compact.values=${actualUniqueCount})`;

  return {
    ok,
    detail,
    violations,
    expectedKept: expectedKeptTotal,
    uniqueCount: expectedUniqueCount,
    actualUnique: actualUniqueCount,
  };
}

// ============================================
// ✅ v2.5.0: JSON-SAFE ПРОВЕРКИ
// ============================================

/**
 * ✅ v2.5.0: проверяет, что full не содержит не-JSON-значений.
 *
 * Set, Map, RegExp, Date, class instances — не JSON-safe,
 * потому что JSON.stringify превращает их в '{}'.
 */
function checkJsonSafetyFull(
  full: FullJSON,
  limit: number
): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const violations: string[] = [];

  for (let i = 0; i < (full.constants || []).length; i++) {
    const cn = full.constants[i];
    if (!cn || cn.value === undefined) continue;

    if (!isJsonSafe(cn.value)) {
      const ctorName =
        typeof cn.value === 'object' && cn.value !== null
          ? (cn.value as any).constructor?.name ?? 'Object'
          : typeof cn.value;
      violations.push(`constants[${i}] (${cn.name}): ${ctorName}`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${full.constants?.length ?? 0} констант JSON-safe`
        : `${violations.length} не-JSON значений`,
    violations,
  };
}

/**
 * ✅ v2.5.0: проверяет, что compact.values[] не теряет данные
 * при JSON round-trip.
 */
function checkJsonRoundTripCompact(
  compact: CompactJSON,
  limit: number
): {
  ok: boolean;
  detail: string;
  violations: string[];
} {
  const violations: string[] = [];
  const values = compact.values || [];

  const beforeJson = JSON.stringify(values);
  const afterParse = JSON.parse(beforeJson) as unknown[];

  for (let i = 0; i < Math.min(values.length, afterParse.length); i++) {
    const before = JSON.stringify(values[i]);
    const after = JSON.stringify(afterParse[i]);
    if (before !== after) {
      violations.push(`values[${i}]: "${before}" → "${after}"`);
      if (violations.length >= limit) break;
    }
  }

  return {
    ok: violations.length === 0,
    detail:
      violations.length === 0
        ? `${values.length} значений JSON-safe`
        : `${violations.length} значений теряют данные`,
    violations,
  };
}

// ============================================
// СРАВНЕНИЕ СЛОВАРЕЙ
// ============================================

function compareDictionaries(
  label: string,
  a: { tokens: string[]; dict: (string | number[])[] },
  b: { tokens: string[]; dict: (string | number[])[] }
): { ok: boolean; diffs: { path: string; a: unknown; b: unknown }[] } {
  const diffs: { path: string; a: unknown; b: unknown }[] = [];

  const decodeEntry = (entry: string | number[], tokens: string[]): string => {
    if (typeof entry === 'string') return entry;
    return entry.map(i => tokens[i] || '').join('');
  };

  const aSet = new Set(a.dict.map(e => decodeEntry(e, a.tokens)));
  const bSet = new Set(b.dict.map(e => decodeEntry(e, b.tokens)));

  if (aSet.size !== bSet.size) {
    diffs.push({
      path: `${label}.size`,
      a: aSet.size,
      b: bSet.size,
    });
  }

  const onlyInA = [...aSet].filter(s => !bSet.has(s));
  const onlyInB = [...bSet].filter(s => !aSet.has(s));

  if (onlyInA.length > 0) {
    diffs.push({
      path: `${label}.onlyInA`,
      a: onlyInA.slice(0, 10),
      b: `(${onlyInA.length} всего)`,
    });
  }
  if (onlyInB.length > 0) {
    diffs.push({
      path: `${label}.onlyInB`,
      a: `(${onlyInB.length} всего)`,
      b: onlyInB.slice(0, 10),
    });
  }

  return { ok: diffs.length === 0, diffs };
}

// ============================================
// ✅ v2.2.0: СРАВНЕНИЕ СЕКЦИЙ
// ============================================

/**
 * Сравнивает секции full vs decoded.
 *
 * ⚠️ v2.2.0: 'conditionals' УБРАНЫ из sectionNames.
 */
function compareSections(
  decoded: FullJSON,
  full: FullJSON,
  maxDiffs: number
): Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> {
  const sectionNames = [
    'templates', // включает conditionals внутри
    'lifecycle',
    'effects',
    'injections',
    'reactivity',
    'types',
    'typeRefs',
  ] as const;

  const results: Array<{ name: string; ok: boolean; detail: string; diffs?: any[] }> = [];

  for (const name of sectionNames) {
    const a = (decoded as any)[name];
    const b = (full as any)[name];

    // Нормализуем: undefined ≡ []
    const normA = Array.isArray(a) ? a : [];
    const normB = Array.isArray(b) ? b : [];

    const ok = deepEqual(normA, normB);
    const detail = ok
      ? `${normA.length} элементов`
      : `decoded=${normA.length}, full=${normB.length}`;

    const result: { name: string; ok: boolean; detail: string; diffs?: any[] } = {
      name,
      ok,
      detail,
    };

    if (!ok) {
      result.diffs = diffObjects(normA, normB, maxDiffs);
    }

    results.push(result);
  }

  return results;
}

/**
 * Явная проверка imports[].isTypeOnly и isNamespace.
 */
function compareImportsTypeOnly(
  decoded: FullJSON,
  full: FullJSON,
  maxDiffs: number
): { ok: boolean; detail: string; diffs?: any[]; variant: 'A' | 'B' } {
  // Определяем вариант по full.imports
  const usesTypeLiteral = (full.imports || []).some((i: any) => i.type === 'type');
  const variant: 'A' | 'B' = usesTypeLiteral ? 'B' : 'A';

  const a = (decoded.imports || []).map((i: any) => ({
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));
  const b = (full.imports || []).map((i: any) => ({
    id: i.id,
    isTypeOnly: i.isTypeOnly,
    isNamespace: i.isNamespace,
    type: i.type,
  }));

  const ok = deepEqual(a, b);
  if (ok) {
    return {
      ok: true,
      detail: `${a.length} импортов (вариант ${variant})`,
      variant,
    };
  }

  const diffs = diffObjects(a, b, maxDiffs);
  return {
    ok: false,
    detail: `${diffs.length} расхождений (вариант ${variant})`,
    diffs,
    variant,
  };
}

// ============================================
// ✅ v2.2.0: ЯВНАЯ ПРОВЕРКА conditionals
// ============================================

/**
 * Проверяет, что количество conditionals в compact.cd[],
 * decoded.templates[].conditionals и full.templates[].conditionals
 * совпадает.
 */
function checkConditionalsDedup(
  compact: CompactJSON,
  decoded: FullJSON,
  full: FullJSON
): { ok: boolean; detail: string; diffs?: any[] } {
  const cdIndices = (compact as any).cd;

  // ✅ v2.2.0: считаем через templates[]
  const decodedCd = countConditionals(decoded);
  const fullCd = countConditionals(full);

  // Если секция отсутствует в compact — это ок, если и в full её нет
  if (!Array.isArray(cdIndices)) {
    if (fullCd === 0) {
      return { ok: true, detail: 'conditionals отсутствуют (0)' };
    }
    return {
      ok: false,
      detail: `compact.cd отсутствует, а full.templates[].conditionals = ${fullCd}`,
      diffs: [{ path: '$.cd', a: 'missing', b: `${fullCd} элементов в templates[]` }],
    };
  }

  const compactCdLen = cdIndices.length;
  const ok = compactCdLen === decodedCd && decodedCd === fullCd;

  if (ok) {
    return {
      ok: true,
      detail: `compact.cd=${compactCdLen}, templates=${decodedCd}/${fullCd}`,
    };
  }

  // Диагностика: уникальные индексы в compact.cd
  const uniqueIndices = new Set(cdIndices.filter((x: any) => typeof x === 'number'));
  const uniqueCount = uniqueIndices.size;

  const diffs: { path: string; a: unknown; b: unknown }[] = [
    {
      path: '$.cd.length',
      a: compactCdLen,
      b: `${fullCd} (unique values: ${uniqueCount})`,
    },
  ];

  if (uniqueCount < compactCdLen) {
    diffs.push({
      path: '$.cd (дедупликация)',
      a: `${compactCdLen} ссылок, но только ${uniqueCount} уникальных value`,
      b: 'ожидается 1:1 (addAny не должен дедуплицировать extended-секции)',
    });
  }

  return {
    ok: false,
    detail: `compact.cd=${compactCdLen}, decoded.templates=${decodedCd}, full.templates=${fullCd}, unique=${uniqueCount}`,
    diffs,
  };
}

// ============================================
// ОСНОВНАЯ ПРОВЕРКА
// ============================================

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
  diffs?: { path: string; a: unknown; b: unknown }[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  printHeader('🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ index.json ↔ index.full.json (v2.6.0)');
  console.log(`  ${INFO} compact: ${C.cyan}${path.resolve(args.compact)}${C.reset}`);
  console.log(`  ${INFO} full:    ${C.cyan}${path.resolve(args.full)}${C.reset}`);
  console.log(`  ${INFO} verbose: ${args.verbose}`);
  console.log(`  ${INFO} maxDiffs: ${args.maxDiffs}`);

  // ============================================
  // ЗАГРУЗКА
  // ============================================
  printSection('📂 ЗАГРУЗКА ФАЙЛОВ');

  const compactRaw = readJson(args.compact);
  const fullRaw = readJson(args.full);

  const compactSize = JSON.stringify(compactRaw).length;
  const fullSize = JSON.stringify(fullRaw).length;

  console.log(`  ${INFO} compact size: ${formatSize(compactSize)}`);
  console.log(`  ${INFO} full size:    ${formatSize(fullSize)}`);

  const compact = compactRaw as CompactJSON;
  const full = fullRaw as FullJSON;

  // ============================================
  // МЕТАДАННЫЕ
  // ============================================
  printSection('📅 МЕТАДАННЫЕ');

  const checks: CheckResult[] = [];

  // 1. timestamp
  {
    const a = compact.ts;
    const b = full.timestamp;
    const ok = a === b;
    checks.push({
      name: 'timestamp',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('timestamp', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  // 2. version
  {
    const a = compact.v;
    const b = full.version;
    const ok = a === b;
    checks.push({
      name: 'version',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('version', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  // 3. valuesMode
  {
    const a = compact.valuesMode ?? 'full';
    const b = full.valuesMode ?? 'full';
    const ok = a === b;
    checks.push({
      name: 'valuesMode',
      ok,
      detail: ok ? `"${a}"` : `"${a}" vs "${b}"`,
    });
    printResult('valuesMode', ok, ok ? `"${a}"` : `compact="${a}" full="${b}"`);
  }

  // ============================================
  // STATISTICS
  // ============================================
  printSection('📊 STATISTICS');

  {
    const a = compact.st || {};
    const b = full.statistics || {};
    const ok = deepEqual(a, b);
    const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
    checks.push({ name: 'statistics', ok, diffs });
    printResult(
      'statistics',
      ok,
      ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
    );
    if (!ok && args.verbose) {
      for (const d of diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
  }

  // ============================================
  // DECODE(COMPACT) ≟ FULL
  // ============================================
  printSection('🔁 decode(compact) ≟ full');

  let decodedCompact: FullJSON | null = null;
  {
    try {
      decodedCompact = decode(compact);
      const a = stripServiceFields(decodedCompact);
      const b = stripServiceFields(full);
      const ok = deepEqual(a, b);
      const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
      checks.push({ name: 'decode(compact) ≟ full', ok, diffs });
      printResult(
        'decode(compact) ≟ full',
        ok,
        ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
    } catch (err) {
      checks.push({ name: 'decode(compact) ≟ full', ok: false, detail: (err as Error).message });
      printResult('decode(compact) ≟ full', false, (err as Error).message);
    }
  }

  // ============================================
  // ENCODE(FULL) ≟ COMPACT
  // ============================================
  printSection('🔁 encode(full) ≟ compact');

  let encodedFull: CompactJSON | null = null;
  {
    try {
      encodedFull = encode(full, full.valuesMode ?? 'relations');
      const a = stripForByteCompare(encodedFull);
      const b = stripForByteCompare(compact);
      const ok = deepEqual(a, b);
      const diffs = ok ? [] : diffObjects(a, b, args.maxDiffs);
      checks.push({ name: 'encode(full) ≟ compact', ok, diffs });
      printResult(
        'encode(full) ≟ compact',
        ok,
        ok ? '' : `${diffs.length} расхождений (показано до ${args.maxDiffs})`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
    } catch (err) {
      checks.push({ name: 'encode(full) ≟ compact', ok: false, detail: (err as Error).message });
      printResult('encode(full) ≟ compact', false, (err as Error).message);
    }
  }

  // ============================================
  // ✅ v2.3.0: СОГЛАСОВАННОСТЬ IMPORTS (isExternal ↔ toFileId)
  // ============================================
  printSection('🔗 СОГЛАСОВАННОСТЬ IMPORTS (isExternal ↔ toFileId)');

  {
    const result = checkImportsIsExternalConsistency(full);
    printResult('imports[].isExternal ↔ toFileId', result.ok, result.detail);

    if (!result.ok && args.verbose) {
      for (const v of result.violations.slice(0, args.maxDiffs)) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
      if (result.violations.length > args.maxDiffs) {
        console.log(`     ${C.dim}... и ещё ${result.violations.length - args.maxDiffs}${C.reset}`);
      }
    }

    checks.push({
      name: 'imports[].isExternal ↔ toFileId',
      ok: result.ok,
      detail: result.detail,
    });
  }

  // ============================================
  // ✅ v2.6.0: СОГЛАСОВАННОСТЬ VALUES (compact.values ↔ full.constants)
  // ============================================
  printSection('🔢 СОГЛАСОВАННОСТЬ VALUES (compact.values ↔ full.constants)');

  {
    const result = checkValuesConsistency(compact, full, args.maxDiffs);
    printResult('values[] consistency', result.ok, result.detail);

    if (!result.ok && args.verbose) {
      for (const v of result.violations.slice(0, args.maxDiffs)) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
      if (result.violations.length > args.maxDiffs) {
        console.log(`     ${C.dim}... и ещё ${result.violations.length - args.maxDiffs}${C.reset}`);
      }
    }

    // ✅ v2.6.0: диагностика дедупликации
    if (args.verbose && result.ok) {
      const dedupRatio =
        result.uniqueCount > 0
          ? (result.expectedKept / result.uniqueCount).toFixed(2)
          : '1.00';
      console.log(
        `     ${C.dim}ℹ️  Дедупликация: ${result.expectedKept} → ${result.uniqueCount} (${dedupRatio}x)${C.reset}`
      );
    }

    checks.push({
      name: 'values[] consistency',
      ok: result.ok,
      detail: result.detail,
    });
  }

  // ============================================
  // ✅ v2.5.0: JSON-SAFE ПРОВЕРКИ
  // ============================================
  printSection('🔒 JSON-SAFE ПРОВЕРКИ');

  {
    const fullSafe = checkJsonSafetyFull(full, args.maxDiffs);
    printResult('full.constants[].value JSON-safe', fullSafe.ok, fullSafe.detail);
    if (!fullSafe.ok && args.verbose) {
      for (const v of fullSafe.violations) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
    }
    checks.push({
      name: 'full.constants[].value JSON-safe',
      ok: fullSafe.ok,
      detail: fullSafe.detail,
    });
  }

  {
    const compactSafe = checkJsonRoundTripCompact(compact, args.maxDiffs);
    printResult('compact.values[] JSON round-trip', compactSafe.ok, compactSafe.detail);
    if (!compactSafe.ok && args.verbose) {
      for (const v of compactSafe.violations) {
        console.log(`     ${C.red}•${C.reset} ${v}`);
      }
    }
    checks.push({
      name: 'compact.values[] JSON round-trip',
      ok: compactSafe.ok,
      detail: compactSafe.detail,
    });
  }

  // ============================================
  // МОДУЛИ
  // ============================================
  printSection('📦 МОДУЛИ (name и fileIds по индексам)');

  if (decodedCompact) {
    const aMods = decodedCompact.modules || [];
    const bMods = full.modules || [];
    const n = Math.min(aMods.length, bMods.length);

    if (aMods.length !== bMods.length) {
      printResult('modules.length', false, `compact=${aMods.length} full=${bMods.length}`);
      checks.push({
        name: 'modules.length',
        ok: false,
        detail: `compact=${aMods.length} full=${bMods.length}`,
      });
    }

    let nameDiffs = 0;
    let fileIdsDiffs = 0;

    for (let i = 0; i < n; i++) {
      const a = aMods[i];
      const b = bMods[i];
      if (!a || !b) continue;

      if (a.name !== b.name) {
        nameDiffs++;
        if (args.verbose && nameDiffs <= args.maxDiffs) {
          console.log(
            `  ${FAIL} modules[${i}].name: ${C.red}"${a.name}"${C.reset} → ${C.green}"${b.name}"${C.reset}`
          );
        }
      }

      const aIds = a.fileIds || [];
      const bIds = b.fileIds || [];
      if (!deepEqual(aIds, bIds)) {
        fileIdsDiffs++;
        if (args.verbose && fileIdsDiffs <= args.maxDiffs) {
          console.log(`  ${FAIL} modules[${i}].fileIds (name="${a.name}")`);
          console.log(`     ${C.red}${JSON.stringify(aIds)}${C.reset}`);
          console.log(`     ${C.green}${JSON.stringify(bIds)}${C.reset}`);
        }
      }
    }

    printResult(
      'modules[].name совпадают',
      nameDiffs === 0,
      nameDiffs === 0 ? `${n} модулей` : `${nameDiffs} расхождений`
    );
    printResult(
      'modules[].fileIds совпадают',
      fileIdsDiffs === 0,
      fileIdsDiffs === 0 ? `${n} модулей` : `${fileIdsDiffs} расхождений`
    );

    checks.push({ name: 'modules[].name', ok: nameDiffs === 0 });
    checks.push({ name: 'modules[].fileIds', ok: fileIdsDiffs === 0 });
  } else {
    printResult('modules', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'modules', ok: false, detail: 'decode failed' });
  }

  // ============================================
  // ✅ v2.2.0: СЕКЦИИ (без 'conditionals')
  // ============================================
  printSection(
    '🎨 СЕКЦИИ (templates, lifecycle, effects, injections, reactivity, types, typeRefs)'
  );

  if (decodedCompact) {
    const sectionResults = compareSections(decodedCompact, full, args.maxDiffs);

    for (const sr of sectionResults) {
      printResult(sr.name, sr.ok, sr.detail);
      if (!sr.ok && args.verbose && sr.diffs) {
        for (const d of sr.diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
      checks.push({ name: `section.${sr.name}`, ok: sr.ok, detail: sr.detail });
    }
  } else {
    printResult('sections', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'sections', ok: false, detail: 'decode failed' });
  }

  // ============================================
  // ИМПОРТЫ (isTypeOnly)
  // ============================================
  printSection('📥 ИМПОРТЫ (isTypeOnly / isNamespace / type)');

  if (decodedCompact) {
    const impResult = compareImportsTypeOnly(decodedCompact, full, args.maxDiffs);
    printResult('imports[].isTypeOnly', impResult.ok, impResult.detail);
    if (!impResult.ok && args.verbose && impResult.diffs) {
      for (const d of impResult.diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
    checks.push({
      name: 'imports[].isTypeOnly',
      ok: impResult.ok,
      detail: impResult.detail,
    });
  } else {
    printResult('imports', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'imports', ok: false, detail: 'decode failed' });
  }

  // ============================================
  // ✅ v2.2.0: CONDITIONALS (через templates[])
  // ============================================
  printSection('🎯 CONDITIONALS (через templates[], проверка дедупликации compact.cd[])');

  if (decodedCompact) {
    const dedupResult = checkConditionalsDedup(compact, decodedCompact, full);
    printResult('conditionals dedup', dedupResult.ok, dedupResult.detail);
    if (!dedupResult.ok && args.verbose && dedupResult.diffs) {
      for (const d of dedupResult.diffs.slice(0, args.maxDiffs)) {
        console.log(
          `     ${C.dim}${d.path}: ${C.reset}${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
        );
      }
    }
    checks.push({
      name: 'conditionals dedup',
      ok: dedupResult.ok,
      detail: dedupResult.detail,
    });
  } else {
    printResult('conditionals dedup', false, 'decode(compact) не удался — пропускаем');
    checks.push({ name: 'conditionals dedup', ok: false, detail: 'decode failed' });
  }

  // ============================================
  // СЛОВАРИ
  // ============================================
  printSection('📚 СЛОВАРИ (tokens/strs/params/methods)');

  if (encodedFull) {
    const dictChecks = [
      {
        label: 'strs',
        a: { tokens: compact.tokens || [], dict: compact.strs || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.strs || [] },
      },
      {
        label: 'params',
        a: { tokens: compact.tokens || [], dict: compact.params || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.params || [] },
      },
      {
        label: 'methods',
        a: { tokens: compact.tokens || [], dict: compact.methods || [] },
        b: { tokens: encodedFull.tokens || [], dict: encodedFull.methods || [] },
      },
    ];

    for (const { label, a, b } of dictChecks) {
      const { ok, diffs } = compareDictionaries(label, a, b);
      printResult(
        `${label} (семантически)`,
        ok,
        ok ? `${a.dict.length} записей` : `${diffs.length} расхождений`
      );
      if (!ok && args.verbose) {
        for (const d of diffs.slice(0, args.maxDiffs)) {
          console.log(
            `     ${C.dim}${d.path}:${C.reset} ${C.red}${JSON.stringify(d.a)}${C.reset} → ${C.green}${JSON.stringify(d.b)}${C.reset}`
          );
        }
      }
      checks.push({ name: `dict.${label}`, ok });
    }

    // tokens
    {
      const aSet = new Set(compact.tokens || []);
      const bSet = new Set(encodedFull.tokens || []);
      const ok = aSet.size === bSet.size && [...aSet].every(t => bSet.has(t));
      printResult(
        'tokens (семантически)',
        ok,
        ok ? `${aSet.size} токенов` : `compact=${aSet.size} encoded=${bSet.size}`
      );
      checks.push({ name: 'dict.tokens', ok });
    }
  } else {
    printResult('словари', false, 'encode(full) не удался — пропускаем');
    checks.push({ name: 'dictionaries', ok: false, detail: 'encode failed' });
  }

  // ============================================
  // ИТОГИ
  // ============================================
  printHeader('📊 ИТОГИ');

  const total = checks.length;
  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok).length;

  for (const c of checks) {
    const mark = c.ok ? OK : FAIL;
    const detail = c.detail ? ` ${C.dim}(${c.detail})${C.reset}` : '';
    console.log(`  ${mark} ${c.name}${detail}`);
  }

  console.log('');
  console.log(`  Всего:  ${total}`);
  console.log(`  ${C.green}Прошло: ${passed}${C.reset}`);
  if (failed > 0) {
    console.log(`  ${C.red}Провалено: ${failed}${C.reset}`);
  } else {
    console.log(`  ${C.dim}Провалено: 0${C.reset}`);
  }

  console.log('');
  if (failed === 0) {
    console.log(
      `  ${C.green}${C.bold}✅ СОГЛАСОВАНО — index.json и index.full.json собраны из одних исходников${C.reset}`
    );
    process.exit(0);
  } else {
    console.log(
      `  ${C.red}${C.bold}❌ РАССИНХРОНИЗИРОВАНО — index.json и index.full.json из разных сборок${C.reset}`
    );
    console.log('');
    console.log(`  ${WARN} Что делать:`);
    console.log('');
    console.log(`  ${C.bold}1. Пересобрать index.full.json${C.reset} из тех же исходников,`);
    console.log(`     что и index.json, ОДНИМ прогоном:`);
    console.log(`       generateCompactReport(entitiesMap, 'index.json', {`);
    console.log(`         saveFullJson: true,`);
    console.log(`         valuesMode: 'relations'`);
    console.log(`       });`);
    console.log(`     Это гарантирует совпадение timestamp и version.`);
    console.log('');
    console.log(`  ${C.bold}2. Проверить CODEC_VERSION${C.reset} в обоих файлах — должен`);
    console.log(`     быть ${C.cyan}'15.4.3'${C.reset} (или совпадать). Если full.json`);
    console.log(`     собирался старой версией кодека — его нужно`);
    console.log(`     пересобрать.`);
    console.log('');
    console.log(`  ${C.bold}3. Проверить valuesMode:${C.reset} если full.json собирался`);
    console.log(`     с valuesMode: 'relations', значения в`);
    console.log(`     full.constants[].value могут быть обрезаны —`);
    console.log(`     это ожидаемо. Если нужно полное содержимое —`);
    console.log(`     пересобрать с valuesMode: 'full'.`);
    console.log('');
    console.log(`  ${C.bold}4. Если расхождение в section.*${C.reset} — значит`);
    console.log(`     encode()/decode() не полностью поддерживают`);
    console.log(`     эти секции. Проверьте codec-encode.ts и codec-decode.ts.`);
    console.log('');
    console.log(`  ${C.bold}5. Если расхождение в conditionals${C.reset} (симптом:`);
    console.log(
      `     ${C.red}compact.cd=30, decoded=0${C.reset} или ${C.red}compact.cd=30, decoded=0, full=30${C.reset}):`
    );
    console.log(`     ${C.cyan}addAny()${C.reset} в codec-encode.ts мог дедуплицировать`);
    console.log(`     extended-секции через JSON.stringify. Если все`);
    console.log(`     conditionals одинаковы — они схлопываются в один`);
    console.log(`     value, и ${C.red}compact.cd = [380, 380, 380, ...]${C.reset}.`);
    console.log(`     Фикс: в ${C.cyan}addAny()${C.reset} НЕ дедуплицировать extended-`);
    console.log(`     секции (vt/lc/ef/inj/rx/cd/ty/tr).`);
    console.log('');
    console.log(`     ${C.dim}Проверьте, что decoded.templates[].conditionals и${C.reset}`);
    console.log(`     ${C.dim}full.templates[].conditionals совпадают по длине.${C.reset}`);
    console.log('');
    console.log(
      `  ${C.bold}6. Если расхождение в imports[].isExternal ↔ toFileId${C.reset} (симптом:`
    );
    console.log(
      `     ${C.red}toFileId="external:@/components", isExternal=false${C.reset}):`
    );
    console.log(`     ${C.cyan}resolveToFileId()${C.reset} в compact-reporter.ts превращает`);
    console.log(`     Vue-алиасы (${C.cyan}@/components/ui${C.reset}) в ${C.red}external:@/components${C.reset},`);
    console.log(`     тогда как ${C.cyan}isExternalModule('@/...')${C.reset} возвращает ${C.green}false${C.reset}.`);
    console.log(`     Фикс:`);
    console.log(`       1. В ${C.cyan}resolveToFileId()${C.reset} исключить алиасы`);
    console.log(`          ${C.cyan}@/${C.reset}, ${C.cyan}~/${C.reset}, ${C.cyan}#/${C.reset} из ветки «внешний пакет» —`);
    console.log(`          возвращать ${C.cyan}null${C.reset} (→ ${C.cyan}unresolved:@/components/ui${C.reset}).`);
    console.log(`       2. В ${C.cyan}compact-reporter.ts${C.reset} вычислять ${C.cyan}isExternal${C.reset}`);
    console.log(`          как ПРОИЗВОДНОЕ от ${C.cyan}resolvedToFileId${C.reset},`);
    console.log(`          а не от ${C.cyan}imp.toFileId${C.reset}.`);
    console.log(`       3. Пересобрать index.json и index.full.json.`);
    console.log('');
    console.log(
      `  ${C.bold}7. Если расхождение в values[]${C.reset} (симптом:`
    );
    console.log(
      `     ${C.red}$.values.length: a: 206 b: 208${C.reset} или ${C.red}$.cn.nonEmptyV[N][1] сдвиг${C.reset}):`
    );
    console.log(`     ${C.cyan}shouldKeepValue()${C.reset} в compact-reporter.ts и`);
    console.log(`     ${C.cyan}classifyValue()${C.reset} в values-filter.ts используют`);
    console.log(`     РАЗНЫЕ пороги для классификации значений.`);
    console.log(`     Если значение прошло ${C.cyan}shouldKeepValue${C.reset} (попало в`);
    console.log(`     full.constants[].value), но не прошло ${C.cyan}classifyValue${C.reset}`);
    console.log(`     (не попало в valueDict), то ${C.cyan}encode(full)${C.reset} даёт`);
    console.log(`     на N значений больше, чем compact на диске.`);
    console.log(`     Фикс:`);
    console.log(`       1. Вынести пороги в единый модуль`);
    console.log(`          ${C.cyan}src/reporters/codec/thresholds.ts${C.reset}`);
    console.log(`          (VALUE_THRESHOLDS).`);
    console.log(`       2. Использовать ${C.cyan}isValueKept()${C.reset} из`);
    console.log(`          ${C.cyan}values-filter.ts${C.reset} в ОБОИХ местах:`);
    console.log(`          • compact-reporter.ts::shouldKeepValue`);
    console.log(`          • codec-encode.ts::addValue`);
    console.log(`       3. Проверить, что classifyValue СОГЛАСОВАН с`);
    console.log(`          isValueKept (I14 в verify-roundtrip.ts).`);
    console.log(`       4. Пересобрать index.json и index.full.json.`);
    console.log('');
    console.log(
      `  ${C.bold}8. Если расхождение в JSON-safe${C.reset} (симптом:`
    );
    console.log(
      `     ${C.red}$.values.length: a: 703 b: 553${C.reset} или ${C.red}20 подряд {} в compact.values[]${C.reset}):`
    );
    console.log(`     В ${C.cyan}full.constants[].value${C.reset} или`);
    console.log(`     ${C.cyan}compact.values[]${C.reset} попали НЕ-JSON-значения:`);
    console.log(`       • Set, Map, RegExp, Date — ${C.red}JSON.stringify → '{}'${C.reset}`);
    console.log(`       • BigInt — ${C.red}JSON.stringify падает с ошибкой${C.reset}`);
    console.log(`       • class instances без toJSON → '{}'`);
    console.log(`     При записи index.json на диск эти значения`);
    console.log(`     теряются (превращаются в '{}'), и round-trip ломается.`);
    console.log(`     Фикс:`);
    console.log(`       1. В ${C.cyan}values-filter.ts::isValueKept${C.reset} вернуть`);
    console.log(`          ${C.red}false${C.reset} для не-JSON-объектов (через ${C.cyan}isJsonSafe${C.reset}).`);
    console.log(`       2. В ${C.cyan}stable-stringify.ts${C.reset} добавить`);
    console.log(`          ${C.cyan}isJsonSafe()${C.reset}, ${C.cyan}sanitizeForJson()${C.reset},`);
    console.log(`          ${C.cyan}jsonSafeStringify()${C.reset}.`);
    console.log(`       3. В ${C.cyan}compact-reporter.ts::saveJsonFile${C.reset}`);
    console.log(`          использовать ${C.cyan}jsonSafeStringify${C.reset} вместо`);
    console.log(`          ${C.red}JSON.stringify${C.reset}.`);
    console.log(`       4. Добавить инварианты ${C.cyan}I15/I16${C.reset} в`);
    console.log(`          ${C.cyan}verify-roundtrip.ts${C.reset}.`);
    console.log(`       5. Пересобрать index.json и index.full.json.`);
    console.log('');
    console.log(
      `  ${C.bold}9. Если расхождение в values[] consistency${C.reset} (симптом:`
    );
    console.log(
      `     ${C.red}expectedKept=1955 > compact.values.length=547${C.reset}):`
    );
    console.log(`     ${C.cyan}compact.values[]${C.reset} — ДЕДУПЛИЦИРОВАННЫЙ словарь.`);
    console.log(`     Если 100 констант имеют значение ${C.cyan}"relation"${C.reset},`);
    console.log(`     в values[] оно попадёт ${C.green}1 раз${C.reset}, а expectedKept`);
    console.log(`     посчитает ${C.red}100${C.reset}. Проверка "expectedKept <="`);
    console.log(`     "${C.red}compact.values.length${C.reset}" — НЕВЕРНА.`);
    console.log(`     Фикс (v2.6.0): проверять по МНОЖЕСТВАМ:`);
    console.log(`       1. ${C.cyan}expectedUniqueKept${C.reset} — Set уникальных`);
    console.log(`          значений из full.constants[].value.`);
    console.log(`       2. ${C.cyan}compactValueSet${C.reset} — Set значений из`);
    console.log(`          compact.values[].`);
    console.log(`       3. Проверка: ${C.cyan}expectedUniqueKept ⊆ compactValueSet${C.reset}.`);
    console.log(`       4. Диагностика ${C.cyan}dedupRatio${C.reset} = expectedKept / unique.`);
    console.log('');
    console.log(
      `  ${C.dim}Подробнее: scripts/verify-roundtrip.ts проверяет round-trip кодека.${C.reset}`
    );
    console.log(`${C.reset}`);
    process.exit(1);
  }
}

// ============================================
// ЗАПУСК
// ============================================

main().catch(err => {
  console.error(`${C.red}Фатальная ошибка:${C.reset}`, err);
  process.exit(2);
});
