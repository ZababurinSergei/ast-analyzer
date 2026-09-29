// src/reporters/compact/entities/imports.ts
// ============================================
// РЕЗОЛВИНГ ПУТЕЙ ИМПОРТА И ТИПОВ SPECIFIER
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// ИСТОРИЯ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (РЕФАКТОРИНГ: выделено из compact-reporter.ts):
//   - ✅ Функция resolveToFileId перенесена из монолитного
//     compact-reporter.ts (v16.1.0) БЕЗ изменений логики.
//   - ✅ Функция getImportTypeFromSpecifierType перенесена
//     без изменений.
//   - ✅ Импорты идут из core/:
//       • ../../../core/ast-parser.js   — resolveFilePath
//       • ../../../core/tsconfig-resolver.js — loadTsConfig,
//                                              resolveAliasPath,
//                                              getTsConfigDir
//       • ../../codec/codec-types.js    — FileData
//   - ✅ Публичный API НЕ ИЗМЕНИЛСЯ.
//   - ✅ Поведение 1:1 с v16.1.0.
//
// v15.0.6 (было в compact-reporter.ts):
//   - resolveToFileId: TF — индекс в fl.p.
//
// v15.0.4:
//   - getImportTypeFromSpecifierType: поддержка ExportSpecifier.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
// Модуль содержит две чистые функции для работы с импортами:
//
//   1. resolveToFileId(source, fromFilePath, sourceToFileIdMap, fileMap)
//        Резолвит путь импорта в fileId или маркер внешнего пакета.
//        Вызывается в pass-2-exports.ts для заполнения
//        ImportData.toFileId и ImportData.isExternal.
//
//   2. getImportTypeFromSpecifierType(specifierType)
//        Маппинг AST-типа specifier в ImportData.type.
//        Вызывается в pass-2-exports.ts для заполнения
//        ImportData.type.
//
// Обе функции НЕ зависят от CollectContext — принимают всё,
// что им нужно, через параметры. Это делает их тестируемыми
// изолированно.
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ resolveToFileId — ПОШАГОВО
// ════════════════════════════════════════════════════════════
//
//   Шаг 1: Прямое совпадение в sourceToFileIdMap
//     - по source
//     - по normalizedSource (с заменой \ на /)
//     Если найдено → возврат fileId.
//
//   Шаг 2: Алиасы (@/, ~/, #/, @scope/...)
//     - если source похож на алиас → пробуем tsconfig.resolveAliasPath
//     - ищем результат в sourceToFileIdMap:
//       • по абсолютному пути
//       • по basename
//       • по имени без расширения
//       • по суффиксу пути в fileMap
//     Если найдено → возврат fileId.
//
//   Шаг 3: Относительные пути (./, ../)
//     - resolveFilePath(baseDir, source) → абсолютный путь
//     - ищем в sourceToFileIdMap / fileMap
//     Если найдено → возврат fileId.
//
//   Шаг 4: Basename / noExt
//     - по basename(source)
//     - по имени без расширения
//     Если найдено → возврат fileId.
//
//   Шаг 5: Внешние пакеты
//     - если source НЕ начинается с . → это внешний пакет
//     - вычисляем pkg:
//       • @scope/pkg → '@scope/pkg'
//       • lodash     → 'lodash'
//     - возврат 'external:pkg'.
//
//   Шаг 6: Fallback
//     - возврат null.
//
// ════════════════════════════════════════════════════════════
// ПОЧЕМУ ТАК СЛОЖНО
// ════════════════════════════════════════════════════════════
//
//   В реальных проектах import может указывать на файл
//   разными способами:
//
//     import { a } from './foo';              // относительный
//     import { a } from '../foo';             // относительный
//     import { a } from '@/foo/bar';          // алиас tsconfig
//     import { a } from '~/foo';              // алиас
//     import { a } from '#/foo';              // алиас
//     import { a } from 'foo';                // внешний пакет
//     import { a } from '@scope/pkg';         // внешний scoped
//     import { a } from './foo.js';           // ESM с расширением
//     import { a } from './foo/index.js';     // ESM index
//     import { a } from './foo/';             // директория
//
//   Все эти случаи нужно нормализовать к одному из трёх
//   исходов:
//     • 'f1', 'f2', ...     — локальный файл
//     • 'external:pkg'      — внешний пакет
//     • null                — не удалось
//
//   resolveToFileId последовательно пробует все варианты
//   от самых точных (прямое совпадение) до самых общих
//   (basename без расширения).
//
// ════════════════════════════════════════════════════════════
// ПРИМЕРЫ resolveToFileId
// ════════════════════════════════════════════════════════════
//
//   // sourceToFileIdMap содержит:
//   //   'src/utils/helpers.ts' → 'f1'
//   //   'src/utils/helpers'    → 'f1'
//   //   'helpers'              → 'f1'
//
//   // 1. Прямое совпадение
//   resolveToFileId('src/utils/helpers', ...)  // → 'f1'
//
//   // 2. Относительный путь
//   // (при fromFilePath = 'src/index.ts', source = './utils/helpers')
//   resolveToFileId('./utils/helpers', ...)    // → 'f1'
//
//   // 3. Алиас через tsconfig
//   resolveToFileId('@/utils/helpers', ...)    // → 'f1'
//
//   // 4. Basename
//   resolveToFileId('helpers', ...)            // → 'f1'
//
//   // 5. Внешний пакет
//   resolveToFileId('lodash', ...)             // → 'external:lodash'
//   resolveToFileId('@vue/runtime-core', ...)  // → 'external:@vue/runtime-core'
//
//   // 6. Не удалось
//   resolveToFileId('unknown', ...)            // → 'external:unknown'
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ МОДУЛИ
// ════════════════════════════════════════════════════════════
//
//   - ../../../core/ast-parser.ts          — resolveFilePath
//   - ../../../core/tsconfig-resolver.ts   — loadTsConfig,
//                                             resolveAliasPath,
//                                             getTsConfigDir
//   - ../../codec/codec-types.ts           — FileData
//   - ../pipeline/pass-2-exports.ts        — единственный потребитель
// ============================================

import path from 'path';

import { resolveFilePath } from '../../../core/ast-parser.js';
import {
    loadTsConfig,
    resolveAliasPath,
    getTsConfigDir,
} from '../../../core/tsconfig-resolver.js';

import type { FileData } from '../../codec/codec-types.js';

// ============================================================
// 1. РЕЗОЛВИНГ ПУТИ ИМПОРТА В FILEID
// ============================================================

/**
 * Резолвит путь импорта в fileId или маркер внешнего пакета.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Прямое совпадение source в sourceToFileIdMap.
 *   2. Алиасы tsconfig (@/, ~/, #/) через resolveAliasPath.
 *   3. Относительные пути (./, ../) через resolveFilePath.
 *   4. Basename / noExt.
 *   5. Внешние пакеты → 'external:pkg'.
 *   6. null (не удалось резолвить).
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМЫЕ ЗНАЧЕНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - 'f1', 'f2', ...      — локальный файл (есть в fileMap)
 *   - 'external:pkg'       — внешний пакет (@scope/pkg, lodash)
 *   - null                 — не удалось резолвить
 *
 * ════════════════════════════════════════════════════════════
 * ВАЖНО ПРО sourceToFileIdMap
 * ════════════════════════════════════════════════════════════
 *
 *   sourceToFileIdMap заполняется в pass1Modules (см. context.ts).
 *   Для каждого файла туда кладутся 9 ключей:
 *     - filePath (абсолютный)
 *     - relativePath
 *     - normalizedPath (с /)
 *     - absolutePath
 *     - normalizedAbs
 *     - basename
 *     - basenameWithoutExt
 *     - relativePathWithoutExt
 *     - и др.
 *
 *   Это сделано, чтобы resolveToFileId мог быстро находить
 *   fileId по любому варианту пути без дополнительного
 *   сканирования fileMap.
 *
 * ════════════════════════════════════════════════════════════
 * ПРОИЗВОДИТЕЛЬНОСТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   Типичный случай (прямое совпадение) — O(1).
 *   Алиасы — O(K), где K = число paths в tsconfig (обычно < 20).
 *   Относительные пути — O(E), где E = число расширений (7).
 *   Basename — O(1).
 *   Fallback в fileMap — O(N), где N = число файлов
 *     (выполняется только если все предыдущие шаги не сработали).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // В pass-2-exports.ts:
 *   const toFileId = resolveToFileId(
 *     imp.source,          // '@/components/Button'
 *     filePath,            // '/abs/src/App.vue'
 *     ctx.sourceToFileIdMap,
 *     ctx.fileMap
 *   );
 *   // → 'f42' или 'external:pkg' или null
 *
 * @param source            — путь из import (например, '@/components/Button')
 * @param fromFilePath      — путь к файлу-импортёру (абсолютный)
 * @param sourceToFileIdMap — карта { относительный|абсолютный|basename → fileId }
 * @param fileMap           — карта { relativePath → FileData }
 * @returns fileId ('f1', 'f2', ...) | 'external:pkg' | null
 */
export function resolveToFileId(
    source: string,
    fromFilePath: string,
    sourceToFileIdMap: Map<string, string>,
    fileMap: Map<string, FileData>
): string | null {
    // ────────────────────────────────────────────────────────
    // Шаг 1: Прямое совпадение
    // ────────────────────────────────────────────────────────
    const direct = sourceToFileIdMap.get(source);
    if (direct) return direct;

    const normalizedSource = source.replace(/\\/g, '/');
    const directNormalized = sourceToFileIdMap.get(normalizedSource);
    if (directNormalized) return directNormalized;

    // ────────────────────────────────────────────────────────
    // Шаг 2: Алиасы tsconfig
    // ────────────────────────────────────────────────────────
    const isAliasLike =
        source.startsWith('@/') ||
        source.startsWith('#/') ||
        source.startsWith('~/') ||
        source.startsWith('@') ||
        source.startsWith('~') ||
        source.startsWith('#');

    if (isAliasLike) {
        try {
            const fromDir = path.dirname(fromFilePath);
            const tsConfigDir = getTsConfigDir();
            const baseDir = tsConfigDir || fromDir;

            const tsConfig = loadTsConfig(baseDir);
            const resolved = resolveAliasPath(source, baseDir, tsConfig);

            if (resolved) {
                const resolvedNormalized = resolved.replace(/\\/g, '/');

                const byAbs =
                    sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
                if (byAbs) return byAbs;

                const resolvedBase = path.basename(resolved);
                const resolvedNoExt = resolvedBase.replace(/\.[^.]+$/, '');

                const byBase = sourceToFileIdMap.get(resolvedBase);
                if (byBase) return byBase;

                const byNoExt = sourceToFileIdMap.get(resolvedNoExt);
                if (byNoExt) return byNoExt;

                // Fallback: суффиксный поиск в fileMap
                for (const [fp, fd] of fileMap) {
                    const fpNormalized = fp.replace(/\\/g, '/');
                    if (
                        fpNormalized === resolvedNormalized ||
                        fpNormalized.endsWith('/' + resolvedNormalized) ||
                        resolvedNormalized.endsWith('/' + fpNormalized)
                    ) {
                        return fd.id;
                    }
                }
            }
        } catch {
            // Игнорируем ошибки loadTsConfig / resolveAliasPath
        }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 3: Относительные пути (./, ../)
    // ────────────────────────────────────────────────────────
    if (source.startsWith('.')) {
        try {
            const fromDir = path.dirname(fromFilePath);
            const resolved = resolveFilePath(fromDir, source);
            if (resolved) {
                const resolvedNormalized = resolved.replace(/\\/g, '/');

                const byAbs =
                    sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
                if (byAbs) return byAbs;

                for (const [fp, fd] of fileMap) {
                    const fpNormalized = fp.replace(/\\/g, '/');
                    if (
                        fpNormalized === resolvedNormalized ||
                        fpNormalized.endsWith('/' + resolvedNormalized) ||
                        resolvedNormalized.endsWith('/' + fpNormalized)
                    ) {
                        return fd.id;
                    }
                }
            }
        } catch {
            // Игнорируем ошибки resolveFilePath
        }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 4: Basename / noExt
    // ────────────────────────────────────────────────────────
    const sourceBasename = path.basename(source);
    const sourceNoExt = sourceBasename.replace(/\.[^.]+$/, '');

    const byBasename = sourceToFileIdMap.get(sourceBasename);
    if (byBasename) return byBasename;

    const byNoExt = sourceToFileIdMap.get(sourceNoExt);
    if (byNoExt) return byNoExt;

    // ────────────────────────────────────────────────────────
    // Шаг 5: Внешние пакеты
    // ────────────────────────────────────────────────────────
    if (!source.startsWith('.')) {
        // Алиасы проекта (@/, ~/, #/) — НЕ внешние пакеты.
        // Если мы дошли сюда, значит алиас не удалось резолвить —
        // возвращаем null (не маскируем под external:).
        const isProjectAlias =
            source.startsWith('@/') ||
            source.startsWith('~/') ||
            source.startsWith('#/') ||
            source === '@' ||
            source === '~' ||
            source === '#';

        if (isProjectAlias) {
            return null;
        }

        // Внешний npm-пакет:
        //   @scope/pkg  → '@scope/pkg'
        //   lodash      → 'lodash'
        //   lodash/fp   → 'lodash'
        const pkg = source.startsWith('@')
            ? source.split('/').slice(0, 2).join('/')
            : source.split('/')[0];

        if (pkg) return `external:${pkg}`;
    }

    // ────────────────────────────────────────────────────────
    // Шаг 6: Fallback
    // ────────────────────────────────────────────────────────
    return null;
}

// ============================================================
// 2. МАППИНГ ТИПА SPECIFIER
// ============================================================

/**
 * Маппинг AST-типа specifier в ImportData.type.
 *
 * ════════════════════════════════════════════════════════════
 * СООТВЕТСТВИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   ┌──────────────────────────────┬──────────────┐
 *   │ AST specifier type           │ ImportData   │
 *   ├──────────────────────────────┼──────────────┤
 *   │ ImportDefaultSpecifier       │ 'default'    │
 *   │ ImportNamespaceSpecifier     │ 'namespace'  │
 *   │ ExportAllSpecifier           │ 'namespace'  │
 *   │ ImportSpecifier              │ 'named'      │
 *   │ ExportSpecifier              │ 'named'      │
 *   │ прочее / undefined           │ 'named'      │
 *   └──────────────────────────────┴──────────────┘
 *
 * ════════════════════════════════════════════════════════════
 * КОНТЕКСТ ИСПОЛЬЗОВАНИЯ
 * ════════════════════════════════════════════════════════════
 *
 *   Функция вызывается в pass-2-exports.ts при обработке
 *   specifiersStructured:
 *
 *     import { foo } from './foo';         // → 'named'
 *     import foo from './foo';             // → 'default'
 *     import * as foo from './foo';        // → 'namespace'
 *     export * from './foo';               // → 'namespace'
 *     export { foo } from './foo';         // → 'named'
 *
 *   Маппинг ExportAllSpecifier → 'namespace' нужен для того,
 *   чтобы реэкспорт `export * from` в графе отображался как
 *   namespace-импорт (аналогично `import * as`).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   getImportTypeFromSpecifierType('ImportDefaultSpecifier')
 *   // → 'default'
 *
 *   getImportTypeFromSpecifierType('ImportNamespaceSpecifier')
 *   // → 'namespace'
 *
 *   getImportTypeFromSpecifierType('ImportSpecifier')
 *   // → 'named'
 *
 *   getImportTypeFromSpecifierType(undefined)
 *   // → 'named' (fallback)
 *
 * @param specifierType — тип AST-узла specifier
 * @returns 'named' | 'default' | 'namespace'
 */
export function getImportTypeFromSpecifierType(
    specifierType: string
): 'named' | 'default' | 'namespace' {
    switch (specifierType) {
        case 'ImportDefaultSpecifier':
            return 'default';

        case 'ImportNamespaceSpecifier':
        case 'ExportAllSpecifier':
            return 'namespace';

        case 'ImportSpecifier':
        case 'ExportSpecifier':
        default:
            return 'named';
    }
}
