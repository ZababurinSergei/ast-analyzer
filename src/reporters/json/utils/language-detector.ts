// packages/ast-analyzer/src/reporters/json/utils/language-detector.ts

// ============================================================
// ОПРЕДЕЛЕНИЕ ЯЗЫКА ПРОГРАММИРОВАНИЯ ПО РАСШИРЕНИЮ ФАЙЛА
// ============================================================

/**
 * Определяет язык программирования по расширению файла.
 *
 * Используется в:
 *   - `buildPackagesAndMaps` (json/builders/save-package-lock.ts)
 *   - `buildModuleGraph` (json/graphs/module-graph.ts)
 *   - других местах, где нужно заполнить поле `language` пакета.
 *
 * Правила маппинга:
 *
 *   | Расширение    | Язык         |
 *   |---------------|--------------|
 *   | .vue          | vue          |
 *   | .tsx          | jsx          |
 *   | .jsx          | jsx          |
 *   | .ts           | typescript   |
 *   | .mts          | typescript   |
 *   | .cts          | typescript   |
 *   | всё остальное | javascript   |
 *
 * Возвращаемый язык — одно из четырёх значений, определённых в
 * типе `EnhancedPackageInfo['language']`:
 *   'typescript' | 'javascript' | 'vue' | 'jsx'
 *
 * @param modulePath — путь к файлу (абсолютный или относительный)
 * @returns строку-идентификатор языка
 *
 * @example
 *   detectLanguage('./src/App.vue')       // → 'vue'
 *   detectLanguage('./src/index.ts')      // → 'typescript'
 *   detectLanguage('./src/utils.mts')     // → 'typescript'
 *   detectLanguage('./src/Button.tsx')    // → 'jsx'
 *   detectLanguage('./src/script.js')     // → 'javascript'
 */
export function detectLanguage(
  modulePath: string
): 'typescript' | 'javascript' | 'vue' | 'jsx' {
  // Защита от невалидного входа
  if (!modulePath || typeof modulePath !== 'string') {
    return 'javascript';
  }

  // Vue SFC — приоритетная проверка (до .ts/.tsx)
  if (modulePath.endsWith('.vue')) {
    return 'vue';
  }

  // JSX/TSX — считаем одним языком 'jsx'
  if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) {
    return 'jsx';
  }

  // TypeScript (включая .mts и .cts — ESM/CJS варианты)
  if (
    modulePath.endsWith('.ts') ||
    modulePath.endsWith('.mts') ||
    modulePath.endsWith('.cts')
  ) {
    return 'typescript';
  }

  // Всё остальное (в т.ч. .js, .mjs, .cjs, .json, .md и др.) — JavaScript
  return 'javascript';
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ (на будущее)
// ============================================================

/**
 * Проверяет, является ли файл TypeScript-подобным (.ts, .tsx, .mts, .cts).
 *
 * Отличие от `detectLanguage`:
 *   - `detectLanguage` возвращает строку-идентификатор языка
 *   - `isTypeScriptLike` возвращает булево значение
 *
 * Используется, когда важен только факт "TS или нет" (например,
 * для выбора парсера или правил ESLint).
 */
export function isTypeScriptLike(modulePath: string): boolean {
  if (!modulePath || typeof modulePath !== 'string') {
    return false;
  }
  return (
    modulePath.endsWith('.ts') ||
    modulePath.endsWith('.tsx') ||
    modulePath.endsWith('.mts') ||
    modulePath.endsWith('.cts')
  );
}

/**
 * Проверяет, является ли файл Vue SFC.
 */
export function isVueFile(modulePath: string): boolean {
  if (!modulePath || typeof modulePath !== 'string') {
    return false;
  }
  return modulePath.endsWith('.vue');
}

/**
 * Проверяет, является ли файл JSX/TSX.
 */
export function isJsxFile(modulePath: string): boolean {
  if (!modulePath || typeof modulePath !== 'string') {
    return false;
  }
  return modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx');
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default detectLanguage;