#!/usr/bin/env node
// scripts/verify-new-sections.ts
// ============================================================
// ПРОВЕРКА НОВЫХ СЕКЦИЙ CODEC v16.0.8
// ============================================================
// Версия: 1.2.4
//
// ИЗМЕНЕНИЯ v1.2.4 (синхронизация схем с codec-legend v16.0.8-fix):
//   - ✅ ОБНОВЛЕНО: длины схем в schemaChecks для 5 top-level секций
//     увеличены на 1 (добавлены поля idn / id):
//       • vue.componentProps:        9 → 10  (+idn)
//       • vue.componentEvents:       7 → 8   (+id)
//       • vue.componentDirectives:   5 → 6   (+id)
//       • vue.componentSlots:        4 → 5   (+id)
//       • vue.htmlInterpolations:    3 → 4   (+id)
//   - ✅ ПРИЧИНА: codec-legend.ts расширил схемы, чтобы decode(compact)
//     восстанавливал identifier / id / usageId симметрично full.json.
//     Без этого L1/L2/DL/DEC падали с расхождениями.
//
// ИЗМЕНЕНИЯ v1.2.3 (обновление до CODEC v16.0.8):
//   - ✅ ОБНОВЛЕНО: EXPECTED_CODEC_VERSION = '16.0.8'
//     (было '16.0.4'). Синхронизировано с codec-types.ts.
//   - ✅ ОБНОВЛЕНО: заголовок секции 'v16.0.4' → 'v16.0.8'.
//   - ✅ ОБНОВЛЕНО: тексты в блоке «Что делать» — 'v16.0.4' → 'v16.0.8',
//     CODEC_VERSION = "16.0.4" → "16.0.8".
//
// ИЗМЕНЕНИЯ v1.2.2 (fix TS6133 для targetFileName/targetFileId):
//   - ✅ FIX TS6133: `targetFileName` и `targetFileId` теперь
//     ИСПОЛЬЗУЮТСЯ в выводе диагностики:
//       • краткая шапка "Диагностируем: <file> (fileId: <id>)"
//       • строки "Имя файла:" и "Полный путь:"
//     Ранее переменные только присваивались — TypeScript ругался.
//
// ИЗМЕНЕНИЯ v1.2.1 (fix TS18046 + TS6133 + упрощение):
//   - ✅ FIX TS18046: в diagnoseFullVueSfcContent убран
//     `for (const c of cu.slice(0, 2))` (cu: unknown[] → c: unknown).
//     Теперь используется индексированный доступ с явной проверкой
//     через isPlainObject() + safeGetString().
//   - ✅ FIX TS6133: удалён интерфейс VueParserDiagnosis и объект
//     `diag` — они не использовались (только заполнялись).
//   - ✅ УПРОЩЕНО: diagnoseVueParser сразу выводит вердикт.
//   - ✅ ЦЕЛЬ: скрипт — это ЧИСТЫЙ ТЕСТ наличия данных в полях.
//     Если данных нет — показываем ПОЧЕМУ (через диагностику).
//
// ИЗМЕНЕНИЯ v1.2.0 (диагностика пустых cu_sfc/he_sfc):
//   - ✅ ДОБАВЛЕНО: diagnoseVueParser() — при обнаружении пустых
//     componentUsages/htmlElements берёт первый .vue из full.json
//     и напрямую вызывает parseSFC/compileTemplate/parseVueTemplate.
//   - ✅ ДОБАВЛЕНО: diagnoseFullVueSfcContent() — выводит реальные
//     значения первых 3 SFC из full.vue.sfc[].
//   - ✅ ДОБАВЛЕНО: --diagnose и --diagnose-file.
//
// ИЗМЕНЕНИЯ v1.1.1 (fix TS18046 + TS6133):
//   - ✅ FIX TS18046: в checkFullVueSfc явные type guards.
//   - ✅ FIX TS6133: убран неиспользуемый параметр compact.
//
// НАЗНАЧЕНИЕ:
//   Проверяет, что в index.json / index.full.json присутствуют
//   ВСЕ новые секции кодека v16.0.8, даже если они пусты.
//
//   Если секции пусты — показывает ПОЧЕМУ (диагностика).
//
// ИСПОЛЬЗОВАНИЕ:
//   npx tsx scripts/verify-new-sections.ts
//   npx tsx scripts/verify-new-sections.ts --compact path/to/index.json
//   npx tsx scripts/verify-new-sections.ts --full path/to/index.full.json
//   npx tsx scripts/verify-new-sections.ts --strict
//   npx tsx scripts/verify-new-sections.ts --diagnose
//   npx tsx scripts/verify-new-sections.ts --diagnose-file ./src/App.vue
//
// Exit code:
//   0 — все проверки пройдены
//   1 — есть провалы
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

// ✅ Диагностика через реальный парсер
import { parse as parseSFC, compileTemplate } from '@vue/compiler-sfc';

// ✅ Наш исправленный парсер
import { parseVueTemplate, getTemplateAst } from '../src/core/vue-template-parser.js';

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

interface Args {
  compact: string;
  full: string;
  strict: boolean;
  verbose: boolean;
  diagnose: boolean;
  diagnoseFile: string | null;
}

const DEFAULT_ARGS: Args = {
  compact: './ast-graph-viewer/index.json',
  full: './ast-graph-viewer/index.full.json',
  strict: false,
  verbose: false,
  diagnose: false,
  diagnoseFile: null,
};

// ✅ FIX v16.0.8: '16.0.4' → '16.0.8'
const EXPECTED_CODEC_VERSION = '16.0.8';
const EXPECTED_LEGEND_VERSION = '2.0.0';

// ============================================================
// ANSI
// ============================================================

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const OK = `${C.green}✅${C.reset}`;
const FAIL = `${C.red}❌${C.reset}`;
const WARN = `${C.yellow}⚠️${C.reset}`;
const INFO = `${C.blue}ℹ️${C.reset}`;
const SKIP = `${C.dim}⏭️${C.reset}`;

// ============================================================
// ЛОГГЕРЫ
// ============================================================

function section(title: string): void {
  console.log(`\n${C.bold}${C.blue}${'='.repeat(72)}${C.reset}`);
  console.log(`${C.bold}${C.blue}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.blue}${'='.repeat(72)}${C.reset}`);
}

function subsection(title: string): void {
  console.log(`\n${C.bold}${C.cyan}  ── ${title} ──${C.reset}`);
}

// ============================================================
// РЕЗУЛЬТАТЫ
// ============================================================

interface Check {
  name: string;
  ok: boolean;
  expected?: unknown;
  actual?: unknown;
  note?: string;
  skipped?: boolean;
}

const checks: Check[] = [];

function pass(name: string, note?: string): void {
  checks.push({ name, ok: true, note });
  console.log(`  ${OK} ${name}${note ? ` ${C.dim}(${note})${C.reset}` : ''}`);
}

function fail(name: string, expected: unknown, actual: unknown, note?: string): void {
  checks.push({ name, ok: false, expected, actual, note });
  console.log(`  ${FAIL} ${name}`);
  console.log(`      ${C.red}ожидалось:${C.reset} ${JSON.stringify(expected)}`);
  console.log(`      ${C.red}получено: ${C.reset} ${JSON.stringify(actual)}`);
  if (note) console.log(`      ${C.dim}${note}${C.reset}`);
}

function skip(name: string, reason: string): void {
  checks.push({ name, ok: true, skipped: true, note: reason });
  console.log(`  ${SKIP} ${name} ${C.dim}(${reason})${C.reset}`);
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function readJson(filePath: string): any {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf-8'));
  } catch (e) {
    console.error(`${C.red}Ошибка парсинга ${abs}:${C.reset}`, (e as Error).message);
    process.exit(2);
  }
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function hasKey(obj: any, key: string): boolean {
  return obj != null && typeof obj === 'object' && key in obj;
}

/**
 * ✅ v1.2.1: Безопасно извлекает строковое поле из unknown-объекта.
 */
function safeGetString(obj: unknown, key: string): string {
  if (!isPlainObject(obj)) return '<not object>';
  const v = obj[key];
  return typeof v === 'string' ? v : '<not string>';
}

// ============================================================
// 1. ПРОВЕРКА COMPACT (index.json)
// ============================================================

function checkCompactVersion(compact: any): void {
  subsection('Версия compact');

  if (compact.v === EXPECTED_CODEC_VERSION) {
    pass('compact.v', EXPECTED_CODEC_VERSION);
  } else {
    fail('compact.v', EXPECTED_CODEC_VERSION, compact.v);
  }

  const legendVersion = compact.legend?.version;
  if (legendVersion === EXPECTED_LEGEND_VERSION) {
    pass('compact.legend.version', EXPECTED_LEGEND_VERSION);
  } else {
    fail('compact.legend.version', EXPECTED_LEGEND_VERSION, legendVersion);
  }
}

function checkCompactSchemas(compact: any): void {
  subsection('Схемы в legend.schemas');

  const schemas = compact.legend?.schemas ?? {};
  // ✅ FIX v1.2.4: длины 5 схем увеличены на 1 (добавлены idn / id)
  const schemaChecks: Array<{ key: string; expected: number }> = [
    { key: 'mi', expected: 2 },
    { key: 'fl', expected: 2 },
    { key: 'fns', expected: 10 },
    { key: 'cls', expected: 6 },
    { key: 'cn', expected: 6 },
    { key: 'gr.e', expected: 9 },
    { key: 'gr.i', expected: 7 },
    { key: 'gr.c', expected: 8 },
    { key: 'gr.re', expected: 6 },
    { key: 'lc', expected: 5 },
    { key: 'ef', expected: 5 },
    { key: 'inj', expected: 5 },
    { key: 'rx', expected: 6 },
    { key: 'cd', expected: 6 },
    { key: 'ty', expected: 7 },
    { key: 'tr', expected: 5 },
    { key: 'lx', expected: 6 },
    { key: 'vue.sfc', expected: 30 },
    { key: 'vue.composables', expected: 5 },
    { key: 'vue.macros', expected: 3 },
    { key: 'vue.hooks', expected: 3 },
    { key: 'vue.reactivity', expected: 4 },
    { key: 'vue.icons', expected: 3 },
    // ✅ FIX v1.2.4: было 9/7/5/4/3 → стало 10/8/6/5/4
    { key: 'vue.componentProps', expected: 10 },
    { key: 'vue.componentEvents', expected: 8 },
    { key: 'vue.componentDirectives', expected: 6 },
    { key: 'vue.componentSlots', expected: 5 },
    { key: 'vue.htmlInterpolations', expected: 4 },
    { key: 'vue.fnHtmlUsage', expected: 9 },
    { key: 'domApiCalls', expected: 19 },
    { key: 'domApiArgs', expected: 4 },
    { key: 'ids', expected: 1 },
  ];

  for (const { key, expected } of schemaChecks) {
    const schema = schemas[key];
    if (!isArray(schema)) {
      fail(`legend.schemas.${key}`, `массив из ${expected} полей`, 'отсутствует');
      continue;
    }
    if (schema.length !== expected) {
      fail(`legend.schemas.${key}.length`, expected, schema.length);
      continue;
    }
    pass(`legend.schemas.${key}`, `${expected} полей`);
  }
}

function checkCompactFnsHv(compact: any): void {
  subsection('fns.hv — RLE для isHtmlVisible');

  const fns = compact.fns;
  if (!fns) {
    fail('compact.fns', 'объект', 'отсутствует');
    return;
  }

  if (!hasKey(fns, 'hv')) {
    fail('compact.fns.hv', 'RLE-массив', 'отсутствует');
    return;
  }

  if (!isArray(fns.hv)) {
    fail('compact.fns.hv', 'массив', typeof fns.hv);
    return;
  }

  const violations: string[] = [];
  let totalLength = 0;

  for (let i = 0; i < fns.hv.length; i++) {
    const entry = fns.hv[i];
    if (!isArray(entry) || entry.length !== 2) {
      violations.push(`fns.hv[${i}] не является парой [value, count]`);
      continue;
    }
    const [value, count] = entry as [unknown, unknown];
    if (value !== 0 && value !== 1) {
      violations.push(`fns.hv[${i}][0] = ${value} (ожидается 0 или 1)`);
    }
    if (typeof count !== 'number' || count < 0) {
      violations.push(`fns.hv[${i}][1] = ${count} (ожидается неотрицательное число)`);
    } else {
      totalLength += count;
    }
  }

  if (violations.length > 0) {
    fail('compact.fns.hv', 'массив RLE-пар (0|1, count)', violations.join('; '));
    return;
  }

  const fnsNLength = isArray(fns.n) ? fns.n.length : 0;
  if (totalLength !== fnsNLength) {
    fail(
      'compact.fns.hv (развёртка)',
      `сумма counts = ${fnsNLength}`,
      `сумма counts = ${totalLength}`
    );
    return;
  }

  const htmlVisibleCount = fns.hv.reduce((sum: number, e: any) => sum + (e[0] === 1 ? e[1] : 0), 0);

  pass(
    'compact.fns.hv',
    `${fns.hv.length} RLE-пар, развёртка = ${totalLength}, isHtmlVisible=true: ${htmlVisibleCount}`
  );
}

function checkCompactVueSfcFields(compact: any): void {
  subsection('vue.sfc — новые поля (RLE / slices)');

  const sfc = compact.vue?.sfc;
  if (!sfc) {
    skip('compact.vue.sfc', 'vue.sfc отсутствует (нет Vue-файлов)');
    return;
  }

  const sfcCount = Array.isArray(sfc.f) ? sfc.f.length : 0;

  const rleFields = ['cu_sfc', 'he_sfc'];
  for (const field of rleFields) {
    if (!hasKey(sfc, field)) {
      fail(`compact.vue.sfc.${field}`, 'RLE-массив', 'отсутствует');
      continue;
    }
    if (!isArray(sfc[field])) {
      fail(`compact.vue.sfc.${field}`, 'массив', typeof sfc[field]);
      continue;
    }
    pass(`compact.vue.sfc.${field}`, `${sfc[field].length} записей`);
  }

  const arrayFields = [
    'cu_tag',
    'cu_file',
    'cu_src',
    'cu_pkg',
    'cu_l',
    'cu_col',
    'cu_cp',
    'cu_ce',
    'cu_cd',
    'cu_csl',
    'he_tag',
    'he_l',
    'he_col',
    'he_cp',
    'he_cd',
    'he_ce',
    'he_ci',
    'pn',
    'ps',
    'en',
    'es',
    'xn',
    'xs',
  ];

  const alwaysRequiredIfSfc = new Set<string>([]);

  for (const field of arrayFields) {
    if (!hasKey(sfc, field)) {
      fail(`compact.vue.sfc.${field}`, 'массив', 'отсутствует');
      continue;
    }
    if (!isArray(sfc[field])) {
      fail(`compact.vue.sfc.${field}`, 'массив', typeof sfc[field]);
      continue;
    }

    if (sfcCount > 0 && sfc[field].length === 0 && alwaysRequiredIfSfc.has(field)) {
      fail(`compact.vue.sfc.${field}`, `непустой массив (${sfcCount} SFC)`, '0 записей');
      continue;
    }

    pass(`compact.vue.sfc.${field}`, `${sfc[field].length} записей`);
  }
}

function checkCompactTopLevelSections(compact: any): void {
  subsection('Top-level секции compact');

  const sections: Array<{ key: string; type: 'array' | 'object' }> = [
    { key: 'domApiCalls', type: 'object' },
    { key: 'domApiArgs', type: 'object' },
    { key: 'fnHtmlUsage', type: 'object' },
    { key: 'componentProps', type: 'object' },
    { key: 'componentEvents', type: 'object' },
    { key: 'componentDirectives', type: 'object' },
    { key: 'componentSlots', type: 'object' },
    { key: 'htmlInterpolations', type: 'object' },
    { key: 'ids', type: 'array' },
    { key: 'sourceChains', type: 'array' },
  ];

  for (const { key, type } of sections) {
    if (!hasKey(compact, key)) {
      skip(`compact.${key}`, 'отсутствует (пустая секция удалена)');
      continue;
    }
    const value = compact[key];
    if (type === 'array' && !isArray(value)) {
      fail(`compact.${key}`, 'массив', typeof value);
      continue;
    }
    if (type === 'object' && !isPlainObject(value)) {
      fail(`compact.${key}`, 'объект', typeof value);
      continue;
    }
    const len = isArray(value) ? value.length : Object.keys(value).length;
    pass(`compact.${key}`, `${len} записей`);
  }
}

// ============================================================
// 2. ПРОВЕРКА FULL (index.full.json)
// ============================================================

function checkFullVersion(full: any): void {
  subsection('Версия full');

  if (full.version === EXPECTED_CODEC_VERSION) {
    pass('full.version', EXPECTED_CODEC_VERSION);
  } else {
    fail('full.version', EXPECTED_CODEC_VERSION, full.version);
  }
}

function checkFullFunctions(full: any): void {
  subsection('functions[] — новые поля');

  const functions = full.functions;
  if (!isArray(functions)) {
    fail('full.functions', 'массив', typeof functions);
    return;
  }

  let missingIsHtmlVisible = 0;
  let missingHtmlUsage = 0;
  let missingDomApiCalls = 0;
  let missingUsagesAsPropSource = 0;
  let htmlVisibleTrue = 0;

  for (const fn of functions) {
    if (!isPlainObject(fn)) continue;

    if (!hasKey(fn, 'isHtmlVisible')) missingIsHtmlVisible++;
    else if (fn.isHtmlVisible === true) htmlVisibleTrue++;

    if (!hasKey(fn, 'htmlUsage') || !isArray(fn.htmlUsage)) missingHtmlUsage++;
    if (!hasKey(fn, 'domApiCalls') || !isArray(fn.domApiCalls)) missingDomApiCalls++;
    if (!hasKey(fn, 'usagesAsPropSource') || !isArray(fn.usagesAsPropSource)) {
      missingUsagesAsPropSource++;
    }
  }

  if (missingIsHtmlVisible === 0) {
    pass(
      'functions[].isHtmlVisible',
      `все ${functions.length} имеют поле; true: ${htmlVisibleTrue}`
    );
  } else {
    fail(
      'functions[].isHtmlVisible',
      'все функции имеют поле',
      `отсутствует у ${missingIsHtmlVisible}`
    );
  }

  if (missingHtmlUsage === 0) {
    pass('functions[].htmlUsage', `все ${functions.length} имеют массив`);
  } else {
    fail('functions[].htmlUsage', 'все функции имеют массив', `отсутствует у ${missingHtmlUsage}`);
  }

  if (missingDomApiCalls === 0) {
    pass('functions[].domApiCalls', `все ${functions.length} имеют массив`);
  } else {
    fail(
      'functions[].domApiCalls',
      'все функции имеют массив',
      `отсутствует у ${missingDomApiCalls}`
    );
  }

  if (missingUsagesAsPropSource === 0) {
    pass('functions[].usagesAsPropSource', `все ${functions.length} имеют массив`);
  } else {
    fail(
      'functions[].usagesAsPropSource',
      'все функции имеют массив',
      `отсутствует у ${missingUsagesAsPropSource}`
    );
  }
}

function checkFullVueSfc(full: any): void {
  subsection('vue.sfc[] — componentUsages / htmlElements');

  const sfc = full.vue?.sfc;
  if (!isArray(sfc)) {
    skip('full.vue.sfc', 'vue.sfc отсутствует');
    return;
  }

  if (sfc.length === 0) {
    skip('full.vue.sfc', 'нет Vue SFC в проекте');
    return;
  }

  let missingCu = 0;
  let missingHe = 0;
  let totalCu = 0;
  let totalHe = 0;

  for (const s of sfc) {
    if (!isPlainObject(s)) continue;

    const cuValue: unknown = s['componentUsages'];
    const heValue: unknown = s['htmlElements'];

    const hasCu = isArray(cuValue);
    const hasHe = isArray(heValue);

    if (!hasCu) {
      missingCu++;
    } else {
      totalCu += cuValue.length;
    }

    if (!hasHe) {
      missingHe++;
    } else {
      totalHe += heValue.length;
    }
  }

  if (missingCu === 0) {
    if (totalCu === 0 && sfc.length > 0) {
      fail(
        'vue.sfc[].componentUsages',
        `хотя бы 1 componentUsage среди ${sfc.length} SFC`,
        `0 (все ${sfc.length} SFC пусты) — вероятен баг в parseVueTemplate или analyzeVueSFC`
      );
    } else {
      pass('vue.sfc[].componentUsages', `все ${sfc.length} SFC имеют массив; всего: ${totalCu}`);
    }
  } else {
    fail('vue.sfc[].componentUsages', 'все SFC имеют массив', `отсутствует у ${missingCu}`);
  }

  if (missingHe === 0) {
    if (totalHe === 0 && sfc.length > 0) {
      fail(
        'vue.sfc[].htmlElements',
        `хотя бы 1 htmlElement среди ${sfc.length} SFC`,
        `0 (все ${sfc.length} SFC пусты) — вероятен баг в parseVueTemplate`
      );
    } else {
      pass('vue.sfc[].htmlElements', `все ${sfc.length} SFC имеют массив; всего: ${totalHe}`);
    }
  } else {
    fail('vue.sfc[].htmlElements', 'все SFC имеют массив', `отсутствует у ${missingHe}`);
  }
}

function checkFullTopLevelSections(full: any): void {
  subsection('Top-level секции full (v16.0.8)');

  const sections: Array<{ key: string; required: boolean; minLength?: number }> = [
    { key: 'componentProps', required: true, minLength: 1 },
    { key: 'componentEvents', required: true, minLength: 1 },
    { key: 'componentDirectives', required: true, minLength: 0 },
    { key: 'componentSlots', required: true, minLength: 0 },
    { key: 'htmlInterpolations', required: true, minLength: 1 },
    { key: 'domApiCalls', required: false },
    { key: 'domApiArgs', required: false },
    { key: 'fnHtmlUsage', required: false },
    { key: 'ids', required: false },
    { key: 'sourceChains', required: false },
  ];

  const hasVueSfc = Array.isArray(full.vue?.sfc) && full.vue.sfc.length > 0;

  for (const { key, required, minLength } of sections) {
    const effectiveRequired = required && hasVueSfc;

    if (!hasKey(full, key)) {
      if (effectiveRequired) {
        fail(
          `full.${key}`,
          `непустой массив (проект имеет ${full.vue?.sfc?.length || 0} SFC)`,
          'отсутствует'
        );
      } else if (required) {
        skip(`full.${key}`, 'проект без Vue SFC');
      } else {
        skip(`full.${key}`, 'отсутствует (пустая секция)');
      }
      continue;
    }
    const value = full[key];
    if (!isArray(value)) {
      fail(`full.${key}`, 'массив', typeof value);
      continue;
    }

    if (effectiveRequired && minLength !== undefined && value.length < minLength) {
      fail(
        `full.${key}`,
        `массив с длиной >= ${minLength} (проект имеет ${full.vue?.sfc?.length || 0} SFC)`,
        `${value.length} записей`
      );
      continue;
    }

    pass(`full.${key}`, `${value.length} записей`);
  }
}

// ============================================================
// 3. СОГЛАСОВАННОСТЬ COMPACT ↔ FULL
// ============================================================

function checkConsistency(compact: any, full: any): void {
  subsection('Согласованность compact ↔ full');

  const st = full.statistics ?? {};

  const fullDomApiLen = isArray(full.domApiCalls) ? full.domApiCalls.length : 0;
  if (st.totalDomApiCalls !== undefined) {
    if (st.totalDomApiCalls === fullDomApiLen) {
      pass('st.totalDomApiCalls = len(full.domApiCalls)', `${fullDomApiLen}`);
    } else {
      fail('st.totalDomApiCalls', `len(full.domApiCalls) = ${fullDomApiLen}`, st.totalDomApiCalls);
    }
  } else {
    skip('st.totalDomApiCalls', 'поле отсутствует в statistics');
  }

  const fullCpLen = isArray(full.componentProps) ? full.componentProps.length : 0;
  if (st.totalComponentProps !== undefined) {
    if (st.totalComponentProps === fullCpLen) {
      pass('st.totalComponentProps = len(full.componentProps)', `${fullCpLen}`);
    } else {
      fail(
        'st.totalComponentProps',
        `len(full.componentProps) = ${fullCpLen}`,
        st.totalComponentProps
      );
    }
  } else {
    skip('st.totalComponentProps', 'поле отсутствует в statistics');
  }

  const fullCeLen = isArray(full.componentEvents) ? full.componentEvents.length : 0;
  if (st.totalComponentEvents !== undefined) {
    if (st.totalComponentEvents === fullCeLen) {
      pass('st.totalComponentEvents = len(full.componentEvents)', `${fullCeLen}`);
    } else {
      fail(
        'st.totalComponentEvents',
        `len(full.componentEvents) = ${fullCeLen}`,
        st.totalComponentEvents
      );
    }
  } else {
    skip('st.totalComponentEvents', 'поле отсутствует в statistics');
  }

  const fullScLen = isArray(full.sourceChains) ? full.sourceChains.length : 0;
  if (st.totalSourceChains !== undefined) {
    if (st.totalSourceChains === fullScLen) {
      pass('st.totalSourceChains = len(full.sourceChains)', `${fullScLen}`);
    } else {
      fail('st.totalSourceChains', `len(full.sourceChains) = ${fullScLen}`, st.totalSourceChains);
    }
  } else {
    skip('st.totalSourceChains', 'поле отсутствует в statistics');
  }

  const functions = isArray(full.functions) ? full.functions : [];
  const htmlVisibleCount = functions.filter((f: any) => f?.isHtmlVisible === true).length;
  if (st.totalHtmlVisibleFns !== undefined) {
    if (st.totalHtmlVisibleFns === htmlVisibleCount) {
      pass('st.totalHtmlVisibleFns = count(isHtmlVisible=true)', `${htmlVisibleCount}`);
    } else {
      fail(
        'st.totalHtmlVisibleFns',
        `count(isHtmlVisible=true) = ${htmlVisibleCount}`,
        st.totalHtmlVisibleFns
      );
    }
  } else {
    skip('st.totalHtmlVisibleFns', 'поле отсутствует в statistics');
  }

  if (isArray(compact.ids)) {
    const idsLen = compact.ids.length;
    const cpMax = Math.max(-1, ...(compact.componentProps?.id || []));
    const uMax = Math.max(-1, ...(compact.fnHtmlUsage?.u || []));
    const tMax = Math.max(-1, ...(compact.domApiCalls?.t || []));
    const max = Math.max(cpMax, uMax, tMax);

    if (idsLen >= max + 1) {
      pass('len(compact.ids) >= max(id-индексы)', `ids=${idsLen}, max+1=${max + 1}`);
    } else {
      fail('len(compact.ids) >= max(id-индексы)', `>= ${max + 1}`, idsLen);
    }
  } else {
    skip('len(compact.ids)', 'ids отсутствует (пустая секция)');
  }

  if (isArray(compact.sourceChains)) {
    const scLen = compact.sourceChains.length;
    const rles: Array<[string, any[] | undefined]> = [
      ['componentProps.sc', compact.componentProps?.sc],
      ['componentEvents.sc', compact.componentEvents?.sc],
      ['htmlInterpolations.sc', compact.htmlInterpolations?.sc],
    ];

    let maxEnd = 0;
    for (const [, rle] of rles) {
      if (!isArray(rle)) continue;
      for (const entry of rle) {
        if (!isArray(entry) || entry.length < 2) continue;
        const [start, length] = entry as [number, number];
        const end = start + length;
        if (end > maxEnd) maxEnd = end;
      }
    }

    if (scLen >= maxEnd) {
      pass('len(compact.sourceChains) >= max(sc-индексы)', `sc=${scLen}, max=${maxEnd}`);
    } else {
      fail('len(compact.sourceChains) >= max(sc-индексы)', `>= ${maxEnd}`, scLen);
    }
  } else {
    skip('len(compact.sourceChains)', 'sourceChains отсутствует (пустая секция)');
  }
}

// ============================================================
// ДИАГНОСТИКА ПУСТЫХ СЕКЦИЙ
// ============================================================

function diagnoseEmptySections(full: any): void {
  section('🔍 ДИАГНОСТИКА ПУСТЫХ СЕКЦИЙ');

  const vueSfcCount = Array.isArray(full.vue?.sfc) ? full.vue.sfc.length : 0;
  const functionsCount = Array.isArray(full.functions) ? full.functions.length : 0;

  const diagnostics: Array<{
    name: string;
    value: number;
    suspicious: boolean;
    reason: string;
  }> = [
    {
      name: 'componentProps',
      value: Array.isArray(full.componentProps) ? full.componentProps.length : 0,
      suspicious: vueSfcCount > 0 && (full.componentProps?.length ?? 0) === 0,
      reason: 'Vue SFC есть, но componentProps пусты — проверьте parseVueTemplate и analyzeVueSFC',
    },
    {
      name: 'componentEvents',
      value: Array.isArray(full.componentEvents) ? full.componentEvents.length : 0,
      suspicious: vueSfcCount > 0 && (full.componentEvents?.length ?? 0) === 0,
      reason: 'Vue SFC есть, но componentEvents пусты — проверьте parseVueTemplate',
    },
    {
      name: 'htmlInterpolations',
      value: Array.isArray(full.htmlInterpolations) ? full.htmlInterpolations.length : 0,
      suspicious: vueSfcCount > 0 && (full.htmlInterpolations?.length ?? 0) === 0,
      reason: 'Vue SFC есть, но htmlInterpolations пусты — проверьте parseVueTemplate',
    },
    {
      name: 'domApiCalls',
      value: Array.isArray(full.domApiCalls) ? full.domApiCalls.length : 0,
      suspicious: functionsCount > 0 && (full.domApiCalls?.length ?? 0) === 0,
      reason:
        'Функции есть, но DOM API не найдены — проверьте isLikelyDomReceiver и buildScopeForFunction',
    },
    {
      name: 'sourceChains',
      value: Array.isArray(full.sourceChains) ? full.sourceChains.length : 0,
      suspicious: vueSfcCount > 0 && (full.sourceChains?.length ?? 0) === 0,
      reason:
        'Vue SFC есть, но sourceChains пусты — проверьте encodeComponentPropsInline/encodeComponentEventsInline',
    },
  ];

  let suspiciousCount = 0;
  for (const d of diagnostics) {
    if (d.suspicious) {
      console.log(`  ${WARN} ${d.name}: ${d.value} — ${C.yellow}${d.reason}${C.reset}`);
      suspiciousCount++;
    } else {
      console.log(`  ${INFO} ${d.name}: ${d.value}`);
    }
  }

  if (suspiciousCount > 0) {
    console.log('');
    console.log(
      `  ${C.red}${suspiciousCount} подозрительных пустых секций — вероятен баг в детекторах${C.reset}`
    );
    console.log('');
    console.log(`  ${WARN} Что проверить:`);
    console.log('    1. AST_DEBUG_VUE=true — покажет, парсится ли <template> каждого SFC');
    console.log('    2. Логи analyzeVueSFC — покажут cu/he/errors для каждого SFC');
    console.log('    3. buildScopeForFunction — находит ли SourceFile для каждой функции');
    console.log('    4. isLikelyDomReceiver — срабатывает ли эвристика на template refs');
  }
}

// ============================================================
// ДИАГНОСТИКА VUE PARSER
// ============================================================

function diagnoseVueParser(full: any, explicitFile: string | null): void {
  section('🔬 ДИАГНОСТИКА VUE PARSER');

  // ────────────────────────────────────────────────────────
  // 1. Определяем файл для диагностики
  // ────────────────────────────────────────────────────────
  let targetFile: string;
  let targetFileName: string;
  let targetFileId: string;

  if (explicitFile) {
    targetFile = path.resolve(explicitFile);
    targetFileName = path.basename(targetFile);
    targetFileId = '<explicit>';

    console.log(`  ${INFO} Явно указанный файл: ${targetFile}`);
  } else {
    const sfcList = Array.isArray(full?.vue?.sfc) ? full.vue.sfc : [];

    if (sfcList.length === 0) {
      console.log(`  ${WARN} В index.full.json нет SFC — нечего диагностировать`);
      return;
    }

    const sfc = sfcList[0];

    // ✅ v1.2.2: безопасно извлекаем fileId
    targetFileId = typeof sfc.fileId === 'string' ? sfc.fileId : '<unknown>';

    const filesList = Array.isArray(full?.files) ? full.files : [];
    const fileRecord = filesList.find((f: any) => f.id === sfc.fileId);

    if (!fileRecord || typeof fileRecord.path !== 'string') {
      console.log(`  ${FAIL} SFC ${targetFileId}: файл не найден в full.files`);
      return;
    }

    targetFile = path.resolve(fileRecord.path);
    targetFileName = path.basename(fileRecord.path);

    // ✅ v1.2.2: используем targetFileName и targetFileId в выводе
    const sfcName = typeof sfc.name === 'string' ? sfc.name : '<no name>';
    console.log(`  ${INFO} SFC из index.full.json: ${targetFileId} (${sfcName})`);
    console.log(`  ${INFO} Имя файла: ${targetFileName}`);
    console.log(`  ${INFO} Полный путь: ${targetFile}`);
  }

  // ✅ v1.2.2: краткая шапка — что именно диагностируем
  console.log('');
  console.log(
    `  ${C.bold}Диагностируем: ${C.cyan}${targetFileName}${C.reset} ${C.dim}(fileId: ${targetFileId})${C.reset}`
  );

  // ────────────────────────────────────────────────────────
  // 2. Проверка существования файла
  // ────────────────────────────────────────────────────────
  if (!fs.existsSync(targetFile)) {
    console.log(`  ${FAIL} Файл не существует: ${targetFile}`);
    return;
  }

  const fileSize = fs.statSync(targetFile).size;
  const src = fs.readFileSync(targetFile, 'utf-8');

  console.log('');
  console.log(`  ${C.bold}─── ФАЙЛ ───${C.reset}`);
  console.log(`  • Размер: ${fileSize} байт (${src.length} символов)`);

  // ────────────────────────────────────────────────────────
  // 3. Regex-проверка <template>
  // ────────────────────────────────────────────────────────
  const hasTemplateRegex = /<template[\s>]/i.test(src);
  console.log(`  • hasTemplateRegex: ${hasTemplateRegex ? '✅ true' : '❌ false'}`);

  const preview = src.substring(0, 200).replace(/\n/g, '\\n');
  console.log(`  • Первые 200 символов: ${C.dim}${preview}${C.reset}`);

  // ────────────────────────────────────────────────────────
  // 4. parseSFC
  // ────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${C.bold}─── parseSFC ───${C.reset}`);

  let descriptor: any = null;
  let parseSfcErrorsList: string[] = [];

  try {
    const parsed = parseSFC(src, { filename: targetFile });
    descriptor = parsed.descriptor;

    if (parsed.errors && parsed.errors.length > 0) {
      parseSfcErrorsList = parsed.errors.map((e: any) => String(e));
    }
  } catch (err) {
    parseSfcErrorsList.push(`exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`  • parseSFC errors: ${parseSfcErrorsList.length}`);
  for (const e of parseSfcErrorsList.slice(0, 3)) {
    console.log(`      ${C.red}•${C.reset} ${e}`);
  }

  const descriptorTemplateExists = !!descriptor?.template;
  const descriptorTemplateContentLength = descriptor?.template?.content?.length ?? 0;
  const descriptorTemplateAstExists = !!descriptor?.template?.ast;

  console.log(`  • descriptor.template: ${descriptorTemplateExists ? '✅ есть' : '❌ нет'}`);
  if (descriptorTemplateExists) {
    console.log(`  • descriptor.template.content.length: ${descriptorTemplateContentLength}`);
    console.log(
      `  • descriptor.template.ast: ${descriptorTemplateAstExists ? '✅ есть' : '❌ нет (undefined)'}`
    );
  }

  // ────────────────────────────────────────────────────────
  // 5. compileTemplate (fallback)
  // ────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${C.bold}─── compileTemplate (fallback) ───${C.reset}`);

  let compileTemplateAstExists: boolean | null = null;
  let compileTemplateErrorsList: string[] = [];

  if (descriptorTemplateExists && !descriptorTemplateAstExists) {
    try {
      const compiled = compileTemplate({
        source: descriptor.template.content,
        filename: targetFile,
        id: targetFile,
      });

      compileTemplateAstExists = !!compiled.ast;
      if (compiled.errors && compiled.errors.length > 0) {
        compileTemplateErrorsList = compiled.errors.map((e: any) => String(e));
      }

      console.log(`  • compileTemplate.ast: ${compileTemplateAstExists ? '✅ есть' : '❌ null'}`);
      console.log(`  • compileTemplate errors: ${compileTemplateErrorsList.length}`);
      for (const e of compileTemplateErrorsList.slice(0, 3)) {
        console.log(`      ${C.red}•${C.reset} ${e}`);
      }

      if (compiled.ast) {
        console.log(`  • ast.type: ${compiled.ast.type}`);
        console.log(
          `  • ast.children: ${Array.isArray(compiled.ast.children) ? compiled.ast.children.length : 'n/a'}`
        );
      }
    } catch (err) {
      console.log(`  • ${FAIL} exception: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (descriptorTemplateAstExists) {
    console.log(`  ${INFO} пропущено: descriptor.template.ast уже есть`);
  } else {
    console.log(`  ${INFO} пропущено: descriptor.template отсутствует`);
  }

  // ────────────────────────────────────────────────────────
  // 6. getTemplateAst (наш фикс из v1.1.0)
  // ────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${C.bold}─── getTemplateAst (v1.1.0) ───${C.reset}`);

  let getTemplateAstAstExists = false;
  let getTemplateAstErrorsList: string[] = [];

  try {
    const result = getTemplateAst(src, targetFile);
    getTemplateAstAstExists = !!result.ast;
    getTemplateAstErrorsList = result.errors;

    console.log(`  • ast: ${getTemplateAstAstExists ? '✅ есть' : '❌ null'}`);
    console.log(`  • errors: ${getTemplateAstErrorsList.length}`);
    for (const e of getTemplateAstErrorsList.slice(0, 3)) {
      console.log(`      ${C.red}•${C.reset} ${e}`);
    }

    if (result.ast) {
      console.log(`  • ast.type: ${result.ast.type}`);
      console.log(
        `  • ast.children: ${Array.isArray(result.ast.children) ? result.ast.children.length : 'n/a'}`
      );
    }
  } catch (err) {
    console.log(`  • ${FAIL} exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ────────────────────────────────────────────────────────
  // 7. parseVueTemplate (полный вызов)
  // ────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${C.bold}─── parseVueTemplate (полный вызов) ───${C.reset}`);

  let parseVueTemplateCuCount = 0;
  let parseVueTemplateHeCount = 0;
  let parseVueTemplateErrorsList: string[] = [];

  try {
    const result = parseVueTemplate(src, { filePath: targetFile });
    parseVueTemplateCuCount = result.componentUsages.length;
    parseVueTemplateHeCount = result.htmlElements.length;
    parseVueTemplateErrorsList = result.errors;

    console.log(`  • componentUsages: ${parseVueTemplateCuCount}`);
    console.log(`  • htmlElements: ${parseVueTemplateHeCount}`);
    console.log(`  • errors: ${parseVueTemplateErrorsList.length}`);
    for (const e of parseVueTemplateErrorsList.slice(0, 5)) {
      console.log(`      ${C.red}•${C.reset} ${e}`);
    }

    if (result.componentUsages.length > 0) {
      console.log(`  • Первые 3 componentUsages:`);
      for (const cu of result.componentUsages.slice(0, 3)) {
        console.log(
          `      • ${cu.id}: <${cu.tag}> props=${cu.props.length} ` +
            `events=${cu.events.length} directives=${cu.directives.length} slots=${cu.slots.length}`
        );
      }
    }

    if (result.htmlElements.length > 0) {
      console.log(`  • Первые 3 htmlElements:`);
      for (const he of result.htmlElements.slice(0, 3)) {
        console.log(
          `      • ${he.id}: <${he.tag}> props=${he.props.length} ` +
            `events=${he.events.length} interpolations=${he.interpolations.length}`
        );
      }
    }
  } catch (err) {
    console.log(`  • ${FAIL} exception: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ────────────────────────────────────────────────────────
  // 8. ВЕРДИКТ
  // ────────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${C.bold}─── ВЕРДИКТ ───${C.reset}`);

  if (parseVueTemplateCuCount > 0 || parseVueTemplateHeCount > 0) {
    console.log(
      `  ${C.green}${C.bold}✅ parseVueTemplate РАБОТАЕТ (cu=${parseVueTemplateCuCount}, he=${parseVueTemplateHeCount})${C.reset}`
    );
    console.log('');
    console.log(`  ${WARN} НО в index.full.json cu_sfc = 0, he_sfc = 0.`);
    console.log(`  ${WARN} Значит: index.full.json НЕ ПЕРЕСОБРАН после фикса!`);
    console.log('');
    console.log(`  ${INFO} Что делать:`);
    console.log(
      `    1. Найти команду сборки: grep -E '"build:wildCard|generate:wildCard|compact:wildCard"' package.json`
    );
    console.log(`    2. Запустить её: npm run build:wildCard`);
    console.log(`    3. Перезапустить verify-new-sections.ts`);
  } else if (descriptorTemplateAstExists) {
    console.log(
      `  ${C.red}${C.bold}❌ descriptor.template.ast ЕСТЬ, но parseVueTemplate вернул 0${C.reset}`
    );
    console.log(`  ${INFO} Проблема НЕ в парсере. Проверьте walk() в vue-template-parser.ts.`);
  } else if (compileTemplateAstExists) {
    console.log(
      `  ${C.red}${C.bold}❌ compileTemplate дал ast, но parseVueTemplate вернул 0${C.reset}`
    );
    console.log(
      `  ${INFO} Проблема НЕ в compileTemplate. Проверьте walk() в vue-template-parser.ts.`
    );
  } else if (getTemplateAstAstExists) {
    console.log(
      `  ${C.red}${C.bold}❌ getTemplateAst дал ast, но parseVueTemplate вернул 0${C.reset}`
    );
    console.log(`  ${INFO} Проблема в walk() — не обходит children.`);
  } else {
    console.log(`  ${C.red}${C.bold}❌ Шаблон не удалось распарсить${C.reset}`);
    console.log(`  ${INFO} Возможные причины:`);
    console.log(`    • <template> синтаксически сломан (см. compileTemplateErrors)`);
    console.log(`    • parseSFC вернул ошибки (см. parseSfcErrorsList)`);
    console.log(`    • файл не является Vue SFC`);
  }
}

// ============================================================
// ДИАГНОСТИКА СОДЕРЖИМОГО full.vue.sfc[]
// ============================================================

function diagnoseFullVueSfcContent(full: any): void {
  section('📋 СОДЕРЖИМОЕ full.vue.sfc[] (первые 3 SFC)');

  const sfcList = Array.isArray(full?.vue?.sfc) ? full.vue.sfc : [];

  if (sfcList.length === 0) {
    console.log(`  ${WARN} full.vue.sfc[] пуст`);
    return;
  }

  console.log(`  ${INFO} Всего SFC: ${sfcList.length}`);
  console.log('');

  const limit = Math.min(sfcList.length, 3);

  for (let i = 0; i < limit; i++) {
    const sfc = sfcList[i];

    // ✅ v1.2.1: явная проверка — isPlainObject
    if (!isPlainObject(sfc)) {
      console.log(`  ${C.bold}[${i}] <not object>${C.reset}`);
      continue;
    }

    const name = typeof sfc['name'] === 'string' ? sfc['name'] : '<no name>';
    const fileId = typeof sfc['fileId'] === 'string' ? sfc['fileId'] : '<no fileId>';
    const moduleId = typeof sfc['moduleId'] === 'string' ? sfc['moduleId'] : '<no moduleId>';
    const blocks = typeof sfc['blocks'] === 'number' ? sfc['blocks'] : '<no blocks>';

    console.log(`  ${C.bold}[${i}] ${name} (${fileId})${C.reset}`);
    console.log(`      • moduleId: ${moduleId}`);
    console.log(`      • blocks: ${blocks}`);

    // Безопасное извлечение массивов
    const composables = sfc['composables'];
    const props = sfc['props'];
    const emits = sfc['emits'];
    const exposed = sfc['exposed'];

    console.log(
      `      • composables.length: ${isArray(composables) ? composables.length : '<not array>'}`
    );
    console.log(`      • props.length: ${isArray(props) ? props.length : '<not array>'}`);
    console.log(`      • emits.length: ${isArray(emits) ? emits.length : '<not array>'}`);
    console.log(`      • exposed.length: ${isArray(exposed) ? exposed.length : '<not array>'}`);

    // ✅ КЛЮЧЕВЫЕ ПОЛЯ
    const cu = sfc['componentUsages'];
    const he = sfc['htmlElements'];

    console.log(
      `      • componentUsages: ${isArray(cu) ? `${cu.length} записей` : `❌ <not array: ${typeof cu}>`}`
    );
    console.log(
      `      • htmlElements: ${isArray(he) ? `${he.length} записей` : `❌ <not array: ${typeof he}>`}`
    );

    // ✅ v1.2.1: безопасный вывод первых элементов через индексирование
    if (isArray(cu) && cu.length > 0) {
      console.log(`      • Первые 2 componentUsages:`);
      const cuLimit = Math.min(cu.length, 2);
      for (let j = 0; j < cuLimit; j++) {
        const item = cu[j];
        if (!isPlainObject(item)) continue;
        const id = safeGetString(item, 'id');
        const tag = safeGetString(item, 'tag');
        console.log(`          - ${id}: <${tag}>`);
      }
    }

    if (isArray(he) && he.length > 0) {
      console.log(`      • Первые 2 htmlElements:`);
      const heLimit = Math.min(he.length, 2);
      for (let j = 0; j < heLimit; j++) {
        const item = he[j];
        if (!isPlainObject(item)) continue;
        const id = safeGetString(item, 'id');
        const tag = safeGetString(item, 'tag');
        console.log(`          - ${id}: <${tag}>`);
      }
    }

    console.log('');
  }

  if (sfcList.length > 3) {
    console.log(`  ${C.dim}... и ещё ${sfcList.length - 3} SFC${C.reset}`);
  }
}

// ============================================================
// 4. ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

function parseArgs(argv: string[]): Args {
  const args: Args = { ...DEFAULT_ARGS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--compact' && argv[i + 1]) args.compact = argv[++i]!;
    else if (a === '--full' && argv[i + 1]) args.full = argv[++i]!;
    else if (a === '--strict') args.strict = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--diagnose') args.diagnose = true;
    else if (a === '--diagnose-file' && argv[i + 1]) {
      args.diagnose = true;
      args.diagnoseFile = argv[++i]!;
    } else if (a === '--help' || a === '-h') {
      console.log(
        `\nИспользование: verify-new-sections [опции]\n\nОпции:\n  --compact <path>         Путь к compact JSON (по умолчанию: ./ast-graph-viewer/index.json)\n  --full <path>            Путь к full JSON (по умолчанию: ./ast-graph-viewer/index.full.json)\n  --strict                 Падать, если опциональные секции отсутствуют\n  --verbose, -v            Подробный вывод\n  --diagnose               Запустить диагностику Vue parser\n  --diagnose-file <path>   Указать .vue для диагностики (включает --diagnose)\n  --help, -h               Показать справку\n\nExit code:\n  0 — все проверки пройдены\n  1 — есть провалы\n  2 — ошибка чтения файла\n`
      );
      process.exit(0);
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // ✅ FIX v16.0.8: 'v16.0.4' → 'v16.0.8'
  section('🔬 ПРОВЕРКА НОВЫХ СЕКЦИЙ CODEC v16.0.8');
  console.log(`  ${INFO} compact: ${C.cyan}${path.resolve(args.compact)}${C.reset}`);
  console.log(`  ${INFO} full:    ${C.cyan}${path.resolve(args.full)}${C.reset}`);
  console.log(`  ${INFO} strict:  ${args.strict}`);
  console.log(`  ${INFO} diagnose: ${args.diagnose}`);
  if (args.diagnoseFile) {
    console.log(`  ${INFO} diagnoseFile: ${args.diagnoseFile}`);
  }

  // ============================================================
  // ЗАГРУЗКА
  // ============================================================

  section('📂 ЗАГРУЗКА ФАЙЛОВ');

  const compact = readJson(args.compact);
  const full = readJson(args.full);

  if (!compact) {
    console.log(`  ${FAIL} compact не найден: ${args.compact}`);
    process.exit(2);
  }
  if (!full) {
    console.log(`  ${FAIL} full не найден: ${args.full}`);
    process.exit(2);
  }

  pass('compact загружен', `${Object.keys(compact).length} ключей`);
  pass('full загружен', `${Object.keys(full).length} ключей`);

  // ============================================================
  // ПРОВЕРКА COMPACT
  // ============================================================

  section('📦 COMPACT (index.json)');
  checkCompactVersion(compact);
  checkCompactSchemas(compact);
  checkCompactFnsHv(compact);
  checkCompactVueSfcFields(compact);
  checkCompactTopLevelSections(compact);

  // ============================================================
  // ПРОВЕРКА FULL
  // ============================================================

  section('📄 FULL (index.full.json)');
  checkFullVersion(full);
  checkFullFunctions(full);
  checkFullVueSfc(full);
  checkFullTopLevelSections(full);

  // ============================================================
  // СОГЛАСОВАННОСТЬ
  // ============================================================

  section('🔗 СОГЛАСОВАННОСТЬ COMPACT ↔ FULL');
  checkConsistency(compact, full);

  // ============================================================
  // ДИАГНОСТИКА ПУСТЫХ СЕКЦИЙ
  // ============================================================

  diagnoseEmptySections(full);

  // ============================================================
  // ДИАГНОСТИКА VUE PARSER
  // ============================================================

  const vueSfcCount = Array.isArray(full?.vue?.sfc) ? full.vue.sfc.length : 0;

  let totalCu = 0;
  let totalHe = 0;

  if (Array.isArray(full?.vue?.sfc)) {
    for (const s of full.vue.sfc) {
      if (!isPlainObject(s)) continue;
      const cu = s['componentUsages'];
      const he = s['htmlElements'];
      if (isArray(cu)) totalCu += cu.length;
      if (isArray(he)) totalHe += he.length;
    }
  }

  const shouldDiagnose = args.diagnose || (vueSfcCount > 0 && totalCu === 0 && totalHe === 0);

  if (shouldDiagnose) {
    diagnoseVueParser(full, args.diagnoseFile);
    diagnoseFullVueSfcContent(full);
  }

  // ============================================================
  // ИТОГИ
  // ============================================================

  section('📊 ИТОГИ');

  const passed = checks.filter(c => c.ok && !c.skipped).length;
  const failed = checks.filter(c => !c.ok).length;
  const skipped = checks.filter(c => c.skipped).length;

  console.log(`  Всего проверок: ${checks.length}`);
  console.log(`  ${C.green}Прошло:  ${passed}${C.reset}`);
  if (failed > 0) {
    console.log(`  ${C.red}Провалено: ${failed}${C.reset}`);
  } else {
    console.log(`  ${C.dim}Провалено: 0${C.reset}`);
  }
  if (skipped > 0) {
    console.log(`  ${C.dim}Пропущено: ${skipped}${C.reset}`);
  }

  console.log('');
  if (failed === 0) {
    // ✅ FIX v16.0.8: 'v16.0.4' → 'v16.0.8'
    console.log(
      `  ${C.green}${C.bold}✅ ВСЕ НОВЫЕ СЕКЦИИ v16.0.8 ПРИСУТСТВУЮТ И КОРРЕКТНЫ${C.reset}`
    );
    if (skipped > 0) {
      console.log(
        `  ${C.dim}ℹ️  Пропущенные секции пусты — это нормально для проекта без Vue/DOM API${C.reset}`
      );
    }
    process.exit(0);
  } else {
    // ✅ FIX v16.0.8: 'v16.0.4' → 'v16.0.8'
    console.log(`  ${C.red}${C.bold}❌ ЕСТЬ ПРОБЛЕМЫ — новые секции v16.0.8 неполные${C.reset}`);
    console.log('');
    console.log(`  ${WARN} Что делать:`);
    console.log('  1. Пересобрать index.json / index.full.json через compact-reporter.ts v16.0.8');
    console.log('  2. Проверить CODEC_VERSION = "16.0.8" в codec-types.ts');
    console.log('  3. Проверить LEGEND_VERSION = "2.0.0" в codec-legend.ts');
    console.log('  4. Проверить, что decode(compact) симметричен compact-reporter.ts');
    console.log('');
    console.log(`  ${INFO} Если componentUsages/htmlElements пусты — запустите:`);
    console.log(`     npx tsx scripts/verify-new-sections.ts --diagnose`);
    process.exit(1);
  }
}

main();
