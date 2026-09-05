// src/reporters/modules/summary.ts
import type { ProjectSummary } from '../../types.js';
import type { EnhancedPackageLockReport } from './types.js';

/**
 * Строит резюме проекта
 */
export function buildSummary(report: EnhancedPackageLockReport): ProjectSummary {
  const packages = Object.values(report.packages || {});
  const hasVue = packages.some(p => p.language === 'vue' || p.language === 'jsx');
  const hasTypescript = packages.some(p => p.language === 'typescript');
  const hasJavaScript = packages.some(p => p.language === 'javascript');

  // Определяем тип проекта
  let projectType: 'monorepo' | 'single' | 'unknown' = 'unknown';
  const packageCount = Object.keys(report.packages || {}).length;

  if (packageCount > 1) {
    // Проверяем, есть ли несколько корневых модулей
    const roots = Object.values(report.packages || {}).filter(p => p.isEntry);
    if (roots.length > 1) {
      projectType = 'monorepo';
    } else {
      projectType = 'single';
    }
  } else if (packageCount === 1) {
    projectType = 'single';
  }

  // Находим точку входа
  let entryPoint = 'unknown';
  for (const [path, pkg] of Object.entries(report.packages || {})) {
    if (pkg.isEntry) {
      entryPoint = path;
      break;
    }
  }

  // Если не нашли entry point, берем первый пакет
  if (entryPoint === 'unknown' && packageCount > 0) {
    const firstPath = Object.keys(report.packages || {})[0];
    if (firstPath) {
      entryPoint = firstPath;
    }
  }

  // Вычисляем статистику
  let totalModules = packageCount;
  let totalFunctions = 0;
  let vueComponents = 0;
  let hasCycles = false;
  let maxDepth = 0;

  // Получаем данные из архитектурных метрик, если они есть
  const archMetrics = report.architectureMetrics;
  if (archMetrics) {
    totalModules = archMetrics.totalModules || packageCount;
    totalFunctions = archMetrics.totalFunctions || 0;
    vueComponents = archMetrics.vueComponents || 0;
    hasCycles = archMetrics.hasCycles || false;
    maxDepth = archMetrics.maxDepth || 0;
  } else {
    // Fallback: вычисляем из пакетов через entities.functions
    for (const pkg of packages) {
      if (pkg.entities && pkg.entities.functions) {
        totalFunctions += pkg.entities.functions.length;
      }
      if (pkg.language === 'vue') {
        vueComponents++;
      }
    }

    // Проверяем циклы в графе зависимостей
    const graph = report.dependencyGraph;
    if (graph) {
      // Проверяем наличие циклов через анализ inward/outward зависимостей
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      const dfs = (node: string) => {
        if (recursionStack.has(node)) {
          hasCycles = true;
          return;
        }
        if (visited.has(node)) return;

        visited.add(node);
        recursionStack.add(node);

        const deps = graph.outwardDependencies[node] || [];
        for (const dep of deps) {
          dfs(dep);
          if (hasCycles) break;
        }

        recursionStack.delete(node);
      };

      for (const node of Object.keys(graph.outwardDependencies)) {
        if (!visited.has(node)) {
          dfs(node);
          if (hasCycles) break;
        }
      }
    }
  }

  // Определяем здоровье архитектуры
  let architectureHealth: 'healthy' | 'moderate' | 'unhealthy' = 'healthy';

  if (hasCycles) {
    architectureHealth = 'unhealthy';
  } else if (totalModules > 50 && totalFunctions > 500) {
    architectureHealth = 'moderate';
  } else if (totalModules > 100) {
    architectureHealth = 'moderate';
  }

  // Технологии
  const technologies: string[] = [];
  if (hasTypescript) technologies.push('TypeScript');
  if (hasJavaScript) technologies.push('JavaScript');
  if (hasVue) technologies.push('Vue');

  // Краткое резюме
  let quickSummary = '';
  if (architectureHealth === 'healthy') {
    quickSummary = '✅ Архитектура здорова. Нет циклических зависимостей.';
  } else if (architectureHealth === 'moderate') {
    quickSummary = '⚠️ Архитектура требует внимания. Возможны проблемы с масштабированием.';
  } else {
    quickSummary = '❌ Обнаружены критические проблемы: циклические зависимости.';
  }

  if (hasCycles) {
    quickSummary += ' 🔄 Обнаружены циклические зависимости!';
  }

  return {
    projectType,
    entryPoint,
    totalModules,
    totalFunctions,
    vueComponents,
    hasCycles,
    maxDepth,
    architectureHealth,
    quickSummary,
    technologies: technologies.length > 0 ? technologies : undefined,
  };
}

/**
 * Строит краткое резюме проекта
 */
export function buildQuickSummary(report: EnhancedPackageLockReport): string {
  const summary = buildSummary(report);
  let result = `📊 Статистика проекта:\n`;
  result += `   📁 Тип: ${summary.projectType}\n`;
  result += `   📄 Точка входа: ${summary.entryPoint}\n`;
  result += `   📦 Модулей: ${summary.totalModules}\n`;
  result += `   🔧 Функций: ${summary.totalFunctions}\n`;
  result += `   🧩 Vue компонентов: ${summary.vueComponents}\n`;
  result += `   🔄 Циклических зависимостей: ${summary.hasCycles ? '✅ ЕСТЬ' : '❌ НЕТ'}\n`;
  result += `   📏 Максимальная глубина: ${summary.maxDepth}\n`;
  result += `   🏥 Здоровье архитектуры: ${summary.architectureHealth}\n`;
  if (summary.technologies && summary.technologies.length > 0) {
    result += `   🛠️ Технологии: ${summary.technologies.join(', ')}\n`;
  }
  return result;
}

/**
 * Проверяет, есть ли критические проблемы
 */
export function hasCriticalIssues(summary: ProjectSummary): boolean {
  return summary.hasCycles || summary.architectureHealth === 'unhealthy';
}

/**
 * Проверяет, требует ли проект внимания
 */
export function requiresAttention(summary: ProjectSummary): boolean {
  return summary.architectureHealth !== 'healthy' || summary.totalModules > 100;
}

/**
 * Возвращает рекомендованные действия
 */
export function getRecommendations(summary: ProjectSummary): string[] {
  const recommendations: string[] = [];

  if (summary.hasCycles) {
    recommendations.push('🔴 Устраните циклические зависимости');
    recommendations.push('   - Выделите общий код в отдельный модуль');
    recommendations.push('   - Используйте Dependency Injection');
    recommendations.push('   - Внедрите интерфейсы для разрыва связей');
  }

  if (summary.totalModules > 100) {
    recommendations.push('📦 Рассмотрите разбиение на подпроекты или монорепозиторий');
  }

  if (summary.totalFunctions > 1000) {
    recommendations.push('🔧 Оптимизируйте количество функций, возможно дублирование кода');
  }

  if (summary.vueComponents > 50) {
    recommendations.push(
      '⚛️ Рассмотрите использование композиции (composables) для Vue компонентов'
    );
  }

  if (summary.maxDepth > 10) {
    recommendations.push('📏 Слишком глубокая вложенность зависимостей. Рассмотрите рефакторинг.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Архитектура в отличном состоянии!');
  }

  return recommendations;
}

/**
 * Генерирует полный отчет по проекту
 */
export function generateProjectSummaryReport(report: EnhancedPackageLockReport): string {
  const summary = buildSummary(report);
  const recommendations = getRecommendations(summary);

  let output = '='.repeat(70) + '\n';
  output += '📊 SUMMARY\n';
  output += '='.repeat(70) + '\n\n';

  output += `📁 Project Type: ${summary.projectType}\n`;
  output += `📄 Entry Point: ${summary.entryPoint}\n`;
  output += `📦 Total Modules: ${summary.totalModules}\n`;
  output += `🔧 Total Functions: ${summary.totalFunctions}\n`;
  output += `🧩 Vue Components: ${summary.vueComponents}\n`;
  output += `🔄 Has Cycles: ${summary.hasCycles ? 'YES ❌' : 'NO ✅'}\n`;
  output += `📏 Max Depth: ${summary.maxDepth}\n`;
  output += `🏥 Architecture Health: ${summary.architectureHealth.toUpperCase()}\n`;

  if (summary.technologies && summary.technologies.length > 0) {
    output += `🛠️ Technologies: ${summary.technologies.join(', ')}\n`;
  }

  output += '\n' + '='.repeat(70) + '\n';
  output += '💡 RECOMMENDATIONS\n';
  output += '='.repeat(70) + '\n\n';

  for (const rec of recommendations) {
    output += `  ${rec}\n`;
  }

  output += '\n' + '='.repeat(70) + '\n';
  output += `📅 Generated: ${new Date().toISOString()}\n`;
  output += '='.repeat(70) + '\n';

  return output;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  buildSummary,
  buildQuickSummary,
  hasCriticalIssues,
  requiresAttention,
  getRecommendations,
  generateProjectSummaryReport,
};
