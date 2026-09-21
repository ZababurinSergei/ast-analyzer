// src/pipeline/stages/resolve-relations.ts
// ============================================================
// STAGE 4: RESOLVE RELATIONS
// ============================================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0 (fix integration with relation-resolver):
//   - ✅ ИСПРАВЛЕНО: runRelationResolver теперь возвращает
//     ResolveResult { stats, templates, vueMacros, localBindings,
//     refCalls, index }, а не ResolveStats. Обновлён
//     соответствующим образом вызов и разбор результата.
//   - ✅ ИСПРАВЛЕНО: обращение к template.emits — теперь через
//     TemplateRecord.emits (поле добавлено в pipeline/types.ts)
//   - ✅ ИСПРАВЛЕНО: тип imports собирается как ImportRecord[]
//     (совместимо с core/relations/types.ts)
//   - ✅ ИСПРАВЛЕНО: тип functions собирается как
//     Map<string, FunctionRecord>
//   - ✅ ИСПРАВЛЕНО: в metrics.relationsResolved записывается
//     корректный объект RelationsResolvedMetrics
//   - ✅ ДОБАВЛЕНО: error handling для случая, когда ts-morph
//     не может создать SourceFile
//   - ✅ УБРАН старый вызов parseTS — он дублировал работу ts-morph
//   - ✅ ОБНОВЛЕНО: версия stage 1.0.0 → 2.0.0
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия stage
//   - Интеграция с relation-resolver
//   - Обогащение ctx.enhancedMap после работы resolver-а
//
// ============================================================
// НАЗНАЧЕНИЕ
// ============================================================
//
// Stage для разрешения кросс-файловых связей в Vue-проекте.
// Запускается ПОСЛЕ NormalizeEntitiesStage и ДО BuildReportStage.
//
// Использует единый relation-resolver (core/relations/), который:
//   1. Строит глобальный индекс (componentUsers, stores, routes)
//   2. Извлекает Vue-макросы (defineExpose/Props/Emits/Model/Slots/Options)
//   3. Извлекает ref-calls (contextMenu.value?.openContextMenu())
//   4. Извлекает composables (useXxx returnedKeys)
//   5. Извлекает local bindings (const { data } = useDataState())
//   6. Извлекает inline handlers (@click="() => foo()")
//   7. Извлекает object maps (const icons = { home: AiHomeIcon })
//   8. Запускает 10 resolver-ов:
//        - ref-call-resolver
//        - event-handler-resolver
//        - composable-resolver
//        - props-resolver
//        - emits-resolver
//        - v-model-resolver
//        - dynamic-component-resolver
//        - store-resolver
//        - router-resolver
//        - directive-resolver
//   9. Обогащает templates найденными связями
//
// Результат: ctx.enhancedMap содержит обогащённые templates
// со всеми кросс-файловыми связями.
//
// ============================================================
// СХЕМА
// ============================================================
//
//   ctx.enhancedMap (Vue-файлы с templateXxx полями)
//        │
//        ▼
//   Сбор AST для каждого .vue файла (через ts-morph)
//        │
//        ▼
//   runRelationResolver({ files, templates, functions, imports })
//        │
//        ├── buildGlobalIndex
//        ├── extractVueMacros
//        ├── extractRefCalls
//        ├── extractComposableReturns + extractLocalBindings
//        ├── extractObjectMaps
//        └── resolveRefCalls + resolveEventHandlers + ... + resolveDirectives
//        │
//        ▼
//   result: ResolveResult {
//     stats, templates, vueMacros, localBindings, refCalls, index
//   }
//        │
//        ▼
//   Запись обогащённых templates обратно в ctx.enhancedMap
//        │
//        ▼
//   Обновление ctx.metrics.relationsResolved
//
// ============================================================
// ЗАВИСИМОСТИ
// ============================================================
//   • runRelationResolver из core/relations
//   • PipelineContext, PipelineStage из ../types
//   • StageError из ../errors
//   • ts-morph Project для парсинга script-блоков
//
// ============================================================

import path from 'path';
import fs from 'fs';
import { Project } from 'ts-morph';

import type { PipelineStage, PipelineContext, TemplateRecord } from '../types.js';
import { StageError } from '../errors.js';

import { runRelationResolver } from '../../core/relations/index.js';
import type { ResolveResult, ImportRecord, FunctionRecord } from '../../core/relations/types.js';

// ============================================================
// STAGE
// ============================================================

/**
 * Stage 4: Разрешение кросс-файловых связей.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проверяет наличие Vue-файлов в ctx.enhancedMap.
 *      Если их нет — stage становится no-op.
 *
 *   2. Собирает индексы:
 *        • files:      fileId → { id, path, absolutePath }
 *        • templates:  fileId → TemplateRecord
 *        • functions:  functionId → FunctionRecord
 *        • imports:    ImportRecord[]
 *        • exports:    any[]
 *
 *   3. Собирает AST для каждого .vue файла:
 *        • Извлекает <script setup> через regex
 *        • Парсит через ts-morph
 *        • Складывает в scriptASTs: fileId → { ast, sourceFile }
 *
 *   4. Вызывает runRelationResolver с этими данными.
 *      Резолвер обогащает templates и возвращает ResolveResult.
 *
 *   5. Записывает обогащённые templates обратно в
 *      ctx.enhancedMap (по filePath, а не по fileId).
 *
 *   6. Обновляет ctx.metrics.relationsResolved.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРАБОТКА ОШИБОК
 * ════════════════════════════════════════════════════════════
 *
 *   • Все ошибки складываются в ctx.errors.
 *   • Stage НЕ прерывает pipeline (continueOnError: true).
 *   • При continueOnError: false — StageError пробрасывается.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Стандартный запуск в pipeline
 *   const pipeline = new AnalysisPipeline();
 *   const result = await pipeline.run({
 *     paths: ['./src'],
 *     mode: 'compact',
 *     verbose: true,
 *   });
 *
 *   // Изолированный запуск stage
 *   const ctx = createContext({ projectRoot: './src' });
 *   await new DiscoverFilesStage().run(ctx);
 *   await new ParseFileStage().run(ctx);
 *   await new NormalizeEntitiesStage().run(ctx);
 *   await new ResolveRelationsStage().run(ctx);
 *   // ctx.enhancedMap обогащён relation-связями
 */
export class ResolveRelationsStage implements PipelineStage {
  readonly name = 'resolve-relations';

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    const { options } = ctx;

    // ────────────────────────────────────────────────────────
    // Шаг 1: Проверяем наличие Vue-шаблонов
    // ────────────────────────────────────────────────────────
    const templatesCount = Object.values(ctx.enhancedMap).filter(
      (e: any) => e && (e as any).templateReactivityDeps !== undefined
    ).length;

    if (templatesCount === 0) {
      if (options.verbose) {
        console.log('   ⏭️  Нет Vue-шаблонов — пропуск');
      }
      return ctx;
    }

    if (options.verbose) {
      console.log('');
      console.log(`   🔗 Разрешение связей для ${templatesCount} Vue-файлов...`);
    }

    try {
      // ──────────────────────────────────────────────────────
      // Шаг 2: Собираем индексы
      // ──────────────────────────────────────────────────────
      const files = new Map<string, any>();
      const templates = new Map<string, TemplateRecord>();
      const functions = new Map<string, FunctionRecord>();
      const imports: ImportRecord[] = [];
      const exports: any[] = [];

      let fileCounter = 0;
      let functionCounter = 0;
      let importCounter = 0;
      let exportCounter = 0;

      // Строим отображение: filePath → fileId
      const filePathToId = new Map<string, string>();

      for (const [filePath, entities] of Object.entries(ctx.enhancedMap)) {
        if (!entities) continue;

        fileCounter++;
        const fileId = `f${fileCounter}`;

        const absolutePath = path.resolve(filePath);
        const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

        // Регистрируем файл
        files.set(fileId, {
          id: fileId,
          path: relativePath,
          absolutePath,
        });

        // Запоминаем маппинг filePath → fileId
        filePathToId.set(filePath, fileId);
        filePathToId.set(relativePath, fileId);
        filePathToId.set(absolutePath, fileId);

        // ──────────────────────────────────────────────────
        // Templates
        // ──────────────────────────────────────────────────
        const e = entities as any;
        if (e.templateReactivityDeps !== undefined) {
          const template: TemplateRecord = {
            fileId,
            moduleId: '',
            reactivityDeps: e.templateReactivityDeps ?? [],
            eventHandlers: e.templateEventHandlers ?? [],
            dynamicComponents: e.templateDynamicComponents ?? [],
            directives: e.templateDirectives ?? [],
            usedComponents: e.templateUsedComponents ?? [],
            templateRefs: e.templateRefs ?? [],
            cssVariables: e.templateCssVariables ?? [],
            deepSelectors: e.templateDeepSelectors ?? [],
            slots: e.templateSlots ?? [],
            complexity: e.templateComplexity ?? 0,
            conditionals: e.templateConditionals ?? [],
            templateInjections: e.templateInjections ?? [],
          };

          templates.set(fileId, template);
        }

        // ──────────────────────────────────────────────────
        // Functions
        // ──────────────────────────────────────────────────
        for (const func of e.functions ?? []) {
          functionCounter++;
          const funcId = `fn${functionCounter}`;

          functions.set(funcId, {
            id: funcId,
            name: func.name,
            fileId,
            line: func.line ?? 0,
            body: func.body ?? '',
            calls: func.calls ?? [],
            returnType: func.returnType,
            isAsync: func.isAsync ?? false,
            isExported: func.isExported ?? false,
          });
        }

        // ──────────────────────────────────────────────────
        // Imports
        // ──────────────────────────────────────────────────
        for (const imp of e.imports ?? []) {
          importCounter++;

          // Извлекаем specifier (первый или единственный)
          const specifiers = imp.specifiers ?? [];
          const firstSpec =
            specifiers.length > 0 && typeof specifiers[0] === 'object' ? specifiers[0] : null;

          imports.push({
            id: `i${importCounter}`,
            fromFileId: fileId,
            toFileId: null,
            source: imp.source ?? '',
            localName: firstSpec?.local ?? '',
            importedName: firstSpec?.imported ?? '',
            isExternal: false,
            line: imp.loc?.start?.line ?? 0,
          });
        }

        // ──────────────────────────────────────────────────
        // Exports
        // ──────────────────────────────────────────────────
        for (const exp of e.exports ?? []) {
          exportCounter++;
          exports.push({
            id: `e${exportCounter}`,
            fileId,
            exportName: exp.name ?? '',
          });
        }
      }

      if (templates.size === 0) {
        if (options.verbose) {
          console.log('   ⏭️  Нет templates — пропуск');
        }
        return ctx;
      }

      // ──────────────────────────────────────────────────────
      // Шаг 3: Собираем AST для Vue-файлов
      // ──────────────────────────────────────────────────────
      const scriptASTs = new Map<string, { ast: any; sourceFile: any }>();

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

      for (const [fileId, file] of files) {
        if (!file.path.endsWith('.vue')) continue;

        const absPath = file.absolutePath;
        if (!fs.existsSync(absPath)) continue;

        try {
          const content = fs.readFileSync(absPath, 'utf-8');

          // Извлекаем <script setup> (или <script>)
          const setupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
          const basicMatch = content.match(/<script(?![^>]*\bsetup\b)[^>]*>([\s\S]*?)<\/script>/);

          const scriptContent = setupMatch?.[1] ?? basicMatch?.[1] ?? '';

          if (!scriptContent.trim()) continue;

          // Создаём in-memory SourceFile через ts-morph
          const virtualPath = `${absPath}.__script__.ts`;
          const sourceFile = tsProject.createSourceFile(virtualPath, scriptContent, {
            overwrite: true,
          });

          scriptASTs.set(fileId, {
            ast: sourceFile,
            sourceFile,
          });
        } catch (err) {
          if (options.verbose) {
            console.warn(
              `   ⚠️  Не удалось распарсить ${file.path}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }

      if (options.verbose) {
        console.log(`   📊 AST собрано: ${scriptASTs.size} Vue-файлов`);
      }

      // ──────────────────────────────────────────────────────
      // Шаг 4: Запускаем relation-resolver
      // ──────────────────────────────────────────────────────
      const result: ResolveResult = runRelationResolver({
        files,
        templates,
        functions,
        imports,
        exports,
        scriptASTs,
        debug: options.verbose === true,
      });

      const stats = result.stats;

      // ──────────────────────────────────────────────────────
      // Шаг 5: Записываем обогащённые templates обратно
      //         в ctx.enhancedMap (по filePath, а не fileId)
      // ──────────────────────────────────────────────────────
      // Строим обратный маппинг: fileId → filePath (relative)
      const fileIdToPath = new Map<string, string>();
      for (const [fileId, file] of files) {
        fileIdToPath.set(fileId, file.path);
      }

      for (const [fileId, template] of result.templates) {
        const relativePath = fileIdToPath.get(fileId);
        if (!relativePath) continue;

        // Ищем ключ в enhancedMap
        for (const key of Object.keys(ctx.enhancedMap)) {
          const normalizedKey = key.replace(/\\/g, '/');
          const normalizedPath = relativePath.replace(/\\/g, '/');

          const matches =
            normalizedKey === normalizedPath ||
            normalizedKey.endsWith('/' + normalizedPath) ||
            normalizedPath.endsWith('/' + normalizedKey);

          if (!matches) continue;

          const enhanced = ctx.enhancedMap[key] as any;
          if (!enhanced) break;

          // ✅ Обогащаем базовые поля
          enhanced.templateRefs = template.templateRefs;
          enhanced.templateEventHandlers = template.eventHandlers;
          enhanced.templateDynamicComponents = template.dynamicComponents;

          // ✅ Обогащаем relation-поля
          enhanced.templateRefCalls = template.refCalls;
          enhanced.templateLocalBindings = template.localBindings;
          enhanced.templateExposedMethods = template.exposedMethods;
          enhanced.templateProps = template.props;
          enhanced.templateModels = template.models;
          enhanced.templateSlotDefinitions = template.slotDefinitions;
          enhanced.templateOptions = template.options;

          // ✅ Emits — опциональное поле в TemplateRecord
          if (template.emits) {
            enhanced.templateEmits = template.emits;
          }

          // ✅ v-model bindings
          if (template.vModels) {
            enhanced.templateVModels = template.vModels;
          }

          // ✅ Dynamic components с resolvedComponents
          enhanced.templateDynamicComponents = template.dynamicComponents;

          break;
        }
      }

      // ──────────────────────────────────────────────────────
      // Шаг 6: Обновляем метрики
      // ──────────────────────────────────────────────────────
      ctx.metrics.relationsResolved = {
        refCalls: stats.refCallsResolved,
        eventHandlers: stats.eventHandlersResolved,
        composables: stats.composablesResolved,
        localBindings: stats.localBindings,
        props: stats.propsResolved,
        emits: stats.emitsResolved,
        vModels: stats.vModelsResolved,
        dynamicComponents: stats.dynamicComponentsResolved,
        stores: stats.storesResolved,
        routes: stats.routesResolved,
        directives: stats.directivesResolved,
      };

      if (options.verbose) {
        console.log('   ✅ Relations resolved');
      }
    } catch (error) {
      // ────────────────────────────────────────────────────────
      // Обработка ошибки stage
      // ────────────────────────────────────────────────────────
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      ctx.errors.push({
        file: '<resolve-relations>',
        stage: this.name,
        message,
        stack,
      });

      if (options.verbose) {
        console.warn(`   ⚠️  Relation resolver failed: ${message}`);
      }

      // При continueOnError: false — прерываем pipeline
      if (!options.continueOnError) {
        throw new StageError(this.name, 'Relation resolver прерван', undefined, error);
      }
    }

    return ctx;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default ResolveRelationsStage;
