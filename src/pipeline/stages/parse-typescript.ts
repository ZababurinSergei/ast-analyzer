// src/pipeline/stages/parse-typescript.ts
// ============================================================
// STAGE 2a: PARSE TYPESCRIPT / JAVASCRIPT FILE
// ============================================================
// Версия: 1.3.1
//
// ✅ v1.3.1: диагностические логи (для отладки React-интеграции)
//   - Добавлен console.log в шаге 5.5 (перед записью react* полей).
//   - Печатает: file, ext, absolutePath, reactAnalysis.components.length.
//
// ✅ v1.3.0: React-анализ для .tsx/.jsx
//   - После extractEntitiesFromAST вызывается analyzeReactComponent
//     (только для .tsx/.jsx) и заполняются поля entities.react*:
//       • reactComponents
//       • reactHooks
//       • reactEffects
//       • reactContexts
//       • reactMemoization
//       • reactRefs
//       • reactJsxElements
//       • reactJsxEvents
//       • reactConditionals
//       • reactComponentUsages
//   - Дальше pass7React собирает их через classifyReactEntities.
//   - Ошибки React-анализа не роняют pipeline (опционально).
//
// ✅ v1.2.0: пропуск .d.ts (декларации типов, не код)

import path from 'path';

import { parseFile } from '../../core/ast-parser.js';
import { extractEntitiesFromAST } from '../../core/entity-extractor/ast/extract-entities-from-ast.js';
import { analyzeReactComponent } from '../../modes/react-analyzer/index.js';
import type { EntitiesResult } from '../../types.js';
import type { PipelineContext } from '../types.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Расширения, обрабатываемые этой веткой.
 *
 * Синхронизировано с `TS_JS_EXTENSIONS` в `parse-file.ts`
 * и с `DEFAULT_EXTENSIONS` в `ci-cd/collect-files.ts`.
 *
 * ВАЖНО: `.vue` СОЗНАТЕЛЬНО отсутствует — для Vue
 * используется отдельная ветка `parse-vue.ts`.
 */
const SUPPORTED_EXTENSIONS = new Set<string>(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * TS/JS-ветка pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверка расширения
 *   2. Резолвинг пути
 *   3. Парсинг в ESTree AST
 *   4. Извлечение сущностей
 *   5. Нормализация entities.filePath
 *   5.5. ✅ v1.3.0: React-анализ (только .tsx/.jsx)
 *   6. Возврат
 *
 * @param file — путь к файлу (ОТНОСИТЕЛЬНЫЙ от projectRoot)
 * @param ctx  — контекст pipeline (для verbose-логирования)
 * @returns EntitiesResult или null
 */
export async function parseTypeScriptFile(
  file: string,
  ctx: PipelineContext
): Promise<EntitiesResult | null> {
  const { options } = ctx;

  // ────────────────────────────────────────────────────────
  // Шаг 1: Проверка расширения
  // ────────────────────────────────────────────────────────

  // ✅ v1.2.0: .d.ts — декларации типов, не код.
  if (file.endsWith('.d.ts')) {
    if (options.verbose) {
      console.warn(
        `   ⏭️  parseTypeScriptFile: пропуск .d.ts (декларации типов) ` + `${path.basename(file)}`
      );
    }
    return null;
  }

  const ext = path.extname(file).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    if (options.verbose) {
      console.warn(
        `   ⏭️  parseTypeScriptFile: неподдерживаемое расширение ` +
          `'${ext}' для ${path.basename(file)}`
      );
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 2: ✅ РЕЗОЛВИНГ ПУТИ
  // ────────────────────────────────────────────────────────
  const absolutePath = path.isAbsolute(file) ? file : path.resolve(options.projectRoot, file);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Парсинг в ESTree AST
  // ────────────────────────────────────────────────────────
  let parsed: ReturnType<typeof parseFile>;
  try {
    parsed = parseFile(absolutePath);
  } catch (error) {
    if (options.verbose) {
      console.warn(
        `   ⚠️  parseFile упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    return null;
  }

  if (!parsed) {
    if (options.verbose) {
      console.warn(`   ⏭️  Не удалось распарсить: ${path.basename(file)}`);
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 4: Извлечение сущностей из AST
  // ────────────────────────────────────────────────────────
  let entities: EntitiesResult;
  try {
    entities = extractEntitiesFromAST(parsed.ast, absolutePath);
  } catch (error) {
    if (options.verbose) {
      console.warn(
        `   ⚠️  extractEntitiesFromAST упал на ${path.basename(file)}: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
    }
    return null;
  }

  // ────────────────────────────────────────────────────────
  // Шаг 5: ✅ НОРМАЛИЗАЦИЯ entities.filePath
  // ────────────────────────────────────────────────────────
  entities.filePath = file;
  entities.moduleName = path.basename(file);

  // ────────────────────────────────────────────────────────
  // ✅ v1.3.0: Шаг 5.5: REACT-АНАЛИЗ (только .tsx/.jsx)
  // ────────────────────────────────────────────────────────
  //
  // ✅ v1.3.1: добавлен диагностический лог
  // ────────────────────────────────────────────────────────
  if (ext === '.tsx' || ext === '.jsx') {
    try {
      // 🔍 v1.3.1: диагностика перед вызовом
      console.log(`[parseTypeScriptFile] → file=${file}, ext=${ext}, abs=${absolutePath}`);

      const reactAnalysis = analyzeReactComponent(absolutePath, {
        projectRoot: options.projectRoot,
        verbose: options.verbose,
      });

      // 🔍 v1.3.1: диагностика после вызова
      console.log(
        `[parseTypeScriptFile] ← reactAnalysis? ${!!reactAnalysis}, components=${reactAnalysis?.components?.length ?? 'n/a'}`
      );

      if (reactAnalysis) {
        // Инициализируем поля react* (даже пустыми — для симметрии)
        entities.reactComponents = [];
        entities.reactHooks = [];
        entities.reactEffects = [];
        entities.reactContexts = [];
        entities.reactMemoization = [];
        entities.reactRefs = [];
        entities.reactJsxElements = [];
        entities.reactJsxEvents = [];
        entities.reactConditionals = [];
        entities.reactComponentUsages = [];

        for (const comp of reactAnalysis.components) {
          // 1. Компонент
          entities.reactComponents.push({
            name: comp.name,
            kind: comp.kind,
            line: comp.line,
            props: comp.props,
            isExported: comp.isExported,
            isDefaultExport: comp.isDefaultExport,
            isMemoized: comp.isMemoized,
            isForwardRef: comp.isForwardRef,
          });

          // 2. Хуки компонента
          for (const h of comp.hooks) {
            entities.reactHooks.push({
              componentId: '',
              kind: h.kind,
              line: h.line,
              stateName: h.stateName,
              setterName: h.setterName,
              initialValue: h.initialValue,
              deps: h.deps,
              hasCleanup: h.hasCleanup,
              usedInRender: h.usedInRender,
            });

            // useEffect/useLayoutEffect/useInsertionEffect → reactEffects
            if (
              h.kind === 'useEffect' ||
              h.kind === 'useLayoutEffect' ||
              h.kind === 'useInsertionEffect'
            ) {
              entities.reactEffects.push({
                componentId: '',
                hookId: '',
                kind: h.effectKind ?? 'update',
                line: h.line,
                deps: h.deps ?? [],
                hasCleanup: h.hasCleanup ?? false,
                reads: [],
                mutates: [],
              });
            }

            // useMemo/useCallback → reactMemoization
            if (h.kind === 'useMemo' || h.kind === 'useCallback') {
              entities.reactMemoization.push({
                componentId: '',
                kind: h.kind,
                line: h.line,
                deps: h.deps ?? [],
              });
            }

            // useRef → reactRefs
            if (h.kind === 'useRef') {
              entities.reactRefs.push({
                componentId: '',
                line: h.line,
                name: h.refName,
                isForwardRef: false,
              });
            }

            // useContext → reactContexts
            if (h.kind === 'useContext') {
              entities.reactContexts.push({
                componentId: '',
                kind: 'consume',
                line: h.line,
                name: h.contextName,
              });
            }
          }

          // 3. JSX-элементы
          for (const jsx of comp.jsxElements) {
            entities.reactJsxElements.push({
              usageId: (jsx as any).usageId,
              componentId: '',
              kind: jsx.kind,
              tagName: jsx.tagName,
              line: jsx.line,
              column: jsx.column,
              attrs: jsx.attrs,
              children: jsx.children,
              textContent: jsx.textContent,
              expression: jsx.expression,
              expressionRefs: jsx.expressionRefs ?? [],
              parentElementId: jsx.parentElementId,
              conditionalKind: jsx.conditionalKind,
              eventIds: [],
              stateUsages: [],
              propUsages: [],
              callExpressions: [],
            });
          }

          // 4. JSX-события
          for (const ev of comp.jsxEvents) {
            entities.reactJsxEvents.push({
              elementId: ev.elementId,
              eventName: ev.eventName,
              line: ev.line,
              handler: ev.handler,
              source: ev.source,
            });
          }

          // 5. Conditionals
          for (const cd of comp.conditionals) {
            entities.reactConditionals.push({
              componentId: '',
              kind: cd.kind,
              condition: cd.condition,
              refs: cd.refs,
              line: cd.line,
              guards: cd.guards,
            });
          }

          // 6. Component usages
          for (const u of comp.componentUsages) {
            entities.reactComponentUsages.push({
              usageId: u.usageId,
              tagName: u.tagName,
              parentComponentId: '',
              line: u.line,
              isExternal: u.isExternal,
              props: u.props,
              events: u.events,
              slots: u.slots,
            });
          }
        }

        // 🔍 v1.3.1: финальная диагностика
        console.log(
          `[parseTypeScriptFile] ✅ entities.reactComponents=${entities.reactComponents.length}, reactHooks=${entities.reactHooks.length}, reactJsxElements=${entities.reactJsxElements.length}`
        );

        if (options.verbose) {
          const total =
            (entities.reactComponents?.length ?? 0) +
            (entities.reactHooks?.length ?? 0) +
            (entities.reactJsxElements?.length ?? 0);
          if (total > 0) {
            console.log(
              `      ⚛️  React: ${entities.reactComponents?.length ?? 0} comp, ` +
                `${entities.reactHooks?.length ?? 0} hooks, ` +
                `${entities.reactJsxElements?.length ?? 0} JSX`
            );
          }
        }
      }
    } catch (reactError) {
      if (options.verbose) {
        console.warn(
          `   ⚠️  React-анализ упал на ${path.basename(file)}: ` +
            `${reactError instanceof Error ? reactError.message : String(reactError)}`
        );
      }
      // Не роняем pipeline — React-секция опциональна
    }
  }

  // ────────────────────────────────────────────────────────
  // Шаг 6: Логирование в verbose-режиме
  // ────────────────────────────────────────────────────────
  if (options.verbose) {
    logSuccess(file, ext, entities);
  }

  return entities;
}

// ============================================================
// ЛОГИРОВАНИЕ
// ============================================================

/**
 * Логирует успешный парсинг TS/JS-файла.
 */
function logSuccess(file: string, ext: string, entities: EntitiesResult): void {
  const name = path.basename(file);
  const parts: string[] = [];

  if (entities.functions.length > 0) {
    parts.push(`${entities.functions.length}ƒ`);
  }

  if (entities.classes.length > 0) {
    parts.push(`${entities.classes.length}cls`);
  }

  if (entities.constants.length > 0) {
    parts.push(`${entities.constants.length}const`);
  }

  const typesCount = (entities.interfaces?.length ?? 0) + (entities.types?.length ?? 0);
  if (typesCount > 0) {
    parts.push(`${typesCount}type`);
  }

  if (entities.variables.length > 0) {
    parts.push(`${entities.variables.length}var`);
  }

  if (entities.imports.length > 0) {
    parts.push(`${entities.imports.length}imp`);
  }

  if (entities.exports.length > 0) {
    parts.push(`${entities.exports.length}exp`);
  }

  const icon = ext === '.tsx' || ext === '.jsx' ? '⚛️' : '📄';

  const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  console.log(`   ${icon} ${name}${suffix}`);
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ ТЕСТОВ И API)
// ============================================================

export function isTypeScriptExtension(ext: string): boolean {
  return SUPPORTED_EXTENSIONS.has(ext.toLowerCase());
}

export function getSupportedExtensions(): string[] {
  return Array.from(SUPPORTED_EXTENSIONS);
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default parseTypeScriptFile;
