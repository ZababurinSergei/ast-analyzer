// reporters/markdown-reporter.ts
import fs from 'fs';
import path from 'path';
import type { AnalysisResult, Cluster, ExportInfo, ImportInfo } from '../types.js';

/**
 * Экранирует специальные символы Markdown
 * @param str Исходная строка
 * @returns Экранированная строка
 */
export function escapeMarkdown(str: string): string {
  return str
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.') // ← Исправлено: добавлен .replace
    .replace(/!/g, '\\!');
}

/**
 * Генерирует Markdown отчет со статистикой файла
 * @param analysis Результат анализа
 * @returns Markdown строка со статистикой
 */
export function generateStatsMarkdown(analysis: AnalysisResult): string {
  let markdown = '## 📊 СТАТИСТИКА ФАЙЛА\\n\\n';
  markdown += '| Показатель | Значение |\\n';
  markdown += '|------------|----------|\\n';
  markdown += `| Всего строк | ${analysis.stats.totalLines} |\\n`;
  markdown += `| Экспортируемых сущностей | ${analysis.stats.totalExports} |\\n`;
  markdown += `| Функций | ${analysis.stats.totalFunctions} |\\n`;
  markdown += `| Классов | ${analysis.stats.totalClasses} |\\n`;
  markdown += `| Констант | ${analysis.stats.totalConstants} |\\n`;
  markdown += `| Интерфейсов/Типов | ${analysis.stats.totalInterfaces + analysis.stats.totalTypes} |\\n`;
  markdown += `| Импортов | ${analysis.stats.totalImports} |\\n\\n`;
  markdown += '---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с экспортами
 * @param exports Список экспортов
 * @returns Markdown строка с экспортами
 */
export function generateExportsMarkdown(exports: ExportInfo[]): string {
  if (exports.length === 0) return '';

  let markdown = '## 📤 ЭКСПОРТИРУЕМЫЕ СУЩНОСТИ\\n\\n';
  markdown += '| Имя | Тип | Строки |\\n';
  markdown += '|-----|-----|--------|\\n';
  for (const exp of exports) {
    const lines = exp.endLine && exp.startLine ? `${exp.startLine}-${exp.endLine}` : '?';
    markdown += `| \`${escapeMarkdown(exp.name)}\` | ${exp.type} | ${lines} |\\n`;
  }
  markdown += '\\n---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с импортами
 * @param imports Список импортов
 * @returns Markdown строка с импортами
 */
export function generateImportsMarkdown(imports: ImportInfo[]): string {
  if (imports.length === 0) return '';

  let markdown = '## 📥 ИМПОРТЫ\\n\\n';
  markdown += '```typescript\\n';
  for (const imp of imports) {
    const spec = imp.specifiers
      .map(s => (s.imported === s.local ? s.imported : `${s.imported} as ${s.local}`))
      .join(', ');
    markdown += `import { ${spec} } from '${imp.source}';\\n`;
  }
  markdown += '```\\n\\n---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с кластерами
 * @param clusters Список кластеров
 * @returns Markdown строка с кластерами
 */
export function generateClustersMarkdown(clusters: Cluster[]): string {
  if (clusters.length === 0) return '';

  let markdown = '## 🔍 ВЫЯВЛЕННЫЕ КЛАСТЕРЫ (КАНДИДАТЫ В МОДУЛИ)\\n\\n';
  markdown += 'На основе анализа вызовов функций (call graph) выявлены следующие кластеры:\\n\\n';

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    if (!cluster) continue;

    markdown += `### ${i + 1}. Кластер: \`${cluster.name}\`\\n`;
    markdown += `- **Тип:** ${cluster.type === 'core' ? '🔷 Основной (экспортируемый)' : '🔶 Вспомогательный (внутренний)'}\\n`;
    markdown += `- **Размер:** ${cluster.size} сущностей\\n`;
    markdown += `- **Связность:** ${cluster.cohesionScore.toFixed(1)}%\\n`;
    markdown += `- **Рекомендация:** ${cluster.recommendation}\\n`;
    markdown += `- **Функции:** ${cluster.functions.map(f => `\`${f}\``).join(', ')}\\n`;

    if (cluster.dependencies && cluster.dependencies.length > 0) {
      markdown += `- **Зависимости:** ${cluster.dependencies.map(d => `\`${d}\``).join(', ')}\\n`;
    }
    markdown += '\\n';
  }
  markdown += '---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с циклическими зависимостями
 * @param cyclicEdges Множество циклических зависимостей
 * @returns Markdown строка с циклами
 */
export function generateCyclicEdgesMarkdown(cyclicEdges: Set<string>): string {
  if (cyclicEdges.size === 0) return '';

  let markdown = '## ⚠️ ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ\\n\\n';
  markdown +=
    'Обнаружены циклические зависимости, которые необходимо устранить при разбиении:\\n\\n';
  for (const edge of cyclicEdges) {
    markdown += `- 🔴 \`${escapeMarkdown(edge)}\`\\n`;
  }
  markdown += '\\n---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с предлагаемой структурой модулей
 * @param targetFile Целевой файл
 * @param clusters Список кластеров
 * @returns Markdown строка со структурой
 */
export function generateSuggestedStructureMarkdown(
  targetFile: string,
  clusters: Cluster[]
): string {
  let markdown = '## 🎯 ПРЕДЛАГАЕМАЯ СТРУКТУРА МОДУЛЕЙ\\n\\n';
  markdown += 'На основе анализа предлагается следующая структура:\\n\\n';
  markdown += `\`\`\`\\n${path.dirname(targetFile)}/\\n`;
  markdown += '├── index.ts                 # Точка входа (реэкспорт)\\n';
  markdown += '├── types.ts                 # Общие интерфейсы и типы\\n';

  for (let i = 0; i < Math.min(clusters.length, 5); i++) {
    const cluster = clusters[i];
    if (!cluster) continue;

    const moduleName = cluster.name.replace(/Cluster$/, '').toLowerCase();
    const functionsList = cluster.functions.slice(0, 3);
    const suffix = cluster.functions.length > 3 ? '...' : '';
    markdown += `├── ${moduleName}.ts          # ${functionsList.join(', ')}${suffix}\\n`;
  }

  markdown += '└── utils.ts                 # Общие утилиты\\n';
  markdown += '```\\n\\n---\\n\\n';
  return markdown;
}

/**
 * Генерирует Markdown отчет с графом вызовов
 * @param callGraph Граф вызовов
 * @returns Markdown строка с графом
 */
export function generateCallGraphMarkdown(callGraph: Record<string, string[]>): string {
  if (Object.keys(callGraph).length === 0) return '';

  let markdown = '## 🕸️ ГРАФ ВЫЗОВОВ (Call Graph)\\n\\n';
  markdown += '```\\n';
  for (const [caller, callees] of Object.entries(callGraph)) {
    if (callees.length > 0) {
      markdown += `${caller} → ${callees.join(', ')}\\n`;
    }
  }
  markdown += '```\\n\\n---\\n\\n';
  return markdown;
}

/**
 * Генерирует полный Markdown промпт для разбиения файла
 * @param targetFile Целевой файл
 * @param analysis Результат анализа
 * @param clusters Список кластеров
 * @param cyclicEdges Циклические зависимости
 * @param minified Сжатая версия кода
 * @param fullCode Полный код файла
 * @param options Опции генерации
 * @returns Полный Markdown промпт
 */
export function generateSplitModulePromptMarkdown(
  targetFile: string,
  analysis: AnalysisResult,
  clusters: Cluster[],
  cyclicEdges: Set<string>,
  minified: string,
  fullCode: string,
  options: {
    targetClusterSize: number;
    maxClusterSize: number;
    maxDepth: number;
    excludePatterns: string[];
    prefix?: string;
    includeStats?: boolean;
    includeSuggestions?: boolean;
    includeFullCode?: boolean;
    includeMinified?: boolean;
    includeGraph?: boolean;
  }
): string {
  let markdown = '# 🔪 РАЗБИЕНИЕ ФАЙЛА НА МОДУЛИ\\n\\n';
  markdown += `**Сгенерировано:** ${new Date().toLocaleString()}\\n`;
  markdown += `**Целевой файл:** \`${targetFile}\`\\n`;
  markdown += `**Размер файла:** ${(fs.statSync(targetFile).size / 1024).toFixed(2)} KB\\n`;
  markdown += `**Количество строк:** ${analysis.stats.totalLines}\\n`;
  markdown += '**Параметры анализа:**\\n';
  markdown += `- Целевой размер кластера: ${options.targetClusterSize}\\n`;
  markdown += `- Максимальный размер кластера: ${options.maxClusterSize}\\n`;
  markdown += `- Глубина анализа: ${options.maxDepth}\\n`;
  if (options.prefix) markdown += `- Префикс файлов: ${options.prefix}\\n`;
  markdown += `- Паттерны исключения: \`${options.excludePatterns.join(', ')}\`\\n\\n`;

  markdown += '---\\n\\n';

  markdown += '## 📋 ИНСТРУКЦИЯ ДЛЯ ИИ\\n\\n';
  markdown +=
    'Ты — эксперт по рефакторингу кода. Твоя задача — **разбить монолитный файл на логически связанные модули**.\\n\\n';
  markdown += '### Критерии выделения модуля:\\n\\n';
  markdown += '1. **Связность (Cohesion)** — функции/классы, которые часто вызывают друг друга\\n';
  markdown +=
    '2. **Ответственность (Responsibility)** — общая тема/домен (например, валидация, API, UI)\\n';
  markdown +=
    '3. **Переиспользование (Reusability)** — сущности, которые могут быть полезны отдельно\\n';
  markdown += '4. **Тестируемость (Testability)** — можно тестировать независимо\\n';
  markdown += '5. **Размер модуля** — рекомендуется 50-200 строк на модуль\\n\\n';

  markdown += '### Анти-паттерны, которых следует избегать:\\n\\n';
  markdown += '- ❌ Циклические зависимости между модулями\\n';
  markdown += '- ❌ Один модуль знает слишком много о других\\n';
  markdown += '- ❌ "Мусорный" модуль (Utils) со всем подряд\\n';
  markdown += '- ❌ Слишком мелкие модули (1-2 функции)\\n';
  markdown += '- ❌ Слишком крупные модули (>300 строк)\\n\\n';

  markdown += '---\\n\\n';

  // Статистика
  if (options.includeStats !== false) {
    markdown += generateStatsMarkdown(analysis);
  }

  // Экспорты
  markdown += generateExportsMarkdown(analysis.exports);

  // Импорты
  markdown += generateImportsMarkdown(analysis.imports);

  // Кластеры
  if (options.includeSuggestions !== false && clusters.length > 0) {
    markdown += generateClustersMarkdown(clusters);
  }

  // Циклические зависимости
  markdown += generateCyclicEdgesMarkdown(cyclicEdges);

  // Предлагаемая структура
  if (options.includeSuggestions !== false) {
    markdown += generateSuggestedStructureMarkdown(targetFile, clusters);
  }

  // Полный код
  if (options.includeFullCode !== false) {
    const ext = path.extname(targetFile).slice(1);
    const lang = ext === 'ts' || ext === 'tsx' || ext === 'vue' ? 'typescript' : 'javascript';
    markdown += '## 📄 ПОЛНЫЙ КОД ФАЙЛА\\n\\n';
    markdown += `### \`${path.basename(targetFile)}\`\\n`;
    markdown += `\`\`\`${lang}\\n${fullCode}\\n\`\`\`\\n\\n---\\n\\n`;
  }

  // Сжатая версия
  if (options.includeMinified !== false && minified) {
    markdown += '## ✂️ СЖАТАЯ ВЕРСИЯ (только сигнатуры)\\n\\n';
    markdown += `\`\`\`typescript\\n${minified}\\n\`\`\`\\n\\n---\\n\\n`;
  }

  // Граф вызовов
  if (options.includeGraph !== false && Object.keys(analysis.callGraph).length > 0) {
    markdown += generateCallGraphMarkdown(analysis.callGraph);
  }

  // Ожидаемый ответ
  markdown += '## 📤 ОЖИДАЕМЫЙ ФОРМАТ ОТВЕТА\\n\\n';
  markdown += '### 1. Анализ текущей структуры (2-3 предложения)\\n\\n';
  markdown += '### 2. Предлагаемая структура модулей\\n\\n';
  markdown += `\`\`\`\\n${path.dirname(targetFile)}/\\n`;
  markdown += '├── modules/\\n';
  markdown += '│   ├── module-a.ts\\n';
  markdown += '│   ├── module-b.ts\\n';
  markdown += '│   └── module-c.ts\\n';
  markdown += '├── types.ts\\n';
  markdown += '└── index.ts\\n';
  markdown += '```\\n\\n';
  markdown += '### 3. Код каждого нового модуля\\n\\n';
  markdown += 'Для каждого модуля укажи:\\n';
  markdown += '- Полный код файла\\n';
  markdown += '- Какие функции/классы переносятся\\n';
  markdown += '- Новые импорты/экспорты\\n\\n';
  markdown += '### 4. Обновленный корневой файл (index.ts)\\n\\n';
  markdown += '### 5. План миграции (пошагово)\\n\\n';

  return markdown;
}
