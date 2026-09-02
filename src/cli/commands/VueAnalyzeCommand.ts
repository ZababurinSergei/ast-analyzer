// packages/ast-analyzer/src/cli/commands/VueAnalyzeCommand.ts
// НОВЫЙ ФАЙЛ - Исправленная версия (удален неиспользуемый __dirname)

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';

/**
 * Команда для анализа Vue компонентов
 *
 * Использование:
 *   npx ast-analyzer vue-analyze <file> [options]
 *   npx ast-analyzer vue <file> [options]
 *
 * Опции:
 *   --no-template-ast    Skip template AST analysis
 *   --no-script-ast      Skip script AST analysis
 *   --no-composables     Skip composable extraction
 *   -o, --output <dir>   Output directory
 *   -v, --verbose        Verbose output
 *   --format <format>    Output format: json, html, markdown (default: markdown)
 */
export class VueAnalyzeCommand {
  private program: Command;

  constructor() {
    this.program = new Command()
      .name('vue-analyze')
      .description('🎯 Analyze Vue component')
      .alias('vue')
      .argument('<file>', 'Path to Vue component file (.vue)')
      .option('--no-template-ast', 'Skip template AST analysis')
      .option('--no-script-ast', 'Skip script AST analysis')
      .option('--no-composables', 'Skip composable extraction')
      .option('-o, --output <dir>', 'Output directory', process.cwd())
      .option('-v, --verbose', 'Verbose output')
      .option('--format <format>', 'Output format: json, html, markdown', 'markdown')
      .option('--no-json', 'Skip JSON output')
      .option('--no-markdown', 'Skip Markdown output')
      .option('--generate-html', 'Generate HTML report')
      .option('--callgraph', 'Include call graph analysis')
      .option('--functions', 'Extract all functions from script')
      .option('--constants', 'Extract constants from script')
      .option('--variables', 'Extract variables from script')
      .option('--types', 'Extract TypeScript types')
      .option('--interfaces', 'Extract TypeScript interfaces')
      .action(async (file: string, options: any) => {
        await this.execute(file, options);
      });
  }

  /**
   * Выполняет команду
   */
  async execute(file: string, options: any): Promise<void> {
    console.log('🎯 Analyzing Vue component...');
    console.log(`📄 File: ${file}`);

    const absolutePath = path.resolve(file);
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      process.exit(1);
    }

    if (!file.endsWith('.vue')) {
      console.error('❌ File must have .vue extension');
      process.exit(1);
    }

    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Сохраняем оригинальную CWD для восстановления
    const originalCwd = process.cwd();
    process.chdir(outputDir);

    try {
      const analysis = await this.analyzeComponent(absolutePath, options);

      // Выводим краткую информацию
      this.printSummary(analysis);

      // Сохраняем отчеты
      await this.saveReports(analysis, options, outputDir);

      // Дополнительный анализ если включен
      if (options.callgraph) {
        await this.analyzeCallGraph(analysis);
      }
    } catch (error) {
      console.error(`❌ Analysis failed:`, error);
      process.exit(1);
    } finally {
      process.chdir(originalCwd);
    }
  }

  /**
   * Анализирует Vue компонент
   */
  private async analyzeComponent(filePath: string, options: any): Promise<any> {
    const { analyzeVueComponent } = await import('../../modes/vue-analyzer/index.js');

    const analysis = analyzeVueComponent(filePath, {
      includeTemplateAST: options.templateAst !== false,
      includeScriptAST: options.scriptAst !== false,
      extractComposableCalls: options.composables !== false,
    });

    if (!analysis) {
      console.error('❌ Failed to analyze Vue component');
      process.exit(1);
    }

    return analysis;
  }

  /**
   * Выводит краткую информацию о компоненте
   */
  private printSummary(analysis: any): void {
    console.log('\n📊 COMPONENT SUMMARY');
    console.log('='.repeat(60));
    console.log(`🏷️  Component: ${analysis.componentName}`);
    console.log(`📁 Path: ${analysis.filePath}`);
    console.log(
      `📝 Script: ${analysis.stats.scriptLines} lines (${analysis.script.isSetup ? 'setup' : 'options API'})`
    );
    console.log(`🎨 Template: ${analysis.stats.templateLines} lines`);
    console.log(`🎭 Styles: ${analysis.stats.styleCount} blocks`);
    console.log(`💻 TypeScript: ${analysis.script.isTS ? '✅' : '❌'}`);
    console.log(`📦 Setup: ${analysis.script.isSetup ? '✅' : '❌'}`);
    console.log('\n📥 Props:');
    if (analysis.props.names.length > 0) {
      for (const name of analysis.props.names.slice(0, 10)) {
        const type = analysis.props.types[name] || 'any';
        const required = analysis.props.required[name] ? 'required' : 'optional';
        console.log(`   • ${name}: ${type} (${required})`);
      }
      if (analysis.props.names.length > 10) {
        console.log(`   ... and ${analysis.props.names.length - 10} more`);
      }
    } else {
      console.log('   • No props defined');
    }

    console.log('\n📤 Events:');
    if (analysis.emits.names.length > 0) {
      for (const name of analysis.emits.names) {
        const type = analysis.emits.types[name] || 'any';
        console.log(`   • ${name}: ${type}`);
      }
    } else {
      console.log('   • No events defined');
    }

    console.log('\n🎭 Slots:');
    if (analysis.slots.length > 0) {
      for (const slot of analysis.slots) {
        console.log(`   • ${slot}`);
      }
    } else {
      console.log('   • No slots defined');
    }

    console.log('\n🧩 Composables:');
    if (analysis.composables.length > 0) {
      for (const comp of analysis.composables) {
        console.log(`   • ${comp.name}${comp.args.length > 0 ? `(${comp.args.join(', ')})` : ''}`);
      }
    } else {
      console.log('   • No composables found');
    }

    console.log('\n🔧 Functions:');
    if (analysis.functions.length > 0) {
      for (const func of analysis.functions.slice(0, 10)) {
        const exported = func.isExported ? '📤' : '🔒';
        const async_ = func.isAsync ? '⚡' : '';
        console.log(`   • ${exported} ${func.name}${async_} (${func.params.length} params)`);
      }
      if (analysis.functions.length > 10) {
        console.log(`   ... and ${analysis.functions.length - 10} more`);
      }
    } else {
      console.log('   • No functions found');
    }

    console.log('\n📝 Types & Interfaces:');
    if (analysis.types.length > 0 || analysis.interfaces.length > 0) {
      console.log(`   • Types: ${analysis.types.length}`);
      console.log(`   • Interfaces: ${analysis.interfaces.length}`);
    } else {
      console.log('   • No types or interfaces found');
    }

    console.log('\n🔄 Template Complexity:');
    console.log(`   • Elements: ${analysis.template.complexity}`);
    console.log(`   • Root elements: ${analysis.template.rootElements.join(', ') || 'none'}`);
    console.log(`   • Directives: ${analysis.template.directives.join(', ') || 'none'}`);
    console.log(`   • Events in template: ${analysis.template.events.join(', ') || 'none'}`);
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Сохраняет отчеты в разных форматах
   */
  private async saveReports(analysis: any, options: any, outputDir: string): Promise<void> {
    const baseName = analysis.componentName;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 1. JSON отчет
    if (options.json !== false) {
      const jsonPath = path.join(outputDir, `${baseName}-analysis-${timestamp}.json`);
      const jsonData = {
        ...analysis,
        timestamp: new Date().toISOString(),
        version: '3.0.0',
      };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      console.log(`📄 JSON report: ${jsonPath}`);
    }

    // 2. Markdown отчет
    if (options.markdown !== false && options.format !== 'json') {
      const mdPath = path.join(outputDir, `${baseName}-analysis-${timestamp}.md`);
      const markdown = this.generateMarkdownReport(analysis);
      fs.writeFileSync(mdPath, markdown);
      console.log(`📄 Markdown report: ${mdPath}`);
    }

    // 3. HTML отчет
    if (options.generateHtml || options.format === 'html') {
      const htmlPath = path.join(outputDir, `${baseName}-analysis-${timestamp}.html`);
      const html = await this.generateHTMLReport(analysis);
      fs.writeFileSync(htmlPath, html);
      console.log(`📄 HTML report: ${htmlPath}`);
    }

    // 4. Сохраняем только сам анализ (краткий вариант)
    if (options.format === 'json') {
      const shortPath = path.join(outputDir, `${baseName}-analysis.json`);
      fs.writeFileSync(shortPath, JSON.stringify(analysis, null, 2));
      console.log(`📄 Analysis JSON: ${shortPath}`);
    }
  }

  /**
   * Генерирует Markdown отчет
   */
  private generateMarkdownReport(analysis: any): string {
    let md = `# 🎯 Vue Component Analysis: ${analysis.componentName}\n\n`;
    md += `**File:** \`${analysis.filePath}\`\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;

    // Статистика
    md += '## 📊 Statistics\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| Script lines | ${analysis.stats.scriptLines} |\n`;
    md += `| Template lines | ${analysis.stats.templateLines} |\n`;
    md += `| Style blocks | ${analysis.stats.styleCount} |\n`;
    md += `| TypeScript | ${analysis.script.isTS ? '✅' : '❌'} |\n`;
    md += `| Setup API | ${analysis.script.isSetup ? '✅' : '❌'} |\n`;
    md += `| Total size | ${(analysis.stats.totalSize / 1024).toFixed(2)} KB |\n\n`;

    // Props
    md += '## 📥 Props\n\n';
    if (analysis.props.names.length > 0) {
      md += '| Name | Type | Required | Default |\n';
      md += '|------|------|----------|---------|\n';
      for (const name of analysis.props.names) {
        const type = analysis.props.types[name] || 'any';
        const required = analysis.props.required[name] ? '✅' : '❌';
        const defaultValue =
          analysis.props.defaults[name] !== undefined ? String(analysis.props.defaults[name]) : '-';
        md += `| \`${name}\` | \`${type}\` | ${required} | ${defaultValue} |\n`;
      }
    } else {
      md += '*No props defined*\n';
    }
    md += '\n';

    // Events
    md += '## 📤 Events\n\n';
    if (analysis.emits.names.length > 0) {
      md += '| Name | Type |\n';
      md += '|------|------|\n';
      for (const name of analysis.emits.names) {
        const type = analysis.emits.types[name] || 'any';
        md += `| \`${name}\` | \`${type}\` |\n`;
      }
    } else {
      md += '*No events defined*\n';
    }
    md += '\n';

    // Slots
    md += '## 🎭 Slots\n\n';
    if (analysis.slots.length > 0) {
      for (const slot of analysis.slots) {
        md += `- \`${slot}\`\n`;
      }
    } else {
      md += '*No slots defined*\n';
    }
    md += '\n';

    // Composables
    md += '## 🧩 Composables\n\n';
    if (analysis.composables.length > 0) {
      for (const comp of analysis.composables) {
        const args = comp.args.length > 0 ? `(${comp.args.join(', ')})` : '';
        md += `- \`${comp.name}${args}\`\n`;
      }
    } else {
      md += '*No composables found*\n';
    }
    md += '\n';

    // Functions
    md += '## 🔧 Functions\n\n';
    if (analysis.functions.length > 0) {
      md += '| Name | Line | Async | Exported | Params |\n';
      md += '|------|------|-------|----------|--------|\n';
      for (const func of analysis.functions) {
        const async_ = func.isAsync ? '✅' : '❌';
        const exported = func.isExported ? '✅' : '❌';
        const params = func.params.length > 0 ? func.params.join(', ') : '-';
        md += `| \`${func.name}\` | ${func.line} | ${async_} | ${exported} | ${params} |\n`;
      }
    } else {
      md += '*No functions found*\n';
    }
    md += '\n';

    // Types
    md += '## 📝 Types\n\n';
    if (analysis.types.length > 0) {
      for (const type of analysis.types) {
        const exported = type.isExported ? '📤' : '🔒';
        md += `- ${exported} \`${type.name}\` = \`${type.definition}\`\n`;
      }
    } else {
      md += '*No types defined*\n';
    }
    md += '\n';

    // Interfaces
    md += '## 📐 Interfaces\n\n';
    if (analysis.interfaces.length > 0) {
      for (const intf of analysis.interfaces) {
        const exported = intf.isExported ? '📤' : '🔒';
        const props = intf.properties.length > 0 ? `: ${intf.properties.join(', ')}` : '';
        const extends_ =
          intf.extends && intf.extends.length > 0 ? ` extends ${intf.extends.join(', ')}` : '';
        md += `- ${exported} \`${intf.name}${extends_}\`${props}\n`;
      }
    } else {
      md += '*No interfaces defined*\n';
    }
    md += '\n';

    // Template
    md += '## 🎨 Template\n\n';
    md += `**Complexity:** ${analysis.template.complexity}\n`;
    md += `**Root elements:** ${analysis.template.rootElements.join(', ') || 'none'}\n`;
    md += `**Directives:** ${analysis.template.directives.join(', ') || 'none'}\n`;
    md += `**Events:** ${analysis.template.events.join(', ') || 'none'}\n\n`;

    if (analysis.template.content) {
      md += '### Template Code\n\n';
      md += '```html\n';
      md += analysis.template.content.substring(0, 500);
      if (analysis.template.content.length > 500) {
        md += '\n... (truncated)';
      }
      md += '\n```\n\n';
    }

    // Call Graph (если есть)
    const hasCalls = Object.values(analysis.callGraph || {}).some((arr: any) => arr.length > 0);
    if (hasCalls) {
      md += '## 🔗 Call Graph\n\n';
      md += '```\n';
      for (const [caller, callees] of Object.entries(analysis.callGraph || {})) {
        if ((callees as any[]).length > 0) {
          md += `${caller} → ${(callees as any[]).join(', ')}\n`;
        }
      }
      md += '```\n\n';
    }

    // Recommendations
    md += '## 💡 Recommendations\n\n';

    if (analysis.template.complexity > 50) {
      md += `⚠️ **Template is too large** (${analysis.template.complexity} elements). Consider extracting parts into separate components.\n\n`;
    }

    if (analysis.props.names.length > 10) {
      md += `⚠️ **Too many props** (${analysis.props.names.length}). Consider splitting the component.\n\n`;
    }

    if (analysis.composables.length > 5) {
      md += `⚠️ **Too many composables** (${analysis.composables.length}). Consider grouping related logic.\n\n`;
    }

    if (analysis.stats.scriptLines > 300) {
      md += `⚠️ **Script is too large** (${analysis.stats.scriptLines} lines). Consider extracting logic into composables.\n\n`;
    }

    if (analysis.functions.length > 20) {
      md += `⚠️ **Too many functions** (${analysis.functions.length}). Consider splitting into multiple files.\n\n`;
    }

    if (analysis.slots.length > 5) {
      md += `ℹ️ **Many slots** (${analysis.slots.length}). Consider using renderless components.\n\n`;
    }

    md += '---\n\n';
    md += `*Generated by AST Analyzer Vue Analyzer v3.0.0*\n`;

    return md;
  }

  /**
   * Генерирует HTML отчет
   */
  private async generateHTMLReport(analysis: any): Promise<string> {
    const jsonData = JSON.stringify(analysis, null, 2);
    const escapedJson = jsonData.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue Component Analysis: ${analysis.componentName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      border: 1px solid #334155;
    }
    .header h1 { color: #60a5fa; font-size: 28px; }
    .header .sub { color: #94a3b8; margin-top: 8px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    .card .value { font-size: 32px; font-weight: bold; color: #60a5fa; }
    .card .label { color: #94a3b8; font-size: 13px; margin-top: 4px; }
    .section {
      background: #1e293b;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid #334155;
    }
    .section h2 { color: #60a5fa; margin-bottom: 12px; font-size: 18px; }
    .section h3 { color: #94a3b8; margin: 12px 0 8px; font-size: 14px; }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    .badge.export { background: #f87171; color: #fff; }
    .badge.async { background: #fbbf24; color: #0f172a; }
    .badge.ts { background: #60a5fa; color: #fff; }
    .badge.setup { background: #4ade80; color: #0f172a; }
    .list-item {
      padding: 6px 12px;
      margin: 4px 0;
      background: #0f172a;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
    }
    .list-item .meta { color: #94a3b8; font-size: 11px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    th { color: #94a3b8; font-weight: 500; }
    td { font-family: monospace; }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 12px;
      padding: 20px;
      border-top: 1px solid #334155;
      margin-top: 20px;
    }
    .json-view {
      background: #0f172a;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #334155;
      margin-top: 10px;
    }
    .json-view pre { color: #a5d6a7; margin: 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Vue Component Analysis</h1>
      <div class="sub">${analysis.componentName} | ${new Date().toLocaleString()}</div>
      <div style="margin-top:12px;">
        <span class="badge ts">${analysis.script.isTS ? 'TypeScript' : 'JavaScript'}</span>
        <span class="badge setup">${analysis.script.isSetup ? 'Setup API' : 'Options API'}</span>
        ${analysis.script.isTS ? '<span class="badge ts">TypeScript</span>' : ''}
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="value">${analysis.stats.scriptLines}</div>
        <div class="label">📝 Script Lines</div>
      </div>
      <div class="card">
        <div class="value">${analysis.stats.templateLines}</div>
        <div class="label">🎨 Template Lines</div>
      </div>
      <div class="card">
        <div class="value">${analysis.props.names.length}</div>
        <div class="label">📥 Props</div>
      </div>
      <div class="card">
        <div class="value">${analysis.emits.names.length}</div>
        <div class="label">📤 Events</div>
      </div>
      <div class="card">
        <div class="value">${analysis.composables.length}</div>
        <div class="label">🧩 Composables</div>
      </div>
      <div class="card">
        <div class="value">${analysis.functions.length}</div>
        <div class="label">🔧 Functions</div>
      </div>
      <div class="card">
        <div class="value">${analysis.types.length + analysis.interfaces.length}</div>
        <div class="label">📝 Types/Interfaces</div>
      </div>
      <div class="card">
        <div class="value">${analysis.template.complexity}</div>
        <div class="label">🔄 Template Complexity</div>
      </div>
    </div>

    <div class="section">
      <h2>📥 Props</h2>
      ${
        analysis.props.names.length > 0
          ? `
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Default</th></tr></thead>
          <tbody>
            ${analysis.props.names
              .map(
                (name: string) => `
              <tr>
                <td>${name}</td>
                <td>${analysis.props.types[name] || 'any'}</td>
                <td>${analysis.props.required[name] ? '✅' : '❌'}</td>
                <td>${analysis.props.defaults[name] !== undefined ? String(analysis.props.defaults[name]) : '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p style="color:#94a3b8;">No props defined</p>'
      }
    </div>

    <div class="section">
      <h2>📤 Events</h2>
      ${
        analysis.emits.names.length > 0
          ? `
        <table>
          <thead><tr><th>Name</th><th>Type</th></tr></thead>
          <tbody>
            ${analysis.emits.names
              .map(
                (name: string) => `
              <tr><td>${name}</td><td>${analysis.emits.types[name] || 'any'}</td></tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `
          : '<p style="color:#94a3b8;">No events defined</p>'
      }
    </div>

    <div class="section">
      <h2>🧩 Composables</h2>
      ${
        analysis.composables.length > 0
          ? `
        ${analysis.composables
          .map(
            (comp: any) => `
          <div class="list-item">
            ${comp.name}
            ${comp.args.length > 0 ? `<span class="meta">(${comp.args.join(', ')})</span>` : ''}
          </div>
        `
          )
          .join('')}
      `
          : '<p style="color:#94a3b8;">No composables found</p>'
      }
    </div>

    <div class="section">
      <h2>🔧 Functions</h2>
      ${
        analysis.functions.length > 0
          ? `
        <table>
          <thead><tr><th>Name</th><th>Line</th><th>Async</th><th>Exported</th><th>Params</th></tr></thead>
          <tbody>
            ${analysis.functions
              .slice(0, 20)
              .map(
                (func: any) => `
              <tr>
                <td>${func.name}</td>
                <td>${func.line}</td>
                <td>${func.isAsync ? '⚡' : ''}</td>
                <td>${func.isExported ? '📤' : '🔒'}</td>
                <td>${func.params.join(', ') || '-'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        ${analysis.functions.length > 20 ? `<p style="color:#94a3b8; margin-top:8px;">... and ${analysis.functions.length - 20} more</p>` : ''}
      `
          : '<p style="color:#94a3b8;">No functions found</p>'
      }
    </div>

    <div class="section">
      <h2>📝 Raw Data (JSON)</h2>
      <div class="json-view">
        <pre>${escapedJson}</pre>
      </div>
    </div>

    <div class="footer">
      Generated by AST Analyzer Vue Analyzer v3.0.0
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Анализирует граф вызовов (если включен)
   */
  private async analyzeCallGraph(analysis: any): Promise<void> {
    console.log('\n🕸️ Analyzing call graph...');

    const hasCalls = Object.values(analysis.callGraph || {}).some((arr: any) => arr.length > 0);

    if (!hasCalls) {
      console.log('   No calls found');
      return;
    }

    console.log('\n   Call Graph:');
    for (const [caller, callees] of Object.entries(analysis.callGraph || {})) {
      if ((callees as any[]).length > 0) {
        console.log(`   ${caller} → ${(callees as any[]).join(', ')}`);
      }
    }

    // Вычисляем статистику вызовов
    const callCounts: Record<string, number> = {};
    for (const callees of Object.values(analysis.callGraph || {})) {
      for (const callee of callees as any[]) {
        callCounts[callee] = (callCounts[callee] || 0) + 1;
      }
    }

    const mostCalled = Object.entries(callCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (mostCalled.length > 0) {
      console.log('\n   Most called functions:');
      for (const [name, count] of mostCalled) {
        console.log(`   • ${name} (${count} times)`);
      }
    }
  }

  /**
   * Получает экземпляр Command для регистрации
   */
  getCommand(): Command {
    return this.program;
  }
}

// Экспорт по умолчанию
export default VueAnalyzeCommand;
