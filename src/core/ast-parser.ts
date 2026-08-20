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
// НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ПУТЯМИ
// ==========================================

/**
 * Разрешает путь к файлу в абсолютный
 */
function resolveAbsolutePath(filePath: string): string {
  if (!filePath) return '';
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
}

/**
 * Проверяет существование файла и возвращает абсолютный путь
 */
function validateAndResolvePath(filePath: string): string | null {
  const absolutePath = resolveAbsolutePath(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️ Файл не найден: ${absolutePath}`);
    return null;
  }
  return absolutePath;
}

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
    const resolvedPath = resolveAbsolutePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`⚠️ Файл не найден: ${resolvedPath}`);
      return null;
    }

    const source = fs.readFileSync(resolvedPath, 'utf-8');
    const { descriptor, errors } = parseVueSFC(source, {
      filename: resolvedPath,
      sourceMap: false,
    });

    if (errors.length > 0) {
      console.warn(`⚠️ Ошибки парсинга Vue файла ${resolvedPath}:`, errors);
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
 * Парсит файл в AST с поддержкой Vue SFC и нормализацией путей
 * @param filePath Путь к файлу
 * @param _options Опции парсинга (зарезервировано)
 * @returns AST дерево или null
 */
export function parseFile(filePath: string, _options?: { extractTemplate?: boolean }): any {
  try {
    // ✅ Нормализуем путь
    const resolvedPath = validateAndResolvePath(filePath);
    if (!resolvedPath) return null;

    console.log(`📖 Чтение файла: ${resolvedPath}`);
    let code = fs.readFileSync(resolvedPath, 'utf-8');
    console.log(`📏 Размер файла: ${code.length} символов`);

    let isVue = false;
    let isTypeScript = false;

    if (filePath.endsWith('.vue')) {
      isVue = true;
      const sfc = parseVueSFCFile(resolvedPath);

      if (!sfc) {
        console.warn(`⚠️ Не удалось разобрать Vue файл ${resolvedPath}`);
        return null;
      }

      const scriptType = sfc.scriptType || 'unknown';
      isTypeScript = scriptType === 'ts' || scriptType === 'tsSetup';

      const scriptContent = sfc.scriptSetup || sfc.script;

      if (!scriptContent) {
        console.warn(`⚠️ В Vue файле ${resolvedPath} не найден script блок`);
        return null;
      }

      code = scriptContent;
      console.log(`📄 Vue файл: ${path.basename(resolvedPath)} (${scriptType}, TS: ${isTypeScript})`);

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
      console.error(`❌ Ошибка парсинга ${resolvedPath}:`, parseError.message);
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
      console.warn(`⚠️ AST не построен для файла: ${resolvedPath}`);
      return null;
    }

    if (!ast.body || !Array.isArray(ast.body)) {
      console.warn(`⚠️ AST не содержит body для файла: ${resolvedPath}`);
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
    const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
    if (!fs.existsSync(resolvedDir)) {
      console.warn(`⚠️ Директория не найдена: ${resolvedDir}`);
      return filesList;
    }

    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
      const name = path.join(resolvedDir, file);
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

// ==========================================
// ✅ НОВЫЕ ФУНКЦИИ ДЛЯ ИЗВЛЕЧЕНИЯ СУЩНОСТЕЙ
// ==========================================

/**
 * Извлекает все функции из AST
 */
export function extractFunctionsFromAST(ast: any): any[] {
  const functions: any[] = [];

  if (!ast || !ast.body) return functions;

  walk(ast, {
    enter(node: any, parent: any) {
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
        const isExported = isNodeExported(node, parent);
        functions.push({
          name: node.id.name,
          line: node.loc?.start?.line || 1,
          isAsync: node.async || false,
          isExported,
          params: node.params.map((p: any) => {
            if (p.type === 'Identifier') return p.name || 'unknown';
            if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
            return 'unknown';
          }),
          returnType: node.returnType?.typeName?.name || node.returnType?.name || undefined,
          startLine: node.loc?.start?.line || 1,
          endLine: node.loc?.end?.line || 1,
          body: node.body ? node.body.type : undefined,
        });
      }

      // Методы классов
      if (node.type === 'MethodDefinition' && node.key) {
        const methodName = node.key.name;
        const className = parent?.id?.name || 'Anonymous';

        if (methodName) {
          const isExported = isNodeExported(node, parent);
          functions.push({
            name: methodName,
            line: node.loc?.start?.line || 1,
            isAsync: node.value?.async || false,
            isExported,
            params:
              node.value?.params?.map((p: any) => {
                if (p.type === 'Identifier') return p.name || 'unknown';
                return 'unknown';
              }) || [],
            returnType: node.value?.returnType?.typeName?.name || undefined,
            startLine: node.loc?.start?.line || 1,
            endLine: node.loc?.end?.line || 1,
            isMethod: true,
            className,
          });
        }
      }
    },
  });

  return functions;
}

/**
 * Извлекает все классы из AST
 */
export function extractClassesFromAST(ast: any): any[] {
  const classes: any[] = [];

  if (!ast || !ast.body) return classes;

  walk(ast, {
    enter(node: any, parent: any) {
      if (node.type === 'ClassDeclaration' && node.id) {
        const name = node.id.name;
        const isExported = isNodeExported(node, parent);

        const methods: string[] = [];
        const properties: string[] = [];

        if (node.body?.body) {
          for (const member of node.body.body) {
            if (member.type === 'MethodDefinition' && member.key) {
              methods.push(member.key.name);
            }
            if (member.type === 'PropertyDefinition' && member.key) {
              properties.push(member.key.name);
            }
          }
        }

        classes.push({
          name,
          line: node.loc?.start?.line || 1,
          isExported,
          methods,
          properties,
          extends: node.superClass?.name || undefined,
          implements: node.implements?.map((i: any) => i.name) || [],
          startLine: node.loc?.start?.line || 1,
          endLine: node.loc?.end?.line || 1,
        });
      }
    },
  });

  return classes;
}

/**
 * Извлекает все константы из AST
 */
export function extractConstantsFromAST(ast: any): any[] {
  const constants: any[] = [];

  if (!ast || !ast.body) return constants;

  walk(ast, {
    enter(node: any, parent: any) {
      if (node.type === 'VariableDeclaration' && node.kind === 'const') {
        const isExported = isNodeExported(node, parent);

        for (const decl of node.declarations) {
          if (decl.id?.type === 'Identifier') {
            const name = decl.id.name;
            const value = extractValueFromNode(decl.init);

            constants.push({
              name,
              line: decl.loc?.start?.line || node.loc?.start?.line || 1,
              value,
              isExported,
              type: decl.init?.type || undefined,
            });
          }
        }
      }
    },
  });

  return constants;
}

/**
 * Извлекает все интерфейсы из AST
 */
export function extractInterfacesFromAST(ast: any): any[] {
  const interfaces: any[] = [];

  if (!ast || !ast.body) return interfaces;

  walk(ast, {
    enter(node: any, parent: any) {
      if (node.type === 'TSInterfaceDeclaration' && node.id) {
        const name = node.id.name;
        const isExported = isNodeExported(node, parent);

        const properties: string[] = [];
        if (node.body?.body) {
          for (const member of node.body.body) {
            if (member.key?.name) {
              properties.push(member.key.name);
            }
          }
        }

        interfaces.push({
          name,
          line: node.loc?.start?.line || 1,
          isExported,
          properties,
          extends: node.extends?.map((e: any) => e.expression?.name) || [],
          startLine: node.loc?.start?.line || 1,
          endLine: node.loc?.end?.line || 1,
        });
      }
    },
  });

  return interfaces;
}

/**
 * Извлекает все типы из AST
 */
export function extractTypesFromAST(ast: any): any[] {
  const types: any[] = [];

  if (!ast || !ast.body) return types;

  walk(ast, {
    enter(node: any, parent: any) {
      if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        const name = node.id.name;
        const isExported = isNodeExported(node, parent);

        types.push({
          name,
          line: node.loc?.start?.line || 1,
          isExported,
          definition: node.typeAnnotation?.type || 'unknown',
        });
      }
    },
  });

  return types;
}

/**
 * Извлекает все переменные (let, var) из AST
 */
export function extractVariablesFromAST(ast: any): any[] {
  const variables: any[] = [];

  if (!ast || !ast.body) return variables;

  walk(ast, {
    enter(node: any, parent: any) {
      if (node.type === 'VariableDeclaration' && node.kind !== 'const') {
        const isExported = isNodeExported(node, parent);

        for (const decl of node.declarations) {
          if (decl.id?.type === 'Identifier') {
            const name = decl.id.name;
            variables.push({
              name,
              line: decl.loc?.start?.line || node.loc?.start?.line || 1,
              isExported,
              type: decl.init?.type || undefined,
              value: extractValueFromNode(decl.init),
            });
          }
        }
      }
    },
  });

  return variables;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Проверяет, экспортируется ли узел
 */
function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  // Прямой export
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  // Проверка родителя
  if (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
      return true;
    }
  }

  // Проверка декораторов
  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (decorator.expression?.name === 'export') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Извлекает значение из узла
 */
function extractValueFromNode(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'UnaryExpression') {
    return `${node.operator}${extractValueFromNode(node.argument)}`;
  }

  if (node.type === 'BinaryExpression') {
    return `${extractValueFromNode(node.left)} ${node.operator} ${extractValueFromNode(node.right)}`;
  }

  if (node.type === 'ArrayExpression') {
    return node.elements
      .map((e: any) => extractValueFromNode(e))
      .filter((v: any) => v !== undefined);
  }

  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    for (const prop of node.properties) {
      if (prop.type === 'Property' && prop.key) {
        const key = prop.key.name || prop.key.value;
        obj[key] = extractValueFromNode(prop.value);
      }
    }
    return obj;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return '[Function]';
  }

  return undefined;
}

// Реэкспорт walk для удобства использования в других модулях
export { walk };

// Экспорт конфигураций для использования в других модулях
export { DEFAULT_EXCLUDE_PATTERNS, SUPPORTED_EXTENSIONS };