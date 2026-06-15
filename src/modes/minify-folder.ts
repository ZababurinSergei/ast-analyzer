// modes/minify-folder.ts
import fs from 'fs';
import path from 'path';
import { minifyForAI } from '../core/minifier.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../config.js';

interface MinifyFolderOptions {
  outputFile?: string;
  extensions?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  showStructure?: boolean;
  addTableOfContents?: boolean;
  sortByType?: boolean;
}

interface FileInfo {
  path: string;
  relativePath: string;
  ext: string;
  size: number;
}

function generateDirectoryTree(
  baseDir: string,
  relativePaths: string[],
  _excludePatterns: string[]
): string {
  const tree: any = {};

  for (const relPath of relativePaths) {
    const parts = relPath.split(path.sep);
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === undefined) continue;

      if (i === parts.length - 1) {
        current[part] = null;
      } else {
        if (!current[part]) current[part] = {};
        const nextCurrent = current[part];
        if (nextCurrent && typeof nextCurrent === 'object') {
          current = nextCurrent;
        } else {
          // Если текущий узел не является объектом, создаем новый
          current[part] = {};
          current = current[part];
        }
      }
    }
  }

  function renderNode(node: any, indent = '', _prefix = ''): string {
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
        result += renderNode(children, newIndent, '');
      }
    }

    return result;
  }

  let output = `\`\`\`\n${path.basename(baseDir)}/\n`;
  output += renderNode(tree, '  ');
  output += '```\n';

  return output;
}

function collectFiles(
  dir: string,
  extensions: string[],
  excludePatterns: string[],
  maxDepth: number,
  currentDepth = 0
): FileInfo[] {
  const files: FileInfo[] = [];

  if (currentDepth > maxDepth) return files;

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      const shouldExclude = excludePatterns.some(
        pattern => fullPath.includes(pattern) || item === pattern
      );

      if (shouldExclude) continue;

      if (stat.isDirectory()) {
        files.push(
          ...collectFiles(fullPath, extensions, excludePatterns, maxDepth, currentDepth + 1)
        );
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (extensions.includes(ext)) {
          files.push({
            path: fullPath,
            relativePath: path.relative(process.cwd(), fullPath),
            ext: ext,
            size: stat.size,
          });
        }
      }
    }
  } catch (error: any) {
    console.warn(`⚠️ Ошибка чтения ${dir}: ${error.message}`);
  }

  return files;
}

/**
 * Рекурсивно сжимает все файлы в директории для передачи в ИИ
 * @param inputDir Путь к директории
 * @param options Опции минификации
 * @returns Markdown строка с контекстом проекта или null при ошибке
 */
export function minifyFolder(inputDir: string, options: MinifyFolderOptions = {}): string | null {
  const {
    outputFile = 'ai-project-context.md',
    extensions = ['.js', '.ts', '.tsx', '.jsx', '.vue', '.mjs', '.cjs'],
    excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    maxDepth = 10,
    showStructure = true,
    addTableOfContents = true,
    sortByType = true,
  } = options;

  const resolvedDir = path.resolve(inputDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`❌ Каталог не существует: ${resolvedDir}`);
    return null;
  }

  console.log(`\n📁 Сканирование: ${resolvedDir}`);
  console.log(`📄 Расширения: ${extensions.join(', ')}`);
  console.log(`🚫 Исключения: ${excludePatterns.join(', ')}\n`);

  const files = collectFiles(resolvedDir, extensions, excludePatterns, maxDepth);

  if (files.length === 0) {
    console.log(`⚠️ Файлы с расширениями ${extensions.join(', ')} не найдены`);
    return null;
  }

  console.log(`📊 Найдено файлов: ${files.length}\n`);

  if (sortByType) {
    files.sort((a, b) => {
      if (a.ext !== b.ext) return a.ext.localeCompare(b.ext);
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  let markdown = '# 🤖 AI Context - Полный проект\n\n';
  markdown += `**Сгенерировано:** ${new Date().toLocaleString()}\n`;
  markdown += `**Исходная директория:** \`${resolvedDir}\`\n`;
  markdown += `**Всего файлов:** ${files.length}\n`;
  markdown += `**Общий размер:** ${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB\n`;
  markdown += '**Режим:** Сжатый (только сигнатуры, без реализации)\n\n';

  markdown += '---\n\n';
  markdown += '## 📋 ИНСТРУКЦИЯ ДЛЯ ИИ\n\n';
  markdown +=
    'Ты — AI ассистент, который анализирует код проекта. Ниже представлен **полный проект** в сжатом виде:\n\n';
  markdown += '- ✅ **Сохранены:** импорты, экспорты, сигнатуры функций, JSDoc, TypeScript типы\n';
  markdown += '- ❌ **Удалены:** реализации функций, внутренние вычисления, локальные переменные\n';
  markdown += '- 🎯 **Цель:** Понимание архитектуры при минимальном расходе токенов\n\n';
  markdown += '### Как использовать этот контекст:\n\n';
  markdown += '1. Проанализируй структуру проекта\n';
  markdown += '2. Ответь на вопросы пользователя о взаимосвязях модулей\n';
  markdown += '3. Предложи рефакторинг, основываясь на предоставленных сигнатурах\n\n';
  markdown += '---\n\n';

  if (addTableOfContents) {
    markdown += '## 📑 Оглавление\n\n';
    const byExt: Record<string, FileInfo[]> = {};
    for (const file of files) {
      if (!byExt[file.ext]) {
        byExt[file.ext] = [];
      }
      // Исправление: проверка на undefined перед push
      const extArray = byExt[file.ext];
      if (extArray) {
        extArray.push(file);
      }
    }
    for (const [ext, extFiles] of Object.entries(byExt)) {
      markdown += `### ${ext} файлы (${extFiles.length})\n`;
      for (const file of extFiles) {
        const anchor = file.relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        markdown += `- [\`${file.relativePath}\`](#${anchor})\n`;
      }
      markdown += '\n';
    }
    markdown += '---\n\n';
  }

  if (showStructure) {
    markdown += '## 📁 Структура проекта\n\n';
    markdown += generateDirectoryTree(
      resolvedDir,
      files.map(f => f.relativePath),
      excludePatterns
    );
    markdown += '\n---\n\n';
  }

  markdown += '## 📄 Содержимое файлов\n\n';

  let processedCount = 0;
  let totalOriginalSize = 0;
  let totalMinifiedSize = 0;

  for (const file of files) {
    processedCount++;
    const progress = Math.round((processedCount / files.length) * 100);
    process.stdout.write(`\r   🏭 Минификация: ${processedCount}/${files.length} (${progress}%)`);

    const minified = minifyForAI(file.path);
    if (!minified) continue;

    totalOriginalSize += file.size;
    totalMinifiedSize += minified.length;

    const lang =
      file.ext === '.vue'
        ? 'vue'
        : ['.ts', '.tsx'].includes(file.ext)
          ? 'typescript'
          : 'javascript';

    markdown += `### \`${file.relativePath}\`\n`;
    markdown += `\`\`\`${lang}\n${minified}\n\`\`\`\n\n`;
    markdown += '---\n\n';
  }

  console.log('\n');

  const savedKB = (totalOriginalSize - totalMinifiedSize) / 1024;
  const savedPercent =
    totalOriginalSize > 0 ? ((1 - totalMinifiedSize / totalOriginalSize) * 100).toFixed(1) : 0;

  markdown += '## 📊 Статистика сжатия\n\n';
  markdown += '| Показатель | Значение |\n';
  markdown += '|------------|----------|\n';
  markdown += `| Исходный размер | ${(totalOriginalSize / 1024).toFixed(2)} KB |\n`;
  markdown += `| Сжатый размер | ${(totalMinifiedSize / 1024).toFixed(2)} KB |\n`;
  markdown += `| Экономия | ${savedKB.toFixed(2)} KB (${savedPercent}%) |\n`;
  markdown += `| Количество файлов | ${files.length} |\n\n`;

  fs.writeFileSync(outputFile, markdown, 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ ГОТОВО!');
  console.log(`${'='.repeat(60)}`);
  console.log(`📄 Выходной файл: ${path.resolve(outputFile)}`);
  console.log(`📊 Размер: ${(totalMinifiedSize / 1024).toFixed(2)} KB (сжатие ${savedPercent}%)`);
  console.log(`📁 Файлов обработано: ${files.length}`);
  console.log('\n💡 Отправьте этот файл в ИИ для анализа всего проекта!');

  return markdown;
}

// Экспорт внутренних функций для использования в других модулях
export { generateDirectoryTree, collectFiles };
