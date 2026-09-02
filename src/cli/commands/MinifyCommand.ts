// packages/ast-analyzer/src/cli/commands/MinifyCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

/**
 * Команда для минификации одного файла
 *
 * Удаляет реализации функций, оставляя только сигнатуры
 * для экономии токенов при отправке в ИИ
 */
export class MinifyCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('minify <file>')
      .description('Minify file for AI (remove implementations, keep signatures)')
      .option('-o, --output <file>', 'Output file', 'ai-context.txt')
      .option('-v, --verbose', 'Verbose output')
      .action(async (file, options) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          if (error instanceof Error) {
            console.error(`❌ Error: ${error.message}`);
          } else {
            console.error('❌ Unknown error occurred');
          }
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет минификацию файла
   */
  private async execute(file: string, options: any): Promise<void> {
    const absolutePath = path.resolve(file);

    console.log(`✂️ Minifying: ${absolutePath}`);

    // Проверяем существование файла
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Проверяем, что это файл, а не директория
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${absolutePath}`);
    }

    // Проверяем расширение
    const supportedExtensions = ['.js', '.ts', '.tsx', '.jsx', '.vue', '.mjs', '.cjs'];
    const ext = path.extname(absolutePath);
    if (!supportedExtensions.includes(ext)) {
      console.warn(`⚠️ File extension '${ext}' may not be supported for minification`);
    }

    const startTime = Date.now();

    try {
      // Импортируем функцию минификации
      const { minifyForAI } = await import('../../core/minifier.js');

      // Минифицируем файл
      console.log('   🔧 Processing...');
      const result = minifyForAI(absolutePath);

      if (!result) {
        throw new Error('Minification returned empty result');
      }

      // Сохраняем результат
      const outputPath = path.resolve(options.output);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, result, 'utf-8');

      // Статистика
      const originalSize = stat.size;
      const minifiedSize = result.length;
      const savedSize = originalSize - minifiedSize;
      const savedPercent = originalSize > 0 ? ((savedSize / originalSize) * 100).toFixed(1) : '0';

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n✅ Minified code saved: ${outputPath}`);
      console.log('📊 Statistics:');
      console.log(`   • Original size: ${this.formatSize(originalSize)}`);
      console.log(`   • Minified size: ${this.formatSize(minifiedSize)}`);
      console.log(`   • Saved: ${this.formatSize(savedSize)} (${savedPercent}%)`);
      console.log(`   • Time: ${duration}s`);

      if (options.verbose) {
        console.log('\n📝 Preview (first 200 chars):');
        console.log('   ' + result.substring(0, 200).replace(/\n/g, '\n   ') + '...');
      }

      // Проверяем, не слишком ли большой результат
      if (minifiedSize > 100 * 1024) {
        console.warn('\n⚠️ Minified file is large (>100KB).');
        console.warn('   Consider using minify-folder for better token efficiency.');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Minification failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Форматирует размер в человеко-читаемый формат
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Экспорт по умолчанию
 */
export default MinifyCommand;
