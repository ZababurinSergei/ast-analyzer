// packages/ast-analyzer/src/refactor/ModuleExtractor.ts
import type { Project, SourceFile, Node } from 'ts-morph';
import { Node as TsNode, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';
import type { Logger } from '../utils/Logger.js';
import type { ModuleType } from './ModuleTypeDetector.js';
import type { IRefactorContext } from './interfaces/IRefactorContext.js';
import type { ExtractedModule } from './types.js';
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
  node: Node;
}

export interface DependencyInfo {
  name: string;
  type: 'function' | 'variable' | 'constant' | 'import';
  isExported: boolean;
  sourceFile: string;
  node?: Node;
}

// ==========================================
// НОВЫЕ ФУНКЦИИ ДЛЯ ОПРЕДЕЛЕНИЯ ТИПА МОДУЛЯ
// ==========================================

function determineModuleExtension(
  code: string,
  sourcePath: string,
  defaultType: 'esm' | 'cjs'
): string {
  // Если исходный файл TypeScript, используем .ts
  if (sourcePath.endsWith('.ts') || sourcePath.endsWith('.tsx')) {
    return '.ts';
  }

  // Если есть TypeScript-специфичные конструкции, но файл не .ts, используем .js
  if (hasTypeScriptSyntax(code) && !sourcePath.endsWith('.ts')) {
    return '.js';
  }

  // Проверяем наличие top-level await
  if (/(?:^|\n)\s*await\s+/.test(code) && !/async\s+function/.test(code)) {
    return '.mjs';
  }

  // Проверяем наличие ESM-специфичных конструкций
  if (hasESMSpecificSyntax(code)) {
    return '.mjs';
  }

  // По умолчанию используем расширение, определенное ранее
  return defaultType === 'esm' ? '.mjs' : '.js';
}

function hasTypeScriptSyntax(code: string): boolean {
  // Проверяем наличие декораторов
  if (/@\w+\s*(?:\(\))?/.test(code)) return true;

  // Проверяем наличие generics (но не HTML теги)
  if (/<\s*\w+\s*(?:extends\s+\w+)?\s*>/g.test(code) && !/<[a-z][a-z0-9]*\s*[>/]/i.test(code)) {
    return true;
  }

  // Проверяем наличие type annotations
  if (/:\s*(?:string|number|boolean|any|void|unknown|never)\b/.test(code)) return true;

  // Проверяем наличие интерфейсов и type aliases
  if (/\b(?:interface|type)\s+\w+\s*(?:<[^>]*>)?\s*{/.test(code)) return true;

  // Проверяем наличие enum
  if (/\benum\s+\w+\s*{/.test(code)) return true;

  // Проверяем наличие namespace
  if (/\bnamespace\s+\w+\s*{/.test(code)) return true;

  return false;
}

function hasESMSpecificSyntax(code: string): boolean {
  // Проверяем наличие import.meta
  if (/\bimport\.meta\b/.test(code)) return true;

  // Проверяем наличие динамических импортов
  if (/import\s*\(/.test(code)) return true;

  // Проверяем наличие export default
  if (/\bexport\s+default\b/.test(code)) return true;

  return false;
}

function hasSpecialConstructs(code: string): boolean {
  const specialPatterns = [
    /\bSymbol\s*\(/,
    /\bProxy\s*\{/,
    /\bWeakMap\s*\(/,
    /\bWeakSet\s*\(/,
    /\bBigInt\s*\(/,
    /\d+n\b/, // BigInt literal
  ];

  for (const pattern of specialPatterns) {
    if (pattern.test(code)) return true;
  }
  return false;
}

export class ModuleExtractor {
  private project: Project;
  private options: any;
  private logger: Logger;
  private originalExports: string[] = [];
  private moduleType: ModuleType = 'auto';
  private globalConstants: Map<string, any> = new Map();
  private allDependencies: Map<string, DependencyInfo> = new Map();
  private constantsModulePath: string | null = null;

  constructor(context: IRefactorContext) {
    this.project = context.project;
    this.options = context.options;
    this.logger = context.logger.child('ModuleExtractor');
  }

  setModuleType(type: ModuleType): void {
    this.moduleType = type;
  }

  async extractModules(sourcePath: string, clusters: Cluster[]): Promise<ExtractedModule[]> {
    this.logger.info('🚀 Starting module extraction with full dependency analysis', {
      sourcePath,
      clustersCount: clusters.length,
      moduleType: this.moduleType,
      dryRun: this.options.dryRun || false,
    });

    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) {
      this.logger.error('❌ Failed to load source file', { sourcePath });
      return [];
    }

    const isDryRun = this.options.dryRun || false;

    // ШАГ 1: Анализ всех глобальных констант и переменных
    this.logger.debug('📋 STEP 1: Analyzing global constants and variables');
    await this.analyzeGlobalConstants(sourceFile);

    // ШАГ 2: Сбор всех зависимостей
    this.logger.debug('📋 STEP 2: Collecting all dependencies');
    await this.collectAllDependencies(sourceFile);

    // ШАГ 3: Создание модуля констант
    this.logger.debug('📋 STEP 3: Creating constants module');
    await this.createConstantsModule(sourcePath);

    // ШАГ 4: Сбор оригинальных экспортов
    this.logger.debug('📋 STEP 4: Collecting original exports');
    this.originalExports = this.collectOriginalExports(sourceFile);

    this.logger.info('📤 Collected original exports', {
      exports: this.originalExports,
      count: this.originalExports.length,
    });

    const modulesDir = path.join(path.dirname(sourcePath), this.options.modulesDir || 'modules');

    // В DRY-RUN режиме не создаем директорию на диске
    if (!isDryRun) {
      await fs.promises.mkdir(modulesDir, { recursive: true });
    } else {
      this.logger.info('DRY RUN: would create directory', { modulesDir });
    }

    const modules: ExtractedModule[] = [];
    const nodesToRemoveMap = new Map<Node, string>();
    const allExportedNames = new Set<string>();

    // Определяем расширение на основе исходного файла
    const sourceExt = path.extname(sourcePath);
    const isTS = sourceExt === '.ts' || sourceExt === '.tsx';

    this.logger.debug(
      `📄 Using source extension: ${sourceExt} for module type: ${this.moduleType}`
    );

    // ШАГ 5: Обработка кластеров
    this.logger.debug('📦 STEP 5: Processing clusters');
    const processedExports = new Set<string>();

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (!cluster) continue;

      this.logger.info(`📦 Processing cluster ${i + 1}/${clusters.length}`, {
        name: cluster.name,
        functionsCount: cluster.functions.length,
      });

      const moduleName = this.generateModuleName(cluster, i);

      // Генерируем код кластера для определения расширения
      const clusterCode = this.generateClusterCode(sourceFile, cluster);

      // Определяем расширение
      let ext = determineModuleExtension(
        clusterCode,
        sourcePath,
        this.moduleType === 'esm' ? 'esm' : 'cjs'
      );

      // Для специальных конструкций используем .js если это возможно
      if (hasSpecialConstructs(clusterCode) && ext === '.mjs') {
        if (!hasESMSpecificSyntax(clusterCode) && !hasTypeScriptSyntax(clusterCode)) {
          ext = '.js';
          this.logger.debug(`Using .js for special constructs in ${moduleName}`);
        }
      }

      // Если расширение .ts, но это .js файл, используем .js
      if (ext === '.ts' && !sourcePath.endsWith('.ts') && !sourcePath.endsWith('.tsx')) {
        ext = '.js';
        this.logger.debug(`Using .js instead of .ts for non-TypeScript file: ${moduleName}`);
      }

      // Для TypeScript файлов всегда используем .ts
      if (isTS && ext !== '.ts') {
        ext = '.ts';
        this.logger.debug(`Using .ts for TypeScript source: ${moduleName}`);
      }

      const modulePath = path.join(modulesDir, `${moduleName}${ext}`);

      // В DRY-RUN режиме создаем файл в памяти, не на диске
      let moduleFile: SourceFile;
      if (isDryRun) {
        moduleFile = this.project.createSourceFile(modulePath, '', { overwrite: true });
        this.logger.info(`DRY RUN: would create ${modulePath}`);
      } else {
        moduleFile = this.project.createSourceFile(modulePath, '', { overwrite: true });
      }

      // Добавляем импорт констант
      if (this.constantsModulePath) {
        const relativePath = this.getRelativePath(modulePath, this.constantsModulePath);
        const constNames = Array.from(this.globalConstants.keys());
        if (constNames.length > 0) {
          moduleFile.addImportDeclaration({
            namedImports: constNames,
            moduleSpecifier: relativePath,
          });
          this.logger.debug(`  📥 Added constants import: ${constNames.join(', ')}`);
        }
      }

      // Анализируем зависимости кластера
      const { sharedVariables, requiredImports, functionDependencies } =
        await this.analyzeClusterDependencies(sourceFile, cluster);

      // Добавляем импорты
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

      // Добавляем общие переменные
      const sharedVarsCode = this.generateSharedVariablesCode(sharedVariables);
      if (sharedVarsCode) {
        moduleFile.addStatements(sharedVarsCode);
      }

      // Копируем функции в модуль
      const exportedNames: string[] = [];

      for (const funcName of cluster.functions) {
        const node = this.findNode(sourceFile, funcName);
        if (node) {
          nodesToRemoveMap.set(node, funcName);
          let text = node.getText();
          const isOriginalExport = this.originalExports.includes(funcName);

          if (isOriginalExport) {
            if (text.trim().startsWith('export ')) {
              text = text.replace(/^export\s+/, '');
            }
            exportedNames.push(funcName);
            processedExports.add(funcName);
            allExportedNames.add(funcName);
          } else {
            if (text.trim().startsWith('export ')) {
              text = text.replace(/^export\s+/, '');
            }
          }

          moduleFile.addStatements(text);
        }
      }

      // Добавляем зависимости (функции, которые используются)
      const depsCode = await this.generateDependenciesCode(sourceFile, functionDependencies);
      if (depsCode) {
        moduleFile.addStatements(depsCode);
      }

      // Добавляем экспорты - используем правильные переносы строк
      if (exportedNames.length > 0) {
        const clusterExports = exportedNames.filter(name => this.originalExports.includes(name));
        if (clusterExports.length > 0) {
          const exportLines: string[] = [];
          exportLines.push('');
          exportLines.push('// Экспорты');
          exportLines.push(`export { ${clusterExports.join(', ')} };`);
          exportLines.push('');
          moduleFile.addStatements(exportLines.join('\n'));
          this.logger.info(`  ✅ Added exports: ${clusterExports.join(', ')}`);
        }
      }

      // Проверяем, что модуль не пустой
      if (exportedNames.length === 0 && !sharedVariables.size && !functionDependencies.size) {
        this.logger.debug(`Skipping empty module: ${moduleName}`);
        continue;
      }

      // Валидируем созданный модуль
      if (!isDryRun) {
        const isValid = await this.validateModule(modulePath, moduleFile.getText());
        if (!isValid) {
          this.logger.warn(`  ⚠️ Module ${moduleName} may have syntax issues, but continuing`);
        }
      }

      // Сохраняем модуль только если не DRY-RUN
      if (!isDryRun) {
        await moduleFile.save();
        this.project.addSourceFileAtPath(modulePath);
        this.logger.info(
          `  ✅ Module created: ${moduleName}${ext} (${exportedNames.length} exports)`
        );
      } else {
        this.logger.info(
          `  🔍 DRY RUN: would create ${moduleName}${ext} (${exportedNames.length} exports)`
        );
      }

      const finalExports = exportedNames.filter(name => this.originalExports.includes(name));
      modules.push({
        name: moduleName,
        path: modulePath,
        exports: finalExports,
        dependencies: Array.from(requiredImports.keys()),
        originalNodes: [],
      });
    }

    // ШАГ 6: Обработка необработанных экспортов
    const unprocessedExports = this.originalExports.filter(exp => !processedExports.has(exp));
    if (unprocessedExports.length > 0) {
      await this.createRemainingExportsModule(
        sourcePath,
        modulesDir,
        unprocessedExports,
        nodesToRemoveMap,
        isDryRun
      );
    }

    // ШАГ 7: Удаление узлов из исходного файла (только если не DRY-RUN)
    if (nodesToRemoveMap.size > 0) {
      if (!isDryRun) {
        this.removeNodesWithTsMorph(nodesToRemoveMap);
      } else {
        this.logger.info(
          `🔍 DRY RUN: would remove ${nodesToRemoveMap.size} nodes from source file`
        );
      }
    }

    // Сохраняем исходный файл только если не DRY-RUN
    if (!isDryRun) {
      await sourceFile.save();
    } else {
      this.logger.info('🔍 DRY RUN: skipping source file save');
    }

    // ШАГ 8: Финальная проверка
    const allModuleExports = new Set<string>();
    for (const module of modules) {
      for (const exp of module.exports) {
        allModuleExports.add(exp);
      }
    }

    this.logger.info('✅ Module extraction complete', {
      modulesCount: modules.length,
      totalExports: allModuleExports.size,
      constantsModule: this.constantsModulePath ? 'created' : 'none',
      dryRun: isDryRun,
    });

    return modules;
  }

  private async validateModule(modulePath: string, content: string): Promise<boolean> {
    try {
      // Для TypeScript файлов проверяем через ts-morph
      if (modulePath.endsWith('.ts')) {
        try {
          const sourceFile = this.project.addSourceFileAtPath(modulePath);
          const diagnostics = sourceFile.getPreEmitDiagnostics();
          const errors = diagnostics.filter(d => d.getCategory() === 1);
          if (errors.length > 0) {
            this.logger.warn(`TypeScript errors in ${path.basename(modulePath)}: ${errors.length}`);
            // Не считаем ошибки критичными для продолжения
          }
          return true;
        } catch (error) {
          this.logger.debug(`Failed to validate as TypeScript: ${path.basename(modulePath)}`);
          return true;
        }
      }

      // Для JavaScript проверяем синтаксис
      if (modulePath.endsWith('.js') || modulePath.endsWith('.mjs')) {
        try {
          new Function(content);
          return true;
        } catch (error) {
          // Игнорируем ошибки, связанные с import.meta
          if ((error as any).message?.includes('import.meta')) {
            this.logger.debug(`import.meta in ${path.basename(modulePath)} is expected for ESM`);
            return true;
          }
          // Игнорируем ошибки, связанные с top-level await
          if ((error as any).message?.includes('await')) {
            this.logger.debug(
              `top-level await in ${path.basename(modulePath)} is expected for ESM`
            );
            return true;
          }
          throw error;
        }
      }

      return true;
    } catch (error) {
      // Если ошибка синтаксиса, пробуем переименовать модуль
      if ((error as any).message?.includes('syntax') || error instanceof SyntaxError) {
        this.logger.warn(
          `Syntax error in ${path.basename(modulePath)}, trying alternative extension`
        );

        const currentExt = path.extname(modulePath);
        const alternatives = ['.js', '.mjs', '.ts'];

        for (const newExt of alternatives) {
          if (newExt === currentExt) continue;
          const newPath = modulePath.replace(currentExt, newExt);
          try {
            if (fs.existsSync(modulePath)) {
              await fs.promises.rename(modulePath, newPath);
              this.logger.info(`Renamed ${path.basename(modulePath)} to ${path.basename(newPath)}`);
              return true;
            }
          } catch (renameError) {
            // Игнорируем ошибки переименования
          }
        }
      }
      return false;
    }
  }

  private generateClusterCode(sourceFile: SourceFile, cluster: Cluster): string {
    let code = '';
    const clusterNodes: Node[] = [];

    for (const funcName of cluster.functions) {
      const node = this.findNode(sourceFile, funcName);
      if (node) {
        clusterNodes.push(node);
      }
    }

    for (const node of clusterNodes) {
      let text = node.getText();
      if (text.trim().startsWith('export ')) {
        text = text.replace(/^export\s+/, '');
      }
      code += text + '\n\n';
    }

    return code;
  }

  private async analyzeGlobalConstants(sourceFile: SourceFile): Promise<void> {
    this.globalConstants.clear();
    const statements = sourceFile.getStatements();

    for (const stmt of statements) {
      if (TsNode.isVariableStatement(stmt)) {
        // Пропускаем экспорты
        if (stmt.isExported()) continue;

        const declarations = stmt.getDeclarations();
        const isConst = stmt.getDeclarationKind() === 'const';

        for (const decl of declarations) {
          const name = decl.getName();
          const initializer = decl.getInitializer();

          if (
            initializer &&
            !TsNode.isFunctionExpression(initializer) &&
            !TsNode.isArrowFunction(initializer)
          ) {
            // Проверяем, что это не функция
            const text = initializer.getText();
            if (!text.includes('function') && !text.includes('=>')) {
              this.globalConstants.set(name, {
                name,
                isConst,
                initializer: text,
                type: this.inferValueType(initializer),
                node: decl,
                statement: stmt,
              });
              this.logger.debug(`  ✅ Found global constant: ${name}`);
            }
          }
        }
      }
    }
  }

  private async collectAllDependencies(sourceFile: SourceFile): Promise<void> {
    this.allDependencies.clear();

    // Собираем все функции
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const name = func.getName();
      if (name) {
        this.allDependencies.set(name, {
          name,
          type: 'function',
          isExported: func.isExported(),
          sourceFile: sourceFile.getFilePath(),
          node: func,
        });
      }
    }

    // Собираем все переменные
    const statements = sourceFile.getStatements();
    for (const stmt of statements) {
      if (TsNode.isVariableStatement(stmt)) {
        const declarations = stmt.getDeclarations();
        for (const decl of declarations) {
          const name = decl.getName();
          const initializer = decl.getInitializer();
          if (
            initializer &&
            !TsNode.isFunctionExpression(initializer) &&
            !TsNode.isArrowFunction(initializer)
          ) {
            this.allDependencies.set(name, {
              name,
              type: 'variable',
              isExported: stmt.isExported(),
              sourceFile: sourceFile.getFilePath(),
              node: decl,
            });
          }
        }
      }
    }
  }

  private async createConstantsModule(sourcePath: string): Promise<void> {
    if (this.globalConstants.size === 0) {
      this.logger.debug('No global constants found');
      return;
    }

    const isDryRun = this.options.dryRun || false;
    const modulesDir = path.join(path.dirname(sourcePath), this.options.modulesDir || 'modules');

    // Используем расширение исходного файла
    const sourceExt = path.extname(sourcePath);
    const isTS = sourceExt === '.ts' || sourceExt === '.tsx';
    const extension = isTS ? '.ts' : this.moduleType === 'esm' ? '.mjs' : '.js';
    const modulePath = path.join(modulesDir, `constants${extension}`);

    this.logger.info(`📦 Creating constants module with ${this.globalConstants.size} constants`);

    const moduleFile = this.project.createSourceFile(modulePath, '', { overwrite: true });

    // Используем массив строк для сборки содержимого
    const lines: string[] = [];
    lines.push('// ============================================');
    lines.push('// ОБЩИЕ КОНСТАНТЫ И ПЕРЕМЕННЫЕ');
    lines.push('// ============================================');

    const constNames: string[] = [];

    for (const [name, info] of this.globalConstants) {
      const keyword = info.isConst ? 'const' : 'let';
      let code = '';

      if (info.statement) {
        let stmtText = info.statement.getText();
        if (stmtText.trim().startsWith('export ')) {
          stmtText = stmtText.replace(/^export\s+/, '');
        }
        code = stmtText;
      } else {
        code = `${keyword} ${name} = ${info.initializer};`;
      }

      lines.push(code);
      constNames.push(name);
      this.logger.debug(`  📝 Added constant: ${name}`);
    }

    if (constNames.length > 0) {
      lines.push('');
      lines.push('// Экспорты');
      lines.push(`export { ${constNames.join(', ')} };`);
      lines.push('');
    }

    // Добавляем содержимое с правильными переносами строк
    moduleFile.addStatements(lines.join('\n'));

    // Сохраняем только если не DRY-RUN
    if (!isDryRun) {
      await moduleFile.save();
      this.project.addSourceFileAtPath(modulePath);
      this.logger.info(
        `✅ Constants module created: constants${extension} (${constNames.length} exports)`
      );
    } else {
      this.logger.info(
        `🔍 DRY RUN: would create constants${extension} (${constNames.length} exports)`
      );
    }

    this.constantsModulePath = modulePath;
  }

  private async createRemainingExportsModule(
    sourcePath: string,
    modulesDir: string,
    unprocessedExports: string[],
    nodesToRemoveMap: Map<Node, string>,
    isDryRun: boolean
  ): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    // Используем расширение исходного файла
    const sourceExt = path.extname(sourcePath);
    const isTS = sourceExt === '.ts' || sourceExt === '.tsx';
    const extension = isTS ? '.ts' : this.moduleType === 'esm' ? '.mjs' : '.js';
    const modulePath = path.join(modulesDir, `remaining-exports${extension}`);

    this.logger.info(`📦 Creating module for remaining exports (${unprocessedExports.length})`);

    const moduleFile = this.project.createSourceFile(modulePath, '', { overwrite: true });

    // Добавляем импорт констант
    if (this.constantsModulePath) {
      const relativePath = this.getRelativePath(modulePath, this.constantsModulePath);
      const constNames = Array.from(this.globalConstants.keys());
      if (constNames.length > 0) {
        moduleFile.addImportDeclaration({
          namedImports: constNames,
          moduleSpecifier: relativePath,
        });
      }
    }

    const lines: string[] = [];

    for (const expName of unprocessedExports) {
      const node = this.findNode(sourceFile, expName);
      if (node) {
        let text = node.getText();
        if (text.trim().startsWith('export ')) {
          text = text.replace(/^export\s+/, '');
        }
        lines.push(text);
        nodesToRemoveMap.set(node, expName);
        this.logger.debug(`  ✅ Added remaining export: ${expName}`);
      }
    }

    if (unprocessedExports.length > 0) {
      lines.push('');
      lines.push('// Экспорты');
      lines.push(`export { ${unprocessedExports.join(', ')} };`);
      lines.push('');
    }

    if (lines.length > 0) {
      moduleFile.addStatements(lines.join('\n'));
    }

    // Сохраняем только если не DRY-RUN
    if (!isDryRun) {
      await moduleFile.save();
      this.project.addSourceFileAtPath(modulePath);
      this.logger.info(
        `✅ Created remaining exports module with ${unprocessedExports.length} exports`
      );
    } else {
      this.logger.info(
        `🔍 DRY RUN: would create remaining-exports${extension} with ${unprocessedExports.length} exports`
      );
    }
  }

  private async analyzeClusterDependencies(
    sourceFile: SourceFile,
    cluster: Cluster
  ): Promise<{
    sharedVariables: Map<string, SharedVariableInfo>;
    requiredImports: Map<string, { named: Set<string>; default?: string; namespace?: string }>;
    functionDependencies: Set<string>;
  }> {
    const sharedVariables = new Map<string, SharedVariableInfo>();
    const requiredImports = new Map<
      string,
      { named: Set<string>; default?: string; namespace?: string }
    >();
    const functionDependencies = new Set<string>();

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
      node.forEachDescendant(child => {
        if (TsNode.isIdentifier(child)) {
          usedIdentifiers.add(child.getText());
        }
        if (TsNode.isCallExpression(child)) {
          const expr = child.getExpression();
          if (TsNode.isIdentifier(expr)) {
            usedIdentifiers.add(expr.getText());
          }
        }
      });
    }

    // Анализируем импорты
    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      const moduleSpec = imp.getModuleSpecifierValue();
      const defaultImport = imp.getDefaultImport()?.getText();
      const namespaceImport = imp.getNamespaceImport()?.getText();
      const namedImports = imp.getNamedImports();

      const usedNamed = new Set<string>();

      for (const named of namedImports) {
        const name = named.getName();
        if (usedIdentifiers.has(name)) {
          usedNamed.add(name);
        }
      }

      if (defaultImport && usedIdentifiers.has(defaultImport)) {
        const info = requiredImports.get(moduleSpec) || { named: new Set() };
        info.default = defaultImport;
        requiredImports.set(moduleSpec, info);
      }

      if (namespaceImport) {
        for (const node of clusterNodes) {
          if (node.getText().includes(`${namespaceImport}.`)) {
            const info = requiredImports.get(moduleSpec) || { named: new Set() };
            info.namespace = namespaceImport;
            requiredImports.set(moduleSpec, info);
            break;
          }
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

    // Анализируем общие переменные
    const statements = sourceFile.getStatements();
    for (const stmt of statements) {
      if (TsNode.isVariableStatement(stmt)) {
        if (stmt.isExported()) continue;

        const declarations = stmt.getDeclarations();
        const isConst = stmt.getDeclarationKind() === 'const';

        for (const decl of declarations) {
          const name = decl.getName();
          if (usedIdentifiers.has(name) && !cluster.functions.includes(name)) {
            const initializer = decl.getInitializer();
            // Проверяем, что это не функция
            if (
              initializer &&
              !TsNode.isFunctionExpression(initializer) &&
              !TsNode.isArrowFunction(initializer)
            ) {
              sharedVariables.set(name, {
                name,
                type: this.inferVariableType(decl),
                value: initializer ? this.extractValue(initializer) : undefined,
                isConst,
                node: decl,
              });
              this.logger.debug(`  📦 Found shared variable: ${name}`);
            }
          }
        }
      }
    }

    // Анализируем зависимости функций
    for (const node of clusterNodes) {
      node.forEachDescendant(child => {
        if (TsNode.isCallExpression(child)) {
          const expr = child.getExpression();
          if (TsNode.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (!cluster.functions.includes(calledName) && !calledName.startsWith('_')) {
              // Проверяем, что это не импорт
              let isImport = false;
              for (const info of requiredImports.values()) {
                if (info.named.has(calledName) || info.default === calledName) {
                  isImport = true;
                  break;
                }
              }
              if (!isImport) {
                functionDependencies.add(calledName);
              }
            }
          }
        }
      });
    }

    return { sharedVariables, requiredImports, functionDependencies };
  }

  private generateSharedVariablesCode(sharedVariables: Map<string, SharedVariableInfo>): string {
    if (sharedVariables.size === 0) return '';

    const lines: string[] = [];
    lines.push('');
    lines.push('// ============================================');
    lines.push('// ОБЩИЕ ПЕРЕМЕННЫЕ');
    lines.push('// ============================================');

    for (const [name, info] of sharedVariables) {
      const keyword = info.isConst ? 'const' : 'let';
      if (info.value !== undefined) {
        const valueStr = typeof info.value === 'string' ? `'${info.value}'` : String(info.value);
        lines.push(`${keyword} ${name} = ${valueStr};`);
      } else {
        lines.push(`${keyword} ${name};`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  private async generateDependenciesCode(
    sourceFile: SourceFile,
    dependencies: Set<string>
  ): Promise<string> {
    if (dependencies.size === 0) return '';

    const lines: string[] = [];
    lines.push('');
    lines.push('// ============================================');
    lines.push('// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ');
    lines.push('// ============================================');

    for (const depName of dependencies) {
      const node = this.findNode(sourceFile, depName);
      if (node) {
        let text = node.getText();
        if (text.trim().startsWith('export ')) {
          text = text.replace(/^export\s+/, '');
        }
        lines.push(text);
        lines.push('');
        this.logger.debug(`  📦 Added dependency: ${depName}`);
      }
    }

    return lines.join('\n');
  }

  private collectOriginalExports(sourceFile: SourceFile): string[] {
    const exports: string[] = [];
    const exportSet = new Set<string>();

    try {
      const exportedDeclarations = sourceFile.getExportedDeclarations();
      for (const [name] of exportedDeclarations) {
        if (!exportSet.has(name)) {
          exportSet.add(name);
          exports.push(name);
        }
      }
    } catch (error) {
      this.logger.warn('  ⚠️ ts-morph API failed, falling back to regex', { error });
    }

    // Дополнительная проверка через regex
    const text = sourceFile.getText();

    // export function name
    const funcMatches = text.match(/export\s+function\s+(\w+)/g);
    if (funcMatches) {
      for (const match of funcMatches) {
        const nameMatch = match.match(/export\s+function\s+(\w+)/);
        if (nameMatch && nameMatch[1] && !exportSet.has(nameMatch[1])) {
          exportSet.add(nameMatch[1]);
          exports.push(nameMatch[1]);
        }
      }
    }

    // export const/let/var name
    const varMatches = text.match(/export\s+(?:const|let|var)\s+(\w+)/g);
    if (varMatches) {
      for (const match of varMatches) {
        const nameMatch = match.match(/export\s+(?:const|let|var)\s+(\w+)/);
        if (nameMatch && nameMatch[1] && !exportSet.has(nameMatch[1])) {
          exportSet.add(nameMatch[1]);
          exports.push(nameMatch[1]);
        }
      }
    }

    // export default
    const defaultMatches = text.match(
      /export\s+default\s+(?:function|class)\s+(\w+)|export\s+default\s+(\w+)/g
    );
    if (defaultMatches) {
      for (const match of defaultMatches) {
        const nameMatch = match.match(
          /export\s+default\s+(?:function|class)\s+(\w+)|export\s+default\s+(\w+)/
        );
        if (nameMatch) {
          const name = nameMatch[1] || nameMatch[2];
          if (name && !exportSet.has(name)) {
            exportSet.add(name);
            exports.push(name);
          }
        }
      }
    }

    return exports;
  }

  private inferVariableType(node: Node): string {
    const text = node.getText();
    if (text.includes('=')) {
      if (text.includes('{')) return 'object';
      if (text.includes('[')) return 'array';
      if (text.includes("'") || text.includes('"')) return 'string';
      if (text.includes('true') || text.includes('false')) return 'boolean';
      if (text.match(/\d+/)) return 'number';
    }
    return 'unknown';
  }

  private inferValueType(node: Node): string {
    const kind = node.getKind();
    if (kind === SyntaxKind.StringLiteral) return 'string';
    if (kind === SyntaxKind.NumericLiteral) return 'number';
    if (kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword) return 'boolean';
    if (kind === SyntaxKind.ArrayLiteralExpression) return 'array';
    if (kind === SyntaxKind.ObjectLiteralExpression) return 'object';
    if (kind === SyntaxKind.RegularExpressionLiteral) return 'regexp';
    return 'unknown';
  }

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
    return undefined;
  }

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

  private removeNodesWithTsMorph(nodesToRemove: Map<Node, string>): void {
    const nodesArray = Array.from(nodesToRemove.keys());
    nodesArray.sort((a, b) => b.getStart() - a.getStart());

    for (const node of nodesArray) {
      try {
        const name = nodesToRemove.get(node) || 'unknown';
        if ('remove' in node && typeof (node as any).remove === 'function') {
          (node as any).remove();
          this.logger.debug(`  🗑️ Removed node: ${name}`);
        }
      } catch (error) {
        this.logger.warn(`  ⚠️ Failed to remove node`, {
          name: nodesToRemove.get(node),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private generateModuleName(cluster: Cluster, index: number): string {
    const firstName = cluster.functions.find(f => !f.startsWith('_') && f.length > 2);
    if (firstName) {
      let name = firstName
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();

      const prefixes = [
        'get',
        'set',
        'is',
        'has',
        'use',
        'fetch',
        'handle',
        'on',
        'save',
        'load',
        'create',
        'process',
      ];
      for (const prefix of prefixes) {
        if (name.startsWith(prefix + '-')) {
          name = name.slice(prefix.length + 1);
          break;
        }
      }

      if (name.length >= 2 && name !== '') {
        return name;
      }
    }

    return `module-${index + 1}`;
  }

  private getRelativePath(from: string, to: string): string {
    let relative = path.relative(path.dirname(from), to);
    if (!relative.startsWith('.') && !relative.startsWith('@')) {
      relative = './' + relative;
    }
    return relative.replace(/\\/g, '/');
  }
}
