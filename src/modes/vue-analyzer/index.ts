// src/modes/vue-analyzer/index.ts
// ============================================
// ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА VUE КОМПОНЕНТА
// ============================================
// Версия: 4.4.0 (FINAL, v9.0.0)
//
// ИЗМЕНЕНИЯ v4.4.0 (FINAL):
//   - ✅ ДОБАВЛЕНО: вызов extractEffects (было упущено в v4.3.0)
//   - ✅ ДОБАВЛЕНО: проброс effects в анализ
//   - ✅ ДОБАВЛЕНО: логирование количества effects
//   - ✅ ДОБАВЛЕНО: defensive-проверки для extractLifecycle/extractEffects/
//     extractInjections/extractReactivity — если что-то падает,
//     остальные секции всё равно собираются
//   - ✅ ДОБАВЛЕНО: пустые массивы → пустые массивы (не undefined),
//     чтобы convertVueAnalysisToEntities корректно пробросил их
//
// ИЗМЕНЕНИЯ v4.3.0:
//   - ✅ ДОБАВЛЕНО: вызов extractLifecycle, extractInjections,
//     extractReactivity из analyzers/index.js
//   - ✅ ДОБАВЛЕНО: заполнение полей lifecycle, effects, injections,
//     reactivity в результате анализа
//
// ИЗМЕНЕНИЯ v4.2.0:
//   - ✅ ДОБАВЛЕНО: явный экспорт findProjectRoot (для CLI)
//   - ✅ ДОБАВЛЕНО: агрегация reactivityDeps из expressions
//   - ✅ ИСПРАВЛЕНО: linkTemplateRefsToExpose использует globalMap
//
// ИЗМЕНЕНИЯ v4.1.0:
//   - ✅ ДОБАВЛЕНО: двухпроходный анализ через GlobalComponentMap
//   - ✅ ИСПРАВЛЕНО: linkTemplateRefsToExpose использует глобальную карту
//   - ✅ ДОБАВЛЕНО: buildGlobalComponentMap + findProjectRoot в CLI
//
// ИЗМЕНЕНИЯ v4.0.0:
//   - ✅ ИСПРАВЛЕНО: связь templateRefs → defineExpose дочернего компонента
//   - ✅ ИСПРАВЛЕНО: функции одного имени в Map<string, FunctionInfo[]>
//   - ✅ ИСПРАВЛЕНО: setupAttributes.generic через нормализованный API
//   - ✅ ИСПРАВЛЕНО: defineSlots через AST (основной путь)
//   - ✅ ИСПРАВЛЕНО: idManager/filePath в convertVueAnalysisToEntities
// ============================================

import fs from 'fs';
import path from 'path';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';

export * from './types.js';
export { parseVueFile, compileScriptBlock } from './parser.js';
export {
  extractPropsFromSource,
  extractPropsFromCompiledScript,
  extractPropsFromAST,
  extractEmitsFromSource,
  extractEmitsFromCompiledScript,
  extractEmitsFromAST,
  extractExposeFromCompiledScript,
  extractExposeFromAST,
  extractImportsFromAST,
  extractImportsFromSource,
  extractComposablesFromAST,
  extractComposablesFromSource,
  extractFunctionsFromScript,
  extractConstantsFromScript,
  extractVariablesFromScript,
  extractTypesFromScript,
  extractInterfacesFromScript,
  extractSlotsFromAST,
  extractSlotsFromSource,
} from './extractors/index.js';
export { analyzeTemplate } from './template.js';
export { buildCallGraphFromScript } from './callgraph.js';
export { generateVueComponentReport } from './report.js';
export { getNodeValue } from './utils.js';

export {
  buildGlobalComponentMap,
  type ComponentInfo,
  type GlobalComponentMap,
  type BuildGlobalMapOptions,
} from './global-component-map.js';

import type { VueComponentAnalysis, AnalysisOptions } from './types.js';
import { parseVueFile, compileScriptBlock } from './parser.js';
import { analyzeTemplate } from './template.js';
import {
  extractPropsFromSource,
  extractPropsFromCompiledScript,
  extractPropsFromAST,
  extractEmitsFromSource,
  extractEmitsFromCompiledScript,
  extractEmitsFromAST,
  extractExposeFromCompiledScript,
  extractExposeFromAST,
  extractImportsFromAST,
  extractImportsFromSource,
  extractComposablesFromAST,
  extractComposablesFromSource,
  extractFunctionsFromScript,
  extractConstantsFromScript,
  extractVariablesFromScript,
  extractTypesFromScript,
  extractInterfacesFromScript,
  extractSlotsFromAST,
  extractSlotsFromSource,
} from './extractors/index.js';
import { buildCallGraphFromScript } from './callgraph.js';
import { generateVueComponentReport } from './report.js';
import { buildGlobalComponentMap, type GlobalComponentMap } from './global-component-map.js';

// ✅ НОВОЕ v4.3.0: импорт анализаторов из analyzers/index.js
import {
  extractLifecycle,
  extractEffects,
  extractInjections,
  extractReactivity,
} from '../../analyzers/index.js';

// ============================================
// РАСШИРЕННЫЕ ОПЦИИ АНАЛИЗА
// ============================================

/**
 * Опции анализа Vue-компонента.
 *
 * Расширяет базовый AnalysisOptions полем globalMap —
 * картой всех Vue-компонентов проекта (для связи refs → expose).
 */
export interface AnalyzeVueOptions extends AnalysisOptions {
  /**
   * Глобальная карта компонентов проекта.
   * Если не передана — используется локальная эвристика.
   */
  globalMap?: GlobalComponentMap;
  /** Подробный вывод (для CLI) */
  verbose?: boolean;
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

export function analyzeVueComponent(
  filePath: string,
  options: AnalyzeVueOptions = {}
): VueComponentAnalysis | null {
  if (!filePath.endsWith('.vue')) {
    console.error('❌ Файл не является Vue компонентом');
    return null;
  }
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Файл не найден: ${filePath}`);
    return null;
  }

  let fileContent = '';
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`❌ Ошибка чтения файла ${filePath}:`, error);
    return null;
  }

  const parsed = parseVueFile(filePath);
  if (!parsed) return null;

  const { descriptor } = parsed;
  const compiledScript = compileScriptBlock(descriptor, filePath);
  const templateAnalysis = analyzeTemplate(descriptor, options);

  const originalScriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';
  const isSetup = !!descriptor.scriptSetup;
  const isTS = !!(descriptor.scriptSetup?.lang === 'ts' || descriptor.script?.lang === 'ts');

  // Парсим AST один раз
  let scriptAst: Program | null = null;
  if (originalScriptContent) {
    try {
      scriptAst = parseTS(originalScriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      }) as Program;
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // === PROPS ===
  let props = extractPropsFromCompiledScript(compiledScript);
  if (props.names.length === 0 && scriptAst) {
    const astProps = extractPropsFromAST(scriptAst);
    if (astProps.names.length > 0) props = astProps;
  }
  if (props.names.length === 0) {
    props = extractPropsFromSource(originalScriptContent);
  }

  // === EMITS ===
  let emits = extractEmitsFromCompiledScript(compiledScript);
  if (emits.names.length === 0 && scriptAst) {
    const astEmits = extractEmitsFromAST(scriptAst);
    if (astEmits.names.length > 0) emits = astEmits;
  }
  if (emits.names.length === 0) {
    emits = extractEmitsFromSource(originalScriptContent);
  }

  // === EXPOSE ===
  let expose = extractExposeFromCompiledScript(compiledScript);
  if (expose.length === 0 && scriptAst) {
    const astExpose = extractExposeFromAST(scriptAst);
    if (astExpose.length > 0) expose = astExpose;
  }

  // === IMPORTS ===
  let imports: VueComponentAnalysis['imports'] = [];
  if (scriptAst) imports = extractImportsFromAST(scriptAst);
  if (imports.length === 0 && originalScriptContent) {
    imports = extractImportsFromSource(originalScriptContent);
  }

  // === COMPOSABLES ===
  let composables: VueComponentAnalysis['composables'] = [];
  if (scriptAst) composables = extractComposablesFromAST(scriptAst);
  if (composables.length === 0 && originalScriptContent) {
    composables = extractComposablesFromSource(originalScriptContent);
  }

  // === FUNCTIONS ===
  const functions = extractFunctionsFromScript(originalScriptContent, filePath);

  // === CONSTANTS / VARIABLES / TYPES / INTERFACES ===
  const constants = extractConstantsFromScript(originalScriptContent);
  const variables = extractVariablesFromScript(originalScriptContent);
  const types = extractTypesFromScript(originalScriptContent);
  const interfaces = extractInterfacesFromScript(originalScriptContent);

  // === ✅ defineSlots через AST (основной путь) ===
  let slotDefinitions: string[] = [];
  if (scriptAst) {
    try {
      const defs = extractSlotsFromAST(scriptAst);
      slotDefinitions = defs.map(d => d.name);
    } catch {
      // fallback
    }
  }
  if (slotDefinitions.length === 0) {
    slotDefinitions = extractSlotsFromSource(originalScriptContent).map(d => d.name);
  }

  // === CALL GRAPH ===
  const callGraph = buildCallGraphFromScript(originalScriptContent, functions, composables);

  // === СВЯЗЫВАНИЕ ВЫЗОВОВ ВНУТРИ ФУНКЦИЙ ===
  for (const func of functions) {
    const funcName = func.name;
    if (!funcName) continue;

    const calls: string[] = [];
    const funcBody = func.body || '';

    const callPatterns = [
      /\b(\w+)\(/g,
      /\b(\w+)\.(\w+)\(/g,
      /emit\(['"]([^'"]+)['"]\)/g,
      /\b(use\w+)\(/g,
    ];

    for (const pattern of callPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(funcBody)) !== null) {
        const callName = match[1] || match[2];
        if (callName && callName !== funcName && !calls.includes(callName)) {
          calls.push(callName);
        }
      }
    }

    func.calls = calls;
  }

  // === СВЯЗЫВАНИЕ calledBy ===
  for (const func of functions) {
    const funcName = func.name;
    if (!funcName) continue;

    for (const otherFunc of functions) {
      if (otherFunc.calls && otherFunc.calls.includes(funcName)) {
        if (!func.calledBy) func.calledBy = [];
        if (!func.calledBy.includes(otherFunc.name)) {
          func.calledBy.push(otherFunc.name);
        }
      }
    }
  }

  // === ✅ СВЯЗЬ templateRefs → defineExpose (двухпроходная) ===
  linkTemplateRefsToExpose(templateAnalysis, functions, options.globalMap);

  // === ✅ НОВОЕ v4.2.0: агрегация reactivityDeps ===
  // Собираем root-идентификаторы из всех expressions в единый список.
  // Это то, что реально используется в реактивных зависимостях шаблона.
  const rootDepsSet = new Set<string>();
  for (const expr of templateAnalysis.expressions) {
    if (expr.rootIdentifiers && Array.isArray(expr.rootIdentifiers)) {
      for (const id of expr.rootIdentifiers) {
        if (id) rootDepsSet.add(id);
      }
    }
  }
  templateAnalysis.reactivityDeps = [...rootDepsSet];

  // ============================================
  // ✅ НОВОЕ v4.3.0 + v4.4.0: РАСШИРЕННЫЙ АНАЛИЗ
  // ============================================
  // Вызываем анализаторы lifecycle, effects, injections, reactivity.
  //
  // ВАЖНО: эти анализаторы работают на сыром тексте <script setup>
  // (originalScriptContent), а не на AST. Это сделано осознанно:
  //   - lifecycle-хуки и эффекты проще найти регулярками;
  //   - reactivity (ref/computed/watch) — тоже регулярками, но
  //     с поддержкой generic-параметров (исправлено в v9.0.1);
  //   - injections (provide/inject) — аналогично.
  //
  // Все ошибки оборачиваются в try/catch, чтобы один анализатор
  // не сломал весь Vue-анализ.
  //
  // ✅ v4.4.0: добавлен extractEffects (был упущен в v4.3.0).
  //   Без него секция `effects` в FullJSON всегда была пустой.
  // ============================================

  let lifecycle: VueComponentAnalysis['lifecycle'] = [];
  let effects: VueComponentAnalysis['effects'] = [];
  let injections: VueComponentAnalysis['injections'] = [];
  let reactivity: VueComponentAnalysis['reactivity'] = [];

  if (originalScriptContent && originalScriptContent.trim() !== '') {
    // --- LIFECYCLE ---
    try {
      lifecycle = extractLifecycle(originalScriptContent);
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `⚠️ extractLifecycle failed for ${path.basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      lifecycle = [];
    }

    // --- EFFECTS ---
    // ✅ v4.4.0: КРИТИЧНО — без этого секция `ef` всегда пустая
    try {
      effects = extractEffects(originalScriptContent);
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `⚠️ extractEffects failed for ${path.basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      effects = [];
    }

    // --- INJECTIONS ---
    try {
      injections = extractInjections(originalScriptContent);
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `⚠️ extractInjections failed for ${path.basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      injections = [];
    }

    // --- REACTIVITY ---
    try {
      reactivity = extractReactivity(originalScriptContent);
    } catch (error) {
      if (options.verbose) {
        console.warn(
          `⚠️ extractReactivity failed for ${path.basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      reactivity = [];
    }
  }

  // === СТАТИСТИКА ===
  const allSlots = [...new Set([...templateAnalysis.slots, ...slotDefinitions])];

  let totalSize = 0;
  try {
    totalSize = fs.statSync(filePath).size;
  } catch {
    totalSize = fileContent.length;
  }

  // === ✅ setupAttributes через нормализованный API ===
  const setupAttributes = extractSetupAttributes(descriptor);

  const analysis: VueComponentAnalysis = {
    componentName: path.basename(filePath, '.vue'),
    filePath,
    script: {
      content: originalScriptContent,
      ast: scriptAst,
      isSetup,
      isTS,
      size: originalScriptContent.length,
    },
    template: templateAnalysis,
    props,
    emits,
    expose,
    slots: allSlots,
    imports,
    composables,
    functions,
    constants,
    variables,
    types,
    interfaces,
    callGraph,
    stats: {
      scriptLines: originalScriptContent.split('\n').length,
      templateLines: descriptor.template?.content.split('\n').length || 0,
      styleCount: descriptor.styles.length,
      totalSize,
    },
    setupAttributes,

    // ✅ НОВОЕ v4.3.0 + v4.4.0: расширенные секции
    lifecycle,
    effects,
    injections,
    reactivity,
  };

  // ✅ v4.4.0: логирование расширенных секций (для отладки)
  if (options.verbose) {
    console.log(
      `   🔬 Vue-анализ ${path.basename(filePath)}: lifecycle=${lifecycle.length}, ` +
        `effects=${effects.length}, injections=${injections.length}, reactivity=${reactivity.length}`
    );
  }

  return analysis;
}

// ============================================
// СВЯЗЬ TEMPLATE REFS → defineExpose
// ============================================

/**
 * Для каждого template ref связывает с expose целевого компонента.
 *
 * Двухпроходный подход:
 *   1. Из глобальной карты берём expose нужного компонента по тегу
 *   2. Записываем в templateRefs[ref].exposedMethods
 *
 * Fallback: если глобальная карта пуста — используем локальную эвристику
 * (ищем функцию с именем = refValue в текущем файле).
 *
 * @param templateAnalysis — результат анализа шаблона текущего компонента
 * @param functions — функции текущего компонента (для fallback)
 * @param globalMap — глобальная карта компонентов проекта
 */
function linkTemplateRefsToExpose(
  templateAnalysis: VueComponentAnalysis['template'],
  functions: VueComponentAnalysis['functions'],
  globalMap?: GlobalComponentMap
): void {
  for (const ref of templateAnalysis.templateRefs) {
    if (!ref.refValue) continue;

    const tag = ref.tag;
    if (!tag || tag === 'unknown') continue;

    // ============================================
    // 1. ГЛОБАЛЬНАЯ КАРТА (основной путь)
    // ============================================
    if (globalMap && globalMap.size > 0) {
      const info = globalMap.get(tag);
      if (info && info.expose.length > 0) {
        ref.exposedMethods = [...info.expose];
        continue;
      }

      // Пробуем kebab-case → PascalCase
      const pascal = toPascalCase(tag);
      if (pascal !== tag) {
        const info2 = globalMap.get(pascal);
        if (info2 && info2.expose.length > 0) {
          ref.exposedMethods = [...info2.expose];
          continue;
        }
      }
    }

    // ============================================
    // 2. FALLBACK: локальная эвристика
    // ============================================
    // Если глобальная карта не дала результата — ищем функцию
    // с именем = refValue в текущем файле
    const matchingFunc = functions.find(f => f.name === ref.refValue);
    if (matchingFunc) {
      ref.exposedMethods = [matchingFunc.name];
    }
  }
}

/**
 * kebab-case → PascalCase.
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ============================================
// ИЗВЛЕЧЕНИЕ setupAttributes (нормализованный API)
// ============================================

function extractSetupAttributes(descriptor: any): VueComponentAnalysis['setupAttributes'] {
  const setupBlock = descriptor.scriptSetup;
  if (!setupBlock) {
    return { isSetup: false };
  }

  const result: VueComponentAnalysis['setupAttributes'] = {
    isSetup: true,
    lang: setupBlock.lang === 'ts' ? 'ts' : 'js',
  };

  // ✅ Нормализуем API attrs (массив / объект / undefined)
  const attrs = setupBlock.attrs;
  let genericValue: string | undefined;

  if (Array.isArray(attrs)) {
    const genericAttr = attrs.find((a: any) => a.name === 'generic');
    if (genericAttr?.value) genericValue = genericAttr.value;
  } else if (attrs && typeof attrs === 'object') {
    genericValue = (attrs as any).generic;
  }

  if (genericValue) {
    result.generic = genericValue;
  }

  return result;
}

// ============================================
// CLI-АНАЛИЗ (двухпроходный)
// ============================================

export async function analyzeVueComponentCli(
  filePath: string,
  options: AnalyzeVueOptions = {}
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 АНАЛИЗ VUE КОМПОНЕНТА');
  console.log(`${'='.repeat(60)}\n`);

  // ============================================
  // ПЕРВЫЙ ПРОХОД: строим глобальную карту
  // ============================================
  let globalMap: GlobalComponentMap | undefined = options.globalMap;

  if (!globalMap) {
    const projectRoot = findProjectRoot(filePath);
    console.log(`📁 Сканирование проекта: ${projectRoot}`);

    const startTime = Date.now();
    globalMap = await buildGlobalComponentMap({
      projectRoot,
      debug: options.verbose === true,
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Найдено компонентов: ${globalMap.size} (${duration}s)\n`);
  }

  // ============================================
  // ВТОРОЙ ПРОХОД: анализ конкретного файла
  // ============================================
  const analysis = analyzeVueComponent(filePath, {
    ...options,
    globalMap,
  });

  if (!analysis) {
    console.error('❌ Не удалось проанализировать Vue компонент');
    return;
  }

  // Выводим статистику по связанным refs
  const linkedRefs = analysis.template.templateRefs.filter(
    r => r.exposedMethods && r.exposedMethods.length > 0
  );
  if (linkedRefs.length > 0) {
    console.log(`🔗 Связано refs с expose: ${linkedRefs.length}`);
    for (const ref of linkedRefs.slice(0, 5)) {
      console.log(`   • ref="${ref.refValue}" (${ref.tag}) → [${ref.exposedMethods!.join(', ')}]`);
    }
    if (linkedRefs.length > 5) {
      console.log(`   ... и ещё ${linkedRefs.length - 5}`);
    }
    console.log('');
  }

  // ✅ НОВОЕ v4.3.0 + v4.4.0: статистика расширенного анализа
  if (analysis.lifecycle.length > 0) {
    console.log(`🧬 Lifecycle hooks: ${analysis.lifecycle.length}`);
  }
  if (analysis.effects.length > 0) {
    console.log(`⚡ Effects: ${analysis.effects.length}`);
  }
  if (analysis.injections.length > 0) {
    console.log(`💉 Injections: ${analysis.injections.length}`);
  }
  if (analysis.reactivity.length > 0) {
    console.log(`🔄 Reactivity: ${analysis.reactivity.length}`);
  }
  if (analysis.template.conditionals.length > 0) {
    console.log(`🎯 Conditionals: ${analysis.template.conditionals.length}`);
  }

  const report = generateVueComponentReport(analysis);
  console.log(report);

  const outputFile = `${analysis.componentName}-analysis.md`;
  fs.writeFileSync(outputFile, report);
  console.log(`\n✅ Отчет сохранен: ${outputFile}`);

  const jsonOutput = {
    analysis,
    timestamp: new Date().toISOString(),
    version: '4.4.0',
  };
  const jsonFile = `${analysis.componentName}-analysis.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`✅ JSON сохранен: ${jsonFile}`);
}

/**
 * Находит корень проекта от указанного файла.
 * Идёт вверх, ищет package.json или .git.
 *
 * ✅ ИСПРАВЛЕНО v4.2.0: функция экспортируется (для использования в CLI).
 */
export function findProjectRoot(fromFile: string): string {
  let dir = path.dirname(path.resolve(fromFile));
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.dirname(path.resolve(fromFile));
}

// ============================================
// ИНТЕГРАЦИЯ С split-module
// ============================================

export function enhanceWithVueAnalysis(
  targetFile: string,
  existingAnalysis: any,
  options: AnalyzeVueOptions = {}
) {
  if (!targetFile.endsWith('.vue')) return existingAnalysis;

  const vueAnalysis = analyzeVueComponent(targetFile, options);
  if (!vueAnalysis) return existingAnalysis;

  return {
    ...existingAnalysis,
    vue: vueAnalysis,
    enhancedInfo: {
      isVueComponent: true,
      hasProps: vueAnalysis.props.names.length > 0,
      hasEvents: vueAnalysis.emits.names.length > 0,
      hasSlots: vueAnalysis.slots.length > 0,
      usesComposables: vueAnalysis.composables.length > 0,
      templateComplexity: vueAnalysis.template.complexity,
      scriptSize: vueAnalysis.stats.scriptLines,
      functionsCount: vueAnalysis.functions.length,
      constantsCount: vueAnalysis.constants.length,
      typesCount: vueAnalysis.types.length,
      interfacesCount: vueAnalysis.interfaces.length,
      // ✅ НОВОЕ v4.3.0 + v4.4.0
      lifecycleCount: vueAnalysis.lifecycle.length,
      effectsCount: vueAnalysis.effects.length,
      injectionsCount: vueAnalysis.injections.length,
      reactivityCount: vueAnalysis.reactivity.length,
      conditionalsCount: vueAnalysis.template.conditionals.length,
    },
  };
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  analyzeVueComponent,
  parseVueFile,
  compileScriptBlock,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
  buildGlobalComponentMap,
  findProjectRoot, // ✅ Явно экспортируем для CLI
};
