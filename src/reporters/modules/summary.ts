// src/reporters/modules/summary.ts
// Резюме проекта

import { ProjectSummary, ArchitectureMetrics } from './types.js';

export function buildSummary(
  rootKey: string,
  metrics: ArchitectureMetrics,
  packages: Record<string, any>
): ProjectSummary {
  const isMonorepo = Object.keys(packages).some((p: string) => p.includes('packages/'));

  return {
    projectType: isMonorepo ? 'monorepo' : 'single',
    entryPoint: rootKey,
    totalModules: metrics.totalModules,
    totalFunctions: metrics.totalFunctions,
    vueComponents: metrics.vueComponents,
    hasCycles: metrics.hasCycles,
    maxDepth: metrics.maxDepth,
    architectureHealth: metrics.isAcyclic ? '✅ Healthy' : '⚠️ Has cycles',
  };
}

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С РЕЗЮМЕ
// ============================================================

/**
 * Генерирует краткое текстовое описание проекта
 */
export function generateQuickSummary(summary: ProjectSummary): string {
  const parts: string[] = [];

  parts.push(`📁 Project: ${summary.projectType === 'monorepo' ? 'Monorepo' : 'Single project'}`);
  parts.push(`📄 Entry point: ${summary.entryPoint}`);
  parts.push(`📦 Modules: ${summary.totalModules}`);
  parts.push(`ƒ Functions: ${summary.totalFunctions}`);

  if (summary.vueComponents > 0) {
    parts.push(`🎯 Vue components: ${summary.vueComponents}`);
  }

  parts.push(`🔄 Cycles: ${summary.hasCycles ? '⚠️ Yes' : '✅ No'}`);
  parts.push(`📏 Max depth: ${summary.maxDepth}`);
  parts.push(`🏗️  Health: ${summary.architectureHealth}`);

  return parts.join(' | ');
}

/**
 * Проверяет, здоров ли проект
 */
export function isProjectHealthy(summary: ProjectSummary): boolean {
  return !summary.hasCycles && summary.architectureHealth.includes('Healthy');
}

/**
 * Возвращает уровень зрелости проекта
 */
export function getProjectMaturity(
  summary: ProjectSummary
): 'excellent' | 'good' | 'needs_improvement' | 'critical' {
  let score = 0;

  // Нет циклов - хорошо
  if (!summary.hasCycles) score += 30;
  else score -= 10;

  // Малая глубина - хорошо
  if (summary.maxDepth <= 3) score += 20;
  else if (summary.maxDepth <= 5) score += 10;
  else score -= 10;

  // Много модулей - хорошо
  if (summary.totalModules >= 10) score += 20;
  else if (summary.totalModules >= 5) score += 10;

  // Много функций - хорошо
  if (summary.totalFunctions >= 50) score += 20;
  else if (summary.totalFunctions >= 20) score += 10;

  // Vue компоненты - хорошо
  if (summary.vueComponents > 0) score += 10;

  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'needs_improvement';
  return 'critical';
}

/**
 * Генерирует Markdown-отчет на основе резюме
 */
export function generateSummaryMarkdown(summary: ProjectSummary): string {
  let md = '## 📊 Project Summary\n\n';

  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| **Project Type** | ${summary.projectType} |\n`;
  md += `| **Entry Point** | \`${summary.entryPoint}\` |\n`;
  md += `| **Total Modules** | ${summary.totalModules} |\n`;
  md += `| **Total Functions** | ${summary.totalFunctions} |\n`;
  md += `| **Vue Components** | ${summary.vueComponents} |\n`;
  md += `| **Cyclic Dependencies** | ${summary.hasCycles ? '⚠️ Yes' : '✅ No'} |\n`;
  md += `| **Max Depth** | ${summary.maxDepth} |\n`;
  md += `| **Architecture Health** | ${summary.architectureHealth} |\n`;

  md += '\n';

  // Добавляем рекомендации
  if (summary.hasCycles) {
    md += '### ⚠️ Recommendations\n\n';
    md += '1. **Break cyclic dependencies** - Use dependency inversion\n';
    md += '2. **Extract common code** to separate modules\n';
    md += '3. **Review module boundaries** and responsibilities\n';
  }

  if (summary.maxDepth > 5) {
    md += '\n⚠️ **Deep dependency tree detected** (depth > 5). Consider:\n';
    md += '- Reducing unnecessary dependencies\n';
    md += '- Flattening the module structure\n';
    md += '- Using dependency injection\n';
  }

  const maturity = getProjectMaturity(summary);
  md += `\n**Maturity Level:** ${maturity.toUpperCase().replace('_', ' ')}\n`;

  return md;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildSummary,
  generateQuickSummary,
  isProjectHealthy,
  getProjectMaturity,
  generateSummaryMarkdown,
};
