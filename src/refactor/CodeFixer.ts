// src/refactor/CodeFixer.ts
import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';
import type { ValidationIssue } from './CodeValidator.js';
import { ESLintASTFixer } from './ESLintASTFixer.js';

export interface FixResult {
  success: boolean;
  file: string;
  fixes: number;
  errors: string[];
  backupPath?: string;
}

export class CodeFixer {
  private project: Project;
  private fixesApplied = 0;
  private eslintFixer: ESLintASTFixer;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
      },
      useInMemoryFileSystem: false,
    });
    this.eslintFixer = new ESLintASTFixer();
  }

  /**
   * Получить экземпляр Project для доступа к функциональности ts-morph
   */
  getProject(): Project {
    return this.project;
  }

  /**
   * Проверяет, является ли проблема TypeScript-специфичной
   */
  private isTypeScriptFix(issue: ValidationIssue): boolean {
    const code = issue.code?.toString() || '';
    const tsFixCodes = [
      'TS2304',
      'TS7006',
      'TS7031',
      'TS7034',
      'TS7053',
      'TS18046',
      'TS6133',
      'TS2835',
      'TS2322',
      'TS2307',
      'TS2339',
      '2552',
      '2591',
    ];
    return tsFixCodes.some(c => code === c || code.includes(c));
  }

  /**
   * Проверяет, является ли проблема ESLint-специфичной
   */
  private isESLintFix(issue: ValidationIssue): boolean {
    const eslintRules = [
      'no-unused-vars',
      'no-undef',
      'semi',
      'quotes',
      'no-trailing-spaces',
      'eol-last',
      'no-multiple-empty-lines',
      'comma-dangle',
      'prefer-const',
      'eqeqeq',
      'no-var',
      'object-shorthand',
      'arrow-body-style',
      'no-unused-expressions',
    ];
    const ruleId = (issue as any).ruleId;
    return eslintRules.includes(ruleId);
  }

  /**
   * Проверяет, является ли файл TypeScript файлом
   */
  private isTypeScriptFile(filePath: string): boolean {
    return (
      filePath.endsWith('.ts') ||
      filePath.endsWith('.tsx') ||
      filePath.endsWith('.mts') ||
      filePath.endsWith('.cts')
    );
  }

  /**
   * Автоматическое исправление проблем через AST
   */
  async autoFix(issues: ValidationIssue[], createBackup = true): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const tsFilesToFix = new Map<string, ValidationIssue[]>();
    const eslintFilesToFix = new Set<string>();

    // Разделяем TypeScript и ESLint проблемы
    for (const issue of issues) {
      if (!issue.autoFixable) continue;

      if (this.isTypeScriptFix(issue) && this.isTypeScriptFile(issue.file)) {
        if (!tsFilesToFix.has(issue.file)) {
          tsFilesToFix.set(issue.file, []);
        }
        tsFilesToFix.get(issue.file)!.push(issue);
      } else if (this.isESLintFix(issue)) {
        eslintFilesToFix.add(issue.file);
      }
    }

    console.log('\n🔧 ЗАПУСК АВТОИСПРАВЛЕНИЯ ЧЕРЕЗ AST');
    console.log('='.repeat(60));
    console.log(
      `📊 Найдено TypeScript проблем: ${issues.filter(i => this.isTypeScriptFix(i)).length}`
    );
    console.log(`📊 Найдено ESLint проблем: ${issues.filter(i => this.isESLintFix(i)).length}\n`);

    // Исправляем TypeScript проблемы через ts-morph
    for (const [file, fileIssues] of tsFilesToFix) {
      const result = await this.fixTypeScriptFile(file, fileIssues, createBackup);
      results.push(result);
      if (result.success) {
        console.log(`✅ TS: ${path.basename(file)}: исправлено ${result.fixes} проблем`);
      } else {
        console.log(`❌ TS: ${path.basename(file)}: не удалось исправить`);
        result.errors.forEach(err => console.log(`   ${err}`));
      }
    }

    // Исправляем ESLint проблемы через AST
    if (eslintFilesToFix.size > 0) {
      console.log('\n🔧 Исправление ESLint проблем через AST...');
      const eslintResults = await this.eslintFixer.fixFiles(
        Array.from(eslintFilesToFix),
        createBackup
      );

      for (const result of eslintResults) {
        results.push({
          success: result.success,
          file: result.file,
          fixes: result.fixes,
          errors: result.errors,
          backupPath: undefined,
        });
        this.fixesApplied += result.fixes;

        if (result.success) {
          console.log(
            `✅ ESLint: ${path.basename(result.file)}: исправлено ${result.fixes} проблем`
          );
        } else {
          console.log(`❌ ESLint: ${path.basename(result.file)}: не удалось исправить`);
        }
      }
    }

    console.log(`\n✨ ВСЕГО ИСПРАВЛЕНО: ${this.fixesApplied} проблем\n`);
    return results;
  }

  /**
   * Исправление TypeScript файла через AST
   */
  private async fixTypeScriptFile(
    filePath: string,
    issues: ValidationIssue[],
    createBackup: boolean
  ): Promise<FixResult> {
    let fixes = 0;
    const errors: string[] = [];
    let backupPath: string | undefined;

    try {
      if (createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
      }

      const sourceFile = this.project.addSourceFileAtPath(filePath);
      let hasChanges = false;

      for (const issue of issues) {
        const fixed = await this.applyTsFix(sourceFile, issue);
        if (fixed) {
          fixes++;
          this.fixesApplied++;
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await sourceFile.save();
      }

      return { success: true, file: filePath, fixes, errors, backupPath };
    } catch (error: any) {
      errors.push(error.message);
      if (backupPath && fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
      }
      return { success: false, file: filePath, fixes, errors, backupPath };
    }
  }

  /**
   * Применение TypeScript фикса через AST
   */
  private async applyTsFix(sourceFile: any, issue: ValidationIssue): Promise<boolean> {
    const code = issue.code?.toString() || '';
    const message = issue.message;

    switch (code) {
      case 'TS2304':
        return this.fixCannotFindName(sourceFile, message);
      case 'TS2307':
        return this.fixCannotFindModule(sourceFile, message);
      case 'TS2339':
        return this.fixMissingProperty(sourceFile, message);
      case 'TS7006':
        return this.fixImplicitAny(sourceFile, message);
      case 'TS7031':
      case 'TS7034':
        return this.fixBindingImplicitAny(sourceFile, message);
      case 'TS7053':
        return this.fixImplicitAnyIndex(sourceFile);
      case 'TS6133':
        return this.fixUnusedVariable(sourceFile, message);
      case 'TS2322':
        return this.fixTypeMismatch(sourceFile, issue);
      case 'TS2552':
        return this.fixTypo(sourceFile, message);
      case 'TS18046':
        return this.fixUnknownError(sourceFile);
      case 'TS2835':
        return this.fixImportExtensions(sourceFile);
      case 'TS2591':
        return this.fixMissingTypes(sourceFile, message);
      default:
        return false;
    }
  }

  /**
   * TS2304: Cannot find name - добавляет декларацию через AST
   */
  private fixCannotFindName(sourceFile: any, message: string): boolean {
    const match = message.match(/Cannot find name ['"](\\w+)['"]/);
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
    console.log(`  🔧 TS2304: Добавлена декларация для '${name}'`);
    return true;
  }

  /**
   * TS2307: Cannot find module - исправляет путь через AST
   */
  private fixCannotFindModule(sourceFile: any, message: string): boolean {
    const match = message.match(/Cannot find module ['"]([^'"]+)['"]/);
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
        ];

        for (const candidate of possiblePaths) {
          const fullPath = path.join(currentDir, candidate);
          if (fs.existsSync(fullPath)) {
            const newPath = candidate.replace(/\.(js|ts)$/, '');
            imp.setModuleSpecifier(newPath);
            console.log(`  🔧 TS2307: Путь модуля исправлен: '${modulePath}' → '${newPath}'`);
            return true;
          }
        }

        if (!modulePath.startsWith('.')) {
          const ambientDecl = `declare module '${modulePath}' {\n  export = any;\n}\n`;
          sourceFile.insertText(0, ambientDecl);
          console.log(`  🔧 TS2307: Добавлена декларация модуля '${modulePath}'`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * TS2339: Property does not exist on type - добавляет свойство через AST
   */
  private fixMissingProperty(sourceFile: any, message: string): boolean {
    const match = message.match(/Property ['"](\\w+)['"] does not exist on type ['"]([^'"]+)['"]/);
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
      console.log(`  🔧 TS2339: Добавлено свойство '${property}' в интерфейс '${typeName}'`);
      return true;
    }

    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      const typeText = typeAlias.getText();
      if (typeText.includes('{')) {
        const newType = typeText.replace(/{/, `{ ${property}: any; `);
        typeAlias.replaceWithText(newType);
        console.log(`  🔧 TS2339: Добавлено свойство '${property}' в тип '${typeName}'`);
        return true;
      }
    }

    return false;
  }

  /**
   * TS7006: Parameter implicitly has any type - добавляет тип через AST
   */
  private fixImplicitAny(sourceFile: any, message: string): boolean {
    const match = message.match(/Parameter ['"](\\w+)['"] implicitly has an 'any' type/);
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
          console.log(`  🔧 TS7006: Добавлен тип 'any' для параметра '${paramName}'`);
          break;
        }
      }
    }

    return fixed;
  }

  /**
   * TS7031: Binding element implicitly has any type
   */
  private fixBindingImplicitAny(sourceFile: any, message: string): boolean {
    const match = message.match(/Binding element ['"](\\w+)['"] implicitly has an 'any' type/);
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
            console.log(`  🔧 TS7031: Добавлен тип 'any' для binding элемента '${bindingName}'`);
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
  private fixImplicitAnyIndex(sourceFile: any): boolean {
    let fixed = false;

    sourceFile.forEachDescendant((node: any) => {
      const kind = node.getKind();
      if (kind === 208) {
        // ElementAccessExpression
        const expression = node.getExpression();
        const argument = node.getArgumentExpression();

        if (expression && argument && !node.getText().includes('as any')) {
          const newText = `(${expression.getText()} as any)[${argument.getText()}]`;
          node.replaceWithText(newText);
          fixed = true;
          console.log("  🔧 TS7053: Добавлено 'as any' для индексного доступа");
        }
      }
    });

    return fixed;
  }

  /**
   * TS6133: Variable is declared but never used - добавляет префикс _
   */
  private fixUnusedVariable(sourceFile: any, message: string): boolean {
    const match = message.match(/['"](\\w+)['"] is declared but never used/);
    if (!match) return false;

    const varName = match[1];
    if (!varName) return false;

    const variableDecl = sourceFile.getVariableDeclaration(varName);
    if (variableDecl) {
      const newName = `_${varName}`;
      variableDecl.rename(newName);
      console.log(
        `  🔧 TS6133: Переименована неиспользуемая переменная '${varName}' → '${newName}'`
      );
      return true;
    }

    const parameter = sourceFile.getFunction(varName)?.getParameter(varName);
    if (parameter) {
      parameter.rename(`_${varName}`);
      console.log(`  🔧 TS6133: Переименован неиспользуемый параметр '${varName}'`);
      return true;
    }

    return false;
  }

  /**
   * TS2322: Type mismatch - добавляет as any
   */
  private fixTypeMismatch(sourceFile: any, issue: ValidationIssue): boolean {
    const lineNumber = issue.line || 1;
    const lines = sourceFile.getText().split('\n');
    const lineIndex = lineNumber - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const oldLine = lines[lineIndex];
      const newLine = oldLine.replace(/(=\\s*)([^;]+)/, '$1($2 as any)');

      if (newLine !== oldLine) {
        sourceFile.replaceWithText(
          lines.map((l: string, i: number) => (i === lineIndex ? newLine : l)).join('\n')
        );
        console.log("  🔧 TS2322: Добавлено 'as any' для приведения типа");
        return true;
      }
    }

    return false;
  }

  /**
   * TS2552: Typo - исправляет опечатку через AST
   */
  private fixTypo(sourceFile: any, message: string): boolean {
    const match = message.match(/Cannot find name ['"](\\w+)['"].*Did you mean ['"](\\w+)['"]/);
    if (!match) return false;

    const wrongName = match[1];
    const suggestedName = match[2];
    if (!wrongName || !suggestedName) return false;

    let fixed = false;

    sourceFile.forEachDescendant((node: any) => {
      const kind = node.getKind();
      if (kind === 79) {
        // Identifier
        if (node.getText() === wrongName) {
          node.rename(suggestedName);
          fixed = true;
        }
      }
    });

    if (fixed) {
      console.log(`  🔧 TS2552: Исправлена опечатка '${wrongName}' → '${suggestedName}'`);
    }

    return fixed;
  }

  /**
   * TS18046: 'error' is of type 'unknown' - добавляет тип any
   */
  private fixUnknownError(sourceFile: any): boolean {
    let fixed = false;

    sourceFile.forEachDescendant((node: any) => {
      const kind = node.getKind();
      if (kind === 199) {
        // CatchClause
        const declaration = node.getVariableDeclaration();
        if (declaration && !declaration.getTypeNode()) {
          declaration.setType('any');
          fixed = true;
          console.log("  🔧 TS18046: Добавлен тип 'any' для переменной в catch блоке");
        }
      }
    });

    return fixed;
  }

  /**
   * TS2835: Missing file extensions - добавляет расширения через AST
   */
  private fixImportExtensions(sourceFile: any): boolean {
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
          console.log(`  🔧 TS2835: Добавлено расширение .js: '${specifier}' → '${specifier}.js'`);
        } else if (fs.existsSync(tsPath)) {
          imp.setModuleSpecifier(`${specifier}.ts`);
          fixed = true;
          console.log(`  🔧 TS2835: Добавлено расширение .ts: '${specifier}' → '${specifier}.ts'`);
        }
      }
    }

    return fixed;
  }

  /**
   * TS2591: Cannot find type definitions
   */
  private fixMissingTypes(sourceFile: any, message: string): boolean {
    const match = message.match(/Cannot find name ['"](\\w+)['"]/);
    if (!match) return false;

    const name = match[1];
    if (!name) return false;

    const declareModule = `// @ts-ignore - Missing types for ${name}\n`;

    if (!sourceFile.getText().includes(declareModule)) {
      sourceFile.insertText(0, declareModule);
      console.log(`  🔧 TS2591: Добавлен @ts-ignore для '${name}'`);
      return true;
    }

    return false;
  }

  /**
   * Исправление ESLint проблем через AST (делегируется ESLintASTFixer)
   */
  async fixESLintIssues(filePaths: string[], createBackup = true): Promise<FixResult[]> {
    const results = await this.eslintFixer.fixFiles(filePaths, createBackup);

    const totalFixes = results.reduce((sum, r) => sum + r.fixes, 0);
    this.fixesApplied += totalFixes;

    return results.map(r => ({
      success: r.success,
      file: r.file,
      fixes: r.fixes,
      errors: r.errors,
      backupPath: undefined,
    }));
  }

  /**
   * Получение статистики
   */
  getStats(): { totalFixes: number } {
    return { totalFixes: this.fixesApplied };
  }

  /**
   * Сброс статистики
   */
  resetStats(): void {
    this.fixesApplied = 0;
    this.eslintFixer.clearHistory();
  }

  /**
   * Получить историю исправлений ESLint
   */
  getESLintFixHistory(): Map<string, string[]> {
    return this.eslintFixer.getFixHistory();
  }

  /**
   * Проверка, исправима ли проблема
   */
  isFixable(issue: ValidationIssue): boolean {
    const code = typeof issue.code === 'number' ? issue.code : 0;
    const fixableTSCodes = [
      2304, 2339, 2345, 2322, 2552, 2307, 7006, 7053, 18046, 2591, 2835, 6133,
    ];
    const fixableESLintRules = [
      'no-unused-vars',
      'no-undef',
      'semi',
      'quotes',
      'no-trailing-spaces',
      'eol-last',
      'no-multiple-empty-lines',
      'comma-dangle',
      'prefer-const',
      'eqeqeq',
      'no-var',
      'object-shorthand',
      'arrow-body-style',
    ];

    const ruleId = (issue as any).ruleId;
    return fixableTSCodes.includes(code) || fixableESLintRules.includes(ruleId);
  }
}
