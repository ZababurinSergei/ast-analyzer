// src/modes/vue-analyzer/index.ts

import fs from 'fs';
import path from 'path';
import { parse as parseTS } from '@typescript-eslint/parser';
import type { Program } from 'estree';

// Типы
export * from './types.js';

// Парсер
export { parseVueFile, compileScriptBlock } from './parser.js';

// Экстракторы
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
} from './extractors/index.js';

// Template
export { analyzeTemplate } from './template.js';

// CallGraph
export { buildCallGraphFromScript } from './callgraph.js';

// Report
export { generateVueComponentReport } from './report.js';

// Utils - только используемые функции
export { getNodeValue } from './utils.js';

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
} from './extractors/index.js';
import { buildCallGraphFromScript } from './callgraph.js';
import { generateVueComponentReport } from './report.js';

/**
 * Основная функция анализа Vue компонента
 * ✅ Улучшена: использует AST fallback при ошибке компиляции
 * ✅ НОВОЕ: полное извлечение вызовов функций и связей между ними
 */
export function analyzeVueComponent(
  filePath: string,
  options: AnalysisOptions = {}
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
  if (!parsed) {
    return null;
  }

  const { descriptor } = parsed;

  // ✅ Пытаемся скомпилировать script, но не блокируемся при ошибке
  const compiledScript = compileScriptBlock(descriptor, filePath);
  const templateAnalysis = analyzeTemplate(descriptor, options);

  const originalScriptContent = descriptor.scriptSetup?.content || descriptor.script?.content || '';
  const isSetup = !!descriptor.scriptSetup;
  const isTS = !!(descriptor.scriptSetup?.lang === 'ts' || descriptor.script?.lang === 'ts');

  // 1. ИЗВЛЕЧЕНИЕ PROPS
  let props = extractPropsFromCompiledScript(compiledScript);

  // ✅ Если компиляция не удалась, используем AST
  if (props.names.length === 0) {
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

    if (scriptAst) {
      const astProps = extractPropsFromAST(scriptAst);
      if (astProps.names.length > 0) {
        props = astProps;
      }
    }
  }

  // Если AST не дал результатов, используем regex fallback
  if (props.names.length === 0) {
    props = extractPropsFromSource(originalScriptContent);
  }

  // 2. ИЗВЛЕЧЕНИЕ EMITS
  let emits = extractEmitsFromCompiledScript(compiledScript);

  // ✅ Если компиляция не удалась, используем AST
  if (emits.names.length === 0) {
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

    if (scriptAst) {
      const astEmits = extractEmitsFromAST(scriptAst);
      if (astEmits.names.length > 0) {
        emits = astEmits;
      }
    }
  }

  // Если AST не дал результатов, используем regex fallback
  if (emits.names.length === 0) {
    emits = extractEmitsFromSource(originalScriptContent);
  }

  // 3. ИЗВЛЕЧЕНИЕ EXPOSE
  let expose = extractExposeFromCompiledScript(compiledScript);

  // ✅ Если компиляция не удалась, используем AST
  if (expose.length === 0) {
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

    if (scriptAst) {
      const astExpose = extractExposeFromAST(scriptAst);
      if (astExpose.length > 0) {
        expose = astExpose;
      }
    }
  }

  // 4. ИЗВЛЕЧЕНИЕ IMPORTS
  let imports: VueComponentAnalysis['imports'] = [];

  if (originalScriptContent) {
    try {
      const scriptAst = parseTS(originalScriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      }) as Program;

      if (scriptAst) {
        imports = extractImportsFromAST(scriptAst);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // Если AST не дал результатов, используем regex fallback
  if (imports.length === 0 && originalScriptContent) {
    imports = extractImportsFromSource(originalScriptContent);
  }

  // 5. ИЗВЛЕЧЕНИЕ COMPOSABLES
  let composables: VueComponentAnalysis['composables'] = [];

  if (originalScriptContent) {
    try {
      const scriptAst = parseTS(originalScriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      }) as Program;

      if (scriptAst) {
        composables = extractComposablesFromAST(scriptAst);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  // Если AST не дал результатов, используем regex fallback
  if (composables.length === 0 && originalScriptContent) {
    composables = extractComposablesFromSource(originalScriptContent);
  }

  // 6. ИЗВЛЕЧЕНИЕ ФУНКЦИЙ
  const functions = extractFunctionsFromScript(originalScriptContent, filePath);

  // 7. ИЗВЛЕЧЕНИЕ КОНСТАНТ
  const constants = extractConstantsFromScript(originalScriptContent);

  // 8. ИЗВЛЕЧЕНИЕ ПЕРЕМЕННЫХ
  const variables = extractVariablesFromScript(originalScriptContent);

  // 9. ИЗВЛЕЧЕНИЕ ТИПОВ
  const types = extractTypesFromScript(originalScriptContent);

  // 10. ИЗВЛЕЧЕНИЕ ИНТЕРФЕЙСОВ
  const interfaces = extractInterfacesFromScript(originalScriptContent);

  // 11. ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ
  const callGraph = buildCallGraphFromScript(originalScriptContent, functions, composables);

  // ============================================
  // 🆕 11.1. АНАЛИЗ ВЫЗОВОВ ВНУТРИ ФУНКЦИЙ
  // ============================================
  for (const func of functions) {
    const funcName = func.name;
    if (!funcName) continue;

    // Находим вызовы внутри тела функции
    const calls: string[] = [];
    const funcBody = func.body || '';

    // Паттерны вызовов: func(), object.method(), emit(), composable()
    const callPatterns = [
      /\b(\w+)\(/g, // func()
      /\b(\w+)\.(\w+)\(/g, // object.method()
      /emit\(['"]([^'"]+)['"]\)/g, // emit('event')
      /\b(use\w+)\(/g, // useComposable()
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

    // Сохраняем вызовы в функции
    func.calls = calls;
  }

  // ============================================
  // 🆕 11.2. ПОСТРОЕНИЕ calledBy (кто вызывает функцию)
  // ============================================
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

  // ============================================
  // 12. СТАТИСТИКА
  // ============================================
  const allSlots = [
    ...new Set([...templateAnalysis.slots, ...((compiledScript as any)?.slots || [])]),
  ];

  let totalSize = 0;
  try {
    totalSize = fs.statSync(filePath).size;
  } catch {
    totalSize = fileContent.length;
  }

  // 13. ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
  const analysis: VueComponentAnalysis = {
    componentName: path.basename(filePath, '.vue'),
    filePath,

    script: {
      content: originalScriptContent,
      ast: null,
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
  };

  // Заполняем ast, если доступен
  if (originalScriptContent) {
    try {
      const scriptAst = parseTS(originalScriptContent, {
        ecmaVersion: 2022,
        sourceType: 'module',
        loc: true,
        range: true,
        ecmaFeatures: { jsx: true },
      }) as Program;
      analysis.script.ast = scriptAst;
    } catch {
      // Игнорируем ошибки парсинга
    }
  }

  return analysis;
}

/**
 * Интеграция с split-module
 */
export function enhanceWithVueAnalysis(targetFile: string, existingAnalysis: any) {
  if (!targetFile.endsWith('.vue')) {
    return existingAnalysis;
  }

  const vueAnalysis = analyzeVueComponent(targetFile);
  if (!vueAnalysis) {
    return existingAnalysis;
  }

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
    },
  };
}

/**
 * CLI анализ
 */
export async function analyzeVueComponentCli(
  filePath: string,
  options: AnalysisOptions = {}
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎯 АНАЛИЗ VUE КОМПОНЕНТА');
  console.log(`${'='.repeat(60)}\n`);

  const analysis = analyzeVueComponent(filePath, options);

  if (!analysis) {
    console.error('❌ Не удалось проанализировать Vue компонент');
    return;
  }

  const report = generateVueComponentReport(analysis);
  console.log(report);

  const outputFile = `${analysis.componentName}-analysis.md`;
  fs.writeFileSync(outputFile, report);
  console.log(`\n✅ Отчет сохранен: ${outputFile}`);

  const jsonOutput = {
    analysis,
    timestamp: new Date().toISOString(),
    version: '3.0.0',
  };
  const jsonFile = `${analysis.componentName}-analysis.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2));
  console.log(`✅ JSON сохранен: ${jsonFile}`);
}

// Экспорт по умолчанию
export default {
  analyzeVueComponent,
  parseVueFile,
  compileScriptBlock,
  generateVueComponentReport,
  enhanceWithVueAnalysis,
  analyzeVueComponentCli,
};
