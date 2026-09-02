// packages/ast-analyzer/src/cli/commands/PromptPackCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст (исправленная версия)

import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';

/**
 * Команда: prompt-pack
 *
 * Собирает пакет промптов для ИИ:
 * - Целевой файл (полностью)
 * - Зависимости (в сжатом виде, только сигнатуры)
 * - Контекст проекта
 *
 * Использование:
 *   npx ast-analyzer prompt-pack <file> [options]
 *   npx ast-analyzer prompt-pack ./src/index.ts -d 3 -o prompt.md
 */
export class PromptPackCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('prompt-pack <file>')
      .description('🎒 Build AI prompt pack: target file + minified dependencies')
      .option('-d, --depth <n>', 'Maximum depth for dependency analysis', '2')
      .option('-o, --output <file>', 'Output file name', 'ai-prompt-bundle.md')
      .option('--no-target', 'Exclude target file content (only dependencies)')
      .option('--no-deps', 'Exclude dependencies (only target file)')
      .option('--format <format>', 'Output format: markdown, json, text', 'markdown')
      .option('--include-ast', 'Include AST structure (experimental)', false)
      .option('--include-types', 'Include TypeScript type information', false)
      .option('--compact', 'Compact mode (minimal output)', false)
      .option('-v, --verbose', 'Verbose output', false)
      .action(async (file, options) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ PromptPackCommand error:', error);
          if (options.verbose && error instanceof Error && error.stack) {
            console.error('\n📚 Stack trace:');
            console.error(error.stack);
          }
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет команду
   */
  private async execute(file: string, options: any): Promise<void> {
    const startTime = Date.now();

    console.log('🎒 Building prompt pack...');
    console.log(`📄 Target file: ${file}`);
    console.log(`📏 Depth: ${options.depth}`);
    console.log(`📋 Format: ${options.format}`);
    console.log(`📦 Include target: ${options.target !== false}`);
    console.log(`📦 Include deps: ${options.deps !== false}`);
    console.log(`🔬 Include AST: ${options.includeAst ? 'ON' : 'OFF'}`);
    console.log(`📝 Include types: ${options.includeTypes ? 'ON' : 'OFF'}`);

    const absolutePath = path.resolve(file);

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      process.exit(1);
    }

    // Проверяем, что это файл
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      console.error(`❌ Path is not a file: ${absolutePath}`);
      process.exit(1);
    }

    // 1. Загружаем целевой файл
    const targetContent = fs.readFileSync(absolutePath, 'utf-8');
    const targetStats = this.getFileStats(absolutePath, targetContent);

    // 2. Собираем зависимости
    let dependencies: DependencyInfo[] = [];
    if (options.deps !== false) {
      dependencies = await this.collectDependencies(absolutePath, parseInt(options.depth), options);
    }

    // 3. Генерируем промпт
    const prompt = this.generatePrompt(
      absolutePath,
      targetContent,
      targetStats,
      dependencies,
      options
    );

    // 4. Сохраняем результат
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, prompt);
    console.log(`\n✅ Prompt pack saved: ${outputPath}`);
    console.log(`📊 Size: ${(prompt.length / 1024).toFixed(2)} KB`);

    // 5. Дополнительная статистика
    if (options.verbose) {
      console.log('\n📊 STATISTICS:');
      console.log(`   • Target file lines: ${targetStats.lines}`);
      console.log(`   • Target file size: ${(targetStats.size / 1024).toFixed(2)} KB`);
      console.log(`   • Dependencies found: ${dependencies.length}`);
      console.log(`   • Total size (compressed): ${(prompt.length / 1024).toFixed(2)} KB`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Duration: ${duration}s`);
  }

  /**
   * Собирает зависимости рекурсивно
   */
  private async collectDependencies(
    filePath: string,
    maxDepth: number,
    _options: any
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const visited = new Set<string>();
    const queue: { path: string; depth: number }[] = [{ path: filePath, depth: 0 }];

    console.log('\n🔍 Collecting dependencies...');

    while (queue.length > 0) {
      const { path: currentPath, depth } = queue.shift()!;

      if (depth >= maxDepth) continue;
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      const deps = this.extractImports(currentPath);

      for (const dep of deps) {
        const resolvedPath = this.resolveImport(currentPath, dep);
        if (!resolvedPath) continue;

        if (!visited.has(resolvedPath)) {
          // Проверяем, что файл существует и читаем
          try {
            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
              const content = fs.readFileSync(resolvedPath, 'utf-8');
              const minified = this.minifyContent(content);

              dependencies.push({
                path: resolvedPath,
                relativePath: path.relative(process.cwd(), resolvedPath),
                content: minified,
                originalSize: content.length,
                minifiedSize: minified.length,
                depth: depth + 1,
                imports: this.extractImports(resolvedPath),
              });

              queue.push({ path: resolvedPath, depth: depth + 1 });

              if (_options.verbose) {
                console.log(`   📄 ${path.basename(resolvedPath)} (depth ${depth + 1})`);
              }
            }
          } catch (error) {
            // Игнорируем ошибки
          }
        }
      }
    }

    console.log(`   ✅ Found ${dependencies.length} dependencies`);

    // Сортируем по глубине
    dependencies.sort((a, b) => a.depth - b.depth);

    return dependencies;
  }

  /**
   * Извлекает импорты из файла
   */
  private extractImports(filePath: string): string[] {
    const imports: string[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // ES6 imports: import ... from 'module'
      const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1] && !match[1].startsWith('.')) {
          // Внешние модули пропускаем
          continue;
        }
        if (match[1]) {
          imports.push(match[1]);
        }
      }

      // Dynamic imports: import('module')
      const dynamicRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = dynamicRegex.exec(content)) !== null) {
        if (match[1] && !match[1].startsWith('.')) {
          continue;
        }
        if (match[1]) {
          imports.push(match[1]);
        }
      }

      // CommonJS: require('module')
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        if (match[1] && !match[1].startsWith('.')) {
          continue;
        }
        if (match[1]) {
          imports.push(match[1]);
        }
      }

      // Export ... from 'module'
      const exportRegex = /export\s+.*?from\s+['"]([^'"]+)['"]/g;
      while ((match = exportRegex.exec(content)) !== null) {
        if (match[1] && !match[1].startsWith('.')) {
          continue;
        }
        if (match[1]) {
          imports.push(match[1]);
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }

    return [...new Set(imports)];
  }

  /**
   * Разрешает путь импорта
   */
  private resolveImport(fromFile: string, importPath: string): string | null {
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);

    // Пробуем разные расширения
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

    // Проверяем как есть
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }

    // Проверяем с расширениями
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    // Проверяем index файлы
    for (const ext of extensions) {
      const candidate = path.join(resolved, `index${ext}`);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Минифицирует содержимое (удаляет тела функций)
   */
  private minifyContent(content: string): string {
    // Удаляем тела функций
    const minified = content
      // Удаляем тела функций: function name() { ... }
      .replace(/function\s+\w+\s*\([^)]*\)\s*\{[^{}]*\}/g, match => {
        const signature = match.replace(/\{[^{}]*\}/, '{ /* ... */ }');
        return signature;
      })
      // Удаляем стрелочные функции с телами
      .replace(/(\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*)\{[^{}]*\}/g, '$1{ /* ... */ }')
      // Удаляем классы с методами
      .replace(/class\s+\w+\s*\{[^{}]*\}/g, match => {
        const classMatch = match.match(/class\s+\w+/);
        if (classMatch) {
          return `${classMatch[0]} { /* ... */ }`;
        }
        return match;
      })
      // Удаляем комментарии
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Удаляем пустые строки
      .replace(/^\s*[\r\n]/gm, '')
      // Убираем лишние пробелы
      .replace(/\s{2,}/g, ' ');

    return minified;
  }

  /**
   * Получает статистику файла
   */
  private getFileStats(filePath: string, content: string): FileStats {
    return {
      size: content.length,
      lines: content.split('\n').length,
      functions: this.countFunctions(content),
      imports: this.extractImports(filePath).length,
    };
  }

  /**
   * Подсчитывает количество функций в файле
   */
  private countFunctions(content: string): number {
    const funcRegex = /function\s+\w+\s*\(/g;
    const arrowRegex = /(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    const methodRegex = /\w+\s*\([^)]*\)\s*\{/g;

    const count =
      (content.match(funcRegex) || []).length +
      (content.match(arrowRegex) || []).length +
      (content.match(methodRegex) || []).length;

    return count;
  }

  /**
   * Генерирует промпт
   */
  private generatePrompt(
    filePath: string,
    content: string,
    stats: FileStats,
    dependencies: DependencyInfo[],
    options: any
  ): string {
    const format = options.format || 'markdown';

    switch (format) {
      case 'json':
        return this.generateJSONPrompt(filePath, content, stats, dependencies, options);
      case 'text':
        return this.generateTextPrompt(filePath, content, stats, dependencies, options);
      case 'markdown':
      default:
        return this.generateMarkdownPrompt(filePath, content, stats, dependencies, options);
    }
  }

  /**
   * Генерирует Markdown промпт
   */
  private generateMarkdownPrompt(
    filePath: string,
    content: string,
    stats: FileStats,
    dependencies: DependencyInfo[],
    options: any
  ): string {
    let prompt = '# 🎒 AI Prompt Pack\n\n';
    prompt += `**Generated:** ${new Date().toLocaleString()}\n`;
    prompt += `**Target file:** \`${filePath}\`\n`;
    prompt += `**Depth:** ${options.depth}\n`;
    prompt += `**Files:** ${1 + dependencies.length}\n\n`;
    prompt += '---\n\n';

    // Инструкция для ИИ
    prompt += '## 📋 INSTRUCTION FOR AI\n\n';
    prompt +=
      'You are an AI assistant analyzing code. Below is the **target file** and its **minified dependencies**.\n\n';
    prompt += "### What's provided:\n";
    prompt += '- ✅ **Target file** — full code\n';
    prompt += '- ✅ **Dependencies** — signatures only (without implementation)\n';
    prompt += '- ✅ **Import/export relationships**\n\n';
    prompt += '### How to use this context:\n';
    prompt += '1. Understand the architecture of the target file\n';
    prompt += '2. Analyze dependencies and their usage\n';
    prompt += '3. Answer questions about the code structure\n';
    prompt += '4. Suggest improvements and refactoring\n\n';
    prompt += '---\n\n';

    // Оглавление
    prompt += '## 📑 Table of Contents\n\n';
    prompt += `1. [Target File](#target-file)\n`;
    prompt += `2. [File Statistics](#file-statistics)\n`;
    prompt += `3. [Dependencies](#dependencies)\n`;
    if (dependencies.length > 0) {
      for (let i = 0; i < dependencies.length; i++) {
        const dep = dependencies[i];
        if (dep) {
          const anchor = this.generateAnchor(dep.relativePath);
          prompt += `   ${i + 1}. [${dep.relativePath}](#${anchor})\n`;
        }
      }
    }
    prompt += '\n---\n\n';

    // Статистика
    prompt += '## 📊 File Statistics\n\n';
    prompt += '| Metric | Value |\n';
    prompt += '|--------|-------|\n';
    prompt += `| Size | ${(stats.size / 1024).toFixed(2)} KB |\n`;
    prompt += `| Lines | ${stats.lines} |\n`;
    prompt += `| Functions | ${stats.functions} |\n`;
    prompt += `| Imports | ${stats.imports} |\n`;
    prompt += `| Dependencies | ${dependencies.length} |\n`;
    prompt += `| Total size (with deps) | ${((stats.size + dependencies.reduce((s, d) => s + d.minifiedSize, 0)) / 1024).toFixed(2)} KB |\n\n`;
    prompt += '---\n\n';

    // Целевой файл
    if (options.target !== false) {
      prompt += '## 🎯 Target File\n\n';
      prompt += `### \`${path.basename(filePath)}\`\n\n`;
      const ext = path.extname(filePath).slice(1);
      const lang = ext === 'ts' || ext === 'tsx' || ext === 'vue' ? 'typescript' : 'javascript';
      prompt += `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
      prompt += '---\n\n';
    }

    // Зависимости
    if (options.deps !== false && dependencies.length > 0) {
      prompt += '## 🔗 Dependencies\n\n';
      prompt += `Total: **${dependencies.length}** dependencies\n\n`;

      // Группируем по глубине
      const byDepth = new Map<number, DependencyInfo[]>();
      for (const dep of dependencies) {
        if (!byDepth.has(dep.depth)) {
          byDepth.set(dep.depth, []);
        }
        byDepth.get(dep.depth)!.push(dep);
      }

      const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);
      for (const depth of sortedDepths) {
        const deps = byDepth.get(depth)!;
        prompt += `### Level ${depth} (${deps.length} files)\n\n`;

        for (const dep of deps) {
          prompt += `#### \`${dep.relativePath}\`\n\n`;
          prompt += `**Depth:** ${dep.depth}\n`;
          prompt += `**Original size:** ${(dep.originalSize / 1024).toFixed(2)} KB\n`;
          prompt += `**Minified size:** ${(dep.minifiedSize / 1024).toFixed(2)} KB\n`;
          prompt += `**Compression:** ${((1 - dep.minifiedSize / dep.originalSize) * 100).toFixed(1)}%\n`;

          if (dep.imports && dep.imports.length > 0) {
            prompt += `**Imports:** ${dep.imports.join(', ')}\n`;
          }

          const ext = path.extname(dep.path).slice(1);
          const lang = ext === 'ts' || ext === 'tsx' ? 'typescript' : 'javascript';
          prompt += `\n\`\`\`${lang}\n${dep.content}\n\`\`\`\n\n`;
        }
      }

      prompt += '---\n\n';
    }

    // Итог
    prompt += '## 💡 Recommendations\n\n';
    prompt += 'Based on the analysis:\n\n';

    if (stats.functions > 20) {
      prompt += '1. ⚠️ **Large file detected** — consider splitting into smaller modules\n';
    }
    if (stats.imports > 10) {
      prompt += '2. ⚠️ **Many imports** — check for unused dependencies\n';
    }
    if (dependencies.length > 10) {
      prompt += '3. ⚠️ **Many dependencies** — consider reducing coupling\n';
    }

    if (stats.functions <= 20 && stats.imports <= 10 && dependencies.length <= 10) {
      prompt += '1. ✅ **Well-structured** — the file is manageable\n';
    }

    prompt += '\n---\n\n';
    prompt += `*Generated by AST Analyzer Prompt Pack v3.0.0*\n`;
    prompt += `*${new Date().toLocaleString()}*\n`;

    return prompt;
  }

  /**
   * Генерирует JSON промпт
   */
  private generateJSONPrompt(
    filePath: string,
    content: string,
    stats: FileStats,
    dependencies: DependencyInfo[],
    options: any
  ): string {
    const data = {
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      target: {
        file: filePath,
        name: path.basename(filePath),
        stats: stats,
        content: content,
      },
      dependencies: dependencies.map(d => ({
        file: d.relativePath,
        depth: d.depth,
        originalSize: d.originalSize,
        minifiedSize: d.minifiedSize,
        content: d.content,
        imports: d.imports || [],
      })),
      options: {
        depth: parseInt(options.depth),
        includeTarget: options.target !== false,
        includeDeps: options.deps !== false,
        compact: options.compact || false,
      },
      stats: {
        totalFiles: 1 + dependencies.length,
        totalSize: stats.size + dependencies.reduce((s, d) => s + d.minifiedSize, 0),
        totalFunctions: stats.functions + dependencies.reduce((s, d) => s + (d.functions || 0), 0),
        maxDepth: Math.max(...dependencies.map(d => d.depth), 0),
      },
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Генерирует текстовый промпт
   */
  private generateTextPrompt(
    filePath: string,
    content: string,
    stats: FileStats,
    dependencies: DependencyInfo[],
    options: any
  ): string {
    let prompt = '=== AI PROMPT PACK ===\n\n';
    prompt += `Generated: ${new Date().toLocaleString()}\n`;
    prompt += `Target: ${filePath}\n`;
    prompt += `Files: ${1 + dependencies.length}\n`;
    prompt += `Depth: ${options.depth}\n\n`;
    prompt += '='.repeat(60) + '\n\n';

    prompt += 'TARGET FILE:\n';
    prompt += '-'.repeat(40) + '\n';
    prompt += content + '\n\n';
    prompt += '='.repeat(60) + '\n\n';

    if (dependencies.length > 0) {
      prompt += 'DEPENDENCIES:\n';
      prompt += '-'.repeat(40) + '\n';
      for (const dep of dependencies) {
        prompt += `\n[${dep.relativePath}] (depth ${dep.depth})\n`;
        prompt += dep.content + '\n';
      }
      prompt += '\n' + '='.repeat(60) + '\n\n';
    }

    prompt += 'STATISTICS:\n';
    prompt += '-'.repeat(40) + '\n';
    prompt += `Target size: ${(stats.size / 1024).toFixed(2)} KB\n`;
    prompt += `Target lines: ${stats.lines}\n`;
    prompt += `Target functions: ${stats.functions}\n`;
    prompt += `Dependencies: ${dependencies.length}\n`;
    prompt += `Total size: ${((stats.size + dependencies.reduce((s, d) => s + d.minifiedSize, 0)) / 1024).toFixed(2)} KB\n`;

    return prompt;
  }

  /**
   * Генерирует якорь для Markdown
   */
  private generateAnchor(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

// ============================================
// ТИПЫ
// ============================================

interface FileStats {
  size: number;
  lines: number;
  functions: number;
  imports: number;
}

interface DependencyInfo {
  path: string;
  relativePath: string;
  content: string;
  originalSize: number;
  minifiedSize: number;
  depth: number;
  imports?: string[];
  functions?: number;
}

// Экспорт по умолчанию
export default PromptPackCommand;
