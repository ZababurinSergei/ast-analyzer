// src/reporters/json-reporter.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - Полностью очищена от неиспользуемых функций

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';

import type {
  GraphData,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  EntitiesResult,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
} from '../types.js';

import type {
  EnhancedPackageLockReport,
  EnhancedEntityInfo,
  PackageLockImportInfo,
  EnhancedFunctionInfo,
  FunctionEntity,
  EntityStats,
  FileStats,
  EnhancedPackageInfo,
  CallGraphResult,
} from './modules/types.js';

import type {
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
} from './modules/types.js';

import type { CompactReport, CompactModule, CompactFunction } from '../types.js';

import {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

import {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

import { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

import {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

import { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

import { buildArchitectureMetrics } from './modules/architecture.js';

import { buildSummary } from './modules/summary.js';

import { buildPackages } from './modules/packages.js';

// ✅ Импортируем idManager для генерации ID
import idManager from '../core/IdManager.js';

// ============================================================
// ЭКСПОРТ ВСЕХ ТИПОВ
// ============================================================

export type {
  GraphData,
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedPackageLockReport,
  EnhancedPackageInfo,
  PackageLockImportInfo,
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  FunctionEntity,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  EnhancedFunctionInfo,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  CompactReport,
  CompactModule,
  CompactFunction,
  EntityStats,
  FileStats,
  CallGraphResult,
};

// ============================================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
// ============================================================

export {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

export {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

export { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

export {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

export { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

export { buildArchitectureMetrics } from './modules/architecture.js';

export { buildSummary } from './modules/summary.js';

export { buildPackages } from './modules/packages.js';

// ============================================================
// extractEntitiesFromFile - ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
  };

  const absolutePath = filePath;

  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️ Файл не найден: ${absolutePath}`);
    return entities;
  }

  try {
    const project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        jsx: 2,
      },
      useInMemoryFileSystem: false,
    });

    const sourceFile = project.addSourceFileAtPath(absolutePath);
    if (!sourceFile) {
      console.warn(`⚠️ Не удалось загрузить файл: ${absolutePath}`);
      return entities;
    }

    const importedNames = new Set<string>();
    try {
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const imp of importDeclarations) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        const specifiers: string[] = [];

        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
          const name = named.getName();
          specifiers.push(name);
          importedNames.add(name);
        }

        const defaultImport = imp.getDefaultImport();
        if (defaultImport) {
          const name = defaultImport.getText();
          specifiers.unshift(`default as ${name}`);
          importedNames.add(name);
        }

        const namespaceImport = imp.getNamespaceImport();
        if (namespaceImport) {
          const name = namespaceImport.getText();
          specifiers.push(`* as ${name}`);
        }

        if (moduleSpecifier && specifiers.length > 0) {
          entities.imports!.push({
            source: moduleSpecifier,
            specifiers: specifiers,
            isTypeOnly: false,
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при извлечении импортов:', error);
    }

    const functions = sourceFile.getFunctions();
    for (const functionDecl of functions) {
      const name = functionDecl.getName();
      if (!name) continue;

      const params = functionDecl.getParameters().map((p: any) => p.getName());
      const returnType = functionDecl.getReturnType().getText();
      const isAsync = functionDecl.isAsync();
      const isExported = functionDecl.isExported();

      const calls: string[] = [];
      functionDecl.forEachDescendant((node: any) => {
        if (Node.isCallExpression(node)) {
          const expr = node.getExpression();
          if (Node.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (calledName && calledName !== name && !importedNames.has(calledName)) {
              calls.push(calledName);
            }
          }
        }
      });

      let complexity = 1;
      try {
        functionDecl.forEachDescendant((node: any) => {
          const kind = node.getKind();
          if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
            complexity++;
          }
        });
      } catch (error: any) {
        complexity = 1;
      }

      const bodyText = functionDecl.getBody()?.getText() || '';
      const security = {
        hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
        hasProcessEnv: bodyText.includes('process.env'),
        hasSensitiveData:
          /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
          /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
        hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
        hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
      };

      const moduleName = path.basename(path.dirname(absolutePath));

      entities.functions.push({
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: functionDecl.getStartLineNumber(),
        startLine: functionDecl.getStartLineNumber(),
        endLine: functionDecl.getEndLineNumber(),
        isAsync,
        isExported,
        isMethod: false,
        className: '',
        calls: [...new Set(calls)],
        calledBy: [],
        returnType,
        body: bodyText,
        isNested: false,
        parentFunction: '',
        isArrow: false,
        isEventHandler: false,
        eventType: '',
        depth: 0,
        complexity,
        security,
        vscode: `vscode://file/${absolutePath}:${functionDecl.getStartLineNumber()}`,
        signature: '',
        _safeInfo: null,
        filePath: absolutePath,
        moduleName: moduleName,
        _modulePath: path.dirname(absolutePath),
        id: idManager.generateCompactId({
          filePath: absolutePath,
          funcName: name,
          line: functionDecl.getStartLineNumber(),
          parentFunction: undefined,
          depth: 0,
        }),
      });
    }

    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      if (initializer && Node.isArrowFunction(initializer)) {
        const isExported = decl.isExported();
        const params = initializer.getParameters().map((p: any) => p.getName());
        const returnType = initializer.getReturnType().getText();
        const isAsync = initializer.isAsync();

        const existing = entities.functions.find((f: any) => f.name === name);
        if (!existing) {
          const calls: string[] = [];
          initializer.forEachDescendant((node: any) => {
            if (Node.isCallExpression(node)) {
              const expr = node.getExpression();
              if (Node.isIdentifier(expr)) {
                const calledName = expr.getText();
                if (calledName && calledName !== name && !importedNames.has(calledName)) {
                  calls.push(calledName);
                }
              }
            }
          });

          const bodyText = initializer.getBody()?.getText() || '';
          const security = {
            hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
            hasProcessEnv: bodyText.includes('process.env'),
            hasSensitiveData:
              /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
              /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
            hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
            hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
          };

          let complexity = 1;
          try {
            initializer.forEachDescendant((node: any) => {
              const kind = node.getKind();
              if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
                complexity++;
              }
            });
          } catch (error: any) {
            complexity = 1;
          }

          const moduleName = path.basename(path.dirname(absolutePath));

          entities.functions.push({
            name,
            params,
            paramTypes: params.map(() => 'any'),
            line: decl.getStartLineNumber(),
            startLine: decl.getStartLineNumber(),
            endLine: initializer.getEndLineNumber(),
            isAsync,
            isExported,
            isMethod: false,
            className: '',
            calls: [...new Set(calls)],
            calledBy: [],
            returnType,
            body: bodyText,
            isNested: false,
            parentFunction: '',
            isArrow: true,
            isEventHandler: false,
            eventType: '',
            depth: 0,
            complexity,
            security,
            vscode: `vscode://file/${absolutePath}:${decl.getStartLineNumber()}`,
            signature: '',
            _safeInfo: null,
            filePath: absolutePath,
            moduleName: moduleName,
            _modulePath: path.dirname(absolutePath),
            id: idManager.generateCompactId({
              filePath: absolutePath,
              funcName: name,
              line: decl.getStartLineNumber(),
              parentFunction: undefined,
              depth: 0,
            }),
          });

          const constIndex = entities.constants.findIndex((c: any) => c.name === name);
          if (constIndex !== -1) {
            entities.constants.splice(constIndex, 1);
          }
        }
      }
    }

    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      const isArrowFunction = initializer && Node.isArrowFunction(initializer);
      if (isArrowFunction) continue;

      const isConst = decl.getVariableStatement()?.getDeclarationKind() === 'const';

      const info = {
        name,
        line: decl.getStartLineNumber(),
        isExported: decl.isExported(),
        type: initializer ? initializer.getType().getText() : 'any',
        value: initializer ? extractValueFromNode(initializer) : undefined,
        _safeInfo: null,
      };

      if (isConst) {
        entities.constants.push(info);
      } else {
        entities.variables.push(info);
      }
    }

    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const methods: string[] = [];
      const properties: string[] = [];

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          methods.push(methodName);
        }
      }

      for (const prop of cls.getProperties()) {
        const propName = prop.getName();
        if (propName) {
          properties.push(propName);
        }
      }

      entities.classes.push({
        name,
        methods,
        properties,
        line: cls.getStartLineNumber(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        isExported: cls.isExported(),
        extends: cls.getExtends()?.getText(),
        implements: cls.getImplements().map((i: any) => i.getText()),
        _safeInfo: null,
      });
    }

    const interfaces = sourceFile.getInterfaces();
    for (const intf of interfaces) {
      const name = intf.getName();
      if (!name) continue;

      const properties: string[] = [];
      for (const prop of intf.getProperties()) {
        properties.push(prop.getName());
      }

      entities.interfaces.push({
        name,
        properties,
        line: intf.getStartLineNumber(),
        startLine: intf.getStartLineNumber(),
        endLine: intf.getEndLineNumber(),
        isExported: intf.isExported(),
        extends: intf.getExtends().map((e: any) => e.getText()),
        _safeInfo: null,
      });
    }

    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (!name) continue;

      entities.types.push({
        name,
        definition: typeAlias.getType().getText(),
        line: typeAlias.getStartLineNumber(),
        isExported: typeAlias.isExported(),
        _safeInfo: null,
      });
    }

    const relativePath = path.relative(process.cwd(), absolutePath);
    console.log(`✅ Извлечено сущностей из ${relativePath}:`);
    console.log(`   Функций: ${entities.functions.length}`);
    console.log(`   Классов: ${entities.classes.length}`);
    console.log(`   Констант: ${entities.constants.length}`);
    console.log(`   Интерфейсов: ${entities.interfaces.length}`);
    console.log(`   Типов: ${entities.types.length}`);
    console.log(`   Переменных: ${entities.variables.length}`);
    console.log(`   Импортов: ${entities.imports?.length || 0}`);

    return entities;
  } catch (error: any) {
    console.error(
      `❌ Ошибка при извлечении сущностей из ${absolutePath}:`,
      error?.message || String(error)
    );
    return entities;
  }
}

function extractValueFromNode(node: any): any {
  try {
    const text = node.getText();

    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      return text.slice(1, -1);
    }

    if (!isNaN(Number(text)) && text !== '') {
      return Number(text);
    }

    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    if (text === 'undefined') return undefined;

    if (Node.isArrayLiteralExpression(node)) {
      return node.getElements().map((e: any) => extractValueFromNode(e));
    }

    if (Node.isObjectLiteralExpression(node)) {
      const result: Record<string, any> = {};
      for (const prop of node.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const initializer = prop.getInitializer();
          if (initializer) {
            result[name] = extractValueFromNode(initializer);
          }
        }
      }
      return result;
    }

    if (Node.isIdentifier(node)) {
      return node.getText();
    }

    return undefined;
  } catch (error: any) {
    return undefined;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ - ТОЛЬКО ИСПОЛЬЗУЕМЫЕ ФУНКЦИИ
// ============================================================

export default {
  extractEntitiesFromFile,
  metadata: {
    createMetadata,
    getReportName,
    getReportVersion,
    getLockfileVersion,
  },
  statistics: {
    calculateEntityStats,
    calculateFileStats,
  },
  graphs: {
    buildDependencyGraph,
    findCycles,
    getMaxDepth,
    getModulesByLevel,
  },
  flows: {
    buildExecutionGraph,
    buildImportExportFlow,
  },
  architecture: {
    buildArchitectureMetrics,
  },
  summary: {
    buildSummary,
  },
  packages: {
    buildPackages,
  },
  utils: {
    ensureArray,
    safeString,
    safeNumber,
    safeBoolean,
    isRealObject,
    filterRealObjects,
    sanitizeEntities,
    safeTraverseAST,
    findProjectRoot,
    findFileInProject,
    findModuleForEntity,
  },
};
