// src/modes/vue-analyzer/template.ts

import type { SFCDescriptor } from '@vue/compiler-sfc';
import type { VueComponentAnalysis, AnalysisOptions } from './types.js';

/**
 * Анализ template
 */
export function analyzeTemplate(
  descriptor: SFCDescriptor,
  options: AnalysisOptions
): VueComponentAnalysis['template'] {
  const result: VueComponentAnalysis['template'] = {
    content: null,
    ast: null,
    complexity: 0,
    rootElements: [],
    slots: [],
    directives: [],
    events: [],
  };

  if (!descriptor.template) return result;

  result.content = descriptor.template.content;

  // 1. АНАЛИЗ ЧЕРЕЗ AST (если доступен)
  if (options.includeTemplateAST && descriptor.template.ast) {
    result.ast = descriptor.template.ast;

    function traverseVueAST(node: any, parent?: any) {
      if (!node) return;

      result.complexity++;

      const isElement = node.type === 1;
      const isRoot = node.type === 0;
      const isIf = node.type === 3;
      const isFor = node.type === 11;
      const isText = node.type === 2;

      if (isRoot && node.children) {
        node.children.forEach((child: any) => traverseVueAST(child, node));
        return;
      }

      if (isText) {
        return;
      }

      if (isElement && node.tag) {
        if (!parent || (parent && parent.type === 0)) {
          result.rootElements.push(node.tag);
        }

        if (node.tag === 'slot') {
          let slotName = 'default';
          if (node.props) {
            for (const prop of node.props) {
              if (prop.type === 6) {
                if (prop.name === 'name' && prop.value) {
                  slotName = prop.value.content;
                }
              }
            }
          }
          result.slots.push(slotName);
        }

        if (node.props) {
          for (const prop of node.props) {
            if (prop.type === 7) {
              const fullName = prop.rawName || '';

              if (fullName) {
                const directiveName = fullName.split(':')[0];
                if (directiveName && !result.directives.includes(directiveName)) {
                  result.directives.push(directiveName);
                }

                if (directiveName === 'v-on' && prop.arg) {
                  const eventName =
                    typeof prop.arg === 'string' ? prop.arg : prop.arg?.content || '';
                  if (eventName && !result.events.includes(eventName)) {
                    result.events.push(eventName);
                  }
                }

                if (fullName.startsWith('@')) {
                  const eventName = fullName.slice(1);
                  if (eventName && !result.events.includes(eventName)) {
                    result.events.push(eventName);
                  }
                }
              }
            } else if (prop.type === 6) {
              const attrName = prop.name;

              if (attrName && attrName.startsWith('@')) {
                const eventName = attrName.slice(1);
                if (eventName && !result.events.includes(eventName)) {
                  result.events.push(eventName);
                }
              }

              if (attrName && attrName.startsWith('on') && attrName !== 'on') {
                const eventName = attrName.slice(2);
                if (eventName && !result.events.includes(eventName)) {
                  result.events.push(eventName);
                }
              }
            }
          }
        }
      }

      if (isIf) {
        if (!result.directives.includes('v-if')) {
          result.directives.push('v-if');
        }
        if (node.children) {
          node.children.forEach((child: any) => traverseVueAST(child, node));
        }
      }

      if (isFor) {
        if (!result.directives.includes('v-for')) {
          result.directives.push('v-for');
        }
        if (node.children) {
          node.children.forEach((child: any) => traverseVueAST(child, node));
        }
      }

      if (node.children) {
        node.children.forEach((child: any) => traverseVueAST(child, node));
      }
    }

    traverseVueAST(descriptor.template.ast);

    result.rootElements = [...new Set(result.rootElements)];
    result.slots = [...new Set(result.slots)];
    result.directives = [...new Set(result.directives)];
    result.events = [...new Set(result.events)];
  }

  // 2. FALLBACK: анализ через регулярные выражения
  const templateText = result.content || '';

  // Извлекаем слоты
  const slotRegex = /<slot\s+(?:name=[\"']([^\"']+)[\"'])?\s*\/?>/g;
  let slotMatch;
  while ((slotMatch = slotRegex.exec(templateText)) !== null) {
    const slotName = slotMatch[1] || 'default';
    if (!result.slots.includes(slotName)) {
      result.slots.push(slotName);
    }
  }

  // Извлекаем корневые элементы
  if (result.rootElements.length === 0) {
    const cleanTemplate = templateText.trim();
    const rootTagMatches = cleanTemplate.match(/^<(\w+)/);
    if (rootTagMatches && rootTagMatches[1]) {
      result.rootElements.push(rootTagMatches[1]);
    }
    const fragmentMatch = cleanTemplate.match(/^<>\s*([\s\S]*)\s*<\/>/);
    if (fragmentMatch) {
      const innerContent = fragmentMatch[1];
      if (innerContent) {
        const innerTags = innerContent.match(/<(\w+)/g);
        if (innerTags) {
          for (const tag of innerTags) {
            const tagName = tag.slice(1);
            if (tagName && !result.rootElements.includes(tagName)) {
              result.rootElements.push(tagName);
            }
          }
        }
      }
    }
  }

  // Извлекаем директивы
  if (result.directives.length === 0) {
    const directivePatterns: Record<string, RegExp> = {
      'v-if': /v-if/g,
      'v-for': /v-for/g,
      'v-on': /v-on/g,
      'v-model': /v-model/g,
      'v-bind': /v-bind/g,
      'v-show': /v-show/g,
      'v-else': /v-else/g,
      'v-else-if': /v-else-if/g,
    };

    for (const [directive, pattern] of Object.entries(directivePatterns)) {
      pattern.lastIndex = 0;
      if (pattern.test(templateText)) {
        if (!result.directives.includes(directive)) {
          result.directives.push(directive);
        }
      }
    }

    if (/@\w+/.test(templateText) && !result.directives.includes('v-on')) {
      result.directives.push('v-on');
    }
    if (/:\\w+/.test(templateText) && !result.directives.includes('v-bind')) {
      result.directives.push('v-bind');
    }
  }

  // Извлекаем события
  if (result.events.length === 0) {
    const eventRegex = /@(\w+)/g;
    let eventMatch;
    while ((eventMatch = eventRegex.exec(templateText)) !== null) {
      const eventName = eventMatch[1];
      if (eventName && !result.events.includes(eventName)) {
        result.events.push(eventName);
      }
    }

    const vOnRegex = /v-on:(\w+)/g;
    let vOnMatch;
    while ((vOnMatch = vOnRegex.exec(templateText)) !== null) {
      const eventName = vOnMatch[1];
      if (eventName && !result.events.includes(eventName)) {
        result.events.push(eventName);
      }
    }

    const onEventRegex = /\s+on(\w+)=/g;
    let onMatch;
    while ((onMatch = onEventRegex.exec(templateText)) !== null) {
      const eventName = onMatch[1];
      if (eventName && !result.events.includes(eventName)) {
        result.events.push(eventName);
      }
    }
  }

  // Вычисляем сложность
  if (result.complexity === 0) {
    const tagMatches = templateText.match(/<[^>]+>/g);
    const expressionMatches = templateText.match(/\{\{[^}]*\}\}/g);
    result.complexity = (tagMatches?.length || 0) + (expressionMatches?.length || 0);
  }

  result.rootElements = [...new Set(result.rootElements)];
  result.slots = [...new Set(result.slots)];
  result.directives = [...new Set(result.directives)];
  result.events = [...new Set(result.events)];

  return result;
}