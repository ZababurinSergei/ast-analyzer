// modes/split-module.ts
import fs from 'fs';
import path from 'path';
import { parseFile, walk } from '../core/ast-parser.js';
import { minifyForAI } from '../core/minifier.js';
import { buildFileInternalGraph } from './file-graph.js';
import { findCyclicEdges } from '../core/graph-utils.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../config.js';
import { analyzeVueComponent, generateVueComponentReport } from './vue-analyzer.js';

// ==========================================
// ВНУТРЕННИЕ ФУНКЦИИ
// ==========================================

/**
 * Анализирует структуру модуля: экспорты, импорты, функции, классы и граф вызовов
 */
function analyzeModuleStructure(
  filePath: string,
  options: { maxDepth?: number; excludePatterns?: string[] } = {}
) {
  const { maxDepth = 5, excludePatterns = DEFAULT_EXCLUDE_PATTERNS } = options;

  // Проверка на исключение
  for (const pattern of excludePatterns) {
    if (filePath.includes(pattern)) {
      console.log(`⏭️ Пропуск файла по паттерну: ${pattern}`);
      return null;
    }
  }

  const ast = parseFile(filePath);
  if (!ast) return null;

  const code = fs.readFileSync(filePath, 'utf-8');
  const lines = code.split('\n');

  const exports: any[] = [];
  const imports: any[] = [];
  const functions: any[] = [];
  const classes: any[] = [];
  const constants: any[] = [];
  const interfaces: any[] = [];
  const types: any[] = [];
  const callGraph: Record<string, string[]> = {};
  let currentFunction: string | null = null;
  let currentDepth = 0;

  walk(ast, {
    enter(node: any) {
      // Сбор импортов
      if (node.type === 'ImportDeclaration' && node.source) {
        const specifiers = node.specifiers.map((spec: any) => ({
          local: spec.local.name,
          imported:
            spec.type === 'ImportSpecifier'
              ? spec.imported.name
              : spec.type === 'ImportDefaultSpecifier'
                ? 'default'
                : '*',
          type: spec.type,
        }));
        imports.push({
          source: node.source.value,
          specifiers,
          loc: node.loc,
        });
      }

      // Сбор экспортов
      if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        const decl = node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            type: 'function',
            loc: decl.loc,
            params: decl.params.map((p: any) => p.name || 'unknown'),
            async: decl.async || false,
            startLine: decl.loc.start.line,
            endLine: decl.loc.end.line,
          });
        } else if (decl.type === 'ClassDeclaration' && decl.id) {
          exports.push({
            name: decl.id.name,
            type: 'class',
            loc: decl.loc,
            startLine: decl.loc.start.line,
            endLine: decl.loc.end.line,
          });
        } else if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((declarator: any) => {
            if (declarator.id && declarator.id.name) {
              exports.push({
                name: declarator.id.name,
                type: 'constant',
                loc: declarator.loc,
                startLine: declarator.loc.start.line,
                endLine: declarator.loc.end.line,
              });
            }
          });
        }
      }

      if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
        const name = node.declaration.id?.name || 'default';
        exports.push({
          name: `default${name !== 'default' ? ` as ${name}` : ''}`,
          type:
            node.declaration.type === 'FunctionDeclaration'
              ? 'function'
              : node.declaration.type === 'ClassDeclaration'
                ? 'class'
                : 'value',
          isDefault: true,
          loc: node.loc,
        });
      }

      // Сбор функций
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
        functions.push({
          name: node.id.name,
          type: 'function',
          exported: exports.some((e: any) => e.name === node.id.name),
          loc: node.loc,
          params: node.params.map((p: any) => p.name || 'unknown'),
          async: node.async || false,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
        });
        currentFunction = node.id.name;
        currentDepth = 0;
        if (currentFunction) {
          callGraph[currentFunction] = [];
        }
      }

      // Сбор классов
      if (node.type === 'ClassDeclaration' && node.id) {
        classes.push({
          name: node.id.name,
          exported: exports.some((e: any) => e.name === node.id.name),
          loc: node.loc,
          methods: [],
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
        });
      }

      // Сбор методов классов
      if (node.type === 'MethodDefinition' && node.key && node.parent?.parent?.id) {
        const className = node.parent.parent.id.name;
        const methodName = node.key.name;
        const classObj = classes.find((c: any) => c.name === className);
        if (classObj) {
          classObj.methods.push({
            name: methodName,
            kind: node.kind,
            static: node.static || false,
            loc: node.loc,
          });
        }
      }

      // Сбор констант
      if (
        node.type === 'VariableDeclaration' &&
        node.parent?.type === 'Program' &&
        !node.declarations.some((d: any) => exports.some((e: any) => e.name === d.id?.name))
      ) {
        node.declarations.forEach((decl: any) => {
          if (decl.id && decl.id.name) {
            constants.push({
              name: decl.id.name,
              type: 'constant',
              loc: decl.loc,
              startLine: decl.loc.start.line,
              endLine: decl.loc.end.line,
            });
          }
        });
      }

      // Сбор интерфейсов
      if (node.type === 'TSInterfaceDeclaration' && node.id) {
        interfaces.push({
          name: node.id.name,
          exported: exports.some((e: any) => e.name === node.id.name),
          loc: node.loc,
          members: node.body?.body?.length || 0,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
        });
      }

      // Сбор типов
      if (node.type === 'TSTypeAliasDeclaration' && node.id) {
        types.push({
          name: node.id.name,
          exported: exports.some((e: any) => e.name === node.id.name),
          loc: node.loc,
        });
      }

      // Анализ вызовов с ограничением глубины
      if (
        currentFunction &&
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        currentDepth < maxDepth
      ) {
        const calledFunction = node.callee.name;
        const currentCalls = callGraph[currentFunction];
        if (currentCalls && !currentCalls.includes(calledFunction)) {
          currentCalls.push(calledFunction);
        }
      }
    },
    leave(node: any) {
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
        currentFunction = null;
        currentDepth = 0;
      }
    },
  });

  // Статистика
  const stats = {
    totalLines: lines.length,
    totalExports: exports.length,
    totalFunctions: functions.length,
    totalClasses: classes.length,
    totalConstants: constants.length,
    totalInterfaces: interfaces.length,
    totalTypes: types.length,
    totalImports: imports.length,
  };

  return {
    filePath,
    fileName: path.basename(filePath),
    stats,
    imports,
    exports,
    functions,
    classes,
    constants,
    interfaces,
    types,
    callGraph,
    fullCode: code,
    lines,
  };
}

/**
 * Идентифицирует кластеры функций на основе графа вызовов
 */
function identifyClusters(
  functions: any[],
  callGraph: Record<string, string[]>,
  exports: any[],
  options: { targetClusterSize?: number; maxClusterSize?: number } = {}
) {
  const { targetClusterSize = 3, maxClusterSize = 10 } = options;

  const clusters: any[] = [];
  const processed = new Set();

  // Подсчет частоты вызовов
  const callFrequency: Record<string, number> = {};
  for (const [, callees] of Object.entries(callGraph)) {
    for (const callee of callees) {
      callFrequency[callee] = (callFrequency[callee] || 0) + 1;
    }
  }

  // Сортировка по важности
  const sortedFunctions = [...functions].sort((a, b) => {
    const aScore = (a.exported ? 100 : 0) + (callFrequency[a.name] || 0);
    const bScore = (b.exported ? 100 : 0) + (callFrequency[b.name] || 0);
    return bScore - aScore;
  });

  for (const func of sortedFunctions) {
    if (processed.has(func.name)) continue;

    const cluster: {
      name: string;
      functions: string[];
      isExported: boolean;
      dependencies: string[];
      importers: string[];
      cohesionScore: number;
      type?: 'core' | 'helper';
      size?: number;
      recommendation?: string;
    } = {
      name: `${func.name}Cluster`,
      functions: [func.name],
      isExported: func.exported,
      dependencies: [...(callGraph[func.name] || [])],
      importers: [],
      cohesionScore: 0,
    };

    // BFS для сбора связанных функций
    const queue = [func.name];
    while (queue.length > 0 && cluster.functions.length < maxClusterSize) {
      const current = queue.shift();
      if (!current || processed.has(current)) continue;
      processed.add(current);

      const calls = callGraph[current] || [];
      for (const call of calls) {
        if (!cluster.functions.includes(call) && functions.some((f: any) => f.name === call)) {
          cluster.functions.push(call);
          if (cluster.functions.length < maxClusterSize) {
            queue.push(call);
          }
          const callDeps = callGraph[call] || [];
          cluster.dependencies.push(...callDeps);
        }
      }
    }

    if (cluster.functions.length > 0) {
      // Вычисление связности
      const internalCalls = cluster.functions.reduce((count, fn) => {
        const calls = callGraph[fn] || [];
        return count + calls.filter((c: string) => cluster.functions.includes(c)).length;
      }, 0);
      const totalPossible = cluster.functions.length * (cluster.functions.length - 1);
      cluster.cohesionScore = totalPossible > 0 ? (internalCalls / totalPossible) * 100 : 0;

      // Определение типа
      const hasExport = cluster.functions.some((f: string) =>
        exports.some((e: any) => e.name === f)
      );
      cluster.type = hasExport ? 'core' : 'helper';
      cluster.size = cluster.functions.length;

      // Рекомендация по размеру
      if (cluster.size < targetClusterSize) {
        cluster.recommendation = '⚠️ Слишком маленький кластер. Рассмотрите объединение с другим.';
      } else if (cluster.size > maxClusterSize) {
        cluster.recommendation = '⚠️ Слишком большой кластер. Рекомендуется разбить дальше.';
      } else {
        cluster.recommendation = '✅ Оптимальный размер для модуля.';
      }

      clusters.push(cluster);
    }
  }

  // Сортировка по связности
  clusters.sort((a, b) => {
    if (a.cohesionScore !== b.cohesionScore) return b.cohesionScore - a.cohesionScore;
    return b.size - a.size;
  });

  return clusters;
}

// ==========================================
// ОСНОВНАЯ ЭКСПОРТИРУЕМАЯ ФУНКЦИЯ
// ==========================================

/**
 * Создает промпт для разбиения файла на модули
 */
export function buildSplitModulePrompt(targetFile: string, options: any = {}) {
  const {
    outputFile = 'ai-split-module-prompt.md',
    includeFullCode = true,
    includeMinified = true,
    includeGraph = true,
    includeStats = true,
    includeSuggestions = true,
    includeVueAnalysis = true,
    targetClusterSize = 3,
    maxClusterSize = 10,
    maxDepth = 5,
    excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    prefix = '',
  } = options;

  console.log(`\n🔪 Анализ файла для разбиения на модули: ${targetFile}`);
  console.log(`📏 Целевой размер кластера: ${targetClusterSize}`);
  console.log(`📏 Максимальный размер кластера: ${maxClusterSize}`);
  console.log(`🔍 Глубина анализа: ${maxDepth}`);
  console.log(`🚫 Паттерны исключения: ${excludePatterns.join(', ')}`);
  if (prefix) console.log(`📛 Префикс файлов: ${prefix}`);

  // Vue специфичный анализ
  let vueAnalysis = null;
  if (targetFile.endsWith('.vue') && includeVueAnalysis) {
    vueAnalysis = analyzeVueComponent(targetFile, {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
    });

    if (vueAnalysis) {
      console.log('\n🎯 Vue компонент обнаружен:');
      console.log(`   📥 Props: ${vueAnalysis.props.names.length}`);
      console.log(`   📤 Events: ${vueAnalysis.emits.names.length}`);
      console.log(`   🎭 Slots: ${vueAnalysis.slots.length}`);
      console.log(`   🧩 Composables: ${vueAnalysis.composables.length}`);
      console.log(`   🏗️ Template сложность: ${vueAnalysis.template.complexity}`);
    }
  }

  // Анализ структуры
  const analysis = analyzeModuleStructure(targetFile, { maxDepth, excludePatterns });
  if (!analysis) {
    console.error('❌ Не удалось проанализировать файл');
    return null;
  }

  // Построение внутреннего графа
  const internalGraph = buildFileInternalGraph(targetFile, { maxDepth });

  // Поиск циклических зависимостей
  const cyclicEdges = internalGraph ? findCyclicEdges(internalGraph.graph) : new Set();

  // Идентификация кластеров
  const clusters = identifyClusters(analysis.functions, analysis.callGraph, analysis.exports, {
    targetClusterSize,
    maxClusterSize,
  });

  // Сжатая версия
  const minified = minifyForAI(targetFile);

  // Имена выходных файлов с префиксом
  const outputFiles = {
    prompt: prefix ? `${prefix}-${outputFile}` : outputFile,
    context: prefix ? `${prefix}-ai-context.txt` : 'ai-context.txt',
    graph: prefix ? `${prefix}-internal-graph.json` : 'internal-graph.json',
    analysis: prefix ? `${prefix}-module-analysis.json` : 'module-analysis.json',
    vue: prefix && vueAnalysis ? `${prefix}-vue-analysis.json` : 'vue-analysis.json',
  };

  console.log('\n📊 Статистика файла:');
  console.log(`   ├─ Функций: ${analysis.stats.totalFunctions}`);
  console.log(`   ├─ Классов: ${analysis.stats.totalClasses}`);
  console.log(`   ├─ Констант: ${analysis.stats.totalConstants}`);
  console.log(`   ├─ Экспортов: ${analysis.stats.totalExports}`);
  console.log(`   ├─ Импортов: ${analysis.stats.totalImports}`);
  console.log(
    `   └─ Интерфейсов/Типов: ${analysis.stats.totalInterfaces + analysis.stats.totalTypes}`
  );

  console.log(`\n🔗 Выявлено кластеров: ${clusters.length}`);
  clusters.forEach((cluster, i) => {
    console.log(
      `   ${i + 1}. ${cluster.name}: [${cluster.functions.join(', ')}] (${cluster.type}, связность: ${cluster.cohesionScore.toFixed(1)}%)`
    );
    if (cluster.recommendation) {
      console.log(`      ${cluster.recommendation}`);
    }
  });

  // Генерация Markdown промпта
  let markdown = '# 🔪 РАЗБИЕНИЕ ФАЙЛА НА МОДУЛИ\n\n';
  markdown += `**Сгенерировано:** ${new Date().toLocaleString()}\n`;
  markdown += `**Целевой файл:** \`${targetFile}\`\n`;
  markdown += `**Размер файла:** ${(fs.statSync(targetFile).size / 1024).toFixed(2)} KB\n`;
  markdown += `**Количество строк:** ${analysis.stats.totalLines}\n`;
  markdown += '**Параметры анализа:**\n';
  markdown += `- Целевой размер кластера: ${targetClusterSize}\n`;
  markdown += `- Максимальный размер кластера: ${maxClusterSize}\n`;
  markdown += `- Глубина анализа: ${maxDepth}\n`;
  if (prefix) markdown += `- Префикс файлов: ${prefix}\n`;
  markdown += `- Паттерны исключения: \`${excludePatterns.join(', ')}\`\n\n`;

  markdown += '---\n\n';

  markdown += '## 📋 ИНСТРУКЦИЯ ДЛЯ ИИ\n\n';
  markdown +=
    'Ты — эксперт по рефакторингу кода. Твоя задача — **разбить монолитный файл на логически связанные модули**.\n\n';
  markdown += '### Критерии выделения модуля:\n\n';
  markdown += '1. **Связность (Cohesion)** — функции/классы, которые часто вызывают друг друга\n';
  markdown +=
    '2. **Ответственность (Responsibility)** — общая тема/домен (например, валидация, API, UI)\n';
  markdown +=
    '3. **Переиспользование (Reusability)** — сущности, которые могут быть полезны отдельно\n';
  markdown += '4. **Тестируемость (Testability)** — можно тестировать независимо\n';
  markdown += '5. **Размер модуля** — рекомендуется 50-200 строк на модуль\n\n';

  markdown += '### Анти-паттерны, которых следует избегать:\n\n';
  markdown += '- ❌ Циклические зависимости между модулями\n';
  markdown += '- ❌ Один модуль знает слишком много о других\n';
  markdown += '- ❌ "Мусорный" модуль (Utils) со всем подряд\n';
  markdown += '- ❌ Слишком мелкие модули (1-2 функции)\n';
  markdown += '- ❌ Слишком крупные модули (>300 строк)\n\n';

  markdown += '---\n\n';

  // Vue компонент - специальный анализ
  if (targetFile.endsWith('.vue') && vueAnalysis) {
    markdown += '## 🎯 VUE КОМПОНЕНТ - СПЕЦИАЛЬНЫЙ АНАЛИЗ\n\n';
    markdown += generateVueComponentReport(vueAnalysis);
    markdown += '---\n\n';
  }

  // Статистика
  if (includeStats) {
    markdown += '## 📊 СТАТИСТИКА ФАЙЛА\n\n';
    markdown += '| Показатель | Значение |\n';
    markdown += '|------------|----------|\n';
    markdown += `| Всего строк | ${analysis.stats.totalLines} |\n`;
    markdown += `| Экспортируемых сущностей | ${analysis.stats.totalExports} |\n`;
    markdown += `| Функций | ${analysis.stats.totalFunctions} |\n`;
    markdown += `| Классов | ${analysis.stats.totalClasses} |\n`;
    markdown += `| Констант | ${analysis.stats.totalConstants} |\n`;
    markdown += `| Интерфейсов/Типов | ${analysis.stats.totalInterfaces + analysis.stats.totalTypes} |\n`;
    markdown += `| Импортов | ${analysis.stats.totalImports} |\n\n`;
    markdown += '---\n\n';
  }

  // Экспорты
  if (analysis.exports.length > 0) {
    markdown += '## 📤 ЭКСПОРТИРУЕМЫЕ СУЩНОСТИ\n\n';
    markdown += '| Имя | Тип | Строки |\n';
    markdown += '|-----|-----|--------|\n';
    for (const exp of analysis.exports) {
      const lines = exp.endLine && exp.startLine ? `${exp.startLine}-${exp.endLine}` : '?';
      markdown += `| \`${exp.name}\` | ${exp.type} | ${lines} |\n`;
    }
    markdown += '\n---\n\n';
  }

  // Импорты
  if (analysis.imports.length > 0) {
    markdown += '## 📥 ИМПОРТЫ\n\n';
    markdown += '```typescript\n';
    for (const imp of analysis.imports) {
      const spec = imp.specifiers
        .map((s: any) => (s.imported === s.local ? s.imported : `${s.imported} as ${s.local}`))
        .join(', ');
      markdown += `import { ${spec} } from '${imp.source}';\n`;
    }
    markdown += '```\n\n---\n\n';
  }

  // Кластеры
  if (includeSuggestions && clusters.length > 0) {
    markdown += '## 🔍 ВЫЯВЛЕННЫЕ КЛАСТЕРЫ (КАНДИДАТЫ В МОДУЛИ)\n\n';
    markdown += 'На основе анализа вызовов функций (call graph) выявлены следующие кластеры:\n\n';

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      markdown += `### ${i + 1}. Кластер: \`${cluster.name}\`\n`;
      markdown += `- **Тип:** ${cluster.type === 'core' ? '🔷 Основной (экспортируемый)' : '🔶 Вспомогательный (внутренний)'}\n`;
      markdown += `- **Размер:** ${cluster.size} сущностей\n`;
      markdown += `- **Связность:** ${cluster.cohesionScore.toFixed(1)}%\n`;
      markdown += `- **Рекомендация:** ${cluster.recommendation}\n`;
      markdown += `- **Функции:** ${cluster.functions.map((f: string) => `\`${f}\``).join(', ')}\n`;
      if (cluster.dependencies.length > 0) {
        markdown += `- **Зависимости:** ${cluster.dependencies.map((d: string) => `\`${d}\``).join(', ')}\n`;
      }
      markdown += '\n';
    }
    markdown += '---\n\n';
  }

  // Циклические зависимости
  if (cyclicEdges.size > 0) {
    markdown += '## ⚠️ ЦИКЛИЧЕСКИЕ ЗАВИСИМОСТИ\n\n';
    markdown +=
      'Обнаружены циклические зависимости, которые необходимо устранить при разбиении:\n\n';
    for (const edge of cyclicEdges) {
      markdown += `- 🔴 \`${edge}\`\n`;
    }
    markdown += '\n---\n\n';
  }

  // Предлагаемая структура
  if (includeSuggestions) {
    markdown += '## 🎯 ПРЕДЛАГАЕМАЯ СТРУКТУРА МОДУЛЕЙ\n\n';
    markdown += 'На основе анализа предлагается следующая структура:\n\n';
    markdown += `\`\`\`\n${path.dirname(targetFile)}/\n`;
    markdown += '├── index.ts                 # Точка входа (реэкспорт)\n';
    markdown += '├── types.ts                 # Общие интерфейсы и типы\n';

    for (let i = 0; i < Math.min(clusters.length, 5); i++) {
      const cluster = clusters[i];
      const moduleName = cluster.name.replace(/Cluster$/, '').toLowerCase();
      markdown += `├── ${moduleName}.ts          # ${cluster.functions.slice(0, 3).join(', ')}${cluster.functions.length > 3 ? '...' : ''}\n`;
    }

    markdown += '└── utils.ts                 # Общие утилиты\n';
    markdown += '```\n\n---\n\n';
  }

  // Полный код
  if (includeFullCode) {
    const ext = path.extname(targetFile).slice(1);
    const lang = ext === 'ts' || ext === 'tsx' || ext === 'vue' ? 'typescript' : 'javascript';
    markdown += '## 📄 ПОЛНЫЙ КОД ФАЙЛА\n\n';
    markdown += `### \`${path.basename(targetFile)}\`\n`;
    markdown += `\`\`\`${lang}\n${analysis.fullCode}\n\`\`\`\n\n---\n\n`;
  }

  // Сжатая версия
  if (includeMinified && minified) {
    markdown += '## ✂️ СЖАТАЯ ВЕРСИЯ (только сигнатуры)\n\n';
    markdown += `\`\`\`typescript\n${minified}\n\`\`\`\n\n---\n\n`;
  }

  // Граф вызовов
  if (includeGraph && Object.keys(analysis.callGraph).length > 0) {
    markdown += '## 🕸️ ГРАФ ВЫЗОВОВ (Call Graph)\n\n';
    markdown += '```\n';
    for (const [caller, callees] of Object.entries(analysis.callGraph)) {
      if (callees.length > 0) {
        markdown += `${caller} → ${callees.join(', ')}\n`;
      }
    }
    markdown += '```\n\n---\n\n';
  }

  // Ожидаемый ответ
  markdown += '## 📤 ОЖИДАЕМЫЙ ФОРМАТ ОТВЕТА\n\n';
  markdown += '### 1. Анализ текущей структуры (2-3 предложения)\n\n';
  markdown += '### 2. Предлагаемая структура модулей\n\n';
  markdown += `\`\`\`\n${path.dirname(targetFile)}/\n`;
  markdown += '├── modules/\n';
  markdown += '│   ├── module-a.ts\n';
  markdown += '│   ├── module-b.ts\n';
  markdown += '│   └── module-c.ts\n';
  markdown += '├── types.ts\n';
  markdown += '└── index.ts\n';
  markdown += '```\n\n';
  markdown += '### 3. Код каждого нового модуля\n\n';
  markdown += 'Для каждого модуля укажи:\n';
  markdown += '- Полный код файла\n';
  markdown += '- Какие функции/классы переносятся\n';
  markdown += '- Новые импорты/экспорты\n\n';
  markdown += '### 4. Обновленный корневой файл (index.ts)\n\n';
  markdown += '### 5. План миграции (пошагово)\n\n';

  // Сохранение файлов
  fs.writeFileSync(outputFiles.prompt, markdown, 'utf-8');
  if (includeMinified && minified) {
    fs.writeFileSync(outputFiles.context, minified, 'utf-8');
  }
  if (includeGraph && internalGraph) {
    fs.writeFileSync(outputFiles.graph, JSON.stringify(internalGraph, null, 2), 'utf-8');
  }
  if (vueAnalysis) {
    fs.writeFileSync(outputFiles.vue, JSON.stringify(vueAnalysis, null, 2), 'utf-8');
  }
  fs.writeFileSync(
    outputFiles.analysis,
    JSON.stringify(
      {
        stats: analysis.stats,
        exports: analysis.exports,
        imports: analysis.imports,
        functions: analysis.functions.map((f: any) => ({
          name: f.name,
          exported: f.exported,
          params: f.params,
          callCount: analysis.callGraph[f.name]?.length || 0,
        })),
        classes: analysis.classes.map((c: any) => ({
          name: c.name,
          exported: c.exported,
          methods: c.methods.length,
        })),
        clusters: clusters.map((c: any) => ({
          name: c.name,
          size: c.size,
          type: c.type,
          cohesionScore: c.cohesionScore,
          recommendation: c.recommendation,
          functions: c.functions,
        })),
        vue: vueAnalysis
          ? {
              props: vueAnalysis.props,
              emits: vueAnalysis.emits,
              slots: vueAnalysis.slots,
              composables: vueAnalysis.composables,
              templateComplexity: vueAnalysis.template.complexity,
            }
          : undefined,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ ПРОМПТ ДЛЯ РАЗБИЕНИЯ СОЗДАН!');
  console.log(`${'='.repeat(60)}`);
  console.log(`📄 Выходные файлы${prefix ? ` (префикс: ${prefix})` : ''}:`);
  console.log(`   ├─ ${outputFiles.prompt}`);
  if (includeMinified && minified) console.log(`   ├─ ${outputFiles.context}`);
  if (includeGraph && internalGraph) console.log(`   ├─ ${outputFiles.graph}`);
  if (vueAnalysis) console.log(`   ├─ ${outputFiles.vue}`);
  console.log(`   └─ ${outputFiles.analysis}`);
  console.log(`\n📊 Размер промпта: ${(markdown.length / 1024).toFixed(2)} KB`);

  return { markdown, analysis, outputFiles, vueAnalysis };
}

// ==========================================
// ЭКСПОРТ ВНУТРЕННИХ ФУНКЦИЙ
// ==========================================

export { analyzeModuleStructure, identifyClusters };
