// src/reporters/compact/entities/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ВХОДА ПОДСИСТЕМЫ ENTITIES
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Это фасад подсистемы `entities/`, которая содержит
// вспомогательные функции для работы с сущностями
// (functions/classes/constants/exports/imports) во время
// сборки FullJSON.
//
// Подсистема НЕ содержит логики проходов (pass-1..pass-6) —
// только чистые функции, которые эти проходы используют.
//
// ════════════════════════════════════════════════════════════
// СОСТАВ ПОДСИСТЕМЫ
// ════════════════════════════════════════════════════════════
//
//   entities/
//     ├── index.ts           ← ЭТОТ ФАЙЛ (единая точка входа)
//     └── imports.ts         ← resolveToFileId, getImportTypeFromSpecifierType
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ ТОЛЬКО ИМПОРТЫ
// ════════════════════════════════════════════════════════════
//
//   В процессе декомпозиции compact-reporter.ts (v16.2.0)
//   логика конвертации сущностей (functions/classes/constants/
//   exports) была распределена по проходам pass-1..pass-2,
//   потому что эти проходы тесно связаны с контекстом
//   (moduleMap, fileMap, functionMap, счётчики).
//
//   Вынесение их в отдельные модули entities/functions.ts,
//   entities/classes.ts и т.д. потребовало бы передачи
//   огромного количества параметров, что усложнило бы код
//   без выигрыша в читаемости.
//
//   Поэтому в подсистеме `entities/` живут ТОЛЬКО чистые
//   функции, не зависящие от контекста:
//     • resolveToFileId                — резолвинг пути импорта в fileId
//     • getImportTypeFromSpecifierType — маппинг типа specifier
//
//   Обе используются в pass-2-exports.ts.
//
// ════════════════════════════════════════════════════════════
// ЭКСПОРТЫ
// ════════════════════════════════════════════════════════════
//
//   1. resolveToFileId(source, fromFilePath, sourceToFileIdMap, fileMap)
//      Резолвит путь импорта в fileId.
//      Поддерживает:
//        • прямые совпадения (по relativePath, basename, noExt)
//        • алиасы из tsconfig (@/, ~/, #/)
//        • относительные пути (./, ../)
//        • внешние пакеты (@scope/pkg, lodash, ...)
//      Возвращает:
//        • 'f1', 'f2', ... — локальный файл
//        • 'external:pkg'  — внешний пакет
//        • null            — не удалось резолвить
//
//   2. getImportTypeFromSpecifierType(specifierType)
//      Маппинг типа AST-узла specifier в тип ImportData:
//        • 'ImportDefaultSpecifier'   → 'default'
//        • 'ImportNamespaceSpecifier' → 'namespace'
//        • 'ExportAllSpecifier'       → 'namespace'
//        • 'ImportSpecifier'          → 'named'
//        • 'ExportSpecifier'          → 'named'
//        • default                    → 'named'
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import {
//     resolveToFileId,
//     getImportTypeFromSpecifierType,
//   } from './reporters/compact/entities/index.js';
//
//   // В pass-2-exports.ts:
//   const toFileId = resolveToFileId(
//     imp.source,
//     filePath,
//     ctx.sourceToFileIdMap,
//     ctx.fileMap
//   );
//
//   const importType = getImportTypeFromSpecifierType(spec.type);
//
// ════════════════════════════════════════════════════════════
// ИЕРАРХИЯ ВЫЗОВОВ
// ════════════════════════════════════════════════════════════
//
//   compact/index.ts
//     │
//     └── compact/pipeline/index.ts
//         │
//         └── compact/pipeline/pass-2-exports.ts
//             │
//             └── compact/entities/index.ts  ← ЭТОТ ФАЙЛ
//                 │
//                 └── compact/entities/imports.ts
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ./imports.ts                            — реализация
//   - ../pipeline/pass-2-exports.ts           — единственный потребитель
//   - ../../../core/ast-parser.ts             — resolveFilePath
//   - ../../../core/tsconfig-resolver.ts      — loadTsConfig, resolveAliasPath
//   - ../../codec/codec-types.ts              — FileData
// ============================================

// ============================================================
// 1. РЕЗОЛВИНГ ПУТИ ИМПОРТА В FILEID
// ============================================================
// Используется в pass-2-exports.ts для заполнения
// ImportData.toFileId и ImportData.isExternal.
//
// Логика приоритетов:
//   1. Прямое совпадение source в sourceToFileIdMap
//   2. Алиасы из tsconfig (@/, ~/, #/)
//   3. Относительные пути (./, ../)
//   4. Basename / noExt
//   5. Внешние пакеты (@scope/pkg, lodash, ...)
//   6. null (не удалось резолвить)
// ============================================================

export {
    /**
     * Резолвит путь импорта в fileId.
     *
     * @param source            — путь из import (например, '@/components/Button')
     * @param fromFilePath      — путь к файлу-импортёру
     * @param sourceToFileIdMap — карта { relativePath|basename|noExt → fileId }
     * @param fileMap           — карта { relativePath → FileData }
     * @returns fileId ('f1', 'f2', ...) | 'external:pkg' | null
     */
        resolveToFileId,
} from './imports.js';

// ============================================================
// 2. МАППИНГ ТИПА SPECIFIER
// ============================================================
// Используется в pass-2-exports.ts для заполнения
// ImportData.type.
//
// Возвращает один из трёх типов:
//   - 'named'     — именованный импорт (import { a })
//   - 'default'   — импорт по умолчанию (import a)
//   - 'namespace' — namespace-импорт (import * as a)
// ============================================================

export {
    /**
     * Маппинг AST-типа specifier в ImportData.type.
     *
     * @param specifierType — 'ImportSpecifier' | 'ImportDefaultSpecifier'
     *                        | 'ImportNamespaceSpecifier' | 'ExportAllSpecifier'
     *                        | 'ExportSpecifier' | иное
     * @returns 'named' | 'default' | 'namespace'
     */
        getImportTypeFromSpecifierType,
} from './imports.js';
