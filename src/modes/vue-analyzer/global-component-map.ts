// src/modes/vue-analyzer/global-component-map.ts
// ============================================
// ГЛОБАЛЬНАЯ КАРТА VUE-КОМПОНЕНТОВ ПРОЕКТА
// ============================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (удаление props/emits/expose экстракторов):
//   - ✅ УДАЛЕНЫ импорты extractExposeFromCompiledScript,
//     extractExposeFromAST, extractPropsFromCompiledScript,
//     extractPropsFromAST, extractEmitsFromCompiledScript,
//     extractEmitsFromAST из './extractors/index.js'
//   - ✅ ЗАМЕНЕНО: используем extractVueMacros из
//     '../../core/relations/vue-macros-extractor.js' —
//     единый модуль для defineExpose/defineProps/defineEmits/
//     defineModel/defineSlots/defineOptions
//   - ✅ УБРАН вызов compileScriptBlock — больше не нужен
//     (extractVueMacros работает напрямую с ts-morph AST)
//   - ✅ ОБНОВЛЕНО: extractComponentInfo теперь использует
//     extractVueMacros для expose/props/emits
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация двухпроходного анализа
//   - Сканирование .vue файлов проекта
//   - Построение карты componentName → { filePath, expose, props, emits }
// ============================================

import path from 'path';
import { glob } from 'glob';
import { Project } from 'ts-morph';
import { parse as parseTS } from '@typescript-eslint/parser';

import { parseVueFile } from './parser.js';
import { extractVueMacros } from '../../core/relations/vue-macros-extractor.js';
import type { VueMacros } from '../../core/relations/types.js';

// ============================================
// ТИПЫ
// ============================================

export interface ComponentInfo {
  /** Имя компонента (PascalCase, из defineOptions или из имени файла) */
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

  // Создаём ts-morph Project для парсинга script-блоков
  const tsProject = new Project({
    compilerOptions: {
      target: 99,
      module: 99,
      allowJs: true,
      checkJs: false,
      skipLibCheck: true,
      jsx: 2,
    },
    useInMemoryFileSystem: false,
  });

  // Проходим по каждому файлу
  for (const filePath of vueFiles) {
    try {
      const info = extractComponentInfo(filePath, tsProject, debug);
      if (!info) continue;

      // Регистрируем по имени компонента
      map.set(info.name, info);

      // Дополнительные алиасы: PascalCase → kebab-case
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
 *
 * Использует extractVueMacros из core/relations для
 * извлечения defineExpose/defineProps/defineEmits.
 */
function extractComponentInfo(
  filePath: string,
  tsProject: Project,
  debug: boolean
): ComponentInfo | null {
  const parsed = parseVueFile(filePath);
  if (!parsed) return null;

  const { descriptor } = parsed;
  const scriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';

  if (!scriptContent.trim()) return null;

  // Парсим script через ts-morph
  let scriptAst: any = null;
  try {
    const inMemoryPath = `${filePath}__script__.ts`;
    const sourceFile = tsProject.createSourceFile(inMemoryPath, scriptContent, {
      overwrite: true,
    });
    scriptAst = sourceFile;
  } catch {
    // Игнорируем ошибки парсинга
  }

  // Fallback: парсим через typescript-eslint parser
  // (для случая, когда ts-morph не смог распарсить)
  if (!scriptAst) {
    try {
      parseTS(scriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      });
    } catch {
      // Игнорируем
    }
  }

  // ✅ Используем единый extractVueMacros
  let macros: VueMacros | null = null;
  if (scriptAst) {
    try {
      macros = extractVueMacros(scriptAst, scriptAst);
    } catch (error) {
      if (debug) {
        console.debug(
          `[global-map] extractVueMacros failed for ${path.basename(filePath)}: ` +
            `${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // --- NAME ---
  // Приоритет: defineOptions.name > имя файла
  let name = path.basename(filePath, '.vue');

  if (macros?.options?.name) {
    name = macros.options.name;
  } else {
    // Проверяем <script setup name="X">
    const setupAttrs = descriptor.scriptSetup?.attrs;
    if (setupAttrs) {
      let nameAttr: string | undefined;
      if (Array.isArray(setupAttrs)) {
        const found = setupAttrs.find((a: any) => a.name === 'name');
        nameAttr = found?.value;
      } else if (typeof setupAttrs === 'object') {
        nameAttr = (setupAttrs as any).name;
      }
      if (nameAttr) name = nameAttr;
    }
  }

  // --- EXPOSE ---
  const expose = macros?.exposed.map(m => m.name) ?? [];

  // --- PROPS ---
  const props = macros?.props.map(p => p.name) ?? [];

  // --- EMITS ---
  const emits = macros?.emits.map(e => e.name) ?? [];

  if (debug) {
    console.debug(
      `[global-map] ${name}: expose=[${expose.join(', ')}], ` +
        `props=${props.length}, emits=${emits.length}`
    );
  }

  return {
    name,
    filePath,
    expose,
    props,
    emits,
  };
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
