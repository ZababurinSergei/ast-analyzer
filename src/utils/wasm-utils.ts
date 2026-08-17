// src/utils/wasm-utils.ts
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Находит директорию с WASM файлами для Tree-sitter
 * Проверяет несколько возможных путей в порядке приоритета
 * @returns {string} Путь к директории с WASM файлами
 */
export function findWasmPath(): string {
  const possiblePaths = [
    // Относительно текущего файла (из dist/)
    path.resolve(__dirname, 'wasm'),
    // Относительно текущего файла (из src/)
    path.resolve(__dirname, '../dist/wasm'),
    // Относительно текущего файла (из подпапки)
    path.resolve(__dirname, '../../dist/wasm'),
    // В корне проекта (для монорепозиториев)
    path.resolve(process.cwd(), 'packages/ast-analyzer/dist/wasm'),
    // В папке grammars проекта
    path.resolve(process.cwd(), 'grammars'),
    // В node_modules (если установлен как пакет)
    path.resolve(process.cwd(), 'node_modules/@newkind/ast-analyzer/dist/wasm'),
    // В корне проекта
    path.resolve(process.cwd(), 'wasm'),
    // В dist проекта
    path.resolve(process.cwd(), 'dist/wasm'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const files = fs.readdirSync(p);
        const hasWasm = files.some(f => f.endsWith('.wasm'));
        if (hasWasm) {
          console.log(`✅ WASM found at: ${p}`);
          return p;
        }
      } catch (error) {
        // Игнорируем ошибки чтения директории
      }
    }
  }

  // Если не найдено, выводим предупреждение и возвращаем путь по умолчанию
  console.warn('⚠️ WASM directory not found. Call Graph analysis will be limited.');
  console.warn('   Expected WASM files in one of these locations:');
  for (const p of possiblePaths) {
    console.warn(`     - ${p}`);
  }
  console.warn(
    '   💡 Copy WASM files from packages/ast-analyzer/dist/wasm/ to one of these locations'
  );

  return path.resolve(__dirname, 'wasm');
}

/**
 * Проверяет, доступны ли WASM файлы
 * @returns {boolean} true если WASM файлы найдены
 */
export function isWasmAvailable(): boolean {
  const wasmPath = findWasmPath();
  return fs.existsSync(wasmPath) && fs.readdirSync(wasmPath).some(f => f.endsWith('.wasm'));
}

/**
 * Возвращает список доступных WASM грамматик
 * @returns {string[]} Список имен грамматик
 */
export function getAvailableGrammars(): string[] {
  const wasmPath = findWasmPath();
  if (!fs.existsSync(wasmPath)) return [];

  try {
    return fs
      .readdirSync(wasmPath)
      .filter(f => f.endsWith('.wasm'))
      .map(f => f.replace('tree-sitter-', '').replace('.wasm', ''));
  } catch (error) {
    return [];
  }
}

/**
 * Создает симлинк на WASM директорию в текущем проекте
 * @param {string} targetPath - Путь куда создать симлинк (по умолчанию ./grammars)
 * @returns {boolean} true если симлинк создан
 */
export function createWasmSymlink(targetPath: string = './grammars'): boolean {
  const wasmSource = findWasmPath();
  if (!fs.existsSync(wasmSource)) {
    console.error('❌ WASM source directory not found');
    return false;
  }

  const target = path.resolve(process.cwd(), targetPath);

  try {
    // Удаляем существующий симлинк если есть
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }

    // Создаем симлинк
    fs.symlinkSync(wasmSource, target, 'dir');
    console.log(`✅ Symlink created: ${target} -> ${wasmSource}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to create symlink:', error);
    return false;
  }
}

/**
 * Копирует WASM файлы в указанную директорию
 * @param {string} targetPath - Путь для копирования
 * @returns {number} Количество скопированных файлов
 */
export function copyWasmFiles(targetPath: string): number {
  const wasmSource = findWasmPath();
  if (!fs.existsSync(wasmSource)) {
    console.error('❌ WASM source directory not found');
    return 0;
  }

  const target = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  try {
    const files = fs.readdirSync(wasmSource).filter(f => f.endsWith('.wasm'));
    let copied = 0;

    for (const file of files) {
      const src = path.join(wasmSource, file);
      const dest = path.join(target, file);
      fs.copyFileSync(src, dest);
      copied++;
    }

    console.log(`✅ Copied ${copied} WASM files to: ${target}`);
    return copied;
  } catch (error) {
    console.error('❌ Failed to copy WASM files:', error);
    return 0;
  }
}

// Экспорт по умолчанию
export default {
  findWasmPath,
  isWasmAvailable,
  getAvailableGrammars,
  createWasmSymlink,
  copyWasmFiles,
};
