// src/refactor/ImportManager.ts
import type { Project, SourceFile } from 'ts-morph';
import path from 'path';
import type { ExtractedModule } from './types.js';
import type { Logger } from '../utils/Logger.js';
import type { ModuleType } from './ModuleTypeDetector.js';
import type { IRefactorContext } from './interfaces/IRefactorContext.js';

export class ImportManager {
  private project: Project;
  private logger: Logger;
  private options: { dryRun?: boolean };

  constructor(context: IRefactorContext) {
    this.project = context.project;
    this.logger = context.logger.child('ImportManager');
    this.options = { dryRun: context.options.dryRun };
  }

  /**
   * Добавляет реэкспорты для всех оригинальных экспортов
   */
  async addAllReExports(sourcePath: string, modules: ExtractedModule[]): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    // Собираем все экспорты из модулей
    const allExports = new Map<string, string>();
    for (const module of modules) {
      for (const exp of module.exports) {
        const relativePath = this.getRelativePath(sourcePath, module.path);
        allExports.set(exp, relativePath);
      }
    }

    if (allExports.size === 0) {
      this.logger.debug('No exports to re-export');
      return;
    }

    // Группируем по модулям
    const byModule = new Map<string, string[]>();
    for (const [exp, modulePath] of allExports) {
      if (!byModule.has(modulePath)) {
        byModule.set(modulePath, []);
      }
      byModule.get(modulePath)!.push(exp);
    }

    // Добавляем реэкспорты
    let reExportBlock = '\n// ============================================\n';
    reExportBlock += '// РЕЭКСПОРТЫ - сохраняем публичное API\n';
    reExportBlock += '// ============================================\n';

    for (const [modulePath, exports] of byModule) {
      const sortedExports = exports.sort();
      reExportBlock += `export { ${sortedExports.join(', ')} } from '${modulePath}';\n`;
    }

    // Вставляем перед последним экспортом или в конец файла
    const text = sourceFile.getText();
    const lastExportIndex = text.lastIndexOf('export');
    if (lastExportIndex !== -1) {
      const insertIndex = text.indexOf('\n', lastExportIndex) + 1;
      if (insertIndex > 0 && insertIndex < text.length) {
        const newText = text.slice(0, insertIndex) + reExportBlock + text.slice(insertIndex);
        sourceFile.replaceWithText(newText);
      } else {
        sourceFile.addStatements(reExportBlock);
      }
    } else {
      sourceFile.addStatements(reExportBlock);
    }

    // ✅ DRY-RUN: сохраняем только если не dry-run
    if (!this.options.dryRun) {
      await sourceFile.save();
      this.logger.info(`Added re-exports for ${allExports.size} exports`);
    } else {
      this.logger.info(`DRY RUN: would add re-exports for ${allExports.size} exports`);
    }
  }

  /**
   * Добавляет реэкспорты для сохранения оригинального API
   */
  async addReExports(
    sourcePath: string,
    modules: ExtractedModule[],
    originalExports: string[]
  ): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    if (modules.length === 0 || originalExports.length === 0) return;

    this.logger.info(`Adding re-exports to ${path.basename(sourcePath)}`);

    // Создаем карту: экспорт -> модуль
    const exportToModule = new Map<string, string>();
    for (const module of modules) {
      for (const exp of module.exports) {
        if (originalExports.includes(exp)) {
          let relativePath = this.getRelativePath(sourcePath, module.path);

          // Определяем расширение по фактическому файлу
          const ext = path.extname(module.path);
          if (ext === '.mjs' && !relativePath.endsWith('.mjs')) {
            relativePath = relativePath.replace(/\.(js|ts)$/, '.mjs');
          } else if (ext === '.js' && !relativePath.endsWith('.js')) {
            relativePath = relativePath.replace(/\.(mjs|ts)$/, '.js');
          } else if (ext === '.ts' && !relativePath.endsWith('.ts')) {
            relativePath = relativePath.replace(/\.(mjs|js)$/, '.ts');
          }

          exportToModule.set(exp, relativePath);
        }
      }
    }

    // Группируем реэкспорты по модулям
    const reExportsByModule = new Map<string, string[]>();
    for (const [exp, modulePath] of exportToModule) {
      if (!reExportsByModule.has(modulePath)) {
        reExportsByModule.set(modulePath, []);
      }
      reExportsByModule.get(modulePath)!.push(exp);
    }

    // Находим позицию для вставки реэкспортов (после последнего импорта)
    const imports = sourceFile.getImportDeclarations();
    let insertIndex = 0;
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      if (lastImport) {
        insertIndex = lastImport.getEnd();
      }
    }

    // Формируем блок реэкспортов
    let reExportBlock = '\n// ============================================\n';
    reExportBlock += '// РЕЭКСПОРТЫ - сохраняем публичное API\n';
    reExportBlock += '// ============================================\n';

    let hasReExports = false;
    for (const [modulePath, exports] of reExportsByModule) {
      const sortedExports = exports.sort();
      const existingReExport = sourceFile
        .getText()
        .includes(`export { ${sortedExports.join(', ')} } from '${modulePath}'`);

      if (!existingReExport && sortedExports.length > 0) {
        reExportBlock += `export { ${sortedExports.join(', ')} } from '${modulePath}';\n`;
        this.logger.debug(`Adding re-export: { ${sortedExports.join(', ')} } from '${modulePath}'`);
        hasReExports = true;
      }
    }

    if (hasReExports) {
      if (insertIndex > 0) {
        const text = sourceFile.getText();
        const newText = text.slice(0, insertIndex) + reExportBlock + text.slice(insertIndex);
        sourceFile.replaceWithText(newText);
      } else {
        sourceFile.insertText(0, reExportBlock);
      }

      // ✅ DRY-RUN: сохраняем только если не dry-run
      if (!this.options.dryRun) {
        await sourceFile.save();
        this.logger.info(`Re-exports added to ${path.basename(sourcePath)}`);
      } else {
        this.logger.info(`DRY RUN: would add re-exports to ${path.basename(sourcePath)}`);
      }
    } else {
      this.logger.debug('No new re-exports needed');
    }
  }

  /**
   * Обновляет импорты в исходном файле
   */
  async updateImports(
    sourcePath: string,
    modules: ExtractedModule[],
    _moduleType: ModuleType
  ): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) {
      this.logger.warn(`Failed to load file: ${sourcePath}`);
      return;
    }

    this.logger.info(`Updating imports in ${path.basename(sourcePath)}`);

    const allExportedNames = new Set<string>();
    const moduleMap = new Map<string, ExtractedModule>();

    for (const module of modules) {
      for (const exp of module.exports) {
        allExportedNames.add(exp);
        moduleMap.set(exp, module);
      }
    }

    const usedExportsByModule = new Map<ExtractedModule, Set<string>>();

    for (const exp of allExportedNames) {
      if (this.isExportUsed(sourceFile, exp)) {
        const module = moduleMap.get(exp);
        if (module) {
          if (!usedExportsByModule.has(module)) {
            usedExportsByModule.set(module, new Set());
          }
          usedExportsByModule.get(module)!.add(exp);
        }
      }
    }

    for (const [module, usedExports] of usedExportsByModule) {
      if (usedExports.size === 0) continue;

      let relativePath = this.getRelativePath(sourcePath, module.path);

      // Определяем расширение по фактическому файлу
      const ext = path.extname(module.path);
      if (ext === '.mjs' && !relativePath.endsWith('.mjs')) {
        relativePath = relativePath.replace(/\.(js|ts)$/, '.mjs');
      } else if (ext === '.js' && !relativePath.endsWith('.js')) {
        relativePath = relativePath.replace(/\.(mjs|ts)$/, '.js');
      } else if (ext === '.ts' && !relativePath.endsWith('.ts')) {
        // Для TypeScript модулей убираем расширение (импорт без расширения)
        relativePath = relativePath.replace(/\.ts$/, '');
      }

      const existingImport = sourceFile.getImportDeclaration(relativePath);

      const usedExportsArray = Array.from(usedExports);

      if (!existingImport) {
        sourceFile.addImportDeclaration({
          namedImports: usedExportsArray,
          moduleSpecifier: relativePath,
        });
        this.logger.debug(
          `Added import: { ${usedExportsArray.join(', ')} } from '${relativePath}'`
        );
      } else {
        const existingSpecifiers = existingImport.getNamedImports().map(s => s.getName());
        const newSpecifiers = [...new Set([...existingSpecifiers, ...usedExportsArray])];

        if (newSpecifiers.length !== existingSpecifiers.length) {
          existingImport.remove();
          sourceFile.addImportDeclaration({
            namedImports: newSpecifiers,
            moduleSpecifier: relativePath,
          });
          this.logger.debug(
            `Updated import: { ${newSpecifiers.join(', ')} } from '${relativePath}'`
          );
        }
      }
    }

    await this.removeUnusedImports(sourceFile);

    // ✅ DRY-RUN: сохраняем только если не dry-run
    if (!this.options.dryRun) {
      await sourceFile.save();
      this.logger.info(`Imports updated in ${path.basename(sourcePath)}`);
    } else {
      this.logger.info(`DRY RUN: would update imports in ${path.basename(sourcePath)}`);
    }
  }

  /**
   * Оптимизирует порядок импортов
   */
  async optimizeImportOrder(sourcePath: string): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    const imports = sourceFile.getImportDeclarations();
    if (imports.length <= 1) return;

    const external: typeof imports = [];
    const aliases: typeof imports = [];
    const internal: typeof imports = [];

    for (const imp of imports) {
      const specifier = imp.getModuleSpecifierValue();
      if (specifier.startsWith('@') || specifier.startsWith('#')) {
        aliases.push(imp);
      } else if (specifier.startsWith('.')) {
        internal.push(imp);
      } else {
        external.push(imp);
      }
    }

    const sortBySpecifier = (a: (typeof imports)[0], b: (typeof imports)[0]) => {
      return a.getModuleSpecifierValue().localeCompare(b.getModuleSpecifierValue());
    };

    external.sort(sortBySpecifier);
    aliases.sort(sortBySpecifier);
    internal.sort(sortBySpecifier);

    const allImports = [...external, ...aliases, ...internal];

    let needsReorder = false;
    for (let i = 0; i < imports.length; i++) {
      if (imports[i] !== allImports[i]) {
        needsReorder = true;
        break;
      }
    }

    if (needsReorder) {
      const importData = allImports.map(imp => ({
        defaultImport: imp.getDefaultImport()?.getText(),
        namespaceImport: imp.getNamespaceImport()?.getText(),
        namedImports: imp.getNamedImports().map(n => n.getName()),
        moduleSpecifier: imp.getModuleSpecifierValue(),
      }));

      for (const imp of imports) {
        imp.remove();
      }

      for (const data of importData) {
        if (data.defaultImport) {
          sourceFile.addImportDeclaration({
            defaultImport: data.defaultImport,
            namedImports: data.namedImports.length > 0 ? data.namedImports : undefined,
            moduleSpecifier: data.moduleSpecifier,
          });
        } else if (data.namespaceImport) {
          sourceFile.addImportDeclaration({
            namespaceImport: data.namespaceImport,
            moduleSpecifier: data.moduleSpecifier,
          });
        } else if (data.namedImports.length > 0) {
          sourceFile.addImportDeclaration({
            namedImports: data.namedImports,
            moduleSpecifier: data.moduleSpecifier,
          });
        }
      }

      // ✅ DRY-RUN: сохраняем только если не dry-run
      if (!this.options.dryRun) {
        await sourceFile.save();
        this.logger.debug(`Import order optimized in ${path.basename(sourcePath)}`);
      } else {
        this.logger.debug(`DRY RUN: would optimize import order in ${path.basename(sourcePath)}`);
      }
    }
  }

  private async removeUnusedImports(sourceFile: SourceFile): Promise<void> {
    const imports = sourceFile.getImportDeclarations();
    const usedIdentifiers = this.collectUsedIdentifiers(sourceFile);
    let removedCount = 0;

    for (const imp of imports) {
      const specifiers = imp.getNamedImports();
      const moduleSpec = imp.getModuleSpecifierValue();

      // Не удаляем импорты из модулей (они нужны для реэкспортов)
      if (moduleSpec.includes('/modules/') || moduleSpec.startsWith('./modules/')) {
        continue;
      }

      const unused = specifiers.filter(s => !usedIdentifiers.has(s.getName()));

      if (unused.length === specifiers.length && specifiers.length > 0) {
        this.logger.debug(`Removing unused import: ${moduleSpec}`);
        imp.remove();
        removedCount++;
      } else if (unused.length > 0 && unused.length < specifiers.length) {
        const keep = specifiers.filter(s => usedIdentifiers.has(s.getName()));
        imp.remove();
        sourceFile.addImportDeclaration({
          namedImports: keep.map(s => s.getName()),
          moduleSpecifier: moduleSpec,
        });
        this.logger.debug(
          `Removed unused imports: ${unused.map(s => s.getName()).join(', ')} from ${moduleSpec}`
        );
      }
    }

    if (removedCount > 0) {
      this.logger.debug(`Removed ${removedCount} unused imports`);
    }
  }

  private isExportUsed(sourceFile: SourceFile, exportName: string): boolean {
    const content = sourceFile.getText();

    const patterns = [
      new RegExp(`\\b${this.escapeRegex(exportName)}\\s*\\(`, 'g'),
      new RegExp(`\\b${this.escapeRegex(exportName)}\\b`, 'g'),
      new RegExp(`['"\`]${this.escapeRegex(exportName)}['"\`]`, 'g'),
      new RegExp(`return\\s+${this.escapeRegex(exportName)}\\b`, 'g'),
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  private collectUsedIdentifiers(sourceFile: SourceFile): Set<string> {
    const used = new Set<string>();
    const content = sourceFile.getText();

    const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let match;

    const reservedWords = new Set([
      'if',
      'else',
      'for',
      'while',
      'do',
      'switch',
      'case',
      'break',
      'continue',
      'return',
      'throw',
      'try',
      'catch',
      'finally',
      'debugger',
      'const',
      'let',
      'var',
      'function',
      'class',
      'extends',
      'implements',
      'interface',
      'type',
      'enum',
      'namespace',
      'module',
      'declare',
      'export',
      'import',
      'default',
      'new',
      'delete',
      'typeof',
      'instanceof',
      'void',
      'this',
      'super',
      'null',
      'undefined',
      'true',
      'false',
      'async',
      'await',
      'yield',
      'static',
      'public',
      'private',
      'protected',
      'readonly',
      'abstract',
      'override',
    ]);

    while ((match = identifierPattern.exec(content)) !== null) {
      const identifier = match[1];
      if (identifier && !reservedWords.has(identifier)) {
        used.add(identifier);
      }
    }

    return used;
  }

  private getRelativePath(from: string, to: string): string {
    let relative = path.relative(path.dirname(from), to);
    if (!relative.startsWith('.') && !relative.startsWith('@')) {
      relative = './' + relative;
    }
    return relative.replace(/\\/g, '/');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
