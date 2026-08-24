// src/modes/vue-analyzer/report.ts

import type { VueComponentAnalysis } from './types.js';

/**
 * Генерация отчета по Vue компоненту
 */
export function generateVueComponentReport(analysis: VueComponentAnalysis): string {
  let report = `# 🎯 Анализ Vue компонента: ${analysis.componentName}\n\n`;

  report += '## 📊 Статистика\n';
  report += `- **Размер файла:** ${(analysis.stats.totalSize / 1024).toFixed(2)} KB\n`;
  report += `- **Скрипт:** ${analysis.stats.scriptLines} строк (${analysis.script.isSetup ? 'setup' : 'options API'})\n`;
  report += `- **Шаблон:** ${analysis.stats.templateLines} строк\n`;
  report += `- **Стили:** ${analysis.stats.styleCount} блоков\n`;
  report += `- **TypeScript:** ${analysis.script.isTS ? '✅' : '❌'}\n\n`;

  // Функции
  if (analysis.functions.length > 0) {
    report += `## 🔧 Функции (${analysis.functions.length})\n\n`;
    report += '| Имя | Строка | Async | Экспорт | Параметры |\n';
    report += '|-----|--------|-------|---------|-----------|\n';
    for (const func of analysis.functions) {
      report += `| \`${func.name}\` | ${func.line} | ${func.isAsync ? '✅' : '❌'} | ${func.isExported ? '✅' : '❌'} | ${func.params.join(', ') || '-'} |\n`;
    }
    report += '\n';
  }

  // Константы
  if (analysis.constants.length > 0) {
    report += `## 📌 Константы (${analysis.constants.length})\n\n`;
    report += '| Имя | Значение | Экспорт |\n';
    report += '|-----|----------|---------|\n';
    for (const c of analysis.constants) {
      const value = typeof c.value === 'string' ? c.value.substring(0, 50) : String(c.value);
      report += `| \`${c.name}\` | \`${value}${value.length > 50 ? '...' : ''}\` | ${c.isExported ? '✅' : '❌'} |\n`;
    }
    report += '\n';
  }

  // Композаблы
  if (analysis.composables.length > 0) {
    report += `## 🧩 Composables (${analysis.composables.length})\n\n`;
    for (const comp of analysis.composables) {
      report += `- **${comp.name}** → переменная \`${comp.source}\`\n`;
      if (comp.args.length > 0) {
        report += `  - Аргументы: ${comp.args.join(', ')}\n`;
      }
    }
    report += '\n';
  }

  // Props
  if (analysis.props.names.length > 0) {
    report += `## 📥 Props (${analysis.props.names.length})\n\n`;
    report += '| Имя | Тип | Обязательный | По умолчанию |\n';
    report += '|-----|-----|--------------|--------------|\n';
    for (const name of analysis.props.names) {
      const type = analysis.props.types[name] || 'any';
      const required = analysis.props.required[name] ? '✅' : '❌';
      const defaultValue =
        analysis.props.defaults[name] !== undefined ? String(analysis.props.defaults[name]) : '-';
      report += `| \`${name}\` | \`${type}\` | ${required} | ${defaultValue} |\n`;
    }
    report += '\n';
  }

  // Events
  if (analysis.emits.names.length > 0) {
    report += `## 📤 Events (${analysis.emits.names.length})\n\n`;
    for (const name of analysis.emits.names) {
      const typeInfo = analysis.emits.types[name] ? `: \`${analysis.emits.types[name]}\`` : '';
      report += `- **${name}**${typeInfo}\n`;
    }
    report += '\n';
  }

  // Slots
  if (analysis.slots.length > 0) {
    report += `## 🎭 Slots (${analysis.slots.length})\n\n`;
    for (const slot of analysis.slots) {
      report += `- \`${slot}\`\n`;
    }
    report += '\n';
  }

  // Типы
  if (analysis.types.length > 0) {
    report += `## 📝 Типы (${analysis.types.length})\n\n`;
    for (const type of analysis.types) {
      report += `- \`${type.name}\` = \`${type.definition}\`${type.isExported ? ' 📤' : ''}\n`;
    }
    report += '\n';
  }

  // Интерфейсы
  if (analysis.interfaces.length > 0) {
    report += `## 📐 Интерфейсы (${analysis.interfaces.length})\n\n`;
    for (const intf of analysis.interfaces) {
      report += `- \`${intf.name}\`${intf.isExported ? ' 📤' : ''}\n`;
      if (intf.extends && intf.extends.length > 0) {
        report += `  extends: ${intf.extends.join(', ')}\n`;
      }
      if (intf.properties.length > 0) {
        report += `  properties: ${intf.properties.join(', ')}\n`;
      }
    }
    report += '\n';
  }

  // Импорты
  if (analysis.imports.length > 0) {
    report += `## 📦 Импорты (${analysis.imports.length})\n\n`;
    const externalImports = analysis.imports.filter(i => !i.source.startsWith('.'));
    const internalImports = analysis.imports.filter(i => i.source.startsWith('.'));

    if (externalImports.length > 0) {
      report += '### Внешние зависимости\n';
      for (const imp of externalImports) {
        report += `- \`${imp.source}\` → ${imp.specifiers.join(', ')}\n`;
      }
      report += '\n';
    }

    if (internalImports.length > 0) {
      report += '### Локальные модули\n';
      for (const imp of internalImports) {
        report += `- \`${imp.source}\` → ${imp.specifiers.join(', ')}\n`;
      }
      report += '\n';
    }
  }

  // Граф вызовов
  const hasCalls = Object.values(analysis.callGraph).some(arr => arr.length > 0);
  if (hasCalls) {
    report += `## 🔗 Граф вызовов\n\n`;
    report += '```\n';
    for (const [caller, callees] of Object.entries(analysis.callGraph)) {
      if (callees.length > 0) {
        report += `${caller} → ${callees.join(', ')}\n`;
      }
    }
    report += '```\n\n';
  }

  // Рекомендации
  report += '---\n';
  report += '## 💡 Рекомендации по разбиению\n\n';

  if (analysis.template.complexity > 50) {
    report += `⚠️ **Шаблон слишком большой** (${analysis.template.complexity} элементов). Рекомендуется вынести части в отдельные компоненты.\n\n`;
  }

  if (analysis.props.names.length > 10) {
    report += `⚠️ **Много props** (${analysis.props.names.length}). Возможно, компонент пытается делать слишком много.\n\n`;
  }

  if (analysis.composables.length > 5) {
    report += `⚠️ **Много composables** (${analysis.composables.length}). Рассмотрите группировку связанной логики.\n\n`;
  }

  if (analysis.stats.scriptLines > 300) {
    report += `⚠️ **Скрипт слишком большой** (${analysis.stats.scriptLines} строк). Разбейте на несколько composables.\n\n`;
  }

  report += '---\n';

  return report;
}