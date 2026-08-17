// src/modes/hybrid-report/generators/markdown.ts

import type { HybridReport, HybridFunction } from '../types.js';

/**
 * Генерирует Markdown отчет на основе данных HybridReport
 * @param report - Объект отчета
 * @returns Строка в формате Markdown
 */
export function generateHybridMarkdown(report: HybridReport): string {
  let md = '# 🔀 ГИБРИДНЫЙ ОТЧЕТ: МОДУЛИ + ФУНКЦИИ\n\n';

  md += `**Точка входа:** \`${report.root}\`\n`;
  md += `**Дата:** ${new Date().toLocaleString()}\n\n`;

  // ============================================
  // СТАТИСТИКА
  // ============================================
  md += '## 📊 СТАТИСТИКА\n\n';
  md += '| Показатель | Значение |\n';
  md += '|------------|----------|\n';
  md += `| Модулей | ${report.stats.totalModules} |\n`;
  md += `| Функций | ${report.stats.totalFunctions} |\n`;
  md += `| Экспортов | ${report.stats.totalExports} |\n`;
  md += `| Импортов | ${report.stats.totalImports} |\n`;
  md += `| Компонентов | ${report.stats.totalComponents} |\n`;
  md += `| Композаблов | ${report.stats.totalComposables} |\n`;
  md += `| Циклов | ${report.stats.cycles} |\n`;
  md += `| Глубина | ${report.stats.maxDepth} |\n\n`;

  // ============================================
  // СТАТИСТИКА ПО УРОВНЯМ
  // ============================================
  md += '### По уровням\n\n';
  md += '| Уровень | Модулей | Функций |\n';
  md += '|---------|---------|---------|\n';

  const sortedLevels = Object.entries(report.stats.byLevel).sort(
    (a, b) => parseInt(a[0]) - parseInt(b[0])
  );

  for (const [level, data] of sortedLevels) {
    md += `| ${level} | ${data.modules} | ${data.functions} |\n`;
  }
  md += '\n';

  // ============================================
  // МОДУЛИ
  // ============================================
  md += '## 📁 МОДУЛИ\n\n';

  // Сортируем модули по уровню
  const sortedModules = [...report.modules].sort((a, b) => a.level - b.level);

  for (const module of sortedModules) {
    const isRoot = module.path === report.root;
    md += `### ${isRoot ? '⭐ ' : ''}${module.name}\n`;
    md += `**Путь:** \`${module.path}\`\n`;
    md += `**Тип:** ${module.type}\n`;
    md += `**Уровень:** ${module.level}\n\n`;

    // Экспорты
    if (module.exports.length > 0) {
      md += '**Экспорты:**\n';
      for (const exp of module.exports) {
        md += `- \`${exp}\`\n`;
      }
      md += '\n';
    }

    // Импорты
    if (module.imports.length > 0) {
      md += '**Импорты:**\n';
      for (const imp of module.imports) {
        md += `- \`${imp}\`\n`;
      }
      md += '\n';
    }

    // Функции
    if (module.functions.length > 0) {
      md += '**Функции:**\n';

      // Сортируем функции: сначала экспортированные, затем внутренние
      const sortedFunctions = [...module.functions].sort((a, b) => {
        if (a.isExported && !b.isExported) return -1;
        if (!a.isExported && b.isExported) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const func of sortedFunctions) {
        const exported = func.isExported ? ' 📤' : '';
        const async = func.isAsync ? ' ⚡' : '';
        const calls = func.calls.length > 0 ? ` → ${func.calls.join(', ')}` : '';
        const source =
          func.exportSource === 'self'
            ? ' (self)'
            : func.exportSource === 'external'
              ? ` (from ${func.exportModule})`
              : ' (re-export)';

        md += `- \`${func.name}\`${exported}${async}${calls}${source}\n`;
        md += `  - Строки: ${func.startLine}-${func.endLine}\n`;
        md += `  - Параметры: ${func.params.length > 0 ? func.params.join(', ') : 'нет'}\n`;

        if (func.body && func.body.length > 0) {
          const bodyPreview =
            func.body.length > 100 ? func.body.substring(0, 100) + '...' : func.body;
          md += `  - Тело: \`${bodyPreview}\`\n`;
        }
      }
      md += '\n';
    }

    // Компоненты (Vue/React)
    if (module.components.length > 0) {
      md += '**Компоненты:**\n';
      for (const comp of module.components) {
        md += `- \`${comp}\`\n`;
      }
      md += '\n';
    }

    // Композаблы (Vue composables)
    if (module.composables.length > 0) {
      md += '**Композаблы:**\n';
      for (const comp of module.composables) {
        md += `- \`${comp}\`\n`;
      }
      md += '\n';
    }

    md += '---\n\n';
  }

  // ============================================
  // ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ
  // ============================================
  if (report.cycles.length > 0) {
    md += '## 🔄 ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ\n\n';
    md += `Обнаружено **${report.cycles.length}** циклических зависимостей:\n\n`;

    for (const cycle of report.cycles) {
      md += `- ${cycle.join(' → ')}\n`;
    }
    md += '\n';

    md += '### ⚠️ Рекомендации по устранению циклов\n\n';
    md += '1. **Выделите общий код** в отдельный модуль\n';
    md += '2. **Используйте Dependency Injection** вместо прямых зависимостей\n';
    md += '3. **Внедрите интерфейсы** для разрыва жестких связей\n';
    md += '4. **Пересмотрите архитектуру** - возможно, модули должны быть на одном уровне\n';
  }

  // ============================================
  // ВЕРСИЯ И ПОДПИСЬ
  // ============================================
  md += '---\n\n';
  md += `*Сгенерировано AST Analyzer Hybrid Report v3.0.0*\n`;
  md += `*Время генерации: ${new Date().toLocaleString()}*\n`;

  return md;
}

export type { HybridFunction };
