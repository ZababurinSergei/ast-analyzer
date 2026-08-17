// src/modes/hybrid-report/cli.ts

import fs from 'fs';
import path from 'path';
import { buildFileInternalGraph } from '../file-graph.js';
import { findCyclicEdges, convertToDOT } from '../../core/graph-utils.js';
import type { HybridReport } from './types.js';
import { buildHybridReport } from './builder.js';
import { generateHybridDOT } from './generators/dot.js';
import { generateHybridHTML } from './generators/html.js';
import { generateHybridMarkdown } from './generators/markdown.js';

/**
 * Запускает генерацию гибридного отчета и сохраняет все файлы
 * @param entryPoint - Точка входа (файл, с которого начинается анализ)
 * @param maxDepth - Максимальная глубина анализа зависимостей
 * @param outputDir - Директория для сохранения отчетов
 * @returns HybridReport - Сгенерированный отчет
 */
export async function runHybridReport(
  entryPoint: string,
  maxDepth: number,
  outputDir: string
): Promise<HybridReport> {
  try {
    console.log('\n🚀 ЗАПУСК ГЕНЕРАЦИИ ГИБРИДНОГО ОТЧЕТА');
    console.log('='.repeat(60));
    console.log(`📄 Точка входа: ${entryPoint}`);
    console.log(`📏 Глубина: ${maxDepth}`);
    console.log(`📁 Выходная директория: ${outputDir}`);

    // 1. Строим отчет
    const report = buildHybridReport(entryPoint, maxDepth);

    // 2. Проверка на валидность отчета
    if (!report || !report.modules) {
      throw new Error('Отчет не содержит данных');
    }

    // 3. Сохраняем JSON
    console.log('\n📄 Сохранение JSON отчета...');
    const jsonPath = path.join(outputDir, 'hybrid-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`   ✅ ${jsonPath}`);

    // 4. Сохраняем Markdown
    console.log('📄 Сохранение Markdown отчета...');
    const mdPath = path.join(outputDir, 'hybrid-report.md');
    const md = generateHybridMarkdown(report);
    fs.writeFileSync(mdPath, md);
    console.log(`   ✅ ${mdPath}`);

    // 5. Сохраняем DOT граф
    console.log('📄 Сохранение DOT графа...');
    const dotPath = path.join(outputDir, 'hybrid-report.dot');
    const dot = generateHybridDOT(report);
    fs.writeFileSync(dotPath, dot);
    console.log(`   ✅ ${dotPath}`);

    // 6. Сохраняем HTML
    console.log('📄 Генерация HTML отчета...');
    const html = await generateHybridHTML(report, maxDepth);
    const htmlPath = path.join(outputDir, 'hybrid-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`   ✅ ${htmlPath}`);

    // 7. Сохраняем внутренние графы файлов
    console.log('\n📄 Генерация внутренних графов файлов...');
    let internalGraphsCount = 0;
    for (const module of report.modules) {
      try {
        const internalGraph = buildFileInternalGraph(module.path);
        if (internalGraph && Object.keys(internalGraph.graph).length > 0) {
          const graphPath = path.join(
            outputDir,
            `internal-${module.name.replace(/\.[^.]+$/, '')}.json`
          );
          fs.writeFileSync(graphPath, JSON.stringify(internalGraph, null, 2));
          console.log(`   ✅ internal-${module.name.replace(/\.[^.]+$/, '')}.json`);
          internalGraphsCount++;
        }
      } catch (error) {
        console.warn(
          `   ⚠️ Не удалось построить граф для ${module.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    console.log(`   📊 Сгенерировано внутренних графов: ${internalGraphsCount}`);

    // 8. Сохраняем DOT с convertToDOT для дополнительной визуализации
    console.log('\n📄 Генерация дополнительных DOT графов...');
    let dotGraphsCount = 0;
    for (const module of report.modules) {
      try {
        const internalGraph = buildFileInternalGraph(module.path);
        if (internalGraph && Object.keys(internalGraph.graph).length > 0) {
          const cyclicEdges = findCyclicEdges(internalGraph.graph);
          const dotContent = convertToDOT(internalGraph, cyclicEdges);
          const dotInternalPath = path.join(
            outputDir,
            `internal-${module.name.replace(/\.[^.]+$/, '')}.dot`
          );
          fs.writeFileSync(dotInternalPath, dotContent);
          console.log(`   ✅ internal-${module.name.replace(/\.[^.]+$/, '')}.dot`);
          dotGraphsCount++;
        }
      } catch (error) {
        console.warn(
          `   ⚠️ Не удалось построить DOT для ${module.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    console.log(`   📊 Сгенерировано DOT графов: ${dotGraphsCount}`);

    // 9. Вывод итоговой статистики
    console.log('\n' + '='.repeat(60));
    console.log('✅ ГИБРИДНЫЙ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(60));
    console.log(`📊 Статистика отчета:`);
    console.log(`   • Модулей: ${report.stats.totalModules}`);
    console.log(`   • Функций: ${report.stats.totalFunctions}`);
    console.log(`   • Экспортов: ${report.stats.totalExports}`);
    console.log(`   • Импортов: ${report.stats.totalImports}`);
    console.log(`   • Компонентов: ${report.stats.totalComponents}`);
    console.log(`   • Композаблов: ${report.stats.totalComposables}`);
    console.log(`   • Циклов: ${report.stats.cycles}`);
    console.log(`   • Глубина: ${report.stats.maxDepth}`);

    if (report.stats.cycles > 0) {
      console.log(`\n⚠️ Обнаружено ${report.stats.cycles} циклических зависимостей!`);
      console.log('   Проверьте файл hybrid-report.md для деталей.');
    }

    console.log(`\n📁 Файлы сохранены в: ${outputDir}`);
    console.log('   📄 hybrid-report.json - полные данные');
    console.log('   📄 hybrid-report.md - Markdown отчет');
    console.log('   📄 hybrid-report.dot - DOT граф');
    console.log('   📄 hybrid-report.html - HTML визуализация');
    console.log(`   📄 internal-*.json - внутренние графы (${internalGraphsCount} файлов)`);
    console.log(`   📄 internal-*.dot - DOT графы (${dotGraphsCount} файлов)`);
    console.log('='.repeat(60) + '\n');

    return report;
  } catch (error) {
    console.error('\n❌ ОШИБКА ПРИ ГЕНЕРАЦИИ ОТЧЕТА:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error('\n📚 Стек ошибки:');
      console.error(error.stack);
    }

    // Возвращаем пустой отчет при ошибке
    return {
      root: entryPoint,
      modules: [],
      graph: { nodes: [], edges: [] },
      stats: {
        totalModules: 0,
        totalFunctions: 0,
        totalExports: 0,
        totalImports: 0,
        totalComponents: 0,
        totalComposables: 0,
        maxDepth: maxDepth,
        cycles: 0,
        byLevel: {},
      },
      cycles: [],
      levels: {},
    };
  }
}
