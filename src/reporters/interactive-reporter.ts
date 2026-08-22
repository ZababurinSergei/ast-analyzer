// packages/ast-analyzer/src/reporters/interactive-reporter.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { FullAnalysis } from '../types.js';
import { DataConverter } from './data-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Генерирует интерактивный HTML отчет
 * Копирует data-converter.js, interactive-report.css и interactive-report.js
 * из templates в целевую директорию и встраивает данные в HTML
 *
 * @param analysis - полный анализ (FullAnalysis)
 * @param outputPath - путь для сохранения HTML
 * @param entitiesWithCalls - данные сущностей для обогащения
 */
export async function generateInteractiveHTML(
  analysis: FullAnalysis,
  outputPath: string,
  entitiesWithCalls?: any
): Promise<void> {
  const outputDir = path.dirname(outputPath);
  const templateDir = path.join(__dirname, 'templates');

  // Проверяем наличие шаблона
  const templatePath = path.join(templateDir, 'interactive-report.template.html');
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Шаблон не найден: ${templatePath}`);
    return;
  }

  // Создаем целевую директорию
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n📋 Подготовка файлов...');

  // ============================================================
  // 1. КОПИРУЕМ data-converter.js ИЗ TEMPLATES
  // ============================================================
  const srcFile = path.join(templateDir, 'data-converter.js');
  const destFile = path.join(outputDir, 'data-converter.js');

  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`  ✅ Скопирован: data-converter.js`);
  } else {
    console.warn(`  ⚠️ data-converter.js не найден в ${templateDir}`);
  }

  // ============================================================
  // 2. КОПИРУЕМ interactive-report.css ИЗ TEMPLATES
  // ============================================================
  const cssSrc = path.join(templateDir, 'interactive-report.css');
  const cssDest = path.join(outputDir, 'interactive-report.css');

  if (fs.existsSync(cssSrc)) {
    fs.copyFileSync(cssSrc, cssDest);
    console.log(`  ✅ Скопирован: interactive-report.css`);
  } else {
    console.warn(`  ⚠️ interactive-report.css не найден в ${templateDir}`);
  }

  // ============================================================
  // 3. КОПИРУЕМ interactive-report.js ИЗ TEMPLATES
  // ============================================================
  const jsSrc = path.join(templateDir, 'interactive-report.js');
  const jsDest = path.join(outputDir, 'interactive-report.js');

  if (fs.existsSync(jsSrc)) {
    fs.copyFileSync(jsSrc, jsDest);
    console.log(`  ✅ Скопирован: interactive-report.js`);
  } else {
    console.warn(`  ⚠️ interactive-report.js не найден в ${templateDir}`);
  }

  // ============================================================
  // 4. ПРЕОБРАЗУЕМ ДАННЫЕ
  // ============================================================
  let report = DataConverter.buildReportFromAnalysis(analysis);

  if (entitiesWithCalls) {
    report = DataConverter.enrichReport(report, entitiesWithCalls);
  }

  // Собираем все функции для встраивания в JS
  const allFunctions: { modulePath: string; func: any }[] = [];
  for (const [modulePath, pkg] of Object.entries(report.packages)) {
    if (!pkg) continue;
    for (const func of pkg.entities.functions) {
      allFunctions.push({ modulePath, func });
    }
  }

  // ============================================================
  // 5. ВСТРАИВАЕМ ДАННЫЕ В HTML
  // ============================================================
  let htmlContent = fs.readFileSync(templatePath, 'utf8');

  // Статические данные для подстановки
  const staticReplacements: Record<string, string> = {
    __STAT_MODULES__: String(report.fileStats.totalFiles),
    __STAT_FUNCTIONS__: String(report.entityStats.totalFunctions),
    __STAT_CALLS__: String(report.entityStats.totalCalls),
    __STAT_EXPORTED__: String(report.entityStats.totalExportedFunctions),
    __STAT_ASYNC__: String(report.entityStats.totalAsyncFunctions),
    __STAT_LINES__: String(report.fileStats.totalLines),
    __STAT_SIZE__: (report.fileStats.totalSize / 1024).toFixed(2),
    __TYPES_BY_LANG__: 'typescript, javascript',
    __ENTRY_NAMES__: analysis.root || 'не указана',
    __TIMESTAMP__: new Date().toLocaleString(),
  };

  for (const [key, value] of Object.entries(staticReplacements)) {
    htmlContent = htmlContent.replaceAll(key, value);
  }

  // Встраиваем данные в JavaScript (перед importmap)
  const reportJson = JSON.stringify(report);
  const functionsJson = JSON.stringify(allFunctions);

  const dataScript = `
    <script>
      (function() {
        const SYM_REPORT_DATA = Symbol.for('__AST_INTERACTIVE_REPORT_DATA__');
        const SYM_FUNCTIONS_DATA = Symbol.for('__AST_INTERACTIVE_FUNCTIONS_DATA__');
        const SYM_DATA_VERSION = Symbol.for('__AST_INTERACTIVE_DATA_VERSION__');

        globalThis[SYM_REPORT_DATA] = ${reportJson};
        globalThis[SYM_FUNCTIONS_DATA] = ${functionsJson};
        globalThis[SYM_DATA_VERSION] = 1;

        console.log('✅ Данные загружены');
        console.log('📊 Модулей:', Object.keys(globalThis[SYM_REPORT_DATA].packages || {}).length);
        console.log('ƒ Функций:', globalThis[SYM_FUNCTIONS_DATA].length);
      })();
    </script>
  `;

  // Вставляем dataScript перед importmap
  htmlContent = htmlContent.replace(
    '<script type="importmap">',
    dataScript + '\n    <script type="importmap">'
  );

  // ============================================================
  // 6. СОХРАНЯЕМ HTML
  // ============================================================
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');

  console.log(`\n✅ Отчет сохранен: ${outputPath}`);
  console.log(`📊 Модулей: ${report.fileStats.totalFiles}`);
  console.log(`ƒ Функций: ${report.entityStats.totalFunctions}`);
  console.log(`📞 Вызовов: ${report.entityStats.totalCalls}`);
}

export default {
  generateInteractiveHTML,
};
