// packages/ast-analyzer/src/core/entity-extractor/vue/convert-analysis.ts
// ============================================
// ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================
// Исправления:
//   1. Пути импортов приведены к правильным относительным путям
//      (на 3 уровня выше до src/, на 2 уровня выше до core/)
//   2. Добавлены явные типы для параметров (устранены TS7006)
//   3. Импортированы недостающие типы (ConstantInfo)
//   4. ✅ НОВОЕ v2: проброс reactivityDeps из VueComponentAnalysis.template
//      в EntitiesResult (как templateReactivityDeps)
//   5. ✅ НОВОЕ v3.1.0: проброс ВСЕХ template-полей в EntitiesResult
//      (eventHandlers, dynamicComponents, cssVariables, deepSelectors,
//       directives, usedComponents, slots, complexity)
//      Ключевое правило: vt — отдельная сущность (шаблон),
//      хранит ССЫЛКИ (имена/примитивы), без дубликатов объектов.
// ============================================

import path from 'path';
import type { VueComponentAnalysis } from '../../../modes/vue-analyzer.js';
import type { FunctionInfo, EntitiesResult, ConstantInfo } from '../../../types.js';
import idManager from '../../IdManager.js';
import { createEmptyEntitiesResult } from '../helpers/create-empty-result.js';
import { convertVueImportsToImportInfo } from './convert-imports.js';

/**
 * Конвертер: VueAnalysis → EntitiesResult
 */
export function convertVueAnalysisToEntities(
  vueAnalysis: VueComponentAnalysis,
  filePath: string
): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);
  const componentName = vueAnalysis.componentName || path.basename(filePath, '.vue');

  // ==========================================
  // 0. ✅ НОВОЕ v3.1.0: проброс ВСЕХ template-полей
  // ==========================================
  // Сохраняем root-идентификаторы (reactivityDeps), обработчики событий,
  // динамические компоненты, CSS-переменные, :deep() селекторы, слоты,
  // использованные компоненты, директивы и сложность шаблона
  // в метаданные EntitiesResult.
  //
  // ⚠️ КЛЮЧЕВОЕ ПРАВИЛО: vt (Vue template) — это ОТДЕЛЬНАЯ СУЩНОСТЬ,
  //    а не агрегатор связей. Здесь мы храним ССЫЛКИ (имена/примитивы),
  //    а не дубликаты объектов. Рёбра (event → handler, templateRef → expose)
  //    создаются позже, в compact-reporter, на основе этих ссылок.
  //
  // Поля не входят в стандартный интерфейс EntitiesResult, поэтому
  // приводим через `as any` — для обратной совместимости.
  const template = vueAnalysis.template;

  const templateReactivityDeps: string[] = template?.reactivityDeps || [];
  (result as any).templateReactivityDeps = templateReactivityDeps;

  (result as any).templateEventHandlers = template?.eventHandlers || [];
  (result as any).templateDynamicComponents = template?.dynamicComponents || [];
  (result as any).templateCssVariables = template?.cssVariables || [];
  (result as any).templateDeepSelectors = template?.deepSelectors || [];
  (result as any).templateDirectives = template?.directives || [];
  (result as any).templateUsedComponents =
    template?.usedComponents?.map((c: { name: string }) => c.name) || [];
  (result as any).templateSlots = template?.slots || [];
  (result as any).templateComplexity = template?.complexity || 0;

  // ==========================================
  // 1. PROPS → ИНТЕРФЕЙСЫ + ТИПЫ
  // ==========================================
  if (vueAnalysis.props.names.length > 0) {
    result.interfaces.push({
      name: `${componentName}Props`,
      line: 0,
      isExported: true,
      properties: vueAnalysis.props.names,
      startLine: 0,
      endLine: 0,
    });

    for (const name of vueAnalysis.props.names) {
      const typeName = name.charAt(0).toUpperCase() + name.slice(1);
      result.types.push({
        name: `${componentName}${typeName}Prop`,
        line: 0,
        isExported: true,
        definition: vueAnalysis.props.types[name] || 'any',
      });
    }
  }

  // ==========================================
  // 2. EMITS → ТИПЫ
  // ==========================================
  if (vueAnalysis.emits.names.length > 0) {
    const emitDefs = vueAnalysis.emits.names
      .map((n: string) => `${n}: (...args: any[]) => void`)
      .join('; ');
    result.types.push({
      name: `${componentName}Emits`,
      line: 0,
      isExported: true,
      definition: `{ ${emitDefs} }`,
    });
  }

  // ==========================================
  // 3. COMPOSABLES → ФУНКЦИИ
  // ==========================================
  for (const comp of vueAnalysis.composables) {
    const funcInfo: FunctionInfo = {
      name: comp.name,
      line: 0,
      isAsync: false,
      isExported: true,
      params: comp.args || [],
      returnType: 'any',
      calls: [],
      calledBy: [],
      body: '',
      startLine: 0,
      endLine: 0,
      isMethod: false,
      className: undefined,
      isNested: false,
      parentFunction: undefined,
      isArrow: false,
      isEventHandler: false,
      eventType: undefined,
      depth: 0,
      complexity: 1,
      security: {
        hasEval: false,
        hasProcessEnv: false,
        hasSensitiveData: false,
        hasExec: false,
        hasPassword: false,
      },
      id: idManager.generateCompactId({
        filePath,
        funcName: comp.name,
        line: 0,
        type: 'vue',
      }),
      vscode: `vscode://file/${filePath}`,
      moduleId: idManager.getModuleId ? idManager.getModuleId(filePath) : undefined,
      fileId: idManager.getFileId ? idManager.getFileId(filePath) : undefined,
    };
    result.functions.push(funcInfo);
    result.callGraph[comp.name] = [];
  }

  // ==========================================
  // 4. SLOTS → ЭКСПОРТЫ
  // ==========================================
  for (const slot of vueAnalysis.slots) {
    result.exports.push({
      name: slot,
      type: 'value',
      isDefault: false,
      loc: null,
    });
  }

  // ==========================================
  // 5. CONSTANTS ИЗ СКРИПТА
  // ==========================================
  const scriptContent = vueAnalysis.script.content || '';
  if (scriptContent) {
    const constRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = constRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      const value = match[2]?.trim() || '';
      if (name && !result.constants.find((c: ConstantInfo) => c.name === name)) {
        result.constants.push({
          name: name,
          line: 0,
          value: value,
          isExported: scriptContent.includes(`export const ${name}`),
          type: 'unknown',
        });
      }
    }

    const macroRegex =
      /(?:const\s+)?(defineProps|defineEmits|defineExpose|withDefaults)\s*<[^>]*>\s*\(/g;
    while ((match = macroRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      if (name && !result.constants.find((c: ConstantInfo) => c.name === name)) {
        result.constants.push({
          name: name,
          line: 0,
          value: `Vue macro: ${name}`,
          isExported: true,
          type: 'macro',
        });
      }
    }
  }

  // ==========================================
  // 6. АНАЛИЗ ВЫЗОВОВ МЕЖДУ COMPOSABLES
  // ==========================================
  const allComposableNames = vueAnalysis.composables.map((c: { name: string }) => c.name);
  if (allComposableNames.length > 1 && scriptContent) {
    const pattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
    let callMatch;
    while ((callMatch = pattern.exec(scriptContent)) !== null) {
      const caller = callMatch[1];
      if (caller) {
        const calls: string[] = [];
        const innerPattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
        let innerMatch;
        while (
          (innerMatch = innerPattern.exec(scriptContent.substring(callMatch.index))) !== null
          ) {
          const called = innerMatch[1];
          if (called && called !== caller && !calls.includes(called)) {
            calls.push(called);
          }
        }
        if (calls.length > 0) {
          result.callGraph[caller] = calls;
          const func = result.functions.find((f: FunctionInfo) => f.name === caller);
          if (func) {
            func.calls = calls;
          }
        }
      }
    }
  }

  // ==========================================
  // 7. АНАЛИЗ ВЫЗОВОВ ВНУТРИ ФУНКЦИЙ
  // ==========================================
  for (const func of result.functions) {
    const funcName = func.name;
    if (!funcName) continue;

    const calls: string[] = [];
    const funcBody = func.body || '';

    const callPatterns = [
      /\b(\w+)\s*\(/g,
      /\b(\w+)\.(\w+)\s*\(/g,
      /emit\(['"]([^'"]+)['"]\)/g,
      /\b(use\w+)\s*\(/g,
    ];

    for (const pattern of callPatterns) {
      let match;
      while ((match = pattern.exec(funcBody)) !== null) {
        const callName = match[1] || match[2];
        if (callName && callName !== funcName && !calls.includes(callName)) {
          calls.push(callName);
        }
      }
    }

    func.calls = calls;
    result.callGraph[funcName] = calls;
  }

  // ==========================================
  // 8. ПОСТРОЕНИЕ calledBy
  // ==========================================
  for (const func of result.functions) {
    const funcName = func.name;
    if (!funcName) continue;

    func.calledBy = [];
    for (const otherFunc of result.functions) {
      if (otherFunc.calls && otherFunc.calls.includes(funcName)) {
        if (!func.calledBy.includes(otherFunc.name)) {
          func.calledBy.push(otherFunc.name);
        }
      }
    }
  }

  // ==========================================
  // 9. ИМПОРТЫ ИЗ VUE
  // ==========================================
  if (vueAnalysis.imports && vueAnalysis.imports.length > 0) {
    result.imports = convertVueImportsToImportInfo(vueAnalysis.imports);
  }

  // ==========================================
  // 10. ЛОГИРОВАНИЕ ИТОГОВОЙ СТАТИСТИКИ
  // ==========================================
  console.log(
    `   🎯 Vue-анализ: ${result.functions.length} функций, ${result.constants.length} констант, ${result.imports.length} импортов`
  );

  // ✅ НОВОЕ: логируем reactivityDeps, если они есть
  if (templateReactivityDeps.length > 0) {
    console.log(
      `   ⚡ Reactivity deps (${templateReactivityDeps.length}): ${templateReactivityDeps.slice(0, 5).join(', ')}${
        templateReactivityDeps.length > 5 ? '...' : ''
      }`
    );
  }

  // ✅ НОВОЕ v3.1.0: логируем остальные template-секции
  const eventHandlersCount = template?.eventHandlers?.length || 0;
  const dynamicComponentsCount = template?.dynamicComponents?.length || 0;
  const cssVariablesCount = template?.cssVariables?.length || 0;
  const deepSelectorsCount = template?.deepSelectors?.length || 0;
  const usedComponentsCount = template?.usedComponents?.length || 0;
  const templateRefsCount = template?.templateRefs?.length || 0;

  if (
    eventHandlersCount +
    dynamicComponentsCount +
    cssVariablesCount +
    deepSelectorsCount +
    usedComponentsCount +
    templateRefsCount >
    0
  ) {
    console.log(`   🎨 Template-секции Vue:`);
    if (eventHandlersCount) console.log(`      • eventHandlers: ${eventHandlersCount}`);
    if (dynamicComponentsCount) console.log(`      • dynamicComponents: ${dynamicComponentsCount}`);
    if (cssVariablesCount) console.log(`      • cssVariables: ${cssVariablesCount}`);
    if (deepSelectorsCount) console.log(`      • deepSelectors: ${deepSelectorsCount}`);
    if (usedComponentsCount) console.log(`      • usedComponents: ${usedComponentsCount}`);
    if (templateRefsCount) console.log(`      • templateRefs: ${templateRefsCount}`);
  }

  return result;
}
