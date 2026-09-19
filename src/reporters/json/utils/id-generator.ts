// packages/ast-analyzer/src/reporters/json/utils/id-generator.ts

import path from 'path';
import { createHash } from 'crypto';

// ============================================================
// ГЕНЕРАТОРЫ СТАБИЛЬНЫХ ID ДЛЯ JSON-РЕПОРТОВ
// ============================================================
//
// Назначение:
//   - `simpleHash`          — быстрый 32-битный хеш строки в base36
//   - `generateFileId`      — стабильный ID файла на основе пути
//   - `generateFunctionId`  — стабильный ID функции (file + name)
//   - `generateModuleId`    — стабильный ID модуля (для moduleIndex)
//   - `generateContentHash` — SHA-256 контента (для кэширования)
//
// Особенности:
//   - ID стабильны между запусками (не зависят от порядка обхода)
//   - ID детерминированы (одинаковый вход → одинаковый выход)
//   - ID компактны (base36, 4-8 символов) — важно для размера JSON
//
// Отличие от core/IdManager.ts:
//   - IdManager использует SHA-256 и учитывает line/parent/depth
//     (для точной привязки к позиции в AST)
//   - Здесь — простой 32-битный хеш от пути/имени
//     (достаточно для уникальности в пределах проекта)
// ============================================================

// ============================================================
// 1. БАЗОВЫЙ ХЕШ
// ============================================================

/**
 * Простой 32-битный хеш строки в base36.
 *
 * Алгоритм: классический djb2-подобный сдвиг.
 *   hash = ((hash << 5) - hash) + char
 *
 * Свойства:
 *   - Быстрый (O(n) по длине строки)
 *   - Компактный вывод (4-8 символов base36)
 *   - Достаточно равномерный для коротких строк
 *   - Не криптографический (для этого — generateContentHash)
 *
 * @example
 *   simpleHash('src/index.ts')      // → 'a1b2c3'
 *   simpleHash('src/utils/date.ts') // → 'd4e5f6'
 *
 * @param str — входная строка
 * @returns base36-строка длиной 4-8 символов
 */
export function simpleHash(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // приведение к 32-битному signed int
  }

  // Math.abs — убираем отрицательный знак
  // toString(36) — компактная base36-запись
  // padStart(4, '0') — гарантируем минимум 4 символа
  return Math.abs(hash).toString(36).padStart(4, '0');
}

// ============================================================
// 2. ID ФАЙЛА
// ============================================================

/**
 * Генерирует стабильный ID файла.
 *
 * ID зависит только от относительного пути файла от process.cwd().
 * Это гарантирует стабильность ID между запусками из одной
 * рабочей директории, но разные ID — при запуске из разных мест.
 *
 * Для нормализации пути используется `path.relative`, который
 * корректно обрабатывает Windows-разделители (`\`) и POSIX (`/`).
 *
 * Формат: `file_<hash>`
 *
 * @example
 *   // process.cwd() = '/project'
 *   generateFileId('/project/src/index.ts')      // → 'file_a1b2c3'
 *   generateFileId('/project/src/utils/date.ts') // → 'file_d4e5f6'
 *
 * @param filePath — абсолютный или относительный путь к файлу
 * @returns стабильный ID вида `file_XXXXXX`
 */
export function generateFileId(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return `file_${simpleHash(relativePath)}`;
}

// ============================================================
// 3. ID ФУНКЦИИ
// ============================================================

/**
 * Генерирует стабильный ID функции.
 *
 * ID зависит от:
 *   - относительного пути файла (через `simpleHash` от `path.relative`)
 *   - имени функции
 *
 * НЕ зависит от:
 *   - номера строки (функция может переместиться в файле)
 *   - глубины вложенности
 *   - родительской функции
 *
 * Для более точного ID (с учётом позиции в AST) используйте
 * `IdManager.getFunctionId` из `core/IdManager.ts`.
 *
 * Формат: `func_<fileHash>_<funcName>`
 *
 * @example
 *   generateFunctionId('/project/src/utils.ts', 'formatDate')
 *     // → 'func_a1b2c3_formatDate'
 *
 * @param filePath — путь к файлу
 * @param funcName — имя функции
 * @returns стабильный ID функции
 */
export function generateFunctionId(
  filePath: string,
  funcName: string
): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileHash = simpleHash(relativePath);
  return `func_${fileHash}_${funcName}`;
}

// ============================================================
// 4. ID МОДУЛЯ
// ============================================================

/**
 * Генерирует стабильный ID модуля (директории).
 *
 * Используется в `moduleIndex` — верхнеуровневом словаре модулей,
 * который не привязан к конкретному файлу.
 *
 * Формат: `module_<hash>`
 *
 * @example
 *   generateModuleId('components')  // → 'module_c1d2e3'
 *   generateModuleId('utils')       // → 'module_f4e5d6'
 *
 * @param moduleName — имя модуля (директории)
 * @returns стабильный ID модуля
 */
export function generateModuleId(moduleName: string): string {
  return `module_${simpleHash(moduleName)}`;
}

// ============================================================
// 5. ХЕШ КОНТЕНТА (ДЛЯ КЭШИРОВАНИЯ)
// ============================================================

/**
 * Криптографический SHA-256 хеш содержимого.
 *
 * Используется для:
 *   - кэширования результатов анализа (не изменился — не пересчитываем)
 *   - проверки целостности при инкрементальном анализе
 *   - инвалидации бэкапов
 *
 * В отличие от `simpleHash`, этот хеш:
 *   - криптографически стойкий
 *   - длинный (64 hex-символа)
 *   - медленнее, но применим для разовых операций
 *
 * @example
 *   generateContentHash('const x = 1;')
 *     // → 'a3f5c2...' (64 hex-символа)
 *
 * @param content — содержимое файла или любая строка
 * @returns SHA-256 в hex-формате
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// ============================================================
// 6. ПАРА СТАБИЛЬНЫХ ID ДЛЯ СУЩНОСТИ
// ============================================================

/**
 * Утилита для получения обоих ID (файла и функции) одним вызовом.
 *
 * Полезно, когда нужно сгенерировать ID и для файла, и для
 * функции, находящейся в этом файле — экономит один вызов
 * `path.relative` и один `simpleHash`.
 *
 * @example
 *   const { fileId, functionId } = generateEntityIds(
 *     '/project/src/utils.ts',
 *     'formatDate'
 *   );
 *   // fileId     = 'file_a1b2c3'
 *   // functionId = 'func_a1b2c3_formatDate'
 *
 * @param filePath — путь к файлу
 * @param funcName — имя функции
 * @returns объект с парой ID
 */
export function generateEntityIds(
  filePath: string,
  funcName: string
): {
  fileId: string;
  functionId: string;
} {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileHash = simpleHash(relativePath);

  return {
    fileId: `file_${fileHash}`,
    functionId: `func_${fileHash}_${funcName}`,
  };
}

// ============================================================
// 7. ПРОВЕРКА ВАЛИДНОСТИ ID
// ============================================================

/**
 * Проверяет, что строка похожа на валидный ID (по формату).
 *
 * Не гарантирует, что ID существует в индексе — только что
 * формат соответствует ожидаемому.
 *
 * Валидные форматы:
 *   - `file_<hash>`             — ID файла
 *   - `func_<hash>_<name>`      — ID функции
 *   - `module_<hash>`           — ID модуля
 *   - `enum_<hash>_<name>`      — ID enum
 *   - `decorator_<hash>_<name>_<target>` — ID декоратора
 *
 * @param id — проверяемая строка
 * @returns true, если строка соответствует формату
 */
export function isValidIdFormat(id: string): boolean {
  if (!id || typeof id !== 'string') return false;

  const prefixes = ['file_', 'func_', 'module_', 'enum_', 'decorator_'];

  for (const prefix of prefixes) {
    if (id.startsWith(prefix) && id.length > prefix.length + 4) {
      return true;
    }
  }

  return false;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  simpleHash,
  generateFileId,
  generateFunctionId,
  generateModuleId,
  generateContentHash,
  generateEntityIds,
  isValidIdFormat,
};