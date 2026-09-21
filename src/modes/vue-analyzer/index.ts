// src/modes/vue-analyzer/index.ts
// ============================================
// ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА VUE КОМПОНЕНТА
// ============================================
// Версия: 5.0.1
//
// ИЗМЕНЕНИЯ v5.0.1 (fix TS6133):
//   - ✅ ИСПРАВЛЕНО: убрана неиспользуемая переменная `compiledScript`
//     в analyzeVueComponent — она больше не нужна после удаления
//     extractPropsFromCompiledScript, extractEmitsFromCompiledScript,
//     extractExposeFromCompiledScript
//   - ✅ УБРАН вызов compileScriptBlock(descriptor, filePath)
//     (больше не используется)
//   - ✅ УБРАН реэкспорт `compileScriptBlock` из './parser.js'
//     (больше не нужен)
//
// ИЗМЕНЕНИЯ v5.0.0 (удаление props/emits/expose):
//   - ✅ УДАЛЕНЫ импорты extractProps*, extractEmits*, extractExpose*
//   - ✅ УДАЛЕНЫ реэкспорты extractProps*, extractEmits*, extractExpose*
//   - ✅ ЗАМЕНЕНО: analyzeVueComponent больше НЕ извлекает
//     props/emits/expose напрямую — только через vue-macros
//     (в relation-resolver)
//   - ✅ УБРАНЫ поля props/emits/expose из результата
//     VueComponentAnalysis — они заполняются позже
//     в relation-resolver (пустые заглушки для совместимости)
//
// ИЗМЕНЕНИЯ v4.4.0 (FINAL, v9.0.0):
//   - ✅ ДОБАВЛЕНО: вызов extractEffects
//   - ✅ ДОБАВЛЕНО: defensive-проверки для extractLifecycle/
//     extractEffects/extractInjections/extractReactivity
// ============================================

import fs from 'fs';
import path from 'path';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';

// ============================================
// РЕЭКСПОРТЫ
// ============================================

export * from './types.js';
export { parseVueFile } from './parser.js';

// ✅ ОБНОВЛЕНО: убраны extractProps*, extractEmits*, extractExpose*
export {
  extractImportsFromAST,
  extractImportsFromSource,
  extractImportsWithDetails,
  groupImportsByType,
  isImportUsed,
  filterUnusedImports,
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

// ============================================
// ИМПОРТЫ
// ============================================

import type { VueComponentAnalysis, AnalysisOptions } from './types.js';
import { parseVueFile } from './parser.js';
import { analyzeTemplate } from './template.js';
import {
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

// ✅ Анализаторы lifecycle/effects/injections/reactivity
import {
  extractLifecycle,
  extractEffects,
  extractInjections,
  extractReactivity,
} from '../../analyzers/index.js';

// ============================================
// РАСШИРЕННЫЕ ОПЦИИ АНАЛИЗА
// ============================================

export interface AnalyzeVueOptions extends AnalysisOptions {
  globalMap?: GlobalComponentMap;
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

  // ✅ УБРАНО: compileScriptBlock — больше не нужен
  // (extractPropsFromCompiledScript / extractEmitsFromCompiledScript /
  //  extractExposeFromCompiledScript удалены)

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

  // === defineSlots через AST ===
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

  // === СВЯЗЬ templateRefs → defineExpose (двухпроходная) ===
  linkTemplateRefsToExpose(templateAnalysis, functions, options.globalMap);

  // === ✅ Агрегация reactivityDeps ===
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
  // ✅ РАСШИРЕННЫЙ АНАЛИЗ (lifecycle/effects/injections/reactivity)
  // ============================================

  let lifecycle: VueComponentAnalysis['lifecycle'] = [];
  let effects: VueComponentAnalysis['effects'] = [];
  let injections: VueComponentAnalysis['injections'] = [];
  let reactivity: VueComponentAnalysis['reactivity'] = [];

  if (originalScriptContent && originalScriptContent.trim() !== '') {
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

    // ✅ УБРАНО: props, emits, expose — заполняются в relation-resolver
    props: { names: [], types: {}, required: {}, defaults: {} },
    emits: { names: [], types: {} },
    expose: [],

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

    // ✅ расширенные секции
    lifecycle,
    effects,
    injections,
    reactivity,
  };

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

function linkTemplateRefsToExpose(
  templateAnalysis: VueComponentAnalysis['template'],
  functions: VueComponentAnalysis['functions'],
  globalMap?: GlobalComponentMap
): void {
  for (const ref of templateAnalysis.templateRefs) {
    if (!ref.refValue) continue;

    const tag = ref.tag;
    if (!tag || tag === 'unknown') continue;

    if (globalMap && globalMap.size > 0) {
      const info = globalMap.get(tag);
      if (info && info.expose.length > 0) {
        ref.exposedMethods = [...info.expose];
        continue;
      }

      const pascal = toPascalCase(tag);
      if (pascal !== tag) {
        const info2 = globalMap.get(pascal);
        if (info2 && info2.expose.length > 0) {
          ref.exposedMethods = [...info2.expose];
          continue;
        }
      }
    }

    const matchingFunc = functions.find(f => f.name === ref.refValue);
    if (matchingFunc) {
      ref.exposedMethods = [matchingFunc.name];
    }
  }
}

function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ============================================
// ИЗВЛЕЧЕНИЕ setupAttributes
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

  const analysis = analyzeVueComponent(filePath, {
    ...options,
    globalMap,
  });

  if (!analysis) {
    console.error('❌ Не удалось проанализировать Vue компонент');
    return;
  }

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
    version: '5.0.1',
  };
  const jsonFile = `${analysis.componentName}-analysis.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`✅ JSON сохранен: ${jsonFile}`);
}

/**
 * Находит корень проекта от указанного файла.
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
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
  buildGlobalComponentMap,
  findProjectRoot,
};
