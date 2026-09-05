// src/analyzers/index.ts
// ============================================
// ЕДИНЫЙ МОДУЛЬ АНАЛИЗАТОРОВ
// Все анализаторы вынесены в отдельный модуль для переиспользования
// Версия: 5.1.0
// ============================================

import path from 'path';
import fs from 'fs';

// ============================================
// ТИПЫ ДЛЯ ВСЕХ АНАЛИЗАТОРОВ
// ============================================

export interface DynamicImport {
  /** Путь к импортируемому модулю */
  path: string;
  /** Номер строки */
  line: number;
  /** Тип динамического импорта */
  type: 'literal' | 'template' | 'conditional' | 'variable' | 'concat';
  /** Индекс в строке (опционально) */
  index?: number;
}

export interface ConfigRef {
  /** Имя конфигурации */
  name: string;
  /** Тип конфигурации */
  type: 'env' | 'require' | 'import' | 'dynamic' | 'variable';
  /** Номер строки */
  line: number;
  /** Полное совпадение */
  fullMatch: string;
}

export interface ExternalLib {
  /** Имя библиотеки */
  name: string;
  /** Версия библиотеки */
  version: string;
  /** Количество использований */
  count: number;
  /** Список импортов */
  imports: string[];
  /** Первая строка использования */
  firstLine: number;
}

export interface VueTemplate {
  /** Имя компонента/директивы */
  name: string;
  /** Тип элемента */
  type: 'static' | 'dynamic' | 'slot' | 'directive';
  /** Номер строки */
  line: number;
  /** Номер строки в файле */
  fileLine?: number;
}

export interface AsyncChain {
  /** Имя функции */
  name: string;
  /** Номер строки */
  line: number;
  /** Количество await */
  awaitCount: number;
  /** Цепочка вызовов */
  chain: string[];
  /** Наличие try/catch */
  hasTryCatch: boolean;
  /** Наличие Promise.all */
  hasPromiseAll: boolean;
  /** Наличие цепочки .then() */
  hasThenChain: boolean;
  /** Тип функции */
  type: 'function' | 'arrow' | 'function-expression' | 'method' | 'iife';
  /** Тело функции (обрезанное) */
  body: string;
}

export interface Closure {
  /** Имя функции */
  name: string;
  /** Номер строки */
  line: number;
  /** Список внешних переменных */
  variables: string[];
  /** Количество внешних переменных */
  count: number;
  /** Длина тела */
  bodyLength: number;
  /** Является ли вложенным */
  isNested: boolean;
  /** Количество вложенных замыканий */
  nestedCount: number;
  /** Тип замыкания */
  type?: 'function' | 'arrow' | 'method' | 'iife';
}

export interface TypeDep {
  /** Имя типа */
  name: string;
  /** Тип зависимости */
  type: 'interface' | 'type-alias' | 'generic' | 'enum';
  /** Номер строки */
  line: number;
  /** Экспортируется ли */
  isExported: boolean;
  /** Наследование */
  extends?: string[];
  /** Определение */
  definition?: string;
  /** Вид */
  kind?: string;
  /** Свойства */
  properties?: string[];
}

export interface AnalysisResult {
  dynamicImports: DynamicImport[];
  configRefs: ConfigRef[];
  externalLibs: ExternalLib[];
  vueTemplates: VueTemplate[];
  asyncChains: AsyncChain[];
  closures: Closure[];
  typeDeps: TypeDep[];
}

// ============================================
// 1. АНАЛИЗ ДИНАМИЧЕСКИХ ИМПОРТОВ
// ============================================

/**
 * Извлекает динамические импорты import() из кода
 * @param content - Содержимое файла
 * @returns Массив динамических импортов
 */
export function extractDynamicImports(content: string): DynamicImport[] {
  const imports: DynamicImport[] = [];

  if (!content || content.trim() === '') {
    return imports;
  }

  const regex = /import\s*\(\s*['\"`]([^'\"`]+)['\"`]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1];
    if (!path) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    let type: DynamicImport['type'] = 'literal';

    if (path && path.includes('${')) {
      type = 'template';
    } else if (path && (path.includes('+') || path.includes('?'))) {
      type = 'conditional';
    } else if (path && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(path)) {
      type = 'variable';
    } else if (path && path.includes('+')) {
      type = 'concat';
    }

    imports.push({
      path,
      line,
      type,
      index: match.index,
    });
  }

  return imports;
}

// ============================================
// 2. АНАЛИЗ КОНФИГУРАЦИЙ
// ============================================

/**
 * Извлекает ссылки на конфигурации из кода
 * @param content - Содержимое файла
 * @returns Массив ссылок на конфигурации
 */
export function extractConfigRefs(content: string): ConfigRef[] {
  const configs: ConfigRef[] = [];

  if (!content || content.trim() === '') {
    return configs;
  }

  const patterns = [
    { regex: /process\.env\.([A-Z_][A-Z0-9_]*)/g, type: 'env' as const },
    {
      regex: /require\s*\(\s*['\"]([^'\"]*\.config\.(js|ts|mjs|cjs))['\"]\s*\)/g,
      type: 'require' as const,
    },
    {
      regex: /import\s+.*\s+from\s+['\"]([^'\"]*\.config\.(js|ts|mjs|cjs))['\"]/g,
      type: 'import' as const,
    },
    {
      regex: /import\s*\(\s*['\"]([^'\"]*\.config\.(js|ts|mjs|cjs))['\"]\s*\)/g,
      type: 'dynamic' as const,
    },
    {
      regex:
        /(?:const|let|var)\s+config\s*=\s*require\s*\(\s*['\"]([^'\"]*\.config\.(js|ts))['\"]\s*\)/g,
      type: 'require' as const,
    },
    { regex: /CONFIG\s*[:=]\s*['\"]([^'\"]+)['\"]/g, type: 'variable' as const },
  ];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        const line = content.substring(0, match.index).split('\n').length + 1;
        configs.push({
          name,
          type,
          line,
          fullMatch: match[0],
        });
      }
    }
  }

  return configs;
}

// ============================================
// 3. АНАЛИЗ ВНЕШНИХ БИБЛИОТЕК
// ============================================

/**
 * Извлекает информацию о внешних библиотеках из кода
 * @param content - Содержимое файла
 * @param filePath - Путь к файлу (для определения версий)
 * @returns Массив внешних библиотек
 */
export function extractExternalLibs(content: string, filePath?: string): ExternalLib[] {
  const libs: ExternalLib[] = [];
  const libMap = new Map<string, { count: number; firstLine: number; imports: string[] }>();

  if (!content || content.trim() === '') {
    return libs;
  }

  // Импорты
  const importRegex =
    /import\s+(?:type\s+)?(?:{[^}]*}|[^{}\s]+|\*\s+as\s+\w+)\s+from\s+['\"]([^.'\"][^'\"]*)['\"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && !name.startsWith('.') && !name.startsWith('/')) {
      const baseName = name.split('/')[0] || name;
      if (!libMap.has(baseName)) {
        libMap.set(baseName, { count: 0, firstLine: 0, imports: [] });
      }
      const entry = libMap.get(baseName)!;
      entry.count++;
      if (entry.firstLine === 0) {
        entry.firstLine = content.substring(0, match.index).split('\n').length + 1;
      }
      if (!entry.imports.includes(name)) {
        entry.imports.push(name);
      }
    }
  }

  // require()
  const requireRegex =
    /(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['\"]([^.'\"][^'\"]*)['\"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const name = match[1];
    if (name && !name.startsWith('.') && !name.startsWith('/')) {
      const baseName = name.split('/')[0] || name;
      if (!libMap.has(baseName)) {
        libMap.set(baseName, { count: 0, firstLine: 0, imports: [] });
      }
      const entry = libMap.get(baseName)!;
      entry.count++;
      if (entry.firstLine === 0) {
        entry.firstLine = content.substring(0, match.index).split('\n').length + 1;
      }
      if (!entry.imports.includes(name)) {
        entry.imports.push(name);
      }
    }
  }

  // Получаем версии из package.json
  for (const [name, data] of libMap) {
    let version = 'unknown';
    if (filePath) {
      try {
        // Пытаемся найти package.json
        let currentDir = path.dirname(filePath);
        let found = false;
        let attempts = 0;
        while (!found && attempts < 10) {
          const pkgPath = path.join(currentDir, 'node_modules', name, 'package.json');
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            version = pkg.version || 'unknown';
            found = true;
            break;
          }
          const parent = path.dirname(currentDir);
          if (parent === currentDir) break;
          currentDir = parent;
          attempts++;
        }
      } catch {
        // Игнорируем ошибки
      }
    }

    libs.push({
      name,
      version,
      count: data.count,
      imports: data.imports,
      firstLine: data.firstLine,
    });
  }

  return libs.sort((a, b) => b.count - a.count);
}

// ============================================
// 4. АНАЛИЗ VUE ШАБЛОНОВ
// ============================================

/**
 * Извлекает информацию о Vue шаблонах из кода
 * @param content - Содержимое файла
 * @returns Массив Vue шаблонов
 */
export function extractVueTemplates(content: string): VueTemplate[] {
  const templates: VueTemplate[] = [];

  if (!content || content.trim() === '') {
    return templates;
  }

  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  if (!templateMatch) {
    return templates;
  }

  const template = templateMatch[1];
  if (!template) {
    return templates;
  }

  // Статические компоненты <ComponentName>
  const staticRegex = /<([A-Z][a-zA-Z0-9]*)/g;
  let match;
  while ((match = staticRegex.exec(template)) !== null) {
    const name = match[1];
    if (!name) continue;
    const line = template.substring(0, match.index).split('\n').length + 1;
    templates.push({
      name,
      type: 'static',
      line,
      fileLine: line,
    });
  }

  // Динамические компоненты <component :is=\"...\">
  const dynamicRegex = /<component\s+:is\s*=\s*[\"']([^\"']+)[\"']/g;
  while ((match = dynamicRegex.exec(template)) !== null) {
    const name = match[1];
    if (!name) continue;
    const line = template.substring(0, match.index).split('\n').length + 1;
    templates.push({
      name,
      type: 'dynamic',
      line,
      fileLine: line,
    });
  }

  // Слоты
  const slotRegex = /<slot\s+(?:name\s*=\s*[\"']([^\"']+)[\"'])?/g;
  while ((match = slotRegex.exec(template)) !== null) {
    const name = match[1] || 'default';
    const line = template.substring(0, match.index).split('\n').length + 1;
    templates.push({
      name: `slot:${name}`,
      type: 'slot',
      line,
      fileLine: line,
    });
  }

  // Директивы
  const directiveRegex = /(v-(?:if|for|show|model|on|bind))\s*[:=]/g;
  while ((match = directiveRegex.exec(template)) !== null) {
    const name = match[1];
    if (!name) continue;
    const line = template.substring(0, match.index).split('\n').length + 1;
    templates.push({
      name,
      type: 'directive',
      line,
      fileLine: line,
    });
  }

  return templates;
}

// ============================================
// 5. АНАЛИЗ АСИНХРОННЫХ ЦЕПОЧЕК
// ============================================

/**
 * Извлекает асинхронные цепочки из кода
 * @param content - Содержимое файла
 * @returns Массив асинхронных цепочек
 */
export function extractAsyncChains(content: string): AsyncChain[] {
  const chains: AsyncChain[] = [];

  if (!content || content.trim() === '') {
    return chains;
  }

  // Собираем все async функции
  const asyncFunctions: Map<string, { line: number; body: string; type: AsyncChain['type'] }> =
    new Map();

  // 1. async function name() { ... }
  const asyncFuncRegex = /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let match;
  while ((match = asyncFuncRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    if (!name) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    if (name && !asyncFunctions.has(name)) {
      asyncFunctions.set(name, { line, body, type: 'function' });
    }
  }

  // 2. const name = async () => { ... }
  const arrowRegex =
    /(?:const|let)\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    if (!name) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    if (name && !asyncFunctions.has(name)) {
      asyncFunctions.set(name, { line, body, type: 'arrow' });
    }
  }

  // 3. const name = async function() { ... }
  const funcExprRegex =
    /(?:const|let)\s+(\w+)\s*=\s*async\s+function\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = funcExprRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    if (!name) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    if (name && !asyncFunctions.has(name)) {
      asyncFunctions.set(name, { line, body, type: 'function-expression' });
    }
  }

  // 4. Методы классов: async method() { ... }
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    if (!name) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    if (name && !asyncFunctions.has(name)) {
      asyncFunctions.set(name, { line, body, type: 'method' });
    }
  }

  // Обработка каждой async функции
  for (const [name, data] of asyncFunctions) {
    const body = data.body;
    const line = data.line;
    const awaitCount = (body.match(/await/g) || []).length;

    if (awaitCount > 0) {
      const awaitChain: string[] = [];

      // Собираем цепочку await вызовов
      const awaitRegex = /await\s+(\w+)\s*\(/g;
      let awaitMatch;
      while ((awaitMatch = awaitRegex.exec(body)) !== null) {
        if (awaitMatch[1]) {
          awaitChain.push(awaitMatch[1]);
        }
      }

      // Дополнительные паттерны для await
      const awaitPatterns = [
        /await\s+(\w+)\s*\./g, // await obj.method()
        /await\s+(\w+)\s*\[/g, // await obj[method]()
        /await\s+(\w+)\s*\(/g, // await func()
      ];

      for (const pattern of awaitPatterns) {
        let pMatch;
        while ((pMatch = pattern.exec(body)) !== null) {
          if (pMatch[1] && !awaitChain.includes(pMatch[1])) {
            awaitChain.push(pMatch[1]);
          }
        }
      }

      chains.push({
        name,
        line,
        awaitCount,
        chain: [...new Set(awaitChain)],
        hasTryCatch: body.includes('try') && body.includes('catch'),
        hasPromiseAll: body.includes('Promise.all'),
        hasThenChain: body.includes('.then('),
        type: data.type,
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // 5. IIFE: (async () => { ... })()
  const iifeRegex = /\(\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*\(/g;
  while ((match = iifeRegex.exec(content)) !== null) {
    const body = match[1] || '';
    const awaitCount = (body.match(/await/g) || []).length;
    const line = content.substring(0, match.index).split('\n').length + 1;

    if (awaitCount > 0) {
      const awaitChain: string[] = [];
      const awaitRegex = /await\s+(\w+)\s*\(/g;
      let awaitMatch;
      while ((awaitMatch = awaitRegex.exec(body)) !== null) {
        if (awaitMatch[1]) {
          awaitChain.push(awaitMatch[1]);
        }
      }

      chains.push({
        name: 'iife',
        line,
        awaitCount,
        chain: [...new Set(awaitChain)],
        hasTryCatch: body.includes('try') && body.includes('catch'),
        hasPromiseAll: body.includes('Promise.all'),
        hasThenChain: body.includes('.then('),
        type: 'iife',
        body: body.length > 200 ? body.substring(0, 200) + '...' : body,
      });
    }
  }

  // Удаляем дубликаты
  const unique: AsyncChain[] = [];
  const seen = new Set<string>();
  for (const chain of chains) {
    const key = `${chain.name}:${chain.line}:${chain.awaitCount}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(chain);
    }
  }

  // Сортируем по количеству await (сначала самые сложные)
  unique.sort((a, b) => b.awaitCount - a.awaitCount);

  return unique;
}

// ============================================
// 6. АНАЛИЗ ЗАМЫКАНИЙ
// ============================================

/**
 * Извлекает замыкания из кода
 * @param content - Содержимое файла
 * @returns Массив замыканий
 */
export function extractClosures(content: string): Closure[] {
  const closures: Closure[] = [];

  if (!content || content.trim() === '') {
    return closures;
  }

  const reserved = new Set([
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'throw',
    'try',
    'catch',
    'finally',
    'debugger',
    'var',
    'let',
    'const',
    'class',
    'extends',
    'new',
    'this',
    'super',
    'typeof',
    'instanceof',
    'void',
    'delete',
    'true',
    'false',
    'null',
    'undefined',
    'NaN',
    'Infinity',
    'arguments',
    'eval',
    'import',
    'export',
    'default',
    'async',
    'await',
    'yield',
    'static',
    'get',
    'set',
    'constructor',
    'abstract',
    'interface',
    'Promise',
    'console',
    'process',
    'module',
    'require',
    '__dirname',
    '__filename',
  ]);

  // 1. function name() { ... }
  const funcRegex = /function\s+(\w+)?\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1] || 'anonymous';
    const body = match[2] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;

    const declared = new Set<string>();
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRegex.exec(body)) !== null) {
      if (declMatch[1]) {
        declared.add(declMatch[1]);
      }
    }

    const paramMatch = match[0].match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1]) {
      const paramsStr = paramMatch[1];
      const params = paramsStr
        .split(',')
        .map(p => {
          const trimmed = p.trim();
          if (!trimmed) return '';
          const parts = trimmed.split(':');
          const firstPart = parts[0];
          return firstPart ? firstPart.trim() : '';
        })
        .filter(Boolean);
      for (const p of params) {
        declared.add(p);
      }
    }

    const used = new Set<string>();
    const varRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      const name = varMatch[1];
      if (name && !declared.has(name) && !reserved.has(name)) {
        used.add(name);
      }
    }

    if (used.size > 0) {
      closures.push({
        name: funcName,
        line,
        variables: Array.from(used),
        count: used.size,
        bodyLength: body.length,
        isNested: false,
        nestedCount: 0,
        type: 'function',
      });
    }
  }

  // 2. Стрелочные функции
  const arrowRegex = /\([^)]*\)\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const body = match[1] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;

    let funcName = 'anonymous';
    const nameMatch = content.substring(0, match.index).match(/(?:const|let|var)\s+(\w+)\s*=\s*$/);
    if (nameMatch && nameMatch[1]) {
      funcName = nameMatch[1];
    }

    const declared = new Set<string>();
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRegex.exec(body)) !== null) {
      if (declMatch[1]) {
        declared.add(declMatch[1]);
      }
    }

    const paramMatch = match[0].match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1]) {
      const paramsStr = paramMatch[1];
      const params = paramsStr
        .split(',')
        .map(p => {
          const trimmed = p.trim();
          if (!trimmed) return '';
          const parts = trimmed.split(':');
          const firstPart = parts[0];
          return firstPart ? firstPart.trim() : '';
        })
        .filter(Boolean);
      for (const p of params) {
        declared.add(p);
      }
    }

    const used = new Set<string>();
    const varRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      const name = varMatch[1];
      if (name && !declared.has(name) && !reserved.has(name)) {
        used.add(name);
      }
    }

    if (used.size > 0) {
      closures.push({
        name: funcName,
        line,
        variables: Array.from(used),
        count: used.size,
        bodyLength: body.length,
        isNested: false,
        nestedCount: 0,
        type: 'arrow',
      });
    }
  }

  // 3. Методы объектов
  const methodRegex = /(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  const keywords = ['if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'finally'];
  while ((match = methodRegex.exec(content)) !== null) {
    const funcName = match[1];
    const body = match[2] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;

    if (!funcName || keywords.includes(funcName)) {
      continue;
    }

    const declared = new Set<string>();
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRegex.exec(body)) !== null) {
      if (declMatch[1]) {
        declared.add(declMatch[1]);
      }
    }

    const paramMatch = match[0].match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1]) {
      const paramsStr = paramMatch[1];
      const params = paramsStr
        .split(',')
        .map(p => {
          const trimmed = p.trim();
          if (!trimmed) return '';
          const parts = trimmed.split(':');
          const firstPart = parts[0];
          return firstPart ? firstPart.trim() : '';
        })
        .filter(Boolean);
      for (const p of params) {
        declared.add(p);
      }
    }

    const used = new Set<string>();
    const varRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      const name = varMatch[1];
      if (name && !declared.has(name) && !reserved.has(name)) {
        used.add(name);
      }
    }

    if (used.size > 0) {
      closures.push({
        name: funcName,
        line,
        variables: Array.from(used),
        count: used.size,
        bodyLength: body.length,
        isNested: false,
        nestedCount: 0,
        type: 'method',
      });
    }
  }

  // 4. IIFE
  const iifeRegex = /\(\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\}\s*\)\s*\(/g;
  while ((match = iifeRegex.exec(content)) !== null) {
    const body = match[1] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;

    const declared = new Set<string>();
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRegex.exec(body)) !== null) {
      if (declMatch[1]) {
        declared.add(declMatch[1]);
      }
    }

    const used = new Set<string>();
    const varRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let varMatch;
    while ((varMatch = varRegex.exec(body)) !== null) {
      const name = varMatch[1];
      if (name && !declared.has(name) && !reserved.has(name)) {
        used.add(name);
      }
    }

    if (used.size > 0) {
      closures.push({
        name: 'iife',
        line,
        variables: Array.from(used),
        count: used.size,
        bodyLength: body.length,
        isNested: false,
        nestedCount: 0,
        type: 'iife',
      });
    }
  }

  // Удаляем дубликаты
  const unique: Closure[] = [];
  const seen = new Set<string>();
  for (const closure of closures) {
    const key = `${closure.name}:${closure.line}:${closure.variables.sort().join(',')}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(closure);
    }
  }

  // Сортируем по количеству переменных
  unique.sort((a, b) => b.count - a.count);

  return unique;
}

// ============================================
// 7. АНАЛИЗ ТИПОВЫХ ЗАВИСИМОСТЕЙ
// ============================================

/**
 * Извлекает типовые зависимости из кода
 * @param content - Содержимое файла
 * @returns Массив типовых зависимостей
 */
export function extractTypeDeps(content: string): TypeDep[] {
  const deps: TypeDep[] = [];

  if (!content || content.trim() === '') {
    return deps;
  }

  // Интерфейсы
  const interfaceRegex =
    /(?:export\s+)?interface\s+(\w+)\s*(?:<[^>]+>)?\s*(?:extends\s+([^{]+))?\s*\{/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    if (!name) continue;
    const extendsStr = match[2] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export interface');

    const extendsList = extendsStr
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    deps.push({
      name,
      type: 'interface',
      line,
      isExported,
      extends: extendsList.length > 0 ? extendsList : undefined,
      properties: extractInterfaceProperties(content, match.index),
    });
  }

  // Type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*([^;]+);/g;
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    if (!name) continue;
    const definition = match[2]?.trim() || '';
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export type');

    let kind = 'alias';
    if (definition.startsWith('{')) kind = 'object';
    else if (definition.startsWith('[')) kind = 'array';
    else if (definition.includes('|')) kind = 'union';
    else if (definition.includes('&')) kind = 'intersection';
    else if (definition.includes('=>')) kind = 'function';

    deps.push({
      name,
      type: 'type-alias',
      line,
      isExported,
      definition,
      kind,
    });
  }

  // Generics
  const genericRegex = /<(\w+)(?:\s+extends\s+(\w+))?>/g;
  while ((match = genericRegex.exec(content)) !== null) {
    const name = match[1];
    if (!name) continue;
    const extendsType = match[2] || null;
    const line = content.substring(0, match.index).split('\n').length + 1;

    const exists = deps.some(d => d.name === name && d.type === 'generic');
    if (!exists) {
      deps.push({
        name,
        type: 'generic',
        line,
        isExported: false,
        extends: extendsType ? [extendsType] : undefined,
      });
    }
  }

  // Enum
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    if (!name) continue;
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export enum');

    deps.push({
      name,
      type: 'enum',
      line,
      isExported,
    });
  }

  return deps;
}

// ============================================
// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Извлекает свойства интерфейса из содержимого
 * @param content - Содержимое файла
 * @param startIndex - Индекс начала интерфейса
 * @returns Массив имен свойств
 */
function extractInterfaceProperties(content: string, startIndex: number): string[] {
  const properties: string[] = [];
  let braceCount = 0;
  let i = startIndex;
  let foundOpen = false;

  while (i < content.length && !foundOpen) {
    if (content[i] === '{') {
      foundOpen = true;
      braceCount = 1;
      i++;
    } else {
      i++;
    }
  }

  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;

    if (braceCount === 1) {
      const lineEnd = content.indexOf('\n', i);
      const line = content.substring(i, lineEnd > 0 ? lineEnd : content.length);
      const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
      if (propMatch && propMatch[1]) {
        properties.push(propMatch[1]);
      }
    }

    i++;
    if (content[i] === '\n') i++;
  }

  return properties;
}

// ============================================
// 9. УНИВЕРСАЛЬНАЯ ФУНКЦИЯ АНАЛИЗА
// ============================================

/**
 * Выполняет полный анализ содержимого файла
 * @param content - Содержимое файла
 * @param filePath - Путь к файлу (опционально)
 * @param options - Опции анализа
 * @returns Результаты всех анализаторов
 */
export function analyzeContent(
  content: string,
  filePath?: string,
  options: {
    includeDynamicImports?: boolean;
    includeConfigRefs?: boolean;
    includeExternalLibs?: boolean;
    includeVueTemplates?: boolean;
    includeAsyncChains?: boolean;
    includeClosures?: boolean;
    includeTypeDeps?: boolean;
  } = {}
): AnalysisResult {
  const {
    includeDynamicImports = true,
    includeConfigRefs = true,
    includeExternalLibs = true,
    includeVueTemplates = true,
    includeAsyncChains = true,
    includeClosures = true,
    includeTypeDeps = true,
  } = options;

  const result: AnalysisResult = {
    dynamicImports: [],
    configRefs: [],
    externalLibs: [],
    vueTemplates: [],
    asyncChains: [],
    closures: [],
    typeDeps: [],
  };

  if (!content || content.trim() === '') {
    return result;
  }

  if (includeDynamicImports) {
    result.dynamicImports = extractDynamicImports(content);
  }

  if (includeConfigRefs) {
    result.configRefs = extractConfigRefs(content);
  }

  if (includeExternalLibs) {
    result.externalLibs = extractExternalLibs(content, filePath);
  }

  if (includeVueTemplates && filePath?.endsWith('.vue')) {
    result.vueTemplates = extractVueTemplates(content);
  }

  if (includeAsyncChains) {
    result.asyncChains = extractAsyncChains(content);
  }

  if (includeClosures) {
    result.closures = extractClosures(content);
  }

  if (includeTypeDeps) {
    result.typeDeps = extractTypeDeps(content);
  }

  return result;
}

// ============================================
// 10. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
  analyzeContent,
};

// ============================================
// ВЕРСИЯ МОДУЛЯ
// ============================================

export const ANALYZERS_VERSION = '5.1.0';
export const ANALYZERS_NAME = '@newkind/ast-analyzer/analyzers';
