// src/modes/react-analyzer/index.ts
// ============================================================
// ЯДРО АНАЛИЗА REACT-КОМПОНЕНТОВ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Публичная точка входа для анализа .tsx/.jsx файлов.
// Симметрична modes/vue-analyzer/index.ts.
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   modes/vue-analyzer.ts + modes/vue-analyzer/index.ts
//            → analyzeVueComponent(filePath, options)
//
//   React: modes/react-analyzer/index.ts
//            → analyzeReactComponent(filePath, options)  ← этот файл
//
// ЧТО ЭКСПОРТИРУЕТ
// ----------------
//   • analyzeReactComponent   — анализ файла
//   • analyzeReactSource      — анализ из строки
//   • parseReactFile          — (реэкспорт из parser.ts)
//   • parseReactSource        — (реэкспорт из parser.ts)
//   • все extractors          — (реэкспорт из extractors/index.ts)
//   • все типы                — (реэкспорт из types.ts)
//
// ЧЕГО НЕ ДЕЛАЕТ
// --------------
//   • Не классифицирует в ReactEntities (это core/react-entity-classifier.ts)
//   • Не конвертирует в ReactSectionFull (это convert-section.ts)
//   • Не пишет в pipeline (это pass-7-react.ts)
// ============================================================

import fs from 'fs';
import path from 'path';

import { parseReactFile, parseReactSource } from './parser.js';

import {
  isReactComponentFile,
  isReactComponentSource,
  extractComponentNames,
  extractComponentNamesFromSource,
  extractFromFile,
  extractFromSource,
  extractComponents,
  extractHooks,
  extractImportSources,
} from './extractors/index.js';

import type {
  ReactComponentAnalysis,
  AnalyzedComponent,
  AnalyzedHook,
  AnalyzedJsxElement,
  AnalyzedJsxEvent,
  AnalyzedConditional,
  AnalyzedComponentUsage,
  AnalyzedImport,
  AnalyzedExport,
  AnalyzeReactOptions,
} from './types.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Анализирует .tsx/.jsx файл.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверка существования файла.
 *   2. Проверка расширения (.tsx/.jsx).
 *   3. Делегирование в parseReactFile().
 *   4. Возврат ReactComponentAnalysis.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param filePath — абсолютный или относительный путь
 *   @param options  — опции анализа (verbose, maxDepth, ...)
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   ReactComponentAnalysis | null
 *
 *   null — если файл не существует или не .tsx/.jsx.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const analysis = analyzeReactComponent('/src/App.tsx');
 *   if (analysis) {
 *     console.log(`Компонентов: ${analysis.stats.componentCount}`);
 *     for (const c of analysis.components) {
 *       console.log(`  ${c.name} (${c.kind}) — ${c.hooks.length} хуков`);
 *     }
 *   }
 */
export function analyzeReactComponent(
  filePath: string,
  options: AnalyzeReactOptions = {}
): ReactComponentAnalysis | null {
  // 1. Проверка существования
  if (!fs.existsSync(filePath)) {
    if (options.verbose) {
      console.warn(`⚠️  Файл не найден: ${filePath}`);
    }
    return null;
  }

  // 2. Проверка расширения
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.tsx' && ext !== '.jsx') {
    if (options.verbose) {
      console.warn(`⚠️  Не React-файл: ${filePath} (ext=${ext})`);
    }
    return null;
  }

  // 3. Парсинг
  try {
    return parseReactFile(filePath, options);
  } catch (err) {
    if (options.verbose) {
      console.warn(
        `⚠️  Ошибка парсинга ${filePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return null;
  }
}

/**
 * Анализирует .tsx/.jsx из строки.
 * Полезно для тестов и для парсинга виртуальных файлов.
 */
export function analyzeReactSource(
  source: string,
  filePath: string,
  options: AnalyzeReactOptions = {}
): ReactComponentAnalysis {
  return parseReactSource(source, filePath, options);
}

// ============================================================
// РЕЭКСПОРТЫ
// ============================================================

// Parser
export { parseReactFile, parseReactSource };

// Extractors
export {
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

// Types
export type {
  ReactComponentAnalysis,
  AnalyzedComponent,
  AnalyzedHook,
  AnalyzedJsxElement,
  AnalyzedJsxEvent,
  AnalyzedConditional,
  AnalyzedComponentUsage,
  AnalyzedImport,
  AnalyzedExport,
  AnalyzeReactOptions,
};

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  analyzeReactComponent,
  analyzeReactSource,
  parseReactFile,
  parseReactSource,

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
