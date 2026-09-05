// src/reporters/modules/vue.ts
// Модуль для анализа Vue компонентов в отчетах

import type { EnhancedPackageInfo, VueAnalysis } from '../../types.js';

/**
 * Проверяет, является ли пакет Vue компонентом
 */
export function isVuePackage(pkg: EnhancedPackageInfo): boolean {
  return (
    pkg.language === 'vue' ||
    (pkg.fileStats && pkg.fileStats.functions > 0 && pkg.resolved?.includes('.vue'))
  );
}

/**
 * Извлекает Vue анализ из пакета
 */
export function extractVueAnalysis(pkg: EnhancedPackageInfo): VueAnalysis | null {
  if (!isVuePackage(pkg)) {
    return null;
  }

  // Если уже есть Vue анализ, возвращаем его
  if (pkg.vueAnalysis) {
    return pkg.vueAnalysis;
  }

  // Создаем базовый Vue анализ из данных пакета
  const vueAnalysis: VueAnalysis = {
    props: {
      names: [],
      types: {},
      required: {},
      defaults: {},
    },
    emits: {
      names: [],
      types: {},
    },
    slots: [],
    composables: [],
    templateComplexity: 0,
    scriptType: 'setup',
    isTS: pkg.language === 'typescript' || pkg.language === 'vue',
    stats: {
      scriptLines: pkg.fileStats?.lines || 0,
      templateLines: 0,
      styleCount: 0,
    },
  };

  // Извлекаем composables из функций
  if (pkg.entities && pkg.entities.functions) {
    for (const func of pkg.entities.functions) {
      if (func.name && func.name.startsWith('use') && func.isExported) {
        vueAnalysis.composables.push(func.name);
      }
    }
  }

  return vueAnalysis;
}

/**
 * Обогащает пакет Vue анализом
 */
export function enrichWithVueAnalysis(
  pkg: EnhancedPackageInfo,
  vueAnalysis: VueAnalysis
): EnhancedPackageInfo {
  return {
    ...pkg,
    vueAnalysis,
    fileStats: {
      ...pkg.fileStats,
      functions: pkg.fileStats?.functions || 0,
      classes: pkg.fileStats?.classes || 0,
      constants: pkg.fileStats?.constants || 0,
      interfaces: pkg.fileStats?.interfaces || 0,
      types: pkg.fileStats?.types || 0,
      variables: pkg.fileStats?.variables || 0,
      size: pkg.fileStats?.size || 0,
      lines: pkg.fileStats?.lines || 0,
    },
  };
}

/**
 * Собирает статистику по Vue компонентам
 */
export function collectVueStats(packages: Record<string, EnhancedPackageInfo>): {
  totalComponents: number;
  totalComposables: number;
  byScriptType: { setup: number; options: number };
  byLanguage: { ts: number; js: number };
} {
  const stats = {
    totalComponents: 0,
    totalComposables: 0,
    byScriptType: { setup: 0, options: 0 },
    byLanguage: { ts: 0, js: 0 },
  };

  for (const pkg of Object.values(packages)) {
    if (!isVuePackage(pkg)) continue;

    stats.totalComponents++;

    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis) {
      stats.totalComposables += vueAnalysis.composables.length;

      if (vueAnalysis.scriptType === 'setup') {
        stats.byScriptType.setup++;
      } else {
        stats.byScriptType.options++;
      }

      if (vueAnalysis.isTS) {
        stats.byLanguage.ts++;
      } else {
        stats.byLanguage.js++;
      }
    }
  }

  return stats;
}

/**
 * Генерирует Markdown отчет по Vue компонентам
 */
export function generateVueMarkdownReport(packages: Record<string, EnhancedPackageInfo>): string {
  const vuePackages = Object.entries(packages).filter(([, pkg]) => isVuePackage(pkg));

  if (vuePackages.length === 0) {
    return '';
  }

  const stats = collectVueStats(packages);

  let md = '## 🎯 Vue Components\n\n';
  md += `**Total components:** ${stats.totalComponents}\n`;
  md += `**Total composables:** ${stats.totalComposables}\n`;
  md += `**Script type:** Setup ${stats.byScriptType.setup}, Options ${stats.byScriptType.options}\n`;
  md += `**Language:** TS ${stats.byLanguage.ts}, JS ${stats.byLanguage.js}\n\n`;

  md += '### 📄 Component List\n\n';
  md += '| Component | Props | Emits | Slots | Composables | Type |\n';
  md += '|-----------|-------|-------|-------|-------------|------|\n';

  for (const [path, pkg] of vuePackages) {
    const vueAnalysis = extractVueAnalysis(pkg);
    const name = path.split('/').pop()?.replace('.vue', '') || 'unknown';

    if (vueAnalysis) {
      md += `| ${name} | ${vueAnalysis.props.names.length} | ${vueAnalysis.emits.names.length} | ${vueAnalysis.slots.length} | ${vueAnalysis.composables.length} | ${vueAnalysis.isTS ? 'TS' : 'JS'} |\n`;
    } else {
      md += `| ${name} | - | - | - | - | - |\n`;
    }
  }

  md += '\n';

  return md;
}

/**
 * Генерирует JSON данные по Vue компонентам
 */
export function generateVueJSONData(packages: Record<string, EnhancedPackageInfo>): {
  components: {
    path: string;
    name: string;
    props: string[];
    emits: string[];
    slots: string[];
    composables: string[];
    isTS: boolean;
    scriptType: 'setup' | 'options';
  }[];
  stats: {
    total: number;
    composables: number;
    setup: number;
    options: number;
    ts: number;
    js: number;
  };
} {
  const components: {
    path: string;
    name: string;
    props: string[];
    emits: string[];
    slots: string[];
    composables: string[];
    isTS: boolean;
    scriptType: 'setup' | 'options';
  }[] = [];

  for (const [path, pkg] of Object.entries(packages)) {
    if (!isVuePackage(pkg)) continue;

    const vueAnalysis = extractVueAnalysis(pkg);
    const name = path.split('/').pop()?.replace('.vue', '') || 'unknown';

    components.push({
      path,
      name,
      props: vueAnalysis?.props.names || [],
      emits: vueAnalysis?.emits.names || [],
      slots: vueAnalysis?.slots || [],
      composables: vueAnalysis?.composables || [],
      isTS: vueAnalysis?.isTS || false,
      scriptType: vueAnalysis?.scriptType || 'options',
    });
  }

  const stats = collectVueStats(packages);

  return {
    components,
    stats: {
      total: stats.totalComponents,
      composables: stats.totalComposables,
      setup: stats.byScriptType.setup,
      options: stats.byScriptType.options,
      ts: stats.byLanguage.ts,
      js: stats.byLanguage.js,
    },
  };
}

/**
 * Находит все Vue компоненты в пакетах
 */
export function findVueComponents(packages: Record<string, EnhancedPackageInfo>): string[] {
  const components: string[] = [];

  for (const [path, pkg] of Object.entries(packages)) {
    if (isVuePackage(pkg)) {
      components.push(path);
    }
  }

  return components;
}

/**
 * Находит все composables в пакетах
 */
export function findComposables(
  packages: Record<string, EnhancedPackageInfo>
): { name: string; source: string }[] {
  const composables: { name: string; source: string }[] = [];

  for (const [path, pkg] of Object.entries(packages)) {
    if (!isVuePackage(pkg)) continue;

    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis) {
      for (const comp of vueAnalysis.composables) {
        composables.push({ name: comp, source: path });
      }
    }
  }

  return composables;
}

/**
 * Проверяет, используется ли composable
 */
export function isComposableUsed(
  composableName: string,
  packages: Record<string, EnhancedPackageInfo>
): boolean {
  for (const pkg of Object.values(packages)) {
    if (!isVuePackage(pkg)) continue;

    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis && vueAnalysis.composables.includes(composableName)) {
      return true;
    }
  }
  return false;
}

/**
 * Находит неиспользуемые composables
 */
export function findUnusedComposables(
  packages: Record<string, EnhancedPackageInfo>
): { name: string; source: string }[] {
  const usedComposables = new Set<string>();

  // Собираем все используемые composables
  for (const pkg of Object.values(packages)) {
    if (!isVuePackage(pkg)) continue;

    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis) {
      for (const comp of vueAnalysis.composables) {
        usedComposables.add(comp);
      }
    }
  }

  // Находим composables, которые объявлены но не используются
  const unused: { name: string; source: string }[] = [];
  const declared = new Map<string, string>();

  for (const [path, pkg] of Object.entries(packages)) {
    if (!isVuePackage(pkg)) continue;

    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis) {
      for (const func of pkg.entities?.functions || []) {
        if (func.name && func.name.startsWith('use') && func.isExported) {
          declared.set(func.name, path);
        }
      }
    }
  }

  for (const [name, source] of declared) {
    if (!usedComposables.has(name)) {
      unused.push({ name, source });
    }
  }

  return unused;
}

/**
 * Получает количество Vue компонентов
 */
export function getVueComponentCount(packages: Record<string, EnhancedPackageInfo>): number {
  let count = 0;
  for (const pkg of Object.values(packages)) {
    if (isVuePackage(pkg)) {
      count++;
    }
  }
  return count;
}

/**
 * Получает общее количество composables
 */
export function getComposablesCount(packages: Record<string, EnhancedPackageInfo>): number {
  let count = 0;
  for (const pkg of Object.values(packages)) {
    if (!isVuePackage(pkg)) continue;
    const vueAnalysis = extractVueAnalysis(pkg);
    if (vueAnalysis) {
      count += vueAnalysis.composables.length;
    }
  }
  return count;
}

// Экспорт по умолчанию
export default {
  isVuePackage,
  extractVueAnalysis,
  enrichWithVueAnalysis,
  collectVueStats,
  generateVueMarkdownReport,
  generateVueJSONData,
  findVueComponents,
  findComposables,
  isComposableUsed,
  findUnusedComposables,
  getVueComponentCount,
  getComposablesCount,
};
