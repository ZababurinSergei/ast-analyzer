// src/core/data-sources.ts
// Единые источники истины для всех модулей

import type { EntitiesResult } from './entity-extractor.js';
import fs from 'fs';
import path from 'path';

// ============================================
// 1. ЕДИНЫЙ ИСТОЧНИК ДЛЯ СУЩНОСТЕЙ
// ============================================

export interface EntityDataSource {
  /** Карта модуль → сущности */
  entitiesMap: Map<string, EntitiesResult>;
  /** Кэш функций по имени */
  functionIndex: Map<string, { module: string; func: any }>;
  /** Кэш классов по имени */
  classIndex: Map<string, { module: string; cls: any }>;
  /** Кэш констант по имени */
  constantIndex: Map<string, { module: string; const: any }>;
  /** Кэш интерфейсов по имени */
  interfaceIndex: Map<string, { module: string; intf: any }>;
  /** Кэш типов по имени */
  typeIndex: Map<string, { module: string; type: any }>;
  /** Кэш переменных по имени */
  variableIndex: Map<string, { module: string; var: any }>;
  /** Общая статистика */
  stats: {
    totalFunctions: number;
    totalClasses: number;
    totalConstants: number;
    totalInterfaces: number;
    totalTypes: number;
    totalVariables: number;
    totalCalls: number;
  };
  /** Временная метка */
  timestamp: string;
  /** Версия */
  version: string;
}

// ============================================
// 2. ЕДИНЫЙ ИСТОЧНИК ДЛЯ ГРАФА
// ============================================

export interface GraphDataSource {
  /** Корневой модуль */
  rootKey: string;
  /** Граф зависимостей */
  graph: Map<string, Set<string>>;
  /** Обратный граф */
  reverseGraph: Map<string, Set<string>>;
  /** Все модули */
  modules: Set<string>;
  /** Циклические зависимости */
  cycles: string[][];
  /** Максимальная глубина */
  maxDepth: number;
  /** Уровни модулей */
  levels: Map<string, number>;
}

// ============================================
// 3. ЕДИНЫЙ ИСТОЧНИК ДЛЯ ПАКЕТОВ
// ============================================

export type PackageLanguage = 'typescript' | 'javascript' | 'vue' | 'jsx';

export interface PackageData {
  imports: Set<string>;
  exports: Set<string>;
  functions: Set<string>;
  classes: Set<string>;
  constants: Set<string>;
  interfaces: Set<string>;
  types: Set<string>;
  variables: Set<string>;
  size: number;
  lines: number;
  language: PackageLanguage;
  isEntry: boolean;
}

export interface PackageDataSource {
  /** Пакеты по модулям */
  packages: Map<string, PackageData>;
  /** Зависимости между пакетами */
  dependencies: Map<string, Set<string>>;
  /** Статистика пакетов */
  stats: {
    totalPackages: number;
    totalImports: number;
    totalExports: number;
    avgSize: number;
    avgLines: number;
  };
}

// ============================================
// 4. ГЛОБАЛЬНЫЙ КОНТЕКСТ
// ============================================

export interface GlobalDataSource {
  /** Источник сущностей */
  entities: EntityDataSource;
  /** Источник графа */
  graph: GraphDataSource;
  /** Источник пакетов */
  packages: PackageDataSource;
  /** Корневая директория проекта */
  projectRoot: string;
  /** Временная метка */
  timestamp: string;
  /** Версия */
  version: string;
}

// ============================================
// 5. ПОСТРОИТЕЛЬ ЕДИНЫХ ИСТОЧНИКОВ
// ============================================

export class DataSourceBuilder {
  private entitySource: EntityDataSource;
  private graphSource: GraphDataSource;
  private packageSource: PackageDataSource;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.entitySource = this.createEmptyEntitySource();
    this.graphSource = this.createEmptyGraphSource();
    this.packageSource = this.createEmptyPackageSource();
  }

  private createEmptyEntitySource(): EntityDataSource {
    return {
      entitiesMap: new Map(),
      functionIndex: new Map(),
      classIndex: new Map(),
      constantIndex: new Map(),
      interfaceIndex: new Map(),
      typeIndex: new Map(),
      variableIndex: new Map(),
      stats: {
        totalFunctions: 0,
        totalClasses: 0,
        totalConstants: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalVariables: 0,
        totalCalls: 0,
      },
      timestamp: new Date().toISOString(),
      version: '3.0.0',
    };
  }

  private createEmptyGraphSource(): GraphDataSource {
    return {
      rootKey: '',
      graph: new Map(),
      reverseGraph: new Map(),
      modules: new Set(),
      cycles: [],
      maxDepth: 0,
      levels: new Map(),
    };
  }

  private createEmptyPackageSource(): PackageDataSource {
    return {
      packages: new Map(),
      dependencies: new Map(),
      stats: {
        totalPackages: 0,
        totalImports: 0,
        totalExports: 0,
        avgSize: 0,
        avgLines: 0,
      },
    };
  }

  /**
   * Определяет язык по расширению файла
   */
  private detectLanguage(modulePath: string): PackageLanguage {
    if (modulePath.endsWith('.vue')) {
      return 'vue';
    }
    if (modulePath.endsWith('.tsx') || modulePath.endsWith('.jsx')) {
      return 'jsx';
    }
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.mts') || modulePath.endsWith('.cts')) {
      return 'typescript';
    }
    return 'javascript';
  }

  /**
   * Добавляет сущности из файла
   */
  addEntities(modulePath: string, entities: EntitiesResult): this {
    const normalizedPath = this.normalizePath(modulePath);

    // Сохраняем сущности
    this.entitySource.entitiesMap.set(normalizedPath, entities);

    const functions = entities.functions || [];
    const classes = entities.classes || [];
    const constants = entities.constants || [];
    const interfaces = entities.interfaces || [];
    const types = entities.types || [];
    const variables = entities.variables || [];

    // Индексируем функции
    for (const func of functions) {
      if (func && func.name) {
        this.entitySource.functionIndex.set(func.name, { module: normalizedPath, func });
        this.entitySource.stats.totalFunctions++;
        this.entitySource.stats.totalCalls += (func.calls || []).length;
      }
    }

    // Индексируем классы
    for (const cls of classes) {
      if (cls && cls.name) {
        this.entitySource.classIndex.set(cls.name, { module: normalizedPath, cls });
        this.entitySource.stats.totalClasses++;
      }
    }

    // Индексируем константы
    for (const constItem of constants) {
      if (constItem && constItem.name) {
        this.entitySource.constantIndex.set(constItem.name, {
          module: normalizedPath,
          const: constItem,
        });
        this.entitySource.stats.totalConstants++;
      }
    }

    // Индексируем интерфейсы
    for (const intf of interfaces) {
      if (intf && intf.name) {
        this.entitySource.interfaceIndex.set(intf.name, { module: normalizedPath, intf });
        this.entitySource.stats.totalInterfaces++;
      }
    }

    // Индексируем типы
    for (const type of types) {
      if (type && type.name) {
        this.entitySource.typeIndex.set(type.name, { module: normalizedPath, type });
        this.entitySource.stats.totalTypes++;
      }
    }

    // Индексируем переменные
    for (const varItem of variables) {
      if (varItem && varItem.name) {
        this.entitySource.variableIndex.set(varItem.name, { module: normalizedPath, var: varItem });
        this.entitySource.stats.totalVariables++;
      }
    }

    return this;
  }

  /**
   * Добавляет граф зависимостей
   */
  addGraph(rootKey: string, graph: Record<string, string[]>): this {
    const normalizedRoot = this.normalizePath(rootKey);
    this.graphSource.rootKey = normalizedRoot;

    // Строим граф
    const allModules = new Set<string>();
    allModules.add(normalizedRoot);

    if (!graph || typeof graph !== 'object') {
      console.warn('⚠️ Graph is empty or invalid');
      return this;
    }

    for (const [from, deps] of Object.entries(graph)) {
      const normalizedFrom = this.normalizePath(from);
      allModules.add(normalizedFrom);

      if (!this.graphSource.graph.has(normalizedFrom)) {
        this.graphSource.graph.set(normalizedFrom, new Set());
      }

      if (Array.isArray(deps)) {
        for (const dep of deps) {
          const normalizedDep = this.normalizePath(dep);
          allModules.add(normalizedDep);
          this.graphSource.graph.get(normalizedFrom)!.add(normalizedDep);
        }
      }
    }

    // Строим обратный граф
    for (const [from, deps] of this.graphSource.graph) {
      for (const dep of deps) {
        if (!this.graphSource.reverseGraph.has(dep)) {
          this.graphSource.reverseGraph.set(dep, new Set());
        }
        this.graphSource.reverseGraph.get(dep)!.add(from);
      }
    }

    // Сохраняем модули
    this.graphSource.modules = allModules;

    // Вычисляем уровни
    this.computeLevels();

    return this;
  }

  /**
   * Вычисляет уровни модулей (BFS)
   */
  private computeLevels(): void {
    const visited = new Set<string>();
    const queue: { module: string; level: number }[] = [];

    // Находим корневые модули (те, на которые никто не ссылается)
    const called = new Set<string>();
    for (const [, deps] of this.graphSource.graph) {
      for (const dep of deps) {
        called.add(dep);
      }
    }

    const roots = Array.from(this.graphSource.modules).filter(m => !called.has(m));

    if (roots.length === 0) {
      for (const module of this.graphSource.modules) {
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

      this.graphSource.levels.set(module, level);
      this.graphSource.maxDepth = Math.max(this.graphSource.maxDepth, level);

      const deps = this.graphSource.graph.get(module);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            queue.push({ module: dep, level: level + 1 });
          }
        }
      }
    }
  }

  /**
   * Находит циклические зависимости
   */
  findCycles(): this {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    const cycles: string[][] = [];

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

      const deps = this.graphSource.graph.get(node);
      if (deps) {
        for (const dep of deps) {
          dfs(dep);
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const module of this.graphSource.modules) {
      if (!visited.has(module)) {
        dfs(module);
      }
    }

    this.graphSource.cycles = cycles;
    return this;
  }

  /**
   * Строит пакеты из сущностей
   */
  buildPackages(): this {
    if (this.entitySource.entitiesMap.size === 0) {
      console.warn('⚠️ No entities found, skipping package build');
      return this;
    }

    for (const [modulePath, entities] of this.entitySource.entitiesMap) {
      if (!entities || typeof entities !== 'object') {
        continue;
      }

      const language = this.detectLanguage(modulePath);

      const pkg: PackageData = {
        imports: new Set<string>(),
        exports: new Set<string>(),
        functions: new Set<string>(),
        classes: new Set<string>(),
        constants: new Set<string>(),
        interfaces: new Set<string>(),
        types: new Set<string>(),
        variables: new Set<string>(),
        size: 0,
        lines: 0,
        language,
        isEntry: modulePath === this.graphSource.rootKey,
      };

      const functions = entities.functions || [];
      const classes = entities.classes || [];
      const constants = entities.constants || [];
      const interfaces = entities.interfaces || [];
      const types = entities.types || [];
      const variables = entities.variables || [];
      const imports = entities.imports || [];

      // Добавляем функции
      for (const func of functions) {
        if (func && func.name) {
          pkg.functions.add(func.name);
          if (func.isExported) {
            pkg.exports.add(func.name);
          }
        }
      }

      // Добавляем классы
      for (const cls of classes) {
        if (cls && cls.name) {
          pkg.classes.add(cls.name);
          if (cls.isExported) {
            pkg.exports.add(cls.name);
          }
        }
      }

      // Добавляем константы
      for (const constItem of constants) {
        if (constItem && constItem.name) {
          pkg.constants.add(constItem.name);
          if (constItem.isExported) {
            pkg.exports.add(constItem.name);
          }
        }
      }

      // Добавляем интерфейсы
      for (const intf of interfaces) {
        if (intf && intf.name) {
          pkg.interfaces.add(intf.name);
          if (intf.isExported) {
            pkg.exports.add(intf.name);
          }
        }
      }

      // Добавляем типы
      for (const type of types) {
        if (type && type.name) {
          pkg.types.add(type.name);
          if (type.isExported) {
            pkg.exports.add(type.name);
          }
        }
      }

      // Добавляем переменные
      for (const varItem of variables) {
        if (varItem && varItem.name) {
          pkg.variables.add(varItem.name);
          if (varItem.isExported) {
            pkg.exports.add(varItem.name);
          }
        }
      }

      // Добавляем импорты
      for (const imp of imports) {
        if (imp && imp.source) {
          pkg.imports.add(imp.source);
        }
      }

      // Получаем размер и строки
      try {
        const stats = this.getFileStats(modulePath);
        pkg.size = stats.size;
        pkg.lines = stats.lines;
      } catch (error) {
        // Игнорируем
      }

      this.packageSource.packages.set(modulePath, pkg);
    }

    // Строим зависимости между пакетами
    for (const [from, deps] of this.graphSource.graph) {
      if (!this.packageSource.dependencies.has(from)) {
        this.packageSource.dependencies.set(from, new Set());
      }
      for (const dep of deps) {
        if (this.packageSource.packages.has(dep)) {
          this.packageSource.dependencies.get(from)!.add(dep);
        }
      }
    }

    // Обновляем статистику
    const packages = Array.from(this.packageSource.packages.values());
    if (packages.length > 0) {
      this.packageSource.stats = {
        totalPackages: packages.length,
        totalImports: packages.reduce((sum, p) => sum + p.imports.size, 0),
        totalExports: packages.reduce((sum, p) => sum + p.exports.size, 0),
        avgSize: packages.reduce((sum, p) => sum + p.size, 0) / packages.length,
        avgLines: packages.reduce((sum, p) => sum + p.lines, 0) / packages.length,
      };
    }

    return this;
  }

  /**
   * Получает статистику файла
   */
  private getFileStats(modulePath: string): { size: number; lines: number } {
    try {
      const absPath = path.resolve(this.projectRoot, modulePath);
      if (fs.existsSync(absPath)) {
        const stat = fs.statSync(absPath);
        if (stat.size > 1024 * 1024) {
          return {
            size: stat.size,
            lines: Math.floor(stat.size / 50),
          };
        }
        const content = fs.readFileSync(absPath, 'utf-8');
        return {
          size: content.length,
          lines: content.split('\n').length,
        };
      }
    } catch (error) {
      // Игнорируем ошибки
    }
    return { size: 0, lines: 0 };
  }

  /**
   * Нормализует путь
   */
  private normalizePath(filePath: string): string {
    if (!filePath) return '';
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Возвращает глобальный источник данных
   */
  build(): GlobalDataSource {
    return {
      entities: this.entitySource,
      graph: this.graphSource,
      packages: this.packageSource,
      projectRoot: this.projectRoot,
      timestamp: new Date().toISOString(),
      version: '3.0.0',
    };
  }

  /**
   * Возвращает статистику в удобном формате
   */
  getStats(): {
    entities: EntityDataSource['stats'];
    packages: PackageDataSource['stats'];
    graph: { modules: number; maxDepth: number; cycles: number };
  } {
    return {
      entities: this.entitySource.stats,
      packages: this.packageSource.stats,
      graph: {
        modules: this.graphSource.modules.size,
        maxDepth: this.graphSource.maxDepth,
        cycles: this.graphSource.cycles.length,
      },
    };
  }

  /**
   * Экспортирует данные в JSON
   */
  toJSON(): any {
    const globalSource = this.build();
    const accessor = new DataSourceAccessor(globalSource);
    return accessor.toJSON();
  }
}

// ============================================
// 6. ГЕТТЕРЫ ДЛЯ ДОСТУПА К ДАННЫМ
// ============================================

export class DataSourceAccessor {
  private source: GlobalDataSource;

  constructor(source: GlobalDataSource) {
    this.source = source;
  }

  /**
   * Получить функцию по имени
   */
  getFunction(name: string): { module: string; func: any } | null {
    return this.source.entities.functionIndex.get(name) || null;
  }

  /**
   * Получить все функции модуля
   */
  getModuleFunctions(modulePath: string): any[] {
    const entities = this.source.entities.entitiesMap.get(modulePath);
    return entities ? entities.functions || [] : [];
  }

  /**
   * Получить все экспорты модуля
   */
  getModuleExports(modulePath: string): string[] {
    const pkg = this.source.packages.packages.get(modulePath);
    return pkg ? Array.from(pkg.exports) : [];
  }

  /**
   * Получить все импорты модуля
   */
  getModuleImports(modulePath: string): string[] {
    const pkg = this.source.packages.packages.get(modulePath);
    return pkg ? Array.from(pkg.imports) : [];
  }

  /**
   * Получить зависимости модуля
   */
  getModuleDependencies(modulePath: string): string[] {
    const deps = this.source.packages.dependencies.get(modulePath);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Получить уровень модуля
   */
  getModuleLevel(modulePath: string): number {
    return this.source.graph.levels.get(modulePath) || 0;
  }

  /**
   * Проверить, есть ли циклы
   */
  hasCycles(): boolean {
    return this.source.graph.cycles.length > 0;
  }

  /**
   * Получить все циклические зависимости
   */
  getCycles(): string[][] {
    return this.source.graph.cycles;
  }

  /**
   * Получить все модули
   */
  getAllModules(): string[] {
    return Array.from(this.source.graph.modules);
  }

  /**
   * Получить все функции
   */
  getAllFunctions(): { name: string; module: string; func: any }[] {
    const result: { name: string; module: string; func: any }[] = [];
    for (const [name, data] of this.source.entities.functionIndex) {
      result.push({ name, module: data.module, func: data.func });
    }
    return result;
  }

  /**
   * Получить все классы
   */
  getAllClasses(): { name: string; module: string; cls: any }[] {
    const result: { name: string; module: string; cls: any }[] = [];
    for (const [name, data] of this.source.entities.classIndex) {
      result.push({ name, module: data.module, cls: data.cls });
    }
    return result;
  }

  /**
   * Получить все константы
   */
  getAllConstants(): { name: string; module: string; const: any }[] {
    const result: { name: string; module: string; const: any }[] = [];
    for (const [name, data] of this.source.entities.constantIndex) {
      result.push({ name, module: data.module, const: data.const });
    }
    return result;
  }

  /**
   * Получить все интерфейсы
   */
  getAllInterfaces(): { name: string; module: string; intf: any }[] {
    const result: { name: string; module: string; intf: any }[] = [];
    for (const [name, data] of this.source.entities.interfaceIndex) {
      result.push({ name, module: data.module, intf: data.intf });
    }
    return result;
  }

  /**
   * Получить все типы
   */
  getAllTypes(): { name: string; module: string; type: any }[] {
    const result: { name: string; module: string; type: any }[] = [];
    for (const [name, data] of this.source.entities.typeIndex) {
      result.push({ name, module: data.module, type: data.type });
    }
    return result;
  }

  /**
   * Получить все переменные
   */
  getAllVariables(): { name: string; module: string; var: any }[] {
    const result: { name: string; module: string; var: any }[] = [];
    for (const [name, data] of this.source.entities.variableIndex) {
      result.push({ name, module: data.module, var: data.var });
    }
    return result;
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      entities: this.source.entities.stats,
      packages: this.source.packages.stats,
      graph: {
        modules: this.source.graph.modules.size,
        maxDepth: this.source.graph.maxDepth,
        cycles: this.source.graph.cycles.length,
      },
    };
  }

  /**
   * Получить отчет в формате JSON
   */
  toJSON(): any {
    const packagesData: any[] = [];

    for (const [modulePath, pkg] of this.source.packages.packages) {
      packagesData.push({
        path: modulePath,
        language: pkg.language,
        isEntry: pkg.isEntry,
        functions: Array.from(pkg.functions),
        classes: Array.from(pkg.classes),
        constants: Array.from(pkg.constants),
        interfaces: Array.from(pkg.interfaces),
        types: Array.from(pkg.types),
        variables: Array.from(pkg.variables),
        exports: Array.from(pkg.exports),
        imports: Array.from(pkg.imports),
        size: pkg.size,
        lines: pkg.lines,
        level: this.getModuleLevel(modulePath),
        dependencies: this.getModuleDependencies(modulePath),
      });
    }

    return {
      version: this.source.version,
      timestamp: this.source.timestamp,
      projectRoot: this.source.projectRoot,
      stats: this.getStats(),
      modules: packagesData,
      cycles: this.source.graph.cycles,
      entityStats: this.source.entities.stats,
    };
  }

  /**
   * Найти модуль по имени файла
   */
  findModuleByFileName(fileName: string): string | null {
    for (const modulePath of this.source.graph.modules) {
      const baseName = path.basename(modulePath);
      if (baseName === fileName || modulePath.includes(fileName)) {
        return modulePath;
      }
    }
    return null;
  }

  /**
   * Найти функцию по имени (игнорируя регистр)
   */
  findFunctionCaseInsensitive(name: string): { module: string; func: any } | null {
    const lowerName = name.toLowerCase();
    for (const [key, data] of this.source.entities.functionIndex) {
      if (key.toLowerCase() === lowerName) {
        return data;
      }
    }
    return null;
  }

  /**
   * Получить все функции, вызывающие указанную
   */
  getCallers(functionName: string): { name: string; module: string; func: any }[] {
    const result: { name: string; module: string; func: any }[] = [];
    const funcData = this.getFunction(functionName);
    if (!funcData) return result;

    for (const [name, data] of this.source.entities.functionIndex) {
      const calls = data.func.calls || [];
      if (calls.includes(functionName)) {
        result.push({ name, module: data.module, func: data.func });
      }
    }
    return result;
  }

  /**
   * Получить все функции, вызываемые указанной
   */
  getCallees(functionName: string): { name: string; module: string; func: any }[] {
    const result: { name: string; module: string; func: any }[] = [];
    const funcData = this.getFunction(functionName);
    if (!funcData) return result;

    const calls = funcData.func.calls || [];
    for (const callName of calls) {
      const calledData = this.getFunction(callName);
      if (calledData) {
        result.push({ name: callName, module: calledData.module, func: calledData.func });
      }
    }
    return result;
  }

  /**
   * Построить граф вызовов для модуля
   */
  getModuleCallGraph(modulePath: string): Map<string, string[]> {
    const callGraph = new Map<string, string[]>();
    const functions = this.getModuleFunctions(modulePath);

    for (const func of functions) {
      const calls = func.calls || [];
      callGraph.set(func.name, calls);
    }

    return callGraph;
  }

  /**
   * Получить все экспортированные функции модуля
   */
  getModuleExportedFunctions(modulePath: string): any[] {
    const functions = this.getModuleFunctions(modulePath);
    return functions.filter((f: any) => f.isExported === true);
  }

  /**
   * Получить все асинхронные функции модуля
   */
  getModuleAsyncFunctions(modulePath: string): any[] {
    const functions = this.getModuleFunctions(modulePath);
    return functions.filter((f: any) => f.isAsync === true);
  }

  /**
   * Найти путь между двумя модулями (BFS)
   */
  findModulePath(from: string, to: string): string[] | null {
    if (from === to) return [from];

    const visited = new Set<string>();
    const queue: { module: string; path: string[] }[] = [{ module: from, path: [from] }];

    while (queue.length > 0) {
      const { module, path } = queue.shift()!;
      if (visited.has(module)) continue;
      visited.add(module);

      const deps = this.source.packages.dependencies.get(module);
      if (deps) {
        for (const dep of deps) {
          if (dep === to) {
            return [...path, dep];
          }
          if (!visited.has(dep)) {
            queue.push({ module: dep, path: [...path, dep] });
          }
        }
      }
    }

    return null;
  }

  /**
   * Найти все модули на указанном уровне
   */
  getModulesByLevel(level: number): string[] {
    const result: string[] = [];
    for (const [module, lvl] of this.source.graph.levels) {
      if (lvl === level) {
        result.push(module);
      }
    }
    return result;
  }

  /**
   * Получить модули с наибольшим количеством функций
   */
  getModulesByFunctionCount(limit: number = 10): { module: string; count: number }[] {
    const result: { module: string; count: number }[] = [];
    for (const [modulePath, pkg] of this.source.packages.packages) {
      result.push({ module: modulePath, count: pkg.functions.size });
    }
    result.sort((a, b) => b.count - a.count);
    return result.slice(0, limit);
  }

  /**
   * Получить модули с наибольшим количеством зависимостей
   */
  getModulesByDependencyCount(limit: number = 10): { module: string; count: number }[] {
    const result: { module: string; count: number }[] = [];
    for (const [modulePath, deps] of this.source.packages.dependencies) {
      result.push({ module: modulePath, count: deps.size });
    }
    result.sort((a, b) => b.count - a.count);
    return result.slice(0, limit);
  }
}

// ============================================
// 7. ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  DataSourceBuilder,
  DataSourceAccessor,
};
