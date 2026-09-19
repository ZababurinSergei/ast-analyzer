// packages/ast-analyzer/src/core/ProjectGraphBuilder.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ - ПОЛНЫЙ ТЕКСТ

import path from 'path';
import fs from 'fs';
import { parseFile, resolveFilePath, isExternalModule } from './ast-parser.js';
import { resolveAbsolutePath, normalizePathForOS } from '../utils/path-utils.js';
import { loadTsConfig } from './tsconfig-resolver.js';
import { walk } from 'estree-walker';
import { DEFAULT_EXCLUDE_PATTERNS } from '../config.js';
import { IGNORE_NODE_MODULES } from '../config.js';

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
}

export interface ProjectGraphOptions {
  maxDepth?: number;
  excludePatterns?: string[];
  includeExternal?: boolean;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  hasCycles: boolean;
  cyclesCount: number;
}

export class ProjectGraphBuilder {
  private graph: Record<string, string[]> = {};
  private visited = new Set<string>();
  private options: ProjectGraphOptions;
  private tsConfig: any = null;
  private tsConfigDir: string | null = null;
  private depthMap: Map<string, number> = new Map();

  constructor(options: ProjectGraphOptions = {}) {
    this.options = {
      maxDepth: Infinity,
      excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
      includeExternal: false,
      ...options,
    };
  }

  /**
   * Строит граф зависимостей проекта от точки входа
   */
  build(entryPoint: string): GraphData {
    const rootAbsPath = resolveAbsolutePath(entryPoint);

    // Загружаем tsconfig для резолвинга алиасов
    this.loadTsConfigForProject(rootAbsPath);

    const queue: { path: string; depth: number; isRoot: boolean }[] = [
      { path: rootAbsPath, depth: 1, isRoot: true },
    ];

    while (queue.length > 0) {
      const { path: currentPath, depth, isRoot } = queue.shift()!;

      if (depth > (this.options.maxDepth || Infinity)) continue;
      if (this.visited.has(currentPath)) continue;
      this.visited.add(currentPath);

      const relativeKey = path.relative(process.cwd(), currentPath) || currentPath;
      if (!this.graph[relativeKey]) {
        this.graph[relativeKey] = [];
      }

      // Пропускаем стилевые файлы
      if (this.isStyleFile(currentPath)) {
        continue;
      }

      const parsed = parseFile(currentPath);
      if (!parsed) {
        continue;
      }

      const ast = parsed.ast;
      const currentDir = path.dirname(currentPath);
      const imports = this.collectImports(ast);

      let allDeps = [...imports];
      if (isRoot) {
        const reExports = this.collectReExports(ast);
        allDeps = [...new Set([...allDeps, ...reExports])];
      }

      for (const target of allDeps) {
        const isAlias = target.startsWith('@') || target.startsWith('#') || target.startsWith('~');

        if (!isAlias && IGNORE_NODE_MODULES && isExternalModule(target)) {
          continue;
        }

        let resolvedPath = this.resolveImportPath(currentDir, target);

        if (!resolvedPath) {
          const asDirectory = path.resolve(currentDir, target);
          if (fs.existsSync(asDirectory) && fs.statSync(asDirectory).isDirectory()) {
            resolvedPath = asDirectory;
          }
        }

        if (resolvedPath) {
          if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
            const expanded = this.expandFolderReExports(resolvedPath);
            for (const exp of expanded) {
              const depKey = path.relative(process.cwd(), exp);
              if (!this.graph[relativeKey].includes(depKey)) {
                this.graph[relativeKey].push(depKey);
              }
              queue.push({ path: exp, depth: depth + 1, isRoot: false });
            }
          } else {
            const depKey = path.relative(process.cwd(), resolvedPath);
            if (!this.graph[relativeKey].includes(depKey)) {
              this.graph[relativeKey].push(depKey);
            }
            queue.push({ path: resolvedPath, depth: depth + 1, isRoot: false });
          }
        } else {
          if (!this.graph[relativeKey].includes(target)) {
            this.graph[relativeKey].push(target);
          }
        }
      }
    }

    // Заполняем depthMap (уровни модулей)
    this.computeLevels();

    return {
      rootKey: normalizePathForOS(path.relative(process.cwd(), rootAbsPath) || rootAbsPath),
      graph: this.normalizeGraph(),
    };
  }

  /**
   * Загружает tsconfig для проекта
   */
  private loadTsConfigForProject(filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      const config = loadTsConfig(dir);
      if (config) {
        this.tsConfig = config;
        this.tsConfigDir = dir;
      }
    } catch (error) {
      // Игнорируем ошибки загрузки tsconfig
    }
  }

  /**
   * Разрешает путь импорта с учетом алиасов из tsconfig
   */
  private resolveImportPath(baseDir: string, target: string): string | null {
    // Сначала пробуем стандартный резолвинг
    const resolved = resolveFilePath(baseDir, target);
    if (resolved) return resolved;

    // Если не нашли и есть tsconfig с алиасами, пробуем их
    if (this.tsConfig && this.tsConfigDir) {
      const aliasedPath = this.resolveAliasPath(target);
      if (aliasedPath && fs.existsSync(aliasedPath)) {
        return aliasedPath;
      }
    }

    return null;
  }

  /**
   * Разрешает путь с помощью алиасов из tsconfig
   */
  private resolveAliasPath(importPath: string): string | null {
    if (!this.tsConfig?.compilerOptions?.paths || !this.tsConfigDir) {
      return null;
    }

    const paths = this.tsConfig.compilerOptions.paths;
    const baseUrl = this.tsConfig.compilerOptions.baseUrl || '.';
    const baseUrlPath = path.resolve(this.tsConfigDir, baseUrl);

    for (const [alias, targets] of Object.entries(paths)) {
      if (!targets || !Array.isArray(targets) || targets.length === 0) {
        continue;
      }

      // Преобразуем паттерн алиаса в регулярное выражение
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = escapedAlias.replace(/\\\*/g, '(.*)');
      const regex = new RegExp(`^${pattern}$`);
      const match = importPath.match(regex);

      if (match) {
        let targetPath = targets[0];
        if (!targetPath) continue;

        // Заменяем * на захваченные группы
        for (let i = 1; i < match.length; i++) {
          const replacement = match[i];
          if (replacement !== undefined) {
            targetPath = targetPath.replace('*', replacement);
          }
        }

        // Резолвим относительно baseUrl
        const resolvedPath = path.resolve(baseUrlPath, targetPath);

        // Проверяем существование файла с разными расширениями
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs', ''];
        for (const ext of extensions) {
          const testPath = resolvedPath + ext;
          if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
            return testPath;
          }
          // Проверка на index файл
          const indexPath = path.join(resolvedPath, `index${ext}`);
          if (ext && fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
            return indexPath;
          }
        }

        return resolvedPath;
      }
    }

    return null;
  }

  private collectImports(ast: any): string[] {
    const imports: string[] = [];
    if (!ast) return imports;

    walk(ast, {
      enter(node: any) {
        if (
          (node.type === 'ImportDeclaration' ||
            node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportAllDeclaration') &&
          node.source
        ) {
          imports.push(node.source.value);
        }
        if (node.type === 'ImportExpression' && node.source && node.source.type === 'Literal') {
          imports.push(node.source.value);
        }
        if (
          node.type === 'CallExpression' &&
          node.callee &&
          node.callee.name === 'require' &&
          node.arguments[0] &&
          node.arguments[0].type === 'Literal'
        ) {
          imports.push(node.arguments[0].value);
        }
      },
    });

    return imports;
  }

  private collectReExports(ast: any): string[] {
    const reExports: string[] = [];
    if (!ast) return reExports;

    walk(ast, {
      enter(node: any) {
        if (
          node.type === 'ExportNamedDeclaration' &&
          node.source &&
          node.specifiers &&
          node.specifiers.length > 0
        ) {
          reExports.push(node.source.value);
        }
        if (node.type === 'ExportAllDeclaration' && node.source) {
          reExports.push(node.source.value);
        }
        if (node.type === 'ExportDefaultDeclaration' && node.source) {
          reExports.push(node.source.value);
        }
      },
    });

    return reExports;
  }

  private expandFolderReExports(folderPath: string): string[] {
    const resolvedFiles: string[] = [];
    const extensions = ['.ts', '.js', '.mjs', '.cjs'];

    for (const ext of extensions) {
      const indexPath = path.join(folderPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        const parsed = parseFile(indexPath);
        if (parsed) {
          const ast = parsed.ast;
          const reExports = this.collectReExports(ast);
          for (const re of reExports) {
            const resolved = this.resolveImportPath(path.dirname(indexPath), re);
            if (resolved) {
              resolvedFiles.push(resolved);
            }
          }
        }
        break;
      }
    }

    return resolvedFiles;
  }

  private isStyleFile(filePath: string): boolean {
    const styleExtensions = ['.css', '.scss', '.less', '.sass', '.styl'];
    return styleExtensions.some(ext => filePath.endsWith(ext));
  }

  private normalizeGraph(): Record<string, string[]> {
    const normalized: Record<string, string[]> = {};
    for (const [key, deps] of Object.entries(this.graph)) {
      const normalizedKey = normalizePathForOS(key);
      normalized[normalizedKey] = deps.map(d => normalizePathForOS(d));
    }
    return normalized;
  }

  /**
   * Вычисляет уровни модулей (BFS)
   */
  private computeLevels(): void {
    const visited = new Set<string>();
    const queue: { module: string; level: number }[] = [];

    // Находим корневые модули (те, на которые никто не ссылается)
    const called = new Set<string>();
    for (const [, deps] of Object.entries(this.graph)) {
      for (const dep of deps) {
        called.add(dep);
      }
    }

    const roots = Object.keys(this.graph).filter(m => !called.has(m));

    if (roots.length === 0) {
      for (const module of Object.keys(this.graph)) {
        queue.push({ module, level: 0 });
      }
    } else {
      for (const root of roots) {
        queue.push({ module: root, level: 0 });
      }
    }

    while (queue.length > 0) {
      const { module, level } = queue.shift()!;
      if (visited.has(module)) continue;
      visited.add(module);

      this.depthMap.set(module, level);

      const deps = this.graph[module] || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          queue.push({ module: dep, level: level + 1 });
        }
      }
    }
  }

  /**
   * Возвращает карту глубин (уровней)
   */
  getDepthMap(): Map<string, number> {
    return this.depthMap || new Map();
  }

  /**
   * Генерирует DOT представление графа
   */
  toDOT(): string {
    let dot = 'digraph Dependencies {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
    dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';
    for (const [from, deps] of Object.entries(this.graph)) {
      for (const to of deps) {
        dot += `  "${from}" -> "${to}";\n`;
      }
    }
    dot += '}\n';
    return dot;
  }

  /**
   * Находит путь между двумя модулями (BFS)
   */
  findPath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const queue: { node: string; path: string[] }[] = [{ node: from, path: [from] }];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const deps = this.graph[node] || [];
      for (const dep of deps) {
        if (dep === to) return [...path, dep];
        if (!visited.has(dep)) queue.push({ node: dep, path: [...path, dep] });
      }
    }
    return null;
  }

  /**
   * Находит циклические зависимости
   */
  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      const deps = this.graph[node] || [];
      for (const dep of deps) {
        dfs(dep);
      }
      recursionStack.delete(node);
      path.pop();
    };

    for (const node of Object.keys(this.graph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    return cycles;
  }

  /**
   * Проверяет, есть ли циклы в графе
   */
  findCyclesLegacy(): string[][] {
    return this.findCycles();
  }

  /**
   * Возвращает статистику графа
   */
  getStats(): GraphStats {
    let totalEdges = 0;
    for (const deps of Object.values(this.graph)) {
      totalEdges += deps.length;
    }

    const cycles = this.findCycles();

    return {
      totalNodes: Object.keys(this.graph).length,
      totalEdges,
      hasCycles: cycles.length > 0,
      cyclesCount: cycles.length,
    };
  }

  /**
   * Получить граф
   */
  getGraph(): Record<string, string[]> {
    return this.graph;
  }

  /**
   * Получить посещенные узлы
   */
  getVisited(): Set<string> {
    return this.visited;
  }
}

// Экспорт по умолчанию
export default ProjectGraphBuilder;
