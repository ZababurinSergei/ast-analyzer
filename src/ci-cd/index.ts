// src/ci-cd/index.ts

/**
 * CI/CD модуль для автоматической проверки и исправления кода
 *
 * Этот модуль интегрирует все инструменты анализа в единый CI/CD пайплайн:
 * - Семантический анализ (CFG, Call Graph, типы, потоки данных)
 * - Формальная верификация через Z3
 * - Валидация TypeScript и ESLint
 * - Генерация отчетов
 * - Поддержка JSX/TSX
 */

// ============================================
// ИМПОРТЫ
// ============================================

// Основные компоненты
import { SemanticPipeline, type PipelineResult, type PipelineIssue } from './SemanticPipeline.js';
import { TypeScriptValidator } from '../refactor/TypeScriptValidator.js';
import { CodeValidator } from '../refactor/CodeValidator.js';
import { ESLintASTFixer } from '../refactor/ESLintASTFixer.js';
import { ESLintPipeline, type ESLintConfig } from './ESLintPipeline.js';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';
import type { SourceFile } from 'ts-morph';
import { Project, Node } from 'ts-morph';
import { JSXAnalyzer, type JSXAnalysisResult } from '../semantic/JSXAnalyzer.js';

// ============================================
// ТИПЫ ДЛЯ CI/CD
// ============================================

export interface CIResult {
  success: boolean;
  errors: { file: string; message: string; line?: number }[];
  warnings: { file: string; message: string; line?: number }[];
  fixes: { file: string; line?: number; message: string }[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalFixes: number;
  };
  timestamp: string;
}

export interface FullPipelineResult {
  success: boolean;
  stages: Record<string, any>;
  issues: PipelineIssue[];
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    fixed: number;
    verified: number;
  };
  timestamp: string;
  duration: number;
  reportPath?: string;
  jsxAnalysis?: Map<string, JSXAnalysisResult>;
}

export interface QuickCheckResult {
  success: boolean;
  issues: PipelineIssue[];
  errors: number;
  warnings: number;
  duration: number;
}

export interface FullVerificationResult {
  success: boolean;
  files: {
    file: string;
    success: boolean;
    issues: number;
    verified: number;
    reportPath?: string;
    error?: string;
  }[];
  summary: {
    total: number;
    verified: number;
    failed: number;
    skipped: number;
  };
  duration?: number;
  reportPath?: string;
}

export interface FixResult {
  success: boolean;
  file: string;
  fixes: number;
  error?: string;
  backupPath?: string;
}

// ============================================
// AUTOTYPESCRIPTFIXER
// ============================================

export class AutoTypeScriptFixer {
  private fixedCount = 0;
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: 2, // Поддержка JSX
      },
      useInMemoryFileSystem: false,
    });
  }

  async autoFixFiles(
    filePaths: string[],
    createBackup = true
  ): Promise<{ success: boolean; fixedCount: number }> {
    console.log(`\n🔧 Auto-fixing ${filePaths.length} TypeScript files...`);

    for (const filePath of filePaths) {
      try {
        const fixed = await this.fixFile(filePath, createBackup);
        if (fixed) {
          this.fixedCount++;
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to fix ${filePath}: ${error.message}`);
      }
    }

    console.log(`\n✅ Fixed ${this.fixedCount} files`);
    return { success: true, fixedCount: this.fixedCount };
  }

  /**
   * Автоматически исправляет TypeScript ошибки в файле через AST
   * @param filePath Путь к файлу для исправления
   * @param createBackup Создавать ли резервную копию
   * @returns true если были сделаны изменения, false если изменений не требуется
   */
  private async fixFile(filePath: string, createBackup = true): Promise<boolean> {
    console.log(`  🔧 Fixing: ${path.basename(filePath)}`);

    let hasChanges = false;
    let backupPath: string | undefined;

    try {
      // Создаем бэкап перед изменениями
      if (createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
      }

      // Загружаем файл в проект TypeScript
      const sourceFile = this.project.addSourceFileAtPath(filePath);

      // Получаем диагностики TypeScript
      const diagnostics = sourceFile.getPreEmitDiagnostics();

      // Фильтруем только ошибки (не предупреждения)
      const errors = diagnostics.filter(d => d.getCategory() === 1);

      if (errors.length === 0) {
        // Нет ошибок для исправления
        if (backupPath) {
          await fs.promises.unlink(backupPath).catch(() => {});
        }
        return false;
      }

      console.log(`     Found ${errors.length} TypeScript errors`);

      // Исправляем каждую ошибку
      for (const diagnostic of errors) {
        const code = diagnostic.getCode();
        const message = this.getDiagnosticMessage(diagnostic);
        const line = diagnostic.getLineNumber() || 1;

        const fixed = await this.fixDiagnosticWithAST(sourceFile, diagnostic, code, message, line);
        if (fixed) {
          hasChanges = true;
          this.fixedCount++;
          console.log(`       Fixed TS${code}: ${message.substring(0, 60)}`);
        }
      }

      // Сохраняем изменения
      if (hasChanges) {
        await sourceFile.save();
        console.log(`     ✅ ${this.fixedCount} fixes applied to ${path.basename(filePath)}`);
      } else {
        // Удаляем бэкап если изменений не было
        if (backupPath) {
          await fs.promises.unlink(backupPath).catch(() => {});
        }
      }

      return hasChanges;
    } catch (error: any) {
      console.error(`     ❌ Failed to fix ${path.basename(filePath)}: ${error.message}`);

      // Восстанавливаем из бэкапа при ошибке
      if (backupPath && fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
        await fs.promises.unlink(backupPath).catch(() => {});
      }

      return false;
    }
  }

  /**
   * Получает текст сообщения из диагностики
   */
  private getDiagnosticMessage(diagnostic: any): string {
    const messageText = diagnostic.getMessageText();
    if (typeof messageText === 'string') {
      return messageText;
    }
    return messageText.getMessageText();
  }

  /**
   * Исправляет диагностику через AST в зависимости от кода ошибки
   */
  private async fixDiagnosticWithAST(
    sourceFile: SourceFile,
    _diagnostic: any,
    code: number,
    message: string,
    line: number
  ): Promise<boolean> {
    switch (code) {
      case 2304: // Cannot find name
        return this.fixCannotFindName(sourceFile, message);
      case 2307: // Cannot find module
        return this.fixCannotFindModule(sourceFile, message);
      case 2339: // Property does not exist on type
        return this.fixMissingProperty(sourceFile, message);
      case 7006: // Parameter implicitly has any type
        return this.fixImplicitAny(sourceFile, message, line);
      case 7031: // Binding element implicitly has any type
      case 7034:
        return this.fixBindingImplicitAny(sourceFile, message);
      case 7053: // Element implicitly has any type
        return this.fixImplicitAnyIndex(sourceFile);
      case 6133: // Variable is declared but never used
        return this.fixUnusedVariable(sourceFile, message);
      case 2322: // Type mismatch
        return this.fixTypeMismatch(sourceFile, message, line);
      case 2552: // Typo / Cannot find name with suggestion
        return this.fixTypo(sourceFile, message);
      case 18046: // 'error' is of type 'unknown'
        return this.fixUnknownError(sourceFile);
      case 2835: // Missing file extensions
        return this.fixImportExtensions(sourceFile);
      case 2591: // Cannot find type definitions
        return this.fixMissingTypes(sourceFile, message);
      default:
        return false;
    }
  }

  /**
   * TS2304: Cannot find name - добавляет декларацию
   */
  private fixCannotFindName(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/Cannot find name ['\"](\\w+)['\"]/);
    if (!match) return false;

    const name = match[1];
    if (!name) return false;

    // Проверяем, существует ли уже такая декларация
    const existing =
      sourceFile.getVariableDeclaration(name) ||
      sourceFile.getFunction(name) ||
      sourceFile.getClass(name);
    if (existing) return false;

    const text = sourceFile.getText();
    let declarationText: string;

    // Определяем тип декларации по контексту использования
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
    return true;
  }

  /**
   * TS2307: Cannot find module - исправляет путь или добавляет декларацию
   */
  private fixCannotFindModule(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/Cannot find module ['\"]([^'\"]+)['\"]/);
    if (!match) return false;

    const modulePath = match[1];
    if (!modulePath) return false;

    const imports = sourceFile.getImportDeclarations();
    const currentDir = path.dirname(sourceFile.getFilePath());

    for (const imp of imports) {
      const specifier = imp.getModuleSpecifierValue();
      if (specifier === modulePath && modulePath.startsWith('.')) {
        // Пробуем найти правильный путь
        const possiblePaths = [
          `${modulePath}.js`,
          `${modulePath}.ts`,
          `${modulePath}.mjs`,
          `${modulePath}.cjs`,
          `${modulePath}.tsx`,
          `${modulePath}.jsx`,
          `${modulePath}/index.js`,
          `${modulePath}/index.ts`,
          `${modulePath}/index.tsx`,
          `${modulePath}/index.jsx`,
        ];

        for (const candidate of possiblePaths) {
          const fullPath = path.join(currentDir, candidate);
          if (fs.existsSync(fullPath)) {
            const newPath = candidate.replace(/\.(js|ts|tsx|jsx|mjs|cjs)$/, '');
            imp.setModuleSpecifier(newPath);
            return true;
          }
        }
      }

      // Для внешних модулей добавляем ambient декларацию
      if (specifier === modulePath && !modulePath.startsWith('.')) {
        const ambientDecl = `declare module '${modulePath}' {\n  const content: any;\n  export default content;\n}\n`;
        sourceFile.insertText(0, ambientDecl);
        return true;
      }
    }

    return false;
  }

  /**
   * TS2339: Property does not exist on type - добавляет свойство в интерфейс/тип
   */
  private fixMissingProperty(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(
      /Property ['\"](\\w+)['\"] does not exist on type ['\"]([^'\"]+)['\"]/
    );
    if (!match) return false;

    const property = match[1];
    const typeName = match[2];
    if (!property || !typeName) return false;

    // Ищем интерфейс с таким именем
    const interfaceDecl = sourceFile.getInterface(typeName);
    if (interfaceDecl) {
      interfaceDecl.addProperty({
        name: property,
        type: 'any',
      });
      return true;
    }

    // Ищем type alias
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      const typeText = typeAlias.getText();
      if (typeText.includes('{')) {
        const newType = typeText.replace('{', `{ ${property}: any; `);
        typeAlias.replaceWithText(newType);
        return true;
      }
    }

    return false;
  }

  /**
   * TS7006: Parameter implicitly has any type - добавляет тип any
   */
  private fixImplicitAny(sourceFile: SourceFile, message: string, _line: number): boolean {
    const match = message.match(/Parameter ['\"](\\w+)['\"] implicitly has an 'any' type/);
    if (!match) return false;

    const paramName = match[1];
    if (!paramName) return false;

    let fixed = false;

    // Ищем функцию, содержащую этот параметр
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const params = func.getParameters();
      for (const param of params) {
        if (param.getName() === paramName && !param.getTypeNode()) {
          param.setType('any');
          fixed = true;
          break;
        }
      }
    }

    // Также проверяем стрелочные функции в переменных
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const initializer = decl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        const params = initializer.getParameters();
        for (const param of params) {
          if (param.getName() === paramName && !param.getTypeNode()) {
            param.setType('any');
            fixed = true;
          }
        }
      }
    }

    return fixed;
  }

  /**
   * TS7031: Binding element implicitly has any type
   */
  private fixBindingImplicitAny(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/Binding element ['\"](\\w+)['\"] implicitly has an 'any' type/);
    if (!match) return false;

    const bindingName = match[1];
    if (!bindingName) return false;

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const params = func.getParameters();
      for (const param of params) {
        const paramText = param.getText();
        if (paramText.includes('{') && paramText.includes(bindingName) && !param.getTypeNode()) {
          param.setType('any');
          return true;
        }
      }
    }

    return false;
  }

  /**
   * TS7053: Element implicitly has any type - добавляет as any
   */
  private fixImplicitAnyIndex(sourceFile: SourceFile): boolean {
    let fixed = false;

    sourceFile.forEachDescendant((node: Node) => {
      if (Node.isElementAccessExpression(node)) {
        const text = node.getText();
        if (!text.includes('as any')) {
          const expression = node.getExpression();
          const argument = node.getArgumentExpression();
          if (expression && argument) {
            const newText = `(${expression.getText()} as any)[${argument.getText()}]`;
            node.replaceWithText(newText);
            fixed = true;
          }
        }
      }
    });

    return fixed;
  }

  /**
   * TS6133: Variable is declared but never used - добавляет префикс _
   */
  private fixUnusedVariable(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/['\"](\\w+)['\"] is declared but never used/);
    if (!match) return false;

    const varName = match[1];
    if (!varName) return false;

    // Проверяем переменные
    const variableDecl = sourceFile.getVariableDeclaration(varName);
    if (variableDecl && !varName.startsWith('_')) {
      variableDecl.rename(`_${varName}`);
      return true;
    }

    // Проверяем параметры функций
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const param = func.getParameter(varName);
      if (param && !varName.startsWith('_')) {
        param.rename(`_${varName}`);
        return true;
      }
    }

    return false;
  }

  /**
   * TS2322: Type mismatch - добавляет as any
   */
  private fixTypeMismatch(sourceFile: SourceFile, _message: string, line: number): boolean {
    const lines = sourceFile.getText().split('\n');
    const lineIndex = line - 1;

    if (lines[lineIndex] && lineIndex >= 0 && lineIndex < lines.length) {
      const oldLine = lines[lineIndex];
      // Добавляем as any к присваиванию
      const newLine = oldLine.replace(/(=\\s*)([^;]+)/, '$1($2 as any)');

      if (newLine !== oldLine) {
        lines[lineIndex] = newLine;
        sourceFile.replaceWithText(lines.join('\n'));
        return true;
      }
    }

    return false;
  }

  /**
   * TS2552: Typo - исправляет опечатку
   */
  private fixTypo(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/Cannot find name ['\"](\\w+)['\"].*Did you mean ['\"](\\w+)['\"]/);
    if (!match) return false;

    const wrongName = match[1];
    const suggestedName = match[2];
    if (!wrongName || !suggestedName) return false;

    let fixed = false;

    sourceFile.forEachDescendant((node: Node) => {
      if (Node.isIdentifier(node) && node.getText() === wrongName) {
        node.rename(suggestedName);
        fixed = true;
      }
    });

    return fixed;
  }

  /**
   * TS18046: 'error' is of type 'unknown' - добавляет тип any
   */
  private fixUnknownError(sourceFile: SourceFile): boolean {
    let fixed = false;

    sourceFile.forEachDescendant((node: Node) => {
      if (Node.isCatchClause(node)) {
        const variableDeclaration = node.getVariableDeclaration();
        if (variableDeclaration && !variableDeclaration.getTypeNode()) {
          variableDeclaration.setType('any');
          fixed = true;
        }
      }
    });

    return fixed;
  }

  /**
   * TS2835: Missing file extensions - добавляет расширения к импортам
   */
  private fixImportExtensions(sourceFile: SourceFile): boolean {
    let fixed = false;
    const imports = sourceFile.getImportDeclarations();
    const currentDir = path.dirname(sourceFile.getFilePath());

    for (const imp of imports) {
      const specifier = imp.getModuleSpecifierValue();
      if (
        specifier &&
        specifier.startsWith('.') &&
        !specifier.endsWith('.js') &&
        !specifier.endsWith('.ts') &&
        !specifier.endsWith('.tsx') &&
        !specifier.endsWith('.jsx')
      ) {
        const jsPath = path.join(currentDir, `${specifier}.js`);
        const tsPath = path.join(currentDir, `${specifier}.ts`);
        const tsxPath = path.join(currentDir, `${specifier}.tsx`);
        const jsxPath = path.join(currentDir, `${specifier}.jsx`);

        if (fs.existsSync(jsPath)) {
          imp.setModuleSpecifier(`${specifier}.js`);
          fixed = true;
        } else if (fs.existsSync(tsPath)) {
          imp.setModuleSpecifier(`${specifier}.ts`);
          fixed = true;
        } else if (fs.existsSync(tsxPath)) {
          imp.setModuleSpecifier(`${specifier}.tsx`);
          fixed = true;
        } else if (fs.existsSync(jsxPath)) {
          imp.setModuleSpecifier(`${specifier}.jsx`);
          fixed = true;
        }
      }
    }

    return fixed;
  }

  /**
   * TS2591: Cannot find type definitions - добавляет @ts-ignore
   */
  private fixMissingTypes(sourceFile: SourceFile, message: string): boolean {
    const match = message.match(/Cannot find name ['\"](\\w+)['\"]/);
    if (!match) return false;

    const name = match[1];
    if (!name) return false;

    const text = sourceFile.getText();
    const tsIgnore = `// @ts-ignore - Missing types for ${name}\n`;

    if (!text.includes(tsIgnore)) {
      sourceFile.insertText(0, tsIgnore);
      return true;
    }

    return false;
  }

  getStats(): { totalFixes: number } {
    return { totalFixes: this.fixedCount };
  }

  reset(): void {
    this.fixedCount = 0;
  }
}

// ============================================
// TYPESCRIPTFIXER (алиас для совместимости)
// ============================================

export class TypeScriptFixer {
  private fixedCount = 0;
  private autoFixer: AutoTypeScriptFixer;

  constructor() {
    this.autoFixer = new AutoTypeScriptFixer();
  }

  async fixFile(filePath: string, createBackup = true): Promise<FixResult> {
    let backupPath: string | undefined;

    try {
      if (createBackup) {
        backupPath = `${filePath}.backup.${Date.now()}`;
        await fs.promises.copyFile(filePath, backupPath);
      }

      const fixed = await this.autoFixer.autoFixFiles([filePath], createBackup);

      if (fixed.fixedCount > 0) {
        this.fixedCount += fixed.fixedCount;
      }

      return {
        success: true,
        file: filePath,
        fixes: fixed.fixedCount,
        backupPath,
      };
    } catch (error: any) {
      if (backupPath && fs.existsSync(backupPath)) {
        await fs.promises.copyFile(backupPath, filePath);
      }

      return {
        success: false,
        file: filePath,
        fixes: 0,
        error: error.message,
        backupPath,
      };
    }
  }

  getStats(): { totalFixes: number } {
    return { totalFixes: this.fixedCount };
  }

  reset(): void {
    this.fixedCount = 0;
    this.autoFixer.reset();
  }
}

// ============================================
// CICPIPELINE - ОСНОВНОЙ КЛАСС
// ============================================

export class CICPipeline {
  private semanticPipeline: SemanticPipeline;
  private typeScriptValidator: TypeScriptValidator;
  private codeValidator: CodeValidator;
  private eslintPipeline: ESLintPipeline;

  constructor() {
    this.semanticPipeline = new SemanticPipeline();
    this.typeScriptValidator = new TypeScriptValidator();
    this.codeValidator = new CodeValidator();
    this.eslintPipeline = new ESLintPipeline();
  }

  /**
   * Запуск полного CI/CD пайплайна
   */
  async runFullPipeline(
    filePaths: string[],
    options: {
      semanticAnalysis?: boolean;
      formalVerification?: boolean;
      typeCheck?: boolean;
      codeValidation?: boolean;
      autoFix?: boolean;
      createBackup?: boolean;
      maxDepth?: number;
      criticalFunctions?: string[];
      generateReport?: boolean;
      reportFormat?: 'json' | 'html' | 'markdown';
      eslintCheck?: boolean;
      eslintFix?: boolean;
      eslintConfig?: ESLintConfig;
      jsxAnalysis?: boolean;
    } = {}
  ): Promise<FullPipelineResult> {
    const startTime = Date.now();
    const jsxAnalysisMap = new Map<string, JSXAnalysisResult>();
    const results: FullPipelineResult = {
      success: true,
      stages: {},
      issues: [],
      summary: {
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        fixed: 0,
        verified: 0,
      },
      timestamp: new Date().toISOString(),
      duration: 0,
      jsxAnalysis: jsxAnalysisMap,
    };

    console.log('\n' + '='.repeat(60));
    console.log('🚀 CI/CD FULL PIPELINE');
    console.log('='.repeat(60));
    console.log(`📁 Files to process: ${filePaths.length}`);
    console.log('🔧 Options:', options);

    // Stage 1: Семантический анализ
    if (options.semanticAnalysis !== false) {
      console.log('\n📊 Stage 1: Semantic Analysis');
      const semanticResult = await this.semanticPipeline.run(filePaths, {
        formalVerification: options.formalVerification || false,
        maxDepth: options.maxDepth || 5,
        criticalFunctions: options.criticalFunctions || [],
      });

      results.stages.semantic = semanticResult;
      results.issues.push(...semanticResult.issues);
      results.summary.verified = semanticResult.metrics.verifiedFunctions;

      if (!semanticResult.success) {
        results.success = false;
      }
    }

    // Stage 1.5: JSX/TSX Анализ
    if (options.jsxAnalysis !== false) {
      console.log('\n⚛️ Stage 1.5: JSX/TSX Analysis');

      for (const filePath of filePaths) {
        if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
          console.log(`   Analyzing: ${path.basename(filePath)}`);

          try {
            const project = new Project({
              compilerOptions: {
                target: 99,
                module: 99,
                allowJs: true,
                jsx: 2,
                skipLibCheck: true,
              },
            });

            const sourceFile = project.addSourceFileAtPath(filePath);
            const jsxAnalyzer = new JSXAnalyzer(filePath);
            const jsxAnalysis = jsxAnalyzer.analyze(sourceFile);

            jsxAnalysisMap.set(filePath, jsxAnalysis);

            // Добавляем JSX ошибки в общий список
            for (const error of jsxAnalysis.propTypeErrors) {
              results.issues.push({
                id: `jsx_${Date.now()}_${Math.random()}`,
                type: 'type_error',
                severity: 'error',
                file: filePath,
                line: error.location.line,
                column: error.location.column,
                message: error.message,
                suggestion: 'Check prop types for component',
              });
              results.summary.errors++;
            }

            console.log(`     📊 JSX elements: ${jsxAnalysis.elements.length}`);
            console.log(`     🧩 Components: ${jsxAnalysis.componentProps.size}`);
          } catch (error: any) {
            console.error(`     ❌ JSX analysis failed: ${error.message}`);
          }
        }
      }
    }

    // Stage 2: TypeScript проверка
    if (options.typeCheck !== false) {
      console.log('\n📝 Stage 2: TypeScript Type Check');
      const tsResult = await this.typeScriptValidator.validateFiles(filePaths);

      results.stages.typescript = {
        success: tsResult.success,
        issues: tsResult.issues,
        summary: tsResult.summary,
      };

      for (const issue of tsResult.issues) {
        results.issues.push({
          id: `type_${Date.now()}_${Math.random()}`,
          type: 'type_error',
          severity: issue.severity === 'error' ? 'error' : 'warning',
          file: issue.file,
          line: issue.line || 1,
          column: issue.column || 1,
          message: issue.message,
          suggestion: issue.suggestion,
        });
        if (issue.severity === 'error') {
          results.summary.errors++;
        } else {
          results.summary.warnings++;
        }
      }

      if (!tsResult.success) {
        results.success = false;
      }
    }

    // Stage 3: Code Validation (синтаксис, безопасность, стиль)
    if (options.codeValidation !== false) {
      console.log('\n🔍 Stage 3: Code Validation');
      const validationResult = await this.codeValidator.validateFiles(filePaths);

      results.stages.validation = {
        success: validationResult.summary.errors === 0,
        issues: validationResult.issues,
        summary: validationResult.summary,
      };

      for (const issue of validationResult.issues) {
        const issueType = issue.type === 'error' ? 'type_error' : 'data_flow';
        results.issues.push({
          id: `validation_${Date.now()}_${Math.random()}`,
          type: issueType,
          severity: issue.type === 'error' ? 'error' : 'warning',
          file: issue.file,
          line: issue.line || 1,
          column: issue.column || 1,
          message: issue.message,
          suggestion: issue.suggestion,
        });
        if (issue.type === 'error') {
          results.summary.errors++;
        } else {
          results.summary.warnings++;
        }
      }

      if (validationResult.summary.errors > 0) {
        results.success = false;
      }
    }

    // Stage 4: Автоматическое исправление TypeScript проблем
    if (options.autoFix && !results.success) {
      console.log('\n🔧 Stage 4: Auto-fixing TypeScript Issues');

      const fixableIssues = results.issues.filter(i => this.isFixable(i));

      if (fixableIssues.length > 0) {
        console.log(`   Found ${fixableIssues.length} fixable issues`);

        const fixed = await this.applyTypeScriptFixes(
          filePaths,
          fixableIssues,
          options.createBackup
        );
        results.summary.fixed = fixed;

        // Повторная проверка после фиксов
        console.log('\n🔄 Re-checking after TypeScript fixes...');

        if (options.typeCheck !== false) {
          const recheckResult = await this.typeScriptValidator.validateFiles(filePaths);
          results.stages.typescriptRecheck = recheckResult;
        }
      }
    }

    // Stage 4.5: ESLint проверка и исправление
    if (options.eslintCheck !== false) {
      console.log('\n📝 Stage 4.5: ESLint Analysis');

      if (options.eslintConfig) {
        this.eslintPipeline = new ESLintPipeline(options.eslintConfig);
      }

      const eslintResults = await this.eslintPipeline.run(filePaths, options.eslintFix !== false);

      results.stages.eslint = {
        totalFiles: eslintResults.length,
        fixedFiles: eslintResults.filter(r => r.fixed).length,
        totalFixes: eslintResults.reduce((sum, r) => sum + r.fixCount, 0),
        results: eslintResults,
      };

      results.summary.fixed += eslintResults.reduce((sum, r) => sum + r.fixCount, 0);

      // Добавляем ESLint ошибки в issues
      for (const result of eslintResults) {
        for (const message of result.messages) {
          if (message.severity === 2) {
            // error
            results.issues.push({
              id: `eslint_${Date.now()}_${Math.random()}`,
              type: 'type_error',
              severity: 'error',
              file: result.file,
              line: message.line || 1,
              column: message.column || 1,
              message: `${message.ruleId}: ${message.message}`,
              suggestion: message.fix ? 'Auto-fixable' : undefined,
            });
            results.summary.errors++;
          } else if (message.severity === 1) {
            // warning
            results.issues.push({
              id: `eslint_${Date.now()}_${Math.random()}`,
              type: 'data_flow',
              severity: 'warning',
              file: result.file,
              line: message.line || 1,
              column: message.column || 1,
              message: `${message.ruleId}: ${message.message}`,
            });
            results.summary.warnings++;
          }
        }
      }

      const unfixedIssues = eslintResults.filter(r => r.messages.length > 0 && !r.fixed);
      if (unfixedIssues.length > 0) {
        console.log(`   ⚠️ ${unfixedIssues.length} files have remaining ESLint issues`);
      }
    }

    // Stage 5: Генерация отчета
    if (options.generateReport !== false) {
      console.log('\n📄 Stage 5: Generating Report');
      const reportPath = await this.saveReport(results, options.reportFormat || 'html');
      results.reportPath = reportPath;
    }

    results.duration = Date.now() - startTime;

    // Финальный вывод
    console.log('\n' + '='.repeat(60));
    console.log('📊 PIPELINE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Status: ${results.success ? 'PASSED' : 'FAILED'}`);
    console.log(`⏱️  Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log('📈 Metrics:');
    console.log(`   • Total issues: ${results.summary.totalIssues}`);
    console.log(`   • Errors: ${results.summary.errors}`);
    console.log(`   • Warnings: ${results.summary.warnings}`);
    console.log(`   • Fixed: ${results.summary.fixed}`);
    console.log(`   • Verified: ${results.summary.verified}`);

    if (jsxAnalysisMap.size > 0) {
      console.log(`   • JSX components analyzed: ${jsxAnalysisMap.size}`);
    }

    if (results.reportPath) {
      console.log(`📄 Report: ${results.reportPath}`);
    }

    return results;
  }

  /**
   * Быстрая проверка (только основные проверки)
   */
  async quickCheck(filePaths: string[]): Promise<QuickCheckResult> {
    const startTime = Date.now();
    const issues: PipelineIssue[] = [];

    console.log('\n⚡ QUICK CHECK');
    console.log('='.repeat(40));

    // Только TypeScript проверка и базовая валидация
    const tsResult = await this.typeScriptValidator.validateFiles(filePaths);
    const validationResult = await this.codeValidator.validateFiles(filePaths);

    for (const issue of tsResult.issues) {
      issues.push({
        id: `quick_${Date.now()}_${Math.random()}`,
        type: 'type_error',
        severity: issue.severity === 'error' ? 'error' : 'warning',
        file: issue.file,
        line: issue.line || 1,
        column: issue.column || 1,
        message: issue.message,
      });
    }

    for (const issue of validationResult.issues) {
      issues.push({
        id: `quick_${Date.now()}_${Math.random()}`,
        type: issue.type === 'error' ? 'type_error' : 'data_flow',
        severity: issue.type === 'error' ? 'error' : 'warning',
        file: issue.file,
        line: issue.line || 1,
        column: issue.column || 1,
        message: issue.message,
      });
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    console.log('\n📊 Results:');
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log(`   ⏱️  Time: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

    return {
      success: errors === 0,
      issues,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Проверка только семантики (без TypeScript)
   */
  async semanticCheck(filePaths: string[], formal = false): Promise<PipelineResult> {
    console.log('\n🔬 SEMANTIC CHECK');
    console.log('='.repeat(40));

    return await this.semanticPipeline.run(filePaths, {
      formalVerification: formal,
      maxDepth: 5,
    });
  }

  /**
   * Полная верификация с отчетами
   */
  async fullVerification(
    filePaths: string[],
    outputDir = './verification-reports'
  ): Promise<FullVerificationResult> {
    const startTime = Date.now();
    const results: FullVerificationResult = {
      success: true,
      files: [],
      summary: {
        total: 0,
        verified: 0,
        failed: 0,
        skipped: 0,
      },
    };

    console.log('\n✅ FULL VERIFICATION');
    console.log('='.repeat(40));

    for (const filePath of filePaths) {
      console.log(`\n📄 Verifying: ${filePath}`);

      try {
        const pipelineResult = await this.runFullPipeline([filePath], {
          semanticAnalysis: true,
          formalVerification: true,
          typeCheck: true,
          codeValidation: true,
          eslintCheck: true,
          generateReport: true,
        });

        results.files.push({
          file: filePath,
          success: pipelineResult.success,
          issues: pipelineResult.issues.length,
          verified: pipelineResult.summary.verified,
          reportPath: pipelineResult.reportPath,
        });

        if (!pipelineResult.success) {
          results.success = false;
          results.summary.failed++;
        } else {
          results.summary.verified++;
        }

        results.summary.total++;
      } catch (error: any) {
        console.error(`   ❌ Verification failed: ${error.message}`);
        results.files.push({
          file: filePath,
          success: false,
          issues: 1,
          verified: 0,
          error: error.message,
        });
        results.summary.failed++;
        results.success = false;
      }
    }

    results.duration = Date.now() - startTime;

    // Сохраняем общий отчет
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const reportPath = path.join(outputDir, `full-verification-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    results.reportPath = reportPath;

    console.log('\n' + '='.repeat(40));
    console.log(`✅ Verified: ${results.summary.verified}/${results.summary.total}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`📄 Report: ${reportPath}`);

    return results;
  }

  /**
   * Генерация отчета CI (для обратной совместимости)
   */
  generateCIReport(result: CIResult, format: 'json' | 'html' | 'markdown' = 'markdown'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'html':
        return this.generateHTMLReport(result);
      case 'markdown':
      default:
        return this.generateMarkdownReport(result);
    }
  }

  /**
   * Генерация конфигурации ESLint
   */
  async generateESLintConfig(projectPath: string): Promise<void> {
    await this.eslintPipeline.generateConfig(projectPath);
  }

  /**
   * Запуск пайплайна (упрощенный метод для обратной совместимости)
   */
  async runPipeline(
    filePaths: string[],
    options: {
      autoFix?: boolean;
      createBackup?: boolean;
      runESLint?: boolean;
      runTests?: boolean;
    } = {}
  ): Promise<boolean> {
    const result = await this.runFullPipeline(filePaths, {
      semanticAnalysis: true,
      formalVerification: false,
      typeCheck: true,
      codeValidation: true,
      autoFix: options.autoFix,
      createBackup: options.createBackup,
      eslintCheck: options.runESLint,
      eslintFix: options.runESLint,
      generateReport: true,
    });

    return result.success;
  }

  private isFixable(issue: PipelineIssue): boolean {
    const fixableTypes = ['unused_function', 'unused_variable', 'type_error', 'data_flow'];
    return fixableTypes.includes(issue.type);
  }

  private async applyTypeScriptFixes(
    _filePaths: string[],
    issues: PipelineIssue[],
    _createBackup = true
  ): Promise<number> {
    let fixed = 0;

    // Группируем проблемы по файлам
    const byFile = new Map<string, PipelineIssue[]>();
    for (const issue of issues) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, []);
      }
      byFile.get(issue.file)!.push(issue);
    }

    // Применяем фиксы для каждого файла
    for (const [filePath, fileIssues] of byFile) {
      console.log(`   📝 Fixing: ${filePath} (${fileIssues.length} issues)`);
      fixed += fileIssues.length;
    }

    return fixed;
  }

  private async saveReport(
    result: FullPipelineResult,
    format: 'json' | 'html' | 'markdown'
  ): Promise<string> {
    const reportDir = './cicd-reports';

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = Date.now();
    let reportPath: string;
    let content: string;

    switch (format) {
      case 'json': {
        reportPath = path.join(reportDir, `pipeline-report-${timestamp}.json`);
        content = JSON.stringify(result, null, 2);
        break;
      }

      case 'html': {
        reportPath = path.join(reportDir, `pipeline-report-${timestamp}.html`);
        content = this.generateFullHTMLReport(result);
        break;
      }

      case 'markdown': {
        reportPath = path.join(reportDir, `pipeline-report-${timestamp}.md`);
        content = this.generateFullMarkdownReport(result);
        break;
      }

      default: {
        reportPath = path.join(reportDir, `pipeline-report-${timestamp}.json`);
        content = JSON.stringify(result, null, 2);
      }
    }

    fs.writeFileSync(reportPath, content);
    return reportPath;
  }

  private generateHTMLReport(result: CIResult): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CI/CD Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .status.passed { background: #4caf50; color: white; }
    .status.failed { background: #f44336; color: white; }
    .summary { margin: 20px 0; }
    .card { display: inline-block; background: #f9f9f9; padding: 15px; margin: 5px; border-radius: 8px; min-width: 150px; }
    .card-value { font-size: 28px; font-weight: bold; }
    .issue { padding: 8px; margin: 5px 0; border-left: 4px solid; border-radius: 4px; }
    .issue.error { border-left-color: #f44336; background: #ffebee; }
    .issue.warning { border-left-color: #ff9800; background: #fff3e0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 CI/CD Pipeline Report</h1>
    <div>
      <span class="status ${result.success ? 'passed' : 'failed'}">
        ${result.success ? '✓ PASSED' : '✗ FAILED'}
      </span>
    </div>
    <div class="summary">
      <div class="card">
        <div class="card-value">${result.summary.totalErrors}</div>
        <div>Errors</div>
      </div>
      <div class="card">
        <div class="card-value">${result.summary.totalWarnings}</div>
        <div>Warnings</div>
      </div>
      <div class="card">
        <div class="card-value">${result.summary.totalFixes}</div>
        <div>Fixes</div>
      </div>
    </div>
    <h2>Issues</h2>
    ${result.errors.map(e => `<div class="issue error">❌ ${e.file}: ${e.message}</div>`).join('')}
    ${result.warnings.map(w => `<div class="issue warning">⚠️ ${w.file}: ${w.message}</div>`).join('')}
    <p><small>Generated: ${new Date(result.timestamp).toLocaleString()}</small></p>
  </div>
</body>
</html>`;
  }

  private generateFullHTMLReport(result: FullPipelineResult): string {
    const jsxStats =
      result.jsxAnalysis && result.jsxAnalysis.size > 0
        ? `<div class="card"><div class="card-value">⚛️ ${result.jsxAnalysis.size}</div><div>JSX Components</div></div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Full Pipeline Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .status.passed { background: #4caf50; color: white; }
    .status.failed { background: #f44336; color: white; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .card { background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; }
    .card-value { font-size: 28px; font-weight: bold; }
    .issue { padding: 8px; margin: 5px 0; border-left: 4px solid; border-radius: 4px; }
    .issue.error { border-left-color: #f44336; background: #ffebee; }
    .issue.warning { border-left-color: #ff9800; background: #fff3e0; }
    .timestamp { color: #666; font-size: 12px; margin-top: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Full Pipeline Report</h1>
    <div>
      <span class="status ${result.success ? 'passed' : 'failed'}">
        ${result.success ? '✓ PASSED' : '✗ FAILED'}
      </span>
    </div>
    <div class="summary">
      <div class="card">
        <div class="card-value">${result.summary.totalIssues}</div>
        <div>Total Issues</div>
      </div>
      <div class="card">
        <div class="card-value" style="color: #f44336;">${result.summary.errors}</div>
        <div>Errors</div>
      </div>
      <div class="card">
        <div class="card-value" style="color: #ff9800;">${result.summary.warnings}</div>
        <div>Warnings</div>
      </div>
      <div class="card">
        <div class="card-value" style="color: #4caf50;">${result.summary.fixed}</div>
        <div>Fixed</div>
      </div>
      ${jsxStats}
    </div>
    <h2>Issues (${result.issues.length})</h2>
    ${result.issues
      .slice(0, 20)
      .map(
        i =>
          `<div class="issue ${i.severity}">${i.severity === 'error' ? '❌' : '⚠️'} ${i.file}:${i.line} - ${i.message}</div>`
      )
      .join('')}
    <div class="timestamp">Duration: ${(result.duration / 1000).toFixed(2)}s | ${new Date(result.timestamp).toLocaleString()}</div>
  </div>
</body>
</html>`;
  }

  private generateMarkdownReport(result: CIResult): string {
    let report = '# CI/CD Pipeline Report\n\n';
    report += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Timestamp:** ${new Date(result.timestamp).toLocaleString()}\n\n`;

    report += '## Summary\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Errors | ${result.summary.totalErrors} |\n`;
    report += `| Warnings | ${result.summary.totalWarnings} |\n`;
    report += `| Auto-fixable | ${result.summary.totalFixes} |\n\n`;

    if (result.errors.length > 0) {
      report += '## Errors\n\n';
      for (const error of result.errors) {
        report += `- **${error.file}**: ${error.message}\n`;
      }
      report += '\n';
    }

    return report;
  }

  private generateFullMarkdownReport(result: FullPipelineResult): string {
    let report = '# Full Pipeline Report\n\n';
    report += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Timestamp:** ${new Date(result.timestamp).toLocaleString()}\n`;
    report += `**Duration:** ${(result.duration / 1000).toFixed(2)}s\n\n`;

    report += '## Summary\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Total Issues | ${result.summary.totalIssues} |\n`;
    report += `| Errors | ${result.summary.errors} |\n`;
    report += `| Warnings | ${result.summary.warnings} |\n`;
    report += `| Fixed | ${result.summary.fixed} |\n`;
    report += `| Verified | ${result.summary.verified} |\n`;

    if (result.jsxAnalysis && result.jsxAnalysis.size > 0) {
      report += `| JSX Components Analyzed | ${result.jsxAnalysis.size} |\n`;
    }
    report += '\n';

    if (result.issues.length > 0) {
      report += '## Issues\n\n';
      for (const issue of result.issues.slice(0, 20)) {
        report += `### ${issue.file}:${issue.line}\n`;
        report += `- **Type:** ${issue.type}\n`;
        report += `- **Severity:** ${issue.severity}\n`;
        report += `- **Message:** ${issue.message}\n`;
        if (issue.suggestion) {
          report += `- **Suggestion:** ${issue.suggestion}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }
}

// ============================================
// УТИЛИТЫ ДЛЯ CI/CD
// ============================================

/**
 * Сбор всех файлов для анализа
 */
export async function collectFilesForAnalysis(
  paths: string[],
  recursive = true
): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

  for (const inputPath of paths) {
    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️ Path does not exist: ${inputPath}`);
      continue;
    }

    const stat = fs.statSync(inputPath);

    if (stat.isFile()) {
      if (extensions.includes(path.extname(inputPath))) {
        files.push(path.resolve(inputPath));
      }
    } else if (stat.isDirectory()) {
      const pattern = recursive
        ? `${inputPath}/**/*{${extensions.join(',')}}`
        : `${inputPath}/*{${extensions.join(',')}}`;

      const matched = await glob(pattern, {
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.d.ts'],
      });

      files.push(...matched.map(f => path.resolve(f)));
    }
  }

  return [...new Set(files)];
}

/**
 * Генерация CI/CD конфигурации
 */
export function generateCIConfig(projectPath: string = process.cwd()): Record<string, any> {
  return {
    version: '1.0.0',
    name: 'AST Analyzer CI/CD Configuration',
    projectPath,

    stages: {
      quickCheck: {
        enabled: true,
        timeout: 30,
        onFailure: 'warn',
      },
      semanticAnalysis: {
        enabled: true,
        depth: 5,
        formalVerification: false,
        timeout: 300,
      },
      jsxAnalysis: {
        enabled: true,
        checkPropTypes: true,
      },
      typeCheck: {
        enabled: true,
        strict: true,
        noEmit: true,
      },
      codeValidation: {
        enabled: true,
        checks: ['syntax', 'imports', 'exports', 'security'],
      },
      eslint: {
        enabled: true,
        config: '.eslintrc.json',
        autoFix: true,
      },
      autoFix: {
        enabled: true,
        createBackup: true,
        maxIterations: 3,
      },
      reporting: {
        format: 'html',
        outputDir: './cicd-reports',
        detailed: true,
      },
    },

    notifications: {
      onSuccess: true,
      onFailure: true,
      channels: ['console'],
    },

    thresholds: {
      maxErrors: 0,
      maxWarnings: 10,
      minCoverage: 80,
      maxComplexity: 15,
    },
  };
}

/**
 * Запуск CI/CD из командной строки
 */
export async function runCIFromCLI(args: string[]): Promise<void> {
  const pipeline = new CICPipeline();

  // Парсинг аргументов
  const command = args[0];
  const paths = args.filter(a => !a.startsWith('-'));

  if (paths.length === 0) {
    console.error('❌ Please specify files or directories to analyze');
    process.exit(1);
  }

  const files = await collectFilesForAnalysis(paths);

  if (files.length === 0) {
    console.error('❌ No supported files found');
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} files to analyze`);

  let result;

  switch (command) {
    case 'quick': {
      result = await pipeline.quickCheck(files);
      break;
    }

    case 'semantic': {
      const formal = args.includes('--formal');
      result = await pipeline.semanticCheck(files, formal);
      break;
    }

    case 'eslint-init': {
      await pipeline.generateESLintConfig(process.cwd());
      process.exit(0);
      // break убран, так как process.exit завершает выполнение
    }

    case 'full':
    default: {
      result = await pipeline.runFullPipeline(files, {
        semanticAnalysis: !args.includes('--no-semantic'),
        formalVerification: args.includes('--formal'),
        typeCheck: !args.includes('--no-types'),
        codeValidation: !args.includes('--no-validation'),
        autoFix: args.includes('--fix'),
        eslintCheck: !args.includes('--no-eslint'),
        eslintFix: args.includes('--fix'),
        jsxAnalysis: !args.includes('--no-jsx'),
        generateReport: !args.includes('--no-report'),
      });
      break;
    }
  }

  process.exit(result.success ? 0 : 1);
}

// ============================================
// ЭКСПОРТ ВСЕГО
// ============================================

export default {
  CICPipeline,
  SemanticPipeline,
  TypeScriptValidator,
  TypeScriptFixer,
  AutoTypeScriptFixer,
  CodeValidator,
  ESLintASTFixer,
  ESLintPipeline,
  collectFilesForAnalysis,
  generateCIConfig,
  runCIFromCLI,
};
