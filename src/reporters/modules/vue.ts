// src/reporters/modules/vue.ts
// Vue-анализ для отчетов

import { analyzeVueComponent } from '../../modes/vue-analyzer.js';
import { EnhancedPackageInfo, VueAnalysis } from './types.js';
import { safeString } from './utils.js';

/**
 * Добавляет Vue-анализ к пакету
 * @param modulePath - Путь к Vue файлу
 * @param pkg - Объект пакета для обогащения
 * @returns Обогащенный пакет с vueAnalysis
 */
export function enrichWithVueAnalysis(
  modulePath: string,
  pkg: EnhancedPackageInfo
): EnhancedPackageInfo {
  if (!modulePath.endsWith('.vue')) {
    return pkg;
  }

  try {
    const vueAnalysis = analyzeVueComponent(modulePath, {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
    });

    if (vueAnalysis) {
      // Явно используем тип VueAnalysis для типизации
      const vueData: VueAnalysis = {
        props: vueAnalysis.props,
        emits: vueAnalysis.emits,
        slots: vueAnalysis.slots,
        composables: vueAnalysis.composables.map((c: any) => safeString(c.name || c)),
        templateComplexity: vueAnalysis.template.complexity || 0,
        scriptType: vueAnalysis.script.isSetup ? 'setup' : 'options',
        isTS: vueAnalysis.script.isTS || false,
        stats: {
          scriptLines: vueAnalysis.stats.scriptLines || 0,
          templateLines: vueAnalysis.stats.templateLines || 0,
          styleCount: vueAnalysis.stats.styleCount || 0,
        },
      };

      return {
        ...pkg,
        vueAnalysis: vueData,
        fileStats: {
          ...pkg.fileStats,
          functions:
            (pkg.fileStats?.functions || 0) +
            (vueAnalysis.composables?.length || 0) +
            (vueAnalysis.script?.content?.split('\n')?.filter((l: string) => l.includes('function'))
              ?.length || 0),
        },
      };
    }
  } catch (error: any) {
    console.warn(
      `⚠️ Failed to analyze Vue component ${modulePath}:`,
      error?.message || String(error)
    );
  }

  return pkg;
}

/**
 * Добавляет Vue-анализ ко всем пакетам
 * @param packages - Объект со всеми пакетами
 * @returns Обогащенные пакеты с vueAnalysis
 */
export function enrichAllWithVueAnalysis(
  packages: Record<string, EnhancedPackageInfo>
): Record<string, EnhancedPackageInfo> {
  const enrichedPackages: Record<string, EnhancedPackageInfo> = {};

  for (const [modulePath, pkg] of Object.entries(packages)) {
    enrichedPackages[modulePath] = enrichWithVueAnalysis(modulePath, pkg);
  }

  return enrichedPackages;
}

/**
 * Подсчитывает Vue-статистику по всем пакетам
 */
export function calculateVueStats(packages: Record<string, EnhancedPackageInfo>): {
  vueComponents: number;
  totalComposables: number;
  vueFiles: string[];
  vueAnalysisMap: Map<string, VueAnalysis>;
} {
  const vueFiles: string[] = [];
  let totalComposables = 0;
  const vueAnalysisMap = new Map<string, VueAnalysis>();

  for (const [modulePath, pkg] of Object.entries(packages)) {
    if (pkg.vueAnalysis) {
      vueFiles.push(modulePath);
      totalComposables += pkg.vueAnalysis.composables?.length || 0;

      // Сохраняем VueAnalysis в Map для дальнейшего использования
      vueAnalysisMap.set(modulePath, pkg.vueAnalysis);
    }
  }

  return {
    vueComponents: vueFiles.length,
    totalComposables,
    vueFiles,
    vueAnalysisMap,
  };
}

/**
 * Генерирует отчет по Vue-компонентам с использованием типа VueAnalysis
 */
export function generateVueReport(packages: Record<string, EnhancedPackageInfo>): string {
  const stats = calculateVueStats(packages);

  let report = '## 🎯 Vue Components Report\n\n';
  report += `**Total Vue components:** ${stats.vueComponents}\n`;
  report += `**Total composables:** ${stats.totalComposables}\n\n`;

  if (stats.vueFiles.length > 0) {
    report += '### 📁 Vue Files\n\n';
    for (const file of stats.vueFiles) {
      const pkg = packages[file];
      if (!pkg?.vueAnalysis) continue;

      // Явно используем VueAnalysis тип
      const vueData: VueAnalysis = pkg.vueAnalysis;

      report += `#### ${file}\n`;
      report += `- **Props:** ${vueData.props?.names?.length || 0}\n`;
      report += `  - ${vueData.props?.names?.join(', ') || 'none'}\n`;
      report += `- **Emits:** ${vueData.emits?.names?.length || 0}\n`;
      report += `  - ${vueData.emits?.names?.join(', ') || 'none'}\n`;
      report += `- **Slots:** ${vueData.slots?.length || 0}\n`;
      report += `  - ${vueData.slots?.join(', ') || 'none'}\n`;
      report += `- **Composables:** ${vueData.composables?.length || 0}\n`;
      report += `  - ${vueData.composables?.join(', ') || 'none'}\n`;
      report += `- **Template complexity:** ${vueData.templateComplexity || 0}\n`;
      report += `- **TypeScript:** ${vueData.isTS ? '✅' : '❌'}\n`;
      report += `- **Script type:** ${vueData.scriptType}\n`;
      report += `- **Lines:** script=${vueData.stats?.scriptLines || 0}, template=${vueData.stats?.templateLines || 0}, styles=${vueData.stats?.styleCount || 0}\n\n`;
    }
  } else {
    report += 'ℹ️ No Vue components found.\n';
  }

  return report;
}

/**
 * Получает VueAnalysis для конкретного файла
 */
export function getVueAnalysis(
  packages: Record<string, EnhancedPackageInfo>,
  modulePath: string
): VueAnalysis | null {
  const pkg = packages[modulePath];
  if (!pkg?.vueAnalysis) {
    return null;
  }
  return pkg.vueAnalysis;
}

/**
 * Проверяет, является ли файл Vue компонентом
 */
export function isVueFile(modulePath: string): boolean {
  return modulePath.endsWith('.vue');
}

/**
 * Получает все Vue файлы из пакетов
 */
export function getVueFiles(packages: Record<string, EnhancedPackageInfo>): string[] {
  return Object.keys(packages).filter(path => isVueFile(path));
}

/**
 * Создает сводку по Vue компонентам в формате таблицы
 */
export function generateVueSummaryTable(packages: Record<string, EnhancedPackageInfo>): string {
  const stats = calculateVueStats(packages);

  if (stats.vueFiles.length === 0) {
    return 'No Vue components found.';
  }

  let table = '| File | Props | Emits | Slots | Composables | Complexity | TypeScript |\n';
  table += '|------|-------|-------|-------|-------------|------------|------------|\n';

  for (const file of stats.vueFiles) {
    const pkg = packages[file];
    if (!pkg?.vueAnalysis) continue;

    const vueData: VueAnalysis = pkg.vueAnalysis;
    table += `| ${file} | ${vueData.props?.names?.length || 0} | ${vueData.emits?.names?.length || 0} | ${vueData.slots?.length || 0} | ${vueData.composables?.length || 0} | ${vueData.templateComplexity || 0} | ${vueData.isTS ? '✅' : '❌'} |\n`;
  }

  return table;
}

/**
 * Анализирует сложность Vue компонентов
 */
export function analyzeVueComplexity(packages: Record<string, EnhancedPackageInfo>): {
  averageComplexity: number;
  maxComplexity: number;
  complexComponents: { file: string; complexity: number }[];
} {
  const complexities: { file: string; complexity: number }[] = [];

  for (const [file, pkg] of Object.entries(packages)) {
    if (pkg.vueAnalysis) {
      const complexity = pkg.vueAnalysis.templateComplexity || 0;
      complexities.push({ file, complexity });
    }
  }

  if (complexities.length === 0) {
    return {
      averageComplexity: 0,
      maxComplexity: 0,
      complexComponents: [],
    };
  }

  const sorted = [...complexities].sort((a, b) => b.complexity - a.complexity);
  const total = complexities.reduce((sum, c) => sum + c.complexity, 0);

  return {
    averageComplexity: total / complexities.length,
    maxComplexity: sorted[0]?.complexity || 0,
    complexComponents: sorted.filter(c => c.complexity > 20),
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  enrichWithVueAnalysis,
  enrichAllWithVueAnalysis,
  calculateVueStats,
  generateVueReport,
  getVueAnalysis,
  isVueFile,
  getVueFiles,
  generateVueSummaryTable,
  analyzeVueComplexity,
};
