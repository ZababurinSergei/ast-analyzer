// src/core/entity-extractor.ts

import { walk } from 'estree-walker';
import path from 'path';
import { analyzeVueComponent } from '../modes/vue-analyzer.js';
import type { VueComponentAnalysis } from '../modes/vue-analyzer.js';
import {
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
} from './call-collector.js';

// ==========================================
// ИНТЕРФЕЙСЫ
// ==========================================

export interface FunctionInfo {
  name: string;
  line: number;
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  returnType?: string;
  calls: string[];
  calledBy: string[];
  body?: string;
  startLine: number;
  endLine: number;
  isMethod?: boolean;
  className?: string;
  isNested?: boolean;
  parentFunction?: string;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  depth: number;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
  // Дополнительные метаданные для Vue
  _meta?: {
    isVueComposable?: boolean;
    isVueMacro?: boolean;
    source?: string;
    callName?: string;
    isConst?: boolean;
  };
}

export interface ClassInfo {
  name: string;
  line: number;
  isExported: boolean;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

export interface ConstantInfo {
  name: string;
  line: number;
  value?: any;
  isExported: boolean;
  type?: string;
}

export interface InterfaceInfo {
  name: string;
  line: number;
  isExported: boolean;
  properties: string[];
  extends?: string[];
  startLine: number;
  endLine: number;
}

export interface TypeInfo {
  name: string;
  line: number;
  isExported: boolean;
  definition: string;
}

export interface VariableInfo {
  name: string;
  line: number;
  isExported: boolean;
  type?: string;
  value?: any;
}

export interface ImportInfo {
  source: string;
  specifiers: {
    local: string;
    imported: string;
    type: string;
  }[];
  loc: any;
  isTypeOnly?: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'constant' | 'value' | 'default';
  isDefault: boolean;
  loc: any;
  params?: string[];
  async?: boolean;
  startLine?: number;
  endLine?: number;
}

export interface EntitiesResult {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  constants: ConstantInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  callGraph: Record<string, string[]>;
  moduleName: string;
  filePath: string;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function isArraySafe(value: any): boolean {
  return value && Array.isArray(value);
}

function getNodeType(node: any): string {
  if (!node) return 'null';
  if (typeof node !== 'object') return typeof node;
  if (node.type) return node.type;
  if (node.constructor?.name) return node.constructor.name;
  return 'unknown';
}

function getNodeLocation(node: any): string {
  if (!node) return 'unknown';
  if (node.loc?.start) {
    return `line ${node.loc.start.line}, column ${node.loc.start.column}`;
  }
  if (node.start !== undefined) {
    return `position ${node.start}`;
  }
  return 'unknown location';
}

function isEventHandler(node: any): boolean {
  if (!node) return false;

  if (node.type === 'CallExpression' && node.callee) {
    const callee = node.callee;
    if (callee.type === 'Identifier') {
      const name = callee.name;
      if (
        ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(name)
      ) {
        return true;
      }
    }
    if (callee.type === 'MemberExpression' && callee.property) {
      const propName = callee.property.name || callee.property.value;
      if (
        ['addEventListener', 'on', 'once', 'emit', 'dispatchEvent', 'addListener'].includes(
          propName
        )
      ) {
        return true;
      }
    }
  }

  if (node.type === 'JSXAttribute' && node.name) {
    const attrName = node.name.name || node.name.value;
    if (typeof attrName === 'string' && attrName.startsWith('on')) {
      return true;
    }
  }

  return false;
}

function extractEventType(node: any): string | undefined {
  if (!node) return undefined;

  if (node.type === 'CallExpression' && node.callee) {
    if (node.arguments && node.arguments.length > 0) {
      const firstArg = node.arguments[0];
      if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
        return firstArg.value;
      }
      if (firstArg && firstArg.type === 'Identifier') {
        return firstArg.name;
      }
    }
  }

  if (node.type === 'JSXAttribute' && node.name) {
    const attrName = node.name.name || node.name.value;
    if (typeof attrName === 'string' && attrName.startsWith('on')) {
      return attrName.slice(2).toLowerCase();
    }
  }

  return undefined;
}

function calculateComplexity(node: any): number {
  let complexity = 1;

  function traverse(n: any) {
    if (!n) return;

    if (
      n.type === 'IfStatement' ||
      n.type === 'ConditionalExpression' ||
      n.type === 'SwitchStatement'
    ) {
      complexity++;
    }

    if (
      n.type === 'ForStatement' ||
      n.type === 'ForInStatement' ||
      n.type === 'ForOfStatement' ||
      n.type === 'WhileStatement' ||
      n.type === 'DoWhileStatement'
    ) {
      complexity++;
    }

    if (n.type === 'LogicalExpression' && (n.operator === '&&' || n.operator === '||')) {
      complexity++;
    }

    if (n.type === 'CatchClause') {
      complexity++;
    }

    for (const key of Object.keys(n)) {
      const child = n[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          for (const item of child) {
            traverse(item);
          }
        } else {
          traverse(child);
        }
      }
    }
  }

  traverse(node);
  return complexity;
}

function analyzeSecurity(body: string): FunctionInfo['security'] {
  const security = {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };

  if (!body) return security;

  const bodyLower = body.toLowerCase();

  security.hasEval = body.includes('eval(') || body.includes('eval (');
  security.hasProcessEnv = body.includes('process.env');
  security.hasExec =
    body.includes('exec(') || body.includes('exec (') || body.includes('execSync(');
  security.hasPassword = /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyLower);

  const sensitivePatterns = [
    /['"][a-zA-Z0-9_\-]{32,}['"]/,
    /'"]sk-[a-zA-Z0-9]{20,}['"]/,
    /'"]gh[pous]_[a-zA-Z0-9]{36,}['"]/,
    /'"]xox[baprs]-[a-zA-Z0-9-]+['"]/,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(body)) {
      security.hasSensitiveData = true;
      break;
    }
  }

  return security;
}

function isNodeExported(node: any, parent: any): boolean {
  if (!node) return false;

  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
    return true;
  }

  if (parent) {
    if (parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') {
      return true;
    }
    if (parent.type === 'VariableDeclaration' && isNodeExported(parent, parent.parent)) {
      return true;
    }
  }

  if (node.leadingComments) {
    for (const comment of node.leadingComments) {
      if (comment.value && comment.value.includes('@export')) {
        return true;
      }
    }
  }

  if (node.decorators) {
    for (const decorator of node.decorators) {
      if (
        decorator.expression?.name === 'export' ||
        decorator.expression?.callee?.name === 'export'
      ) {
        return true;
      }
    }
  }

  return false;
}

function extractBodyText(body: any): string | undefined {
  if (!body) return undefined;

  if (body.type === 'BlockStatement') {
    const statements = body.body || [];
    if (statements.length === 0) return '{}';

    const firstStatement = statements[0];
    if (firstStatement && firstStatement.type === 'ReturnStatement') {
      if (firstStatement.argument) {
        const argType = firstStatement.argument.type;
        if (argType === 'Identifier') return `return ${firstStatement.argument.name}`;
        if (argType === 'Literal') return `return ${firstStatement.argument.value}`;
        return 'return ...';
      }
      return 'return';
    }

    return `{ ${statements.length} statements }`;
  }

  if (body.type === 'Identifier') {
    return body.name;
  }

  if (body.type === 'Literal') {
    return String(body.value);
  }

  if (body.type === 'BinaryExpression') {
    return `${extractBodyText(body.left)} ${body.operator} ${extractBodyText(body.right)}`;
  }

  return body.type || undefined;
}

function extractValue(node: any): any {
  if (!node) return undefined;

  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'UnaryExpression') {
    return `${node.operator}${extractValue(node.argument)}`;
  }

  if (node.type === 'BinaryExpression') {
    return `${extractValue(node.left)} ${node.operator} ${extractValue(node.right)}`;
  }

  if (node.type === 'ArrayExpression') {
    if (isArraySafe(node.elements)) {
      return node.elements.map((e: any) => extractValue(e)).filter((v: any) => v !== undefined);
    }
    return [];
  }

  if (node.type === 'ObjectExpression') {
    const obj: Record<string, any> = {};
    if (isArraySafe(node.properties)) {
      for (const prop of node.properties) {
        if (prop.type === 'Property' && prop.key) {
          const key = prop.key.name || prop.key.value;
          if (key !== undefined) {
            obj[key] = extractValue(prop.value);
          }
        }
      }
    }
    return obj;
  }

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return '[Function]';
  }

  if (node.type === 'TemplateLiteral') {
    if (isArraySafe(node.quasis)) {
      return node.quasis.map((q: any) => q.value?.raw || '').join('');
    }
    return '';
  }

  if (node.type === 'NewExpression') {
    return `new ${node.callee?.name || '...'}()`;
  }

  return undefined;
}

// ==========================================
// ФУНКЦИЯ ДЛЯ СОЗДАНИЯ ПУСТОГО РЕЗУЛЬТАТА
// ==========================================

function createEmptyEntitiesResult(filePath?: string): EntitiesResult {
  return {
    functions: [],
    classes: [],
    constants: [],
    interfaces: [],
    types: [],
    variables: [],
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: filePath ? path.basename(filePath) : 'unknown',
    filePath: filePath || 'unknown',
  };
}

// ==========================================
// КОНВЕРТЕР: VueAnalysis → EntitiesResult
// ==========================================

function convertVueAnalysisToEntities(
  vueAnalysis: VueComponentAnalysis,
  filePath: string
): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);
  const componentName = vueAnalysis.componentName || path.basename(filePath, '.vue');

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
      .map(n => `${n}: (...args: any[]) => void`)
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
      _meta: {
        isVueComposable: true,
        source: comp.source,
      },
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
  // 5. IMPORTS
  // ==========================================
  for (const imp of vueAnalysis.imports) {
    result.imports.push({
      source: imp.source,
      specifiers: imp.specifiers.map(s => ({
        local: s,
        imported: s,
        type: 'ImportSpecifier',
      })),
      loc: null,
    });
  }

  // ==========================================
  // 6. CONSTANTS ИЗ СКРИПТА
  // ==========================================
  const scriptContent = vueAnalysis.script.content || '';
  if (scriptContent) {
    const constRegex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = constRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      const value = match[2]?.trim() || '';
      if (name && !result.constants.find(c => c.name === name)) {
        result.constants.push({
          name: name,
          line: 0,
          value: value,
          isExported: scriptContent.includes(`export const ${name}`),
          type: 'unknown',
        });
      }
    }

    const macroRegex = /(?:const\s+)?(defineProps|defineEmits|defineExpose|withDefaults)\s*<[^>]*>\s*\(/g;
    while ((match = macroRegex.exec(scriptContent)) !== null) {
      const name = match[1];
      if (name && !result.constants.find(c => c.name === name)) {
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
  // 7. АНАЛИЗ ВЫЗОВОВ МЕЖДУ COMPOSABLES
  // ==========================================
  const allComposableNames = vueAnalysis.composables.map(c => c.name);
  if (allComposableNames.length > 1 && scriptContent) {
    const pattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
    let callMatch;
    while ((callMatch = pattern.exec(scriptContent)) !== null) {
      const caller = callMatch[1];
      if (caller) {
        const calls: string[] = [];
        const innerPattern = new RegExp(`\\b(${allComposableNames.join('|')})\\s*\\(`, 'g');
        let innerMatch;
        while ((innerMatch = innerPattern.exec(scriptContent.substring(callMatch.index))) !== null) {
          const called = innerMatch[1];
          if (called && called !== caller && !calls.includes(called)) {
            calls.push(called);
          }
        }
        if (calls.length > 0) {
          result.callGraph[caller] = calls;
          const func = result.functions.find(f => f.name === caller);
          if (func) {
            func.calls = calls;
          }
        }
      }
    }
  }

  console.log(`   🎯 Vue-анализ: ${result.functions.length} функций, ${result.constants.length} констант`);
  return result;
}

// ==========================================
// ОСНОВНАЯ ФУНКЦИЯ EXTRACT ENTITIES
// ==========================================

export function extractEntities(ast: any, filePath?: string): EntitiesResult {
  // ==========================================
  // ПРОВЕРКА НА ПУСТОЙ AST
  // ==========================================
  if (!ast || !ast.body) {
    return createEmptyEntitiesResult(filePath);
  }

  if (!isArraySafe(ast.body)) {
    const nodeType = getNodeType(ast.body);
    const location = getNodeLocation(ast.body);
    console.warn(
      `⚠️ AST.body не является массивом для ${filePath || 'unknown'}, тип: ${nodeType}, ${location}, пропускаем`
    );
    return createEmptyEntitiesResult(filePath);
  }

  // ==========================================
  // ЕСЛИ ЭТО VUE-ФАЙЛ — ИСПОЛЬЗУЕМ СПЕЦИАЛЬНЫЙ АНАЛИЗАТОР
  // ==========================================
  if (filePath?.endsWith('.vue')) {
    try {
      const vueAnalysis = analyzeVueComponent(filePath);
      if (vueAnalysis) {
        console.log(`🎯 Используем Vue-анализатор для ${path.basename(filePath)}`);
        return convertVueAnalysisToEntities(vueAnalysis, filePath);
      }
    } catch (error) {
      console.warn(`⚠️ Vue-анализ не удался для ${filePath}, используем стандартный AST`);
    }
  }

  // ==========================================
  // СТАНДАРТНЫЙ АНАЛИЗ ЧЕРЕЗ AST
  // ==========================================
  return extractEntitiesFromAST(ast, filePath);
}

// ==========================================
// СТАНДАРТНЫЙ АНАЛИЗ ЧЕРЕЗ AST
// ==========================================

function extractEntitiesFromAST(ast: any, filePath?: string): EntitiesResult {
  const result = createEmptyEntitiesResult(filePath);

  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  const constants: ConstantInfo[] = [];
  const interfaces: InterfaceInfo[] = [];
  const types: TypeInfo[] = [];
  const variables: VariableInfo[] = [];
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const callGraph: Record<string, string[]> = {};

  let currentFunction: string | null = null;
  let currentClass: string | null = null;
  const functionStack: string[] = [];

  // ==========================================
  // ОБХОД AST
  // ==========================================

  function traverseNode(node: any, parent: any, depth: number, parentFunction?: string) {
    // ==========================================
    // ЗАЩИТА ОТ UNDEFINED
    // ==========================================
    if (!node || typeof node !== 'object') {
      return;
    }
    if (!node.type) {
      return;
    }

    // ==========================================
    // 1. IMPORT DECLARATION
    // ==========================================
    if (node.type === 'ImportDeclaration' && node.source) {
      const source = node.source.value;
      const isTypeOnly = node.importKind === 'type';
      const specifiers: { local: string; imported: string; type: string }[] = [];

      if (isArraySafe(node.specifiers)) {
        for (const spec of node.specifiers) {
          if (!spec) continue;
          if (spec.type === 'ImportSpecifier') {
            const importedName = spec.imported?.name || 'unknown';
            const localName = spec.local?.name || 'unknown';
            specifiers.push({
              local: localName,
              imported: importedName,
              type: 'ImportSpecifier',
            });
          } else if (spec.type === 'ImportDefaultSpecifier') {
            const localName = spec.local?.name || 'unknown';
            specifiers.push({
              local: localName,
              imported: 'default',
              type: 'ImportDefaultSpecifier',
            });
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            const localName = spec.local?.name || 'unknown';
            specifiers.push({
              local: localName,
              imported: '*',
              type: 'ImportNamespaceSpecifier',
            });
          }
        }
      }

      imports.push({
        source: source || 'unknown',
        specifiers,
        loc: node.loc,
        isTypeOnly,
      });
    }

    // ==========================================
    // 2. EXPORT NAMED DECLARATION
    // ==========================================
    if (node.type === 'ExportNamedDeclaration') {
      let exportName = '';
      let exportType: ExportInfo['type'] = 'default';

      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exportName = decl.id.name;
          exportType = 'function';
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exportName = decl.id.name;
          exportType = 'class';
        } else if (decl.type === 'VariableDeclaration') {
          if (isArraySafe(node.declarations)) {
            for (const d of node.declarations) {
              if (d.id?.name) {
                exportName = d.id.name;
                exportType = 'constant';
              }
            }
          }
        }
      } else if (isArraySafe(node.specifiers)) {
        for (const spec of node.specifiers) {
          if (spec.exported) {
            exportName = spec.exported.name;
            exportType = 'value';
          }
        }
      }

      if (exportName) {
        exports.push({
          name: exportName,
          type: exportType,
          isDefault: false,
          loc: node.loc,
        });
      }
    }

    // ==========================================
    // 3. EXPORT DEFAULT DECLARATION
    // ==========================================
    if (node.type === 'ExportDefaultDeclaration') {
      let exportName = 'default';
      let exportType: ExportInfo['type'] = 'default';

      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exportName = decl.id.name || 'default';
          exportType = 'function';
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exportName = decl.id.name || 'default';
          exportType = 'class';
        } else if (decl.type === 'Identifier') {
          exportName = decl.name || 'default';
          exportType = 'value';
        }
      }

      exports.push({
        name: exportName,
        type: exportType,
        isDefault: true,
        loc: node.loc,
      });
    }

    // ==========================================
    // 4. FUNCTION DECLARATION / EXPRESSION
    // ==========================================
    if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);
      const isMethod = parent?.type === 'MethodDefinition' || parent?.type === 'ClassMethod';
      const isArrow = false;
      const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
      const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

      let fullName = name;
      const parentFunctions: string[] = [];
      let current = parent;
      let depthCount = 0;

      while (current && current.type !== 'Program' && depthCount < 50) {
        if (
          (current.type === 'FunctionDeclaration' || current.type === 'FunctionExpression') &&
          current.id
        ) {
          parentFunctions.unshift(current.id.name);
          depthCount++;
        }
        if (current.type === 'MethodDefinition' && current.key) {
          const methodName = current.key.name || current.key.value;
          if (methodName) {
            let classParent = current.parent;
            while (classParent && classParent.type !== 'Program') {
              if (classParent.type === 'ClassDeclaration' && classParent.id) {
                parentFunctions.unshift(classParent.id.name);
                break;
              }
              classParent = classParent.parent;
            }
            parentFunctions.push(methodName);
          }
        }
        current = current.parent;
      }

      if (parentFunctions.length > 0) {
        fullName = parentFunctions.join('.') + '.' + name;
      }

      let className: string | undefined = undefined;
      if (isMethod) {
        let classParent = parent;
        while (classParent && classParent.type !== 'Program') {
          if (classParent.type === 'ClassDeclaration' && classParent.id) {
            className = classParent.id.name;
            break;
          }
          classParent = classParent.parent;
        }
        if (className) {
          fullName = className + '.' + name;
        }
      }

      const params = isArraySafe(node.params)
        ? node.params.map((p: any) => {
          if (p.type === 'Identifier') return p.name || 'unknown';
          if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
          if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
          return 'unknown';
        })
        : [];

      const isNested = parentFunctions.length > 0 || depth > 0;
      const parentFunc = parentFunctions.length > 0 ? parentFunctions.join('.') : undefined;

      const bodyText = node.body ? extractBodyText(node.body) : undefined;
      const funcInfo: FunctionInfo = {
        name: fullName,
        line: node.loc?.start?.line || 1,
        isAsync: node.async || false,
        isExported,
        params,
        returnType: node.returnType?.typeName?.name || node.returnType?.name || undefined,
        calls: [],
        calledBy: [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
        body: bodyText,
        isMethod,
        className,
        isNested,
        parentFunction: parentFunc,
        isArrow,
        isEventHandler: isEventHandlerNode,
        eventType,
        depth: depth,
        complexity: calculateComplexity(node),
        security: analyzeSecurity(bodyText || ''),
      };

      functions.push(funcInfo);

      if (!callGraph[fullName]) {
        callGraph[fullName] = [];
      }

      const previousFunction = currentFunction;
      currentFunction = fullName;
      functionStack.push(fullName);

      if (node.body) {
        if (node.body.type === 'BlockStatement' && isArraySafe(node.body.body)) {
          for (const child of node.body.body) {
            traverseNode(child, node, depth + 1, fullName);
          }
        } else {
          traverseNode(node.body, node, depth + 1, fullName);
        }
      }

      functionStack.pop();
      currentFunction = previousFunction;
    }

    // ==========================================
    // 5. ARROW FUNCTION EXPRESSION
    // ==========================================
    if (node.type === 'ArrowFunctionExpression') {
      let name = 'anonymous_arrow';
      let isExported = false;
      let parentFunc: string | undefined = undefined;
      const isEventHandlerNode = isEventHandler(node) || isEventHandler(parent);
      const eventType = isEventHandlerNode ? extractEventType(parent || node) : undefined;

      let current = parent;
      const parentFuncs: string[] = [];
      let depthCount = 0;

      while (current && current.type !== 'Program' && depthCount < 50) {
        if (
          (current.type === 'FunctionDeclaration' || current.type === 'FunctionExpression') &&
          current.id
        ) {
          parentFuncs.unshift(current.id.name);
          depthCount++;
        }
        if (current.type === 'MethodDefinition' && current.key) {
          const methodName = current.key.name || current.key.value;
          if (methodName) {
            let classParent = current.parent;
            while (classParent && classParent.type !== 'Program') {
              if (classParent.type === 'ClassDeclaration' && classParent.id) {
                parentFuncs.unshift(classParent.id.name);
                break;
              }
              classParent = classParent.parent;
            }
            parentFuncs.push(methodName);
          }
        }
        current = current.parent;
      }

      if (parent && parent.type === 'VariableDeclarator' && parent.id) {
        const varName = parent.id.name;
        if (varName) {
          name = varName;
          let exportParent = parent.parent;
          while (exportParent && exportParent.type !== 'Program') {
            if (
              exportParent.type === 'ExportNamedDeclaration' ||
              exportParent.type === 'ExportDefaultDeclaration'
            ) {
              isExported = true;
              break;
            }
            exportParent = exportParent.parent;
          }
        }
      }

      if (parent && parent.type === 'Property' && parent.key) {
        const propName = parent.key.name || parent.key.value;
        if (propName) {
          if (parentFuncs.length > 0) {
            name = parentFuncs.join('.') + '.' + propName;
          } else {
            name = propName;
          }
        }
      }

      if (parentFuncs.length > 0 && !parent?.type?.includes('Property')) {
        name = parentFuncs.join('.') + '.' + name;
      }

      if (isEventHandlerNode && parent?.type === 'JSXAttribute') {
        const attrName = parent.name?.name || parent.name?.value;
        if (attrName && typeof attrName === 'string') {
          name = `on${attrName.slice(2)}Handler`;
        }
      }

      const params = isArraySafe(node.params)
        ? node.params.map((p: any) => {
          if (p.type === 'Identifier') return p.name || 'unknown';
          if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
          if (p.type === 'RestElement' && p.argument) return `...${p.argument.name || 'unknown'}`;
          return 'unknown';
        })
        : [];

      const isNested = parentFuncs.length > 0 || depth > 0;
      parentFunc = parentFuncs.length > 0 ? parentFuncs.join('.') : undefined;

      const bodyText = node.body ? extractBodyText(node.body) : undefined;
      const funcInfo: FunctionInfo = {
        name,
        line: node.loc?.start?.line || 1,
        isAsync: node.async || false,
        isExported,
        params,
        returnType: node.returnType?.typeName?.name || undefined,
        calls: [],
        calledBy: [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
        body: bodyText,
        isMethod: false,
        className: undefined,
        isNested,
        parentFunction: parentFunc,
        isArrow: true,
        isEventHandler: isEventHandlerNode,
        eventType,
        depth: depth,
        complexity: calculateComplexity(node),
        security: analyzeSecurity(bodyText || ''),
      };

      functions.push(funcInfo);

      if (!callGraph[name]) {
        callGraph[name] = [];
      }

      if (node.body) {
        if (node.body.type === 'BlockStatement' && isArraySafe(node.body.body)) {
          for (const child of node.body.body) {
            traverseNode(child, node, depth + 1, name);
          }
        } else {
          traverseNode(node.body, node, depth + 1, name);
        }
      }
    }

    // ==========================================
    // 6. METHOD DEFINITION
    // ==========================================
    if (node.type === 'MethodDefinition' && node.key) {
      const methodName = node.key.name || node.key.value;
      const className = currentClass || parent?.id?.name || 'Anonymous';

      if (methodName) {
        const isExported = isNodeExported(node, parent);
        const fullName = `${className}.${methodName}`;

        const params = isArraySafe(node.value?.params)
          ? node.value.params.map((p: any) => {
            if (p.type === 'Identifier') return p.name || 'unknown';
            if (p.type === 'AssignmentPattern' && p.left) return p.left.name || 'unknown';
            return 'unknown';
          })
          : [];

        const parentFunc = className;
        const bodyText = node.value?.body ? extractBodyText(node.value.body) : undefined;

        const funcInfo: FunctionInfo = {
          name: fullName,
          line: node.loc?.start?.line || 1,
          isAsync: node.value?.async || false,
          isExported,
          params,
          returnType: node.value?.returnType?.typeName?.name || undefined,
          calls: [],
          calledBy: [],
          startLine: node.loc?.start?.line || 1,
          endLine: node.loc?.end?.line || 1,
          isMethod: true,
          className,
          isNested: false,
          parentFunction: parentFunc,
          isArrow: false,
          isEventHandler: false,
          depth: depth,
          complexity: node.value?.body ? calculateComplexity(node.value.body) : 1,
          security: analyzeSecurity(bodyText || ''),
        };

        functions.push(funcInfo);

        if (!callGraph[fullName]) {
          callGraph[fullName] = [];
        }

        if (node.value && node.value.body) {
          if (node.value.body.type === 'BlockStatement' && isArraySafe(node.value.body.body)) {
            for (const child of node.value.body.body) {
              traverseNode(child, node, depth + 1, fullName);
            }
          }
        }
      }
    }

    // ==========================================
    // 7. CLASS DECLARATION
    // ==========================================
    if (node.type === 'ClassDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      const methods: string[] = [];
      const properties: string[] = [];

      if (isArraySafe(node.body?.body)) {
        for (const member of node.body.body) {
          if (!member) continue;
          if (member.type === 'MethodDefinition' && member.key) {
            methods.push(member.key.name);
          }
          if (member.type === 'PropertyDefinition' && member.key) {
            properties.push(member.key.name);
          }
        }
      }

      const classInfo: ClassInfo = {
        name: name || 'anonymous',
        line: node.loc?.start?.line || 1,
        isExported,
        methods,
        properties,
        extends: node.superClass?.name || undefined,
        implements: node.implements?.map((i: any) => i.expression?.name || i.name) || [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
      };

      classes.push(classInfo);

      const previousClass = currentClass;
      currentClass = name;

      if (node.body && isArraySafe(node.body.body)) {
        for (const member of node.body.body) {
          traverseNode(member, node, depth + 1, name);
        }
      }

      currentClass = previousClass;
    }

    // ==========================================
    // 8. VARIABLE DECLARATION
    // ==========================================
    if (node.type === 'VariableDeclaration') {
      const isExported = isNodeExported(node, parent);
      const kind = node.kind;

      if (isArraySafe(node.declarations)) {
        for (const decl of node.declarations) {
          if (!decl) continue;
          if (decl.id?.type === 'Identifier') {
            const name = decl.id.name;
            const isConst = kind === 'const';

            if (isConst) {
              constants.push({
                name: name || 'unknown',
                line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                value: extractValue(decl.init),
                isExported,
                type: decl.init?.type || undefined,
              });
            } else {
              variables.push({
                name: name || 'unknown',
                line: decl.loc?.start?.line || node.loc?.start?.line || 1,
                isExported,
                type: decl.init?.type || undefined,
                value: extractValue(decl.init),
              });
            }
          }
        }
      }
    }

    // ==========================================
    // 9. TS INTERFACE DECLARATION
    // ==========================================
    if (node.type === 'TSInterfaceDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      const properties: string[] = [];
      if (isArraySafe(node.body?.body)) {
        for (const member of node.body.body) {
          if (!member) continue;
          if (member.key?.name) {
            properties.push(member.key.name);
          }
        }
      }

      interfaces.push({
        name: name || 'unknown',
        line: node.loc?.start?.line || 1,
        isExported,
        properties,
        extends: node.extends?.map((e: any) => e.expression?.name || e.name) || [],
        startLine: node.loc?.start?.line || 1,
        endLine: node.loc?.end?.line || 1,
      });
    }

    // ==========================================
    // 10. TS TYPE ALIAS DECLARATION
    // ==========================================
    if (node.type === 'TSTypeAliasDeclaration' && node.id) {
      const name = node.id.name;
      const isExported = isNodeExported(node, parent);

      types.push({
        name: name || 'unknown',
        line: node.loc?.start?.line || 1,
        isExported,
        definition: node.typeAnnotation?.type || 'unknown',
      });
    }

    // ==========================================
    // РЕКУРСИВНЫЙ ОБХОД ДЕТЕЙ
    // ==========================================
    const childrenToTraverse: any[] = [];

    if (node.body) {
      if (Array.isArray(node.body)) {
        childrenToTraverse.push(...node.body);
      } else if (typeof node.body === 'object') {
        childrenToTraverse.push(node.body);
      }
    }

    if (node.consequent) childrenToTraverse.push(node.consequent);
    if (node.alternate) childrenToTraverse.push(node.alternate);
    if (node.init) childrenToTraverse.push(node.init);
    if (node.update) childrenToTraverse.push(node.update);
    if (node.test) childrenToTraverse.push(node.test);
    if (node.handler) childrenToTraverse.push(node.handler);
    if (node.finalizer) childrenToTraverse.push(node.finalizer);
    if (node.param) childrenToTraverse.push(node.param);
    if (node.argument) childrenToTraverse.push(node.argument);
    if (node.expression) childrenToTraverse.push(node.expression);
    if (node.callee) childrenToTraverse.push(node.callee);
    if (node.object) childrenToTraverse.push(node.object);
    if (node.property) childrenToTraverse.push(node.property);

    if (isArraySafe(node.arguments)) {
      childrenToTraverse.push(...node.arguments);
    }
    if (isArraySafe(node.properties)) {
      childrenToTraverse.push(...node.properties);
    }
    if (isArraySafe(node.elements)) {
      childrenToTraverse.push(...node.elements);
    }
    if (isArraySafe(node.cases)) {
      for (const caseNode of node.cases) {
        if (caseNode.consequent) {
          childrenToTraverse.push(...caseNode.consequent);
        }
      }
    }
    if (isArraySafe(node.handlers)) {
      childrenToTraverse.push(...node.handlers);
    }

    const validChildren = childrenToTraverse.filter(child => child && typeof child === 'object');

    for (const child of validChildren) {
      traverseNode(child, node, depth + 1, parentFunction);
    }
  }

  // ==========================================
  // ЗАПУСК ОБХОДА
  // ==========================================
  try {
    for (const node of ast.body) {
      traverseNode(node, null, 0, undefined);
    }
  } catch (error) {
    console.warn(`⚠️ Ошибка при обходе AST для ${filePath || 'unknown'}:`, error);
  }

  // ==========================================
  // СБОР ВСЕХ ИМЕН ФУНКЦИЙ
  // ==========================================
  const functionNames = new Set<string>();
  for (const func of functions) {
    functionNames.add(func.name);
  }

  // ==========================================
  // СБОР ВЫЗОВОВ
  // ==========================================
  for (const func of functions) {
    let funcNode: any = null;
    let found = false;

    function findFunctionNode(node: any) {
      if (found) return;
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration' && node.id?.name === func.name) {
        funcNode = node;
        found = true;
        return;
      }

      if (node.type === 'FunctionExpression' && node.id?.name === func.name) {
        funcNode = node;
        found = true;
        return;
      }

      if (node.type === 'VariableDeclarator' && node.id?.name === func.name) {
        if (
          node.init &&
          (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression')
        ) {
          funcNode = node.init;
          found = true;
          return;
        }
      }

      if (node.type === 'MethodDefinition' && node.key?.name === func.name) {
        funcNode = node.value;
        found = true;
        return;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object') {
                findFunctionNode(item);
              }
            }
          } else {
            findFunctionNode(child);
          }
        }
      }
    }

    findFunctionNode(ast);

    if (funcNode) {
      const calls = collectAllCalls(funcNode, functionNames, func.name, {
        includeAllIdentifiers: true,
        includeLocalCalls: true,
      });
      func.calls = calls;

      if (calls.length > 0 && process.env.DEBUG === 'true') {
        console.log(`  📞 ${func.name} вызывает: ${calls.join(', ')}`);
      }
    }
  }

  // ==========================================
  // ПОСТРОЕНИЕ calledBy
  // ==========================================
  for (const func of functions) {
    for (const otherFunc of functions) {
      if (otherFunc.calls.includes(func.name) && !func.calledBy.includes(otherFunc.name)) {
        func.calledBy.push(otherFunc.name);
      }
    }
  }

  // ==========================================
  // ПОСТРОЕНИЕ callGraph
  // ==========================================
  for (const func of functions) {
    if (!callGraph[func.name]) {
      callGraph[func.name] = [];
    }
    const funcCalls = callGraph[func.name];
    if (funcCalls) {
      for (const call of func.calls) {
        if (!funcCalls.includes(call)) {
          funcCalls.push(call);
        }
      }
    }
  }

  for (const func of functions) {
    if (func.parentFunction) {
      if (!callGraph[func.parentFunction]) {
        callGraph[func.parentFunction] = [];
      }
      const parentCalls = callGraph[func.parentFunction];
      if (parentCalls && !parentCalls.includes(func.name)) {
        parentCalls.push(func.name);
      }
    }
  }

  // ==========================================
  // ЗАПОЛНЕНИЕ РЕЗУЛЬТАТА
  // ==========================================
  result.functions = functions;
  result.classes = classes;
  result.constants = constants;
  result.interfaces = interfaces;
  result.types = types;
  result.variables = variables;
  result.imports = imports;
  result.exports = exports;
  result.callGraph = callGraph;
  result.moduleName = filePath ? path.basename(filePath) : 'unknown';
  result.filePath = filePath || 'unknown';

  return result;
}

// ==========================================
// ЭКСПОРТ ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ
// ==========================================

export function extractCallGraph(ast: any): Record<string, string[]> {
  const callGraph: Record<string, string[]> = {};
  let currentFunction: string | null = null;

  try {
    walk(ast, {
      enter(node: any) {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = node.id.name;
          if (currentFunction && !callGraph[currentFunction]) {
            callGraph[currentFunction] = [];
          }
        }

        if (node.type === 'CallExpression' && node.callee && currentFunction) {
          let calleeName: string | null = null;
          if (node.callee.type === 'Identifier') {
            calleeName = node.callee.name;
          } else if (node.callee.type === 'MemberExpression' && node.callee.property) {
            calleeName = node.callee.property.name;
          }

          if (calleeName && currentFunction) {
            const funcKey = currentFunction;
            if (!callGraph[funcKey]) {
              callGraph[funcKey] = [];
            }
            const funcCalls = callGraph[funcKey];
            if (funcCalls && !funcCalls.includes(calleeName)) {
              funcCalls.push(calleeName);
            }
          }
        }
      },
      leave(node: any) {
        if (node.type === 'FunctionDeclaration' && node.id) {
          currentFunction = null;
        }
      },
    });
  } catch (error) {
    console.warn('⚠️ Ошибка при извлечении графа вызовов:', error);
  }

  return callGraph;
}

// ==========================================
// РЕЭКСПОРТ collectAllCalls ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ==========================================

export {
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
};

export default {
  extractEntities,
  extractCallGraph,
  collectAllCalls,
  collectAllCallsUnfiltered,
  collectDeclaredFunctions,
  buildCallGraphFromAST,
  findUnusedFunctions,
  findUnresolvedCalls,
};