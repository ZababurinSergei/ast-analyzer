// src/reporters/data-converter.ts
function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
var DataConverter = class {
  /**
   * Преобразует ModuleNode в PackageLockPackage
   * ✅ ИСПРАВЛЕНО: гарантирует, что все сущности - массивы объектов
   */
  static convertModuleNodeToPackage(node, entityNodes, entityEdges) {
    const callMap = {};
    const calledByMap = {};
    for (const edge of entityEdges) {
      if (edge.type === "function_call" || edge.type === "method_call") {
        const fromName = edge.from.split("#").pop() || edge.from;
        const toName = edge.to.split("#").pop() || edge.to;
        if (!callMap[fromName]) {
          callMap[fromName] = [];
        }
        callMap[fromName].push(toName);
        if (!calledByMap[toName]) {
          calledByMap[toName] = [];
        }
        calledByMap[toName].push(fromName);
      }
    }
    const safeEntityNodes = ensureArray(entityNodes);
    const functions = safeEntityNodes.filter((e) => e.type === "function").map((e) => ({
      name: e.name || "",
      params: e.metadata?.params || [],
      paramTypes: [],
      line: e.line || 0,
      startLine: e.metadata?.startLine || e.line || 0,
      endLine: e.metadata?.endLine || e.line || 0,
      isAsync: e.metadata?.isAsync || false,
      isExported: e.metadata?.isExported || false,
      isMethod: e.metadata?.isMethod || false,
      className: e.metadata?.className || "",
      calls: callMap[e.name] || [],
      calledBy: calledByMap[e.name] || [],
      returnType: e.metadata?.returnType || "any",
      body: "",
      isNested: false,
      parentFunction: void 0,
      isArrow: false,
      isEventHandler: false,
      eventType: void 0,
      depth: 0
    }));
    return {
      version: "1.0.0",
      resolved: `file:${node.id}`,
      displayPath: node.id,
      type: "module",
      language: node.metadata?.language || "typescript",
      isEntry: node.metadata?.isEntry || false,
      imports: {},
      exports: {},
      entities: {
        functions,
        // ✅ МАССИВ ОБЪЕКТОВ
        constants: [],
        // ✅ МАССИВ
        variables: [],
        // ✅ МАССИВ
        interfaces: [],
        // ✅ МАССИВ
        types: [],
        // ✅ МАССИВ
        classes: []
        // ✅ МАССИВ
      },
      fileStats: {
        size: node.metadata?.size || 0,
        lines: node.metadata?.lines || 0,
        functions: functions.length,
        classes: 0,
        constants: 0,
        interfaces: 0,
        types: 0,
        variables: 0
      }
    };
  }
  /**
   * Строит отчет из FullAnalysis
   * ✅ ИСПРАВЛЕНО: проверяет входные данные и гарантирует структуру
   */
  static buildReportFromAnalysis(analysis) {
    if (!analysis) {
      console.warn("\u26A0\uFE0F DataConverter.buildReportFromAnalysis: analysis is null or undefined");
      return this.createEmptyReport();
    }
    const packages = {};
    const moduleNodes = analysis.moduleGraph?.nodes || [];
    const moduleEdges = analysis.moduleGraph?.edges || [];
    const entityNodes = analysis.entityGraph?.nodes || [];
    const entityEdges = analysis.entityGraph?.edges || [];
    if (moduleNodes.length === 0) {
      console.warn("\u26A0\uFE0F DataConverter.buildReportFromAnalysis: no module nodes found");
      return this.createEmptyReport();
    }
    const safeModuleNodes = ensureArray(moduleNodes);
    const safeEntityNodes = ensureArray(entityNodes);
    const safeEntityEdges = ensureArray(entityEdges);
    for (const node of safeModuleNodes) {
      if (!node) continue;
      const modulePath = node.id;
      if (!modulePath) continue;
      const entities = safeEntityNodes.filter((e) => e.module === modulePath);
      packages[modulePath] = this.convertModuleNodeToPackage(node, entities, safeEntityEdges);
    }
    const inwardDependencies = {};
    const outwardDependencies = {};
    for (const edge of moduleEdges) {
      if (!edge) continue;
      const from = edge.from;
      const to = edge.to;
      if (!from || !to) continue;
      if (!outwardDependencies[from]) {
        outwardDependencies[from] = [];
      }
      if (!inwardDependencies[to]) {
        inwardDependencies[to] = [];
      }
      outwardDependencies[from].push(to);
      inwardDependencies[to].push(from);
    }
    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;
    for (const pkg of Object.values(packages)) {
      if (!pkg) continue;
      const funcs = ensureArray(pkg.entities?.functions);
      for (const func of funcs) {
        totalFunctions++;
        totalCalls += ensureArray(func.calls).length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }
    return {
      name: "ast-analyzer",
      version: "3.0.0",
      lockfileVersion: 3,
      packages,
      dependencyGraph: {
        direction: "bidirectional",
        inwardDependencies,
        outwardDependencies
      },
      entityStats: {
        totalFunctions,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls,
        totalExportedFunctions,
        totalAsyncFunctions
      },
      fileStats: {
        totalFiles: Object.keys(packages).length,
        totalSize: 0,
        totalLines: 0
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Создает пустой отчет
   */
  static createEmptyReport() {
    return {
      name: "ast-analyzer",
      version: "3.0.0",
      lockfileVersion: 3,
      packages: {},
      dependencyGraph: {
        direction: "bidirectional",
        inwardDependencies: {},
        outwardDependencies: {}
      },
      entityStats: {
        totalFunctions: 0,
        totalConstants: 0,
        totalVariables: 0,
        totalInterfaces: 0,
        totalTypes: 0,
        totalClasses: 0,
        totalCalls: 0,
        totalExportedFunctions: 0,
        totalAsyncFunctions: 0
      },
      fileStats: {
        totalFiles: 0,
        totalSize: 0,
        totalLines: 0
      },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Обогащает отчет данными из entitiesWithCalls
   * ✅ ИСПРАВЛЕНО: гарантирует, что все данные - массивы
   */
  static enrichReport(report, entitiesWithCalls) {
    if (!report) {
      console.warn("\u26A0\uFE0F DataConverter.enrichReport: report is null or undefined");
      return this.createEmptyReport();
    }
    if (!entitiesWithCalls) {
      console.log("\u2139\uFE0F DataConverter.enrichReport: no entities to enrich");
      return report;
    }
    const functions = ensureArray(entitiesWithCalls.functions);
    if (functions.length === 0) {
      console.log("\u2139\uFE0F DataConverter.enrichReport: no functions to enrich");
      return report;
    }
    console.log(`\u{1F4CA} \u041E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u0438\u0437 entitiesWithCalls (${functions.length} \u0444\u0443\u043D\u043A\u0446\u0438\u0439)...`);
    if (!report.packages) {
      console.warn("\u26A0\uFE0F DataConverter.enrichReport: report.packages is undefined");
      report.packages = {};
    }
    let enrichedCount = 0;
    for (const [modulePath, pkg] of Object.entries(report.packages)) {
      if (!pkg) continue;
      if (!pkg.entities) {
        pkg.entities = {
          functions: [],
          constants: [],
          variables: [],
          interfaces: [],
          types: [],
          classes: []
        };
      }
      if (!Array.isArray(pkg.entities.functions)) {
        pkg.entities.functions = [];
      }
      for (const func of pkg.entities.functions) {
        if (!func) continue;
        const enrichedFunc = functions.find((f) => {
          if (!f) return false;
          const funcModule = f._modulePath || f.modulePath || "";
          return f.name === func.name && (funcModule === modulePath || funcModule.includes(modulePath) || modulePath.includes(funcModule));
        });
        if (enrichedFunc) {
          if (enrichedFunc.calls && Array.isArray(enrichedFunc.calls)) {
            func.calls = enrichedFunc.calls;
          }
          if (enrichedFunc.calledBy && Array.isArray(enrichedFunc.calledBy)) {
            func.calledBy = enrichedFunc.calledBy;
          }
          if (enrichedFunc.params && Array.isArray(enrichedFunc.params)) {
            func.params = enrichedFunc.params;
          }
          if (enrichedFunc.returnType) {
            func.returnType = enrichedFunc.returnType;
          }
          if (enrichedFunc.isAsync !== void 0) {
            func.isAsync = enrichedFunc.isAsync;
          }
          if (enrichedFunc.isExported !== void 0) {
            func.isExported = enrichedFunc.isExported;
          }
          if (enrichedFunc.body) {
            func.body = enrichedFunc.body;
          }
          if (enrichedFunc.line) {
            func.line = enrichedFunc.line;
          }
          if (enrichedFunc.startLine) {
            func.startLine = enrichedFunc.startLine;
          }
          if (enrichedFunc.endLine) {
            func.endLine = enrichedFunc.endLine;
          }
          enrichedCount++;
        }
      }
    }
    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;
    for (const pkg of Object.values(report.packages)) {
      if (!pkg) continue;
      const funcs = ensureArray(pkg.entities?.functions);
      for (const func of funcs) {
        totalFunctions++;
        totalCalls += ensureArray(func.calls).length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }
    if (report.entityStats) {
      report.entityStats.totalFunctions = totalFunctions;
      report.entityStats.totalCalls = totalCalls;
      report.entityStats.totalExportedFunctions = totalExportedFunctions;
      report.entityStats.totalAsyncFunctions = totalAsyncFunctions;
    }
    console.log(`  \u2705 \u041E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u043E ${enrichedCount} \u0444\u0443\u043D\u043A\u0446\u0438\u0439 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u043E \u0432\u044B\u0437\u043E\u0432\u0430\u0445`);
    return report;
  }
};
var data_converter_default = DataConverter;
export {
  DataConverter,
  data_converter_default as default
};
