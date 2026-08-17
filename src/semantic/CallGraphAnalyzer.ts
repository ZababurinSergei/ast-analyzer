// src/semantic/CallGraphAnalyzer.ts
import {
  parseFile,
  buildCallGraph,
  detectEntryPoints,
  partitionFlows,
  initTreeSitter,
  type CallEdge,
  type FunctionNode,
} from '@codeflow-map/core';
import path from 'path';
import fs from 'fs';
import { findWasmPath } from '../utils/wasm-utils.js';

export interface CallGraphNode {
  name: string;
  file: string;
  line: number;
  column: number;
  calls: CallGraphNode[];
  callers: CallGraphNode[];
  isEntry: boolean;
  isAsync: boolean;
  isExported: boolean;
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallEdge[];
  entryPoints: CallGraphNode[];
  cycles: CallEdge[][];
  findUnusedFunctions(): CallGraphNode[];
  findCyclicDependencies(): CallEdge[][];
}

export class CallGraphAnalyzer {
  private nodes: Map<string, CallGraphNode> = new Map();
  private parsedFiles: Map<string, any> = new Map();
  private callEdges: CallEdge[] = [];
  private initialized = false;
  private wasmPath: string;

  constructor(wasmPath?: string) {
    this.wasmPath = wasmPath || findWasmPath();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(this.wasmPath)) {
      console.warn(`  ⚠️ WASM directory not found: ${this.wasmPath}`);
      console.warn('  💡 Create grammars/ directory with WASM files from tree-sitter-wasms');
      this.initialized = false;
      return;
    }

    const wasmFiles = fs.readdirSync(this.wasmPath).filter((f: string) => f.endsWith('.wasm'));
    if (wasmFiles.length === 0) {
      console.warn(`  ⚠️ No WASM files found in: ${this.wasmPath}`);
      console.warn('  💡 Copy WASM files from node_modules/tree-sitter-wasms/out/ to grammars/');
      this.initialized = false;
      return;
    }

    try {
      console.log(`  🚀 Initializing Tree-sitter with WASM from: ${this.wasmPath}`);
      await initTreeSitter(this.wasmPath);
      this.initialized = true;
      console.log(`  ✅ Tree-sitter initialized (${wasmFiles.length} grammars)`);
    } catch (error) {
      console.error(`  ❌ Failed to initialize Tree-sitter: ${error}`);
      this.initialized = false;
    }
  }

  setWasmPath(wasmPath: string): void {
    this.wasmPath = wasmPath;
    this.initialized = false;
  }

  getWasmPath(): string {
    return this.wasmPath;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async analyze(entryPoint: string, maxDepth = 5): Promise<CallGraph> {
    await this.ensureInitialized();

    if (!this.initialized) {
      console.warn('  ⚠️ Call Graph analysis skipped: Tree-sitter not initialized');
      return {
        nodes: new Map(),
        edges: [],
        entryPoints: [],
        cycles: [],
        findUnusedFunctions: () => [],
        findCyclicDependencies: () => [],
      };
    }

    await this.parseDirectory(path.dirname(entryPoint), maxDepth);

    const allFunctions = Array.from(this.parsedFiles.values()).flatMap(p => p.functions || []);
    const allCalls = Array.from(this.parsedFiles.values()).flatMap(p => p.calls || []);

    this.callEdges = buildCallGraph(allFunctions, allCalls);
    this.buildNodes(allFunctions);
    detectEntryPoints(allFunctions, this.callEdges);

    const entryPointsArray: CallGraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.isEntry) {
        entryPointsArray.push(node);
      }
    }

    const flowResult = partitionFlows(allFunctions, this.callEdges);
    const orphans = flowResult?.orphans || [];
    const cycles = this.detectCycles();

    return {
      nodes: this.nodes,
      edges: this.callEdges,
      entryPoints: entryPointsArray,
      cycles,
      findUnusedFunctions: () => this.findUnused(orphans),
      findCyclicDependencies: () => this.detectCycles(),
    };
  }

  async analyzeSingle(filePath: string, _maxDepth = 5): Promise<CallGraph> {
    await this.ensureInitialized();

    if (!this.initialized) {
      console.warn('  ⚠️ Call Graph analysis skipped: Tree-sitter not initialized');
      return {
        nodes: new Map(),
        edges: [],
        entryPoints: [],
        cycles: [],
        findUnusedFunctions: () => [],
        findCyclicDependencies: () => [],
      };
    }

    this.nodes.clear();
    this.parsedFiles.clear();
    this.callEdges = [];

    await this.parseSingleFile(filePath);

    const allFunctions = Array.from(this.parsedFiles.values()).flatMap(p => p.functions || []);
    const allCalls = Array.from(this.parsedFiles.values()).flatMap(p => p.calls || []);

    this.callEdges = buildCallGraph(allFunctions, allCalls);
    this.buildNodes(allFunctions);
    detectEntryPoints(allFunctions, this.callEdges);

    const entryPointsArray: CallGraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.isEntry) {
        entryPointsArray.push(node);
      }
    }

    const flowResult = partitionFlows(allFunctions, this.callEdges);
    const orphans = flowResult?.orphans || [];
    const cycles = this.detectCycles();

    return {
      nodes: this.nodes,
      edges: this.callEdges,
      entryPoints: entryPointsArray,
      cycles,
      findUnusedFunctions: () => this.findUnused(orphans),
      findCyclicDependencies: () => this.detectCycles(),
    };
  }

  private async parseSingleFile(filePath: string): Promise<void> {
    if (this.parsedFiles.has(filePath)) return;

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️ File not found: ${filePath}`);
      return;
    }

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      let language: 'typescript' | 'javascript' = 'typescript';
      let isVue = false;

      if (filePath.endsWith('.vue')) {
        isVue = true;
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch && scriptMatch[1]) {
          content = scriptMatch[1];
          const langMatch = scriptMatch[0].match(/lang=["']([^"']+)["']/);
          if (langMatch && langMatch[1] === 'ts') {
            language = 'typescript';
          } else {
            language = 'javascript';
          }
          content = content.trim();
          console.log(`  📄 Vue script extracted: ${path.basename(filePath)} (${language})`);
        } else {
          console.warn(`  ⚠️ No script found in Vue file: ${filePath}`);
          this.parsedFiles.set(filePath, { functions: [], calls: [] });
          return;
        }
      }

      const extension = path.extname(filePath).slice(1);
      if (['js', 'jsx', 'mjs', 'cjs'].includes(extension) && !isVue) {
        language = 'javascript';
      }

      if (!content || content.trim() === '') {
        console.warn(`  ⚠️ Empty content in: ${filePath}`);
        this.parsedFiles.set(filePath, { functions: [], calls: [] });
        return;
      }

      const parsed = await parseFile(content, filePath, this.wasmPath, language);
      this.parsedFiles.set(filePath, parsed);

      console.log(
        `  📄 Parsed: ${path.basename(filePath)} (${parsed.functions?.length || 0} functions, ${parsed.calls?.length || 0} calls)`
      );
    } catch (error) {
      console.error(`  ❌ Error parsing ${filePath}:`, error);
      this.parsedFiles.set(filePath, { functions: [], calls: [] });
    }
  }

  private async parseDirectory(dir: string, maxDepth: number, currentDepth = 0): Promise<void> {
    if (currentDepth > maxDepth) return;

    let files: string[];

    try {
      files = fs.readdirSync(dir);
    } catch (error) {
      console.warn(`⚠️ Не удалось прочитать директорию ${dir}:`, error);
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    for (const file of files) {
      if (!file) continue;

      const fullPath = path.join(dir, file);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch (error) {
        console.warn(`⚠️ Не удалось получить статус файла ${fullPath}:`, error);
        continue;
      }

      if (stat.isDirectory()) {
        if (!this.shouldIgnore(file)) {
          await this.parseDirectory(fullPath, maxDepth, currentDepth + 1);
        }
      } else if (this.isSupportedFile(file)) {
        await this.parseFile(fullPath);
      }
    }
  }

  private async parseFile(filePath: string): Promise<void> {
    if (this.parsedFiles.has(filePath)) return;

    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      let language: 'typescript' | 'javascript' = 'typescript';
      let isVue = false;

      if (filePath.endsWith('.vue')) {
        isVue = true;
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch && scriptMatch[1]) {
          content = scriptMatch[1];
          const langMatch = scriptMatch[0].match(/lang=["']([^"']+)["']/);
          if (langMatch && langMatch[1] === 'ts') {
            language = 'typescript';
          } else {
            language = 'javascript';
          }
          content = content.trim();
        } else {
          console.warn(`  ⚠️ No script found in Vue file: ${filePath}`);
          this.parsedFiles.set(filePath, { functions: [], calls: [] });
          return;
        }
      }

      const extension = path.extname(filePath).slice(1);
      if (['js', 'jsx', 'mjs', 'cjs'].includes(extension) && !isVue) {
        language = 'javascript';
      }

      if (!content || content.trim() === '') {
        console.warn(`  ⚠️ Empty content in: ${filePath}`);
        this.parsedFiles.set(filePath, { functions: [], calls: [] });
        return;
      }

      const parsed = await parseFile(content, filePath, this.wasmPath, language);
      this.parsedFiles.set(filePath, parsed);

      console.log(
        `  📄 Parsed: ${path.basename(filePath)} (${parsed.functions?.length || 0} functions, ${parsed.calls?.length || 0} calls)`
      );
    } catch (error) {
      console.error(`  ❌ Error parsing ${filePath}:`, error);
    }
  }

  private buildNodes(functions: FunctionNode[]): void {
    for (const func of functions) {
      const node: CallGraphNode = {
        name: func.name,
        file: func.filePath,
        line: func.startLine,
        column: 0,
        calls: [],
        callers: [],
        isEntry: func.isEntryPoint || false,
        isAsync: func.isAsync,
        isExported: func.isExported,
      };

      this.nodes.set(func.name, node);
    }

    for (const edge of this.callEdges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (fromNode && toNode) {
        if (!fromNode.calls.includes(toNode)) {
          fromNode.calls.push(toNode);
        }
        if (!toNode.callers.includes(fromNode)) {
          toNode.callers.push(fromNode);
        }
      }
    }
  }

  private detectCycles(): CallEdge[][] {
    const cycles: CallEdge[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeName: string) => {
      if (recursionStack.has(nodeName)) {
        const cycleStart = stack.indexOf(nodeName);
        const cycleNodes = stack.slice(cycleStart);
        const cycleEdges: CallEdge[] = [];

        for (let i = 0; i < cycleNodes.length - 1; i++) {
          const edge = this.callEdges.find(
            e => e.from === cycleNodes[i] && e.to === cycleNodes[i + 1]
          );
          if (edge) cycleEdges.push(edge);
        }

        if (cycleNodes.length > 1) {
          const lastEdge = this.callEdges.find(
            e => e.from === cycleNodes[cycleNodes.length - 1] && e.to === cycleNodes[0]
          );
          if (lastEdge) cycleEdges.push(lastEdge);
        }

        if (cycleEdges.length > 0) {
          cycles.push(cycleEdges);
        }
        return;
      }

      if (visited.has(nodeName)) return;

      visited.add(nodeName);
      recursionStack.add(nodeName);
      stack.push(nodeName);

      const node = this.nodes.get(nodeName);
      if (node) {
        for (const callee of node.calls) {
          dfs(callee.name);
        }
      }

      recursionStack.delete(nodeName);
      stack.pop();
    };

    for (const nodeName of this.nodes.keys()) {
      if (!visited.has(nodeName)) {
        dfs(nodeName);
      }
    }

    return cycles;
  }

  private findUnused(orphans: string[]): CallGraphNode[] {
    return orphans
      .map(name => this.nodes.get(name))
      .filter((node): node is CallGraphNode => node !== undefined);
  }

  private shouldIgnore(dir: string): boolean {
    const ignored = ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'];
    return ignored.includes(dir);
  }

  private isSupportedFile(file: string): boolean {
    const supported = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];
    return supported.includes(path.extname(file));
  }

  getJSXFiles(rootDir: string): string[] {
    const jsxFiles: string[] = [];

    const walk = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!this.shouldIgnore(file)) {
              walk(fullPath);
            }
          } else if (file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.vue')) {
            jsxFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error walking ${dir}:`, error);
      }
    };

    walk(rootDir);
    return jsxFiles;
  }

  async analyzeAllJSXComponents(rootDir: string): Promise<Map<string, string[]>> {
    const jsxFiles = this.getJSXFiles(rootDir);
    const allComponentDeps = new Map<string, string[]>();

    for (const file of jsxFiles) {
      await this.parseFile(file);
      console.log(`  ⚛️ Found JSX/Vue file: ${path.basename(file)}`);
    }

    return allComponentDeps;
  }

  exportToJSON(includeJSXInfo = false): any {
    const exportData: any = {
      nodes: Array.from(this.nodes.entries()).map(([name, node]) => ({
        name,
        file: node.file,
        line: node.line,
        isEntry: node.isEntry,
        isAsync: node.isAsync,
        isExported: node.isExported,
        calls: node.calls.map(c => c.name),
        callers: node.callers.map(c => c.name),
      })),
      edges: this.callEdges,
      cycles: this.detectCycles().map(cycle => cycle.map(e => `${e.from}->${e.to}`)),
    };

    if (includeJSXInfo) {
      const totalComponents = Array.from(this.nodes.values()).filter(
        n => n.name && n.name.length > 0 && n.name.charAt(0) === n.name.charAt(0).toUpperCase()
      ).length;
      exportData.jsxInfo = {
        totalComponents,
      };
    }

    return exportData;
  }

  generateJSXReport(): string {
    let report = '# ⚛️ JSX/Vue Components Report\n\n';

    const jsxComponents = Array.from(this.nodes.values()).filter(
      node =>
        node.name &&
        node.name.length > 0 &&
        node.name.charAt(0) === node.name.charAt(0).toUpperCase()
    );

    report += '## 📊 Statistics\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Total components | ${jsxComponents.length} |\n`;
    report += `| Entry components | ${jsxComponents.filter(c => c.isEntry).length} |\n`;
    report += `| Async components | ${jsxComponents.filter(c => c.isAsync).length} |\n`;
    report += `| Exported components | ${jsxComponents.filter(c => c.isExported).length} |\n\n`;

    if (jsxComponents.length > 0) {
      report += '## 🧩 Components\n\n';
      for (const component of jsxComponents.slice(0, 20)) {
        report += `### ${component.name}\n`;
        report += `- **File:** \`${path.basename(component.file)}\`\n`;
        report += `- **Line:** ${component.line}\n`;
        report += `- **Exported:** ${component.isExported ? '✅' : '❌'}\n`;

        if (component.calls.length > 0) {
          report += `- **Uses components:** ${component.calls.map(c => c.name).join(', ')}\n`;
        }

        if (component.callers.length > 0) {
          report += `- **Used by:** ${component.callers.map(c => c.name).join(', ')}\n`;
        }

        report += '\n';
      }

      if (jsxComponents.length > 20) {
        report += `\n*... and ${jsxComponents.length - 20} more components*\n`;
      }
    }

    return report;
  }

  extractVueFunctions(content: string): { functions: string[]; calls: Record<string, string[]> } {
    const functions: string[] = [];
    const calls: Record<string, string[]> = {};

    const functionMatches = content.match(/function\s+(\w+)\s*\(/g);
    if (functionMatches) {
      for (const match of functionMatches) {
        const name = match.replace(/function\s+/, '').replace(/\s*\(/, '');
        if (name) {
          functions.push(name);
          calls[name] = [];
        }
      }
    }

    const arrowMatches = content.match(/const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g);
    if (arrowMatches) {
      for (const match of arrowMatches) {
        const name = match.replace(/const\s+/, '').replace(/\s*=.*/, '');
        if (name && !functions.includes(name)) {
          functions.push(name);
          calls[name] = [];
        }
      }
    }

    const vueMacros = ['defineProps', 'defineEmits', 'defineExpose', 'withDefaults'];
    for (const macro of vueMacros) {
      const macroMatches = content.match(new RegExp(`\\b${macro}\\s*\\(`, 'g'));
      if (macroMatches) {
        if (!functions.includes(macro)) {
          functions.push(macro);
          calls[macro] = [];
        }
      }
    }

    for (const func of functions) {
      const callMatches = content.match(new RegExp(`\\b${func}\\s*\\(`, 'g'));
      if (callMatches && callMatches.length > 0) {
        const allCalls = content.match(/\b(\w+)\s*\(/g);
        if (allCalls) {
          for (const call of allCalls) {
            const calledName = call.replace(/\s*\(/, '');
            if (calledName && calledName !== func && functions.includes(calledName)) {
              if (!calls[func]) calls[func] = [];
              if (!calls[func].includes(calledName)) {
                calls[func].push(calledName);
              }
            }
          }
        }
      }
    }

    return { functions, calls };
  }

  async analyzeVueFile(filePath: string): Promise<{
    functions: string[];
    calls: Record<string, string[]>;
    imports: string[];
    composables: string[];
  }> {
    const result = {
      functions: [] as string[],
      calls: {} as Record<string, string[]>,
      imports: [] as string[],
      composables: [] as string[],
    };

    if (!filePath.endsWith('.vue')) {
      return result;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch || !scriptMatch[1]) {
        return result;
      }

      const script = scriptMatch[1];

      const importMatches = script.match(/import\s+.*?from\s+['"][^'"]+['"]/g);
      if (importMatches) {
        for (const imp of importMatches) {
          const sourceMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
          if (sourceMatch && sourceMatch[1]) {
            result.imports.push(sourceMatch[1]);
          }
        }
      }

      const composableMatches = script.match(/\b(use\w+)\s*\(/g);
      if (composableMatches) {
        for (const match of composableMatches) {
          const name = match.replace(/\s*\(/, '');
          if (name && !result.composables.includes(name)) {
            result.composables.push(name);
          }
        }
      }

      const vueFunctions = this.extractVueFunctions(script);
      result.functions = vueFunctions.functions;
      result.calls = vueFunctions.calls;

      for (const comp of result.composables) {
        if (!result.functions.includes(comp)) {
          result.functions.push(comp);
          result.calls[comp] = [];
        }
      }
    } catch (error) {
      console.error(`  ❌ Error analyzing Vue file ${filePath}:`, error);
    }

    return result;
  }

  async analyzeAllVueFiles(rootDir: string, maxDepth = 5): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    const walk = async (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!this.shouldIgnore(file)) {
              await walk(fullPath, depth + 1);
            }
          } else if (file.endsWith('.vue')) {
            console.log(`  📄 Analyzing Vue file: ${file}`);
            const analysis = await this.analyzeVueFile(fullPath);
            results.set(fullPath, analysis);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error walking ${dir}:`, error);
      }
    };

    await walk(rootDir, 0);
    return results;
  }

  /**
   * ✅ ИСПРАВЛЕНО: используем filePath в отчете
   */
  generateVueReport(analysisMap: Map<string, any>): string {
    let report = '# 🎯 Vue Components Analysis Report\n\n';

    let totalFunctions = 0;
    let totalComposables = 0;
    let totalImports = 0;

    for (const [, analysis] of analysisMap) {
      totalFunctions += analysis.functions?.length || 0;
      totalComposables += analysis.composables?.length || 0;
      totalImports += analysis.imports?.length || 0;
    }

    report += '## 📊 Statistics\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Total Vue files | ${analysisMap.size} |\n`;
    report += `| Total functions | ${totalFunctions} |\n`;
    report += `| Total composables | ${totalComposables} |\n`;
    report += `| Total imports | ${totalImports} |\n\n`;

    for (const [filePath, analysis] of analysisMap) {
      const fileName = path.basename(filePath);
      report += `## 📄 ${fileName}\n\n`;
      report += `**Path:** \`${filePath}\`\n\n`;

      if (analysis.functions && analysis.functions.length > 0) {
        report += '### Functions\n\n';
        for (const func of analysis.functions) {
          const calls = analysis.calls?.[func] || [];
          const callStr = calls.length > 0 ? ` → calls: ${calls.join(', ')}` : '';
          report += `- \`${func}\`${callStr}\n`;
        }
        report += '\n';
      }

      if (analysis.composables && analysis.composables.length > 0) {
        report += '### Composables\n\n';
        for (const comp of analysis.composables) {
          report += `- \`${comp}\`\n`;
        }
        report += '\n';
      }

      if (analysis.imports && analysis.imports.length > 0) {
        report += '### Imports\n\n';
        for (const imp of analysis.imports) {
          report += `- \`${imp}\`\n`;
        }
        report += '\n';
      }

      report += '---\n\n';
    }

    return report;
  }
}
