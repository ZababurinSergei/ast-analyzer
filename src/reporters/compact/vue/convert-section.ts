// src/reporters/compact/vue/convert-section.ts
// ============================================================
// КОНВЕРТЕР VUE-СУЩНОСТЕЙ
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Преобразует VueEntities (результат classifyVueEntities из
// core/vue-entity-classifier.ts) в VueSectionFull (формат
// FullJSON.vue).
//
// Используется в pipeline/pass-5-vue.ts.
//
// ════════════════════════════════════════════════════════════
// ЧТО ВХОДИТ В РЕЗУЛЬТАТ
// ════════════════════════════════════════════════════════════
//
//   Из VueEntities переносятся 6 секций:
//     • sfc         — SFC-компоненты (.vue файлы)
//     • composables — use[A-Z]* функции
//     • macros      — defineProps/defineEmits/...
//     • hooks       — onMounted/onUnmounted/watch
//     • reactivity  — computed/ref/reactive
//     • icons       — components/icons/**
//
//   5 top-level секций инициализируются пустыми []:
//     • componentProps
//     • componentEvents
//     • componentDirectives
//     • componentSlots
//     • htmlInterpolations
//
//   Они будут заполнены в processComponentUsage +
//   fillComponentAccumulators (v16.1.0).
//
//   sfc[].componentUsages и sfc[].htmlElements тоже
//   инициализируются пустыми [].
//
// ════════════════════════════════════════════════════════════
// РЕЗОЛВИНГ FILEID / MODULEID
// ════════════════════════════════════════════════════════════
//
//   В VueEntities.fileId — это АБСОЛЮТНЫЙ путь к файлу
//   (заполняется в core/vue-entity-classifier.ts).
//
//   В VueSectionFull.fileId — это короткий ID (f1, f2, ...).
//
//   Поэтому мы резолвим:
//     1. absolutePath = path.resolve(filePath)
//     2. relativePath = path.relative(projectRoot, absolutePath)
//                       .replace(/\\/g, '/')
//     3. file = fileMap.get(relativePath)
//     4. fileId = file?.id ?? 'f1'  (fallback для edge-кейсов)
//
//   moduleId резолвится так же — через file.moduleId.
//   Если файл не найден в fileMap — fallback 'm1'.
//
// ════════════════════════════════════════════════════════════
// ПРИМЕР
// ════════════════════════════════════════════════════════════
//
//   vueEntities = {
//     sfc: [
//       { fileId: '/abs/src/App.vue', name: 'App', blocks: 6,
//         composables: ['useDataState'], props: [], emits: [], exposed: [] },
//     ],
//     composables: [
//       { id: 'fn1', name: 'useDataState', fileId: '/abs/src/useData.ts',
//         kind: 'composable', returnShape: 'object',
//         returnedKeys: ['data'], callers: ['/abs/src/App.vue'] },
//     ],
//     macros: [], hooks: [], reactivity: [], icons: [],
//   }
//
//   fileMap = Map {
//     'src/App.vue'     => { id: 'f18', moduleId: 'm3', ... },
//     'src/useData.ts'  => { id: 'f19', moduleId: 'm3', ... },
//   }
//
//   convertVueEntitiesToFull(vueEntities, fileMap, projectRoot)
//   // → {
//   //     sfc: [
//   //       { fileId: 'f18', moduleId: 'm3', name: 'App', blocks: 6,
//   //         composables: ['useDataState'], props: [], emits: [], exposed: [],
//   //         componentUsages: [], htmlElements: [] },
//   //     ],
//   //     composables: [
//   //       { id: 'fn1', name: 'useDataState', fileId: 'f19',
//   //         kind: 'composable', returnShape: 'object',
//   //         returnedKeys: ['data'], callers: ['f18'] },
//   //     ],
//   //     macros: [], hooks: [], reactivity: [], icons: [],
//   //     componentProps: [], componentEvents: [],
//   //     componentDirectives: [], componentSlots: [],
//   //     htmlInterpolations: [],
//   //   }
// ============================================================

import path from 'path';
import type { FileData, VueSectionFull } from '../../codec/codec-types.js';
import type { VueEntities } from '../../../core/vue-entity-classifier.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Конвертация VueEntities → VueSectionFull.
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   vueEntities — результат classifyVueEntities(entitiesMap)
 *   fileMap     — Map<relativePath, FileData>
 *   projectRoot — корень проекта (для резолва путей)
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создать вспомогательные функции:
 *      • resolveFileId(filePath)   — абсолютный путь → f1/f2/...
 *      • resolveModuleId(filePath) — абсолютный путь → m1/m2/...
 *
 *   2. Сконвертировать 6 секций VueEntities:
 *      a. sfc[]        — резолв fileId/moduleId + пустые cu/he
 *      b. composables[] — резолв fileId/callers[]
 *      c. macros[]      — резолв fileId
 *      d. hooks[]       — резолв fileId
 *      e. reactivity[]  — резолв fileId
 *      f. icons[]       — резолв fileId + специальная обработка id
 *
 *   3. Инициализировать 5 top-level секций пустыми []:
 *      • componentProps, componentEvents, componentDirectives,
 *        componentSlots, htmlInterpolations
 *
 *   4. Вернуть VueSectionFull.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ FALLBACK 'f1' / 'm1'
 * ════════════════════════════════════════════════════════════
 *
 *   В норме все .vue файлы из VueEntities должны быть в fileMap,
 *   потому что pass-1-modules собрал все файлы из entitiesMap.
 *
 *   Но есть edge-кейсы:
 *     • файл удалён между pass-1 и pass-5 (редко);
 *     • путь не совпал из-за разных разделителей;
 *     • .vue файл исключён из fileMap по паттерну.
 *
 *   Чтобы не упасть с TypeError, используем fallback 'f1' / 'm1'.
 *   Это не оптимально, но безопасно.
 *
 * ════════════════════════════════════════════════════════════
 * ОСОБЕННОСТЬ ОБРАБОТКИ icons[].id
 * ════════════════════════════════════════════════════════════
 *
 *   В оригинале была строка:
 *     id: resolveFileId(i.fileId) ? `ic${i.id}` : i.id
 *
 *   resolveFileId всегда возвращает строку (в том числе 'f1'),
 *   так что условие всегда truthy, и id всегда имеет вид
 *   'ic<originalId>'. Это выглядит как баг, но мы сохраняем
 *   поведение 1:1 для 100% совместимости.
 */
export function convertVueEntitiesToFull(
    vueEntities: VueEntities,
    fileMap: Map<string, FileData>,
    projectRoot: string
): VueSectionFull {
    // ────────────────────────────────────────────────────────
    // 1. Вспомогательные функции
    // ────────────────────────────────────────────────────────

    /**
     * Резолвит абсолютный путь в короткий fileId (f1, f2, ...).
     * Fallback — 'f1', если файл не найден в fileMap.
     */
    const resolveFileId = (filePath: string): string => {
        const absolutePath = path.resolve(filePath);
        const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
        const file = fileMap.get(relativePath);
        return file?.id ?? 'f1';
    };

    /**
     * Резолвит абсолютный путь в moduleId (m1, m2, ...).
     * Fallback — 'm1'.
     *
     * Использует resolveFileId для получения fileId, затем ищет
     * соответствующий FileData в fileMap.
     */
    const resolveModuleId = (filePath: string): string => {
        const fileId = resolveFileId(filePath);
        for (const [, f] of fileMap) {
            if (f.id === fileId) return f.moduleId;
        }
        return 'm1';
    };

    // ────────────────────────────────────────────────────────
    // 2. Конвертация секций
    // ────────────────────────────────────────────────────────

    return {
        // ======================================================
        // 2a. SFC
        // ======================================================
        // Для каждого SFC:
        //   • резолвим fileId/moduleId
        //   • сохраняем name, blocks, composables, props, emits, exposed
        //   • инициализируем componentUsages и htmlElements как []
        //     (заполняются в processComponentUsage)
        sfc: (vueEntities.sfc ?? []).map(s => ({
            fileId: resolveFileId(s.fileId),
            moduleId: resolveModuleId(s.fileId),
            name: s.name,
            blocks: s.blocks,
            composables: s.composables ?? [],
            props: s.props ?? [],
            emits: s.emits ?? [],
            exposed: s.exposed ?? [],
            componentUsages: [],
            htmlElements: [],
        })),

        // ======================================================
        // 2b. Composables
        // ======================================================
        // Для каждого composable:
        //   • резолвим fileId
        //   • резолвим callers[] через resolveFileId
        composables: (vueEntities.composables ?? []).map(c => ({
            id: c.id,
            name: c.name,
            fileId: resolveFileId(c.fileId),
            kind: c.kind,
            returnShape: c.returnShape,
            returnedKeys: c.returnedKeys ?? [],
            callers: (c.callers ?? []).map(resolveFileId),
        })),

        // ======================================================
        // 2c. Macros
        // ======================================================
        macros: (vueEntities.macros ?? []).map(m => ({
            id: m.id,
            fileId: resolveFileId(m.fileId),
            kind: m.kind,
            line: m.line,
        })),

        // ======================================================
        // 2d. Hooks
        // ======================================================
        hooks: (vueEntities.hooks ?? []).map(h => ({
            id: h.id,
            fileId: resolveFileId(h.fileId),
            hookName: h.hookName,
            line: h.line,
        })),

        // ======================================================
        // 2e. Reactivity
        // ======================================================
        reactivity: (vueEntities.reactivity ?? []).map(r => ({
            id: r.id,
            fileId: resolveFileId(r.fileId),
            kind: r.kind,
            line: r.line,
            name: r.name,
        })),

        // ======================================================
        // 2f. Icons
        // ======================================================
        // ⚠️ Сохраняем оригинальное поведение: id = `ic${i.id}`,
        //    потому что resolveFileId всегда возвращает непустую
        //    строку (в том числе fallback 'f1').
        icons: (vueEntities.icons ?? []).map(i => ({
            id: resolveFileId(i.fileId) ? `ic${i.id}` : i.id,
            fileId: resolveFileId(i.fileId),
            name: i.name,
            category: i.category,
        })),

        // ======================================================
        // 3. Top-level component*-секции (v16.0.4)
        // ======================================================
        // ВСЕГДА присутствуют (даже пустые []), симметрично
        // codec-decode.ts v16.0.4.
        //
        // Реальные значения заполняются в pass-5-vue.ts
        // через fillComponentAccumulators.
        componentProps: [],
        componentEvents: [],
        componentDirectives: [],
        componentSlots: [],
        htmlInterpolations: [],
    };
}
