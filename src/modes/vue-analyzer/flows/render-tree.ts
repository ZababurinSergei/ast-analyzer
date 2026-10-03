// src/modes/vue-analyzer/flows/render-tree.ts
// ============================================================
// BUILD VUE RENDER TREE
// ============================================================
// Версия: 1.0.0
//
// Для каждого SFC строит плоский список узлов дерева рендера:
//   - HTML-элементы  (he1, he2, ...)   → kind: 'element'
//   - Компоненты     (cu1, cu2, ...)   → kind: 'component'
//   - Slots          (csl1, ...)       → kind: 'slot'
//
// parentId определяется через parentFileId (пока — fileId).
// conditionals — из componentDirectives[] (v-if/v-else/v-for).
// dependsOn.reactivityIds — через props/directives/interpolations.
//
// Симметрично `buildRenderTree` из React (react-analyzer/flows/render-tree.ts).
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ ДАННЫХ
// ════════════════════════════════════════════════════════════
//
//   1. vue.sfc[]                     — SFC с htmlElements[] и componentUsages[]
//   2. vue.componentDirectives[]     — v-if/v-else/v-for (глобальный список)
//   3. vue.componentProps[]          — props (обратные связи)
//   4. vue.componentSlots[]          — slots
//   5. vue.reactivity[]              — для сопоставления имён reactivity
//
// ════════════════════════════════════════════════════════════
// ОГРАНИЧЕНИЯ MVP
// ════════════════════════════════════════════════════════════
//
//   • parentId — пока = fileId (нет реального дерева parents).
//     Можно улучшить позже через htmlElements[].parentId (если есть).
//   • conditionals — из componentDirectives[], связанных через usageId.
//   • dependsOn.reactivityIds — эвристика по именам в props/interpolations.
//
// ════════════════════════════════════════════════════════════
// АЛГОРИТМ
// ════════════════════════════════════════════════════════════
//
//   Для каждого SFC sfc:
//
//     1. Для каждого htmlElements[] he:
//        создаём VueRenderNode {
//          elementId: he.id,
//          tagName: he.tag,
//          kind: 'element',
//          parentId: he.parentFileId ?? sfc.fileId,   // TODO: реальный parent
//          dependsOn: {
//            reactivityIds: [refs из he.props/interpolations, совпадающие с reactivity[].name],
//            propIds: [],
//          },
//          conditionals: [из he.directives[], если v-if/v-else/v-for],
//        }
//
//     2. Для каждого componentUsages[] cu:
//        создаём VueRenderNode {
//          elementId: cu.id,
//          tagName: cu.tag,
//          kind: 'component',
//          parentId: cu.parentFileId ?? sfc.fileId,
//          dependsOn: {
//            reactivityIds: [refs из cu.props, совпадающие с reactivity[].name],
//            propIds: [],
//          },
//          conditionals: [из cu.directives[], если v-if/v-else/v-for],
//        }
//
//     3. Для каждого componentSlots[] csl:
//        создаём VueRenderNode {
//          elementId: csl.id,
//          tagName: `<slot ${csl.slotName}>`,
//          kind: 'slot',
//          parentId: csl.usageId,  // slot принадлежит usageId
//          dependsOn: { reactivityIds: [], propIds: [] },
//          conditionals: [],
//        }
//
// ============================================================

import type { VueRenderNode } from '../types.js';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ТИПЫ
// ============================================================

/**
 * Минимальная форма HTML-элемента.
 */
export interface HtmlElementLike {
  id: string;
  parentFileId?: string;
  tag: string;
  line: number;
  column?: number;
  props?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    kind: string;
    line: number;
    identifier?: string | null;
  }>;
  events?: Array<{
    id: string;
    usageId: string;
    eventName: string;
    handler: string;
    line: number;
  }>;
  directives?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    modifiers?: string[];
    line: number;
  }>;
  interpolations?: Array<{
    id: string;
    usageId: string;
    expression: string;
    line: number;
  }>;
}

/**
 * Минимальная форма componentUsage.
 */
export interface ComponentUsageLike {
  id: string;
  parentFileId?: string;
  tag: string;
  line: number;
  column?: number;
  props?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    kind: string;
    line: number;
    identifier?: string | null;
  }>;
  events?: Array<{
    id: string;
    usageId: string;
    eventName: string;
    handler: string;
    line: number;
  }>;
  directives?: Array<{
    id: string;
    usageId: string;
    name: string;
    value: string;
    line: number;
  }>;
}

/**
 * Минимальная форма SFC.
 */
export interface SfcLike {
  fileId: string;
  moduleId: string;
  name: string;
  htmlElements?: HtmlElementLike[];
  componentUsages?: ComponentUsageLike[];
}

/**
 * Минимальная форма reactivity (для dependsOn).
 */
export interface ReactivityLike {
  id: string;
  name?: string;
}

/**
 * Минимальная форма componentSlot.
 */
export interface ComponentSlotLike {
  id: string;
  usageId: string;
  slotName: string;
  line: number;
}

/**
 * Минимальная форма VueSectionFull.
 */
export interface VueSectionLike {
  sfc?: SfcLike[];
  reactivity?: ReactivityLike[];
  componentSlots?: ComponentSlotLike[];
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит плоский список VueRenderNode[] из vue.sfc[].
 *
 * @param vue           — Vue-секция (sfc + reactivity + componentSlots)
 *
 * @returns VueRenderNode[]
 */
export function buildVueRenderTree(vue: VueSectionLike): VueRenderNode[] {
  const nodes: VueRenderNode[] = [];

  const sfcList = vue.sfc ?? [];
  const reactivity = vue.reactivity ?? [];

  if (sfcList.length === 0) {
    return nodes;
  }

  // ────────────────────────────────────────────────────────
  // Индекс reactivity по имени (для dependsOn)
  // ────────────────────────────────────────────────────────

  const reactivityIdByName = new Map<string, string>();
  for (const r of reactivity) {
    if (r.name) {
      reactivityIdByName.set(r.name, r.id);
    }
  }

  // ────────────────────────────────────────────────────────
  // Основной цикл по SFC
  // ────────────────────────────────────────────────────────

  for (const sfc of sfcList) {
    const defaultParentId = sfc.fileId;

    // 1. HTML-элементы
    for (const he of sfc.htmlElements ?? []) {
      const reactivityIds = collectReactivityIds(he, reactivityIdByName);
      const conditionals = collectConditionals(he.directives);

      nodes.push({
        elementId: he.id,
        tagName: he.tag,
        kind: 'element',
        parentId: he.parentFileId ?? defaultParentId,
        dependsOn: {
          reactivityIds,
          propIds: [],
        },
        conditionals,
      });
    }

    // 2. Компоненты
    for (const cu of sfc.componentUsages ?? []) {
      const reactivityIds = collectReactivityIds(cu, reactivityIdByName);
      const conditionals = collectConditionals(cu.directives);

      nodes.push({
        elementId: cu.id,
        tagName: cu.tag,
        kind: 'component',
        parentId: cu.parentFileId ?? defaultParentId,
        dependsOn: {
          reactivityIds,
          propIds: [],
        },
        conditionals,
      });
    }
  }

  // 3. Slots (из глобального списка componentSlots[])
  for (const csl of vue.componentSlots ?? []) {
    nodes.push({
      elementId: csl.id,
      tagName: `<slot name="${csl.slotName}">`,
      kind: 'slot',
      parentId: csl.usageId, // slot принадлежит usageId (cu или he)
      dependsOn: {
        reactivityIds: [],
        propIds: [],
      },
      conditionals: [],
    });
  }

  return nodes;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Извлекает ID reactivity, используемые в props/interpolations.
 *
 * ⚠️ Эвристика: имя считается reactivity, если оно есть в reactivityByName.
 */
function collectReactivityIds(
  element: {
    props?: Array<{ identifier?: string | null; value?: string }>;
    interpolations?: Array<{ expression?: string }>;
  },
  reactivityIdByName: Map<string, string>
): string[] {
  const ids = new Set<string>();

  // 1. Props: identifier и value
  for (const p of element.props ?? []) {
    if (p.identifier) {
      const id = reactivityIdByName.get(p.identifier);
      if (id) ids.add(id);
    }
    if (p.value) {
      // Ищем root-идентификаторы в value
      const roots = extractRootIdentifiers(p.value);
      for (const root of roots) {
        const id = reactivityIdByName.get(root);
        if (id) ids.add(id);
      }
    }
  }

  // 2. Interpolations: expression
  for (const interp of element.interpolations ?? []) {
    if (interp.expression) {
      const roots = extractRootIdentifiers(interp.expression);
      for (const root of roots) {
        const id = reactivityIdByName.get(root);
        if (id) ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Извлекает conditionals из списка директив.
 *
 * v-if, v-else-if, v-else → 'v-if' | 'v-else-if' | 'v-else'
 * v-for → 'v-for'
 */
function collectConditionals(
  directives: Array<{ name: string; value: string }> | undefined
): VueRenderNode['conditionals'] {
  const result: VueRenderNode['conditionals'] = [];

  for (const d of directives ?? []) {
    let kind: VueRenderNode['conditionals'][0]['kind'] | null = null;

    if (d.name === 'v-if') kind = 'v-if';
    else if (d.name === 'v-else-if') kind = 'v-else-if';
    else if (d.name === 'v-else') kind = 'v-else';
    else if (d.name === 'v-for') kind = 'v-for';

    if (!kind) continue;

    const refs = extractRootIdentifiers(d.value || '');

    result.push({
      kind,
      condition: d.value || '',
      refs,
    });
  }

  return result;
}

/**
 * Извлекает root-идентификаторы из выражения.
 *
 * Примеры:
 *   "isOpen"              → ['isOpen']
 *   "isOpen && user"      → ['isOpen', 'user']
 *   "user.name"           → ['user']
 *   "items.filter(x)"     → ['items', 'filter', 'x']  — но отфильтровано по ключевым словам
 *   "item in items"       → ['item', 'items']
 *
 * ⚠️ Логика повторяет extractRootIdentifiers из template.ts.
 */
function extractRootIdentifiers(expr: string): string[] {
  if (!expr) return [];

  const result = new Set<string>();

  // Ключевые слова и встроенные операторы
  const KEYWORDS = new Set([
    'if',
    'else',
    'for',
    'while',
    'switch',
    'return',
    'typeof',
    'new',
    'function',
    'in',
    'of',
    'true',
    'false',
    'null',
    'undefined',
    'this',
    'await',
    'async',
    'let',
    'const',
    'var',
  ]);

  // Простой regex по идентификаторам
  const regex = /\b([A-Za-z_$][\w$]*)\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(expr)) !== null) {
    const name = match[1];
    if (!name) continue;
    if (KEYWORDS.has(name)) continue;
    result.add(name);
  }

  return Array.from(result);
}
