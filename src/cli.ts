#!/usr/bin/env node

/**
 * CLI entry point for graph-analyzer
 * Handles command-line argument parsing and routing to appropriate modes
 */
import { isMainModule } from './utils/is-main.js';

import fs from 'fs';
import path from 'path';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

// Core modules
import { minifyForAI } from './core/minifier.js';
import { findCyclicEdges, convertToDOT } from './core/graph-utils.js';
import { setTsConfigPath, loadTsConfig } from './core/tsconfig-resolver.js';
import { parseFile } from './core/ast-parser.js';
import { extractEntities } from './core/entity-extractor.js';

// Mode modules
import { buildProjectGraph } from './modes/project-graph.js';
import { buildFileInternalGraph } from './modes/file-graph.js';
import { buildAiPromptPack } from './modes/prompt-pack.js';
import { buildSplitModulePrompt } from './modes/split-module.js';
import { runImpactAnalysis } from './modes/impact.js';
import { findDeadCode } from './modes/dead-code.js';
import { minifyFolder } from './modes/minify-folder.js';

// Vue analysis
import { analyzeVueComponent, generateVueComponentReport } from './modes/vue-analyzer.js';

// Auto Refactor
import { AutoRefactor } from './refactor/index.js';

// Semantic Analysis
import { SemanticPipeline } from './ci-cd/SemanticPipeline.js';
import { Z3Verifier, createIntParam, eq, range } from './formal/Z3Verifier.js';

// Hybrid Report
import { runHybridReport } from './modes/hybrid-report/index.js';

import { extractEntitiesFromFile } from './reporters/json-reporter.js';

// Reporters
import { generateHTMLReport } from './reporters/html-reporter.js';
import {
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport as saveEnhancedPackageLockReport,
  saveOptimizedPackageLockReport,
} from './reporters/json-reporter.js';
import { generateInteractiveHTML } from './reporters/interactive-reporter.js';
import { COMPACT_REPORT_CONFIG } from './config.js';
import { generateCompactEntityReport } from './reporters/compact-entity-reporter.js';

// ============================================
// 🆕 ЕДИНЫЙ ИСТОЧНИК ДАННЫХ
// ============================================
import { DataSourceBuilder, DataSourceAccessor } from './core/data-sources.js';

// 🆕 КОМПАКТНЫЙ ОТЧЕТ
import { compressReport, type CompressionLevel } from './reporters/compressReport.js';

// Types
import type { SplitModuleOptions, MinifyFolderOptions, GraphData, FullAnalysis, EntitiesResult } from './types.js';

// Utils
import { showHelp, DEFAULT_EXCLUDE_PATTERNS } from './utils.js';
import {
  normalizePathForDisplay,
  normalizeGraphPaths,
  normalizePathForOS,
} from './utils/path-utils.js';

// ==========================================
// ОПРЕДЕЛЕНИЕ ОС
// ==========================================

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Настройки для Windows
if (isWindows) {
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=4096';
  }
  console.log('🖥️ Windows detected - enabling long path support');
}

console.log(`🖥️ OS: ${isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux'}`);

// ==========================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОИСКА КОРНЯ ПРОЕКТА
// ==========================================

function findProjectRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

function resolveAbsoluteFilePath(filePath: string, projectRoot: string): string | null {
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  const candidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', filePath),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), 'src', filePath),
  ];

  const normalizedFilePath = filePath.replace(/\\\\/g, '/');
  const additionalCandidates = [
    path.resolve(projectRoot, normalizedFilePath),
    path.resolve(projectRoot, 'src', normalizedFilePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', normalizedFilePath),
  ];
  candidates.push(...additionalCandidates);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

// ==========================================
// ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ СУЩНОСТЕЙ ИЗ PACKAGE-LOCK REPORT
// ==========================================

function extractEntitiesFromPackageLock(packageLockReport: any): EntitiesResult {
  const result: EntitiesResult = {
    functions: [],
    classes: [],
    constants: [],
    interfaces: [],
    types: [],
    variables: [],
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: 'all',
    filePath: 'all',
  };

  if (!packageLockReport?.packages) {
    console.warn('⚠️ packageLockReport не содержит packages');
    return result;
  }

  let totalFunctions = 0;
  let totalCalls = 0;

  for (const [modulePath, pkg] of Object.entries(packageLockReport.packages)) {
    if (!pkg || typeof pkg !== 'object') continue;
    const pkgAny = pkg as any;

    if (!pkgAny.entities || typeof pkgAny.entities !== 'object') continue;

    if (Array.isArray(pkgAny.entities.functions)) {
      for (const func of pkgAny.entities.functions) {
        const f = func as any;
        const calls = Array.isArray(f.calls) ? f.calls : [];
        totalCalls += calls.length;

        result.functions.push({
          name: f.name || '',
          line: f.line || 0,
          isAsync: f.isAsync || false,
          isExported: f.isExported || false,
          params: Array.isArray(f.params) ? f.params : [],
          returnType: f.returnType || 'any',
          calls: calls,
          calledBy: Array.isArray(f.calledBy) ? f.calledBy : [],
          body: f.body || '',
          startLine: f.startLine || f.line || 0,
          endLine: f.endLine || f.line || 0,
          isMethod: f.isMethod || false,
          className: f.className || '',
          _modulePath: modulePath,
          id: f.id || `func_${simpleHash(modulePath)}_${f.name}`,
          vscode: f.vscode || `vscode://file/${modulePath}:${f.line}`,
          callsInfo: f.callsInfo || [],
          calledByInfo: f.calledByInfo || [],
          importedBy: f.importedBy || [],
        } as any);
        totalFunctions++;
      }
    }

    if (Array.isArray(pkgAny.entities.classes)) {
      for (const cls of pkgAny.entities.classes) {
        const c = cls as any;
        result.classes.push({
          name: c.name || '',
          line: c.line || 0,
          isExported: c.isExported || false,
          methods: Array.isArray(c.methods) ? c.methods : [],
          properties: Array.isArray(c.properties) ? c.properties : [],
          extends: c.extends || '',
          implements: Array.isArray(c.implements) ? c.implements : [],
          startLine: c.startLine || c.line || 0,
          endLine: c.endLine || c.line || 0,
          _modulePath: modulePath,
        } as any);
      }
    }

    if (Array.isArray(pkgAny.entities.constants)) {
      for (const constItem of pkgAny.entities.constants) {
        const c = constItem as any;
        result.constants.push({
          name: c.name || '',
          value: c.value,
          line: c.line || 0,
          isExported: c.isExported || false,
          type: c.type || '',
          _modulePath: modulePath,
        } as any);
      }
    }

    if (Array.isArray(pkgAny.entities.interfaces)) {
      for (const intf of pkgAny.entities.interfaces) {
        const i = intf as any;
        result.interfaces.push({
          name: i.name || '',
          properties: Array.isArray(i.properties) ? i.properties : [],
          line: i.line || 0,
          isExported: i.isExported || false,
          extends: Array.isArray(i.extends) ? i.extends : [],
          startLine: i.startLine || i.line || 0,
          endLine: i.endLine || i.line || 0,
          _modulePath: modulePath,
        } as any);
      }
    }

    if (Array.isArray(pkgAny.entities.types)) {
      for (const type of pkgAny.entities.types) {
        const t = type as any;
        result.types.push({
          name: t.name || '',
          definition: t.definition || 'unknown',
          line: t.line || 0,
          isExported: t.isExported || false,
          _modulePath: modulePath,
        } as any);
      }
    }

    if (Array.isArray(pkgAny.entities.variables)) {
      for (const varItem of pkgAny.entities.variables) {
        const v = varItem as any;
        result.variables.push({
          name: v.name || '',
          value: v.value,
          line: v.line || 0,
          isExported: v.isExported || false,
          type: v.type || '',
          _modulePath: modulePath,
        } as any);
      }
    }
  }

  console.log(`✅ Извлечено сущностей из packageLockReport:`);
  console.log(`   • Функций: ${totalFunctions}`);
  console.log(`   • Классов: ${result.classes.length}`);
  console.log(`   • Констант: ${result.constants.length}`);
  console.log(`   • Интерфейсов: ${result.interfaces.length}`);
  console.log(`   • Типов: ${result.types.length}`);
  console.log(`   • Переменных: ${result.variables.length}`);
  console.log(`   • Вызовов: ${totalCalls}`);

  return result;
}

// ==========================================
// ✅ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ГАРАНТИИ МАССИВОВ
// ==========================================

function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

/**
 * Безопасно преобразует extends в строку
 */
function safeExtends(value: string | string[] | undefined): string {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(', ');
  return value;
}

function safeFunctionEntity(item: any, modulePath: string): any {
  const f = item as any;
  return {
    name: f.name || '',
    line: f.line || 0,
    isAsync: f.isAsync || false,
    isExported: f.isExported || false,
    params: ensureArray(f.params),
    returnType: f.returnType || 'any',
    calls: ensureArray(f.calls),
    calledBy: ensureArray(f.calledBy),
    body: f.body || '',
    startLine: f.startLine || f.line || 0,
    endLine: f.endLine || f.line || 0,
    isMethod: f.isMethod || false,
    className: f.className || '',
    _modulePath: modulePath,
    id: f.id || `func_${simpleHash(modulePath)}_${f.name}`,
    vscode: f.vscode || `vscode://file/${modulePath}:${f.line}`,
    callsInfo: ensureArray(f.callsInfo),
    calledByInfo: ensureArray(f.calledByInfo),
    importedBy: ensureArray(f.importedBy),
  };
}

function safeClassEntity(item: any, modulePath: string): any {
  const c = item as any;
  return {
    name: c.name || '',
    line: c.line || 0,
    isExported: c.isExported || false,
    methods: ensureArray(c.methods),
    properties: ensureArray(c.properties),
    extends: c.extends || '',
    implements: ensureArray(c.implements),
    startLine: c.startLine || c.line || 0,
    endLine: c.endLine || c.line || 0,
    _modulePath: modulePath,
  };
}

function safeConstantEntity(item: any, modulePath: string): any {
  const c = item as any;
  return {
    name: c.name || '',
    value: c.value,
    line: c.line || 0,
    isExported: c.isExported || false,
    type: c.type || '',
    _modulePath: modulePath,
  };
}

function safeInterfaceEntity(item: any, modulePath: string): any {
  const i = item as any;
  return {
    name: i.name || '',
    properties: ensureArray(i.properties),
    line: i.line || 0,
    isExported: i.isExported || false,
    extends: safeExtends(i.extends),
    startLine: i.startLine || i.line || 0,
    endLine: i.endLine || i.line || 0,
    _modulePath: modulePath,
  };
}

function safeTypeEntity(item: any, modulePath: string): any {
  const t = item as any;
  return {
    name: t.name || '',
    definition: t.definition || 'unknown',
    line: t.line || 0,
    isExported: t.isExported || false,
    _modulePath: modulePath,
  };
}

function safeVariableEntity(item: any, modulePath: string): any {
  const v = item as any;
  return {
    name: v.name || '',
    value: v.value,
    line: v.line || 0,
    isExported: v.isExported || false,
    type: v.type || '',
    _modulePath: modulePath,
  };
}

// ==========================================
// CLI ARGUMENT PARSING
// ==========================================

interface ParsedArgs {
  mode: string;
  targetPath: string;
  extraArg?: string;
  depthArg?: string;
  outputDir?: string;
  tsconfigPath?: string;
  options?: SplitModuleOptions | MinifyFolderOptions | any;
  includeEntities?: boolean;
  includeVueAnalysis?: boolean;
  includeBody?: boolean;
  fromFunction?: string;
  toFunction?: string;
  optimized?: boolean;
  maxDepth?: number;
}

export function parseArgs(): ParsedArgs | null {
  const args = process.argv.slice(2);

  const normalizedArgs = args.map(arg => {
    if (arg.startsWith('-')) return arg;
    return normalizePathForOS(arg);
  });

  const mode = normalizedArgs[0];

  let outputDir: string | undefined;
  let tsconfigPath: string | undefined;
  let includeEntities = false;
  let includeVueAnalysis = false;
  let includeBody = false;
  let fromFunction: string | undefined;
  let toFunction: string | undefined;
  let optimized = false;
  let preset: string | undefined;
  let maxDepth = 5;
  const cleanArgs: string[] = [];

  for (let i = 0; i < normalizedArgs.length; i++) {
    const arg = normalizedArgs[i];
    if (arg === '-o' || arg === '--output') {
      if (arg && normalizedArgs[i + 1]) {
        outputDir = normalizedArgs[i + 1];
        i++;
      }
    } else if (arg === '--tsconfig') {
      if (normalizedArgs[i + 1]) {
        tsconfigPath = normalizedArgs[i + 1];
        i++;
      }
    } else if (arg === '--entities') {
      includeEntities = true;
    } else if (arg === '--vue-analysis' || arg === '--vue') {
      includeVueAnalysis = true;
    } else if (arg === '--include-body') {
      includeBody = true;
    } else if (arg === '--from') {
      if (normalizedArgs[i + 1]) {
        fromFunction = normalizedArgs[i + 1];
        i++;
      }
    } else if (arg === '--to') {
      if (normalizedArgs[i + 1]) {
        toFunction = normalizedArgs[i + 1];
        i++;
      }
    } else if (arg === '--optimized' || arg === '--opt') {
      optimized = true;
    } else if (arg === '--preset' || arg === '-p') {
      if (normalizedArgs[i + 1]) {
        preset = normalizedArgs[i + 1];
        i++;
      }
    } else if (arg === '--max-depth' || arg === '-d') {
      // ✅ ИСПРАВЛЕНО: проверка на undefined перед parseInt
      const nextIndex = i + 1;
      if (nextIndex < normalizedArgs.length && normalizedArgs[nextIndex] !== undefined) {
        const nextArg = normalizedArgs[nextIndex];
        // Проверяем, что это не флаг (не начинается с '-')
        if (!nextArg.startsWith('-')) {
          const parsed = parseInt(nextArg, 10);
          if (!isNaN(parsed) && parsed > 0) {
            maxDepth = parsed;
          }
          i++;
        }
      }
    } else if (arg) {
      cleanArgs.push(arg);
    }
  }

  const originalArgv = [...process.argv];
  const newArgv = [originalArgv[0] || 'node', originalArgv[1] || 'cli.js', ...cleanArgs];
  process.argv = newArgv;

  if (!mode || mode === '--help' || mode === '-h') {
    showHelp();
    process.argv = originalArgv;
    return null;
  }

  if (mode === 'hybrid-report' || mode === 'hybrid') {
    const targetPath = cleanArgs[1];
    const depth = cleanArgs[2] || '5';

    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для гибридного отчета');
      process.argv = originalArgv;
      return null;
    }

    process.argv = originalArgv;
    return {
      mode: 'hybrid-report',
      targetPath,
      extraArg: depth,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'compact-report' || mode === 'compact') {
    const targetPath = cleanArgs[1];

    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для генерации компактного отчета');
      console.error('   Использование: compact-report <file> [--preset <name>] [--max-depth <n>] [--output <file>]');
      process.argv = originalArgv;
      return null;
    }

    process.argv = originalArgv;
    return {
      mode: 'compact-report',
      targetPath,
      extraArg: preset || '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'semantic') {
    const targetPaths = cleanArgs.slice(1);
    if (targetPaths.length === 0) {
      console.error('❌ Укажите пути к файлам или директориям для семантического анализа');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--recursive':
        case '-r':
          options.recursive = true;
          break;
        case '--formal':
        case '-f':
          options.formalVerification = true;
          break;
        case '--max-depth':
        case '-d':
          if (nextArg) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--critical':
        case '-c':
          if (nextArg) {
            options.criticalFunctions = nextArg.split(',');
            i++;
          }
          break;
        case '--output':
        case '-o':
          if (nextArg) {
            options.outputDir = nextArg;
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'semantic',
      targetPath: targetPaths[0] || '',
      extraArg: targetPaths.slice(1).join(','),
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'verify') {
    const targetFile = cleanArgs[1];
    if (!targetFile) {
      console.error('❌ Укажите путь к файлу для верификации');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--function':
        case '-f':
          if (nextArg) {
            options.functionName = nextArg;
            i++;
          }
          break;
        case '--contract':
        case '-c':
          if (nextArg) {
            options.contractPath = nextArg;
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'verify',
      targetPath: targetFile,
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'refactor') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для рефакторинга');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--out-dir':
        case '-o':
          if (nextArg) {
            options.modulesDir = nextArg;
            i++;
          }
          break;
        case '--target-size':
        case '-t':
          if (nextArg) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-size':
        case '-m':
          if (nextArg) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--min-cohesion':
        case '-c':
          if (nextArg) {
            options.minCohesionScore = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        case '--no-backup':
          options.createBackup = false;
          break;
        case '--no-vue':
          options.updateTemplate = false;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--semantic':
        case '-s':
          options.semanticAnalysis = true;
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'refactor',
      targetPath,
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'analyze') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для анализа');
      process.argv = originalArgv;
      return null;
    }

    const options: any = { dryRun: true };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--target-size':
        case '-t':
          if (nextArg) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-size':
        case '-m':
          if (nextArg) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--min-cohesion':
        case '-c':
          if (nextArg) {
            options.minCohesionScore = parseInt(nextArg, 10);
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'analyze',
      targetPath,
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'vue-analyze' || mode === 'vue') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к Vue файлу');
      process.argv = originalArgv;
      return null;
    }

    if (!targetPath.endsWith('.vue')) {
      console.error('❌ Файл должен иметь расширение .vue');
      process.argv = originalArgv;
      return null;
    }

    const options = {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      switch (arg) {
        case '--no-template-ast':
          options.includeTemplateAST = false;
          break;
        case '--no-script-ast':
          options.includeScriptAST = false;
          break;
        case '--no-composables':
          options.extractComposableCalls = false;
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'vue-analyze',
      targetPath,
      options: options as any,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'split-module' || mode === 'split') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }

    const options: SplitModuleOptions = {
      outputFile: 'ai-split-module-prompt.md',
      includeFullCode: true,
      includeMinified: true,
      includeGraph: true,
      includeStats: true,
      includeSuggestions: true,
      targetClusterSize: 3,
      maxClusterSize: 10,
      maxDepth: 5,
      excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
      prefix: '',
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--output':
        case '-o':
          if (nextArg !== undefined) {
            options.outputFile = nextArg;
            i++;
          }
          break;
        case '--target-cluster-size':
        case '-t':
          if (nextArg !== undefined) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-cluster-size':
        case '-m':
          if (nextArg !== undefined) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-depth':
        case '-d':
          if (nextArg !== undefined) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--exclude':
        case '-x':
          if (nextArg !== undefined) {
            options.excludePatterns = nextArg.split(',').map(e => e.trim());
            i++;
          }
          break;
        case '--prefix':
        case '-p':
          if (nextArg !== undefined) {
            options.prefix = nextArg;
            i++;
          }
          break;
        case '--no-full-code':
          options.includeFullCode = false;
          break;
        case '--no-minified':
          options.includeMinified = false;
          break;
        case '--no-graph':
          options.includeGraph = false;
          break;
        case '--no-stats':
          options.includeStats = false;
          break;
        case '--no-suggestions':
          options.includeSuggestions = false;
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'split-module',
      targetPath,
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'minify-folder') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к каталогу');
      process.argv = originalArgv;
      return null;
    }

    const options: MinifyFolderOptions = {
      outputFile: 'ai-project-context.md',
      showStructure: true,
      addTableOfContents: true,
      sortByType: true,
      maxDepth: 10,
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.mjs', '.cjs'],
      excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--output':
        case '-o':
          if (nextArg !== undefined) {
            options.outputFile = nextArg;
            i++;
          }
          break;
        case '--depth':
        case '-d':
          if (nextArg !== undefined) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--extensions':
        case '-e':
          if (nextArg !== undefined) {
            options.extensions = nextArg.split(',').map(e => e.trim().toLowerCase());
            i++;
          }
          break;
        case '--exclude':
        case '-x':
          if (nextArg !== undefined) {
            options.excludePatterns = nextArg.split(',').map(e => e.trim());
            i++;
          }
          break;
        case '--no-structure':
          options.showStructure = false;
          break;
        case '--no-toc':
          options.addTableOfContents = false;
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'minify-folder',
      targetPath,
      options,
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'dead-code') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'dead-code',
      targetPath,
      extraArg: '',
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'impact') {
    const targetPath = cleanArgs[1];
    const entityName = cleanArgs[2];
    if (!targetPath || !entityName) {
      console.error('❌ Укажите файл и сущность: impact <файл> <entity>');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'impact',
      targetPath,
      extraArg: entityName,
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'prompt-pack') {
    const targetPath = cleanArgs[1];
    const depth = cleanArgs[2];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'prompt-pack',
      targetPath,
      extraArg: depth,
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'minify') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'minify',
      targetPath,
      extraArg: '',
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  if (mode === 'project') {
    const targetPath = cleanArgs[1];
    const maxDepthArg = cleanArgs[2];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'project',
      targetPath,
      extraArg: maxDepthArg,
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth: maxDepthArg ? parseInt(maxDepthArg, 10) : 5,
    };
  }

  if (mode === 'file') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'file',
      targetPath,
      extraArg: '',
      depthArg: '',
      outputDir,
      tsconfigPath,
      includeEntities,
      includeVueAnalysis,
      includeBody,
      fromFunction,
      toFunction,
      optimized,
      maxDepth,
    };
  }

  console.error(`❌ Неизвестный режим: ${mode}`);
  showHelp();
  process.argv = originalArgv;
  return null;
}

// ==========================================
// MAIN CLI ENTRY POINT
// ==========================================

export async function runCLI(): Promise<void> {
  const parsed = parseArgs();
  if (!parsed) return;

  const {
    mode,
    targetPath,
    extraArg,
    options,
    outputDir,
    tsconfigPath,
    includeEntities,
    includeVueAnalysis,
    includeBody,
    fromFunction,
    toFunction,
    optimized,
    maxDepth = 5,
  } = parsed;

  const originalCwd = process.cwd();

  let normalizedTargetPath = targetPath;
  if (isWindows) {
    normalizedTargetPath = normalizePathForOS(targetPath);
  }

  if (tsconfigPath) {
    const resolvedTsconfig = path.isAbsolute(tsconfigPath)
      ? tsconfigPath
      : path.resolve(originalCwd, tsconfigPath);

    const normalizedTsconfig = normalizePathForOS(resolvedTsconfig);

    if (fs.existsSync(normalizedTsconfig)) {
      setTsConfigPath(normalizedTsconfig);
      console.log(`📄 TsConfig: ${normalizedTsconfig}`);

      const tsConfig = loadTsConfig(path.dirname(normalizedTsconfig));
      if (tsConfig?.compilerOptions?.paths) {
        console.log('🔗 Найдены алиасы в tsconfig:');
        Object.entries(tsConfig.compilerOptions.paths).forEach(([alias, targets]) => {
          console.log(`   ${alias} → ${targets[0]}`);
        });
      }
    } else {
      console.warn(`⚠️ TsConfig не найден: ${normalizedTsconfig}`);
      console.warn(`   Искали: ${normalizedTsconfig}`);
    }
  }

  let outputDirChanged = false;
  let currentTargetPath = normalizedTargetPath;

  if (outputDir) {
    const absoluteOutputDir = path.resolve(originalCwd, outputDir);
    const normalizedOutputDir = normalizePathForOS(absoluteOutputDir);

    if (!fs.existsSync(normalizedOutputDir)) {
      fs.mkdirSync(normalizedOutputDir, { recursive: true });
      console.log(`📁 Создана выходная директория: ${normalizedOutputDir}`);
    }

    if (!path.isAbsolute(normalizedTargetPath)) {
      currentTargetPath = path.resolve(originalCwd, normalizedTargetPath);
      currentTargetPath = normalizePathForOS(currentTargetPath);
      console.log('📄 Преобразован относительный путь в абсолютный:');
      console.log(`   Было: ${normalizedTargetPath}`);
      console.log(`   Стало: ${currentTargetPath}`);
    }

    if (!fs.existsSync(currentTargetPath)) {
      console.error(`❌ Файл не найден: ${currentTargetPath}`);
      process.exit(1);
    }

    process.chdir(normalizedOutputDir);
    outputDirChanged = true;
    console.log(`📂 Выходная директория: ${process.cwd()}\n`);
  }

  try {
    if (mode === 'compact-report' || mode === 'compact') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('📋 КОМПАКТНЫЙ ОТЧЕТ СУЩНОСТЕЙ');
      console.log(`${'='.repeat(60)}\n`);
      console.log(`📄 Точка входа: ${currentTargetPath}`);
      console.log(`📏 Глубина анализа: ${maxDepth}`);

      // Устанавливаем пресет
      if (extraArg) {
        const presets = ['minimal', 'standard', 'full', 'relationshipsOnly'];
        if (presets.includes(extraArg)) {
          COMPACT_REPORT_CONFIG.activePreset = extraArg as any;
          console.log(`📋 Использую пресет: ${extraArg}`);
        } else {
          console.error(`❌ Неизвестный пресет: ${extraArg}`);
          console.error(`   Доступные: ${presets.join(', ')}`);
          process.exit(1);
        }
      }

      console.log(`📁 Выходная директория: ${process.cwd()}\n`);

      // Строим граф с сущностями и рекурсивным обходом
      console.log('🔍 Построение графа зависимостей с рекурсивным анализом...');
      const result = buildProjectGraph(currentTargetPath, maxDepth, true);

      if (!result.entities || Object.keys(result.entities).length === 0) {
        console.error('❌ Не найдено сущностей для анализа');
        process.exit(1);
      }

      const totalEntities = Object.values(result.entities).reduce(
        (sum, ents) => sum + (ents.functions?.length || 0),
        0
      );
      console.log(`📊 Найдено сущностей: ${totalEntities}`);

      // Генерируем компактный отчет с рекурсивным обходом
      const outputFile = outputDir ? 'entities.json' : 'entities.json';
      const outputPath = path.join(process.cwd(), outputFile);
      console.log(`\n📁 Сохранение в: ${outputPath}`);

      generateCompactEntityReport(
        result.entities,
        outputPath,
        {
          usePreset: true,
          maxDepth: maxDepth,
        }
      );

      return;
    }

    if (mode === 'hybrid-report' || mode === 'hybrid') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔀 ГИБРИДНЫЙ ОТЧЕТ: МОДУЛИ + ФУНКЦИИ');
      console.log(`${'='.repeat(60)}\n`);
      console.log(`📄 Точка входа: ${currentTargetPath}`);

      const depth = parseInt(extraArg || '5', 10);
      console.log(`📏 Глубина: ${depth}`);
      console.log(`📁 Выходная директория: ${process.cwd()}\n`);

      const report = await runHybridReport(currentTargetPath, depth, process.cwd());

      console.log('\n✅ ГИБРИДНЫЙ ОТЧЕТ СОЗДАН!');
      console.log('📄 Файлы отчета:');
      console.log(`   - hybrid-report.json (полные данные)`);
      console.log(`   - hybrid-report.md (Markdown отчет)`);
      console.log(`   - hybrid-report.dot (DOT граф)`);
      console.log(`   - hybrid-report.html (HTML визуализация)`);

      if (report && report.stats && report.stats.cycles > 0) {
        console.log(`\n⚠️ Обнаружено ${report.stats.cycles} циклических зависимостей!`);
      }

      return;
    }

    if (mode === 'semantic') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔬 СЕМАНТИЧЕСКИЙ АНАЛИЗ КОДА');
      console.log(`${'='.repeat(60)}\n`);

      let paths: string[] = [currentTargetPath];
      if (extraArg) {
        paths = paths.concat(extraArg.split(','));
      }

      const pipeline = new SemanticPipeline({
        wasmPath: path.resolve(__dirname, 'wasm'),
      });
      const result = await pipeline.run(paths, {
        formalVerification: options?.formalVerification || false,
        maxDepth: options?.maxDepth || 5,
        criticalFunctions: options?.criticalFunctions || [],
      });

      if (!result.success) {
        process.exit(1);
      }
      return;
    }

    if (mode === 'verify') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ');
      console.log(`${'='.repeat(60)}\n`);

      const z3 = new Z3Verifier();
      await z3.initialize();

      let contract: any = null;

      if (options?.contractPath && fs.existsSync(options.contractPath)) {
        const contractContent = fs.readFileSync(options.contractPath, 'utf-8');
        contract = JSON.parse(contractContent);
      } else {
        console.log(`🔍 Анализ функции: ${options?.functionName || 'не указана'}`);

        contract = {
          name: options?.functionName || 'testFunction',
          params: [createIntParam('x'), createIntParam('y')],
          returnType: 'int',
          preconditions: [range('x', 0, 100), range('y', 0, 100)],
          postconditions: [eq('result', { left: 'x', right: 'y', type: 'equality' } as any)],
          invariants: [],
        };
      }

      console.log('\n📋 Контракт для верификации:');
      console.log(`   Функция: ${contract.name}`);
      console.log(`   Параметры: ${contract.params.map((p: any) => `${p.name}:${p.type}`).join(', ')}`);
      console.log(`   Возврат: ${contract.returnType}`);
      console.log(`   Предусловий: ${contract.preconditions.length}`);
      console.log(`   Постусловий: ${contract.postconditions.length}`);

      const result = await z3.verifyFunction(contract);

      if (result.isValid) {
        console.log('\n✅ Функция ВЕРИФИЦИРОВАНА!');
        console.log(`   ${contract.name} удовлетворяет всем контрактам`);
      } else {
        console.log('\n❌ Функция НЕ ВЕРИФИЦИРОВАНА!');
        if (result.counterexample) {
          console.log('\n🔍 Контрпример:');
          for (const [key, value] of result.counterexample) {
            console.log(`   ${key} = ${value}`);
          }
        }
        if (result.error) {
          console.log(`\n⚠️ Ошибка: ${result.error}`);
        }
        process.exit(1);
      }

      await z3.dispose();
      return;
    }

    if (mode === 'refactor') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔧 АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ');
      console.log(`${'='.repeat(60)}\n`);

      const refactor = new AutoRefactor({
        modulesDir: options?.modulesDir || 'modules',
        targetClusterSize: options?.targetClusterSize || 3,
        maxClusterSize: options?.maxClusterSize || 10,
        minCohesionScore: options?.minCohesionScore || 60,
        updateTemplate: options?.updateTemplate !== false,
        dryRun: options?.dryRun || false,
        createBackup: options?.createBackup !== false,
        verbose: options?.verbose || false,
      });

      const result = await refactor.refactor(currentTargetPath);

      if (options?.semanticAnalysis && result.success && !options?.dryRun) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🔬 СЕМАНТИЧЕСКАЯ ПРОВЕРКА РЕЗУЛЬТАТА');
        console.log(`${'='.repeat(60)}\n`);

        const pipeline = new SemanticPipeline({
          wasmPath: path.resolve(__dirname, 'wasm'),
        });
        const semanticResult = await pipeline.run([currentTargetPath], {
          formalVerification: false,
          maxDepth: 3,
        });

        if (!semanticResult.success) {
          console.log('\n⚠️ ВНИМАНИЕ: Семантический анализ выявил проблемы!');
          console.log('   Проверьте отчет для деталей.');
        }
      }

      if (!result.success) {
        console.error(`❌ Рефакторинг не удался: ${result.error}`);
        process.exit(1);
      }

      console.log('\n✨ Рефакторинг успешно завершён!');
      if (result.modules && result.modules.length > 0) {
        console.log(`📦 Создано модулей: ${result.modules.length}`);
        for (let i = 0; i < result.modules.length; i++) {
          const module = result.modules[i];
          if (!module) continue;
          console.log(`   ${i + 1}. ${module.name} (${module.exports.length} экспортов)`);
        }
      }
      if (result.backupPath) {
        console.log(`💾 Бэкап: ${result.backupPath}`);
      }
      return;
    }

    if (mode === 'analyze') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔍 АНАЛИЗ ФАЙЛА (без изменений)');
      console.log(`${'='.repeat(60)}\n`);

      const refactor = new AutoRefactor({
        targetClusterSize: options?.targetClusterSize || 3,
        maxClusterSize: options?.maxClusterSize || 10,
        minCohesionScore: options?.minCohesionScore || 60,
        dryRun: true,
      });

      const result = await refactor.refactor(currentTargetPath);

      if (result.modules && result.modules.length > 0) {
        console.log(`\n📊 Найдено кластеров: ${result.modules.length}`);
        for (let i = 0; i < result.modules.length; i++) {
          const module = result.modules[i];
          if (!module) continue;
          console.log(`\n   ${i + 1}. Модуль "${module.name}":`);
          console.log(`      Экспорты: ${module.exports.join(', ')}`);
        }
      } else {
        console.log('\nℹ️ Не найдено кандидатов для выделения в модули');
      }
      return;
    }

    if (mode === 'vue-analyze' || mode === 'vue') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🎯 АНАЛИЗ VUE КОМПОНЕНТА');
      console.log(`${'='.repeat(60)}\n`);

      const analysis = analyzeVueComponent(currentTargetPath, options as any);
      if (!analysis) {
        console.error('❌ Не удалось проанализировать Vue компонент');
        process.exit(1);
      }

      const jsonOutput = {
        ...analysis,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync('vue-analysis.json', JSON.stringify(jsonOutput, null, 2));
      console.log('✅ JSON анализ сохранен: vue-analysis.json');

      const markdownReport = generateVueComponentReport(analysis);
      fs.writeFileSync('vue-analysis.md', markdownReport);
      console.log('✅ Markdown отчет сохранен: vue-analysis.md');

      console.log('\n📊 КРАТКАЯ ИНФОРМАЦИЯ:');
      console.log(`   🏷️  Компонент: ${analysis.componentName}`);
      console.log(`   📥 Props: ${analysis.props.names.length}`);
      console.log(`   📤 Events: ${analysis.emits.names.length}`);
      console.log(`   🎭 Slots: ${analysis.slots.length}`);
      console.log(`   🧩 Composables: ${analysis.composables.length}`);
      console.log(`   📝 Скрипт: ${analysis.stats.scriptLines} строк`);
      console.log(`   🎨 Шаблон: ${analysis.stats.templateLines} строк`);
      console.log(`   🎭 Стили: ${analysis.stats.styleCount} блоков`);
      console.log(`   💻 TypeScript: ${analysis.script.isTS ? '✅' : '❌'}`);
      console.log(`   📦 Setup: ${analysis.script.isSetup ? '✅' : '❌'}`);

      console.log('\n✨ Анализ Vue компонента завершен!');
      return;
    }

    if (mode === 'split-module' || mode === 'split') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔪 РАЗБИЕНИЕ ФАЙЛА НА МОДУЛИ');
      console.log(`${'='.repeat(60)}`);

      const result = buildSplitModulePrompt(currentTargetPath, options as SplitModuleOptions);
      if (result) {
        console.log('\n📋 Инструкция:');
        console.log(`   1. Откройте ${result.outputFiles.prompt}`);
        console.log('   2. Скопируйте содержимое');
        console.log('   3. Отправьте в ChatGPT/Claude/Gemini');
        console.log('   4. Получите готовую структуру модулей');
      }
      return;
    }

    if (mode === 'minify-folder') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('📁 РЕКУРСИВНАЯ МИНИФИКАЦИЯ ПРОЕКТА');
      console.log(`${'='.repeat(60)}`);

      minifyFolder(currentTargetPath, options as MinifyFolderOptions);
      return;
    }

    if (mode === 'dead-code') {
      console.log(`🔎 Анализ мертвого кода: ${currentTargetPath}`);
      const report = findDeadCode(currentTargetPath);
      if (report) {
        fs.writeFileSync('ai-dead-code-report.md', report);
        console.log(report);
        console.log('\n✅ Отчет сохранен: ai-dead-code-report.md');
      }
      return;
    }

    if (mode === 'impact') {
      if (!extraArg) {
        console.error('❌ Укажите имя сущности: node graph-analyzer.js impact <файл> <entity>');
        process.exit(1);
      }
      console.log(`💥 Анализ влияния: ${extraArg} в ${currentTargetPath}`);
      const report = runImpactAnalysis(currentTargetPath, extraArg);
      fs.writeFileSync('ai-impact-report.md', report);
      console.log(report);
      console.log('\n✅ Отчет сохранен: ai-impact-report.md');
      return;
    }

    if (mode === 'prompt-pack') {
      const depth = extraArg ? parseInt(extraArg, 10) : 2;
      console.log(`🎒 Сборка промпт-пака для ${currentTargetPath} (глубина ${depth})`);
      const pack = buildAiPromptPack(currentTargetPath, depth);
      fs.writeFileSync('ai-prompt-bundle.md', pack);
      console.log('\n✅ Пакет сохранен: ai-prompt-bundle.md');
      console.log(`📊 Размер: ${(pack.length / 1024).toFixed(2)} KB`);
      return;
    }

    if (mode === 'minify') {
      console.log(`✂️ Минификация: ${currentTargetPath}`);
      const minified = minifyForAI(currentTargetPath);
      if (minified) {
        fs.writeFileSync('ai-context.txt', minified);
        console.log('\n✅ Минифицированный код сохранен: ai-context.txt');
        const originalSize = fs.statSync(currentTargetPath).size;
        console.log(`📊 Исходный размер: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`📊 Сжатый размер: ${(minified.length / 1024).toFixed(2)} KB`);
        const ratio = ((minified.length / originalSize) * 100).toFixed(1);
        console.log(`📊 Экономия: ${(100 - parseFloat(ratio)).toFixed(1)}% токенов`);
      }
      return;
    }

    if (mode === 'project') {
      const maxDepthArg = extraArg ? parseInt(extraArg, 10) : Infinity;
      console.log(`📁 Построение графа проекта от ${currentTargetPath} (глубина ${maxDepthArg === Infinity ? '∞' : maxDepthArg})`);

      const resultData = buildProjectGraph(
        currentTargetPath,
        maxDepthArg,
        includeEntities,
        fromFunction,
        toFunction
      ) as GraphData & {
        packageLockReport?: any;
        callGraphResult?: any;
        entities?: Record<string, any>;
      };

      if (!resultData || Object.keys(resultData.graph).length === 0) {
        console.log('⚠️ Зависимости не найдены');
        return;
      }

      const normalizedData = normalizeGraphPaths(resultData);

      const cyclicEdges = findCyclicEdges(normalizedData.graph);
      const hasCycles = cyclicEdges.size > 0;
      normalizedData.hasCycles = hasCycles;
      normalizedData.cyclicEdges = Array.from(cyclicEdges);

      fs.writeFileSync('output.json', JSON.stringify(normalizedData, null, 2));
      console.log(`   ✅ output.json (${Object.keys(normalizedData.graph).length} узлов)`);

      const dotContent = convertToDOT(normalizedData, cyclicEdges);
      fs.writeFileSync('output.dot', dotContent);
      console.log('   ✅ output.dot');

      console.log('⚙️ Генерация SVG...');
      const graphviz = await Graphviz.load();
      const svgContent = graphviz.dot(dotContent);
      fs.writeFileSync('output.svg', svgContent);
      console.log('   ✅ output.svg');

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        JSON.stringify(normalizedData, null, 2),
        normalizePathForDisplay(currentTargetPath),
        hasCycles
      );
      fs.writeFileSync('report.html', htmlContent);
      console.log('   ✅ report.html');

      if (resultData.callGraphResult) {
        const callGraphPath = path.join(process.cwd(), 'call-graph-result.json');
        fs.writeFileSync(callGraphPath, JSON.stringify(resultData.callGraphResult, null, 2));
        console.log('   ✅ call-graph-result.json');

        if (resultData.callGraphResult.found) {
          console.log(`\n🔗 Путь от ${fromFunction || '?'} к ${toFunction || '?'}:`);
          console.log(`   ${resultData.callGraphResult.path.join(' → ')}`);
          console.log(`\n📊 Узлов в пути: ${resultData.callGraphResult.nodes.length}`);
          console.log(`📊 Ребер в пути: ${resultData.callGraphResult.edges.length}`);
        } else {
          console.log(`\n❌ Путь не найден: ${resultData.callGraphResult.reason}`);
        }
      }

      if (includeEntities && resultData.entities) {
        console.log('\n📊 Генерация расширенного отчета с сущностями...');

        const allFiles = Object.keys(normalizedData.graph);
        const reportsDir = path.join(process.cwd(), './');
        const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }

        const enhancedReportPath = path.join(reportsDir, 'package-lock-report.json');

        try {
          const absoluteFilePaths = allFiles.map(p => {
            const resolved = resolveAbsoluteFilePath(p, projectRoot);
            return resolved || path.resolve(projectRoot, p);
          });

          saveEnhancedPackageLockReport(
            resultData.rootKey,
            normalizedData.graph,
            resultData.entities,
            absoluteFilePaths,
            enhancedReportPath,
            { includeBody }
          );
          console.log(`\n✅ РАСШИРЕННЫЙ ОТЧЕТ СОХРАНЕН: ${enhancedReportPath}`);
          console.log(`📊 Включает: функции, константы, переменные, интерфейсы, типы, классы, вызовы`);

          const stats = resultData.packageLockReport?.entityStats || {};
          console.log(`\n📊 СТАТИСТИКА СУЩНОСТЕЙ:`);
          console.log(`   • Функций: ${stats.totalFunctions || 0}`);
          console.log(`   • Классов: ${stats.totalClasses || 0}`);
          console.log(`   • Констант: ${stats.totalConstants || 0}`);
          console.log(`   • Интерфейсов: ${stats.totalInterfaces || 0}`);
          console.log(`   • Типов: ${stats.totalTypes || 0}`);
          console.log(`   • Переменных: ${stats.totalVariables || 0}`);
          console.log(`   • Вызовов: ${stats.totalCalls || 0}`);

          try {
            const compressionLevel = parseInt(process.env.AST_COMPRESS_LEVEL || '1') as CompressionLevel;
            console.log(`\n📦 Генерация компактной "Вселенной" (уровень ${compressionLevel})...`);

            const compressed = compressReport(resultData.packageLockReport, {
              level: compressionLevel,
              includeBody: includeBody,
              includeSourceCode: includeBody,
              includeSecurity: true,
              includeVSCodeLinks: true,
            });

            const compressedPath = path.join(process.cwd(), `ast-universe-l${compressionLevel}.json`);
            fs.writeFileSync(compressedPath, JSON.stringify(compressed, null, 2));
            const compressedSize = (fs.statSync(compressedPath).size / 1024).toFixed(2);
            console.log(`✅ ast-universe-l${compressionLevel}.json сохранен (${compressedSize} KB)`);
            console.log(`   📊 Функций: ${compressed.stats.funcs}`);
            console.log(`   📁 Модулей: ${compressed.stats.mods}`);
            console.log(`   📞 Вызовов: ${compressed.stats.calls}`);

            let withCalls = 0;
            if (compressed.callContext) {
              const callContext = compressed.callContext;
              withCalls = Object.keys(callContext).filter((idx) => {
                const context = callContext[Number(idx)];
                return context && context.calls && context.calls.length > 0;
              }).length;
              console.log(`   🔗 Функций с вызовами: ${withCalls}`);
            }

            if (compressionLevel === 1) {
              const defaultPath = path.join(process.cwd(), 'ast-universe.json');
              fs.copyFileSync(compressedPath, defaultPath);
              console.log(`   📄 Также сохранен как ast-universe.json (копия)`);
            }
          } catch (compressError) {
            console.error('❌ Ошибка при сохранении сжатого отчета:', compressError);
          }

        } catch (error) {
          console.error(`❌ Ошибка при сохранении расширенного отчета:`, error);
        }

        console.log('\n📊 Сбор данных через единый источник...');

        try {
          const builder = new DataSourceBuilder(projectRoot);

          for (const [modulePath, entities] of Object.entries(resultData.entities || {})) {
            if (entities && typeof entities === 'object') {
              const entitiesResult: EntitiesResult = {
                functions: ensureArray((entities as any).functions || []),
                classes: ensureArray((entities as any).classes || []),
                constants: ensureArray((entities as any).constants || []),
                interfaces: ensureArray((entities as any).interfaces || []),
                types: ensureArray((entities as any).types || []),
                variables: ensureArray((entities as any).variables || []),
                imports: ensureArray((entities as any).imports || []),
                exports: ensureArray((entities as any).exports || []),
                callGraph: (entities as any).callGraph || {},
                moduleName: modulePath,
                filePath: modulePath,
              };
              builder.addEntities(modulePath, entitiesResult);
            }
          }

          builder.addGraph(resultData.rootKey, normalizedData.graph);
          builder.findCycles();
          builder.buildPackages();

          const dataSource = builder.build();
          const accessor = new DataSourceAccessor(dataSource);

          const stats = accessor.getStats();
          console.log(`\n📊 СТАТИСТИКА ИЗ ЕДИНОГО ИСТОЧНИКА:`);
          console.log(`   • Модулей: ${stats.graph.modules}`);
          console.log(`   • Функций: ${stats.entities.totalFunctions}`);
          console.log(`   • Классов: ${stats.entities.totalClasses}`);
          console.log(`   • Констант: ${stats.entities.totalConstants}`);
          console.log(`   • Интерфейсов: ${stats.entities.totalInterfaces}`);
          console.log(`   • Типов: ${stats.entities.totalTypes}`);
          console.log(`   • Переменных: ${stats.entities.totalVariables}`);
          console.log(`   • Вызовов: ${stats.entities.totalCalls}`);
          console.log(`   • Циклов: ${stats.graph.cycles}`);

        } catch (error) {
          console.error('❌ Ошибка при использовании единого источника данных:', error);
        }

        let entitiesWithCalls: EntitiesResult;

        if (resultData.entities && Object.keys(resultData.entities).length > 0) {
          console.log('📊 Использование сущностей из resultData.entities...');

          entitiesWithCalls = {
            functions: [],
            classes: [],
            constants: [],
            interfaces: [],
            types: [],
            variables: [],
            imports: [],
            exports: [],
            callGraph: {},
            moduleName: 'all',
            filePath: 'all',
          };

          for (const [modulePath, entities] of Object.entries(resultData.entities)) {
            if (!entities) continue;

            const safeFunctions = ensureArray(entities.functions);
            const safeClasses = ensureArray(entities.classes);
            const safeConstants = ensureArray(entities.constants);
            const safeInterfaces = ensureArray(entities.interfaces);
            const safeTypes = ensureArray(entities.types);
            const safeVariables = ensureArray(entities.variables);

            for (const func of safeFunctions) {
              entitiesWithCalls.functions.push(safeFunctionEntity(func, modulePath));
            }

            for (const cls of safeClasses) {
              entitiesWithCalls.classes.push(safeClassEntity(cls, modulePath));
            }

            for (const constItem of safeConstants) {
              entitiesWithCalls.constants.push(safeConstantEntity(constItem, modulePath));
            }

            for (const intf of safeInterfaces) {
              entitiesWithCalls.interfaces.push(safeInterfaceEntity(intf, modulePath));
            }

            for (const type of safeTypes) {
              entitiesWithCalls.types.push(safeTypeEntity(type, modulePath));
            }

            for (const varItem of safeVariables) {
              entitiesWithCalls.variables.push(safeVariableEntity(varItem, modulePath));
            }

            for (const [funcName, calls] of Object.entries(entities.callGraph || {})) {
              if (!entitiesWithCalls.callGraph[funcName]) {
                entitiesWithCalls.callGraph[funcName] = [];
              }
              if (Array.isArray(calls)) {
                entitiesWithCalls.callGraph[funcName].push(...calls);
              }
            }
          }

          console.log(`✅ Собрано сущностей из resultData.entities:`);
          console.log(`   • Функций: ${entitiesWithCalls.functions.length}`);
          console.log(`   • Классов: ${entitiesWithCalls.classes.length}`);
          console.log(`   • Констант: ${entitiesWithCalls.constants.length}`);
          console.log(`   • Интерфейсов: ${entitiesWithCalls.interfaces.length}`);
          console.log(`   • Типов: ${entitiesWithCalls.types.length}`);
          console.log(`   • Переменных: ${entitiesWithCalls.variables.length}`);
        } else if (resultData.packageLockReport) {
          console.log('📊 resultData.entities пуст, извлечение из packageLockReport...');
          entitiesWithCalls = extractEntitiesFromPackageLock(resultData.packageLockReport);
        } else {
          console.log('📊 Извлечение сущностей из файлов проекта...');
          entitiesWithCalls = {
            functions: [],
            classes: [],
            constants: [],
            interfaces: [],
            types: [],
            variables: [],
            imports: [],
            exports: [],
            callGraph: {},
            moduleName: 'all',
            filePath: 'all',
          };

          for (const filePath of Object.keys(normalizedData.graph)) {
            try {
              const absPath = path.resolve(filePath);
              if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
                const fileEntities = extractEntitiesFromFile(absPath);

                const safeFunctions = ensureArray(fileEntities.functions);
                const safeClasses = ensureArray(fileEntities.classes);
                const safeConstants = ensureArray(fileEntities.constants);
                const safeInterfaces = ensureArray(fileEntities.interfaces);
                const safeTypes = ensureArray(fileEntities.types);
                const safeVariables = ensureArray(fileEntities.variables);

                for (const func of safeFunctions) {
                  entitiesWithCalls.functions.push(safeFunctionEntity(func, filePath));
                }

                for (const cls of safeClasses) {
                  entitiesWithCalls.classes.push(safeClassEntity(cls, filePath));
                }

                for (const constItem of safeConstants) {
                  entitiesWithCalls.constants.push(safeConstantEntity(constItem, filePath));
                }

                for (const intf of safeInterfaces) {
                  entitiesWithCalls.interfaces.push(safeInterfaceEntity(intf, filePath));
                }

                for (const type of safeTypes) {
                  entitiesWithCalls.types.push(safeTypeEntity(type, filePath));
                }

                for (const varItem of safeVariables) {
                  entitiesWithCalls.variables.push(safeVariableEntity(varItem, filePath));
                }
              }
            } catch (error) {
              // Игнорируем ошибки
            }
          }

          console.log(`✅ Извлечено сущностей из файлов:`);
          console.log(`   • Функций: ${entitiesWithCalls.functions.length}`);
          console.log(`   • Классов: ${entitiesWithCalls.classes.length}`);
          console.log(`   • Констант: ${entitiesWithCalls.constants.length}`);
          console.log(`   • Интерфейсов: ${entitiesWithCalls.interfaces.length}`);
          console.log(`   • Типов: ${entitiesWithCalls.types.length}`);
          console.log(`   • Переменных: ${entitiesWithCalls.variables.length}`);
        }

        const fullAnalysis: FullAnalysis = {
          version: '3.0.0',
          root: currentTargetPath,
          timestamp: new Date().toISOString(),
          stats: {
            totalModules: Object.keys(normalizedData.graph).length,
            totalEntities:
              entitiesWithCalls.functions.length +
              entitiesWithCalls.classes.length +
              entitiesWithCalls.constants.length +
              entitiesWithCalls.interfaces.length +
              entitiesWithCalls.types.length +
              entitiesWithCalls.variables.length,
            hasCycles: hasCycles,
            cycles: normalizedData.cyclicEdges?.map((edge: string) => edge.split('->')) || [],
            totalFunctions: entitiesWithCalls.functions.length,
            totalClasses: entitiesWithCalls.classes.length,
            totalConstants: entitiesWithCalls.constants.length,
            totalInterfaces: entitiesWithCalls.interfaces.length,
            totalTypes: entitiesWithCalls.types.length,
            totalVariables: entitiesWithCalls.variables.length,
            maxDepth: maxDepthArg,
          },
          moduleGraph: {
            nodes: [],
            edges: [],
          },
          entityGraph: {
            nodes: [],
            edges: [],
          },
        };

        const allModules = new Set<string>();
        allModules.add(normalizedData.rootKey);

        for (const [key, deps] of Object.entries(normalizedData.graph)) {
          allModules.add(key);
          if (Array.isArray(deps)) {
            for (const dep of deps) {
              allModules.add(dep);
            }
          }
        }

        for (const modulePath of allModules) {
          let language = 'javascript';
          if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) language = 'typescript';
          else if (modulePath.endsWith('.vue')) language = 'vue';
          else if (modulePath.endsWith('.jsx')) language = 'jsx';

          let size = 0;
          let lines = 0;
          try {
            const absPath = path.resolve(modulePath);
            if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
              const content = fs.readFileSync(absPath, 'utf-8');
              size = content.length;
              lines = content.split('\n').length;
            }
          } catch {
            // Игнорируем ошибки
          }

          fullAnalysis.moduleGraph.nodes.push({
            id: modulePath,
            name: path.basename(modulePath),
            type: modulePath.endsWith('.vue') ? 'vue' : 'module',
            level: modulePath === normalizedData.rootKey ? 0 : 1,
            metadata: { size, lines, language, isEntry: modulePath === normalizedData.rootKey },
          });
        }

        for (const [from, deps] of Object.entries(normalizedData.graph)) {
          if (Array.isArray(deps)) {
            for (const to of deps) {
              const specifiers: string[] = [];
              for (const entity of entitiesWithCalls.functions) {
                if (entity.isExported && (to.includes(entity.name) || entity.name.includes(to))) {
                  specifiers.push(entity.name);
                }
              }
              fullAnalysis.moduleGraph.edges.push({
                from,
                to,
                type: 'import',
                specifiers: specifiers.length > 0 ? specifiers : [path.basename(to).replace(/\.[^.]+$/, '')],
              });
            }
          }
        }

        for (const func of entitiesWithCalls.functions) {
          const modulePath = findModuleForEntity(func.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${func.name}` : `#${func.name}`;

          const calls = Array.isArray(func.calls) ? func.calls : [];

          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: func.name,
            type: 'function',
            module: modulePath || 'unknown',
            line: func.line,
            metadata: {
              isAsync: func.isAsync,
              isExported: func.isExported,
              params: func.params,
              returnType: func.returnType,
              isMethod: func.isMethod,
              className: func.className,
              calls: calls,
              calledBy: func.calledBy || [],
              startLine: func.startLine,
              endLine: func.endLine,
            },
          });

          for (const call of calls) {
            let targetModule = findModuleForEntity(call, normalizedData);
            if (!targetModule) {
              for (const [modPath, deps] of Object.entries(normalizedData.graph)) {
                if (Array.isArray(deps) && (modPath.includes(call) || deps.some(d => d.includes(call)))) {
                  targetModule = modPath;
                  break;
                }
              }
            }
            const targetId = targetModule ? `${targetModule}#${call}` : `#${call}`;
            fullAnalysis.entityGraph.edges.push({
              from: nodeId,
              to: targetId,
              type: 'function_call',
              line: func.line,
            });
          }
        }

        for (const cls of entitiesWithCalls.classes) {
          const modulePath = findModuleForEntity(cls.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${cls.name}` : `#${cls.name}`;
          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: cls.name,
            type: 'class',
            module: modulePath || 'unknown',
            line: cls.line,
            metadata: {
              isExported: cls.isExported,
              methods: cls.methods,
              properties: cls.properties,
              extends: cls.extends || '',
              implements: cls.implements,
              startLine: cls.startLine,
              endLine: cls.endLine,
            },
          });
          if (cls.extends) {
            const targetModule = findModuleForEntity(cls.extends, normalizedData);
            const targetId = targetModule ? `${targetModule}#${cls.extends}` : `#${cls.extends}`;
            fullAnalysis.entityGraph.edges.push({
              from: nodeId,
              to: targetId,
              type: 'class_extends',
            });
          }
          for (const impl of cls.implements || []) {
            const targetModule = findModuleForEntity(impl, normalizedData);
            const targetId = targetModule ? `${targetModule}#${impl}` : `#${impl}`;
            fullAnalysis.entityGraph.edges.push({
              from: nodeId,
              to: targetId,
              type: 'class_implements',
            });
          }
        }

        for (const constant of entitiesWithCalls.constants) {
          const modulePath = findModuleForEntity(constant.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${constant.name}` : `#${constant.name}`;
          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: constant.name,
            type: 'constant',
            module: modulePath || 'unknown',
            line: constant.line,
            metadata: {
              value: constant.value,
              isExported: constant.isExported,
              type: constant.type,
            },
          });
        }

        for (const intf of entitiesWithCalls.interfaces) {
          const modulePath = findModuleForEntity(intf.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${intf.name}` : `#${intf.name}`;
          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: intf.name,
            type: 'interface',
            module: modulePath || 'unknown',
            line: intf.line,
            metadata: {
              isExported: intf.isExported,
              properties: intf.properties,
              extends: safeExtends(intf.extends),
              startLine: intf.startLine,
              endLine: intf.endLine,
            },
          });
          for (const ext of intf.extends || []) {
            const targetModule = findModuleForEntity(ext, normalizedData);
            const targetId = targetModule ? `${targetModule}#${ext}` : `#${ext}`;
            fullAnalysis.entityGraph.edges.push({
              from: nodeId,
              to: targetId,
              type: 'interface_extends',
            });
          }
        }

        for (const type of entitiesWithCalls.types) {
          const modulePath = findModuleForEntity(type.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${type.name}` : `#${type.name}`;
          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: type.name,
            type: 'type',
            module: modulePath || 'unknown',
            line: type.line,
            metadata: {
              isExported: type.isExported,
              definition: type.definition,
            },
          });
        }

        for (const variable of entitiesWithCalls.variables) {
          const modulePath = findModuleForEntity(variable.name, normalizedData);
          const nodeId = modulePath ? `${modulePath}#${variable.name}` : `#${variable.name}`;
          fullAnalysis.entityGraph.nodes.push({
            id: nodeId,
            name: variable.name,
            type: 'variable',
            module: modulePath || 'unknown',
            line: variable.line,
            metadata: {
              isExported: variable.isExported,
              type: variable.type,
              value: variable.value,
            },
          });
        }

        console.log('\n🌐 Генерация интерактивного HTML отчета...');
        const htmlPath = path.join(process.cwd(), 'interactive-report.html');

        await generateInteractiveHTML(fullAnalysis, htmlPath, entitiesWithCalls);

        console.log(`   ✅ interactive-report.html (интерактивный отчет)`);

        console.log('\n📊 СТАТИСТИКА СУЩНОСТЕЙ (ВСЕ ФАЙЛЫ):');
        console.log(`   • Функций: ${entitiesWithCalls.functions.length}`);
        console.log(`   • Классов: ${entitiesWithCalls.classes.length}`);
        console.log(`   • Констант: ${entitiesWithCalls.constants.length}`);
        console.log(`   • Интерфейсов: ${entitiesWithCalls.interfaces.length}`);
        console.log(`   • Типов: ${entitiesWithCalls.types.length}`);
        console.log(`   • Переменных: ${entitiesWithCalls.variables.length}`);
        console.log(`   • Вызовов между функциями: ${fullAnalysis.entityGraph.edges.length}`);

        console.log('\n🌐 Откройте interactive-report.html в браузере для интерактивного просмотра');
        console.log('📄 Откройте reports/entities-component-tree-deep/package-lock-report.json для детального анализа');

        if (optimized) {
          console.log('\n📊 Генерация оптимизированного отчета с встроенными связями...');

          try {
            const optimizedReportPath = path.join(process.cwd(), 'optimized-report.json');

            saveOptimizedPackageLockReport(
              resultData.rootKey,
              normalizedData.graph,
              resultData.entities || {},
              optimizedReportPath,
              {
                includeBody: includeBody,
                includeVscodeLinks: true,
                includeStats: true,
                includeMetadata: false,
              }
            );

            console.log(`✅ Оптимизированный отчет сохранен: ${optimizedReportPath}`);
            console.log(`   💡 Все связи встроены в сущности для быстрой навигации`);
            console.log(`   🔗 VSCode ссылки для всех связанных сущностей`);
          } catch (optError) {
            console.error('❌ Ошибка при генерации оптимизированного отчета:', optError);
          }
        }
      }

      if (includeVueAnalysis) {
        console.log('\n🎯 Включен детальный Vue-анализ');

        const vueFiles = Object.keys(normalizedData.graph).filter(f => f.endsWith('.vue'));

        if (vueFiles.length > 0) {
          console.log(`📊 Найдено Vue-файлов: ${vueFiles.length}`);

          for (const vueFile of vueFiles) {
            try {
              const absPath = path.resolve(vueFile);
              if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
                const vueAnalysis = analyzeVueComponent(absPath, {
                  includeTemplateAST: true,
                  includeScriptAST: true,
                  extractComposableCalls: true,
                });

                if (vueAnalysis) {
                  console.log(`  ✅ ${path.basename(vueFile)}:`);
                  console.log(`     📥 Props: ${vueAnalysis.props.names.length}`);
                  console.log(`     📤 Events: ${vueAnalysis.emits.names.length}`);
                  console.log(`     🎭 Slots: ${vueAnalysis.slots.length}`);
                  console.log(`     🧩 Composables: ${vueAnalysis.composables.length}`);

                  const vueReportPath = path.join(
                    process.cwd(),
                    `vue-analysis-${path.basename(vueFile, '.vue')}.json`
                  );
                  fs.writeFileSync(
                    vueReportPath,
                    JSON.stringify(vueAnalysis, null, 2)
                  );
                  console.log(`     📄 Отчет сохранен: ${path.basename(vueReportPath)}`);
                }
              }
            } catch (error) {
              console.warn(`  ⚠️ Ошибка анализа ${vueFile}:`, error instanceof Error ? error.message : String(error));
            }
          }
        } else {
          console.log('ℹ️ Vue-файлы не найдены в проекте');
        }
      }

      console.log('\n🎉 Готово! Откройте report.html в браузере');

      if (hasCycles) {
        console.log(`\n⚠️ Обнаружено ${cyclicEdges.size} циклических зависимостей:`);
        console.log('='.repeat(60));

        const cyclesByFile = new Map<string, Set<string>>();
        for (const edge of cyclicEdges) {
          const parts = edge.split('->');
          const from = parts[0];
          const to = parts[1];
          if (from && to) {
            if (!cyclesByFile.has(from)) cyclesByFile.set(from, new Set());
            cyclesByFile.get(from)!.add(to);
          }
        }

        for (const [from, toSet] of cyclesByFile) {
          const shortFrom = normalizePathForDisplay(from);
          console.log(`\n📄 ${shortFrom}`);
          for (const to of toSet) {
            const shortTo = normalizePathForDisplay(to);
            console.log(`   └─ 🔄 зависит от: ${shortTo}`);
          }
        }

        console.log('\n💡 Подробная визуализация (с подсветкой циклов красным) доступна в report.html');
      }

      return;
    }

    if (mode === 'file') {
      console.log(`📄 Построение внутреннего графа файла ${currentTargetPath}`);

      const resultData = buildFileInternalGraph(currentTargetPath) as GraphData;
      if (!resultData || Object.keys(resultData.graph).length === 0) {
        console.log('⚠️ Зависимости не найдены');
        return;
      }

      const normalizedData = normalizeGraphPaths(resultData);

      const cyclicEdges = findCyclicEdges(normalizedData.graph);
      const hasCycles = cyclicEdges.size > 0;
      normalizedData.hasCycles = hasCycles;
      normalizedData.cyclicEdges = Array.from(cyclicEdges);

      fs.writeFileSync('output.json', JSON.stringify(normalizedData, null, 2));
      console.log(`   ✅ output.json (${Object.keys(normalizedData.graph).length} узлов)`);

      const dotContent = convertToDOT(normalizedData, cyclicEdges);
      fs.writeFileSync('output.dot', dotContent);
      console.log('   ✅ output.dot');

      console.log('⚙️ Генерация SVG...');
      const graphviz = await Graphviz.load();
      const svgContent = graphviz.dot(dotContent);
      fs.writeFileSync('output.svg', svgContent);
      console.log('   ✅ output.svg');

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        JSON.stringify(normalizedData, null, 2),
        normalizePathForDisplay(currentTargetPath),
        hasCycles
      );
      fs.writeFileSync('report.html', htmlContent);
      console.log('   ✅ report.html');

      if (includeEntities) {
        console.log('\n📊 Генерация графов сущностей...');

        const ast = parseFile(currentTargetPath);
        if (ast) {
          const entities = extractEntities(ast, currentTargetPath);

          for (const func of entities.functions) {
            if (!Array.isArray(func.calls)) {
              func.calls = [];
            }
          }

          const moduleGraphPath = path.join(process.cwd(), 'module-graph.json');
          const entityGraphPath = path.join(process.cwd(), 'entity-graph.json');
          const fullAnalysisPath = path.join(process.cwd(), 'full-analysis.json');

          saveModuleGraph(normalizedData, entities, moduleGraphPath);
          console.log(`   ✅ module-graph.json (${entities.functions.length} функций, ${entities.classes.length} классов)`);

          saveEntityGraph(normalizedData, entities, entityGraphPath);
          console.log(`   ✅ entity-graph.json (${entities.interfaces.length} интерфейсов, ${entities.types.length} типов)`);

          saveFullAnalysis(normalizedData, entities, fullAnalysisPath, currentTargetPath);
          console.log(`   ✅ full-analysis.json (полный отчет)`);

          console.log('\n📊 Статистика сущностей:');
          console.log(`   • Функций: ${entities.functions.length}`);
          console.log(`   • Классов: ${entities.classes.length}`);
          console.log(`   • Констант: ${entities.constants.length}`);
          console.log(`   • Интерфейсов: ${entities.interfaces.length}`);
          console.log(`   • Типов: ${entities.types.length}`);
          console.log(`   • Переменных: ${entities.variables.length}`);
        } else {
          console.warn('⚠️ Не удалось извлечь сущности: AST не построен');
        }
      }

      console.log('\n🎉 Готово! Откройте report.html в браузере');

      if (hasCycles) {
        console.log(`\n⚠️ Обнаружено ${cyclicEdges.size} циклических зависимостей во внутреннем графе файла:`);
        console.log('='.repeat(60));

        const cyclesByEntity = new Map<string, Set<string>>();
        for (const edge of cyclicEdges) {
          const parts = edge.split('->');
          const from = parts[0];
          const to = parts[1];
          if (from && to) {
            if (!cyclesByEntity.has(from)) cyclesByEntity.set(from, new Set());
            cyclesByEntity.get(from)!.add(to);
          }
        }

        for (const [from, toSet] of cyclesByEntity) {
          console.log(`\n📄 ${from}`);
          for (const to of toSet) {
            console.log(`   └─ 🔄 вызывает: ${to} (цикл)`);
          }
        }

        console.log('\n💡 Подробная визуализация (с подсветкой циклов красным) доступна в report.html');
      }

      return;
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    if (outputDirChanged) {
      process.chdir(originalCwd);
      console.log(`\n📂 Возврат в исходную директорию: ${originalCwd}`);
    }
  }
}

function findModuleForEntity(entityName: string, data: GraphData): string | null {
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(entityName)) {
      return modulePath;
    }
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        if (dep.includes(entityName)) {
          return dep;
        }
      }
    }
  }
  return null;
}

if (isMainModule(import.meta.url)) {
  runCLI().catch(console.error);
}
