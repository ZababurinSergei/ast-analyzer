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
    // ✅ Используем переданный путь или ищем по умолчанию
    this.wasmPath = wasmPath || path.resolve(process.cwd(), 'grammars');
  }

  /**
   * Инициализация Tree-sitter (однократная)
   */
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

  /**
   * ✅ Установить путь к WASM директории
   */
  setWasmPath(wasmPath: string): void {
    this.wasmPath = wasmPath;
    this.initialized = false; // Требует переинициализации
  }

  /**
   * ✅ Получить текущий путь к WASM директории
   */
  getWasmPath(): string {
    return this.wasmPath;
  }

  /**
   * ✅ Проверить, инициализирован ли анализатор
   */
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

  /**
   * Анализирует только один файл, без рекурсивного обхода директории
   */
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

    // Очищаем состояние для нового анализа
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
      const content = fs.readFileSync(filePath, 'utf-8');
      const extension = path.extname(filePath).slice(1);

      let language: 'typescript' | 'javascript' = 'typescript';
      if (['js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
        language = 'javascript';
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

  /**
   * Анализирует JSX компоненты в файле
   * @param sourceFile - исходный файл (SourceFile из ts-morph)
   * @returns Map зависимостей компонентов
   */
  analyzeJSXComponents(sourceFile: any): Map<string, string[]> {
    const componentDeps = new Map<string, string[]>();

    const visit = (node: any) => {
      if (!node) return;

      // JSX элементы (открывающие и закрывающие теги)
      const kind = node.getKind?.();

      // Проверка на JSX элемент (Kind = 286 для JsxElement в ts-morph)
      if (kind === 286) {
        // JsxElement
        const jsxElement = node;
        const openingElement = jsxElement.getOpeningElement?.();
        if (openingElement) {
          const tagNameNode = openingElement.getTagNameNode?.();
          const tagName = tagNameNode?.getText?.() || 'unknown';

          // React компоненты начинаются с заглавной буквы
          if (tagName && tagName[0] === tagName[0].toUpperCase()) {
            const currentFunction = this.getCurrentFunction(node);
            if (currentFunction) {
              if (!componentDeps.has(currentFunction)) {
                componentDeps.set(currentFunction, []);
              }
              const deps = componentDeps.get(currentFunction);
              if (deps && !deps.includes(tagName)) {
                deps.push(tagName);
              }
            }
          }
        }
      }

      // JSX самозакрывающиеся элементы (Kind = 287 для JsxSelfClosingElement)
      if (kind === 287) {
        // JsxSelfClosingElement
        const jsxSelfClosing = node;
        const tagNameNode = jsxSelfClosing.getTagNameNode?.();
        const tagName = tagNameNode?.getText?.() || 'unknown';

        if (tagName && tagName[0] === tagName[0].toUpperCase()) {
          const currentFunction = this.getCurrentFunction(node);
          if (currentFunction) {
            if (!componentDeps.has(currentFunction)) {
              componentDeps.set(currentFunction, []);
            }
            const deps = componentDeps.get(currentFunction);
            if (deps && !deps.includes(tagName)) {
              deps.push(tagName);
            }
          }
        }
      }

      // Фрагменты JSX (Kind = 288 для JsxFragment)
      if (kind === 288) {
        // JsxFragment
        const currentFunction = this.getCurrentFunction(node);
        if (currentFunction) {
          if (!componentDeps.has(currentFunction)) {
            componentDeps.set(currentFunction, []);
          }
          const deps = componentDeps.get(currentFunction);
          if (deps && !deps.includes('Fragment')) {
            deps.push('Fragment');
          }
        }
      }

      // Рекурсивный обход детей
      if (node.forEachChild) {
        node.forEachChild(visit);
      } else if (node.getChildren) {
        const children = node.getChildren();
        if (children) {
          children.forEach(visit);
        }
      }
    };

    if (sourceFile && sourceFile.forEachChild) {
      sourceFile.forEachChild(visit);
    }

    return componentDeps;
  }

  /**
   * Находит текущую функцию для узла
   */
  private getCurrentFunction(node: any): string | null {
    let current = node;
    const maxDepth = 50; // Предотвращаем бесконечный цикл
    let depth = 0;

    while (current && depth < maxDepth) {
      depth++;
      const kind = current.getKind?.();

      // FunctionDeclaration (Kind = 174)
      if (kind === 174) {
        const func = current;
        const name = func.getName?.();
        if (name) return name;
      }

      // VariableDeclaration (Kind = 201) для стрелочных функций
      if (kind === 201) {
        const varDecl = current;
        const name = varDecl.getName?.();
        const initializer = varDecl.getInitializer?.();
        if (name && initializer) {
          const initKind = initializer.getKind?.();
          // ArrowFunction (Kind = 215) или FunctionExpression (Kind = 173)
          if (initKind === 215 || initKind === 173) {
            return name;
          }
        }
      }

      // MethodDeclaration (Kind = 178)
      if (kind === 178) {
        const method = current;
        const name = method.getName?.();
        if (name) return name;
      }

      // ArrowFunction (Kind = 215) - ищем родительскую переменную
      if (kind === 215) {
        const parent = current.getParent?.();
        if (parent) {
          const parentKind = parent.getKind?.();
          if (parentKind === 201) {
            // VariableDeclaration
            const name = parent.getName?.();
            if (name) return name;
          }
        }
      }

      current = current.getParent?.();
    }

    return null;
  }

  /**
   * Извлекает все импорты React компонентов из файла
   */
  extractReactImports(sourceFile: any): Map<string, string[]> {
    const imports = new Map<string, string[]>();

    const visit = (node: any) => {
      if (!node) return;

      const kind = node.getKind?.();

      // ImportDeclaration (Kind = 262)
      if (kind === 262) {
        const importDecl = node;
        const source = importDecl.getModuleSpecifier?.()?.getLiteralValue?.();

        if (source === 'react' || source?.startsWith('react-')) {
          const namedImports = importDecl.getNamedImports?.() || [];
          const defaultImport = importDecl.getDefaultImport?.();

          const components: string[] = [];

          if (defaultImport) {
            const defaultName = defaultImport.getText?.();
            if (defaultName) components.push(defaultName);
          }

          for (const named of namedImports) {
            const name = named.getName?.();
            if (name) components.push(name);
          }

          if (components.length > 0) {
            imports.set(source, components);
          }
        }
      }

      node.forEachChild?.(visit);
    };

    if (sourceFile && sourceFile.forEachChild) {
      sourceFile.forEachChild(visit);
    }

    return imports;
  }

  /**
   * Проверяет, является ли компонент пользовательским (не встроенным HTML тегом)
   */
  isCustomComponent(componentName: string, reactImports: Map<string, string[]>): boolean {
    // Добавлена проверка, что строка не пустая
    if (!componentName || componentName.length === 0) return false;

    // Встроенные HTML теги
    const htmlTags = new Set([
      'div',
      'span',
      'p',
      'a',
      'button',
      'input',
      'form',
      'label',
      'ul',
      'ol',
      'li',
      'table',
      'tr',
      'td',
      'th',
      'thead',
      'tbody',
      'section',
      'article',
      'header',
      'footer',
      'nav',
      'main',
      'aside',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'video',
      'audio',
      'canvas',
      'svg',
      'path',
      'circle',
      'rect',
      'g',
      'defs',
    ]);

    if (htmlTags.has(componentName)) return false;

    // Проверяем, импортирован ли компонент из react
    for (const [, components] of reactImports) {
      if (components.includes(componentName)) return true;
    }

    // Компоненты с заглавной буквы считаются пользовательскими
    const firstChar = componentName.charAt(0);
    return firstChar === firstChar.toUpperCase();
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

    // Проверяем, что files не пустой и является массивом
    if (!files || files.length === 0) {
      return;
    }

    // Используем for...of вместо for с индексами (чище)
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
      const content = fs.readFileSync(filePath, 'utf-8');
      const extension = path.extname(filePath).slice(1);

      // Определяем язык по расширению с поддержкой JSX/TSX
      let language: 'typescript' | 'javascript' = 'typescript';
      if (['js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
        language = 'javascript';
      }

      // Для JSX/TSX файлов используем специальные настройки
      if (extension === 'jsx' || extension === 'tsx') {
        console.log(`  ⚛️ Parsing JSX/TSX file: ${path.basename(filePath)}`);
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

    // Связываем узлы
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
        // Нашли цикл
        const cycleStart = stack.indexOf(nodeName);
        const cycleNodes = stack.slice(cycleStart);
        const cycleEdges: CallEdge[] = [];

        for (let i = 0; i < cycleNodes.length - 1; i++) {
          const edge = this.callEdges.find(
            e => e.from === cycleNodes[i] && e.to === cycleNodes[i + 1]
          );
          if (edge) cycleEdges.push(edge);
        }

        // Добавляем последнее ребро, замыкающее цикл
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
    // Поддерживаем JSX и TSX наравне с обычными файлами
    const supported = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    return supported.includes(path.extname(file));
  }

  /**
   * Получить все JSX/TSX файлы в проекте
   */
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
          } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
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

  /**
   * Анализирует все JSX компоненты в проекте
   */
  async analyzeAllJSXComponents(rootDir: string): Promise<Map<string, string[]>> {
    const jsxFiles = this.getJSXFiles(rootDir);
    const allComponentDeps = new Map<string, string[]>();

    for (const file of jsxFiles) {
      await this.parseFile(file);
      console.log(`  ⚛️ Found JSX file: ${path.basename(file)}`);
    }

    return allComponentDeps;
  }

  /**
   * Экспорт графа вызовов в формате JSON с поддержкой JSX
   */
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

  /**
   * Генерация отчета о JSX компонентах
   */
  generateJSXReport(): string {
    let report = '# ⚛️ JSX/TSX Components Report\n\n';

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
}
