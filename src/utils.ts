// src/utils.ts
import fs from 'fs';

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function showHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              🔍 AST ANALYZER - AI TOOLKIT v2.2                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  📁 project      <файл> [depth]   - Граф зависимостей проекта    ║
║  📄 file         <файл>           - Внутренний граф файла         ║
║  ✂️  minify       <файл>           - Сжатие одного файла для ИИ   ║
║  📁 minify-folder <каталог> [опции] - Рекурсивное сжатие проекта  ║
║  🎒 prompt-pack  <файл> [depth]   - Сборка контекста для ИИ       ║
║  🔪 split-module <файл> [опции]   - Разбиение файла на модули     ║
║  💥 impact       <файл> <entity>  - Анализ зоны влияния           ║
║  🗑️  dead-code    <файл>           - Поиск мертвого кода          ║
║  🎯 vue-analyze  <файл> [опции]   - Анализ Vue компонента         ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Использование:                                                  ║
║    npx @newkind/ast-analyzer <режим> [аргументы]                 ║
║    или                                                           ║
║    npm run dev -- <режим> [аргументы]    # для разработки        ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  split-module опции:                                             ║
║    --output, -o            <file>   Выходной файл промпта         ║
║    --target-cluster-size, -t <n>    Желаемый размер кластера (3)  ║
║    --max-cluster-size, -m  <n>      Максимальный размер (10)      ║
║    --max-depth, -d         <n>      Глубина анализа (5)           ║
║    --exclude, -x           <list>   Паттерны исключения           ║
║    --prefix, -p            <str>    Префикс для выходных файлов   ║
║    --no-full-code                    Не включать полный код        ║
║    --no-minified                     Не включать сжатую версию     ║
║    --no-graph                        Не включать граф вызовов      ║
║    --no-stats                        Не включать статистику        ║
║    --no-suggestions                  Не включать предложения       ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  minify-folder опции:                                            ║
║    --output, -o     <file>   Выходной файл (по умолч: ai-project-context.md)
║    --depth, -d      <n>      Глубина рекурсии (по умолч: 10)
║    --extensions, -e <list>   Расширения через запятую
║    --exclude, -x    <list>   Паттерны для исключения
║    --no-structure             Не показывать структуру каталога
║    --no-toc                   Не показывать оглавление
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  vue-analyze опции:                                              ║
║    --no-template-ast             Не включать AST шаблона          ║
║    --no-script-ast               Не включать AST скрипта          ║
║    --no-composables              Не искать вызовы композаблов     ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Примеры:                                                        ║
║    # Разбиение файла на модули                                   ║
║    npx @newkind/ast-analyzer split-module ./src/monolith.js      ║
║    npx @newkind/ast-analyzer split-module ./src/app.ts -t 4 -m 8 ║
║                                                                  ║
║    # Рекурсивное сжатие проекта                                  ║
║    npx @newkind/ast-analyzer minify-folder ./src -d 2            ║
║    npx @newkind/ast-analyzer minify-folder ./src -e .js,.ts      ║
║                                                                  ║
║    # Анализ Vue компонента                                       ║
║    npx @newkind/ast-analyzer vue-analyze ./src/App.vue           ║
║    npx @newkind/ast-analyzer vue ./src/components/Button.vue     ║
║                                                                  ║
║    # Другие режимы                                               ║
║    npx @newkind/ast-analyzer project ./src/index.js 3            ║
║    npx @newkind/ast-analyzer impact ./src/db.ts findUser         ║
║    npx @newkind/ast-analyzer dead-code ./src/legacy.js           ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
}

export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.cache',
  '.next',
  'out',
  '.nuxt',
  '.output',
  '.vercel',
  'tmp',
  'temp',
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function generateTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function renderNode(node: any, indent = ''): string {
  let result = '';
  const entries = Object.entries(node);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Проверка на undefined
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
}
