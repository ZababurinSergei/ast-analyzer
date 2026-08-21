// src/reporters/data-converter.ts
var DataConverter = class {
  /**
   * Преобразует ModuleNode в PackageLockPackage
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
    const functions = entityNodes.filter((e) => e.type === "function").map((e) => ({
      name: e.name,
      params: e.metadata?.params || [],
      paramTypes: [],
      line: e.line || 0,
      startLine: e.metadata?.startLine || e.line || 0,
      endLine: e.metadata?.endLine || e.line || 0,
      isAsync: e.metadata?.isAsync || false,
      isExported: e.metadata?.isExported || false,
      isMethod: e.metadata?.isMethod || false,
      className: e.metadata?.className,
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
        constants: [],
        variables: [],
        interfaces: [],
        types: [],
        classes: []
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
   */
  static buildReportFromAnalysis(analysis) {
    const packages = {};
    const moduleNodes = analysis.moduleGraph?.nodes || [];
    const moduleEdges = analysis.moduleGraph?.edges || [];
    const entityNodes = analysis.entityGraph?.nodes || [];
    const entityEdges = analysis.entityGraph?.edges || [];
    for (const node of moduleNodes) {
      if (!node) continue;
      const modulePath = node.id;
      if (!modulePath) continue;
      const entities = entityNodes.filter((e) => e.module === modulePath);
      packages[modulePath] = this.convertModuleNodeToPackage(node, entities, entityEdges);
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
      for (const func of pkg.entities.functions) {
        totalFunctions++;
        totalCalls += func.calls.length;
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
   * Обогащает отчет данными из entitiesWithCalls
   */
  static enrichReport(report, entitiesWithCalls) {
    if (!entitiesWithCalls) return report;
    console.log("\u{1F4CA} \u041E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u0438\u0437 entitiesWithCalls...");
    for (const [modulePath, pkg] of Object.entries(report.packages)) {
      if (!pkg) continue;
      for (const func of pkg.entities.functions) {
        const enrichedFunc = entitiesWithCalls.functions.find((f) => {
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
        }
      }
    }
    let totalFunctions = 0;
    let totalCalls = 0;
    let totalExportedFunctions = 0;
    let totalAsyncFunctions = 0;
    for (const pkg of Object.values(report.packages)) {
      if (!pkg) continue;
      for (const func of pkg.entities.functions) {
        totalFunctions++;
        totalCalls += func.calls.length;
        if (func.isExported) {
          totalExportedFunctions++;
        }
        if (func.isAsync) {
          totalAsyncFunctions++;
        }
      }
    }
    report.entityStats.totalFunctions = totalFunctions;
    report.entityStats.totalCalls = totalCalls;
    report.entityStats.totalExportedFunctions = totalExportedFunctions;
    report.entityStats.totalAsyncFunctions = totalAsyncFunctions;
    console.log(`  \u2705 \u041E\u0431\u043E\u0433\u0430\u0449\u0435\u043D\u043E ${totalFunctions} \u0444\u0443\u043D\u043A\u0446\u0438\u0439 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u043E \u0432\u044B\u0437\u043E\u0432\u0430\u0445`);
    return report;
  }
};
var data_converter_default = DataConverter;
export {
  DataConverter,
  data_converter_default as default
};
