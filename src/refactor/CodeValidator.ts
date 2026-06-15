// Directory/ast-analyzer/src/refactor/CodeValidator.ts
import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  severity: number; // 1-10, где 10 - критично
  file: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  suggestion?: string;
  autoFixable: boolean;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    autoFixable: number;
  };
  timestamp: string;
}

export class CodeValidator {
  private project: Project;
  private issues: ValidationIssue[] = [];

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
      },
      useInMemoryFileSystem: false,
    });
  }

  /**
   * Полная проверка всех файлов
   */
  async validateFiles(filePaths: string[]): Promise<ValidationResult> {
    this.issues = [];
    const startTime = Date.now();

    console.log('\n🔍 ЗАПУСК ПОЛНОЙ ПРОВЕРКИ КОДА');
    console.log('='.repeat(60));

    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        await this.validateFile(filePath);
      } else {
        this.addIssue({
          type: 'error',
          severity: 10,
          file: filePath,
          message: 'Файл не существует',
          autoFixable: false,
        });
      }
    }

    const summary = this.generateSummary();
    const timestamp = new Date().toISOString();

    console.log('\n📊 ИТОГИ ПРОВЕРКИ:');
    console.log(`   ❌ Ошибок: ${summary.errors}`);
    console.log(`   ⚠️  Предупреждений: ${summary.warnings}`);
    console.log(`   ℹ️  Замечаний: ${summary.info}`);
    console.log(`   🔧 Автоисправимых: ${summary.autoFixable}`);
    console.log(`   ⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

    return { issues: this.issues, summary, timestamp };
  }

  /**
   * Проверка одного файла
   */
  private async validateFile(filePath: string): Promise<void> {
    console.log(`\n📄 Проверка: ${path.basename(filePath)}`);

    // Загружаем файл в проект
    const sourceFile = this.project.addSourceFileAtPathIfExists(filePath);
    if (!sourceFile) {
      this.addIssue({
        type: 'error',
        severity: 10,
        file: filePath,
        message: 'Не удалось загрузить файл',
        autoFixable: false,
      });
      return;
    }

    // 1. Проверка синтаксиса
    await this.validateSyntax(sourceFile);

    // 2. Проверка импортов
    await this.validateImports(sourceFile);

    // 3. Проверка экспортов
    await this.validateExports(sourceFile);

    // 4. Проверка неиспользуемых переменных
    await this.validateUnusedVariables(sourceFile);

    // 5. Проверка циклических зависимостей
    await this.validateCircularDeps(sourceFile);

    // 6. Проверка типов (для TS)
    if (filePath.endsWith('.ts')) {
      await this.validateTypes(sourceFile);
    }

    // 7. Проверка консистентности именования
    await this.validateNaming(sourceFile);

    // 8. Проверка безопасности
    await this.validateSecurity(sourceFile);

    // 9. Проверка производительности
    await this.validatePerformance(sourceFile);
  }

  /**
   * Проверка синтаксиса
   */
  private async validateSyntax(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const content = sourceFile.getText();

    try {
      // Проверка через Node.js
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        new Function(content); // Базовая проверка
      }
    } catch (error: any) {
      const match = error.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      const lines = content.substring(0, position).split('\n');

      this.addIssue({
        type: 'error',
        severity: 10,
        file: filePath,
        line: lines.length,
        message: `Синтаксическая ошибка: ${error.message}`,
        autoFixable: false,
      });
    }

    // Проверка незакрытых скобок
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      this.addIssue({
        type: 'error',
        severity: 8,
        file: filePath,
        message: `Незакрытые фигурные скобки: { ${openBraces} vs } ${closeBraces}`,
        autoFixable: true,
        suggestion: `Добавьте ${openBraces - closeBraces} закрывающих скобок`,
      });
    }

    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      this.addIssue({
        type: 'error',
        severity: 8,
        file: filePath,
        message: `Незакрытые круглые скобки: ( ${openParens} vs ) ${closeParens}`,
        autoFixable: true,
      });
    }

    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      this.addIssue({
        type: 'error',
        severity: 8,
        file: filePath,
        message: `Незакрытые квадратные скобки: [ ${openBrackets} vs ] ${closeBrackets}`,
        autoFixable: true,
      });
    }
  }

  /**
   * Проверка импортов
   */
  private async validateImports(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const imports = sourceFile.getImportDeclarations();
    const content = sourceFile.getText();
    const fileDir = path.dirname(filePath);

    for (const imp of imports) {
      const moduleSpec = imp.getModuleSpecifier().getLiteralValue();
      const namedImports = imp.getNamedImports();
      const defaultImport = imp.getDefaultImport();

      // Проверка существования модуля
      let resolvedPath: string | undefined;
      if (moduleSpec.startsWith('.')) {
        const possiblePaths = [
          path.resolve(fileDir, moduleSpec),
          path.resolve(fileDir, `${moduleSpec}.js`),
          path.resolve(fileDir, `${moduleSpec}.ts`),
          path.resolve(fileDir, `${moduleSpec}.mjs`),
          path.resolve(fileDir, `${moduleSpec}.cjs`),
          path.resolve(fileDir, `${moduleSpec}/index.js`),
          path.resolve(fileDir, `${moduleSpec}/index.ts`),
        ];

        resolvedPath = possiblePaths.find(p => fs.existsSync(p));

        if (!resolvedPath) {
          this.addIssue({
            type: 'error',
            severity: 9,
            file: filePath,
            message: `Импорт не разрешён: '${moduleSpec}'`,
            autoFixable: false,
            suggestion: `Проверьте путь или создайте файл ${moduleSpec}`,
          });
          continue;
        }
      }

      // Проверка существования импортируемых сущностей
      for (const named of namedImports) {
        const importName = named.getName();
        const alias = named.getAliasNode()?.getText();

        // Проверяем, используется ли импорт
        const usagePattern = new RegExp(`\\b${alias || importName}\\b`, 'g');
        const matches = content.match(usagePattern);
        const usageCount = matches ? matches.length - 1 : 0; // минус сам импорт

        if (usageCount === 0 && !content.includes(`typeof ${importName}`)) {
          this.addIssue({
            type: 'warning',
            severity: 5,
            file: filePath,
            line: named.getStartLineNumber(),
            message: `Неиспользуемый импорт: '${importName}'`,
            autoFixable: true,
            suggestion: `Удалите '${importName}' из импорта`,
            code: importName,
          });
        }

        // Проверяем, экспортируется ли сущность из модуля
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          const targetContent = fs.readFileSync(resolvedPath, 'utf-8');
          const exportPattern = new RegExp(
            `^export\\s+(?:const|let|var|function|class)\\s+${importName}\\b|export\\s*{[^}]*\\b${importName}\\b[^}]*}`,
            'gm'
          );
          const defaultExportPattern = new RegExp(`export\\s+default\\s+${importName}\\b`);

          if (!exportPattern.test(targetContent) && !defaultExportPattern.test(targetContent)) {
            this.addIssue({
              type: 'error',
              severity: 8,
              file: filePath,
              line: named.getStartLineNumber(),
              message: `Импорт '${importName}' не экспортируется из '${moduleSpec}'`,
              autoFixable: false,
              suggestion: `Проверьте, что '${importName}' экспортируется в ${moduleSpec}`,
            });
          }
        }
      }

      // Проверка default импорта
      if (defaultImport) {
        const defaultName = defaultImport.getText();
        const usagePattern = new RegExp(`\\b${defaultName}\\b`, 'g');
        const matches = content.match(usagePattern);
        const usageCount = matches ? matches.length - 1 : 0;

        if (usageCount === 0) {
          this.addIssue({
            type: 'warning',
            severity: 5,
            file: filePath,
            line: defaultImport.getStartLineNumber(),
            message: `Неиспользуемый default импорт: '${defaultName}'`,
            autoFixable: true,
            suggestion: `Удалите импорт '${defaultName}'`,
          });
        }
      }
    }
  }

  /**
   * Проверка экспортов
   */
  private async validateExports(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const exports = sourceFile.getExportedDeclarations();
    const content = sourceFile.getText();

    for (const [exportName, declarations] of exports) {
      // Проверка, что экспортируемая сущность существует
      const declaration = declarations[0];
      if (!declaration) {
        this.addIssue({
          type: 'error',
          severity: 9,
          file: filePath,
          message: `Экспорт '${exportName}' не найден в файле`,
          autoFixable: false,
        });
        continue;
      }

      // Проверка дублирования экспортов
      const exportMatches = [
        ...content.matchAll(
          new RegExp(
            `export\\s+(?:const|let|var|function|class)\\s+${exportName}\\b|export\\s*{[^}]*\\b${exportName}\\b[^}]*}`,
            'g'
          )
        ),
      ];
      if (exportMatches.length > 1) {
        this.addIssue({
          type: 'warning',
          severity: 4,
          file: filePath,
          message: `Дублирование экспорта: '${exportName}' экспортируется несколько раз`,
          autoFixable: true,
          suggestion: `Оставьте только один экспорт '${exportName}'`,
        });
      }

      // Проверка JSDoc для публичных API
      const jsDocs = declaration.getJsDocs();
      if (jsDocs.length === 0 && !exportName.startsWith('_')) {
        this.addIssue({
          type: 'info',
          severity: 2,
          file: filePath,
          line: declaration.getStartLineNumber(),
          message: `Отсутствует JSDoc для экспорта '${exportName}'`,
          autoFixable: true,
          suggestion: 'Добавьте комментарий /** ... */ перед экспортом',
        });
      }
    }

    // Проверка на export default
    const defaultExport = sourceFile.getDefaultExportSymbol();
    if (!defaultExport && sourceFile.getText().includes('export default')) {
      this.addIssue({
        type: 'warning',
        severity: 6,
        file: filePath,
        message: 'Export default объявлен, но символ не найден',
        autoFixable: false,
        suggestion: 'Проверьте правильность export default declaration',
      });
    }
  }

  /**
   * Проверка неиспользуемых переменных
   */
  private async validateUnusedVariables(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const content = sourceFile.getText();

    // Находим все объявления переменных
    const varStatements = sourceFile.getVariableStatements();

    for (const stmt of varStatements) {
      const declarations = stmt.getDeclarations();

      for (const decl of declarations) {
        const varName = decl.getName();

        // Пропускаем экспортируемые переменные
        if (decl.isExported()) continue;

        // Ищем использование
        const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
        const matches = content.match(usagePattern);
        const usageCount = matches ? matches.length - 1 : 0; // минус объявление

        if (usageCount === 0 && !varName.startsWith('_')) {
          this.addIssue({
            type: 'warning',
            severity: 4,
            file: filePath,
            line: decl.getStartLineNumber(),
            message: `Неиспользуемая переменная: '${varName}'`,
            autoFixable: true,
            suggestion: 'Удалите переменную или используйте её',
            code: varName,
          });
        }
      }
    }

    // Проверка неиспользуемых функций
    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const funcName = func.getName();

      if (!funcName) continue;
      if (func.isExported()) continue;
      if (funcName.startsWith('_')) continue;

      const usagePattern = new RegExp(`\\b${funcName}\\b`, 'g');
      const matches = content.match(usagePattern);
      const usageCount = matches ? matches.length - 1 : 0;

      if (usageCount === 0) {
        this.addIssue({
          type: 'warning',
          severity: 4,
          file: filePath,
          line: func.getStartLineNumber(),
          message: `Неиспользуемая функция: '${funcName}'`,
          autoFixable: true,
          suggestion: 'Удалите функцию или используйте её',
        });
      }
    }

    // Проверка параметров функции
    for (const func of functions) {
      const parameters = func.getParameters();
      const body = func.getBody()?.getText() || '';

      for (const param of parameters) {
        const paramName = param.getName();
        if (!paramName.startsWith('_') && !body.includes(paramName)) {
          this.addIssue({
            type: 'warning',
            severity: 3,
            file: filePath,
            line: param.getStartLineNumber(),
            message: `Неиспользуемый параметр: '${paramName}' в функции ${func.getName() || 'anonymous'}`,
            autoFixable: true,
            suggestion: "Удалите параметр или используйте его, или добавьте префикс '_'",
          });
        }
      }
    }
  }

  /**
   * Проверка циклических зависимостей
   */
  private async validateCircularDeps(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const imports = sourceFile.getImportDeclarations();
    const fileDir = path.dirname(filePath);

    const dependencies: string[] = [];

    for (const imp of imports) {
      const moduleSpec = imp.getModuleSpecifier().getLiteralValue();
      if (moduleSpec.startsWith('.')) {
        const possiblePaths = [
          path.resolve(fileDir, moduleSpec),
          path.resolve(fileDir, `${moduleSpec}.js`),
          path.resolve(fileDir, `${moduleSpec}.ts`),
        ];
        const resolvedPath = possiblePaths.find(p => fs.existsSync(p));
        if (resolvedPath) {
          dependencies.push(resolvedPath);
        }
      }
    }

    // Проверка на A → B → A
    for (const dep of dependencies) {
      if (fs.existsSync(dep)) {
        const depContent = fs.readFileSync(dep, 'utf-8');
        const baseName = path.basename(filePath).replace(/\.(ts|js|mjs|cjs)$/, '');
        const backImportPattern = new RegExp(`import.*from\\s+['"](\\.\\.?/)*${baseName}['"]`);

        if (backImportPattern.test(depContent)) {
          this.addIssue({
            type: 'error',
            severity: 9,
            file: filePath,
            message: `Циклическая зависимость: ${path.basename(filePath)} ⇄ ${path.basename(dep)}`,
            autoFixable: false,
            suggestion: 'Реструктурируйте зависимости, вынесите общий код в отдельный модуль',
          });
        }
      }
    }
  }

  /**
   * Проверка типов TypeScript
   */
  private async validateTypes(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const diagnostics = sourceFile.getPreEmitDiagnostics();

    for (const diagnostic of diagnostics) {
      const messageText = diagnostic.getMessageText();
      const message = typeof messageText === 'string' ? messageText : messageText.getMessageText();
      const line = diagnostic.getLineNumber();

      if (message) {
        const isAutoFixable =
          message.includes('not assignable') ||
          message.includes('does not exist') ||
          message.includes('is not assignable');

        this.addIssue({
          type: 'error',
          severity: 7,
          file: filePath,
          line: line,
          message: `TypeScript: ${message}`,
          autoFixable: isAutoFixable,
          suggestion: isAutoFixable ? 'Проверьте типы данных' : undefined,
        });
      }
    }

    // Проверка any的使用
    const content = sourceFile.getText();
    const anyMatches = content.match(/: any/g);
    if (anyMatches && anyMatches.length > 3) {
      this.addIssue({
        type: 'warning',
        severity: 4,
        file: filePath,
        message: `Обнаружено ${anyMatches.length} использований типа 'any'`,
        autoFixable: false,
        suggestion: 'Замените any на конкретные типы',
      });
    }
  }

  /**
   * Проверка консистентности именования
   */
  private async validateNaming(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();

    // Проверка имен функций и переменных
    const functions = sourceFile.getFunctions();

    for (const func of functions) {
      const funcName = func.getName();
      if (!funcName) continue;

      // Константы должны быть в UPPER_CASE
      if (funcName === funcName.toUpperCase() && funcName.length > 2 && !funcName.includes('_')) {
        this.addIssue({
          type: 'info',
          severity: 2,
          file: filePath,
          line: func.getStartLineNumber(),
          message: `Имя '${funcName}' выглядит как константа, но это функция`,
          autoFixable: false,
          suggestion: `Используйте camelCase для функций: ${funcName.toLowerCase()}`,
        });
      }

      // Проверка длины имени
      if (funcName.length > 40) {
        this.addIssue({
          type: 'warning',
          severity: 3,
          file: filePath,
          line: func.getStartLineNumber(),
          message: `Слишком длинное имя функции: ${funcName.length} символов`,
          autoFixable: false,
          suggestion: 'Сократите имя функции для лучшей читаемости',
        });
      }

      // Проверка на булевый префикс
      if (funcName.startsWith('get') && func.getReturnType().getText() === 'boolean') {
        this.addIssue({
          type: 'info',
          severity: 2,
          file: filePath,
          line: func.getStartLineNumber(),
          message: "Функция возвращает boolean, но начинается с 'get'",
          autoFixable: false,
          suggestion: `Используйте префикс 'is' или 'has': is${funcName.slice(3)}`,
        });
      }
    }

    // Проверка имен переменных
    const variables = sourceFile.getVariableDeclarations();
    for (const variable of variables) {
      const varName = variable.getName();

      // Проверка на слишком общие имена
      const commonNames = [
        'data',
        'temp',
        'tmp',
        'val',
        'value',
        'obj',
        'obj1',
        'obj2',
        'x',
        'y',
        'i',
        'j',
        'k',
      ];
      if (commonNames.includes(varName) && !variable.isExported()) {
        this.addIssue({
          type: 'info',
          severity: 2,
          file: filePath,
          line: variable.getStartLineNumber(),
          message: `Слишком общее имя переменной: '${varName}'`,
          autoFixable: false,
          suggestion: 'Используйте более описательное имя',
        });
      }
    }
  }

  /**
   * Проверка безопасности
   */
  private async validateSecurity(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const content = sourceFile.getText();

    // Проверка eval
    if (content.includes('eval(')) {
      this.addIssue({
        type: 'error',
        severity: 9,
        file: filePath,
        message: 'Использование eval() запрещено из соображений безопасности',
        autoFixable: false,
        suggestion: 'Найдите альтернативный способ решения',
      });
    }

    // Проверка exec
    if (content.includes("exec('") || content.includes('exec(`')) {
      this.addIssue({
        type: 'warning',
        severity: 7,
        file: filePath,
        message: 'Использование exec() может быть опасным',
        autoFixable: false,
        suggestion: 'Используйте execFile или spawn с проверкой аргументов',
      });
    }

    // Проверка console.log в продакшене
    if (content.includes('console.log') && process.env.NODE_ENV === 'production') {
      const logMatches = content.match(/console\.log/g);
      if (logMatches && logMatches.length > 0) {
        this.addIssue({
          type: 'warning',
          severity: 5,
          file: filePath,
          message: `Обнаружено ${logMatches.length} вызовов console.log`,
          autoFixable: false,
          suggestion: 'Удалите или замените на логгер с уровнем debug',
        });
      }
    }

    // Проверка敏感信息
    const sensitivePatterns = [
      { pattern: /password\s*=\s*['"][^'"]+['"]/i, name: 'password' },
      { pattern: /secret\s*=\s*['"][^'"]+['"]/i, name: 'secret' },
      { pattern: /token\s*=\s*['"][^'"]+['"]/i, name: 'token' },
      { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i, name: 'API key' },
    ];

    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(content)) {
        this.addIssue({
          type: 'warning',
          severity: 8,
          file: filePath,
          message: `Обнаружена возможная утечка ${name} в коде`,
          autoFixable: false,
          suggestion: 'Используйте переменные окружения (.env)',
        });
      }
    }
  }

  /**
   * Проверка производительности
   */
  private async validatePerformance(sourceFile: any): Promise<void> {
    const filePath = sourceFile.getFilePath();
    const content = sourceFile.getText();
    const lines = content.split('\n');

    // Проверка больших файлов
    if (lines.length > 1000) {
      this.addIssue({
        type: 'warning',
        severity: 4,
        file: filePath,
        message: `Файл слишком большой: ${lines.length} строк`,
        autoFixable: false,
        suggestion: 'Разбейте файл на несколько модулей',
      });
    }

    // Проверка вложенных циклов
    let nestedLoops = 0;
    for (let i = 0; i < lines.length - 2; i++) {
      if (
        (lines[i].includes('for') || lines[i].includes('while')) &&
        (lines[i + 1].includes('for') || lines[i + 1].includes('while'))
      ) {
        nestedLoops++;
      }
    }

    if (nestedLoops > 0) {
      this.addIssue({
        type: 'warning',
        severity: 6,
        file: filePath,
        message: `Обнаружено ${nestedLoops} вложенных циклов`,
        autoFixable: false,
        suggestion: 'Вложенные циклы могут быть медленными, рассмотрите оптимизацию',
      });
    }

    // Проверка рекурсии
    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const funcName = func.getName();
      if (funcName && content.includes(`${funcName}(`) && content.includes(`return ${funcName}(`)) {
        this.addIssue({
          type: 'info',
          severity: 3,
          file: filePath,
          line: func.getStartLineNumber(),
          message: `Обнаружена рекурсивная функция: ${funcName}`,
          autoFixable: false,
          suggestion: 'Убедитесь, что есть условие выхода из рекурсии',
        });
      }
    }
  }

  /**
   * Добавление проблемы
   */
  private addIssue(issue: Omit<ValidationIssue, 'autoFixable'> & { autoFixable?: boolean }): void {
    this.issues.push({
      ...issue,
      autoFixable: issue.autoFixable !== undefined ? issue.autoFixable : false,
    });
  }

  /**
   * Генерация сводки
   */
  private generateSummary(): ValidationResult['summary'] {
    const errors = this.issues.filter(i => i.type === 'error').length;
    const warnings = this.issues.filter(i => i.type === 'warning').length;
    const info = this.issues.filter(i => i.type === 'info').length;
    const autoFixable = this.issues.filter(i => i.autoFixable).length;

    return { errors, warnings, info, autoFixable };
  }

  /**
   * Сохранение отчёта
   */
  async saveReport(result: ValidationResult, outputPath: string): Promise<void> {
    const report = this.generateMarkdownReport(result);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(outputPath, report, 'utf-8');
    console.log(`\n📄 Отчёт сохранён: ${outputPath}`);
  }

  /**
   * Сохранение JSON отчёта
   */
  async saveJSONReport(result: ValidationResult, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n📄 JSON отчёт сохранён: ${outputPath}`);
  }

  /**
   * Генерация Markdown отчёта
   */
  private generateMarkdownReport(result: ValidationResult): string {
    let report = '# 🔍 Отчёт проверки кода\n\n';
    report += `**Дата:** ${new Date(result.timestamp).toLocaleString()}\n\n`;

    report += '## 📊 Сводка\n\n';
    report += '| Тип | Количество |\n';
    report += '|-----|------------|\n';
    report += `| ❌ Ошибки | ${result.summary.errors} |\n`;
    report += `| ⚠️ Предупреждения | ${result.summary.warnings} |\n`;
    report += `| ℹ️ Замечания | ${result.summary.info} |\n`;
    report += `| 🔧 Автоисправимые | ${result.summary.autoFixable} |\n\n`;

    // Группировка по severity
    report += '## 🎯 По приоритету\n\n';
    const critical = result.issues.filter(i => i.severity >= 8);
    const high = result.issues.filter(i => i.severity >= 6 && i.severity < 8);
    const medium = result.issues.filter(i => i.severity >= 4 && i.severity < 6);
    const low = result.issues.filter(i => i.severity < 4);

    if (critical.length > 0) {
      report += `### 🔴 Критические (${critical.length})\n\n`;
      for (const issue of critical) {
        report += `- **${path.basename(issue.file)}**: ${issue.message}\n`;
        if (issue.suggestion) report += `  - 💡 ${issue.suggestion}\n`;
      }
      report += '\n';
    }

    if (high.length > 0) {
      report += `### 🟠 Высокий приоритет (${high.length})\n\n`;
      for (const issue of high) {
        report += `- **${path.basename(issue.file)}**: ${issue.message}\n`;
        if (issue.suggestion) report += `  - 💡 ${issue.suggestion}\n`;
      }
      report += '\n';
    }

    if (medium.length > 0) {
      report += `### 🟡 Средний приоритет (${medium.length})\n\n`;
      for (const issue of medium) {
        report += `- **${path.basename(issue.file)}**: ${issue.message}\n`;
      }
      report += '\n';
    }

    if (low.length > 0) {
      report += `### 🟢 Низкий приоритет (${low.length})\n\n`;
      for (const issue of low) {
        report += `- **${path.basename(issue.file)}**: ${issue.message}\n`;
      }
      report += '\n';
    }

    // Группировка по файлам
    report += '## 📁 Проблемы по файлам\n\n';
    const byFile = new Map<string, ValidationIssue[]>();
    for (const issue of result.issues) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, []);
      }
      byFile.get(issue.file)!.push(issue);
    }

    for (const [file, issues] of byFile) {
      report += `### 📄 ${path.basename(file)}\n\n`;
      report += `**Путь:** \`${file}\`\n\n`;
      report += '| Тип | Строка | Severity | Сообщение | Автофикс |\n';
      report += '|-----|--------|----------|-----------|----------|\n';

      for (const issue of issues) {
        const typeIcon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        const lineInfo = issue.line ? `${issue.line}` : '-';
        const severityStr = '★'.repeat(Math.ceil(issue.severity / 2));
        const autoFix = issue.autoFixable ? '✅' : '❌';
        report += `| ${typeIcon} | ${lineInfo} | ${severityStr} | ${issue.message} | ${autoFix} |\n`;
      }
      report += '\n';
    }

    // Рекомендации
    report += '## 💡 Рекомендации\n\n';
    if (result.summary.autoFixable > 0) {
      report += `1. Запустите \`npm run fix\` для автоматического исправления ${result.summary.autoFixable} проблем\n`;
    }
    if (result.summary.errors > 0) {
      report += '2. Исправьте критические ошибки вручную\n';
    }
    report += '3. Запустите повторную проверку после исправлений\n\n';

    report += '---\n';
    report += `*Сгенерировано AST Validator* | ${new Date().toLocaleString()}\n`;

    return report;
  }
}
