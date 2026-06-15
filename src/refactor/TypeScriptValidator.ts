// src/refactor/TypeScriptValidator.ts
import type { SourceFile, Diagnostic } from 'ts-morph';
import { Project, Node, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';

export interface TSDiagnostic {
  code: number;
  message: string;
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  category: string;
}

export interface TSValidationResult {
  success: boolean;
  diagnostics: TSDiagnostic[];
  fixedCount: number;
  remainingErrors: number;
}

export class TypeScriptValidator {
  private project: Project;
  private sourceFiles: Map<string, SourceFile> = new Map();
  private fixHistory: Map<string, string[]> = new Map();

  constructor(tsConfigPath?: string) {
    // Настраиваем Project с правильными типами для Node.js
    this.project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        moduleResolution: 99, // NodeNext
        allowJs: true,
        checkJs: true, // Включаем проверку JS файлов
        jsx: 2, // JSX support
        strict: false,
        noImplicitAny: false,
        strictNullChecks: false,
        strictFunctionTypes: false,
        strictBindCallApply: false,
        strictPropertyInitialization: false,
        noImplicitThis: false,
        alwaysStrict: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: false,
        noEmit: true,
        // Добавляем типы Node.js
        types: ['node'],
        typeRoots: [
          path.resolve(process.cwd(), 'node_modules/@types'),
          path.resolve(process.cwd(), 'node_modules/@types/node'),
        ],
      },
      useInMemoryFileSystem: false,
    });

    // Добавляем глобальные декларации для Node.js модулей
    this.addGlobalDeclarations();

    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      this.project.addSourceFileAtPath(tsConfigPath);
    }
  }

  /**
   * Добавляет глобальные декларации для Node.js модулей
   */
  private addGlobalDeclarations(): void {
    const declarationFile = this.project.createSourceFile(
      '__node_globals.d.ts',
      `
// Node.js global declarations
declare module 'fs' {
  export * from 'fs';
  export default fs;
}

declare module 'fs/promises' {
  export * from 'fs/promises';
  export default fsPromises;
}

declare module 'path' {
  export * from 'path';
  export default path;
}

declare module 'url' {
  export * from 'url';
  export default url;
}

declare module 'process' {
  export * from 'process';
  export default process;
}

declare module 'util' {
  export * from 'util';
  export default util;
}

declare module 'crypto' {
  export * from 'crypto';
  export default crypto;
}

declare module 'stream' {
  export * from 'stream';
  export default stream;
}

declare module 'events' {
  export * from 'events';
  export default events;
}

declare module 'child_process' {
  export * from 'child_process';
  export default child_process;
}

declare module 'os' {
  export * from 'os';
  export default os;
}

declare module 'http' {
  export * from 'http';
  export default http;
}

declare module 'https' {
  export * from 'https';
  export default https;
}

declare module 'zlib' {
  export * from 'zlib';
  export default zlib;
}

declare module 'assert' {
  export * from 'assert';
  export default assert;
}

declare module 'buffer' {
  export * from 'buffer';
  export default buffer;
}

declare module 'tty' {
  export * from 'tty';
  export default tty;
}

declare module 'readline' {
  export * from 'readline';
  export default readline;
}

declare module 'string_decoder' {
  export * from 'string_decoder';
  export default string_decoder;
}

// Global variables
declare const process: NodeJS.Process;
declare const __dirname: string;
declare const __filename: string;
declare const require: NodeJS.Require;
declare const module: NodeJS.Module;
declare const exports: any;
`,
      { overwrite: true }
    );

    declarationFile.saveSync();
  }

  private loadFile(filePath: string): SourceFile | undefined {
    if (this.sourceFiles.has(filePath)) {
      return this.sourceFiles.get(filePath);
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Файл не существует: ${filePath}`);
      return undefined;
    }

    try {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      this.sourceFiles.set(filePath, sourceFile);
      return sourceFile;
    } catch (error) {
      console.error(`❌ Ошибка загрузки ${filePath}:`, error);
      return undefined;
    }
  }

  private getDiagnostics(sourceFile: SourceFile): Diagnostic[] {
    const syntaxDiagnostics = sourceFile.getPreEmitDiagnostics();
    return syntaxDiagnostics;
  }

  private getDiagnosticMessage(diagnostic: Diagnostic): string {
    const messageText = diagnostic.getMessageText();
    return typeof messageText === 'string' ? messageText : messageText.getMessageText();
  }

  private formatDiagnostic(diagnostic: Diagnostic, filePath: string): TSDiagnostic | null {
    const message = this.getDiagnosticMessage(diagnostic);
    if (!message) return null;

    const code = diagnostic.getCode();
    const line = diagnostic.getLineNumber() || 1;
    const category = diagnostic.getCategory();

    return {
      code,
      message,
      file: filePath,
      line,
      column: 1,
      severity: category === 1 ? 'error' : 'warning',
      category: category === 1 ? 'error' : 'warning',
    };
  }

  async validateFiles(
    filePaths: string[]
  ): Promise<{ success: boolean; issues: any[]; summary: any; fixes: any[] }> {
    const issues: any[] = [];
    const fixes: any[] = [];

    for (const filePath of filePaths) {
      const sourceFile = this.loadFile(filePath);
      if (!sourceFile) continue;

      const diagnostics = this.getDiagnostics(sourceFile);

      for (const diag of diagnostics) {
        const message = this.getDiagnosticMessage(diag);
        const code = diag.getCode();

        // Игнорируем deprecated опции (они не влияют на код)
        if (code === 5107 || code === 5110) continue;

        issues.push({
          type: 'error',
          severity: 7,
          file: filePath,
          line: diag.getLineNumber() || 1,
          column: 1,
          message: message,
          autoFixable: this.isFixable(code),
          code: code,
          suggestion: this.getFixSuggestion(code),
        });

        if (this.isFixable(code)) {
          fixes.push({
            file: filePath,
            line: diag.getLineNumber() || 1,
            message: message,
            code: code,
          });
        }
      }
    }

    const errors = issues.filter(i => i.type === 'error').length;
    const warnings = issues.filter(i => i.type === 'warning').length;
    const autoFixable = issues.filter(i => i.autoFixable).length;

    return {
      success: errors === 0,
      issues,
      summary: { totalErrors: errors, totalWarnings: warnings, totalFixes: autoFixable },
      fixes,
    };
  }

  private isFixable(code: number): boolean {
    const fixableCodes = [
      2304, 2307, 2339, 7006, 7031, 7034, 7053, 6133, 2322, 2552, 18046, 2835, 2591,
    ];
    return fixableCodes.includes(code);
  }

  private getFixSuggestion(code: number): string | undefined {
    const suggestions: Record<number, string> = {
      2304: 'Add declaration for the missing identifier',
      2307: 'Fix module path or add module declaration',
      2339: 'Add property to type definition',
      7006: 'Add type annotation to parameter',
      7031: 'Add type annotation to binding element',
      7034: 'Add type annotation to binding element',
      7053: 'Use type assertion "as any"',
      6133: 'Remove or prefix with underscore',
      2322: 'Use type assertion or fix type',
      2552: 'Fix typo in identifier name',
      18046: 'Add type annotation to catch variable',
      2835: 'Add file extension to import',
      2591: 'Add @ts-ignore comment',
    };
    return suggestions[code];
  }

  /**
   * TS2304: Cannot find name - добавляет декларацию через AST
   */
  private fixCannotFindName(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Cannot find name ['\"](\\w+)['\"]/);
    if (!match) return false;

    const name = match[1];
    if (!name) return false;

    const existingDecl =
      sourceFile.getVariableDeclaration(name) ||
      sourceFile.getFunction(name) ||
      sourceFile.getClass(name);
    if (existingDecl) return false;

    const text = sourceFile.getText();
    let declarationText: string;

    if (text.includes(`${name}(`)) {
      declarationText = `declare function ${name}(...args: unknown[]): unknown;\n`;
    } else if (text.includes(`new ${name}(`)) {
      declarationText = `declare class ${name} {\n  constructor(...args: unknown[]);\n}\n`;
    } else if (text.includes(`: ${name}`) || text.includes(`as ${name}`)) {
      declarationText = `type ${name} = unknown;\n`;
    } else {
      declarationText = `declare const ${name}: unknown;\n`;
    }

    sourceFile.insertText(0, declarationText);
    this.addToHistory(sourceFile.getFilePath(), `TS2304: Добавлена декларация для '${name}'`);
    return true;
  }

  /**
   * TS2307: Cannot find module - исправляет путь через AST
   */
  private fixCannotFindModule(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Cannot find module ['\"]([^'\"]+)['\"]/);
    if (!match) return false;

    const modulePath = match[1];
    if (!modulePath) return false;

    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      const specifier = imp.getModuleSpecifierValue();
      if (specifier === modulePath) {
        const currentDir = path.dirname(sourceFile.getFilePath());
        const possiblePaths = [
          `${modulePath}.js`,
          `${modulePath}.ts`,
          `${modulePath}/index.js`,
          `${modulePath}/index.ts`,
          `${modulePath}.mjs`,
          `${modulePath}.cjs`,
        ];

        for (const candidate of possiblePaths) {
          const fullPath = path.join(currentDir, candidate);
          if (fs.existsSync(fullPath)) {
            const newPath = candidate.replace(/\.(js|ts|mjs|cjs)$/, '');
            imp.setModuleSpecifier(newPath);
            this.addToHistory(
              sourceFile.getFilePath(),
              `TS2307: Путь модуля исправлен: '${modulePath}' → '${newPath}'`
            );
            return true;
          }
        }

        if (!modulePath.startsWith('.')) {
          const ambientDecl = `declare module '${modulePath}' {\n  export = any;\n}\n`;
          sourceFile.insertText(0, ambientDecl);
          this.addToHistory(
            sourceFile.getFilePath(),
            `TS2307: Добавлена декларация модуля '${modulePath}'`
          );
          return true;
        }
      }
    }

    return false;
  }

  /**
   * TS2339: Property does not exist on type - добавляет свойство через AST
   */
  private fixMissingProperty(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(
      /Property ['\"](\\w+)['\"] does not exist on type ['\"]([^'\"]+)['\"]/
    );
    if (!match) return false;

    const property = match[1];
    const typeName = match[2];
    if (!property || !typeName) return false;

    const interfaceDecl = sourceFile.getInterface(typeName);
    if (interfaceDecl) {
      interfaceDecl.addProperty({
        name: property,
        type: 'any',
      });
      this.addToHistory(
        sourceFile.getFilePath(),
        `TS2339: Добавлено свойство '${property}' в интерфейс '${typeName}'`
      );
      return true;
    }

    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      const typeText = typeAlias.getText();
      if (typeText.includes('{')) {
        const newType = typeText.replace(/{/, `{ ${property}: any; `);
        typeAlias.replaceWithText(newType);
        this.addToHistory(
          sourceFile.getFilePath(),
          `TS2339: Добавлено свойство '${property}' в тип '${typeName}'`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * TS7006: Parameter implicitly has any type - добавляет тип через AST
   */
  private fixImplicitAny(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Parameter ['\"](\\w+)['\"] implicitly has an 'any' type/);
    if (!match) return false;

    const paramName = match[1];
    if (!paramName) return false;

    let fixed = false;

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const params = func.getParameters();
      for (const param of params) {
        if (param.getName() === paramName && !param.getTypeNode()) {
          param.setType('any');
          fixed = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            `TS7006: Добавлен тип 'any' для параметра '${paramName}'`
          );
          break;
        }
      }
    }

    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const initializer = decl.getInitializer();
      if (initializer && initializer.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = initializer.asKind(SyntaxKind.ArrowFunction);
        if (arrowFunc) {
          const params = arrowFunc.getParameters();
          for (const param of params) {
            if (param.getName() === paramName && !param.getTypeNode()) {
              param.setType('any');
              fixed = true;
              this.addToHistory(
                sourceFile.getFilePath(),
                `TS7006: Добавлен тип 'any' для параметра '${paramName}' в стрелочной функции`
              );
              break;
            }
          }
        }
      }
    }

    return fixed;
  }

  /**
   * TS7031: Binding element implicitly has any type
   */
  private fixBindingImplicitAny(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Binding element ['\"](\\w+)['\"] implicitly has an 'any' type/);
    if (!match) return false;

    const bindingName = match[1];
    if (!bindingName) return false;

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const params = func.getParameters();
      for (const param of params) {
        const paramText = param.getText();
        if (paramText.includes('{') && paramText.includes(bindingName)) {
          const typeNode = param.getTypeNode();
          if (!typeNode) {
            param.setType('any');
            this.addToHistory(
              sourceFile.getFilePath(),
              `TS7031: Добавлен тип 'any' для binding элемента '${bindingName}'`
            );
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * TS7053: Element implicitly has any type - добавляет as any через AST
   */
  private fixImplicitAnyIndex(sourceFile: SourceFile, _diagnostic: Diagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isElementAccessExpression(node) && !node.getText().includes('as any')) {
        const expression = node.getExpression();
        const argument = node.getArgumentExpression();

        if (expression && argument) {
          const newText = `(${expression.getText()} as any)[${argument.getText()}]`;
          node.replaceWithText(newText);
          fixed = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            "TS7053: Добавлено 'as any' для индексного доступа"
          );
        }
      }
    });

    return fixed;
  }

  /**
   * TS6133: Variable is declared but never used - добавляет префикс _
   */
  private fixUnusedVariable(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/['\"](\\w+)['\"] is declared but never used/);
    if (!match) return false;

    const varName = match[1];
    if (!varName) return false;

    const variableDecl = sourceFile.getVariableDeclaration(varName);
    if (variableDecl) {
      const newName = `_${varName}`;
      variableDecl.rename(newName);
      this.addToHistory(
        sourceFile.getFilePath(),
        `TS6133: Переименована неиспользуемая переменная '${varName}' → '${newName}'`
      );
      return true;
    }

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const param = func.getParameter(varName);
      if (param) {
        param.rename(`_${varName}`);
        this.addToHistory(
          sourceFile.getFilePath(),
          `TS6133: Переименован неиспользуемый параметр '${varName}'`
        );
        return true;
      }
    }

    const bindings = sourceFile.getVariableDeclarations();
    for (const binding of bindings) {
      const name = binding.getName();
      if (name === varName) {
        const newName = `_${varName}`;
        binding.rename(newName);
        this.addToHistory(
          sourceFile.getFilePath(),
          `TS6133: Переименована неиспользуемая переменная из деструктуризации '${varName}' → '${newName}'`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * TS2322: Type mismatch - добавляет as any
   */
  private fixTypeMismatch(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const lines = sourceFile.getText().split('\n');
    const lineNumber = diagnostic.getLineNumber() || 1;
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const oldLine = lines[lineIndex];
      const newLine = oldLine.replace(/(=\\s*)([^;]+)/, '$1($2 as any)');

      if (newLine !== oldLine) {
        lines[lineIndex] = newLine;
        sourceFile.replaceWithText(lines.join('\n'));
        this.addToHistory(
          sourceFile.getFilePath(),
          "TS2322: Добавлено 'as any' для приведения типа"
        );
        return true;
      }
    }

    return false;
  }

  /**
   * TS2552: Typo - исправляет опечатку через AST
   */
  private fixTypo(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Cannot find name ['\"](\\w+)['\"].*Did you mean ['\"](\\w+)['\"]/);
    if (!match) return false;

    const wrongName = match[1];
    const suggestedName = match[2];
    if (!wrongName || !suggestedName) return false;

    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isIdentifier(node) && node.getText() === wrongName) {
        node.rename(suggestedName);
        fixed = true;
      }
    });

    if (fixed) {
      this.addToHistory(
        sourceFile.getFilePath(),
        `TS2552: Исправлена опечатка '${wrongName}' → '${suggestedName}'`
      );
    }

    return fixed;
  }

  /**
   * TS18046: 'error' is of type 'unknown' - добавляет тип any
   */
  private fixUnknownError(sourceFile: SourceFile, _diagnostic: Diagnostic): boolean {
    let fixed = false;

    sourceFile.forEachDescendant(node => {
      if (Node.isCatchClause(node)) {
        const variableDeclaration = node.getVariableDeclaration();
        if (variableDeclaration && !variableDeclaration.getTypeNode()) {
          variableDeclaration.setType('any');
          fixed = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            "TS18046: Добавлен тип 'any' для переменной в catch блоке"
          );
        }
      }
    });

    return fixed;
  }

  /**
   * TS2835: Missing file extensions - добавляет расширения через AST
   */
  private fixImportExtensions(sourceFile: SourceFile): boolean {
    let fixed = false;
    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      const specifier = imp.getModuleSpecifierValue();
      if (
        specifier &&
        specifier.startsWith('.') &&
        !specifier.endsWith('.js') &&
        !specifier.endsWith('.ts')
      ) {
        const currentDir = path.dirname(sourceFile.getFilePath());
        const jsPath = path.join(currentDir, `${specifier}.js`);
        const tsPath = path.join(currentDir, `${specifier}.ts`);

        if (fs.existsSync(jsPath)) {
          imp.setModuleSpecifier(`${specifier}.js`);
          fixed = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            `TS2835: Добавлено расширение .js: '${specifier}' → '${specifier}.js'`
          );
        } else if (fs.existsSync(tsPath)) {
          imp.setModuleSpecifier(`${specifier}.ts`);
          fixed = true;
          this.addToHistory(
            sourceFile.getFilePath(),
            `TS2835: Добавлено расширение .ts: '${specifier}' → '${specifier}.ts'`
          );
        }
      }
    }

    return fixed;
  }

  /**
   * TS2591: Cannot find type definitions
   */
  private fixMissingTypes(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const message = this.getDiagnosticMessage(diagnostic);
    const match = message.match(/Cannot find name ['\"](\\w+)['\"]/);
    if (!match) return false;

    const name = match[1];
    if (!name) return false;

    const declareModule = `// @ts-ignore - Missing types for ${name}\n`;

    if (!sourceFile.getText().includes(declareModule)) {
      sourceFile.insertText(0, declareModule);
      this.addToHistory(sourceFile.getFilePath(), `TS2591: Добавлен @ts-ignore для '${name}'`);
      return true;
    }

    return false;
  }

  /**
   * Добавляет запись в историю исправлений
   */
  private addToHistory(filePath: string, fix: string): void {
    if (!this.fixHistory.has(filePath)) {
      this.fixHistory.set(filePath, []);
    }
    const history = this.fixHistory.get(filePath);
    if (history) {
      history.push(fix);
    }
  }

  /**
   * Основной метод валидации и исправления через AST
   */
  async validateAndFix(filePaths: string[], maxIterations = 5): Promise<TSValidationResult> {
    console.log('\n🔍 TypeScript ВАЛИДАЦИЯ И ИСПРАВЛЕНИЕ (ЧЕРЕЗ AST)');
    console.log('='.repeat(60));

    // Загружаем все файлы
    for (const filePath of filePaths) {
      this.loadFile(filePath);
    }

    let totalFixes = 0;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n🔄 ИТЕРАЦИЯ ${iteration}/${maxIterations}`);
      console.log('-'.repeat(40));

      let iterationFixes = 0;
      const iterationDiagnostics: TSDiagnostic[] = [];

      for (const [filePath, sourceFile] of this.sourceFiles) {
        const diagnostics = this.getDiagnostics(sourceFile);

        for (const diagnostic of diagnostics) {
          const code = diagnostic.getCode();

          // Пропускаем deprecated опции
          if (code === 5107 || code === 5110) continue;

          const formatted = this.formatDiagnostic(diagnostic, filePath);
          if (formatted && formatted.severity === 'error') {
            iterationDiagnostics.push(formatted);

            const fixed = this.fixDiagnostic(sourceFile, diagnostic);
            if (fixed) {
              iterationFixes++;
            }
          }
        }
      }

      totalFixes += iterationFixes;

      console.log(`   📊 Ошибок: ${iterationDiagnostics.length}, Исправлено: ${iterationFixes}`);

      if (iterationDiagnostics.length === 0) {
        console.log(`\n✅ ВСЕ ОШИБКИ ИСПРАВЛЕНЫ на итерации ${iteration}!`);
        break;
      }

      if (iterationFixes === 0) {
        console.log('\n⚠️ Остались ошибки, но они не могут быть исправлены автоматически');
        break;
      }

      await this.project.save();
    }

    const finalDiagnostics: TSDiagnostic[] = [];
    for (const [filePath, sourceFile] of this.sourceFiles) {
      const diagnostics = this.getDiagnostics(sourceFile);
      for (const diagnostic of diagnostics) {
        const code = diagnostic.getCode();
        if (code === 5107 || code === 5110) continue;

        const formatted = this.formatDiagnostic(diagnostic, filePath);
        if (formatted && formatted.severity === 'error') {
          finalDiagnostics.push(formatted);
        }
      }
    }

    await this.project.save();

    console.log('\n📊 ФИНАЛЬНЫЙ ОТЧЁТ');
    console.log('='.repeat(60));
    console.log(`   ✅ Исправлено всего: ${totalFixes}`);
    console.log(`   ❌ Осталось ошибок: ${finalDiagnostics.length}`);

    if (finalDiagnostics.length > 0) {
      console.log('\n   ОСТАВШИЕСЯ ОШИБКИ:');
      for (const diag of finalDiagnostics.slice(0, 10)) {
        console.log(
          `   📄 ${path.basename(diag.file)}:${diag.line} - TS${diag.code}: ${diag.message.substring(0, 80)}`
        );
      }
      if (finalDiagnostics.length > 10) {
        console.log(`   ... и ещё ${finalDiagnostics.length - 10} ошибок`);
      }
    }

    if (this.fixHistory.size > 0) {
      console.log('\n📝 ИСТОРИЯ ИСПРАВЛЕНИЙ (ЧЕРЕЗ AST):');
      for (const [filePath, fixes] of this.fixHistory) {
        console.log(`   📄 ${path.basename(filePath)}:`);
        for (const fix of fixes.slice(0, 5)) {
          console.log(`      ${fix}`);
        }
        if (fixes.length > 5) {
          console.log(`      ... и ещё ${fixes.length - 5} исправлений`);
        }
      }
    }

    return {
      success: finalDiagnostics.length === 0,
      diagnostics: finalDiagnostics,
      fixedCount: totalFixes,
      remainingErrors: finalDiagnostics.length,
    };
  }

  /**
   * Исправляет диагностику через AST
   */
  private fixDiagnostic(sourceFile: SourceFile, diagnostic: Diagnostic): boolean {
    const code = diagnostic.getCode();

    switch (code) {
      case 2304:
        return this.fixCannotFindName(sourceFile, diagnostic);
      case 2307:
        return this.fixCannotFindModule(sourceFile, diagnostic);
      case 2339:
        return this.fixMissingProperty(sourceFile, diagnostic);
      case 7006:
        return this.fixImplicitAny(sourceFile, diagnostic);
      case 7031:
      case 7034:
        return this.fixBindingImplicitAny(sourceFile, diagnostic);
      case 7053:
        return this.fixImplicitAnyIndex(sourceFile, diagnostic);
      case 6133:
        return this.fixUnusedVariable(sourceFile, diagnostic);
      case 2322:
        return this.fixTypeMismatch(sourceFile, diagnostic);
      case 2552:
        return this.fixTypo(sourceFile, diagnostic);
      case 18046:
        return this.fixUnknownError(sourceFile, diagnostic);
      case 2835:
        return this.fixImportExtensions(sourceFile);
      case 2591:
        return this.fixMissingTypes(sourceFile, diagnostic);
      default:
        return false;
    }
  }

  getFixedSourceFile(filePath: string): SourceFile | undefined {
    return this.sourceFiles.get(filePath);
  }

  async saveAll(): Promise<void> {
    await this.project.save();
  }

  getFixHistory(): Map<string, string[]> {
    return this.fixHistory;
  }
}
