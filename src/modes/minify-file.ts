// modes/minify-file.ts
import fs from 'fs';
import path from 'path';
import { minifyForAI } from '../core/minifier.js';

/**
 * Режим минификации одного файла
 * @param targetPath Путь к файлу для минификации
 * @returns Содержимое минифицированного файла или null в случае ошибки
 */
export function minifyFileCommand(targetPath: string): string | null {
  const resolvedPath = path.resolve(targetPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Файл не существует: ${resolvedPath}`);
    return null;
  }

  if (!fs.statSync(resolvedPath).isFile()) {
    console.error(`❌ Указанный путь не является файлом: ${resolvedPath}`);
    return null;
  }

  try {
    const minified = minifyForAI(resolvedPath);

    if (minified) {
      const outputFile = 'ai-context.txt';
      fs.writeFileSync(outputFile, minified);
      console.log(`\n✅ Минифицированный код сохранен: ${outputFile}`);

      const originalSize = fs.statSync(resolvedPath).size;
      console.log(`📊 Исходный размер: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`📊 Сжатый размер: ${(minified.length / 1024).toFixed(2)} KB`);

      const ratio = ((minified.length / originalSize) * 100).toFixed(1);
      console.log(`📊 Экономия: ${(100 - parseFloat(ratio)).toFixed(1)}% токенов`);

      return minified;
    }
  } catch (error: any) {
    console.error(`❌ Ошибка при минификации: ${error.message}`);
    return null;
  }

  return null;
}

/**
 * Алиас для minifyFileCommand (для совместимости с оригинальным интерфейсом)
 */
export const minifyFile = minifyFileCommand;

/**
 * Алиас для minify (короткое имя)
 */
export const minify = minifyFileCommand;
