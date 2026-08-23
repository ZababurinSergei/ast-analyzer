// src/reporters/modules/architecture.ts
// Архитектурные метрики

import { EnhancedPackageInfo, ArchitectureMetrics, EnhancedFunctionInfo } from './types.js';
import { findCycles, getMaxDepth, getModulesByLevel } from './graphs.js';
import { safeString, ensureArray } from './utils.js';

/**
 * Строит архитектурные метрики проекта
 *
 * @param packages - Данные по всем пакетам/модулям
 * @param callGraph - Граф вызовов функций
 * @param outwardDeps - Исходящие зависимости модулей
 * @returns Архитектурные метрики
 */
export function buildArchitectureMetrics(
  packages: Record<string, EnhancedPackageInfo>,
  callGraph: Record<string, string[]>,
  outwardDeps: Record<string, string[]>
): ArchitectureMetrics {
  let totalModules = Object.keys(packages).length;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalConstants = 0;
  let totalInterfaces = 0;
  let totalTypes = 0;
  let totalVariables = 0;
  let totalCalls = 0;
  let vueComponents = 0;
  let totalComposables = 0;

  // Сбор статистики по модулям
  const moduleStats: Record<string, { functions: number; calls: number; deps: number }> = {};

  // Проходим по всем пакетам для сбора статистики
  for (const [modulePath, pkg] of Object.entries(packages)) {
    // ✅ ИСПОЛЬЗУЕМ modulePath - сохраняем в статистику модуля
    const safeModulePath = safeString(modulePath);

    // Инициализируем статистику для модуля
    moduleStats[safeModulePath] = {
      functions: 0,
      calls: 0,
      deps: 0,
    };

    // ✅ ИСПОЛЬЗУЕМ safeString для безопасного извлечения данных
    const pkgType = safeString(pkg.type);
    const language = safeString(pkg.language);

    // ✅ ПРИВОДИМ ТИПЫ ДЛЯ БЕЗОПАСНОЙ РАБОТЫ
    // Явно приводим функции к типу EnhancedFunctionInfo[]
    const functions = ensureArray<EnhancedFunctionInfo>(pkg.entities?.functions || []);
    const classes = ensureArray(pkg.entities?.classes || []);
    const constants = ensureArray(pkg.entities?.constants || []);
    const interfaces = ensureArray(pkg.entities?.interfaces || []);
    const types = ensureArray(pkg.entities?.types || []);
    const variables = ensureArray(pkg.entities?.variables || []);

    totalFunctions += functions.length;
    totalClasses += classes.length;
    totalConstants += constants.length;
    totalInterfaces += interfaces.length;
    totalTypes += types.length;
    totalVariables += variables.length;

    // Обновляем статистику модуля
    moduleStats[safeModulePath].functions = functions.length;

    // ✅ ИСПОЛЬЗУЕМ pkgType и language для определения Vue компонентов
    if (pkgType === 'vue' || language === 'vue') {
      vueComponents++;
    }

    // Vue компоненты
    if (pkg.vueAnalysis) {
      vueComponents++;
      const composables = ensureArray(pkg.vueAnalysis.composables || []);
      totalComposables += composables.length;
    }

    // ✅ ИСПОЛЬЗУЕМ callGraph для подсчета вызовов
    // Проходим по всем функциям в пакете и добавляем их вызовы
    let moduleCalls = 0;
    for (const func of functions) {
      // ✅ func имеет тип EnhancedFunctionInfo
      const calls = ensureArray(func.calls || []);
      const callCount = calls.length;
      moduleCalls += callCount;
      totalCalls += callCount;

      // ✅ ИСПОЛЬЗУЕМ func для получения имени и проверки экспорта
      const funcName = safeString(func.name);
      if (funcName && func.isExported) {
        // Дополнительная статистика для экспортированных функций
        // Можно добавить в будущем
      }
    }

    // Обновляем статистику модуля по вызовам
    moduleStats[safeModulePath].calls = moduleCalls;
  }

  // ✅ ИСПОЛЬЗУЕМ callGraph для дополнительной статистики
  // Если callGraph передан отдельно, используем его для сверки
  if (callGraph && Object.keys(callGraph).length > 0) {
    let callGraphCalls = 0;
    for (const [funcName, calls] of Object.entries(callGraph)) {
      const safeFuncName = safeString(funcName);
      const safeCalls = ensureArray(calls);
      callGraphCalls += safeCalls.length;

      // ✅ ИСПОЛЬЗУЕМ safeString для безопасного логирования
      if (process.env.DEBUG === 'true' && safeCalls.length > 10) {
        console.debug(`  📊 Функция ${safeFuncName} имеет ${safeCalls.length} вызовов`);
      }
    }
    // Используем максимальное значение для totalCalls
    totalCalls = Math.max(totalCalls, callGraphCalls);
  }

  // ✅ ИСПОЛЬЗУЕМ outwardDeps для построения уровней и проверки циклов
  const hasCycles = findCycles(callGraph);
  const maxDepth = getMaxDepth(callGraph);
  const modulesByLevel = getModulesByLevel(outwardDeps);

  // ✅ ИСПОЛЬЗУЕМ safeString и ensureArray для outwardDeps
  let moduleDepsCount = 0;
  for (const [key, deps] of Object.entries(outwardDeps)) {
    const safeKey = safeString(key);
    const safeDeps = ensureArray(deps);
    const depCount = safeDeps.length;
    moduleDepsCount += depCount;

    // Обновляем статистику модуля по зависимостям
    if (moduleStats[safeKey]) {
      moduleStats[safeKey].deps = depCount;
    }

    // Дополнительная статистика для модулей с большим количеством зависимостей
    if (depCount > 20 && process.env.DEBUG === 'true') {
      console.debug(`  📊 Модуль ${safeKey} имеет ${depCount} зависимостей`);
    }
  }

  // ✅ ИСПОЛЬЗУЕМ moduleStats для вывода статистики по модулям
  if (process.env.DEBUG === 'true') {
    console.log(`  📊 Статистика по модулям:`);
    const sortedModules = Object.entries(moduleStats)
      .sort((a, b) => b[1].functions - a[1].functions)
      .slice(0, 5);

    for (const [module, stats] of sortedModules) {
      console.log(
        `     • ${module}: ${stats.functions} функций, ${stats.calls} вызовов, ${stats.deps} зависимостей`
      );
    }
  }

  // ✅ ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА из outwardDeps
  // Подсчет средней степени связности модулей
  let totalDeps = 0;
  let modulesWithDeps = 0;
  for (const deps of Object.values(outwardDeps)) {
    const safeDeps = ensureArray(deps);
    if (safeDeps.length > 0) {
      totalDeps += safeDeps.length;
      modulesWithDeps++;
    }
  }
  const avgDeps = modulesWithDeps > 0 ? totalDeps / modulesWithDeps : 0;

  // ✅ ВЫВОДИМ ДОПОЛНИТЕЛЬНУЮ СТАТИСТИКУ в консоль (опционально)
  if (process.env.DEBUG === 'true') {
    console.log(`  📊 Архитектурные метрики:`);
    console.log(`     • Модулей: ${totalModules}`);
    console.log(`     • Функций: ${totalFunctions}`);
    console.log(`     • Вызовов: ${totalCalls}`);
    console.log(`     • Средняя степень связности: ${avgDeps.toFixed(2)}`);
    console.log(`     • Vue компонентов: ${vueComponents}`);
  }

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
  };
}

/**
 * Вычисляет дополнительный показатель - коэффициент связности модулей
 * Использует outwardDeps для анализа
 */
export function calculateCouplingCoefficient(outwardDeps: Record<string, string[]>): {
  average: number;
  max: number;
  min: number;
  modulesWithDependencies: number;
  modulesWithoutDependencies: number;
  totalDependencies: number;
} {
  let totalDeps = 0;
  let maxDeps = 0;
  let minDeps = Infinity;
  let modulesWithDeps = 0;
  let modulesWithoutDeps = 0;

  for (const deps of Object.values(outwardDeps)) {
    // ✅ ИСПОЛЬЗУЕМ ensureArray для безопасной работы с массивом
    const safeDeps = ensureArray(deps);
    const depCount = safeDeps.length;
    totalDeps += depCount;

    if (depCount > 0) {
      modulesWithDeps++;
      maxDeps = Math.max(maxDeps, depCount);
      minDeps = Math.min(minDeps, depCount);
    } else {
      modulesWithoutDeps++;
    }
  }

  const totalModules = modulesWithDeps + modulesWithoutDeps;

  return {
    average: totalModules > 0 ? totalDeps / totalModules : 0,
    max: maxDeps,
    min: minDeps === Infinity ? 0 : minDeps,
    modulesWithDependencies: modulesWithDeps,
    modulesWithoutDependencies: modulesWithoutDeps,
    totalDependencies: totalDeps,
  };
}

/**
 * Определяет уровень здоровья архитектуры на основе метрик
 */
export function determineArchitectureHealth(
  metrics: ArchitectureMetrics,
  coupling?: { average: number; max: number }
): 'excellent' | 'good' | 'moderate' | 'poor' {
  let score = 0;

  // Нет циклов - хорошо
  if (!metrics.hasCycles) score += 2;

  // Небольшая глубина - хорошо
  if (metrics.maxDepth <= 3) score += 2;
  else if (metrics.maxDepth <= 5) score += 1;

  // Много Vue компонентов - признак хорошей модульности
  if (metrics.vueComponents > 0 && metrics.totalModules > 10) {
    const componentRatio = metrics.vueComponents / metrics.totalModules;
    if (componentRatio > 0.3) score += 1;
  }

  // Низкая связанность - хорошо (если есть данные)
  if (coupling) {
    if (coupling.average < 2) score += 2;
    else if (coupling.average < 4) score += 1;
    if (coupling.max < 10) score += 1;
  }

  // Оценка
  if (score >= 7) return 'excellent';
  if (score >= 5) return 'good';
  if (score >= 3) return 'moderate';
  return 'poor';
}

/**
 * Генерирует текстовое описание архитектуры
 */
export function generateArchitectureDescription(
  metrics: ArchitectureMetrics,
  coupling?: { average: number; max: number }
): string {
  const health = determineArchitectureHealth(metrics, coupling);
  const parts: string[] = [];

  parts.push(`🏗️  Архитектура: ${health.toUpperCase()}`);

  if (metrics.hasCycles) {
    parts.push('⚠️  Обнаружены циклические зависимости');
  } else {
    parts.push('✅  Циклические зависимости отсутствуют');
  }

  parts.push(`📏  Максимальная глубина: ${metrics.maxDepth}`);

  if (coupling) {
    parts.push(`🔗  Средняя связность: ${coupling.average.toFixed(2)}`);
    parts.push(`🔗  Максимальная связность: ${coupling.max}`);
  }

  if (metrics.vueComponents > 0) {
    parts.push(`🎯  Vue компонентов: ${metrics.vueComponents}`);
    parts.push(`🧩  Композаблов: ${metrics.totalComposables}`);
  }

  return parts.join(' | ');
}

/**
 * Получает топ модулей с наибольшим количеством зависимостей
 */
export function getTopModulesByDependencies(
  outwardDeps: Record<string, string[]>,
  limit: number = 10
): { module: string; dependencies: string[]; count: number }[] {
  const result: { module: string; dependencies: string[]; count: number }[] = [];

  for (const [module, deps] of Object.entries(outwardDeps)) {
    // ✅ ИСПОЛЬЗУЕМ safeString для безопасного получения имени модуля
    const safeModule = safeString(module);
    const safeDeps = ensureArray(deps);

    result.push({
      module: safeModule,
      dependencies: safeDeps.map(d => safeString(d)),
      count: safeDeps.length,
    });
  }

  // Сортируем по убыванию количества зависимостей
  result.sort((a, b) => b.count - a.count);

  // Возвращаем только топ N
  return result.slice(0, limit);
}

/**
 * Получает модули без зависимостей (листья)
 */
export function getLeafModules(outwardDeps: Record<string, string[]>): string[] {
  const leafModules: string[] = [];

  for (const [module, deps] of Object.entries(outwardDeps)) {
    // ✅ ИСПОЛЬЗУЕМ ensureArray для безопасной работы с массивом
    const safeDeps = ensureArray(deps);
    if (safeDeps.length === 0) {
      leafModules.push(safeString(module));
    }
  }

  return leafModules;
}

/**
 * Получает статистику по модулям в виде таблицы
 */
export function getModuleStatsTable(
  packages: Record<string, EnhancedPackageInfo>,
  outwardDeps: Record<string, string[]>
): {
  module: string;
  functions: number;
  classes: number;
  exports: number;
  deps: number;
  isVue: boolean;
}[] {
  const result: {
    module: string;
    functions: number;
    classes: number;
    exports: number;
    deps: number;
    isVue: boolean;
  }[] = [];

  for (const [modulePath, pkg] of Object.entries(packages)) {
    const safeModule = safeString(modulePath);

    // ✅ ПРИВОДИМ ТИПЫ ДЛЯ БЕЗОПАСНОЙ РАБОТЫ
    const functions = ensureArray<EnhancedFunctionInfo>(pkg.entities?.functions || []);
    const classes = ensureArray(pkg.entities?.classes || []);
    const deps = ensureArray(outwardDeps[modulePath] || []);

    // ✅ ИСПОЛЬЗУЕМ func с явным типом EnhancedFunctionInfo
    let exportsCount = 0;
    for (const func of functions) {
      // ✅ func имеет тип EnhancedFunctionInfo, поэтому isExported доступен
      if (func.isExported) exportsCount++;
    }

    result.push({
      module: safeModule,
      functions: functions.length,
      classes: classes.length,
      exports: exportsCount,
      deps: deps.length,
      isVue: !!pkg.vueAnalysis,
    });
  }

  // Сортируем по количеству функций (по убыванию)
  result.sort((a, b) => b.functions - a.functions);

  return result;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildArchitectureMetrics,
  calculateCouplingCoefficient,
  determineArchitectureHealth,
  generateArchitectureDescription,
  getTopModulesByDependencies,
  getLeafModules,
  getModuleStatsTable,
};
