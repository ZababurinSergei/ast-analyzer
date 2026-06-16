// packages/ast-analyzer/src/refactor/ModuleExtractor.ts
import type { Project, SourceFile, Node } from 'ts-morph';
import { Node as TsNode, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import type { ExtractedModule } from './index.js';
import type { Logger } from '../utils/Logger.js';

export interface Cluster {
  name: string;
  functions: string[];
  cohesionScore: number;
}

export interface SharedVariableInfo {
  name: string;
  type: string;
  value?: any;
  isConst: boolean;
  node: Node; // Сохраняем оригинальный узел для копирования
}

export class ModuleExtractor {
  private project: Project;
  private options: any;
  private logger: Logger;

  constructor(project: Project, options: any, logger: Logger) {
    this.project = project;
    this.options = options;
    this.logger = logger;
  }

  async extractModules(sourcePath: string, clusters: Cluster[]): Promise<ExtractedModule[]> {
    this.logger.info('Starting module extraction', {
      sourcePath,
      clustersCount: clusters.length,
    });

    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    const modulesDir = path.join(path.dirname(sourcePath), this.options.modulesDir || 'modules');

    await fs.promises.mkdir(modulesDir, { recursive: true });
    this.logger.debug('Created modules directory', { modulesDir });

    const modules: ExtractedModule[] = [];
    const nodesToRemoveMap = new Map<Node, string>();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (!cluster) continue;

      this.logger.info(`Processing cluster ${i + 1}/${clusters.length}`, {
        name: cluster.name,
        functionsCount: cluster.functions.length,
      });

      const moduleName = this.generateModuleName(cluster, i);
      const modulePath = path.join(modulesDir, `${moduleName}.js`);

      this.logger.debug(`Creating module: ${moduleName}.js`, {
        exports: cluster.functions,
      });

      const moduleFile = this.project.createSourceFile(modulePath, '', { overwrite: true });

      // 1. Анализируем все зависимости для кластера
      const { allDependencies, sharedVariables, requiredImports } =
        await this.analyzeClusterDependencies(sourceFile, cluster);

      this.logger.debug('Cluster analysis complete', {
        dependenciesCount: allDependencies.size,
        sharedVariablesCount: sharedVariables.size,
        importsCount: requiredImports.size,
      });

      // 2. Добавляем импорты в модуль
      for (const [importPath, importInfo] of requiredImports) {
        if (importInfo.namespace) {
          moduleFile.addImportDeclaration({
            namespaceImport: importInfo.namespace,
            moduleSpecifier: importPath,
          });
        } else if (importInfo.default) {
          moduleFile.addImportDeclaration({
            defaultImport: importInfo.default,
            namedImports: importInfo.named.size > 0 ? Array.from(importInfo.named) : undefined,
            moduleSpecifier: importPath,
          });
        } else if (importInfo.named.size > 0) {
          moduleFile.addImportDeclaration({
            namedImports: Array.from(importInfo.named),
            moduleSpecifier: importPath,
          });
        }
      }

      // 3. Добавляем общие переменные (shared variables) с копированием оригинального кода
      const sharedVariablesCode = this.generateSharedVariablesCode(sourceFile, sharedVariables);
      if (sharedVariablesCode) {
        moduleFile.addStatements(sharedVariablesCode);
      }

      // 4. Копируем функции в модуль
      const clusterNodes: Node[] = [];
      const exportedNames: string[] = [];

      for (const funcName of cluster.functions) {
        const node = this.findNode(sourceFile, funcName);
        if (node) {
          clusterNodes.push(node);
          nodesToRemoveMap.set(node, funcName);

          let text = node.getText();
          if (!text.trim().startsWith('export')) {
            text = `export ${text}`;
          }

          moduleFile.addStatements(text);
          exportedNames.push(funcName);
        } else {
          this.logger.warn(`Function not found in source file`, { funcName });
        }
      }

      // 5. Добавляем зависимости (вспомогательные функции)
      const dependenciesCode = await this.generateDependenciesCode(
        sourceFile,
        cluster,
        allDependencies
      );
      if (dependenciesCode) {
        moduleFile.addStatements(dependenciesCode);
      }

      // Сохраняем модуль
      await moduleFile.save();
      this.project.addSourceFileAtPath(modulePath);
      this.logger.info(`Module created successfully`, {
        moduleName,
        exportsCount: exportedNames.length,
      });

      modules.push({
        name: moduleName,
        path: modulePath,
        exports: exportedNames,
        dependencies: Array.from(requiredImports.keys()),
        originalNodes: [],
      });
    }

    // Удаляем узлы из исходного файла
    if (nodesToRemoveMap.size > 0) {
      this.logger.debug('Removing nodes from source file', {
        nodesCount: nodesToRemoveMap.size,
      });
      this.removeNodesWithTsMorph(nodesToRemoveMap);
    }

    await sourceFile.save();
    this.logger.info('Module extraction complete', { modulesCount: modules.length });

    return modules;
  }

  /**
   * Генерирует код для общих переменных с копированием оригинального кода
   * Улучшенная версия с гарантией синтаксической корректности
   */
  private generateSharedVariablesCode(
    sourceFile: SourceFile,
    sharedVariables: Map<string, SharedVariableInfo>
  ): string {
    if (sharedVariables.size === 0) return '';

    let code = '\n// ============================================\n';
    code += '// ОБЩИЕ ПЕРЕМЕННЫЕ (перенесены из исходного файла)\n';
    code += '// ============================================\n';

    for (const [name, info] of sharedVariables) {
      // Пытаемся получить полное объявление переменной
      const varDecl = sourceFile.getVariableDeclaration(name);
      if (varDecl) {
        const parent = varDecl.getParent();
        if (parent && parent.getKind() === SyntaxKind.VariableStatement) {
          const fullText = parent.getText();
          if (fullText) {
            code += fullText + '\n';
            this.logger.debug(`Copied variable declaration: ${name}`, {
              originalText: fullText.substring(0, 100) + '...',
            });
            continue;
          }
        }
      }

      // Fallback: используем старую логику с исправлением
      const keyword = info.isConst ? 'const' : 'let';

      if (info.value !== undefined) {
        const valueStr = typeof info.value === 'string' ? `'${info.value}'` : String(info.value);
        code += `${keyword} ${name} = ${valueStr};\n`;
        this.logger.debug(`Generated variable from value: ${name}`, { value: valueStr });
      } else {
        // Для const без значения - используем let и логируем предупреждение
        const finalKeyword = info.isConst ? 'let' : keyword;
        this.logger.warn(
          `Variable declared as const without initializer, using 'let' as fallback`,
          {
            name,
            originalKeyword: keyword,
            fallbackKeyword: finalKeyword,
          }
        );
        code += `${finalKeyword} ${name};\n`;
      }
    }

    return code + '\n';
  }

  /**
   * Анализирует зависимости кластера (обновлённая версия с сохранением узлов)
   */
  private async analyzeClusterDependencies(
    sourceFile: SourceFile,
    cluster: Cluster
  ): Promise<{
    allDependencies: Set<string>;
    sharedVariables: Map<string, SharedVariableInfo>;
    requiredImports: Map<string, { named: Set<string>; default?: string; namespace?: string }>;
  }> {
    const allDependencies = new Set<string>();
    const sharedVariables = new Map<string, SharedVariableInfo>();
    const requiredImports = new Map<
      string,
      { named: Set<string>; default?: string; namespace?: string }
    >();

    // Находим все узлы кластера
    const clusterNodes: Node[] = [];
    for (const funcName of cluster.functions) {
      const node = this.findNode(sourceFile, funcName);
      if (node) {
        clusterNodes.push(node);
      }
    }

    // Собираем все идентификаторы, используемые в кластере
    const usedIdentifiers = new Set<string>();
    for (const node of clusterNodes) {
      const identifiers = this.findAllIdentifiersInNode(node);
      for (const id of identifiers) {
        usedIdentifiers.add(id);
      }
    }

    // Находим переменные, объявленные вне функций, но используемые внутри
    const topLevelStatements = sourceFile.getStatements();
    for (const stmt of topLevelStatements) {
      if (TsNode.isVariableStatement(stmt)) {
        const declarations = stmt.getDeclarations();
        for (const decl of declarations) {
          const name = decl.getName();
          if (usedIdentifiers.has(name) && !cluster.functions.includes(name)) {
            // Сохраняем информацию о переменной вместе с узлом
            const initializer = decl.getInitializer();
            const isConst = stmt.getDeclarationKind() === 'const';
            sharedVariables.set(name, {
              name,
              type: this.inferVariableType(decl),
              value: initializer ? this.extractValue(initializer) : undefined,
              isConst,
              node: decl,
            });
            this.logger.debug(`Found shared variable`, {
              name,
              isConst,
              hasInitializer: !!initializer,
            });
          }
        }
      }

      // Проверяем ImportDeclaration
      if (TsNode.isImportDeclaration(stmt)) {
        const moduleSpec = stmt.getModuleSpecifierValue();
        const identifiersInCluster = Array.from(usedIdentifiers);

        const defaultImport = stmt.getDefaultImport()?.getText();
        const namespaceImport = stmt.getNamespaceImport()?.getText();
        const namedImports = stmt.getNamedImports();

        const usedNamed = new Set<string>();

        if (defaultImport && identifiersInCluster.includes(defaultImport)) {
          const info = requiredImports.get(moduleSpec) || { named: new Set() };
          info.default = defaultImport;
          requiredImports.set(moduleSpec, info);
        }

        if (namespaceImport) {
          for (const node of clusterNodes) {
            const nodeText = node.getText();
            if (nodeText.includes(`${namespaceImport}.`)) {
              const info = requiredImports.get(moduleSpec) || { named: new Set() };
              info.namespace = namespaceImport;
              requiredImports.set(moduleSpec, info);
              break;
            }
          }
        }

        for (const named of namedImports) {
          const name = named.getName();
          if (identifiersInCluster.includes(name)) {
            usedNamed.add(name);
          }
        }

        if (usedNamed.size > 0) {
          const info = requiredImports.get(moduleSpec) || { named: new Set() };
          for (const name of usedNamed) {
            info.named.add(name);
          }
          requiredImports.set(moduleSpec, info);
        }
      }
    }

    // Собираем зависимости (функции, которые вызываются, но не входят в кластер)
    for (const node of clusterNodes) {
      this.collectDependenciesFromNode(node, cluster, allDependencies);
    }

    return { allDependencies, sharedVariables, requiredImports };
  }

  /**
   * Находит все идентификаторы в узле
   */
  private findAllIdentifiersInNode(node: Node): Set<string> {
    const identifiers = new Set<string>();

    node.forEachDescendant(child => {
      if (TsNode.isIdentifier(child)) {
        identifiers.add(child.getText());
      }
    });

    return identifiers;
  }

  /**
   * Собирает зависимости из узла
   */
  private collectDependenciesFromNode(
    node: Node,
    cluster: Cluster,
    dependencies: Set<string>
  ): void {
    node.forEachDescendant(child => {
      if (TsNode.isCallExpression(child)) {
        const expression = child.getExpression();
        if (TsNode.isIdentifier(expression)) {
          const calledName = expression.getText();
          if (!cluster.functions.includes(calledName) && !calledName.startsWith('_')) {
            dependencies.add(calledName);
          }
        }
      }
    });
  }

  /**
   * Определяет тип переменной
   */
  private inferVariableType(node: Node): string {
    const text = node.getText();
    if (text.includes('=')) {
      if (text.includes('{')) return 'object';
      if (text.includes('[')) return 'array';
      if (text.includes('function') || text.includes('=>')) return 'function';
      if (text.includes("'") || text.includes('"')) return 'string';
      if (text.includes('true') || text.includes('false')) return 'boolean';
      if (text.match(/\d+/)) return 'number';
    }
    return 'unknown';
  }

  /**
   * Извлекает значение из узла (улучшенная версия)
   */
  private extractValue(node: Node): any {
    const kind = node.getKind();

    if (kind === SyntaxKind.StringLiteral) {
      const text = node.getText();
      return text.slice(1, -1);
    }

    if (kind === SyntaxKind.NumericLiteral) {
      return parseFloat(node.getText());
    }

    if (kind === SyntaxKind.TrueKeyword) return true;
    if (kind === SyntaxKind.FalseKeyword) return false;
    if (kind === SyntaxKind.NullKeyword) return null;

    // Для сложных выражений возвращаем undefined (будет использован fallback)
    return undefined;
  }

  /**
   * Находит узел по имени
   */
  private findNode(sourceFile: SourceFile, name: string): Node | undefined {
    const func = sourceFile.getFunction(name);
    if (func) return func;

    const cls = sourceFile.getClass(name);
    if (cls) return cls;

    const variable = sourceFile.getVariableDeclaration(name);
    if (variable) return variable;

    const intf = sourceFile.getInterface(name);
    if (intf) return intf;

    const typeAlias = sourceFile.getTypeAlias(name);
    if (typeAlias) return typeAlias;

    const enumDecl = sourceFile.getEnum(name);
    if (enumDecl) return enumDecl;

    return undefined;
  }

  /**
   * Удаляет узлы из исходного файла
   */
  private removeNodesWithTsMorph(nodesToRemove: Map<Node, string>): void {
    const nodesArray = Array.from(nodesToRemove.keys());
    nodesArray.sort((a, b) => b.getStart() - a.getStart());

    for (const node of nodesArray) {
      try {
        const name = nodesToRemove.get(node) || 'unknown';
        if ('remove' in node && typeof (node as any).remove === 'function') {
          (node as any).remove();
          this.logger.debug(`Removed node: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to remove node`, {
          name: nodesToRemove.get(node),
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Генерирует имя модуля
   */
  private generateModuleName(cluster: Cluster, index: number): string {
    const firstName = cluster.functions.find(f => !f.startsWith('_') && f.length > 2);

    if (firstName) {
      let name = firstName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();

      const prefixes = ['get-', 'set-', 'is-', 'has-', 'use-', 'fetch-', 'handle-', 'on-'];
      for (const prefix of prefixes) {
        if (name.startsWith(prefix)) {
          name = name.slice(prefix.length);
          break;
        }
      }

      if (name.length >= 3 && name !== '') {
        return name;
      }
    }

    return `module-${index + 1}`;
  }

  /**
   * Генерирует код для зависимостей
   */
  private async generateDependenciesCode(
    sourceFile: SourceFile,
    cluster: Cluster,
    dependencies: Set<string>
  ): Promise<string> {
    if (dependencies.size === 0) return '';

    let code = '\n// ============================================\n';
    code += '// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (зависимости)\n';
    code += '// ============================================\n';

    for (const depName of dependencies) {
      const node = this.findNode(sourceFile, depName);
      if (node && !cluster.functions.includes(depName)) {
        let text = node.getText();
        if (text.trim().startsWith('export ')) {
          text = text.replace(/^export\s+/, '');
        }
        code += `${text}\n\n`;
        this.logger.debug(`Added dependency: ${depName}`);
      }
    }

    return code;
  }
}
