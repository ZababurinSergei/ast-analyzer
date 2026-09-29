// src/reporters/compact/persistence/path-utils.ts
// ============================================================
// УТИЛИТЫ РАБОТЫ С ПУТЯМИ ДЛЯ СОХРАНЕНИЯ ОТЧЁТОВ (v1.0.0)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Хелперы для формирования имён файлов отчётов:
//   - .full.json — полный JSON рядом со сжатым
//   - .edges.json — отдельный файл с рёбрами графа
//
// ════════════════════════════════════════════════════════════
// ЗАЧЕМ ЭТИ ФУНКЦИИ
// ════════════════════════════════════════════════════════════
//
//   Пользователь передаёт outputPath для компактного отчёта,
//   например: ./dist/index.json
//
//   Нужно получить:
//     ./dist/index.full.json   ← полный JSON
//     ./dist/index.edges.json  ← рёбра графа
//
//   Простое `filePath + suffix` не работает:
//     './dist/index.json' + '.full.json' = './dist/index.json.full.json'  ← плохо
//
//   Нужно вставить суффикс ПЕРЕД расширением:
//     './dist/index' + '.full' + '.json' = './dist/index.full.json'       ← хорошо
//
// ════════════════════════════════════════════════════════════
// ЗАЩИТА ОТ КОЛЛИЗИЙ
// ════════════════════════════════════════════════════════════
//
//   Если пользователь передал `./index.json` и суффикс `.json`,
//   то после вставки может получиться `./index.json` — то же имя.
//   В этом случае вызывается insertUniqueSuffix, который добавит
//   числовой суффикс `.2`, `.3`, ... или timestamp.
//
//   Также insertUniqueSuffix используется если файл уже существует
//   и его нельзя перезаписать.
// ============================================================

import path from 'path';
import fs from 'fs';

// ============================================================
// 1. ВСТАВКА СУФФИКСА ПЕРЕД РАСШИРЕНИЕМ
// ============================================================

/**
 * Вставляет суффикс ПЕРЕД расширением файла.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Разделить filePath на base + ext.
 *   2. Нормализовать суффикс:
 *      • обрезать пробелы
 *      • добавить точку в начало, если её нет
 *      • убрать ext из суффикса, если он там есть
 *        ('.full.json' → '.full')
 *   3. Собрать: base + suffix + ext.
 *   4. Если результат совпадает с исходным путём — вызвать
 *      insertUniqueSuffix (защита от коллизии).
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   insertSuffixBeforeExtension('./index.json', '.full.json')
 *     // './index.full.json'
 *
 *   insertSuffixBeforeExtension('./index.json', 'full')
 *     // './index.full.json'
 *
 *   insertSuffixBeforeExtension('./index.json', '.full')
 *     // './index.full.json'
 *
 *   insertSuffixBeforeExtension('./index.json', '.json')
 *     // './index.json'  → коллизия → './index.2.json'
 *
 *   insertSuffixBeforeExtension('./index', '.full.json')
 *     // './index.full'
 *
 *   insertSuffixBeforeExtension('./index.ts', '.full.json')
 *     // './index.full.ts'
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ УБИРАТЬ EXT ИЗ СУФФИКСА
 * ════════════════════════════════════════════════════════════
 *
 *   Пользователь может передать суффикс как '.full.json'
 *   (полное имя). Если его не нормализовать, получится:
 *     './index.json' + '.full.json' = './index.full.json.json'  ← плохо
 *
 *   Нормализация убирает '.json' из суффикса:
 *     suffixWithoutExt = '.full'
 *     './index' + '.full' + '.json' = './index.full.json'       ← хорошо
 *
 * @param filePath — исходный путь (например, './index.json')
 * @param suffix   — суффикс (например, '.full.json')
 * @returns путь с суффиксом перед расширением
 */
export function insertSuffixBeforeExtension(filePath: string, suffix: string): string {
    const ext = path.extname(filePath);
    const base = filePath.slice(0, -ext.length);

    let normalizedSuffix = suffix.trim();
    if (!normalizedSuffix) {
        return insertUniqueSuffix(filePath, suffix);
    }
    if (!normalizedSuffix.startsWith('.')) {
        normalizedSuffix = `.${normalizedSuffix}`;
    }

    let suffixWithoutExt = normalizedSuffix;
    if (suffixWithoutExt.endsWith(ext) && ext.length > 0) {
        suffixWithoutExt = suffixWithoutExt.slice(0, -ext.length);
    }

    const result = `${base}${suffixWithoutExt}${ext}`;

    if (path.resolve(result) === path.resolve(filePath)) {
        return insertUniqueSuffix(filePath, suffix);
    }

    return result;
}

// ============================================================
// 2. ВСТАВКА УНИКАЛЬНОГО СУФФИКСА
// ============================================================

/**
 * Генерирует уникальное имя файла с суффиксом.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Нормализовать суффикс (как в insertSuffixBeforeExtension).
 *   2. Попробовать '.2', '.3', ... до 999:
 *      • собрать base + suffix + '.' + i + ext
 *      • проверить, что не совпадает с исходным путём
 *      • проверить, что файл не существует
 *   3. Если все заняты — использовать timestamp:
 *      base + suffix + '.' + Date.now() + ext
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // Если './index.2.json' не существует:
 *   insertUniqueSuffix('./index.json', '.full')
 *     // './index.full.2.json'
 *
 *   // Если существуют './index.full.2.json', ..., './index.full.5.json':
 *   insertUniqueSuffix('./index.json', '.full')
 *     // './index.full.6.json'
 *
 *   // Если все 999 заняты (маловероятно):
 *   insertUniqueSuffix('./index.json', '.full')
 *     // './index.full.1703123456789.json'
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ ПРОВЕРКА path.resolve(candidate) !== path.resolve(filePath)
 * ════════════════════════════════════════════════════════════
 *
 *   Если суффикс пустой, base + suffix + '.' + i + ext может
 *   случайно совпасть с исходным файлом. Такое совпадение
 *   приведёт к перезаписи — это недопустимо.
 *
 * @param filePath — исходный путь
 * @param suffix   — суффикс (может быть пустым)
 * @returns уникальный путь
 */
export function insertUniqueSuffix(filePath: string, suffix: string): string {
    const ext = path.extname(filePath);
    const base = filePath.slice(0, -ext.length);

    let normalizedSuffix = suffix.trim();
    if (normalizedSuffix && !normalizedSuffix.startsWith('.')) {
        normalizedSuffix = `.${normalizedSuffix}`;
    }
    if (normalizedSuffix.endsWith(ext) && ext.length > 0) {
        normalizedSuffix = normalizedSuffix.slice(0, -ext.length);
    }

    for (let i = 2; i < 1000; i++) {
        const candidate = `${base}${normalizedSuffix}.${i}${ext}`;
        if (path.resolve(candidate) !== path.resolve(filePath)) {
            if (!fs.existsSync(candidate)) {
                return candidate;
            }
        }
    }

    const timestamp = Date.now();
    return `${base}${normalizedSuffix}.${timestamp}${ext}`;
}
