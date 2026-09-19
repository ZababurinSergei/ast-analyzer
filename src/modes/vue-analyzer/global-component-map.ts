// src/modes/vue-analyzer/global-component-map.ts
// ============================================
// ГЛОБАЛЬНАЯ КАРТА VUE-КОМПОНЕНТОВ ПРОЕКТА
// ============================================
// Версия: 1.0.0
//
// Назначение:
//   Первый проход двухпроходного анализа.
//   Сканирует все .vue файлы проекта и строит карту:
//     componentName → { filePath, expose, props, emits, ... }
//
// Использование:
//   const map = await buildGlobalComponentMap(projectRoot);
//   const expose = map.get('DataTable')?.expose ?? [];
// ============================================

import path from 'path';
import { glob } from 'glob';
import { parseVueFile, compileScriptBlock } from './parser.js';
import {
  extractExposeFromCompiledScript,
  extractExposeFromAST,
  extractPropsFromCompiledScript,
  extractPropsFromAST,
  extractEmitsFromCompiledScript,
  extractEmitsFromAST,
} from './extractors/index.js';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';

// ============================================
// ТИПЫ
// ============================================

export interface ComponentInfo {
  /** Имя компонента (PascalCase, из имени файла или из defineOptions) */
  name: string;
  /** Абсолютный путь к .vue файлу */
  filePath: string;
  /** Методы, экспонированные через defineExpose */
  expose: string[];
  /** Имена props */
  props: string[];
  /** Имена emits */
  emits: string[];
}

export type GlobalComponentMap = Map<string, ComponentInfo>;

export interface BuildGlobalMapOptions {
  /** Корневая директория проекта */
  projectRoot: string;
  /** Дополнительные паттерны исключения */
  excludePatterns?: string[];
  /** Подробный вывод */
  debug?: boolean;
  /** Максимум файлов (защита от больших проектов) */
  maxFiles?: number;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Строит глобальную карту Vue-компонентов проекта.
 *
 * Первый проход двухпроходного анализа:
 *   - Сканирует все .vue файлы
 *   - Извлекает defineExpose, props, emits
 *   - Возвращает Map<componentName, ComponentInfo>
 *
 * @param options — опции сканирования
 * @returns Глобальная карта компонентов
 */
export async function buildGlobalComponentMap(
  options: BuildGlobalMapOptions
): Promise<GlobalComponentMap> {
  const {
    projectRoot,
    excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.git/**',
      '**/.nuxt/**',
      '**/.output/**',
    ],
    debug = false,
    maxFiles = 5000,
  } = options;

  const map: GlobalComponentMap = new Map();

  // Находим все .vue файлы
  const pattern = path.join(projectRoot, '**/*.vue').replace(/\\/g, '/');

  if (debug) {
    console.debug(`[global-map] Сканирование: ${pattern}`);
  }

  let vueFiles: string[];
  try {
    vueFiles = await glob(pattern, {
      ignore: excludePatterns,
      absolute: true,
      nodir: true,
    });
  } catch (error) {
    console.warn(
      `[global-map] Ошибка сканирования: ${error instanceof Error ? error.message : String(error)}`
    );
    return map;
  }

  if (vueFiles.length > maxFiles) {
    console.warn(`[global-map] Найдено ${vueFiles.length} файлов, ограничиваем до ${maxFiles}`);
    vueFiles = vueFiles.slice(0, maxFiles);
  }

  if (debug) {
    console.debug(`[global-map] Найдено .vue файлов: ${vueFiles.length}`);
  }

  // Проходим по каждому файлу
  for (const filePath of vueFiles) {
    try {
      const info = extractComponentInfo(filePath, debug);
      if (!info) continue;

      // Регистрируем по имени компонента
      map.set(info.name, info);

      // Дополнительные алиасы: если имя в PascalCase — регистрируем kebab-case
      const kebab = toKebabCase(info.name);
      if (kebab !== info.name && !map.has(kebab)) {
        map.set(kebab, info);
      }
    } catch (error) {
      if (debug) {
        console.debug(
          `[global-map] Ошибка анализа ${path.basename(filePath)}: ` +
            `${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  if (debug) {
    console.debug(`[global-map] Карта готова: ${map.size} компонентов`);
  }

  return map;
}

// ============================================
// ИЗВЛЕЧЕНИЕ ИНФОРМАЦИИ О КОМПОНЕНТЕ
// ============================================

/**
 * Извлекает информацию о компоненте из .vue файла.
 */
function extractComponentInfo(filePath: string, debug: boolean): ComponentInfo | null {
  const parsed = parseVueFile(filePath);
  if (!parsed) return null;

  const { descriptor } = parsed;
  const compiledScript = compileScriptBlock(descriptor, filePath);

  const scriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';

  if (!scriptContent.trim()) return null;

  // Парсим AST
  let scriptAst: Program | null = null;
  try {
    scriptAst = parseTS(scriptContent, {
      ecmaVersion: 2022,
      sourceType: 'module',
      loc: true,
      range: true,
      ecmaFeatures: { jsx: true },
    }) as Program;
  } catch {
    // Игнорируем ошибки парсинга
  }

  // --- NAME ---
  // Приоритет: defineOptions.name > имя файла
  const name = extractComponentName(descriptor, filePath, scriptAst);

  // --- EXPOSE ---
  let expose = extractExposeFromCompiledScript(compiledScript);
  if (expose.length === 0 && scriptAst) {
    const astExpose = extractExposeFromAST(scriptAst);
    if (astExpose.length > 0) expose = astExpose;
  }

  // --- PROPS ---
  let props = extractPropsFromCompiledScript(compiledScript);
  if (props.names.length === 0 && scriptAst) {
    const astProps = extractPropsFromAST(scriptAst);
    if (astProps.names.length > 0) props = astProps;
  }

  // --- EMITS ---
  let emits = extractEmitsFromCompiledScript(compiledScript);
  if (emits.names.length === 0 && scriptAst) {
    const astEmits = extractEmitsFromAST(scriptAst);
    if (astEmits.names.length > 0) emits = astEmits;
  }

  if (debug) {
    console.debug(
      `[global-map] ${name}: expose=[${expose.join(', ')}], ` +
        `props=${props.names.length}, emits=${emits.names.length}`
    );
  }

  return {
    name,
    filePath,
    expose,
    props: props.names,
    emits: emits.names,
  };
}

// ============================================
// ИЗВЛЕЧЕНИЕ ИМЕНИ КОМПОНЕНТА
// ============================================

/**
 * Извлекает имя компонента.
 *
 * Приоритет:
 *   1. defineOptions({ name: 'X' })
 *   2. <script setup name="X"> — устаревшее, но встречается
 *   3. Имя файла без расширения
 */
function extractComponentName(
  descriptor: any,
  filePath: string,
  scriptAst: Program | null
): string {
  // 1. defineOptions({ name: 'X' })
  if (scriptAst) {
    const fromDefineOptions = extractNameFromDefineOptions(scriptAst);
    if (fromDefineOptions) return fromDefineOptions;
  }

  // 2. <script setup name="X">
  const setupAttrs = descriptor.scriptSetup?.attrs;
  if (setupAttrs) {
    let nameAttr: string | undefined;
    if (Array.isArray(setupAttrs)) {
      const found = setupAttrs.find((a: any) => a.name === 'name');
      nameAttr = found?.value;
    } else if (typeof setupAttrs === 'object') {
      nameAttr = (setupAttrs as any).name;
    }
    if (nameAttr) return nameAttr;
  }

  // 3. Имя файла
  return path.basename(filePath, '.vue');
}

/**
 * Ищет `defineOptions({ name: 'X' })` в AST.
 */
function extractNameFromDefineOptions(ast: Program): string | null {
  let found: string | null = null;

  const visit = (node: any) => {
    if (found) return;
    if (!node || typeof node !== 'object') return;

    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'defineOptions' &&
      node.arguments?.[0]?.type === 'ObjectExpression'
    ) {
      const obj = node.arguments[0];
      for (const prop of obj.properties ?? []) {
        if (
          prop.type === 'Property' &&
          prop.key?.type === 'Identifier' &&
          prop.key.name === 'name' &&
          prop.value?.type === 'Literal' &&
          typeof prop.value.value === 'string'
        ) {
          found = prop.value.value;
          return;
        }
      }
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) visit(item);
      } else if (child && typeof child === 'object') {
        visit(child);
      }
    }
  };

  visit(ast);
  return found;
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * PascalCase → kebab-case.
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  buildGlobalComponentMap,
};
