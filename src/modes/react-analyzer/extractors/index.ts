// src/modes/react-analyzer/extractors/index.ts
// ============================================================
// ЭКСПОРТ ВСПОМОГАТЕЛЬНЫХ ЭКСТРАКТОРОВ REACT
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает вспомогательные функции для работы с .tsx/.jsx:
//   • Быстрая проверка «есть ли React-компоненты в файле»
//   • Извлечение списка имён компонентов
//   • Доступ к отдельным парсерам (hooks, JSX)
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   modes/vue-analyzer/extractors/index.ts — 10 extract*
//   React: modes/react-analyzer/extractors/index.ts ← этот файл
//
// ОТЛИЧИЕ
// -------
//   Vue extractors работают с .vue-источником (SFC).
//   React extractors работают с .tsx/.jsx-источником (AST).
//
//   Основная логика парсинга — в parser.ts.
//   Здесь — только обёртки и утилиты для переиспользования.
// ============================================================

import fs from 'fs';
import { parseReactFile, parseReactSource } from '../parser.js';
import type {
  ReactComponentAnalysis,
  AnalyzedComponent,
  AnalyzedHook,
  AnalyzeReactOptions,
} from '../types.js';

// ============================================================
// 1. БЫСТРАЯ ПРОВЕРКА
// ============================================================

/**
 * Быстрая проверка: содержит ли файл React-компоненты.
 *
 * Не парсит весь AST — только читает файл и ищет паттерны:
 *   • export function <Name>
 *   • export const <Name> = () =>
 *   • function <Name>
 *   • const <Name> = () =>
 *
 * Это дешёвая эвристика перед полным парсингом.
 *
 * @param filePath — путь к .tsx/.jsx
 * @returns true, если похоже на компонент
 */
export function isReactComponentFile(filePath: string): boolean {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    return isReactComponentSource(source);
  } catch {
    return false;
  }
}

/**
 * Проверка по содержимому (для тестов).
 */
export function isReactComponentSource(source: string): boolean {
  if (!source) return false;

  // ────────────────────────────────────────────────────────────
  // FE-40-FIX: export default () => {} / export default function Name()
  // ────────────────────────────────────────────────────────────
  // ПРИЧИНА:
  //   Main (fn2055) в modules/Main/components/Main/index.js —
  //   это `export default (symbol, mountPoint) => { ... }`.
  //   Старая версия НЕ распознавала этот паттерн, потому что:
  //     • `function` — только для named-функций
  //     • `const Name = () =>` — только для named-переменных
  //   Из-за этого `react.components[]` для f330 был пуст,
  //   хотя внутри используются useSelector/useEffect/useRef.
  //
  // РЕШЕНИЕ:
  //   1. `export default function Name(` — default-функция.
  //   2. `export default (args) => {}` — default-arrow.
  //   3. `export default async (args) => {}` — async default-arrow.
  //   4. `export default React.memo(...)` — default-memo.
  //
  // ⚠️ ОСТОРОЖНО:
  //   - Паттерн `export default` + arrow требует наличия React-хуков
  //     внутри, иначе любой `export default () => {}` (например,
  //     утилита) станет React-компонентом.
  //   - Но `isReactComponentSource` — только эвристика; финальное
  //     решение принимает `classifyReactEntities` через
  //     `e.reactComponents`. Если внутри нет хуков —
  //     `reactComponents` не заполнится.
  // ────────────────────────────────────────────────────────────

  // 1. export default function Name() / export function Name()
  if (/\b(?:export\s+)?function\s+[A-Z][A-Za-z0-9_]*\s*\(/.test(source)) return true;

  // 2. FE-40-FIX: export default function() / export default async function()
  if (/\bexport\s+default\s+(?:async\s+)?function\s*\(/.test(source)) return true;

  // 3. const Name = () => / export const Name =
  if (/\b(?:export\s+)?const\s+[A-Z][A-Za-z0-9_]*\s*=\s*(?:\(|async)/.test(source)) return true;

  // 4. FE-40-FIX: export default (args) => {} / export default async (args) => {}
  //    Ищем стрелку после `export default`, за которой есть `=>`.
  //    Ограничение: `=>` должно быть в пределах 200 символов после
  //    `export default`, чтобы не поймать большой файл с arrow-функцией
  //    где-то в середине.
  const defaultExportArrowMatch = source.match(
    /\bexport\s+default\s+(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/
  );
  if (defaultExportArrowMatch) return true;

  // 5. FE-40-FIX: export default React.memo(...) / export default React.forwardRef(...)
  if (/\bexport\s+default\s+React\.(?:memo|forwardRef)\s*\(/.test(source)) return true;

  // 6. React.memo / React.forwardRef (в любом месте)
  if (/React\.(?:memo|forwardRef)\s*\(/.test(source)) return true;

  // 7. FE-40-FIX: экспорт default-компонента по ссылке
  //    `const Main = () => {}; export default Main;`
  //    Если уже есть `const Main =` + `export default Main` — это компонент.
  //    Проверяем через: есть PascalCase const + export default <PascalCase>.
  const constPascal = /\bconst\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\(|async)/;
  const constMatch = source.match(constPascal);
  if (constMatch) {
    const name = constMatch[1];
    const exportDefaultRe = new RegExp(`\\bexport\\s+default\\s+${name}\\b`);
    if (exportDefaultRe.test(source)) return true;
  }

  return false;
}

// ============================================================
// 2. ИМЕНА КОМПОНЕНТОВ
// ============================================================

/**
 * Быстрый поиск имён компонентов в файле.
 *
 * @param filePath — путь к .tsx/.jsx
 * @returns массив имён (PascalCase)
 */
export function extractComponentNames(filePath: string): string[] {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    return extractComponentNamesFromSource(source);
  } catch {
    return [];
  }
}

/**
 * Быстрый поиск имён компонентов по содержимому.
 */
export function extractComponentNamesFromSource(source: string): string[] {
  const names = new Set<string>();

  // export function Name / function Name
  const fnRe = /\b(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(source)) !== null) {
    if (m[1]) names.add(m[1]);
  }

  // const Name = () => / const Name = function
  const constRe = /\b(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\(|async|function)/g;
  while ((m = constRe.exec(source)) !== null) {
    if (m[1]) names.add(m[1]);
  }

  return Array.from(names);
}

// ============================================================
// 3. ОБЁРТКИ ПАРСЕРА
// ============================================================

/**
 * Парсит файл и возвращает полный анализ.
 * Обёртка над parser.ts::parseReactFile.
 */
export function extractFromFile(
  filePath: string,
  options?: AnalyzeReactOptions
): ReactComponentAnalysis {
  return parseReactFile(filePath, options);
}

/**
 * Парсит содержимое и возвращает полный анализ.
 * Обёртка над parser.ts::parseReactSource.
 */
export function extractFromSource(
  source: string,
  filePath: string,
  options?: AnalyzeReactOptions
): ReactComponentAnalysis {
  return parseReactSource(source, filePath, options);
}

// ============================================================
// 4. СПЕЦИАЛЬНЫЕ ЭКСТРАКТОРЫ
// ============================================================

/**
 * Извлекает только компоненты (без импортов/экспортов).
 */
export function extractComponents(
  filePath: string,
  options?: AnalyzeReactOptions
): AnalyzedComponent[] {
  const analysis = parseReactFile(filePath, options);
  return analysis.components;
}

/**
 * Извлекает только хуки (плоский список по всему файлу).
 */
export function extractHooks(filePath: string, options?: AnalyzeReactOptions): AnalyzedHook[] {
  const analysis = parseReactFile(filePath, options);
  return analysis.hooks;
}

/**
 * Извлекает все имена импортов (source) из файла.
 */
export function extractImportSources(filePath: string): string[] {
  try {
    const analysis = parseReactFile(filePath);
    return analysis.imports.map(i => i.source);
  } catch {
    return [];
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  isReactComponentFile,
  isReactComponentSource,
  extractComponentNames,
  extractComponentNamesFromSource,
  extractFromFile,
  extractFromSource,
  extractComponents,
  extractHooks,
  extractImportSources,
};
