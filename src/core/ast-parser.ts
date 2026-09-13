// src/core/ast-parser.ts
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ v7.2.0
// ✅ ИСПРАВЛЕНО: isExternalModule — @scope/pkg теперь external
// ✅ ИСПРАВЛЕНО: collectImportsFromAST — сохраняется line + loc
// ✅ ИСПРАВЛЕНО: collectExportsFromAST — localName, isTypeOnly, isStarReExport, isDefaultReExport
// ✅ ИСПРАВЛЕНО: collectExportsFromAST — правильная обработка default export и star re-export
// ✅ ДОБАВЛЕНО: isNodeExported — расширенная проверка
// ✅ ОБНОВЛЕНО v7.2.0: логирование Vue без <script> понижено до console.debug
// ✅ ОБНОВЛЕНО v7.2.0: логирование алиасов понижено до console.debug (флаг AST_DEBUG_PATHS)
// ✅ ОБНОВЛЕНО v7.2.0: логирование парсинга понижено до console.debug (флаг AST_DEBUG_PARSE)

import fs from 'fs';
import path from 'path';
import parser from '@typescript-eslint/parser';
import { walk } from 'estree-walker';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import { loadTsConfig, resolveAliasPath, getTsConfigDir } from './tsconfig-resolver.js';
import type { TsConfig } from './tsconfig-resolver.js';

// ==========================================
// ФЛАГИ ОТЛАДКИ (v7.2.0)
// ==========================================
// Все логи чтения/парсинга/алиасов выводятся только при включённых флагах.
// Это убирает шум из консоли при обычном запуске.

const DEBUG_PARSE = process.env.AST_DEBUG_PARSE === 'true';
const DEBUG_PATHS = process.env.AST_DEBUG_PATHS === 'true';
const DEBUG_VUE = process.env.AST_DEBUG_VUE === 'true';

/**
 * Условное логирование парсинга
 */
function logParse(message: string): void {
  if (DEBUG_PARSE) {
    console.debug(message);
  }
}

/**
 * Условное логирование путей / алиасов
 */
function logPath(message: string): void {
  if (DEBUG_PATHS) {
    console.debug(message);
  }
}

/**
 * Условное логирование Vue
 */
function logVue(message: string): void {
  if (DEBUG_VUE) {
    console.debug(message);
  }
}

// ==========================================
// ✅ РАСШИРЕНИЕ ТИПА ДЛЯ AST (ВАРИАНТ 1)
// ==========================================

declare module '@typescript-eslint/types' {
  interface ESLintProgram {
    _originalCode?: string;
    _isVue?: boolean;
    _vueType?: 'setup' | 'tsSetup' | 'basic' | 'ts' | null;
  }
}

declare global {
  interface Object {
    _originalCode?: string;
    _isVue?: boolean;
    _vueType?: 'setup' | 'tsSetup' | 'basic' | 'ts' | null;
  }
}

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

let tsConfigCache: TsConfig | null = null;
let tsConfigBaseDirCache: string | null = null;

// ==========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ПУТЯМИ
// ==========================================

import { resolveAbsolutePath, validateAndResolvePath, normalizePathForOS } from '../utils/path-utils.js';

export { resolveAbsolutePath, validateAndResolvePath, normalizePathForOS };

// ==========================================
// ✅ ОБНОВЛЕНО: isExternalModule — правильная логика для @scope/pkg
// ==========================================

/**
 * Возвращает tsconfig для файла с кэшированием
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
// ✅ ОБНОВЛЕНО: isExternalModule
// ==========================================

/**
 * Проверяет, является ли модуль внешним (из node_modules).
 *
 * ✅ ИСПРАВЛЕНО v7.1.0:
 *   - `@scope/pkg` — теперь ВНЕШНИЙ (раньше ошибочно считался алиасом)
 *   - `@/foo`, `#/foo`, `~/foo` — алиасы проекта (проверяются по tsconfig)
 *   - `./foo`, `../foo`, `/foo` — относительные/абсолютные (не внешние)
 *
 * @param importTarget — путь импорта из кода
 * @param filePath — путь к файлу-импортёру (для загрузки tsconfig)
 */
export function isExternalModule(importTarget: string, filePath?: string): boolean {
  if (!importTarget) return false;

  // 1. Относительные пути
  if (importTarget.startsWith('.')) return false;
  if (importTarget.startsWith('/')) return false;
  if (path.isAbsolute(importTarget)) return false;

  // 2. Алиасы проекта (#/, ~/, @/)
  if (
    importTarget.startsWith('@/') ||
    importTarget.startsWith('#/') ||
    importTarget.startsWith('~/') ||
    importTarget === '#'
  ) {
    return false;
  }

  // 3. Scoped npm-пакеты (@scope/name)
  if (importTarget.startsWith('@')) {
    const parts = importTarget.split('/');
    // @scope/name — минимум 2 части
    if (parts.length >= 2 && parts[0] && parts[1]) {
      // Проверяем, не является ли это алиасом из tsconfig
      const tsConfig = filePath
        ? getTsConfigForFile(filePath)
        : getTsConfigForFile(process.cwd());

      if (tsConfig?.compilerOptions?.paths) {
        const isAlias = Object.keys(tsConfig.compilerOptions.paths).some(alias => {
          const aliasPrefix = alias.replace('/*', '').replace('*', '');
          return (
            importTarget === aliasPrefix ||
            importTarget.startsWith(aliasPrefix + '/')
          );
        });
        if (isAlias) return false;
      }

      return true; // @scope/name — внешний
    }
    return false;
  }

  // 4. Всё остальное без ./ и / — внешний npm-пакет
  return true;
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
// ✅ ОБНОВЛЕННЫЙ ParsedFileInfo
// ==========================================

export interface ParsedFileInfo {
  ast: any;
  filePath: string;
  moduleName: string;
  fileId?: string;
  moduleId?: string;
  isVue: boolean;
  isTypeScript: boolean;
  content: string;
  imports: {
    source: string;
    specifiers: string[];
    specifiersStructured?: { imported: string; local: string; type: string }[];
    isTypeOnly: boolean;
    line?: number;
    loc?: any;
    toFileId?: string | null;
    isExternal?: boolean;
    packageName?: string;
  }[];
  exports: {
    name: string;
    type: string;
    isDefault: boolean;
    line?: number;
    isReExport?: boolean;
    source?: string;
    specifiers?: string[];
    loc?: any;
    isTypeOnly?: boolean;
    isStarReExport?: boolean;
    isDefaultReExport?: boolean;
    localName?: string;
  }[];
}

// ==========================================
// ПАРСИНГ VUE SFC
// ==========================================

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

    const scriptContent = result.scriptSetup || result.script;
    if (scriptContent && scriptContent.trim() === '') {
      // ✅ ИСПРАВЛЕНО v7.2.0: понижено до debug — пустой script это норма
      logVue(`ℹ️ Пустой script блок в ${path.basename(filePath)}, пропускаем`);
      return null;
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

// ==========================================
// ✅ ОБНОВЛЕНО: collectImportsFromAST — сохраняется line + loc
// ==========================================

/**
 * Собирает все импорты из AST с сохранением loc и line.
 *
 * ✅ ИСПРАВЛЕНО v7.1.0:
 *   - `line` теперь явно вычисляется из `node.loc.start.line`
 *   - `isExternal` определяется корректно (через isExternalModule)
 *   - `packageName` вычисляется для внешних модулей
 *   - `toFileId` заполняется `external:pkg` для внешних
 *
 * @param ast — AST дерево
 * @param filePath — путь к файлу (для разрешения путей и isExternal)
 */
function collectImportsFromAST(
  ast: any,
  filePath?: string
): {
  source: string;
  specifiers: string[];
  specifiersStructured: { imported: string; local: string; type: string }[];
  isTypeOnly: boolean;
  line?: number;
  loc?: any;
  toFileId?: string | null;
  isExternal?: boolean;
  packageName?: string;
}[] {
  const imports: {
    source: string;
    specifiers: string[];
    specifiersStructured: { imported: string; local: string; type: string }[];
    isTypeOnly: boolean;
    line?: number;
    loc?: any;
    toFileId?: string | null;
    isExternal?: boolean;
    packageName?: string;
  }[] = [];

  if (!ast || !ast.body) return imports;

  const baseDir = filePath ? path.dirname(filePath) : process.cwd();

  walk(ast, {
    enter(node: any) {
      if (node.type === 'ImportDeclaration' && node.source) {
        const source = node.source.value;
        const specifiers: string[] = [];
        const specifiersStructured: { imported: string; local: string; type: string }[] = [];
        const isTypeOnly = node.importKind === 'type' || false;

        for (const spec of node.specifiers || []) {
          if (spec.type === 'ImportSpecifier') {
            const importedName = spec.imported?.name || spec.local?.name;
            const localName = spec.local?.name || spec.imported?.name;
            if (importedName && localName) {
              specifiers.push(
                importedName === localName ? importedName : `${importedName} as ${localName}`
              );
              specifiersStructured.push({
                imported: importedName,
                local: localName,
                type: 'ImportSpecifier',
              });
            }
          } else if (spec.type === 'ImportDefaultSpecifier') {
            const localName = spec.local?.name;
            if (localName) {
              specifiers.push(`default as ${localName}`);
              specifiersStructured.push({
                imported: 'default',
                local: localName,
                type: 'ImportDefaultSpecifier',
              });
            }
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            const localName = spec.local?.name;
            if (localName) {
              specifiers.push(`* as ${localName}`);
              specifiersStructured.push({
                imported: '*',
                local: localName,
                type: 'ImportNamespaceSpecifier',
              });
            }
          }
        }

        if (source && specifiers.length > 0) {
          let toFileId: string | null = null;
          let isExternal = false;
          let packageName: string | undefined;

          // ✅ ИСПРАВЛЕНО: используем новый isExternalModule с filePath
          if (isExternalModule(source, filePath)) {
            isExternal = true;
            packageName = source.startsWith('@')
              ? source.split('/').slice(0, 2).join('/')
              : source.split('/')[0];
            toFileId = `external:${packageName}`;
          } else {
            const resolvedPath = resolveFilePath(baseDir, source);
            toFileId = resolvedPath || `unresolved:${source}`;
          }

          // ✅ НОВОЕ: явно вычисляем line из loc
          const line = node.loc?.start?.line || 0;

          imports.push({
            source,
            specifiers,
            specifiersStructured,
            isTypeOnly,
            line,
            loc: node.loc,
            toFileId,
            isExternal,
            packageName,
          });
        }
      }
    },
  });

  return imports;
}

// ==========================================
// ✅ ОБНОВЛЕНО: collectExportsFromAST
// ==========================================

/**
 * Собирает все экспорты из AST.
 *
 * ✅ ИСПРАВЛЕНО v7.1.0:
 *   - Добавлено поле `localName` (для `export { a as b }`)
 *   - Добавлено поле `isTypeOnly` (для interface/type/enum/export type)
 *   - Добавлено поле `isStarReExport` (для `export * from`)
 *   - Добавлено поле `isDefaultReExport` (для `export { default } from`)
 *   - Правильная обработка `export { a, b }` без source (named exports)
 *   - Правильная обработка `export { a } from 'module'` (re-exports)
 *   - Правильная обработка `export * from 'module'` (star re-exports)
 *   - Правильная обработка `export default function/class` (default exports)
 *   - Правильная обработка `export type { ... }` (type-only)
 *
 * @param ast — AST дерево
 */
export function collectExportsFromAST(ast: any): {
  name: string;
  type: string;
  isDefault: boolean;
  line?: number;
  isReExport?: boolean;
  source?: string;
  specifiers?: string[];
  loc?: any;
  isTypeOnly?: boolean;
  isStarReExport?: boolean;
  isDefaultReExport?: boolean;
  localName?: string;
}[] {
  const exports: any[] = [];

  if (!ast || !ast.body) return exports;

  walk(ast, {
    enter(node: any) {
      // ============================================
      // 1. ExportNamedDeclaration с declaration
      // ============================================
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        const decl = node.declaration;
        const isTypeOnly = node.exportKind === 'type' || false;

        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            localName: decl.id.name,           // ✅
            type: 'function',
            isDefault: false,
            line: node.loc?.start?.line || decl.loc?.start?.line,
            isReExport: false,
            isTypeOnly,
            loc: node.loc,
          });
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            localName: decl.id.name,           // ✅
            type: 'class',
            isDefault: false,
            line: node.loc?.start?.line || decl.loc?.start?.line,
            isReExport: false,
            isTypeOnly,
            loc: node.loc,
          });
        } else if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations) {
            if (d.id?.name) {
              exports.push({
                name: d.id.name,
                localName: d.id.name,         // ✅
                type: 'variable',
                isDefault: false,
                line: d.loc?.start?.line || node.loc?.start?.line,
                isReExport: false,
                isTypeOnly,
                loc: d.loc || node.loc,
              });
            }
          }
        } else if (decl.type === 'TSInterfaceDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            localName: decl.id.name,           // ✅
            type: 'interface',
            isDefault: false,
            line: node.loc?.start?.line || decl.loc?.start?.line,
            isReExport: false,
            isTypeOnly: true,                  // ✅ interface → type-only
            loc: node.loc,
          });
        } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            localName: decl.id.name,           // ✅
            type: 'type',
            isDefault: false,
            line: node.loc?.start?.line || decl.loc?.start?.line,
            isReExport: false,
            isTypeOnly: true,                  // ✅ type alias → type-only
            loc: node.loc,
          });
        } else if (decl.type === 'TSEnumDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            localName: decl.id.name,           // ✅
            type: 'enum',
            isDefault: false,
            line: node.loc?.start?.line || decl.loc?.start?.line,
            isReExport: false,
            isTypeOnly: false,
            loc: node.loc,
          });
        }
      }

      // ============================================
      // 2. ✅ ИСПРАВЛЕНО: Re-exports и named exports
      //    export { a, b }               — named (без source)
      //    export { a, b } from 'module' — re-export
      //    export type { T }             — type-only named
      //    export { default } from '...' — default re-export
      // ============================================
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.specifiers &&
        node.specifiers.length > 0
      ) {
        const isReExport = !!node.source;
        const sourceModule = node.source?.value;
        const isTypeOnly = node.exportKind === 'type' || false;

        const specifierNames: string[] = [];

        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            const exportedName = spec.exported?.name || spec.local?.name;
            const localName = spec.local?.name || spec.exported?.name;
            if (!exportedName) continue;

            specifierNames.push(exportedName);

            const isDefault =
              exportedName === 'default' || localName === 'default';

            const isDefaultReExport = isReExport && isDefault;

            exports.push({
              name: exportedName,
              localName,                       // ✅ ЛОКАЛЬНОЕ ИМЯ
              type: isReExport
                ? isDefault
                  ? 'default'
                  : 're-export'
                : 'named',
              isDefault,
              isDefaultReExport,               // ✅
              line: node.loc?.start?.line,
              isReExport,
              source: sourceModule,
              specifiers: [localName],
              isTypeOnly,
              isStarReExport: false,           // ✅
              loc: node.loc,
            });
          }
        }

        // Групповая запись (для совместимости и агрегации)
        if (isReExport && specifierNames.length > 0) {
          exports.push({
            name: `{ ${specifierNames.join(', ')} }`,
            localName: `{ ${specifierNames.join(', ')} }`,  // ✅
            type: 're-export-group',
            isDefault: false,
            isDefaultReExport: false,          // ✅
            line: node.loc?.start?.line,
            isReExport: true,
            source: sourceModule,
            specifiers: specifierNames,
            isTypeOnly,
            isStarReExport: false,             // ✅
            loc: node.loc,
          });
        }
      }

      // ============================================
      // 3. ✅ ИСПРАВЛЕНО: ExportDefaultDeclaration
      // ============================================
      if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
        const decl = node.declaration;
        let name = 'default';
        let localName = 'default';             // ✅
        let type = 'default';

        if (decl.type === 'FunctionDeclaration' && decl.id) {
          name = decl.id.name || 'default';
          localName = decl.id.name || 'default';
          type = 'function';
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          name = decl.id.name || 'default';
          localName = decl.id.name || 'default';
          type = 'class';
        } else if (decl.type === 'Identifier') {
          name = decl.name || 'default';
          localName = decl.name || 'default';
          type = 'value';
        } else if (decl.type === 'ObjectExpression') {
          name = 'default';
          localName = 'default';
          type = 'object';
        } else if (decl.type === 'ArrowFunctionExpression') {
          name = 'default';
          localName = 'default';
          type = 'function';
        }

        exports.push({
          name,
          localName,                           // ✅
          type,
          isDefault: true,
          isDefaultReExport: false,            // ✅ default export — НЕ re-export
          line: node.loc?.start?.line,
          isReExport: false,
          isTypeOnly: false,
          isStarReExport: false,               // ✅
          loc: node.loc,
        });
      }

      // ============================================
      // 4. ✅ ИСПРАВЛЕНО: ExportAllDeclaration
      //    export * from 'module'
      //    export * as ns from 'module'
      // ============================================
      if (node.type === 'ExportAllDeclaration' && node.source) {
        const isNamespace = !!node.exported?.name;
        const exportedName = node.exported?.name || '*';

        exports.push({
          name: exportedName,
          localName: '*',                      // ✅
          type: 'all',
          isDefault: false,
          isDefaultReExport: false,            // ✅
          line: node.loc?.start?.line,
          isReExport: true,
          source: node.source.value,
          isTypeOnly: node.exportKind === 'type' || false,
          isStarReExport: true,                // ✅
          specifiers: isNamespace ? [node.exported.name] : undefined,
          loc: node.loc,
        });
      }
    },
  });

  // Удаляем дубликаты (оставляем первое вхождение)
  const seen = new Set<string>();
  const unique = exports.filter(exp => {
    const key = `${exp.name}:${exp.isReExport ? 're' : 'normal'}:${exp.source || 'self'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

// ==========================================
// ✅ ОБНОВЛЕНО: parseFile
// ==========================================

/**
 * Парсит файл в AST с поддержкой Vue SFC и нормализацией путей.
 *
 * ✅ ИСПРАВЛЕНО v7.1.0:
 *   - collectImportsFromAST вызывается с filePath (для isExternal)
 *
 * ✅ ОБНОВЛЕНО v7.2.0:
 *   - Все console.log чтения/парсинга понижены до logParse (флаг AST_DEBUG_PARSE)
 *   - Предупреждение "не найден script блок" понижено до logVue (флаг AST_DEBUG_VUE)
 */
export function parseFile(filePath: string, _options?: { extractTemplate?: boolean }): ParsedFileInfo | null {
  try {
    const resolvedPath = validateAndResolvePath(filePath);
    if (!resolvedPath) return null;

    if (filePath.endsWith('.css')) {
      logParse(`⏭️ Пропуск CSS файла: ${path.basename(filePath)}`);
      return null;
    }

    const unsupportedExtensions = [
      '.css', '.scss', '.less', '.html', '.json', '.xml', '.svg',
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot',
    ];
    const ext = path.extname(filePath);
    if (unsupportedExtensions.includes(ext)) {
      logParse(`⏭️ Пропуск неподдерживаемого файла: ${path.basename(filePath)}`);
      return null;
    }

    logParse(`📖 Чтение файла: ${resolvedPath}`);
    let code = fs.readFileSync(resolvedPath, 'utf-8');
    logParse(`📏 Размер файла: ${code.length} символов`);

    let isVue = false;
    let isTypeScript = false;
    const moduleName = path.basename(path.dirname(resolvedPath));
    let imports: {
      source: string;
      specifiers: string[];
      specifiersStructured?: { imported: string; local: string; type: string }[];
      isTypeOnly: boolean;
      line?: number;
      loc?: any;
      toFileId?: string | null;
      isExternal?: boolean;
      packageName?: string;
    }[] = [];
    let exports: {
      name: string;
      type: string;
      isDefault: boolean;
      line?: number;
      isReExport?: boolean;
      source?: string;
      specifiers?: string[];
      loc?: any;
      isTypeOnly?: boolean;
      isStarReExport?: boolean;
      isDefaultReExport?: boolean;
      localName?: string;
    }[] = [];

    if (filePath.endsWith('.vue')) {
      isVue = true;
      const sfc = parseVueSFCFile(resolvedPath);

      if (!sfc) {
        // ✅ ИСПРАВЛЕНО v7.2.0: понижено до debug — иконки без script это норма
        logVue(`⏭️ Пропуск Vue файла (нет скрипта или пустой скрипт): ${path.basename(filePath)}`);
        return null;
      }

      const scriptType = sfc.scriptType || 'unknown';
      isTypeScript = scriptType === 'ts' || scriptType === 'tsSetup';

      const scriptContent = sfc.scriptSetup || sfc.script;

      if (!scriptContent) {
        // ✅ ИСПРАВЛЕНО v7.2.0: warn → debug
        logVue(`ℹ️ В Vue файле ${resolvedPath} не найден script блок`);
        return null;
      }

      if (scriptContent.trim() === '') {
        logVue(`ℹ️ Пустой script блок в ${path.basename(filePath)}, пропускаем`);
        return null;
      }

      code = scriptContent;
      logParse(`📄 Vue файл: ${path.basename(resolvedPath)} (${scriptType}, TS: ${isTypeScript})`);

      if (sfc.styles.length > 0) {
        logParse(`   🎨 Styles: ${sfc.styles.length} блоков`);
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

    logParse(
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
        logParse('🔄 Повторная попытка с упрощенными настройками...');
        ast = parser.parse(code, fallbackOptions);
        logParse('✅ Fallback парсинг успешен');
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
        ast: { type: 'Program', body: [], sourceType: 'module', comments: [], tokens: [] },
        filePath: resolvedPath,
        moduleName,
        isVue,
        isTypeScript,
        content: code,
        imports: [],
        exports: [],
      };
    }

    logParse(`✅ AST успешно построен, узлов верхнего уровня: ${ast.body.length}`);

    const nodeTypes = ast.body.slice(0, 5).map((n: any) => n?.type || 'unknown');
    logParse(`📋 Типы первых узлов: ${nodeTypes.join(', ')}`);

    const hasClasses = ast.body.some((n: any) => n?.type === 'ClassDeclaration');
    const hasFunctions = ast.body.some((n: any) => n?.type === 'FunctionDeclaration');
    const hasVariables = ast.body.some((n: any) => n?.type === 'VariableDeclaration');

    logParse(
      `📊 Содержимое AST: Classes=${hasClasses}, Functions=${hasFunctions}, Variables=${hasVariables}`
    );

    // ✅ ИСПРАВЛЕНО: передаём resolvedPath в collectImportsFromAST
    imports = collectImportsFromAST(ast, resolvedPath);
    exports = collectExportsFromAST(ast);

    if (imports.length > 0) {
      logParse(`   📥 Найдено импортов: ${imports.length}`);
    }
    if (exports.length > 0) {
      logParse(`   📤 Найдено экспортов: ${exports.length}`);
    }

    if (isVue && ast) {
      ast._originalCode = code;
      ast._isVue = true;
      ast._vueType = isTypeScript ? 'tsSetup' : 'setup';
    }

    return {
      ast,
      filePath: resolvedPath,
      moduleName,
      isVue,
      isTypeScript,
      content: code,
      imports,
      exports,
    };
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

// ==========================================
// ✅ ОБНОВЛЕНО: resolveFilePath
// ==========================================

export function resolveFilePath(baseDir: string, targetPath: string): string | null {
  if (path.isAbsolute(targetPath) && fs.existsSync(targetPath)) {
    return targetPath;
  }

  const tsConfig = getTsConfigForFile(baseDir);
  const tsConfigDir = getTsConfigDir() || baseDir;

  const aliasedPath = resolveAliasPath(targetPath, tsConfigDir, tsConfig);
  if (aliasedPath && fs.existsSync(aliasedPath)) {
    // ✅ ИСПРАВЛЕНО v7.2.0: понижено до debug — логировалось дважды
    logPath(`   🔗 Алиас: ${targetPath} → ${path.relative(process.cwd(), aliasedPath)}`);
    return aliasedPath;
  }

  const fullPath = path.resolve(baseDir, targetPath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  const hasExtension = path.extname(targetPath) !== '';
  if (!hasExtension && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    logPath(`   📄 Найден без расширения: ${targetPath}`);
    return fullPath;
  }

  if (targetPath.endsWith('.js')) {
    const tsPath = fullPath.replace(/\.js$/, '.ts');
    if (fs.existsSync(tsPath) && fs.statSync(tsPath).isFile()) {
      logPath(`   🔄 .js → .ts: ${targetPath} → ${path.relative(process.cwd(), tsPath)}`);
      return tsPath;
    }
  }
  if (targetPath.endsWith('.ts')) {
    const jsPath = fullPath.replace(/\.ts$/, '.js');
    if (fs.existsSync(jsPath) && fs.statSync(jsPath).isFile()) {
      logPath(`   🔄 .ts → .js: ${targetPath} → ${path.relative(process.cwd(), jsPath)}`);
      return jsPath;
    }
  }

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];

  for (const ext of extensions) {
    const testPath = fullPath + ext;
    if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
      logPath(`   📄 Найден: ${targetPath} → ${path.relative(process.cwd(), testPath)}`);
      return testPath;
    }
  }

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = path.join(fullPath, `index${ext}`);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        logPath(`   📁 Директория → index${ext}: ${targetPath}`);
        return indexPath;
      }
    }
  }

  if (tsConfigDir && tsConfigDir !== baseDir) {
    const fromRootPath = path.resolve(tsConfigDir, targetPath);

    if (fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isFile()) {
      return fromRootPath;
    }

    if (!hasExtension && fs.existsSync(fromRootPath) && fs.statSync(fromRootPath).isFile()) {
      return fromRootPath;
    }

    if (targetPath.endsWith('.js')) {
      const tsFromRoot = fromRootPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsFromRoot) && fs.statSync(tsFromRoot).isFile()) {
        return tsFromRoot;
      }
    }

    if (targetPath.endsWith('.ts')) {
      const jsFromRoot = fromRootPath.replace(/\.ts$/, '.js');
      if (fs.existsSync(jsFromRoot) && fs.statSync(jsFromRoot).isFile()) {
        return jsFromRoot;
      }
    }

    for (const ext of extensions) {
      const testPath = fromRootPath + ext;
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        return testPath;
      }
    }

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

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

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

function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  if (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
      return true;
    }
  }

  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (decorator.expression?.name === 'export') {
        return true;
      }
    }
  }

  return false;
}

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
