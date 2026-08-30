// src/reporters/modules/architecture.ts
import type { EnhancedPackageInfo, ArchitectureMetrics } from '../../types.js';
import { findCycles, getMaxDepth, getModulesByLevel } from './graphs.js';

/**
 * Создает архитектурные метрики для отчета
 * @param packages - Карта пакетов
 * @param callGraph - Граф вызовов функций
 * @param outwardDeps - Исходящие зависимости модулей
 * @returns Архитектурные метрики
 */
export function buildArchitectureMetrics(
  packages: Record<string, EnhancedPackageInfo>,
  callGraph: Record<string, string[]>,
  outwardDeps: Record<string, string[]>
): ArchitectureMetrics {
  // Инициализация метрик
  let totalModules = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalConstants = 0;
  let totalInterfaces = 0;
  let totalTypes = 0;
  let totalVariables = 0;
  let totalCalls = 0;
  let vueComponents = 0;
  let totalComposables = 0;
  let totalComplexity = 0;
  let maxComplexity = 0;
  let totalSecurityIssues = 0;
  const securityIssuesByType = {
    hasEval: 0,
    hasProcessEnv: 0,
    hasSensitiveData: 0,
    hasExec: 0,
  };

  // Проходим по всем пакетам
  for (const [_modulePath, pkg] of Object.entries(packages)) {
    if (!pkg) continue;

    totalModules++;

    // Статистика сущностей
    const entities = pkg.entities || {
      functions: [],
      classes: [],
      constants: [],
      interfaces: [],
      types: [],
      variables: [],
    };
    const functions = entities.functions || [];
    const classes = entities.classes || [];
    const constants = entities.constants || [];
    const interfaces = entities.interfaces || [];
    const types = entities.types || [];
    const variables = entities.variables || [];

    totalFunctions += functions.length;
    totalClasses += classes.length;
    totalConstants += constants.length;
    totalInterfaces += interfaces.length;
    totalTypes += types.length;
    totalVariables += variables.length;

    // Вызовы
    for (const func of functions) {
      const calls = func.calls || [];
      totalCalls += calls.length;
    }

    // Vue компоненты
    if (pkg.vueAnalysis) {
      vueComponents++;
      totalComposables += (pkg.vueAnalysis.composables || []).length;
    }

    // Сложность
    if (pkg.complexity) {
      const avgComplexity = pkg.complexity.average || 0;
      totalComplexity += avgComplexity;
      const maxComp = pkg.complexity.max || 0;
      if (maxComp > maxComplexity) {
        maxComplexity = maxComp;
      }
    }

    // Безопасность
    if (pkg.security) {
      if (pkg.security.hasEval) {
        totalSecurityIssues++;
        securityIssuesByType.hasEval++;
      }
      if (pkg.security.hasProcessEnv) {
        totalSecurityIssues++;
        securityIssuesByType.hasProcessEnv++;
      }
      if (pkg.security.hasSensitiveData) {
        totalSecurityIssues++;
        securityIssuesByType.hasSensitiveData++;
      }
      if (pkg.security.hasExec) {
        totalSecurityIssues++;
        securityIssuesByType.hasExec++;
      }
    }
  }

  // Находим циклы
  const cycles = findCycles(callGraph);
  const hasCycles = cycles.length > 0;

  // ✅ ИСПРАВЛЕНО: находим корневой модуль и передаем его в getModulesByLevel с outwardDeps
  const rootModule =
    Object.keys(packages).find(key => packages[key]?.isEntry) || Object.keys(packages)[0] || '';
  const modulesByLevel = getModulesByLevel(rootModule, outwardDeps);

  // Вычисляем максимальную глубину
  const maxDepth = getMaxDepth(outwardDeps);

  // Средняя сложность
  const averageComplexity = totalModules > 0 ? totalComplexity / totalModules : 0;

  // Возвращаем hasCycles как boolean
  return {
    totalModules,
    totalFunctions,
    totalClasses,
    totalConstants,
    totalInterfaces,
    totalTypes,
    totalVariables,
    totalCalls,
    vueComponents,
    totalComposables,
    hasCycles,
    maxDepth,
    modulesByLevel,
    isAcyclic: !hasCycles,
    averageComplexity,
    maxComplexity,
    totalSecurityIssues,
    securityIssuesByType,
  };
}

/**
 * Экспортирует архитектурные метрики в JSON
 */
export function exportArchitectureMetrics(metrics: ArchitectureMetrics): string {
  return JSON.stringify(metrics, null, 2);
}

/**
 * Генерирует Markdown отчет по архитектурным метрикам
 */
export function generateArchitectureReport(metrics: ArchitectureMetrics): string {
  let report = '# 🏗️ Архитектурные метрики\n\n';

  report += '## 📊 Общая статистика\n\n';
  report += '| Метрика | Значение |\n';
  report += '|---------|----------|\n';
  report += `| Всего модулей | ${metrics.totalModules} |\n`;
  report += `| Всего функций | ${metrics.totalFunctions} |\n`;
  report += `| Всего классов | ${metrics.totalClasses} |\n`;
  report += `| Всего констант | ${metrics.totalConstants} |\n`;
  report += `| Всего интерфейсов | ${metrics.totalInterfaces} |\n`;
  report += `| Всего типов | ${metrics.totalTypes} |\n`;
  report += `| Всего переменных | ${metrics.totalVariables} |\n`;
  report += `| Всего вызовов | ${metrics.totalCalls} |\n`;
  report += `| Vue компонентов | ${metrics.vueComponents} |\n`;
  report += `| Композаблов | ${metrics.totalComposables} |\n\n`;

  report += '## 🔄 Циклические зависимости\n\n';
  report += '| Метрика | Значение |\n';
  report += '|---------|----------|\n';
  report += `| Есть циклы | ${metrics.hasCycles ? '⚠️ ДА' : '✅ НЕТ'} |\n`;
  report += `| Максимальная глубина | ${metrics.maxDepth} |\n`;
  report += `| Ациклический | ${metrics.isAcyclic ? '✅ ДА' : '❌ НЕТ'} |\n\n`;

  report += '## 📈 Сложность\n\n';
  report += '| Метрика | Значение |\n';
  report += '|---------|----------|\n';
  report += `| Средняя сложность | ${metrics.averageComplexity?.toFixed(2) || 'N/A'} |\n`;
  report += `| Максимальная сложность | ${metrics.maxComplexity || 'N/A'} |\n\n`;

  if (metrics.totalSecurityIssues && metrics.totalSecurityIssues > 0) {
    report += '## 🔒 Безопасность\n\n';
    report += '| Метрика | Значение |\n';
    report += '|---------|----------|\n';
    report += `| Всего проблем безопасности | ${metrics.totalSecurityIssues} |\n`;
    if (metrics.securityIssuesByType) {
      report += `| eval() | ${metrics.securityIssuesByType.hasEval} |\n`;
      report += `| process.env | ${metrics.securityIssuesByType.hasProcessEnv} |\n`;
      report += `| Чувствительные данные | ${metrics.securityIssuesByType.hasSensitiveData} |\n`;
      report += `| exec() | ${metrics.securityIssuesByType.hasExec} |\n`;
    }
    report += '\n';
  }

  report += '## 📁 Модули по уровням\n\n';
  report += '| Уровень | Количество модулей |\n';
  report += '|---------|-------------------|\n';
  for (const [level, modules] of Object.entries(metrics.modulesByLevel || {})) {
    report += `| ${level} | ${modules.length} |\n`;
  }

  return report;
}

/**
 * Проверяет здоровье архитектуры
 */
export function checkArchitectureHealth(metrics: ArchitectureMetrics): {
  score: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Проверка циклов
  if (metrics.hasCycles) {
    issues.push('Обнаружены циклические зависимости');
    recommendations.push('Разорвите циклические зависимости с помощью dependency inversion');
    score -= 30;
  }

  // Проверка глубины
  if (metrics.maxDepth > 5) {
    issues.push(`Слишком большая глубина зависимостей: ${metrics.maxDepth}`);
    recommendations.push('Рассмотрите возможность упрощения архитектуры, уменьшите глубину');
    score -= 10;
  }

  // Проверка сложности
  if (metrics.maxComplexity && metrics.maxComplexity > 15) {
    issues.push(`Высокая цикломатическая сложность: ${metrics.maxComplexity}`);
    recommendations.push('Разбейте сложные функции на более мелкие');
    score -= 10;
  }

  // Проверка безопасности
  if (metrics.totalSecurityIssues && metrics.totalSecurityIssues > 0) {
    issues.push(`Обнаружено ${metrics.totalSecurityIssues} проблем безопасности`);
    recommendations.push('Исправьте проблемы безопасности (eval, process.env, exec)');
    score -= 20;
  }

  // Определяем статус
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (score < 50) {
    status = 'critical';
  } else if (score < 80) {
    status = 'warning';
  }

  return {
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
  };
}

export default {
  buildArchitectureMetrics,
  exportArchitectureMetrics,
  generateArchitectureReport,
  checkArchitectureHealth,
};
