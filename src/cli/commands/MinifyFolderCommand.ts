// packages/ast-analyzer/src/cli/commands/MinifyFolderCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../config.js';
import { minifyForAI } from '../../core/minifier.js';

/**
 * Опции для команды minify-folder
 */
export interface MinifyFolderCommandOptions {
  /** Выходной файл */
  outputFile?: string;
  /** Расширения файлов для обработки */
  extensions?: string[];
  /** Паттерны для исключения */
  excludePatterns?: string[];
  /** Максимальная глубина рекурсии */
  maxDepth?: number;
  /** Показывать структуру директории */
  showStructure?: boolean;
  /** Добавлять оглавление */
  addTableOfContents?: boolean;
  /** Сортировать по типу */
  sortByType?: boolean;
  /** Подробный вывод */
  verbose?: boolean;
}

/**
 * Информация о файле
 */
export interface FileInfo {
  /** Полный путь к файлу */
  path: string;
  /** Относительный путь */
  relativePath: string;
  /** Расширение файла */
  ext: string;
  /** Размер в байтах */
  size: number;
}

/**
 * Команда для рекурсивной минификации папки
 */
export class MinifyFolderCommand {
  private options: MinifyFolderCommandOptions;

  constructor(options: MinifyFolderCommandOptions = {}) {
    this.options = {
      outputFile: 'ai-project-context.md',
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.mjs', '.cjs'],
      excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
      maxDepth: 10,
      showStructure: true,
      addTableOfContents: true,
      sortByType: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Основной метод выполнения команды
   */
  async execute(inputDir: string): Promise<string | null> {
    const resolvedDir = path.resolve(inputDir);

    if (!fs.existsSync(resolvedDir)) {
      console.error(`❌ Directory does not exist: ${resolvedDir}`);
      return null;
    }

    console.log(`\n📁 Scanning: ${resolvedDir}`);
    console.log(`📄 Extensions: ${this.options.extensions?.join(', ')}`);
    console.log(`🚫 Exclude patterns: ${this.options.excludePatterns?.join(', ')}`);
    console.log(`📏 Max depth: ${this.options.maxDepth}\n`);

    // Собираем файлы
    const files = await this.collectFiles(resolvedDir);

    if (files.length === 0) {
      console.log(`⚠️ No files found with extensions: ${this.options.extensions?.join(', ')}`);
      return null;
    }

    console.log(`📊 Found ${files.length} files\n`);

    // Сортируем если нужно
    if (this.options.sortByType) {
      files.sort((a, b) => {
        if (a.ext !== b.ext) return a.ext.localeCompare(b.ext);
        return a.relativePath.localeCompare(b.relativePath);
      });
    }

    // Генерируем Markdown
    const markdown = this.generateMarkdown(resolvedDir, files);

    // Сохраняем результат
    const outputPath = path.resolve(this.options.outputFile || 'ai-project-context.md');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown, 'utf-8');

    // Выводим статистику
    this.printStats(files, markdown, outputPath);

    return markdown;
  }

  /**
   * Собирает все файлы в директории
   */
  private async collectFiles(baseDir: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const extensions = this.options.extensions || ['.js', '.ts'];
    const excludePatterns = this.options.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
    const maxDepth = this.options.maxDepth || 10;

    // Строим паттерн для glob
    const extPattern = extensions.join(',');
    const globPattern = `**/*{${extPattern}}`;

    try {
      const matched = await glob(globPattern, {
        cwd: baseDir,
        nodir: true,
        ignore: excludePatterns.map(p => `**/${p}/**`),
        absolute: true,
      });

      // Фильтруем по глубине
      for (const filePath of matched) {
        const relativePath = path.relative(baseDir, filePath);
        const depth = relativePath.split(path.sep).length;

        if (depth <= maxDepth) {
          const stat = fs.statSync(filePath);
          files.push({
            path: filePath,
            relativePath: relativePath.replace(/\\/g, '/'),
            ext: path.extname(filePath).toLowerCase(),
            size: stat.size,
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning directory: ${error}`);
    }

    return files;
  }

  /**
   * Генерирует дерево директории
   */
  private generateDirectoryTree(baseDir: string, relativePaths: string[]): string {
    const tree: any = {};

    // Строим дерево
    for (const relPath of relativePaths) {
      const parts = relPath.split('/');
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        if (i === parts.length - 1) {
          current[part] = null;
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      }
    }

    // Рендерим дерево
    const renderNode = (node: any, indent = ''): string => {
      let result = '';
      const entries = Object.entries(node);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry) continue;

        const [name, children] = entry;
        const isLast = i === entries.length - 1;
        const marker = isLast ? '└── ' : '├── ';
        const newIndent = indent + (isLast ? '    ' : '│   ');

        if (children === null) {
          result += `${indent}${marker}📄 ${name}\n`;
        } else {
          result += `${indent}${marker}📁 ${name}/\n`;
          result += renderNode(children, newIndent);
        }
      }

      return result;
    };

    let output = '```\n';
    output += `${path.basename(baseDir)}/\n`;
    output += renderNode(tree, '  ');
    output += '```\n';

    return output;
  }

  /**
   * Генерирует Markdown отчет
   */
  private generateMarkdown(baseDir: string, files: FileInfo[]): string {
    let markdown = '# 🤖 AI Context - Полный проект\n\n';

    // Заголовок
    markdown += `**Сгенерировано:** ${new Date().toLocaleString()}\n`;
    markdown += `**Исходная директория:** \`${baseDir}\`\n`;
    markdown += `**Всего файлов:** ${files.length}\n`;
    markdown += `**Общий размер:** ${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB\n`;
    markdown += '**Режим:** Сжатый (только сигнатуры, без реализации)\n\n';

    markdown += '---\n\n';

    // Инструкция для ИИ
    markdown += '## 📋 ИНСТРУКЦИЯ ДЛЯ ИИ\n\n';
    markdown +=
      'Ты — AI ассистент, который анализирует код проекта. Ниже представлен **полный проект** в сжатом виде:\n\n';
    markdown +=
      '- ✅ **Сохранены:** импорты, экспорты, сигнатуры функций, JSDoc, TypeScript типы\n';
    markdown +=
      '- ❌ **Удалены:** реализации функций, внутренние вычисления, локальные переменные\n';
    markdown += '- 🎯 **Цель:** Понимание архитектуры при минимальном расходе токенов\n\n';
    markdown += '### Как использовать этот контекст:\n\n';
    markdown += '1. Проанализируй структуру проекта\n';
    markdown += '2. Ответь на вопросы пользователя о взаимосвязях модулей\n';
    markdown += '3. Предложи рефакторинг, основываясь на предоставленных сигнатурах\n\n';
    markdown += '---\n\n';

    // Оглавление
    if (this.options.addTableOfContents !== false) {
      markdown += '## 📑 Оглавление\n\n';

      const byExt: Record<string, FileInfo[]> = {};
      for (const file of files) {
        const ext = file.ext;
        if (!byExt[ext]) {
          byExt[ext] = [];
        }
        // Используем безопасное присваивание с проверкой
        const extArray = byExt[ext];
        if (extArray) {
          extArray.push(file);
        }
      }

      for (const [ext, extFiles] of Object.entries(byExt)) {
        if (!extFiles || extFiles.length === 0) continue;
        markdown += `### ${ext} файлы (${extFiles.length})\n`;
        for (const file of extFiles) {
          const anchor = file.relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          markdown += `- [\`${file.relativePath}\`](#${anchor})\n`;
        }
        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    // Структура проекта
    if (this.options.showStructure !== false) {
      markdown += '## 📁 Структура проекта\n\n';
      markdown += this.generateDirectoryTree(
        baseDir,
        files.map(f => f.relativePath)
      );
      markdown += '\n---\n\n';
    }

    // Содержимое файлов
    markdown += '## 📄 Содержимое файлов\n\n';

    let processedCount = 0;
    let totalOriginalSize = 0;
    let totalMinifiedSize = 0;

    for (const file of files) {
      processedCount++;
      const progress = Math.round((processedCount / files.length) * 100);

      if (this.options.verbose) {
        process.stdout.write(
          `\r   🏭 Минификация: ${processedCount}/${files.length} (${progress}%)`
        );
      }

      const minified = this.minifyFile(file.path);

      if (!minified) {
        if (this.options.verbose) {
          console.log(`\n   ⚠️ Failed to minify: ${file.relativePath}`);
        }
        continue;
      }

      totalOriginalSize += file.size;
      totalMinifiedSize += minified.length;

      const lang = this.getLanguage(file.ext);
      markdown += `### \`${file.relativePath}\`\n`;
      markdown += `\`\`\`${lang}\n${minified}\n\`\`\`\n\n`;
      markdown += '---\n\n';
    }

    if (this.options.verbose) {
      console.log('\n');
    }

    // Статистика сжатия
    markdown += '## 📊 Статистика сжатия\n\n';
    markdown += '| Показатель | Значение |\n';
    markdown += '|------------|----------|\n';
    markdown += `| Исходный размер | ${(totalOriginalSize / 1024).toFixed(2)} KB |\n`;
    markdown += `| Сжатый размер | ${(totalMinifiedSize / 1024).toFixed(2)} KB |\n`;
    markdown += `| Экономия | ${((totalOriginalSize - totalMinifiedSize) / 1024).toFixed(2)} KB (${totalOriginalSize > 0 ? ((1 - totalMinifiedSize / totalOriginalSize) * 100).toFixed(1) : 0}%) |\n`;
    markdown += `| Количество файлов | ${files.length} |\n\n`;

    return markdown;
  }

  /**
   * Минифицирует один файл
   */
  private minifyFile(filePath: string): string | null {
    try {
      // Для Vue файлов извлекаем script
      if (filePath.endsWith('.vue')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch && scriptMatch[1]) {
          // Создаем временный файл с script содержимым
          const tempPath = filePath + '.temp.js';
          fs.writeFileSync(tempPath, scriptMatch[1]);
          const result = minifyForAI(tempPath);
          fs.unlinkSync(tempPath);
          return result;
        }
        return null;
      }

      return minifyForAI(filePath);
    } catch (error) {
      if (this.options.verbose) {
        console.error(`   ❌ Error minifying ${filePath}:`, error);
      }
      return null;
    }
  }

  /**
   * Определяет язык для подсветки синтаксиса
   */
  private getLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.vue': 'vue',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.md': 'markdown',
    };

    return langMap[ext] || 'text';
  }

  /**
   * Выводит статистику выполнения
   */
  private printStats(files: FileInfo[], markdown: string, outputPath: string): void {
    const totalOriginalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalMinifiedSize = markdown.length;

    console.log('\n' + '='.repeat(60));
    console.log('✅ ГОТОВО!');
    console.log('='.repeat(60));
    console.log(`📄 Выходной файл: ${outputPath}`);
    console.log(`📊 Размер: ${(totalMinifiedSize / 1024).toFixed(2)} KB`);
    console.log(`📊 Исходный размер: ${(totalOriginalSize / 1024).toFixed(2)} KB`);
    console.log(
      `📊 Экономия: ${totalOriginalSize > 0 ? ((1 - totalMinifiedSize / totalOriginalSize) * 100).toFixed(1) : 0}%`
    );
    console.log(`📁 Файлов обработано: ${files.length}`);
    console.log('\n💡 Отправьте этот файл в ИИ для анализа всего проекта!');
  }

  /**
   * Возвращает опции команды
   */
  getOptions(): MinifyFolderCommandOptions {
    return { ...this.options };
  }
}

/**
 * Фасадная функция для использования как API
 */
export async function minifyFolder(
  inputDir: string,
  options: MinifyFolderCommandOptions = {}
): Promise<string | null> {
  const command = new MinifyFolderCommand(options);
  return command.execute(inputDir);
}

/**
 * Фасадная функция для использования как API (синхронная версия)
 * @deprecated Используйте асинхронную версию minifyFolder
 */
export function minifyFolderSync(
  _inputDir: string,
  _options: MinifyFolderCommandOptions = {}
): string | null {
  // Синхронная версия не поддерживается, используйте асинхронную
  console.warn('⚠️ minifyFolderSync is deprecated, use minifyFolder instead');
  return null;
}

export default MinifyFolderCommand;
