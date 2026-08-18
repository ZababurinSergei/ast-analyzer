// core/ast-parser.ts
import fs from 'fs';
import path from 'path';
import parser from '@typescript-eslint/parser';
import { walk } from 'estree-walker';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import { loadTsConfig, resolveAliasPath, getTsConfigDir } from './tsconfig-resolver.js';
import type { TsConfig } from './tsconfig-resolver.js';

// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================

const SUPPORTED_EXTENSIONS = ['.ts', '.mjs', '.js', '.tsx', '.jsx', '.vue'];
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.cache',
  '.next',
  'out',
  '.nuxt',
  '.output',
  '.vercel',
  'tmp',
  'temp',
];

import type { ParserOptions } from '@typescript-eslint/parser';

// Кэш для tsconfig
let tsConfigCache: TsConfig | null = null;
let tsConfigBaseDirCache: string | null = null;

// ==========================================
// ФУНКЦИЯ С КЭШИРОВАНИЕМ
// ==========================================

/**
 * Возвращает tsconfig для файла с кэшированием
 * @param filePath - Путь к файлу для которого нужно получить tsconfig
 * @returns TsConfig или null если не найден
 */
export function getTsConfigForFile(filePath: string): TsConfig | null {
  const dir = path.dirname(filePath);
  if (tsConfigCache && tsConfigBaseDirCache === dir) {
    return tsConfigCache;
  }

  tsConfigBaseDirCache = dir;
  tsConfigCache = loadTsConfig(dir);
  return tsConfigCache;
}

// ==========================================
// VUE SFC ИНТЕРФЕЙСЫ
// ==========================================

export interface VueSFCData {
  script: string | null;
  scriptSetup: string | null;
  template: string | null;
  styles: string[];
  customBlocks: Record<string, string[]>;
  scriptType: 'basic' | 'setup' | 'ts' | 'tsSetup' | null;
}

// ==========================================
// ПАРСИНГ ФАЙЛОВ
// ==========================================

/**
 * Парсит Vue SFC файл с использованием @vue/compiler-sfc (без регулярных выражений)
 */
export function parseVueSFCFile(filePath: string): VueSFCData | null {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const { descriptor, errors } = parseVueSFC(source, {
      filename: filePath,
      sourceMap: false,
    });

    if (errors.length > 0) {
      console.warn(`⚠️ Ошибки парсинга Vue файла ${filePath}:`, errors);
    }

    const result: VueSFCData = {
      script: null,
      scriptSetup: null,
      template: null,
      styles: [],
      customBlocks: {},
      scriptType: null,
    };

    if (descriptor.script) {
      result.script = descriptor.script.content;
      result.scriptType = 'basic';
      if (descriptor.script.lang === 'ts') {
        result.scriptType = 'ts';
      }
    }

    if (descriptor.scriptSetup) {
      result.scriptSetup = descriptor.scriptSetup.content;
      result.scriptType = descriptor.scriptSetup.lang === 'ts' ? 'tsSetup' : 'setup';
    }

    if (descriptor.template) {
      result.template = descriptor.template.content;
    }

    result.styles = descriptor.styles.map(style => style.content);

    for (const [blockName, block] of Object.entries(descriptor.customBlocks || {})) {
      if (!result.customBlocks[blockName]) {
        result.customBlocks[blockName] = [];
      }
      result.customBlocks[blockName].push(block.content);
    }

    return result;
  } catch (error) {
    console.error(`❌ Ошибка парсинга Vue файла ${filePath}:`, error);
    return null;
  }
}

/**
 * Парсит файл в AST с поддержкой Vue SFC
 * @param filePath Путь к файлу
 * @param _options Опции парсинга (зарезервировано)
 * @returns AST дерево или null
 */
export function parseFile(filePath: string, _options?: { extractTemplate?: boolean }): any {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Файл не найден: ${filePath}`);
      return null;
    }

    console.log(`📖 Чтение файла: ${filePath}`);
    let code = fs.readFileSync(filePath, 'utf-8');
    console.log(`📏 Размер файла: ${code.length} символов`);

    let isVue = false;
    let isTypeScript = false;

    if (filePath.endsWith('.vue')) {
      isVue = true;
      const sfc = parseVueSFCFile(filePath);

      if (!sfc) {
        console.warn(`⚠️ Не удалось разобрать Vue файл ${filePath}`);
        return null;
      }

      const scriptType = sfc.scriptType || 'unknown';
      isTypeScript = scriptType === 'ts' || scriptType === 'tsSetup';

      const scriptContent = sfc.scriptSetup || sfc.script;

      if (!scriptContent) {
        console.warn(`⚠️ В Vue файле ${filePath} не найден script блок`);
        return null;
      }

      code = scriptContent;
      console.log(`📄 Vue файл: ${path.basename(filePath)} (${scriptType}, TS: ${isTypeScript})`);

      if (sfc.styles.length > 0) {
        console.log(`   🎨 Styles: ${sfc.styles.length} блоков`);
      }
    } else {
      isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    }

    const parserOptions: ParserOptions = {
      ecmaVersion: 2026 as const,
      sourceType: 'module',
      loc: true,
      range: true,
      comment: true,
      tokens: true,
      ecmaFeatures: {
        jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
        globalReturn: false,
        impliedStrict: true,
      },
    };

    if (!isTypeScript) {
      parserOptions.ecmaFeatures = {
        ...parserOptions.ecmaFeatures,
        class: true,
      };
    }

    if (isTypeScript) {
      parserOptions.ecmaFeatures = {
        ...parserOptions.ecmaFeatures,
        jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      };
    }

    console.log(
      `🔧 Парсинг с опциями: sourceType=${parserOptions.sourceType}, ecmaVersion=${parserOptions.ecmaVersion}`
    );

    const fallbackOptions: ParserOptions = {
      ecmaVersion: 2022 as const,
      sourceType: 'module',
      loc: true,
      range: true,
    };

    let ast;
    try {
      ast = parser.parse(code, parserOptions);
    } catch (parseError: any) {
      console.error(`❌ Ошибка парсинга ${filePath}:`, parseError.message);
      if (parseError.stack) {
        console.error('📚 Стек ошибки:', parseError.stack);
      }

      try {
        console.log('🔄 Повторная попытка с упрощенными настройками...');
        ast = parser.parse(code, fallbackOptions);
        console.log('✅ Fallback парсинг успешен');
      } catch (fallbackError: any) {
        console.error(`❌ Fallback парсинг также не удался: ${fallbackError.message}`);
        if (fallbackError.stack) {
          console.error('📚 Стек fallback ошибки:', fallbackError.stack);
        }
        return null;
      }
    }

    if (!ast) {
      console.warn(`⚠️ AST не построен для файла: ${filePath}`);
      return null;
    }

    if (!ast.body || !Array.isArray(ast.body)) {
      console.warn(`⚠️ AST не содержит body для файла: ${filePath}`);
      return {
        type: 'Program',
        body: [],
        sourceType: 'module',
        comments: [],
        tokens: [],
      };
    }

    console.log(`✅ AST успешно построен, узлов верхнего уровня: ${ast.body.length}`);

    const nodeTypes = ast.body.slice(0, 5).map((n: any) => n?.type || 'unknown');
    console.log(`📋 Типы первых узлов: ${nodeTypes.join(', ')}`);

    const hasClasses = ast.body.some((n: any) => n?.type === 'ClassDeclaration');
    const hasFunctions = ast.body.some((n: any) => n?.type === 'FunctionDeclaration');
    const hasVariables = ast.body.some((n: any) => n?.type === 'VariableDeclaration');

    console.log(
      `📊 Содержимое AST: Classes=${hasClasses}, Functions=${hasFunctions}, Variables=${hasVariables}`
    );

    if (isVue) {
      let importCount = 0;
      importCount = ast.body.filter((node: any) => node?.type === 'ImportDeclaration').length;
      console.log(`   📥 Найдено импортов: ${importCount}`);
    }

    return ast;
  } catch (e) {
    if (e instanceof Error && (e as any).code === 'ENOENT') {
      console.warn(`⚠️ Файл не найден: ${filePath}`);
      return null;
    }
    console.error(
      `❌ Ошибка парсинга файла ${filePath}:`,
      e instanceof Error ? e.message : String(e)
    );
    if (e instanceof Error && e.stack) {
      console.error('📚 Стек ошибки:', e.stack);
    }
    return null;
  }
}

export function isExternalModule(importTarget: string): boolean {
  if (
    importTarget.startsWith('@') ||
    importTarget.startsWith('#') ||
    importTarget.startsWith('~')
  ) {
    return false;
  }

  return (
    !importTarget.startsWith('.') && !importTarget.startsWith('/') && !path.isAbsolute(importTarget)
  );
}

// ==========================================
// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ resolveFilePath
// ==========================================

/**
 * Разрешает путь импорта в абсолютный путь к файлу
 * Поддерживает:
 * - Относительные пути (./, ../)
 * - Алиасы из tsconfig (@/, #/)
 * - Разные расширения (.ts, .js, .tsx, .jsx, .mjs, .cjs)
 * - Автоматическое преобразование .js → .ts (если .ts-файл существует)
 * - Поиск файлов БЕЗ расширения
 * - Index файлы в директориях
 * - Кэширование tsconfig для производительности
 *
 * @param baseDir - Абсолютный путь к директории файла
 * @param targetPath - Путь из import (может быть относительным или алиасом)
 * @returns Абсолютный путь к файлу или null
 */
export function resolveFilePath(baseDir: string, targetPath: string): string | null {
  // 1. Проверяем, не абсолютный ли уже путь
  if (path.isAbsolute(targetPath) && fs.existsSync(targetPath)) {
    return targetPath;
  }

  // 2. Используем getTsConfigForFile с кэшированием
  const tsConfig = getTsConfigForFile(baseDir);
  const tsConfigDir = getTsConfigDir() || baseDir;

  // 3. Проверяем алиасы из tsconfig
  const aliasedPath = resolveAliasPath(targetPath, tsConfigDir, tsConfig);
  if (aliasedPath && fs.existsSync(aliasedPath)) {
    console.log(`   🔗 Алиас: ${targetPath} → ${path.relative(process.cwd(), aliasedPath)}`);
    return aliasedPath;
  }

  // 4. Формируем полный путь
  const fullPath = path.resolve(baseDir, targetPath);

  // 5. Проверяем файл как есть (с текущим расширением)
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  // 6. Проверяем файл БЕЗ расширения (если в targetPath нет расширения)
  const hasExtension = path.extname(targetPath) !== '';
  if (!hasExtension && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    console.log(`   📄 Найден без расширения: ${targetPath}`);
    return fullPath;
  }

  // 7. Специальная проверка: .js → .ts (и наоборот)
  if (targetPath.endsWith('.js')) {
    const tsPath = fullPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(tsPath) && fs.statSync(tsPath).isFile()) {
      console.log(`   🔄 .js → .ts: ${targetPath} → ${path.relative(process.cwd(), tsPath)}`);
      return tsPath;
    }
  }
  if (targetPath.endsWith('.ts')) {
    const jsPath = fullPath.replace(/\.ts$/, '.js');
    if (fs.existsSync(jsPath) && fs.statSync(jsPath).isFile()) {
      console.log(`   🔄 .ts → .js: ${targetPath} → ${path.relative(process.cwd(), jsPath)}`);
      return jsPath;
    }
  }

  // 8. Проверяем ВСЕ возможные расширения (ВКЛЮЧАЯ то, что уже проверяли)
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];

  for (const ext of extensions) {
    // ✅ Убрана проверка: if (ext === targetExt) continue;
    // Теперь проверяем ВСЕ варианты, даже если они совпадают с исходным расширением
    const testPath = fullPath + ext;
    if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
      console.log(`   📄 Найден: ${targetPath} → ${path.relative(process.cwd(), testPath)}`);
      return testPath;
    }
  }

  // 9. Проверяем как директорию с index файлом
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(fullPath, `index${ext}`);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        console.log(`   📁 Директория → index${ext}: ${targetPath}`);
        return indexPath;
      }
    }
  }

  // 10. Проверяем относительно tsconfig директории
  if (tsConfigDir && tsConfigDir !== baseDir) {
    const fromRootPath = path.resolve(tsConfigDir, targetPath);

    // Проверяем файл как есть
    if (fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isFile()) {
      return fromRootPath;
    }

    // Проверяем без расширения
    if (!hasExtension && fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isFile()) {
      return fromRootPath;
    }

    // .js → .ts
    if (targetPath.endsWith('.js')) {
      const tsFromRoot = fromRootPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsFromRoot) && fs.statSync(tsFromRoot).isFile()) {
        return tsFromRoot;
      }
    }

    // .ts → .js
    if (targetPath.endsWith('.ts')) {
      const jsFromRoot = fromRootPath.replace(/\.ts$/, '.js');
      if (fs.existsSync(jsFromRoot) && fs.statSync(jsFromRoot).isFile()) {
        return jsFromRoot;
      }
    }

    // Проверяем все расширения
    for (const ext of extensions) {
      const testPath = fromRootPath + ext;
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        return testPath;
      }
    }

    // Проверяем index файлы
    if (fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isDirectory()) {
      for (const ext of extensions) {
        const indexPath = path.join(fromRootPath, `index${ext}`);
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return indexPath;
        }
      }
    }
  }

  return null;
}

export function getAllProjectFiles(
  dir: string,
  filesList: string[] = [],
  excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS
): string[] {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const name = path.join(dir, file);
      if (excludePatterns.some(p => name.includes(p))) continue;
      if (fs.statSync(name).isDirectory()) {
        getAllProjectFiles(name, filesList, excludePatterns);
      } else if (SUPPORTED_EXTENSIONS.includes(path.extname(name))) {
        filesList.push(name);
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ Ошибка чтения ${dir}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
  return filesList;
}

// Реэкспорт walk для удобства использования в других модулях
export { walk };

// Экспорт конфигураций для использования в других модулях
export { DEFAULT_EXCLUDE_PATTERNS, SUPPORTED_EXTENSIONS };
