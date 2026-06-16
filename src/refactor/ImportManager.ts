// src/refactor/ImportManager.ts
import type { Project, SourceFile } from 'ts-morph';
import path from 'path';
import type { ExtractedModule } from './index.js';

export class ImportManager {
  constructor(private project: Project) {}

  /**
   * Добавляет реэкспорты для модулей, чтобы сохранить публичное API исходного файла
   */
  async addReExports(sourcePath: string, modules: ExtractedModule[]): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    if (modules.length === 0) return;

    console.log(`\n📦 Добавление реэкспортов в ${path.basename(sourcePath)}`);

    // Группируем экспорты по модулям
    const reExportsByModule = new Map<string, string[]>();

    for (const module of modules) {
      if (module.exports.length === 0) continue;

      const relativePath = this.getRelativePath(sourcePath, module.path);
      reExportsByModule.set(relativePath, [...module.exports]);
    }

    // Находим последний импорт, чтобы вставить реэкспорты после него
    const imports = sourceFile.getImportDeclarations();
    let lastImportLine = 0;

    for (const imp of imports) {
      const line = imp.getStartLineNumber();
      if (line > lastImportLine) lastImportLine = line;
    }

    // Формируем блок реэкспортов
    let reExportBlock = '\n// ============================================\n';
    reExportBlock += '// РЕЭКСПОРТЫ - сохраняем публичное API\n';
    reExportBlock += '// ============================================\n';

    let hasReExports = false;

    for (const [modulePath, exports] of reExportsByModule) {
      // Проверяем, нет ли уже реэкспорта
      const existingReExport = sourceFile
        .getText()
        .includes(`export { ${exports.join(', ')} } from '${modulePath}'`);

      if (!existingReExport && exports.length > 0) {
        reExportBlock += `export { ${exports.join(', ')} } from '${modulePath}';\n`;
        console.log(`  🔄 Добавлен реэкспорт: { ${exports.join(', ')} } from '${modulePath}'`);
        hasReExports = true;
      }
    }

    // Вставляем реэкспорты после последнего импорта
    if (hasReExports && lastImportLine > 0) {
      const sourceFileText = sourceFile.getText();
      const lines = sourceFileText.split('\n');

      // Вставляем после последнего импорта
      lines.splice(lastImportLine, 0, reExportBlock);
      sourceFile.replaceWithText(lines.join('\n'));

      await sourceFile.save();
      console.log(`  ✅ Реэкспорты добавлены в ${path.basename(sourcePath)}`);
    } else if (hasReExports) {
      // Если нет импортов, добавляем в начало файла
      const sourceFileText = sourceFile.getText();
      sourceFile.replaceWithText(reExportBlock + '\n' + sourceFileText);
      await sourceFile.save();
      console.log(`  ✅ Реэкспорты добавлены в начало ${path.basename(sourcePath)}`);
    }
  }

  /**
   * Обновляет импорты в исходном файле после извлечения модулей
   */
  async updateImports(sourcePath: string, modules: ExtractedModule[]): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) {
      console.warn(`⚠️ Не удалось загрузить файл: ${sourcePath}`);
      return;
    }

    console.log(`\n📦 Обновление импортов в ${path.basename(sourcePath)}`);

    // Собираем все экспорты, которые были перенесены
    const allExportedNames = new Set<string>();
    const moduleMap = new Map<string, ExtractedModule>();

    for (const module of modules) {
      for (const exp of module.exports) {
        allExportedNames.add(exp);
        moduleMap.set(exp, module);
      }
    }

    // Определяем, какие экспорты реально используются в файле
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

    // Добавляем или обновляем импорты для каждого модуля
    for (const [module, usedExports] of usedExportsByModule) {
      if (usedExports.size === 0) continue;

      const relativePath = this.getRelativePath(sourcePath, module.path);
      const existingImport = sourceFile.getImportDeclaration(relativePath);

      const usedExportsArray = Array.from(usedExports);

      if (!existingImport) {
        sourceFile.addImportDeclaration({
          namedImports: usedExportsArray,
          moduleSpecifier: relativePath,
        });
        console.log(
          `  ➕ Добавлен импорт: { ${usedExportsArray.join(', ')} } from '${relativePath}'`
        );
      } else {
        // Обновляем существующий импорт
        const existingSpecifiers = existingImport.getNamedImports().map(s => s.getName());
        const newSpecifiers = [...new Set([...existingSpecifiers, ...usedExportsArray])];

        if (newSpecifiers.length !== existingSpecifiers.length) {
          existingImport.remove();
          sourceFile.addImportDeclaration({
            namedImports: newSpecifiers,
            moduleSpecifier: relativePath,
          });
          console.log(
            `  🔄 Обновлён импорт: { ${newSpecifiers.join(', ')} } from '${relativePath}'`
          );
        }
      }
    }

    // Удаляем неиспользуемые импорты
    await this.removeUnusedImports(sourceFile);

    // Добавляем реэкспорты
    await this.addReExports(sourcePath, modules);

    await sourceFile.save();
  }

  /**
   * Оптимизирует порядок импортов: внешние → алиасы → внутренние
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

    // Проверяем, нужна ли перестановка
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

      await sourceFile.save();
      console.log(`  📋 Оптимизирован порядок импортов в ${path.basename(sourcePath)}`);
    }
  }

  /**
   * Добавляет недостающие импорты
   */
  async addMissingImports(sourcePath: string, modules: ExtractedModule[]): Promise<void> {
    const sourceFile = this.project.addSourceFileAtPath(sourcePath);
    if (!sourceFile) return;

    const moduleExports = new Map<string, string[]>();
    for (const module of modules) {
      const relativePath = this.getRelativePath(sourcePath, module.path);
      moduleExports.set(relativePath, module.exports);
    }

    const text = sourceFile.getText();
    const usedExports = new Map<string, string[]>();

    for (const [modulePath, exports] of moduleExports) {
      const used: string[] = [];
      for (const exp of exports) {
        const regex = new RegExp(`\\b${this.escapeRegex(exp)}\\b`, 'g');
        if (regex.test(text)) {
          used.push(exp);
        }
      }
      if (used.length > 0) {
        usedExports.set(modulePath, used);
      }
    }

    for (const [modulePath, exports] of usedExports) {
      const existingImport = sourceFile.getImportDeclaration(modulePath);
      if (!existingImport) {
        sourceFile.addImportDeclaration({
          namedImports: exports,
          moduleSpecifier: modulePath,
        });
        console.log(`  ➕ Добавлен импорт: { ${exports.join(', ')} } from '${modulePath}'`);
      }
    }

    await sourceFile.save();
  }

  /**
   * Удаляет неиспользуемые импорты
   */
  private async removeUnusedImports(sourceFile: SourceFile): Promise<void> {
    const imports = sourceFile.getImportDeclarations();
    const usedIdentifiers = this.collectUsedIdentifiers(sourceFile);
    let removedCount = 0;

    for (const imp of imports) {
      const specifiers = imp.getNamedImports();
      const moduleSpec = imp.getModuleSpecifierValue();

      // Пропускаем импорты из modules директории (они нужны)
      if (moduleSpec.includes('/modules/') || moduleSpec.startsWith('./modules/')) {
        continue;
      }

      const unused = specifiers.filter(s => !usedIdentifiers.has(s.getName()));

      if (unused.length === specifiers.length && specifiers.length > 0) {
        console.log(`  🗑️ Удалён неиспользуемый импорт: ${moduleSpec}`);
        imp.remove();
        removedCount++;
      } else if (unused.length > 0 && unused.length < specifiers.length) {
        const keep = specifiers.filter(s => usedIdentifiers.has(s.getName()));
        imp.remove();
        sourceFile.addImportDeclaration({
          namedImports: keep.map(s => s.getName()),
          moduleSpecifier: moduleSpec,
        });
        console.log(
          `  🧹 Удалены неиспользуемые импорты: ${unused.map(s => s.getName()).join(', ')} из ${moduleSpec}`
        );
      }
    }

    if (removedCount > 0) {
      console.log(`  📊 Удалено неиспользуемых импортов: ${removedCount}`);
    }
  }

  /**
   * Проверяет, используется ли экспорт в файле
   */
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

  /**
   * Собирает все используемые идентификаторы в файле
   */
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

  /**
   * Вычисляет относительный путь между файлами
   * 🔧 ИСПРАВЛЕНО: сохраняем расширение .js для ES модулей
   */
  private getRelativePath(from: string, to: string): string {
    let relative = path.relative(path.dirname(from), to);

    // ✅ НЕ удаляем расширение .js - оно нужно для ES модулей
    // relative = relative.replace(/\.(ts|js|tsx|jsx|vue)$/, '');

    if (!relative.startsWith('.') && !relative.startsWith('@')) {
      relative = './' + relative;
    }
    return relative.replace(/\\/g, '/');
  }

  /**
   * Экранирует regex специальные символы
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Получает статистику по импортам
   */
  getImportStats(sourceFile: SourceFile): {
    total: number;
    external: number;
    internal: number;
    unused: number;
  } {
    const imports = sourceFile.getImportDeclarations();
    const usedIdentifiers = this.collectUsedIdentifiers(sourceFile);

    let external = 0;
    let internal = 0;
    let unused = 0;

    for (const imp of imports) {
      const specifiers = imp.getNamedImports();
      const moduleSpec = imp.getModuleSpecifierValue();
      const isExternal = !moduleSpec.startsWith('.') && !moduleSpec.startsWith('@/');

      if (isExternal) {
        external++;
      } else {
        internal++;
      }

      for (const spec of specifiers) {
        if (!usedIdentifiers.has(spec.getName())) {
          unused++;
        }
      }
    }

    return { total: imports.length, external, internal, unused };
  }

  /**
   * Проверяет, есть ли несохранённые изменения
   */
  hasUnsavedChanges(sourceFile: SourceFile): boolean {
    return sourceFile.isSaved() === false;
  }
}
