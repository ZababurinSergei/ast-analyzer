// modes/impact.ts
import path from 'path';
import { parseFile, walk, getAllProjectFiles, resolveFilePath } from '../core/ast-parser.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../config.js';

/**
 * Анализирует зону влияния изменений: находит все файлы, использующие указанную сущность
 * @param targetFile Целевой файл, содержащий сущность
 * @param entityName Имя сущности (функция, класс, константа и т.д.)
 * @returns Отчет в формате Markdown со списком зависимых файлов
 */
export function runImpactAnalysis(targetFile: string, entityName: string): string {
  const targetAbsPath = path.resolve(targetFile);
  const targetRelKey = path.relative(process.cwd(), targetAbsPath);

  console.log(`🔍 Поиск использований "${entityName}" из "${targetRelKey}"...`);

  const allFiles = getAllProjectFiles(process.cwd(), [], DEFAULT_EXCLUDE_PATTERNS);
  const impacts: { file: string; usages: string[] }[] = [];

  for (const file of allFiles) {
    if (path.resolve(file) === targetAbsPath) continue;

    const ast = parseFile(file);
    if (!ast) continue;

    const fileRelKey = path.relative(process.cwd(), file);
    const currentDir = path.dirname(file);
    let isImported = false;
    let localImportName = entityName;

    // Первый проход: проверяем импорты
    walk(ast, {
      enter(node: any) {
        if (node.type === 'ImportDeclaration' && node.source) {
          const resolvedAbs = resolveFilePath(currentDir, node.source.value);
          if (resolvedAbs === targetAbsPath) {
            node.specifiers.forEach((spec: any) => {
              if (spec.type === 'ImportSpecifier' && spec.imported.name === entityName) {
                isImported = true;
                localImportName = spec.local.name;
              } else if (spec.type === 'ImportDefaultSpecifier' && entityName === 'default') {
                isImported = true;
                localImportName = spec.local.name;
              } else if (spec.type === 'ImportNamespaceSpecifier') {
                isImported = true;
                localImportName = spec.local.name;
              }
            });
          }
        }
      },
    });

    if (!isImported) continue;

    // Второй проход: находим места использования
    const affectedFunctions = new Set<string>();
    let currentFunctionName = 'Top-level (глобальный код)';

    walk(ast, {
      enter(node: any) {
        // Отслеживаем текущую функцию
        if ((node.type === 'FunctionDeclaration' || node.type === 'MethodDefinition') && node.id) {
          currentFunctionName = `function ${node.id.name}()`;
        } else if (
          node.type === 'VariableDeclarator' &&
          node.id &&
          node.id.name &&
          node.init &&
          ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init.type)
        ) {
          currentFunctionName = `arrow function ${node.id.name}()`;
        }

        // Проверяем использование импортированной сущности
        if (node.type === 'Identifier' && node.name === localImportName) {
          // Исключаем саму декларацию импорта
          if (
            node.parent &&
            !['ImportSpecifier', 'ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(
              node.parent.type
            )
          ) {
            affectedFunctions.add(currentFunctionName);
          }
        }
      },
      leave(node: any) {
        // Сбрасываем контекст при выходе из функции
        if (
          [
            'FunctionDeclaration',
            'ArrowFunctionExpression',
            'FunctionExpression',
            'MethodDefinition',
          ].includes(node.type)
        ) {
          currentFunctionName = 'Top-level (глобальный код)';
        }
      },
    });

    if (affectedFunctions.size > 0) {
      impacts.push({ file: fileRelKey, usages: Array.from(affectedFunctions) });
    }
  }

  // Формируем отчет
  let report = '# ⚠️ ОТЧЕТ ПО ЗОНЕ ВЛИЯНИЯ ИЗМЕНЕНИЙ\n\n';
  report += `**Цель:** Изменение/удаление сущности \`${entityName}\` в файле \`${targetRelKey}\`\n\n`;
  report += `**Дата анализа:** ${new Date().toLocaleString()}\n\n`;

  if (impacts.length === 0) {
    report += `✅ **Безопасно!** Не найдено внешних файлов, использующих \`${entityName}\`.\n`;
    report += '\n*Вы можете безопасно изменять или удалять эту сущность.*\n';
  } else {
    report += `🚨 **ОБНАРУЖЕНО ${impacts.length} ЗАВИСИМЫХ ФАЙЛОВ!**\n\n`;
    report += `Перед изменением \`${entityName}\` необходимо обновить следующие файлы:\n\n`;

    impacts.forEach((imp, i) => {
      report += `### ${i + 1}. \`${imp.file}\`\n`;
      report += '**Используется в:**\n';
      imp.usages.forEach(u => (report += `  - [ ] Внутри \`${u}\`\n`));
      report += '\n';
    });

    report += '\n## 💡 Рекомендации\n\n';
    report += '1. Проверьте каждый зависимый файл перед внесением изменений\n';
    report += '2. Обновите импорты или сигнатуры функций во всех указанных местах\n';
    report += '3. Запустите тесты после изменений\n';
  }

  return report;
}
