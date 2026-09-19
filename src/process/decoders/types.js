// decoders/types.js
// Общие типы и константы для всех декодеров

// Сокращенные ключи для расшифровки JSON полей
export const SHORT_KEYS = {
  // Основные индексы
  functionIndex: 'fi',
  fileIndex: 'fl',
  moduleIndex: 'mi',

  // Массивы данных
  functions: 'fns',
  constants: 'cn',
  files: 'fls',
  modules: 'mods',

  // Отношения
  exports: 'exps',
  imports: 'imps',
  externalLibs: 'ext',

  // Статистика
  stats: 'st',
  totalFunctions: 'tf',
  totalCalls: 'tc',
  totalModules: 'tm',
  totalFiles: 'tfils',
  totalImports: 'ti',
  totalExports: 'te',
  totalUnused: 'tun',
  totalReExports: 'tre',
  totalInheritance: 'tr',
  totalTypeDeps: 'ttd',
  totalConstants: 'tcn',
  totalConstExports: 'tce',
  totalConstUses: 'tuc',
  totalConstDeps: 'tcd',
  totalSelfFunctions: 'tsf',
  hasCycles: 'cy',
  timestamp: 'ts',
  version: 'v',
  root: 'r',
  asyncCount: 'async',
  avgCalls: 'avgCalls',
  maxCalls: 'maxCalls',
  isolated: 'isolated',
  funcsWithCalls: 'funcsWithCalls',
  calledFuncs: 'calledFuncs',
  modulesWithFunctions: 'modulesWithFunctions',
  filesWithFunctions: 'filesWithFunctions',
  exportedWithCalls: 'exportedWithCalls',
  defaultExports: 'defaultExports',
  typeExports: 'typeExports',
  typeImports: 'typeImports',

  // Расширенные анализы
  dynamicImports: 'di',
  configRefs: 'cfg',
  externalLibsCount: 'ext',
  vueTemplates: 'vt',
  asyncChains: 'asyncChains',
  closures: 'closures',
  reflections: 'reflections',
  typeDeps: 'typeDeps',
};

// Карта типов функций
export const FUNCTION_TYPES = {
  // Стандартные типы
  es: 'exported-standard',
  e: 'exported',
  s: 'standard',
  0: 'standard',
  d: 'default',
  a: 'async',
  ae: 'async-exported',
  aes: 'async-exported-standard',
  as: 'async-standard',
  n: 'nested',

  // Экспортные типы
  ne: 'named-export',
  de: 'default-export',
  re: 're-export',
  te: 'type-export',
  se: 'side-effect',
  ce: 'const-export',

  // Параметры и возвраты
  p: 'parameter',
  r: 'return',
  t: 'type',

  // Специальные типы
  di: 'dynamic-import',
  cfg: 'config-ref',
  ext: 'external-lib',
  vt: 'vue-template',
  async: 'async-chain',
  closures: 'closure',
  reflection: 'reflection',
  types: 'type-dependency',

  // Типы констант
  val: 'value',
  enum: 'enum',
  config: 'config',

  // Типы импортов
  df: 'default',
  ns: 'namespace',
  ri: 're-export-import',
  to: 'type-only',

  // Типы наследования
  ex: 'extends',
  im: 'implements',
  ab: 'abstract',

  // Аннотации и дженерики
  an: 'annotation',
  g: 'generic',
  tr: 'type-reference',

  // Динамические импорты
  literal: 'literal',
  template: 'template-literal',
  concat: 'concatenation',

  // Конфигурационные типы
  env: 'environment-variable',
  file: 'config-file',
  variable: 'config-variable',

  // Vue шаблоны
  component: 'component',
  directive: 'directive',

  // Re-export типы
  named: 'named-re-export',
  all: 'all-re-export',
  group: 'group-re-export',

  // Вызовы
  m: 'method',
  c: 'callback',
};

// ============================================================
// КАРТА ФЛАГОВ (ИСПРАВЛЕНО)
// ============================================================
// Символьная карта флагов: символ → полное имя
// Используется, когда флаги приходят как строка символов, например "ae"
export const FLAG_MAP = {
  a: 'standard',
  e: 'exported',
  m: 'method',
  r: 'arrow',
  v: 'vue',
  n: 'nested',
  s: 'self',
  d: 'dead',
  c: 'cyclic',
  x: 'external',
  t: 'type',
  l: 'lazy',
  y: 'async',
};

// Обратная карта: полное имя → символ
export const FLAG_TO_CHAR = Object.fromEntries(
  Object.entries(FLAG_MAP).map(([char, name]) => [name, char])
);

// Числовая карта флагов (битовая маска)
// Используется, когда флаги приходят как число, например 3 (standard + exported)
export const FLAG_BIT_MAP = {
  1: 'standard',
  2: 'exported',
  4: 'method',
  8: 'arrow',
  16: 'vue',
  32: 'nested',
  64: 'self',
  128: 'dead',
  256: 'cyclic',
  512: 'external',
  1024: 'type',
  2048: 'lazy',
  4096: 'async',
};

// Карта типов вызовов
export const CALL_TYPES = {
  // Базовые вызовы
  d: 'direct',
  a: 'async',
  m: 'method',
  c: 'callback',
  di: 'dynamic-import',

  // Импорты
  n: 'named',
  df: 'default',
  ns: 'namespace',
  ri: 're-export',
  to: 'type-only',
  se: 'side-effect',

  // Экспорты
  ne: 'named-export',
  de: 'default-export',
  re: 're-export',
  te: 'type-export',
  ce: 'const-export',

  // Наследование
  ex: 'extends',
  im: 'implements',
  ab: 'abstract',

  // Параметры и возвраты
  p: 'parameter',
  r: 'return',
  an: 'annotation',
  g: 'generic',
  tr: 'type-reference',

  // Константы
  val: 'value',
  enum: 'enum',
  config: 'config',

  // Динамические импорты
  literal: 'literal',
  template: 'template-literal',
  concat: 'concatenation',

  // Конфигурация
  env: 'environment-variable',
  file: 'config-file',
  variable: 'config-variable',

  // Vue
  component: 'component',
  directive: 'directive',

  // Re-export
  named: 'named-re-export',
  all: 'all-re-export',
  group: 'group-re-export',
};

// Получить полное имя типа по коду
export function getFullTypeName(typeCode) {
  if (!typeCode) {
    return 'unknown';
  }
  return FUNCTION_TYPES[typeCode] || typeCode;
}

// Расшифровать тип вызова
export function decodeCallType(typeCode) {
  if (!typeCode) {
    return 'direct';
  }
  return CALL_TYPES[typeCode] || typeCode;
}

/**
 * Расшифровать флаги.
 * Поддерживает два формата:
 *   1. Строка символов: "ae" → ['standard', 'exported']
 *   2. Число (битовая маска): 3 → ['standard', 'exported']
 *
 * @param {string|number} flags - строка символов или число
 * @returns {string[]} массив полных имён флагов
 */
export function decodeFlags(flags) {
  if (flags === null || flags === undefined || flags === '') {
    return [];
  }

  // Если число — интерпретируем как битовую маску
  if (typeof flags === 'number') {
    const result = [];
    for (const [bit, name] of Object.entries(FLAG_BIT_MAP)) {
      if (flags & Number(bit)) {
        result.push(name);
      }
    }
    return result;
  }

  // Если строка — итерируемся по символам
  if (typeof flags === 'string') {
    const result = [];
    for (const char of flags) {
      if (FLAG_MAP[char]) {
        result.push(FLAG_MAP[char]);
      } else {
        // Неизвестный флаг — оставляем с пометкой, чтобы не терять информацию
        result.push(`unknown:${char}`);
      }
    }
    return result;
  }

  // Если массив — уже декодировано
  if (Array.isArray(flags)) {
    return flags;
  }

  return [];
}

/**
 * Преобразует массив имён флагов в объект вида {isAsync: true, isExported: true, ...}.
 * Полезно для быстрого доступа к булевым свойствам.
 *
 * @param {string[]} flagNames - массив имён флагов
 * @returns {Object} объект с булевыми полями
 */
export function flagsToObject(flagNames) {
  if (!Array.isArray(flagNames)) {
    return {};
  }

  const result = {};
  for (const name of flagNames) {
    if (!name || typeof name !== 'string') continue;
    if (name.startsWith('unknown:')) continue;

    // "async" → "isAsync", "exported" → "isExported"
    const key = 'is' + name.charAt(0).toUpperCase() + name.slice(1);
    result[key] = true;
  }
  return result;
}

/**
 * Преобразует объект булевых флагов обратно в массив имён.
 *
 * @param {Object} flagObject - объект вида {isAsync: true, isExported: false}
 * @returns {string[]} массив имён флагов
 */
export function objectToFlags(flagObject) {
  if (!flagObject || typeof flagObject !== 'object') {
    return [];
  }

  const result = [];
  for (const [key, value] of Object.entries(flagObject)) {
    if (!value) continue;
    if (!key.startsWith('is')) continue;

    // "isAsync" → "async"
    const name = key.slice(2).charAt(0).toLowerCase() + key.slice(3);
    result.push(name);
  }
  return result;
}

// Создать обратную карту сокращенных ключей
export function reverseShortKeys() {
  const map = {};
  for (const [full, short] of Object.entries(SHORT_KEYS)) {
    map[short] = full;
  }
  return map;
}

// Обратная карта сокращенных ключей
export const LONG_KEYS = reverseShortKeys();

// Расшифровать код типа в человекочитаемый формат с описанием
export function getTypeDescription(typeCode) {
  const descriptions = {
    es: 'Exported Standard Function',
    e: 'Exported Function',
    s: 'Standard Function',
    0: 'Standard Function',
    d: 'Default Export',
    a: 'Async Function',
    ae: 'Async Exported Function',
    aes: 'Async Exported Standard Function',
    as: 'Async Standard Function',
    n: 'Nested Function',
    ne: 'Named Export',
    de: 'Default Export',
    re: 'Re-export',
    te: 'Type Export',
    se: 'Side Effect',
    ce: 'Const Export',
    p: 'Parameter',
    r: 'Return',
    t: 'Type',
    di: 'Dynamic Import',
    cfg: 'Config Reference',
    ext: 'External Library',
    vt: 'Vue Template',
    async: 'Async Chain',
    closures: 'Closure',
    reflection: 'Reflection',
    types: 'Type Dependency',
    val: 'Value Constant',
    enum: 'Enum Constant',
    config: 'Config Constant',
    df: 'Default Import',
    ns: 'Namespace Import',
    ri: 'Re-export Import',
    to: 'Type Only',
    ex: 'Extends',
    im: 'Implements',
    ab: 'Abstract',
    an: 'Annotation',
    g: 'Generic',
    tr: 'Type Reference',
    literal: 'Literal',
    template: 'Template Literal',
    concat: 'Concatenation',
    env: 'Environment Variable',
    file: 'Config File',
    variable: 'Config Variable',
    component: 'Vue Component',
    directive: 'Vue Directive',
    named: 'Named Re-export',
    all: 'All Re-export',
    group: 'Group Re-export',
    m: 'Method Call',
    c: 'Callback',
  };

  if (!typeCode) {
    return 'Unknown';
  }
  return descriptions[typeCode] || typeCode;
}

// Получить категорию типа
export function getTypeCategory(typeCode) {
  if (!typeCode) {
    return 'unknown';
  }

  const categories = {
    es: 'function',
    e: 'function',
    s: 'function',
    0: 'function',
    a: 'function',
    ae: 'function',
    aes: 'function',
    as: 'function',
    n: 'function',
    ne: 'export',
    de: 'export',
    re: 'export',
    te: 'export',
    se: 'export',
    ce: 'export',
    p: 'parameter',
    r: 'return',
    t: 'type',
    di: 'import',
    cfg: 'config',
    ext: 'external',
    vt: 'vue',
    async: 'async',
    closures: 'closure',
    reflection: 'reflection',
    types: 'type-dependency',
    val: 'constant',
    enum: 'constant',
    config: 'constant',
    df: 'import',
    ns: 'import',
    ri: 'import',
    to: 'import',
    ex: 'inheritance',
    im: 'inheritance',
    ab: 'inheritance',
    an: 'annotation',
    g: 'generic',
    tr: 'type-reference',
    literal: 'dynamic-import',
    template: 'dynamic-import',
    concat: 'dynamic-import',
    env: 'config',
    file: 'config',
    variable: 'config',
    component: 'vue',
    directive: 'vue',
    named: 're-export',
    all: 're-export',
    group: 're-export',
    m: 'call',
    c: 'call',
  };

  return categories[typeCode] || 'unknown';
}

// Проверить является ли тип экспортом
export function isExportType(typeCode) {
  const exportTypes = ['ne', 'de', 're', 'te', 'ce', 'se', 'es', 'e', 'ae', 'aes'];
  return exportTypes.includes(typeCode);
}

// Проверить является ли тип импортом
export function isImportType(typeCode) {
  const importTypes = ['df', 'ns', 'ri', 'to', 'di', 'literal', 'template', 'concat'];
  return importTypes.includes(typeCode);
}

// Проверить является ли тип функцией
export function isFunctionType(typeCode) {
  const functionTypes = ['es', 'e', 's', '0', 'a', 'ae', 'aes', 'as', 'n', 'm', 'c'];
  return functionTypes.includes(typeCode);
}

// Проверить является ли тип асинхронным
export function isAsyncType(typeCode) {
  const asyncTypes = ['a', 'ae', 'aes', 'as', 'async'];
  return asyncTypes.includes(typeCode);
}

// Проверить, является ли имя флага известным
export function isKnownFlag(flagName) {
  return Object.values(FLAG_MAP).includes(flagName);
}

// Получить символ флага по имени
export function getFlagChar(flagName) {
  return FLAG_TO_CHAR[flagName] || null;
}

// Объект для default export
const typesModule = {
  SHORT_KEYS,
  FUNCTION_TYPES,
  FLAG_MAP,
  FLAG_TO_CHAR,
  FLAG_BIT_MAP,
  CALL_TYPES,
  LONG_KEYS,
  getFullTypeName,
  decodeCallType,
  decodeFlags,
  flagsToObject,
  objectToFlags,
  getTypeDescription,
  getTypeCategory,
  isExportType,
  isImportType,
  isFunctionType,
  isAsyncType,
  isKnownFlag,
  getFlagChar,
};

export default typesModule;
