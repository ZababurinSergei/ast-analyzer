#!/usr/bin/env node
// scripts/diagnose-component-props.ts
// ============================================================
// ДИАГНОСТИКА: где теряются identifier / literalValue в componentProps
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Проверяет, содержит ли compact.json поля `idn` (identifier) и
// `lv` (literalValue) в двух местах:
//   1. top-level  → compact.componentProps
//   2. внутри vue → compact.vue.componentProps
//
// А также показывает, какой индекс `n` ссылается на какой
// `idnIdx` / `lvIdx`, и декодирует их через `strs`/`tokens`.
//
// ЗАЧЕМ ЭТО НУЖНО
// ---------------
// Симптом в round-trip:
//   L1: $.vue.componentProps[0].identifier  a: null  b: "ai"
//   L1: $.vue.componentProps[1].literalValue a: undefined  b: 25
//
// Это означает, что `decode(compact)` не восстанавливает поля
// `identifier` / `literalValue`. Причина — в `decodeVueSection`
// источником выбирается `compact.vue.componentProps`, а массивов
// `idn`/`lv` там может не быть (они есть только в top-level
// `compact.componentProps`).
//
// Скрипт помогает локализовать баг: показывает, где `idn`/`lv`
// реально присутствуют, а где — нет.
//
// ИСПОЛЬЗОВАНИЕ
// -------------
//   npx tsx scripts/diagnose-component-props.ts ./ast-graph-viewer/index.json
//   npx tsx scripts/diagnose-component-props.ts   # по умолчанию
//
// ВЫВОД
// -----
//   === compact.componentProps (top-level) ===
//     exists: true
//     n.length: 866
//     idn exists: true   len: 866
//     lv  exists: true   len: 866
//     idn[0..5]: [ -1, -1, -1, -1, -1, -1 ]
//     lv [0..5]: [ -1, -1, -1, -1, -1, -1 ]
//
//   === compact.vue.componentProps ===
//     exists: true
//     n.length: 866
//     idn exists: false  len: 0    ← БАГ: здесь нет idn
//     lv  exists: false  len: 0    ← БАГ: здесь нет lv
//
//   === same object? ===
//     top === vue: false           ← БАГ: разные объекты
//
//   === Sample: какие n имеют identifier/lv ===
//     [0] idnIdx=-1 (null), lvIdx=-1 (null)
//     [1] idnIdx=-1 (null), lvIdx=42 (25)
//     ...
// ============================================================

import fs from 'fs';
import path from 'path';

// ============================================================
// АРГУМЕНТЫ
// ============================================================

const compactPath = process.argv[2] || './ast-graph-viewer/index.json';
const absolutePath = path.resolve(compactPath);

// ============================================================
// ЗАГРУЗКА
// ============================================================

if (!fs.existsSync(absolutePath)) {
  console.error(`❌ Файл не найден: ${absolutePath}`);
  process.exit(1);
}

let compact: any;
try {
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  compact = JSON.parse(raw);
} catch (err) {
  console.error(
    `❌ Не удалось распарсить JSON: ${err instanceof Error ? err.message : String(err)}`
  );
  process.exit(1);
}

// ============================================================
// ХЕЛПЕРЫ
// ============================================================

/**
 * Декодирует запись из `strs[]` через `tokens[]`.
 *
 *   - string          → как есть
 *   - number[]        → склейка tokens[i]
 *   - -1 / undefined  → null
 */
function decodeStrEntry(idx: number | undefined): string | null {
  if (idx === undefined || idx === null || idx < 0) return null;
  const strs = compact.strs || [];
  const tokens = compact.tokens || [];
  if (idx >= strs.length) return `<out-of-range: ${idx}>`;
  const entry = strs[idx];
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry)) {
    return entry.map((t: number) => String(tokens[t] ?? '')).join('');
  }
  return null;
}

/**
 * Форматирует массив коротко: первые N элементов.
 */
function preview(arr: unknown[] | undefined, n: number = 6): string {
  if (!Array.isArray(arr)) return '<not array>';
  if (arr.length === 0) return '[]';
  const head = arr
    .slice(0, n)
    .map(v => JSON.stringify(v))
    .join(', ');
  return arr.length > n ? `[ ${head}, ... +${arr.length - n} ]` : `[ ${head} ]`;
}

/**
 * Печатает секцию `componentProps` из указанного источника.
 */
function printPropsSection(label: string, cp: any): void {
  console.log(`=== ${label} ===`);
  console.log(`  exists:      ${!!cp}`);
  console.log(`  n.length:    ${cp?.n?.length ?? 0}`);
  console.log(`  idn exists:  ${Array.isArray(cp?.idn)}  len: ${cp?.idn?.length ?? 0}`);
  console.log(`  lv  exists:  ${Array.isArray(cp?.lv)}   len: ${cp?.lv?.length ?? 0}`);
  console.log(`  idn[0..5]:   ${preview(cp?.idn)}`);
  console.log(`  lv [0..5]:   ${preview(cp?.lv)}`);
  console.log('');
}

// ============================================================
// 1. TOP-LEVEL componentProps
// ============================================================

const top = compact.componentProps;
const vue = compact.vue?.componentProps;

printPropsSection('compact.componentProps (top-level)', top);
printPropsSection('compact.vue.componentProps', vue);

// ============================================================
// 2. СРАВНЕНИЕ ИСТОЧНИКОВ
// ============================================================

console.log('=== same object? ===');
console.log(`  top === vue: ${top === vue}`);
console.log('');

// ============================================================
// 3. АНАЛИЗ ПЕРВЫХ 20 ЗАПИСЕЙ
// ============================================================

const source = top || vue;
const sourceLabel = top ? 'top-level' : 'vue';

console.log(`=== Sample: какие n имеют identifier/lv (источник: ${sourceLabel}) ===`);

const maxSamples = Math.min(20, source?.n?.length ?? 0);
for (let i = 0; i < maxSamples; i++) {
  const idnIdx = source?.idn?.[i] ?? -1;
  const lvIdx = source?.lv?.[i] ?? -1;
  const idnStr = decodeStrEntry(idnIdx);
  const lvStr = decodeStrEntry(lvIdx);

  const nameIdx = source?.n?.[i] ?? -1;
  const nameStr = decodeStrEntry(nameIdx);
  const valueIdx = source?.v?.[i] ?? -1;
  const valueStr = decodeStrEntry(valueIdx);

  console.log(
    `  [${i}] name=${JSON.stringify(nameStr)} value=${JSON.stringify(valueStr)} ` +
      `idnIdx=${idnIdx} (${JSON.stringify(idnStr)}) ` +
      `lvIdx=${lvIdx} (${JSON.stringify(lvStr)})`
  );
}

console.log('');

// ============================================================
// 4. ИТОГОВЫЙ ВЕРДИКТ
// ============================================================

console.log('=== ВЕРДИКТ ===');

const topHasIdn = Array.isArray(top?.idn);
const topHasLv = Array.isArray(top?.lv);
const vueHasIdn = Array.isArray(vue?.idn);
const vueHasLv = Array.isArray(vue?.lv);

const topLenOk =
  topHasIdn && topHasLv && top.idn.length === top.n?.length && top.lv.length === top.n?.length;
const vueLenOk =
  vueHasIdn && vueHasLv && vue.idn.length === vue.n?.length && vue.lv.length === vue.n?.length;

if (top === vue) {
  console.log('  ✅ top-level === vue.componentProps — единый объект');
  if (topLenOk) {
    console.log('  ✅ idn/lv присутствуют и согласованы по длине');
    console.log('  → Баг, скорее всего, в decodeComponentProps (чтение idn/lv).');
  } else {
    console.log('  ❌ idn/lv отсутствуют или имеют неверную длину');
    console.log('  → Баг в encodeComponentPropsInline или в fillComponentAccumulators.');
  }
} else {
  console.log('  ❌ top-level !== vue.componentProps — РАЗНЫЕ объекты');
  console.log(
    `     top-level: idn=${topHasIdn} (len=${top?.idn?.length ?? 0}), ` +
      `lv=${topHasLv} (len=${top?.lv?.length ?? 0})`
  );
  console.log(
    `     vue:       idn=${vueHasIdn} (len=${vue?.idn?.length ?? 0}), ` +
      `lv=${vueHasLv} (len=${vue?.lv?.length ?? 0})`
  );
  console.log('');
  if (topLenOk && !vueLenOk) {
    console.log('  → БАГ: vue.componentProps НЕ содержит idn/lv, а top-level содержит.');
    console.log('  → Декодер должен читать из top-level (см. Правку 2).');
  } else if (vueLenOk && !topLenOk) {
    console.log('  → БАГ: top-level НЕ содержит idn/lv, а vue содержит.');
    console.log('  → Encode пишет в vue, но не в top-level.');
  } else if (topLenOk && vueLenOk) {
    console.log('  → Оба источника содержат idn/lv, но это РАЗНЫЕ объекты.');
    console.log('  → Декодер выбирает не тот источник (см. Правку 2).');
  } else {
    console.log('  → БАГ: ни top-level, ни vue не содержат корректных idn/lv.');
    console.log('  → Проблема в fillComponentAccumulators или encodeComponentPropsInline.');
  }
}

console.log('');
