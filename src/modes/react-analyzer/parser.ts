// src/modes/react-analyzer/parser.ts
// ============================================================
// REACT PARSER (.tsx / .jsx)
// ============================================================
// Версия: 1.0.1 (fix TS-ошибки: unused imports, children тип)
//
// НАЗНАЧЕНИЕ
// ----------
// Парсит .tsx/.jsx через @typescript-eslint/parser и возвращает
// ReactComponentAnalysis с компонентами, хуками, JSX, событиями,
// conditionals.
//
// СИММЕТРИЯ С VUE
// ---------------
//   Vue:   core/vue-template-parser.ts (через @vue/compiler-sfc)
//   React: modes/react-analyzer/parser.ts (через @typescript-eslint/parser)
// ============================================================

import fs from 'fs';
import path from 'path';
import { parse as parseTS } from '@typescript-eslint/parser';
import type {
  ReactComponentAnalysis,
  AnalyzedComponent,
  AnalyzedHook,
  AnalyzedJsxElement,
  AnalyzedJsxEvent,
  AnalyzedConditional,
  AnalyzedComponentUsage,
  AnalyzedImport,
  AnalyzedExport,
  AnalyzeReactOptions,
} from './types.js';
import type {
  ElementAttr,
  ElementAttrKind,
  JsxNodeKind,
  ReactComponentKind,
  ReactHookKind,
} from '../../core/react-entity-classifier.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

const KNOWN_HOOKS = new Set<string>([
  'useState',
  'useReducer',
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'useImperativeHandle',
  'useTransition',
  'useDeferredValue',
  'useActionState',
  'useOptimistic',
  'useFormStatus',
  'use',
]);

const JSX_EVENT_RE = /^on[A-Z][A-Za-z]+$/;
const COMPONENT_TAG_RE = /^[A-Z]/;

const T = {
  Program: 'Program',
  FunctionDeclaration: 'FunctionDeclaration',
  FunctionExpression: 'FunctionExpression',
  ArrowFunctionExpression: 'ArrowFunctionExpression',
  VariableDeclaration: 'VariableDeclaration',
  VariableDeclarator: 'VariableDeclarator',
  CallExpression: 'CallExpression',
  MemberExpression: 'MemberExpression',
  Identifier: 'Identifier',
  Literal: 'Literal',
  TemplateLiteral: 'TemplateLiteral',
  JSXElement: 'JSXElement',
  JSXOpeningElement: 'JSXOpeningElement',
  JSXClosingElement: 'JSXClosingElement',
  JSXFragment: 'JSXFragment',
  JSXExpressionContainer: 'JSXExpressionContainer',
  JSXText: 'JSXText',
  JSXAttribute: 'JSXAttribute',
  JSXSpreadAttribute: 'JSXSpreadAttribute',
  JSXIdentifier: 'JSXIdentifier',
  JSXMemberExpression: 'JSXMemberExpression',
  JSXNamespacedName: 'JSXNamespacedName',
  JSXEmptyExpression: 'JSXEmptyExpression',
  LogicalExpression: 'LogicalExpression',
  ConditionalExpression: 'ConditionalExpression',
  BlockStatement: 'BlockStatement',
  ReturnStatement: 'ReturnStatement',
  ImportDeclaration: 'ImportDeclaration',
  ExportNamedDeclaration: 'ExportNamedDeclaration',
  ExportDefaultDeclaration: 'ExportDefaultDeclaration',
  ObjectPattern: 'ObjectPattern',
  Property: 'Property',
  RestElement: 'RestElement',
  AssignmentPattern: 'AssignmentPattern',
  ArrayExpression: 'ArrayExpression',
} as const;

// ============================================================
// ПУБЛИЧНОЕ API
// ============================================================

export function parseReactFile(
  filePath: string,
  options: AnalyzeReactOptions = {}
): ReactComponentAnalysis {
  const source = fs.readFileSync(filePath, 'utf-8');
  return parseReactSource(source, filePath, options);
}

export function parseReactSource(
  source: string,
  filePath: string,
  _options: AnalyzeReactOptions = {}
): ReactComponentAnalysis {
  const ext = path.extname(filePath).toLowerCase();
  const isTS = ext === '.tsx' || ext === '.ts';

  const ast = parseTS(source, {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    loc: true,
    range: true,
    comment: false,
    tokens: false,
  }) as any;

  const imports = extractImports(ast);
  const exports = extractExports(ast);
  const components = extractComponents(ast);

  let totalHooks = 0;
  let totalJsx = 0;
  let totalEvents = 0;
  let totalConditionals = 0;

  for (const c of components) {
    totalHooks += c.hooks.length;
    totalJsx += c.jsxElements.length;
    totalEvents += c.jsxEvents.length;
    totalConditionals += c.conditionals.length;
  }

  return {
    fileName: path.basename(filePath, ext),
    filePath,
    isTS,
    size: source.length,
    lines: source.split('\n').length,
    components,
    hooks: components.flatMap(c => c.hooks),
    imports,
    exports,
    stats: {
      componentCount: components.length,
      hookCount: totalHooks,
      jsxElementCount: totalJsx,
      jsxEventCount: totalEvents,
      conditionalCount: totalConditionals,
      importCount: imports.length,
      exportCount: exports.length,
    },
  };
}

// ============================================================
// 1. EXTRACT COMPONENTS
// ============================================================

function extractComponents(ast: any): AnalyzedComponent[] {
  const components: AnalyzedComponent[] = [];
  const exportedNames = new Set<string>();
  let defaultExportName: string | null = null;

  for (const node of ast.body ?? []) {
    if (node.type === T.ExportNamedDeclaration) {
      const decl = node.declaration;
      if (decl?.type === T.FunctionDeclaration && decl.id?.name) {
        exportedNames.add(decl.id.name);
      }
      if (decl?.type === T.VariableDeclaration) {
        for (const d of decl.declarations ?? []) {
          if (d.id?.name) exportedNames.add(d.id.name);
        }
      }
      for (const spec of node.specifiers ?? []) {
        const name = spec.local?.name ?? spec.exported?.name;
        if (name) exportedNames.add(name);
      }
    }
    if (node.type === T.ExportDefaultDeclaration) {
      const decl = node.declaration;
      if (decl?.type === T.FunctionDeclaration && decl.id?.name) {
        defaultExportName = decl.id.name;
      } else if (decl?.type === T.Identifier) {
        defaultExportName = decl.name;
      }
    }
  }

  for (const node of ast.body ?? []) {
    let decl: any = node;
    if (node.type === T.ExportNamedDeclaration && node.declaration) {
      decl = node.declaration;
    }

    // 1. FunctionDeclaration
    if (decl.type === T.FunctionDeclaration && decl.id?.name) {
      const name = decl.id.name;
      if (isComponentName(name) && returnsJsx(decl)) {
        components.push(buildComponent(name, 'function', decl, exportedNames, defaultExportName));
      }
      continue;
    }

    // 2. VariableDeclaration с ArrowFunction/FunctionExpression
    if (decl.type === T.VariableDeclaration) {
      for (const d of decl.declarations ?? []) {
        if (!d.id?.name || !d.init) continue;
        const name = d.id.name;
        if (!isComponentName(name)) continue;

        const init = d.init;
        let kind: ReactComponentKind | null = null;
        let wrapped: any = init;
        let isMemoized = false;
        let isForwardRef = false;

        // React.memo(...)
        if (
          init.type === T.CallExpression &&
          init.callee?.type === T.MemberExpression &&
          init.callee.object?.name === 'React' &&
          init.callee.property?.name === 'memo'
        ) {
          kind = 'memo';
          isMemoized = true;
          wrapped = init.arguments?.[0];
        }
        // React.forwardRef(...)
        else if (
          init.type === T.CallExpression &&
          init.callee?.type === T.MemberExpression &&
          init.callee.object?.name === 'React' &&
          init.callee.property?.name === 'forwardRef'
        ) {
          kind = 'forwardRef';
          isForwardRef = true;
          wrapped = init.arguments?.[0];
        } else if (init.type === T.ArrowFunctionExpression) {
          kind = 'arrow';
        } else if (init.type === T.FunctionExpression) {
          kind = 'function';
        }

        if (kind && wrapped && returnsJsx(wrapped)) {
          const comp = buildComponent(name, kind, wrapped, exportedNames, defaultExportName);
          comp.isMemoized = isMemoized;
          comp.isForwardRef = isForwardRef;
          components.push(comp);
        }
      }
    }
  }

  return components;
}

// ============================================================
// 2. BUILD COMPONENT
// ============================================================

function buildComponent(
  name: string,
  kind: ReactComponentKind,
  node: any,
  exportedNames: Set<string>,
  defaultExportName: string | null
): AnalyzedComponent {
  const hooks: AnalyzedHook[] = [];
  const jsxElements: AnalyzedJsxElement[] = [];
  const jsxEvents: AnalyzedJsxEvent[] = [];
  const conditionals: AnalyzedConditional[] = [];
  const componentUsages: AnalyzedComponentUsage[] = [];
  const props = extractPropsFromParams(node);

  // Хуки внутри тела (плоско, с проходом по всем вложенным)
  walkNode(node.body, n => {
    if (n.type === T.CallExpression && n.callee?.type === T.Identifier) {
      const hookName = n.callee.name;
      if (KNOWN_HOOKS.has(hookName)) {
        const hook = parseHook(hookName as ReactHookKind, n);
        if (hook) hooks.push(hook);
      }
    }
  });

  // JSX
  const rootJsx = findRootJsx(node);
  if (rootJsx) {
    parseJsx(rootJsx, null, jsxElements, jsxEvents, conditionals, componentUsages, 0);
  }

  return {
    name,
    kind,
    line: node.loc?.start?.line ?? 0,
    column: node.loc?.start?.column,
    props,
    isExported: exportedNames.has(name),
    isDefaultExport: defaultExportName === name,
    isMemoized: false,
    isForwardRef: false,
    hooks,
    jsxElements,
    jsxEvents,
    conditionals,
    componentUsages,
  };
}

// ============================================================
// 3. PARSE HOOK
// ============================================================

function parseHook(kind: ReactHookKind, node: any): AnalyzedHook | null {
  const line = node.loc?.start?.line ?? 0;
  const column = node.loc?.start?.column;
  const args = node.arguments ?? [];

  const hook: AnalyzedHook = { kind, line, column };

  if (kind === 'useState' || kind === 'useReducer') {
    hook.initialValue = args[0] ? sourceText(args[0]) : undefined;
  }

  if (kind === 'useEffect' || kind === 'useLayoutEffect' || kind === 'useInsertionEffect') {
    const fn = args[0];
    const deps = args[1];
    hook.hasCleanup = fn && containsReturnFunction(fn);
    hook.deps = deps ? extractArrayLiterals(deps) : [];
    hook.effectKind = kind === 'useLayoutEffect' ? 'layout' : 'update';
    if (hook.deps && hook.deps.length === 0) hook.effectKind = 'mount';
    if (!deps) hook.effectKind = 'every';
  }

  if (kind === 'useMemo' || kind === 'useCallback') {
    const deps = args[1];
    hook.deps = deps ? extractArrayLiterals(deps) : [];
  }

  if (kind === 'useContext') {
    hook.contextName = args[0] ? sourceText(args[0]) : undefined;
  }

  return hook;
}

// ============================================================
// 4. PARSE JSX
// ============================================================

function parseJsx(
  node: any,
  parentId: string | null,
  elements: AnalyzedJsxElement[],
  events: AnalyzedJsxEvent[],
  conditionals: AnalyzedConditional[],
  usages: AnalyzedComponentUsage[],
  depth: number
): string | null {
  if (!node) return null;

  // ── JSXElement: <Tag>...</Tag>
  if (node.type === T.JSXElement) {
    const opening = node.openingElement;
    const tagName = getTagName(opening?.name);
    const kind = classifyJsxTag(tagName);
    const attrs = parseAttrs(opening?.attributes ?? []);
    const line = node.loc?.start?.line ?? 0;
    const column = node.loc?.start?.column;

    const id = `jsx_${elements.length}`;
    const element: AnalyzedJsxElement = {
      kind,
      tagName,
      line,
      column,
      attrs,
      children: [],
      parentElementId: parentId,
    };

    // События из attrs
    for (const attr of attrs) {
      if (JSX_EVENT_RE.test(attr.name)) {
        events.push({
          elementId: id,
          eventName: attr.name,
          line,
          handler: attr.value,
          source: 'local',
        });
      }
    }

    // Component usage
    if (kind === 'component') {
      const propNames = attrs.filter(a => !JSX_EVENT_RE.test(a.name)).map(a => a.name);
      const eventNames = attrs.filter(a => JSX_EVENT_RE.test(a.name)).map(a => a.name);
      usages.push({
        usageId: id,
        tagName,
        line,
        isExternal: false,
        props: propNames,
        events: eventNames,
        slots: [],
      });
    }

    // Публикуем ДО обработки детей, чтобы children.push(childId) работал
    // на уже добавленном `element` (ссылка сохраняется).
    elements.push(element);

    // Дети
    for (const child of node.children ?? []) {
      if (child.type === T.JSXText) {
        const text = (child.value ?? '').trim();
        if (text) {
          const childId = `jsx_${elements.length}`;
          elements.push({
            kind: 'text',
            tagName: '',
            line: child.loc?.start?.line ?? line,
            attrs: [],
            children: [],
            parentElementId: id,
            textContent: text,
          });
          element.children.push(childId);
        }
        continue;
      }

      if (child.type === T.JSXExpressionContainer) {
        const expr = child.expression;
        if (!expr || expr.type === T.JSXEmptyExpression) continue;

        if (expr.type === T.LogicalExpression) {
          const condId = parseJsx(
            expr.right,
            id,
            elements,
            events,
            conditionals,
            usages,
            depth + 1
          );
          conditionals.push({
            kind: expr.operator === '&&' ? '&&' : '||',
            condition: sourceText(expr.left),
            refs: extractIdentifiers(expr.left),
            line: expr.loc?.start?.line ?? line,
            guards: condId ? [condId] : [],
          });
          if (condId) element.children.push(condId);
          continue;
        }

        if (expr.type === T.ConditionalExpression) {
          const thenId = parseJsx(
            expr.consequent,
            id,
            elements,
            events,
            conditionals,
            usages,
            depth + 1
          );
          const elseId = parseJsx(
            expr.alternate,
            id,
            elements,
            events,
            conditionals,
            usages,
            depth + 1
          );
          conditionals.push({
            kind: '?:',
            condition: sourceText(expr.test),
            refs: extractIdentifiers(expr.test),
            line: expr.loc?.start?.line ?? line,
            guards: [thenId, elseId].filter(Boolean) as string[],
          });
          if (thenId) element.children.push(thenId);
          if (elseId) element.children.push(elseId);
          continue;
        }

        if (expr.type === T.JSXElement || expr.type === T.JSXFragment) {
          const childId = parseJsx(expr, id, elements, events, conditionals, usages, depth + 1);
          if (childId) element.children.push(childId);
          continue;
        }

        // Expression (например, {user.name})
        const childId = `jsx_${elements.length}`;
        elements.push({
          kind: 'expression',
          tagName: '',
          line: expr.loc?.start?.line ?? line,
          attrs: [],
          children: [],
          parentElementId: id,
          expression: sourceText(expr),
          expressionRefs: extractIdentifiers(expr),
        });
        element.children.push(childId);
        continue;
      }

      if (child.type === T.JSXElement || child.type === T.JSXFragment) {
        const childId = parseJsx(child, id, elements, events, conditionals, usages, depth + 1);
        if (childId) element.children.push(childId);
      }
    }

    return id;
  }

  // ── JSXFragment: <></>
  if (node.type === T.JSXFragment) {
    const id = `jsx_${elements.length}`;
    const element: AnalyzedJsxElement = {
      kind: 'fragment',
      tagName: '',
      line: node.loc?.start?.line ?? 0,
      attrs: [],
      children: [],
      parentElementId: parentId,
    };
    elements.push(element);

    for (const child of node.children ?? []) {
      if (child.type === T.JSXElement || child.type === T.JSXFragment) {
        const childId = parseJsx(child, id, elements, events, conditionals, usages, depth + 1);
        if (childId) element.children.push(childId);
      } else if (child.type === T.JSXExpressionContainer) {
        const expr = child.expression;
        if (!expr || expr.type === T.JSXEmptyExpression) continue;
        if (expr.type === T.JSXElement || expr.type === T.JSXFragment) {
          const childId = parseJsx(expr, id, elements, events, conditionals, usages, depth + 1);
          if (childId) element.children.push(childId);
        }
      }
    }

    return id;
  }

  return null;
}

// ============================================================
// 5. PARSE ATTRS
// ============================================================

function parseAttrs(attributes: any[]): ElementAttr[] {
  const result: ElementAttr[] = [];

  for (const attr of attributes) {
    if (attr.type === T.JSXSpreadAttribute) {
      result.push({
        name: '...',
        rawValue: sourceText(attr.argument),
        value: sourceText(attr.argument),
        kind: 'spread',
        refs: extractIdentifiers(attr.argument),
      });
      continue;
    }

    if (attr.type !== T.JSXAttribute) continue;

    const name = attr.name?.name ?? '';
    const valueNode = attr.value;

    if (!valueNode) {
      result.push({
        name,
        rawValue: '',
        value: 'true',
        kind: 'boolean',
        refs: [],
      });
      continue;
    }

    if (valueNode.type === T.Literal) {
      result.push({
        name,
        rawValue: JSON.stringify(valueNode.value),
        value: String(valueNode.value ?? ''),
        kind: 'string',
        refs: [],
      });
      continue;
    }

    if (valueNode.type === T.JSXExpressionContainer) {
      const expr = valueNode.expression;
      if (!expr || expr.type === T.JSXEmptyExpression) continue;

      const refs = extractIdentifiers(expr);
      const kind: ElementAttrKind = JSX_EVENT_RE.test(name) ? 'handler' : 'expression';

      result.push({
        name,
        rawValue: sourceText(expr),
        value: sourceText(expr),
        kind,
        refs,
      });
      continue;
    }
  }

  return result;
}

// ============================================================
// 6. EXTRACT IMPORTS
// ============================================================

function extractImports(ast: any): AnalyzedImport[] {
  const imports: AnalyzedImport[] = [];
  for (const node of ast.body ?? []) {
    if (node.type !== T.ImportDeclaration) continue;
    const source = node.source?.value ?? '';
    const isTypeOnly = node.importKind === 'type';
    const specifiers = (node.specifiers ?? []).map((s: any) => ({
      imported: s.imported?.name ?? s.local?.name ?? '',
      local: s.local?.name ?? '',
      isTypeOnly: s.importKind === 'type',
    }));
    imports.push({
      source,
      specifiers,
      isTypeOnly,
      line: node.loc?.start?.line ?? 0,
    });
  }
  return imports;
}

// ============================================================
// 7. EXTRACT EXPORTS
// ============================================================

function extractExports(ast: any): AnalyzedExport[] {
  const exports: AnalyzedExport[] = [];
  for (const node of ast.body ?? []) {
    if (node.type === T.ExportNamedDeclaration) {
      const decl = node.declaration;
      if (decl?.type === T.FunctionDeclaration && decl.id?.name) {
        exports.push({
          name: decl.id.name,
          kind: 'named',
          isTypeOnly: false,
          line: decl.loc?.start?.line ?? 0,
        });
      } else if (decl?.type === T.VariableDeclaration) {
        for (const d of decl.declarations ?? []) {
          if (d.id?.name) {
            exports.push({
              name: d.id.name,
              kind: 'named',
              isTypeOnly: false,
              line: d.loc?.start?.line ?? 0,
            });
          }
        }
      }
      for (const spec of node.specifiers ?? []) {
        const name = spec.exported?.name ?? spec.local?.name;
        if (name) {
          exports.push({
            name,
            kind: 'named',
            isTypeOnly: node.exportKind === 'type',
            line: spec.loc?.start?.line ?? 0,
          });
        }
      }
    }
    if (node.type === T.ExportDefaultDeclaration) {
      const decl = node.declaration;
      let name = 'default';
      if (decl?.type === T.FunctionDeclaration && decl.id?.name) name = decl.id.name;
      else if (decl?.type === T.Identifier) name = decl.name;
      exports.push({
        name,
        kind: 'default',
        isTypeOnly: false,
        line: node.loc?.start?.line ?? 0,
      });
    }
  }
  return exports;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

function isComponentName(name: string): boolean {
  return COMPONENT_TAG_RE.test(name);
}

function returnsJsx(node: any): boolean {
  if (!node) return false;
  const body = node.body;
  if (!body) return false;

  if (body.type === T.JSXElement || body.type === T.JSXFragment) return true;

  if (body.type === T.BlockStatement) {
    for (const stmt of body.body ?? []) {
      if (stmt.type === T.ReturnStatement && stmt.argument) {
        if (stmt.argument.type === T.JSXElement || stmt.argument.type === T.JSXFragment) {
          return true;
        }
      }
    }
  }

  return false;
}

function findRootJsx(node: any): any {
  const body = node.body;
  if (!body) return null;

  if (body.type === T.JSXElement || body.type === T.JSXFragment) return body;

  if (body.type === T.BlockStatement) {
    for (const stmt of body.body ?? []) {
      if (stmt.type === T.ReturnStatement && stmt.argument) {
        if (stmt.argument.type === T.JSXElement || stmt.argument.type === T.JSXFragment) {
          return stmt.argument;
        }
      }
    }
  }

  return null;
}

function getTagName(node: any): string {
  if (!node) return '';
  if (node.type === T.JSXIdentifier) return node.name;
  if (node.type === T.JSXMemberExpression) {
    return `${getTagName(node.object)}.${getTagName(node.property)}`;
  }
  return '';
}

function classifyJsxTag(tagName: string): JsxNodeKind {
  if (!tagName) return 'fragment';
  if (COMPONENT_TAG_RE.test(tagName)) return 'component';
  return 'element';
}

function sourceText(node: any): string {
  if (!node) return '';
  if (node.type === T.Identifier) return node.name;
  if (node.type === T.Literal) return String(node.value ?? '');
  if (node.type === T.MemberExpression) {
    return `${sourceText(node.object)}.${sourceText(node.property)}`;
  }
  if (node.type === T.CallExpression) {
    return `${sourceText(node.callee)}(${(node.arguments ?? []).map(sourceText).join(', ')})`;
  }
  if (node.type === T.ArrowFunctionExpression) return '() => ...';
  if (node.type === T.TemplateLiteral) return '`...`';
  return '<expr>';
}

function extractIdentifiers(node: any): string[] {
  const ids = new Set<string>();
  walkNode(node, n => {
    if (n.type === T.Identifier && n.name) ids.add(n.name);
  });
  return Array.from(ids);
}

function extractPropsFromParams(node: any): string[] {
  const params = node.params ?? [];
  const props: string[] = [];

  for (const p of params) {
    if (p.type === T.ObjectPattern) {
      for (const prop of p.properties ?? []) {
        if (prop.type === T.Property && prop.key?.name) {
          props.push(prop.key.name);
        } else if (prop.type === T.RestElement && prop.argument?.name) {
          props.push(prop.argument.name);
        }
      }
    }
    if (p.type === T.Identifier) {
      props.push(p.name);
    }
    if (p.type === T.AssignmentPattern && p.left?.type === T.ObjectPattern) {
      for (const prop of p.left.properties ?? []) {
        if (prop.type === T.Property && prop.key?.name) {
          props.push(prop.key.name);
        }
      }
    }
  }

  return props;
}

function extractArrayLiterals(node: any): string[] {
  if (!node) return [];
  if (node.type === T.ArrayExpression) {
    return (node.elements ?? []).map((el: any) => sourceText(el)).filter(Boolean);
  }
  return [];
}

function containsReturnFunction(fn: any): boolean {
  if (!fn) return false;
  let hasReturn = false;
  walkNode(fn, n => {
    if (n.type === T.ReturnStatement && n.argument) {
      if (
        n.argument.type === T.FunctionExpression ||
        n.argument.type === T.ArrowFunctionExpression
      ) {
        hasReturn = true;
      }
    }
  });
  return hasReturn;
}

function walkNode(node: any, cb: (n: any) => void): void {
  if (!node || typeof node !== 'object') return;
  cb(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && item.type) walkNode(item, cb);
      }
    } else if (value && typeof value === 'object' && value.type) {
      walkNode(value, cb);
    }
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  parseReactFile,
  parseReactSource,
};
