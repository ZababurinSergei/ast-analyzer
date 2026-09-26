// src/core/source-chain-resolver.ts
// ============================================================
// SOURCE CHAIN RESOLVER
// ============================================================
// Версия: 1.0.0
//
// Разрешает цепочки источников для props, events, interpolations.
// Опирается на существующие секции index.json:
//   - gr.i / gr.i.ff / gr.i.tf — импорты
//   - gr.re / re.m            — relations
//   - fns.p / fns.vk / fns.rt — контекст scope
//   - lx / lx.nonEmptyV       — лексические связи
//   - vue.*                   — Vue-метаданные (обогащение)
// ============================================================

import type {
  SourceChainItem,
  ComponentProp,
  ComponentEvent,
} from '../reporters/codec/codec-types.js';

const NONE = '\u0004';

function sanitizeSymbol(s: string): string {
  return s.replace(/[\u0001-\u0004]/g, '');
}

export function serializeSourceChain(chain: SourceChainItem[]): string {
  return chain
    .map(item =>
      [
        item.kind,
        sanitizeSymbol(item.symbol),
        item.functionId ?? NONE,
        item.subkind ?? NONE,
        item.sourceFileId ?? NONE,
      ].join('\u0002')
    )
    .join('\u0003');
}

export function deserializeSourceChain(s: string): SourceChainItem[] {
  if (!s) return [];
  return s.split('\u0003').map(item => {
    const [kind, symbol, functionId, subkind, sourceFileId] = item.split('\u0002');
    return {
      kind: kind as SourceChainItem['kind'],
      symbol: symbol ?? '',
      functionId: functionId === NONE ? undefined : functionId,
      subkind: subkind === NONE ? undefined : (subkind as SourceChainItem['subkind']),
      sourceFileId: sourceFileId === NONE ? undefined : sourceFileId,
    };
  });
}

export interface Scope {
  fileId: string;
  locals: Map<
    string,
    {
      functionId?: string;
      subkind?: SourceChainItem['subkind'];
      isRef?: boolean;
      isDomElement?: boolean;
      typeHint?: string;
    }
  >;
  imports: Map<string, { functionId?: string; sourceFileId?: string }>;
  globals: Set<string>;
  refs: Set<string>;
}

export interface ExistingIndex {
  importsByLocalName: Map<string, { resolvedFunctionId?: string; toFileId?: string }>;
  relationsBySymbol: Map<
    string,
    { kind: SourceChainItem['kind']; toFunctionId?: string; toFileId?: string }
  >;
  vue?: any;
}

export function parseSourceChain(
  expression: string,
  scope: Scope,
  index: ExistingIndex
): SourceChainItem[] {
  const items: SourceChainItem[] = [];
  const trimmed = expression.trim().replace(/^!+/, '');

  if (!trimmed) return items;

  // Литералы
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return [{ kind: 'literal', symbol: trimmed }];
  }
  if (/^(true|false|null|undefined)$/.test(trimmed)) {
    return [{ kind: 'literal', symbol: trimmed }];
  }
  if (/^['"`]/.test(trimmed)) {
    return [{ kind: 'literal', symbol: 'string' }];
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return [{ kind: 'literal', symbol: 'object' }];
  }

  // Приоритет: графовые данные
  const viaGraph = tryResolveViaGraph(trimmed, scope, index);
  if (viaGraph.length > 0) return viaGraph;

  // Обработка вызовов: "props.toolbarItems.filter(x => x.visible)"
  const callMatch = trimmed.match(/^(.+?)\(/);
  if (callMatch && callMatch[1]) {
    const innerChain = parseSourceChain(callMatch[1].trim(), scope, index);
    if (innerChain.length > 0) {
      const last = innerChain[innerChain.length - 1]!;
      items.push(...innerChain);
      items.push({ kind: 'call', symbol: last.symbol, functionId: last.functionId });
      return items;
    }
  }

  // Обработка index access: "items[0]"
  const indexMatch = trimmed.match(/^(\w+)\[(.+?)\]$/);
  if (indexMatch) {
    const baseChain = parseSourceChain(indexMatch[1]!, scope, index);
    items.push(...baseChain);
    items.push({ kind: 'member', symbol: `[${indexMatch[2]}]` });
    return items;
  }

  // Разбор через '.'
  const parts = trimmed.split('.');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const isFirst = i === 0;

    if (isFirst) {
      if (part === 'props') {
        items.push({ kind: 'prop', symbol: parts[i + 1] || part });
        i++;
        continue;
      }
      if (part === '$emit') {
        items.push({ kind: 'emit', symbol: parts[i + 1] || part });
        i++;
        continue;
      }

      const local = scope.locals.get(part);
      if (local) {
        items.push({
          kind: 'local',
          symbol: part,
          functionId: local.functionId,
          subkind: local.subkind,
        });
        continue;
      }
      const imp = scope.imports.get(part);
      if (imp) {
        items.push({
          kind: 'import',
          symbol: part,
          functionId: imp.functionId,
          sourceFileId: imp.sourceFileId,
        });
        continue;
      }
      if (scope.globals.has(part)) {
        items.push({ kind: 'global', symbol: part });
        continue;
      }
      items.push({ kind: 'unknown', symbol: part });
    } else {
      items.push({ kind: 'member', symbol: part });
    }
  }

  return items;
}

function tryResolveViaGraph(expr: string, scope: Scope, index: ExistingIndex): SourceChainItem[] {
  const rootIdent = expr.split(/[.\[(]/)[0]?.trim();
  if (!rootIdent) return [];

  const results: SourceChainItem[] = [];

  const imp = index.importsByLocalName.get(`${scope.fileId}:${rootIdent}`);
  if (imp) {
    results.push({
      kind: 'import',
      symbol: rootIdent,
      functionId: imp.resolvedFunctionId,
      sourceFileId: imp.toFileId,
    });
  }

  const rel = index.relationsBySymbol.get(`${scope.fileId}:${rootIdent}`);
  if (rel) {
    results.push({
      kind: rel.kind,
      symbol: rootIdent,
      functionId: rel.toFunctionId,
      sourceFileId: rel.toFileId,
    });
  }

  const vueMeta = resolveFromVueMeta(rootIdent, scope, index);
  if (vueMeta) results.push(vueMeta);

  if (results.length > 1) {
    const fnIds = new Set(results.map(r => r.functionId).filter(Boolean));
    if (fnIds.size > 1) {
      console.warn(
        `[source-chain-resolver] Conflict for "${rootIdent}" in ${scope.fileId}:`,
        results.map(r => `${r.kind}:${r.functionId}`).join(' vs ')
      );
    }
  }

  return results.length > 0 ? [results[0]!] : [];
}

function resolveFromVueMeta(
  rootIdent: string,
  scope: Scope,
  index: ExistingIndex
): SourceChainItem | null {
  if (!index.vue) return null;

  const comp = index.vue.composables?.get?.(`${scope.fileId}:${rootIdent}`);
  if (comp) {
    return {
      kind: 'local',
      symbol: rootIdent,
      functionId: comp.functionId,
      subkind: 'composable',
    };
  }

  const rx = index.vue.reactivity?.find?.(
    (r: any) => r.fileId === scope.fileId && r.name === rootIdent
  );
  if (rx) {
    return {
      kind: 'local',
      symbol: rootIdent,
      functionId: rx.functionId,
      subkind: rx.kind === 'computed' ? 'computed' : 'ref',
    };
  }

  const macro = index.vue.macros?.find?.(
    (m: any) => m.fileId === scope.fileId && m.name === rootIdent
  );
  if (macro) {
    return {
      kind: 'local',
      symbol: rootIdent,
      functionId: macro.functionId,
      subkind: 'function',
    };
  }

  return null;
}

export function resolvePropSourceChain(
  prop: ComponentProp,
  scope: Scope,
  index: ExistingIndex
): SourceChainItem[] {
  return parseSourceChain(prop.value, scope, index);
}

export function resolveEventHandlerChain(
  event: ComponentEvent,
  scope: Scope,
  index: ExistingIndex
): SourceChainItem[] {
  return parseSourceChain(event.handler, scope, index);
}

export default {
  parseSourceChain,
  serializeSourceChain,
  deserializeSourceChain,
  resolvePropSourceChain,
  resolveEventHandlerChain,
};
