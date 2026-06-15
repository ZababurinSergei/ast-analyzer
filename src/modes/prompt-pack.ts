// modes/prompt-pack.ts
import fs from 'fs';
import path from 'path';
import { buildProjectGraph } from './project-graph.js';
import { minifyForAI } from '../core/minifier.js';

/**
 * Собирает пакет промптов для ИИ: целевой файл + сжатые зависимости
 * @param entryPointFile Точка входа (файл, который нужно проанализировать)
 * @param maxDepth Максимальная глубина анализа зависимостей (по умолчанию: 2)
 * @returns Markdown строка с полным контекстом для ИИ
 */
export function buildAiPromptPack(entryPointFile: string, maxDepth = 2): string {
  const { rootKey, graph } = buildProjectGraph(entryPointFile, maxDepth);
  const allRelatedFiles = new Set([rootKey]);

  // Собираем все связанные файлы
  Object.keys(graph).forEach(key => {
    allRelatedFiles.add(key);
    const deps = graph[key];
    if (deps) {
      deps.forEach(dep => allRelatedFiles.add(dep));
    }
  });

  let markdown = '# 🧠 КОНТЕКСТ ДЛЯ ИИ АССИСТЕНТА\n\n';
  markdown += '## 📋 ИНСТРУКЦИЯ ДЛЯ ИИ:\n';
  markdown += 'Ты — ведущий инженер-разработчик. Ниже предоставлен полный контекст задачи.\n';
  markdown += '- **Целевой файл** (который нужно изменить/проанализировать) дан ПОЛНОСТЬЮ\n';
  markdown += '- **Зависимости** проекта даны в СЖАТОМ виде (только сигнатуры, без реализации)\n';
  markdown += '- Используй сигнатуры зависимостей для генерации корректного кода\n\n';

  markdown += '---\n\n';
  markdown += '## 🎯 ЦЕЛЕВОЙ ФАЙЛ\n\n';
  markdown += `### \`${rootKey}\`\n`;
  const ext = path.extname(entryPointFile).slice(1);
  const lang = ext === 'ts' || ext === 'tsx' || ext === 'vue' ? 'typescript' : 'javascript';
  markdown += `\`\`\`${lang}\n${fs.readFileSync(path.resolve(entryPointFile), 'utf-8')}\n\`\`\`\n\n`;

  markdown += '---\n\n';
  markdown += '## 🔗 ЗАВИСИМОСТИ ПРОЕКТА (сжатые)\n\n';

  let count = 0;
  for (const f of allRelatedFiles) {
    if (f === rootKey) continue;
    const abs = path.resolve(f);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      count++;
      const depExt = path.extname(abs).slice(1);
      const depLang =
        depExt === 'ts' || depExt === 'tsx' || depExt === 'vue' ? 'typescript' : 'javascript';
      markdown += `### ${count}. \`${f}\`\n`;
      markdown += `\`\`\`${depLang}\n${minifyForAI(abs)}\n\`\`\`\n\n`;
    }
  }

  if (count === 0) {
    markdown += '*⚠️ У этого файла нет локальных зависимостей в рамках указанной глубины.*\n\n';
  }

  return markdown;
}
