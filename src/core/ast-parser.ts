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

// Кэш для tsconfig
let tsConfigCache: TsConfig | null = null;
let tsConfigBaseDirCache: string | null = null;

function getTsConfigForFile(filePath: string): TsConfig | null {
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

    // Извлекаем script блоки из дескриптора
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

    // Извлекаем template
    if (descriptor.template) {
      result.template = descriptor.template.content;
    }

    // Извлекаем стили
    result.styles = descriptor.styles.map(style => style.content);

    // Извлекаем пользовательские блоки
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
    console.log(`📖 Чтение файла: ${filePath}`);

    let code = fs.readFileSync(filePath, 'utf-8');
    console.log(`📏 Размер файла: ${code.length} символов`);

    let isVue = false;
    let isTypeScript = false;

    if (filePath.endsWith('.vue')) {
      isVue = true;
      // Используем AST-парсер вместо регулярных выражений
      const sfc = parseVueSFCFile(filePath);

      if (!sfc) {
        console.warn(`⚠️ Не удалось разобрать Vue файл ${filePath}`);
        return null;
      }

      // Определяем тип скрипта
      const scriptType = sfc.scriptType || 'unknown';
      isTypeScript = scriptType === 'ts' || scriptType === 'tsSetup';

      // Используем scriptSetup или script
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
      // Определяем TypeScript по расширению
      isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    }

    // Настройки парсера
    const parserOptions: any = {
      ecmaVersion: 2026,
      sourceType: 'module',
      loc: true,
      range: true,
      comment: true,
      tokens: true,
    };

    // Добавляем поддержку TypeScript
    if (isTypeScript) {
      parserOptions.ecmaFeatures = {
        jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      };
    }

    console.log(
      `🔧 Парсинг с опциями: sourceType=${parserOptions.sourceType}, ecmaVersion=${parserOptions.ecmaVersion}`
    );

    const ast = parser.parse(code, parserOptions);

    // Логируем информацию об AST
    if (ast && ast.body) {
      console.log(`✅ AST успешно построен, узлов верхнего уровня: ${ast.body.length}`);

      // Выводим первые 5 типов узлов для диагностики
      const nodeTypes = ast.body.slice(0, 5).map((n: any) => n.type);
      console.log(`📋 Типы первых узлов: ${nodeTypes.join(', ')}`);

      // Проверяем наличие ключевых элементов
      const hasClasses = ast.body.some((n: any) => n.type === 'ClassDeclaration');
      const hasFunctions = ast.body.some((n: any) => n.type === 'FunctionDeclaration');
      const hasVariables = ast.body.some((n: any) => n.type === 'VariableDeclaration');

      console.log(
        `📊 Содержимое AST: Classes=${hasClasses}, Functions=${hasFunctions}, Variables=${hasVariables}`
      );

      if (isVue) {
        let importCount = 0;
        importCount = ast.body.filter((node: any) => node.type === 'ImportDeclaration').length;
        console.log(`   📥 Найдено импортов: ${importCount}`);
      }
    } else {
      console.warn('⚠️ AST построен, но не содержит body');
    }

    return ast;
  } catch (e) {
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
  // Алиасы (начинаются с @, #, ~ и т.д.) считаем внутренними
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

export function resolveFilePath(baseDir: string, targetPath: string): string | null {
  // 1. Сначала проверяем алиасы из tsconfig
  const tsConfig = getTsConfigForFile(baseDir);
  const tsConfigDir = getTsConfigDir();

  // Для алиасов используем директорию tsconfig как корень
  const aliasedPath = resolveAliasPath(targetPath, tsConfigDir || baseDir, tsConfig);

  if (aliasedPath && fs.existsSync(aliasedPath)) {
    console.log(`   🔗 Алиас: ${targetPath} → ${path.relative(process.cwd(), aliasedPath)}`);
    return aliasedPath;
  }

  // 2. Обычный резолвинг
  const fullPath = path.resolve(baseDir, targetPath);

  // 2.1 Проверяем как файл
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  // 2.2 Проверяем как директорию с index файлом
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    for (const ext of SUPPORTED_EXTENSIONS) {
      const indexPath = path.join(fullPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        console.log(`   📁 Директория → index${ext}: ${targetPath}`);
        return indexPath;
      }
    }
  }

  // 3. Проверяем с расширениями
  for (const ext of SUPPORTED_EXTENSIONS) {
    const withExt = fullPath + ext;
    if (fs.existsSync(withExt)) {
      return withExt;
    }

    // Проверяем index файлы
    const indexPath = path.join(fullPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      console.log(`   📁 Index файл: ${targetPath} → index${ext}`);
      return indexPath;
    }
  }

  // 4. Проверяем относительно директории tsconfig
  if (tsConfigDir && tsConfigDir !== baseDir) {
    const fromRootPath = path.resolve(tsConfigDir, targetPath);

    if (fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isFile()) {
      return fromRootPath;
    }

    if (fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isDirectory()) {
      for (const ext of SUPPORTED_EXTENSIONS) {
        const indexPath = path.join(fromRootPath, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    for (const ext of SUPPORTED_EXTENSIONS) {
      const withExt = fromRootPath + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
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
