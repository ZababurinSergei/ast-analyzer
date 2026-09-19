// packages/ast-analyzer/src/reporters/core/ReportBuilder.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ — все ошибки TypeScript устранены

import path from 'path';
import type { EntitiesResult, GraphData } from '../../types.js';
import { encodeFlags } from '../../utils/flag-utils.js';

// ============================================================
// ТИПЫ ДЛЯ ОТЧЕТА
// ============================================================

export interface ModuleData {
  path: string;
  files: string[];
  functions: number[];
  exports: number[];
  imports: string[];
}

export interface FileData {
  path: string;
  module: string;
}

export interface CallGraphData {
  nodes: string[];
  edges: [number, number, number, number, number][];
  types: string[];
  edgeFlags: Record<string, Record<string, string>>;
  cycles: string[][];
}

export interface CallInfo {
  to: string;
  ln: number;
  tp: string;
  fg?: number;
}

export interface NodeDetail {
  n: string;
  tp: string;
  m: string;
  f: string;
  fg: number;
  p: string[];
  rt: string;
  ln: number;
  cx: number;
  cl: string[];
}

export interface ExternalCall {
  lib: string;
  method: string;
  ln: number;
}

export interface VarUsage {
  usedIn: string[];
  tp: string;
  val?: any;
  file?: string;
}

export interface TypeUsage {
  usedIn: string[];
  tp: string;
  file?: string;
}

export interface ReportStats {
  tm: number;
  tf: number;
  tn: number;
  te: number;
  tc: number;
  ti: number;
  tex: number;
  tinh: number;
  timpl: number;
  tecl: number;
  tcy: number;
  tun: number;
}

export interface ReportData {
  modules: Record<string, ModuleData>;
  files: Record<string, FileData>;
  callGraph: CallGraphData;
  functionCalls: Record<string, CallInfo[]>;
  nodeDetails: Record<string, NodeDetail>;
  externalCalls: Record<string, ExternalCall[]>;
  varUsage: Record<string, VarUsage>;
  typeUsage: Record<string, TypeUsage>;
  stats: ReportStats;
}

// ============================================================
// ПОСТРОИТЕЛЬ ОТЧЕТОВ
// ============================================================

export class ReportBuilder {
  private modules: Record<string, ModuleData> = {};
  private files: Record<string, FileData> = {};
  private callGraph: CallGraphData = {
    nodes: [],
    edges: [],
    types: ['call', 'import', 'export', 'implements', 'extends'],
    edgeFlags: {
      call: { '0': 'direct', '1': 'async', '2': 'imported', '4': 'method', '8': 'optional' },
      import: {
        '0': 'default',
        '1': 'named',
        '2': 'namespace',
        '3': 'type',
        '4': 'dynamic',
        '5': 'side-effect',
      },
      export: { '0': 'default', '1': 'named', '2': 're-export' },
    },
    cycles: [],
  };
  private functionCalls: Record<string, CallInfo[]> = {};
  private nodeDetails: Record<string, NodeDetail> = {};
  private externalCalls: Record<string, ExternalCall[]> = {};
  private varUsage: Record<string, VarUsage> = {};
  private typeUsage: Record<string, TypeUsage> = {};
  private stats: ReportStats = {
    tm: 0,
    tf: 0,
    tn: 0,
    te: 0,
    tc: 0,
    ti: 0,
    tex: 0,
    tinh: 0,
    timpl: 0,
    tecl: 0,
    tcy: 0,
    tun: 0,
  };

  private moduleCounter = 0;
  private fileCounter = 0;
  private functionCounter = 0;
  private moduleMap = new Map<string, string>();
  private fileMap = new Map<string, string>();
  private functionMap = new Map<string, string>();
  private functionIndex: Record<string, number> = {};
  private reverseFunctionIndex: Record<number, string> = {};
  private fileToModule = new Map<string, string>();
  private functionToModule = new Map<string, string>();

  build(graphData: GraphData, entitiesMap: Record<string, EntitiesResult>): ReportData {
    console.log('📋 Building report...');
    console.log('   📁 Building modules...');
    this.buildModules(graphData, entitiesMap);
    console.log('   🔗 Building call graph...');
    this.buildCallGraph(entitiesMap);
    console.log('   ⚡ Building function calls index...');
    this.buildFunctionCalls();
    console.log('   📊 Building node details...');
    this.buildNodeDetails(entitiesMap);
    console.log('   📦 Collecting external calls...');
    this.collectExternalCalls(entitiesMap);
    console.log('   📝 Collecting variable usage...');
    this.collectVarUsage(entitiesMap);
    console.log('   📐 Collecting type usage...');
    this.collectTypeUsage(entitiesMap);
    console.log('   📊 Collecting stats...');
    this.collectStats();

    console.log('✅ Report built successfully!');
    return {
      modules: this.modules,
      files: this.files,
      callGraph: this.callGraph,
      functionCalls: this.functionCalls,
      nodeDetails: this.nodeDetails,
      externalCalls: this.externalCalls,
      varUsage: this.varUsage,
      typeUsage: this.typeUsage,
      stats: this.stats,
    };
  }

  // ============================================================
  // ПОСТРОЕНИЕ МОДУЛЕЙ И ФАЙЛОВ
  // ============================================================

  private buildModules(_graphData: GraphData, entitiesMap: Record<string, EntitiesResult>): void {
    const moduleMap = new Map<string, ModuleData>();

    for (const [filePath] of Object.entries(entitiesMap)) {
      const dirName = path.basename(path.dirname(filePath)) || 'root';
      const moduleId = this.getModuleId(dirName);

      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, {
          path: path.dirname(filePath),
          files: [],
          functions: [],
          exports: [],
          imports: [],
        });
      }

      const fileId = this.getFileId(filePath);
      const module = moduleMap.get(moduleId)!;
      if (!module.files.includes(fileId)) {
        module.files.push(fileId);
      }

      this.files[fileId] = {
        path: filePath.replace(/\\/g, '/'),
        module: moduleId,
      };

      this.fileToModule.set(filePath, moduleId);

      const entities = entitiesMap[filePath];
      if (entities) {
        for (const func of entities.functions || []) {
          const funcId = this.getFunctionId(func.name, moduleId);
          const funcIdx = this.functionIndex[funcId];
          if (funcIdx !== undefined && !module.functions.includes(funcIdx)) {
            module.functions.push(funcIdx);
            if (func.isExported) {
              module.exports.push(funcIdx);
            }
          }
          this.functionToModule.set(func.name, moduleId);
        }

        for (const imp of entities.imports || []) {
          if (imp.source && !module.imports.includes(imp.source)) {
            module.imports.push(imp.source);
          }
        }
      }
    }

    for (const [id, module] of moduleMap) {
      this.modules[id] = module;
    }
  }

  // ============================================================
  // ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ
  // ============================================================

  private buildCallGraph(entitiesMap: Record<string, EntitiesResult>): void {
    const allFunctions: string[] = [];
    const edges: [number, number, number, number, number][] = [];
    const funcIndex: Record<string, number> = {};
    let idx = 0;

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleId =
        this.fileToModule.get(filePath) ||
        this.getModuleId(path.basename(path.dirname(filePath)) || 'root');
      for (const func of entities.functions || []) {
        const funcId = this.getFunctionId(func.name, moduleId);
        if (funcIndex[funcId] === undefined) {
          funcIndex[funcId] = idx++;
          allFunctions.push(func.name);
        }
      }
    }

    this.functionIndex = funcIndex;
    this.reverseFunctionIndex = {};
    for (const [key, value] of Object.entries(funcIndex)) {
      this.reverseFunctionIndex[value] = key;
    }

    const importTypeIdx = 1;

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleId =
        this.fileToModule.get(filePath) ||
        this.getModuleId(path.basename(path.dirname(filePath)) || 'root');

      for (const func of entities.functions || []) {
        const fromId = this.getFunctionId(func.name, moduleId);
        const fromIdx = funcIndex[fromId];
        if (fromIdx === undefined) continue;

        for (const call of func.calls || []) {
          let toIdx: number | undefined;
          let callType = 0;
          let flags = 0;

          for (const [otherPath] of Object.entries(entitiesMap)) {
            const otherModule =
              this.fileToModule.get(otherPath) ||
              this.getModuleId(path.basename(path.dirname(otherPath)) || 'root');
            const toId = this.getFunctionId(call, otherModule);
            if (funcIndex[toId] !== undefined) {
              toIdx = funcIndex[toId];
              if (otherPath !== filePath) {
                callType = 2;
              }
              break;
            }
          }

          if (toIdx === undefined) {
            if (call.includes('.')) {
              callType = 4;
              const methodName = call.split('.').pop() || call;
              for (const [otherPath] of Object.entries(entitiesMap)) {
                const otherModule =
                  this.fileToModule.get(otherPath) ||
                  this.getModuleId(path.basename(path.dirname(otherPath)) || 'root');
                const toId = this.getFunctionId(methodName, otherModule);
                if (funcIndex[toId] !== undefined) {
                  toIdx = funcIndex[toId];
                  callType = 2;
                  break;
                }
              }
            }
          }

          if (toIdx === undefined) {
            const externalName = call;
            const extId = `ext_${externalName}`;
            if (funcIndex[extId] === undefined) {
              funcIndex[extId] = idx++;
              allFunctions.push(externalName);
            }
            toIdx = funcIndex[extId];
            callType = 0;
            flags = 2;
          }

          if (toIdx !== undefined) {
            const line = func.line || 0;
            const exists = edges.some(e => e[0] === fromIdx && e[1] === toIdx && e[2] === line);
            if (!exists) {
              edges.push([fromIdx, toIdx, line, callType, flags]);
            }
          }
        }

        for (const imp of entities.imports || []) {
          if (!imp.source) continue;
          let targetModuleId: string | undefined;
          for (const [otherPath] of Object.entries(entitiesMap)) {
            if (otherPath.includes(imp.source) || imp.source.includes(path.basename(otherPath))) {
              targetModuleId = this.fileToModule.get(otherPath);
              break;
            }
          }
          if (targetModuleId) {
            const toId = this.getFunctionId(`module_${targetModuleId}`, targetModuleId);
            if (funcIndex[toId] === undefined) {
              funcIndex[toId] = idx++;
              allFunctions.push(`module_${targetModuleId}`);
            }
            const toIdx = funcIndex[toId];
            if (toIdx !== undefined) {
              const exists = edges.some(e => e[0] === fromIdx && e[1] === toIdx);
              if (!exists) {
                edges.push([fromIdx, toIdx, 0, importTypeIdx, 0]);
              }
            }
          }
        }
      }
    }

    const cycles = this.findCyclesInGraph(edges, allFunctions.length);

    this.callGraph = {
      nodes: allFunctions,
      edges,
      types: ['call', 'import', 'export', 'implements', 'extends'],
      edgeFlags: {
        call: { '0': 'direct', '1': 'async', '2': 'imported', '4': 'method', '8': 'optional' },
        import: {
          '0': 'default',
          '1': 'named',
          '2': 'namespace',
          '3': 'type',
          '4': 'dynamic',
          '5': 'side-effect',
        },
        export: { '0': 'default', '1': 'named', '2': 're-export' },
      },
      cycles,
    };

    this.functionIndex = funcIndex;
  }

  private findCyclesInGraph(
    edges: [number, number, number, number, number][],
    nodeCount: number
  ): string[][] {
    const graph: Record<number, number[]> = {};
    for (let i = 0; i < nodeCount; i++) {
      graph[i] = [];
    }
    for (const [from, to] of edges) {
      if (graph[from] && !graph[from].includes(to)) {
        graph[from].push(to);
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<number>();
    const recursionStack = new Set<number>();
    const path: number[] = [];

    const dfs = (node: number) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycleNames = path
            .slice(cycleStart)
            .map(i => this.callGraph.nodes[i] || `node_${i}`);
          const exists = cycles.some(
            c => c.length === cycleNames.length && c.every((name, i) => name === cycleNames[i])
          );
          if (!exists) {
            cycles.push(cycleNames);
          }
        }
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      for (const neighbor of graph[node] || []) {
        dfs(neighbor);
      }
      recursionStack.delete(node);
      path.pop();
    };

    for (let i = 0; i < nodeCount; i++) {
      if (!visited.has(i)) {
        dfs(i);
      }
    }

    return cycles;
  }

  // ============================================================
  // БЫСТРЫЙ ДОСТУП К ВЫЗОВАМ
  // ============================================================

  private buildFunctionCalls(): void {
    const nodes = this.callGraph.nodes;
    const types = this.callGraph.types;

    for (const [funcId, idx] of Object.entries(this.functionIndex)) {
      const calls: CallInfo[] = [];
      for (const edge of this.callGraph.edges) {
        const [from, to, line, typeIdx, flags] = edge;
        if (from === idx) {
          const toName = nodes[to] || `unknown_${to}`;
          const type = types[typeIdx] || 'call';
          calls.push({
            to: toName,
            ln: line,
            tp: type,
            fg: flags || 0,
          });
        }
      }
      calls.sort((a, b) => a.ln - b.ln);

      if (calls.length > 0) {
        const funcName = nodes[idx] || funcId;
        this.functionCalls[funcName] = calls;
      }
    }
  }

  // ============================================================
  // ДЕТАЛИ УЗЛОВ
  // ============================================================

  private buildNodeDetails(entitiesMap: Record<string, EntitiesResult>): void {
    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const moduleId =
        this.fileToModule.get(filePath) ||
        this.getModuleId(path.basename(path.dirname(filePath)) || 'root');
      const fileId = this.getFileId(filePath);

      for (const func of entities.functions || []) {
        const funcId = this.getFunctionId(func.name, moduleId);
        const idx = this.functionIndex[funcId];
        if (idx === undefined) continue;

        const flags = encodeFlags(func);
        const calls = (func.calls || []).filter(c => {
          for (const [otherPath] of Object.entries(entitiesMap)) {
            const otherModule =
              this.fileToModule.get(otherPath) ||
              this.getModuleId(path.basename(path.dirname(otherPath)) || 'root');
            const otherId = this.getFunctionId(c, otherModule);
            if (this.functionIndex[otherId] !== undefined) return true;
          }
          return false;
        });

        const lines = (func.endLine || func.line || 0) - (func.startLine || func.line || 0) + 1;

        this.nodeDetails[String(idx)] = {
          n: func.name,
          tp: 'function',
          m: moduleId,
          f: fileId,
          fg: flags,
          p: func.params || [],
          rt: func.returnType || 'any',
          ln: Math.max(lines, 1),
          cx: func.complexity || 1,
          cl: calls,
        };
      }
    }
  }

  // ============================================================
  // ВНЕШНИЕ ВЫЗОВЫ
  // ============================================================

  private collectExternalCalls(entitiesMap: Record<string, EntitiesResult>): void {
    for (const [, entities] of Object.entries(entitiesMap)) {
      for (const func of entities.functions || []) {
        const funcName = func.name;
        if (!funcName) continue;

        const body = func.body || '';
        const callPattern =
          /\b(fs|path|os|crypto|zlib|http|https|net|dns|url|querystring|stream|events|util|child_process|readline|repl|vm|worker_threads|cluster|process)\.(\w+)\s*\(/g;
        let match;
        while ((match = callPattern.exec(body)) !== null) {
          const lib = match[1];
          const method = match[2];
          if (lib && method) {
            const line = body.substring(0, match.index).split('\n').length + 1;
            if (!this.externalCalls[funcName]) {
              this.externalCalls[funcName] = [];
            }
            const exists = this.externalCalls[funcName].some(
              c => c.lib === lib && c.method === method
            );
            if (!exists) {
              this.externalCalls[funcName].push({ lib, method, ln: line });
            }
          }
        }

        const consolePattern = /console\.(\w+)\s*\(/g;
        while ((match = consolePattern.exec(body)) !== null) {
          const method = match[1];
          if (method) {
            const line = body.substring(0, match.index).split('\n').length + 1;
            if (!this.externalCalls[funcName]) {
              this.externalCalls[funcName] = [];
            }
            const exists = this.externalCalls[funcName].some(
              c => c.lib === 'console' && c.method === method
            );
            if (!exists) {
              this.externalCalls[funcName].push({ lib: 'console', method, ln: line });
            }
          }
        }
      }
    }
  }

  // ============================================================
  // ИСПОЛЬЗОВАНИЕ ПЕРЕМЕННЫХ
  // ============================================================

  private collectVarUsage(entitiesMap: Record<string, EntitiesResult>): void {
    const varMap = new Map<string, { value?: any; type: string; file: string }>();

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      for (const constItem of entities.constants || []) {
        if (constItem.name && constItem.isExported) {
          varMap.set(constItem.name, {
            value: constItem.value,
            type: 'const',
            file: filePath,
          });
        }
      }

      for (const varItem of entities.variables || []) {
        if (varItem.name && varItem.isExported) {
          varMap.set(varItem.name, {
            value: varItem.value,
            type: 'let',
            file: filePath,
          });
        }
      }
    }

    for (const [_filePath, entities] of Object.entries(entitiesMap)) {
      for (const func of entities.functions || []) {
        const funcName = func.name;
        if (!funcName) continue;

        const body = func.body || '';
        for (const [varName, varInfo] of varMap) {
          if (
            body.includes(varName) &&
            !body.includes(`const ${varName}`) &&
            !body.includes(`let ${varName}`)
          ) {
            if (!this.varUsage[varName]) {
              this.varUsage[varName] = {
                usedIn: [],
                tp: varInfo.type,
                val: varInfo.value,
                file: varInfo.file,
              };
            }
            if (!this.varUsage[varName].usedIn.includes(funcName)) {
              this.varUsage[varName].usedIn.push(funcName);
            }
          }
        }
      }
    }
  }

  // ============================================================
  // ИСПОЛЬЗОВАНИЕ ТИПОВ
  // ============================================================

  private collectTypeUsage(entitiesMap: Record<string, EntitiesResult>): void {
    const typeMap = new Map<string, { type: string; file: string }>();

    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      for (const intf of entities.interfaces || []) {
        if (intf.name && intf.isExported) {
          typeMap.set(intf.name, { type: 'interface', file: filePath });
        }
      }

      for (const type of entities.types || []) {
        if (type.name && type.isExported) {
          typeMap.set(type.name, { type: 'type', file: filePath });
        }
      }

      for (const cls of entities.classes || []) {
        if (cls.name && cls.isExported) {
          typeMap.set(cls.name, { type: 'class', file: filePath });
        }
      }
    }

    for (const [_filePath, entities] of Object.entries(entitiesMap)) {
      for (const func of entities.functions || []) {
        const funcName = func.name;
        if (!funcName) continue;

        const body = func.body || '';
        for (const param of func.params || []) {
          if (typeMap.has(param)) {
            if (!this.typeUsage[param]) {
              this.typeUsage[param] = {
                usedIn: [],
                tp: typeMap.get(param)!.type,
                file: typeMap.get(param)!.file,
              };
            }
            if (!this.typeUsage[param].usedIn.includes(funcName)) {
              this.typeUsage[param].usedIn.push(funcName);
            }
          }
        }

        const returnType = func.returnType || '';
        if (typeMap.has(returnType)) {
          if (!this.typeUsage[returnType]) {
            this.typeUsage[returnType] = {
              usedIn: [],
              tp: typeMap.get(returnType)!.type,
              file: typeMap.get(returnType)!.file,
            };
          }
          if (!this.typeUsage[returnType].usedIn.includes(funcName)) {
            this.typeUsage[returnType].usedIn.push(funcName);
          }
        }

        for (const [typeName] of typeMap) {
          if (body.includes(`: ${typeName}`) || body.includes(`as ${typeName}`)) {
            if (!this.typeUsage[typeName]) {
              this.typeUsage[typeName] = {
                usedIn: [],
                tp: typeMap.get(typeName)!.type,
                file: typeMap.get(typeName)!.file,
              };
            }
            if (!this.typeUsage[typeName].usedIn.includes(funcName)) {
              this.typeUsage[typeName].usedIn.push(funcName);
            }
          }
        }
      }
    }
  }

  // ============================================================
  // СТАТИСТИКА
  // ============================================================

  private collectStats(): void {
    let totalCalls = 0;
    for (const calls of Object.values(this.functionCalls)) {
      totalCalls += calls.length;
    }

    let totalImports = 0;
    let totalExports = 0;
    for (const module of Object.values(this.modules)) {
      totalImports += module.imports.length;
      totalExports += module.exports.length;
    }

    let totalExternalCalls = 0;
    for (const calls of Object.values(this.externalCalls)) {
      totalExternalCalls += calls.length;
    }

    this.stats = {
      tm: Object.keys(this.modules).length,
      tf: Object.keys(this.files).length,
      tn: this.callGraph.nodes.length,
      te: this.callGraph.edges.length,
      tc: totalCalls,
      ti: totalImports,
      tex: totalExports,
      tinh: 0,
      timpl: 0,
      tecl: totalExternalCalls,
      tcy: this.callGraph.cycles.length,
      tun: 0,
    };
  }

  // ============================================================
  // ГЕНЕРАЦИЯ КОМПАКТНЫХ ID
  // ============================================================

  private getModuleId(moduleName: string): string {
    if (this.moduleMap.has(moduleName)) {
      return this.moduleMap.get(moduleName)!;
    }
    this.moduleCounter++;
    const id = `m${this.moduleCounter}`;
    this.moduleMap.set(moduleName, id);
    return id;
  }

  private getFileId(filePath: string): string {
    if (this.fileMap.has(filePath)) {
      return this.fileMap.get(filePath)!;
    }
    this.fileCounter++;
    const id = `f${this.fileCounter}`;
    this.fileMap.set(filePath, id);
    return id;
  }

  private getFunctionId(funcName: string, moduleId: string): string {
    const key = `${moduleId}_${funcName}`;
    if (this.functionMap.has(key)) {
      return this.functionMap.get(key)!;
    }
    this.functionCounter++;
    const id = `fn${this.functionCounter}`;
    this.functionMap.set(key, id);
    return id;
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  getFunctionById(id: string): { name: string; module: string } | null {
    for (const [key, value] of this.functionMap) {
      if (value === id) {
        const [moduleId, funcName] = key.split('_');
        return { name: funcName || '', module: moduleId || '' };
      }
    }
    return null;
  }

  getFunctionIdByName(funcName: string): string | null {
    for (const [key, value] of this.functionMap) {
      if (key.endsWith(`_${funcName}`)) {
        return value;
      }
    }
    return null;
  }

  getModuleFunctions(moduleId: string): string[] {
    const module = this.modules[moduleId];
    if (!module) return [];
    return module.functions.map(id => {
      const info = this.getFunctionById(String(id));
      return info ? info.name : String(id);
    });
  }

  getModuleExports(moduleId: string): string[] {
    const module = this.modules[moduleId];
    if (!module) return [];
    return module.exports.map(id => {
      const info = this.getFunctionById(String(id));
      return info ? info.name : String(id);
    });
  }

  getCallers(funcName: string): string[] {
    const callers: string[] = [];
    for (const [caller, calls] of Object.entries(this.functionCalls)) {
      if (calls.some(c => c.to === funcName)) {
        callers.push(caller);
      }
    }
    return callers;
  }

  getCallees(funcName: string): string[] {
    const calls = this.functionCalls[funcName];
    if (!calls) return [];
    return calls.map(c => c.to);
  }

  toJSON(): any {
    return {
      modules: this.modules,
      files: this.files,
      callGraph: this.callGraph,
      functionCalls: this.functionCalls,
      nodeDetails: this.nodeDetails,
      externalCalls: this.externalCalls,
      varUsage: this.varUsage,
      typeUsage: this.typeUsage,
      stats: this.stats,
    };
  }
}

export default ReportBuilder;
