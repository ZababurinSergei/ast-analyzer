// modes/dead-code.ts
import path from 'path';
import { parseFile, walk, getAllProjectFiles, resolveFilePath } from '../core/ast-parser.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../config.js';

/**
 * Находит неиспользуемый код в указанном файле
 * @param targetFile Путь к целевому файлу
 * @returns Markdown отчет с мертвым кодом
 */
export function findDeadCode(targetFile: string): string | null {
  const targetAbsPath = path.resolve(targetFile);
  const targetRelKey = path.relative(process.cwd(), targetAbsPath);
  const ast = parseFile(targetAbsPath);
  if (!ast) return null;

  const declaredLocals: Record<string, any> = {};
  const declaredExports: Record<string, any> = {};
  const usedIdentifiers = new Set<string>();

  // Сбор объявленных сущностей
  ast.body.forEach((node: any) => {
    let isExport = false;
    let targetNode = node;

    if (node.type === 'ExportNamedDeclaration') {
      isExport = true;
      targetNode = node.declaration;
    } else if (node.type === 'ExportDefaultDeclaration') {
      isExport = true;
      targetNode = node.declaration;
      if (targetNode && targetNode.id) declaredExports['default'] = targetNode;
    }

    if (!targetNode) return;
    const collection = isExport ? declaredExports : declaredLocals;

    if (targetNode.type === 'FunctionDeclaration' && targetNode.id) {
      collection[targetNode.id.name] = targetNode;
    } else if (targetNode.type === 'VariableDeclaration') {
      targetNode.declarations.forEach((decl: any) => {
        if (decl.id && decl.id.name) {
          collection[decl.id.name] = decl;
        }
      });
    } else if (targetNode.type === 'ClassDeclaration' && targetNode.id) {
      collection[targetNode.id.name] = targetNode;
    }
  });

  // Сбор использованных идентификаторов
  walk(ast, {
    enter(node: any) {
      if (node.type === 'Identifier') {
        const parentType = node.parent?.type || '';
        const isDeclaration =
          (parentType === 'FunctionDeclaration' && node.parent?.id === node) ||
          (parentType === 'ClassDeclaration' && node.parent?.id === node) ||
          (parentType === 'VariableDeclarator' && node.parent?.id === node) ||
          parentType === 'ImportSpecifier' ||
          parentType === 'ImportDefaultSpecifier';

        if (!isDeclaration) {
          usedIdentifiers.add(node.name);
        }
      }
    },
  });

  // Поиск неиспользуемых локальных переменных
  const deadLocals = Object.keys(declaredLocals).filter(name => !usedIdentifiers.has(name));

  // Поиск неиспользуемых экспортов
  const deadExports: string[] = [];
  const allProjectFiles = getAllProjectFiles(process.cwd(), [], DEFAULT_EXCLUDE_PATTERNS);

  for (const [exportName] of Object.entries(declaredExports)) {
    if (exportName === 'default') continue;

    let hasExternalUsage = false;
    for (const file of allProjectFiles) {
      if (path.resolve(file) === targetAbsPath) continue;

      const projectAst = parseFile(file);
      if (!projectAst) continue;

      const currentDir = path.dirname(file);

      walk(projectAst, {
        enter(node: any) {
          if (node.type === 'ImportDeclaration' && node.source) {
            const resolvedAbs = resolveFilePath(currentDir, node.source.value);
            if (resolvedAbs === targetAbsPath) {
              node.specifiers.forEach((spec: any) => {
                if (spec.type === 'ImportSpecifier' && spec.imported.name === exportName) {
                  hasExternalUsage = true;
                }
              });
            }
          }
        },
      });

      if (hasExternalUsage) break;
    }

    if (!hasExternalUsage) deadExports.push(exportName);
  }

  // Формирование отчета
  let report = '# 🗑️ ОТЧЕТ ПО НЕИСПОЛЬЗУЕМОМУ КОДУ\n\n';
  report += `**Анализируемый файл:** \`${targetRelKey}\`\n\n`;

  if (deadLocals.length === 0 && deadExports.length === 0) {
    report += '✨ **Отлично!** Мертвый код не обнаружен.\n';
  } else {
    if (deadLocals.length > 0) {
      report += '## 🚫 Внутренний мертвый код\n';
      report += '*Локальные сущности, объявленные, но не используемые в файле:*\n\n';
      deadLocals.forEach(name => (report += `  - [ ] \`${name}\`\n`));
      report += '\n';
    }

    if (deadExports.length > 0) {
      report += '## 📦 Бесполезные экспорты\n';
      report += '*Экспортируются, но не импортируются нигде в проекте:*\n\n';
      deadExports.forEach(name => (report += `  - [ ] \`export ${name}\`\n`));
      report += '\n';
    }
  }

  return report;
}
