// src/core/vue-sfc-extractor.ts
// ============================================================
// VUE SFC EXTRACTOR
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `SyntaxKind`
//     (TS6133: 'SyntaxKind' is declared but its value is never read)
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Извлекает РЕАЛЬНЫЕ имена props/emits/exposed из <script setup>.
//   - Замена плейсхолдеров #0, #1, ... на реальные имена.
// ============================================================

import { Project, Node } from 'ts-morph';

export interface SFCNames {
  props: string[];
  emits: string[];
  exposed: string[];
}

export function extractSFCNames(scriptContent: string, virtualPath: string): SFCNames {
  const result: SFCNames = { props: [], emits: [], exposed: [] };
  if (!scriptContent.trim()) return result;

  const project = new Project({
    compilerOptions: { target: 99, module: 99, allowJs: true, skipLibCheck: true },
    useInMemoryFileSystem: true,
  });
  const sf = project.createSourceFile(virtualPath, scriptContent, { overwrite: true });

  // defineProps<{ ... }>() или defineProps([...])
  for (const call of findCalls(sf, 'defineProps')) {
    const typeArgs = call.getTypeArguments?.() || [];
    if (typeArgs.length > 0) {
      const typeArg = typeArgs[0];
      if (typeArg && Node.isTypeLiteral(typeArg)) {
        for (const member of typeArg.getMembers()) {
          if (Node.isPropertySignature(member)) {
            const name = member.getName();
            if (name) result.props.push(name);
          }
        }
      }
    }
    const arg = call.getArguments?.()[0];
    if (arg && Node.isArrayLiteralExpression(arg)) {
      for (const el of arg.getElements()) {
        const name = el.getText().replace(/['"]/g, '');
        if (name) result.props.push(name);
      }
    }
  }

  // defineEmits<{ ... }>() или defineEmits([...])
  for (const call of findCalls(sf, 'defineEmits')) {
    const typeArgs = call.getTypeArguments?.() || [];
    if (typeArgs.length > 0) {
      const typeArg = typeArgs[0];
      if (typeArg && Node.isTypeLiteral(typeArg)) {
        for (const member of typeArg.getMembers()) {
          if (Node.isPropertySignature(member) || Node.isMethodSignature(member)) {
            const name = member.getName();
            if (name) result.emits.push(name);
          }
        }
      }
    }
    const arg = call.getArguments?.()[0];
    if (arg && Node.isArrayLiteralExpression(arg)) {
      for (const el of arg.getElements()) {
        const name = el.getText().replace(/['"]/g, '');
        if (name) result.emits.push(name);
      }
    }
  }

  // defineExpose({ ... })
  for (const call of findCalls(sf, 'defineExpose')) {
    const arg = call.getArguments?.()[0];
    if (arg && Node.isObjectLiteralExpression(arg)) {
      for (const prop of arg.getProperties()) {
        if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
          const name = prop.getName?.();
          if (name) result.exposed.push(name);
        }
      }
    }
  }

  // Дедупликация
  result.props = [...new Set(result.props)];
  result.emits = [...new Set(result.emits)];
  result.exposed = [...new Set(result.exposed)];

  return result;
}

function findCalls(sf: any, name: string): any[] {
  const result: any[] = [];
  sf.forEachDescendant((node: any) => {
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isIdentifier(expr) && expr.getText() === name) {
        result.push(node);
      }
    }
  });
  return result;
}

export default { extractSFCNames };
