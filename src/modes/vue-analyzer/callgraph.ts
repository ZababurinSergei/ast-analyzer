// src/modes/vue-analyzer/callgraph.ts

import type { VueComponentAnalysis } from './types.js';

/**
 * Построение графа вызовов
 */
export function buildCallGraphFromScript(
  content: string,
  functions: VueComponentAnalysis['functions'],
  composables: VueComponentAnalysis['composables']
): Record<string, string[]> {
  const callGraph: Record<string, string[]> = {};

  if (!content || content.trim() === '') {
    return callGraph;
  }

  const allNames = [
    ...functions.map(f => f.name),
    ...composables.map(c => c.name),
  ];

  // Инициализируем callGraph для всех функций
  for (const name of allNames) {
    if (name) {
      callGraph[name] = [];
    }
  }

  // Разбиваем код на строки
  const lines = content.split('\n');

  // Строим карту: имя функции -> диапазон строк, где она определена
  const functionRanges: Record<string, { startLine: number; endLine: number }> = {};

  // Проходим по всем функциям и определяем их диапазон строк
  for (const func of functions) {
    const funcName = func.name;
    if (!funcName) continue;

    // Ищем строку с объявлением функции
    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Проверяем объявление функции
      if (
        line.includes(`function ${funcName}(`) ||
        line.includes(`function ${funcName} (`) ||
        line.includes(`const ${funcName} =`) ||
        line.includes(`let ${funcName} =`)
      ) {
        startLine = i;

        // Ищем конец функции (закрывающую скобку)
        let braceCount = 0;
        let foundOpenBrace = false;

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          if (!currentLine) continue;

          // Считаем открывающие и закрывающие скобки
          for (let k = 0; k < currentLine.length; k++) {
            const char = currentLine[k];
            if (char === '{') {
              braceCount++;
              foundOpenBrace = true;
            } else if (char === '}') {
              braceCount--;
              if (foundOpenBrace && braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          if (endLine !== -1) break;
        }

        // Если не нашли конец, используем приблизительный диапазон
        if (endLine === -1) {
          endLine = Math.min(startLine + 20, lines.length - 1);
        }

        break;
      }
    }

    // Если нашли диапазон, сохраняем его
    if (startLine !== -1 && endLine !== -1) {
      functionRanges[funcName] = { startLine, endLine };
    }
  }

  // Для каждой функции ищем вызовы внутри ее диапазона
  for (const func of functions) {
    const funcName = func.name;
    if (!funcName) continue;

    // Убеждаемся, что массив существует
    if (!callGraph[funcName]) {
      callGraph[funcName] = [];
    }

    const range = functionRanges[funcName];
    if (!range) continue;

    // Проверяем строки внутри диапазона функции
    for (let i = range.startLine + 1; i <= range.endLine && i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Ищем вызовы в строке
      for (const calledName of allNames) {
        if (!calledName || calledName === funcName) continue;

        // Проверяем, есть ли вызов в строке
        const callPattern = `${calledName}(`;
        if (line.includes(callPattern)) {
          // Проверяем, не является ли это объявлением
          const trimmedLine = line.trim();
          if (
            !trimmedLine.startsWith('function') &&
            !trimmedLine.startsWith('const') &&
            !trimmedLine.startsWith('let') &&
            !trimmedLine.startsWith('export')
          ) {
            if (!callGraph[funcName].includes(calledName)) {
              callGraph[funcName].push(calledName);
            }
          }
        }
      }
    }
  }

  return callGraph;
}