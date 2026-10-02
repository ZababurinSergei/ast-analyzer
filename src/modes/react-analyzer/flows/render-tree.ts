// src/modes/react-analyzer/flows/render-tree.ts
// ============================================================
// BUILD RENDER TREE
// ============================================================
// Версия: 1.0.0
//
// Плоский список узлов с parentId.
// dependsOn.stateIds — hooks, чьи stateName в attrs[].refs.
// ============================================================

import type {
  ReactRenderNode,
  JsxElementEntity,
  ReactHookEntity,
} from '../../../core/react-entity-classifier.js';

export function buildRenderTree(
  jsxElements: JsxElementEntity[],
  hooks: ReactHookEntity[]
): ReactRenderNode[] {
  const nodes: ReactRenderNode[] = [];

  for (const el of jsxElements) {
    // Какие state используются
    const stateIds: string[] = [];
    for (const h of hooks) {
      if (!h.stateName) continue;
      let found = false;
      for (const attr of el.attrs ?? []) {
        if (attr.refs?.includes(h.stateName)) {
          stateIds.push(h.id);
          found = true;
          break;
        }
      }
      if (!found && el.expressionRefs?.includes(h.stateName)) {
        stateIds.push(h.id);
      }
    }

    nodes.push({
      elementId: el.id,
      tagName: el.tagName,
      kind: el.kind === 'component' ? 'component' : el.kind === 'fragment' ? 'fragment' : 'element',
      parentId: el.parentElementId,
      dependsOn: {
        stateIds,
        propIds: [],
        contextIds: [],
      },
      conditionals: [],
    });
  }

  return nodes;
}
