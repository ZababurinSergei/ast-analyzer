// src/refactor/ModuleTypeDetector.ts
import fs from 'fs';
import path from 'path';
import { type Logger } from '../utils/Logger.js';

export type ModuleType = 'esm' | 'cjs' | 'auto';

export interface ModuleTypeDetectionResult {
  type: ModuleType;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  packageJsonType?: 'module' | 'commonjs' | undefined;
  fileExtension: string;
  hasImportExport: boolean;
  hasRequire: boolean;
}

export class ModuleTypeDetector {
  private logger: Logger;
  private cache: Map<string, ModuleTypeDetectionResult> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Детектирует тип модуля с максимальной точностью
   */
  async detect(filePath: string): Promise<ModuleTypeDetectionResult> {
    // Проверяем кэш
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    // ✅ Добавляем проверку доступа к файлу
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (error) {
      // Если нет прав на чтение, возвращаем результат по умолчанию
      const ext = path.extname(filePath);
      const result: ModuleTypeDetectionResult = {
        type: 'auto',
        confidence: 'low',
        evidence: ['No read access, using default'],
        packageJsonType: undefined,
        fileExtension: ext,
        hasImportExport: false,
        hasRequire: false,
      };
      this.cache.set(filePath, result);
      this.logger.debug('Module type detection: no read access, using default', { filePath });
      return result;
    }

    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      // Если не удалось прочитать файл, возвращаем результат по умолчанию
      const ext = path.extname(filePath);
      const result: ModuleTypeDetectionResult = {
        type: 'auto',
        confidence: 'low',
        evidence: ['Cannot read file, using default'],
        packageJsonType: undefined,
        fileExtension: ext,
        hasImportExport: false,
        hasRequire: false,
      };
      this.cache.set(filePath, result);
      this.logger.debug('Module type detection: cannot read file, using default', {
        filePath,
        error,
      });
      return result;
    }

    const ext = path.extname(filePath);
    const dir = path.dirname(filePath);

    const evidence: string[] = [];
    let hasImportExport = false;
    let hasRequire = false;
    let packageJsonType: 'module' | 'commonjs' | undefined = undefined;

    // 1. Проверка расширения файла
    if (ext === '.mjs') {
      evidence.push('File extension .mjs (ES Module)');
      const result: ModuleTypeDetectionResult = {
        type: 'esm',
        confidence: 'high',
        evidence,
        packageJsonType,
        fileExtension: ext,
        hasImportExport: true,
        hasRequire: false,
      };
      this.cache.set(filePath, result);
      return result;
    }

    if (ext === '.cjs') {
      evidence.push('File extension .cjs (CommonJS)');
      const result: ModuleTypeDetectionResult = {
        type: 'cjs',
        confidence: 'high',
        evidence,
        packageJsonType,
        fileExtension: ext,
        hasImportExport: false,
        hasRequire: true,
      };
      this.cache.set(filePath, result);
      return result;
    }

    // 2. Проверка содержимого
    // Ищем import/export statements (включая динамический импорт)
    const importExportRegex = /^\s*(?:import\s+|export\s+)/m;
    hasImportExport = importExportRegex.test(content);

    // Ищем require
    const requireRegex = /\brequire\s*\(/m;
    hasRequire = requireRegex.test(content);

    // Ищем module.exports / exports
    const moduleExportsRegex = /\b(?:module\.exports|exports\.)\s*=/m;
    const hasModuleExports = moduleExportsRegex.test(content);

    if (hasImportExport) {
      evidence.push('Contains import/export statements');
    }

    if (hasRequire) {
      evidence.push('Contains require() calls');
    }

    if (hasModuleExports) {
      evidence.push('Contains module.exports or exports assignments');
    }

    // 3. Проверка package.json
    const packageJson = await this.findPackageJson(dir);
    if (packageJson) {
      packageJsonType = packageJson.type === 'module' ? 'module' : 'commonjs';
      evidence.push(`package.json type: ${packageJsonType}`);
    }

    // 4. Принимаем решение
    let type: ModuleType = 'auto';
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    if (hasImportExport && !hasRequire && !hasModuleExports) {
      type = 'esm';
      confidence = 'high';
      evidence.push('Only import/export found, no require');
    } else if (!hasImportExport && (hasRequire || hasModuleExports)) {
      type = 'cjs';
      confidence = 'high';
      evidence.push('Only require/module.exports found, no import/export');
    } else if (hasImportExport && (hasRequire || hasModuleExports)) {
      // Смешанный - нужно определить доминирующий
      const importCount = (content.match(/\bimport\b/g) || []).length;
      const exportCount = (content.match(/\bexport\b/g) || []).length;
      const requireCount = (content.match(/\brequire\b/g) || []).length;

      if (importCount + exportCount > requireCount) {
        type = 'esm';
        evidence.push(
          `More import/export (${importCount + exportCount}) than require (${requireCount})`
        );
      } else {
        type = 'cjs';
        evidence.push(
          `More require (${requireCount}) than import/export (${importCount + exportCount})`
        );
      }
      confidence = 'medium';
    } else if (packageJsonType === 'module') {
      type = 'esm';
      confidence = 'high';
      evidence.push('package.json type: module');
    } else if (packageJsonType === 'commonjs') {
      type = 'cjs';
      confidence = 'high';
      evidence.push('package.json type: commonjs');
    } else {
      // По умолчанию определяем по расширению
      if (['.ts', '.tsx', '.jsx'].includes(ext)) {
        type = 'esm';
        confidence = 'medium';
        evidence.push('TypeScript/JSX file - defaulting to ESM');
      } else if (ext === '.js') {
        // Для .js проверяем наличие "type": "module" в package.json выше
        if (packageJsonType === 'module') {
          type = 'esm';
          confidence = 'high';
        } else {
          type = 'cjs';
          confidence = 'medium';
          evidence.push('Defaulting to CommonJS for .js file');
        }
      } else {
        type = 'cjs';
        confidence = 'low';
        evidence.push('Unknown file type - defaulting to CommonJS');
      }
    }

    const result: ModuleTypeDetectionResult = {
      type,
      confidence,
      evidence,
      packageJsonType,
      fileExtension: ext,
      hasImportExport,
      hasRequire: hasRequire || hasModuleExports,
    };

    this.cache.set(filePath, result);
    this.logger.debug('Module type detected', {
      filePath,
      type,
      confidence,
      evidence: evidence.join('; '),
    });

    return result;
  }

  /**
   * Поиск package.json вверх по иерархии
   */
  private async findPackageJson(dir: string): Promise<{ type?: 'module' | 'commonjs' } | null> {
    let currentDir = dir;
    const maxDepth = 10;
    let depth = 0;

    while (depth < maxDepth) {
      const packagePath = path.join(currentDir, 'package.json');
      try {
        if (fs.existsSync(packagePath)) {
          const content = await fs.promises.readFile(packagePath, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed.type) {
            return { type: parsed.type };
          }
          return { type: undefined };
        }
      } catch (error) {
        // Игнорируем
      }

      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
      depth++;
    }

    return null;
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Получить расширение файла для модуля
   * Улучшено: учитывает исходный файл
   */
  getExtension(type: ModuleType, sourceFilePath?: string): string {
    // Если исходный файл TypeScript, используем .ts
    if (sourceFilePath) {
      if (sourceFilePath.endsWith('.ts') || sourceFilePath.endsWith('.tsx')) {
        return '.ts';
      }
      if (sourceFilePath.endsWith('.mts')) {
        return '.mts';
      }
      if (sourceFilePath.endsWith('.cts')) {
        return '.cts';
      }
    }

    // Иначе используем стандартное расширение
    return type === 'esm' ? '.mjs' : '.js';
  }

  /**
   * Получить правильный синтаксис импорта
   */
  getImportSyntax(type: ModuleType): 'import' | 'require' {
    return type === 'esm' ? 'import' : 'require';
  }

  /**
   * Получить правильный синтаксис экспорта
   */
  getExportSyntax(type: ModuleType): 'export' | 'module.exports' {
    return type === 'esm' ? 'export' : 'module.exports';
  }

  /**
   * Сгенерировать правильный импорт
   */
  generateImport(type: ModuleType, imports: string[], from: string): string {
    if (type === 'esm') {
      return `import { ${imports.join(', ')} } from '${from}';\n`;
    } else {
      return `const { ${imports.join(', ')} } = require('${from}');\n`;
    }
  }

  /**
   * Сгенерировать правильный экспорт
   */
  generateExport(type: ModuleType, exports: string[]): string {
    if (type === 'esm') {
      return `export { ${exports.join(', ')} };\n`;
    } else {
      return `module.exports = { ${exports.join(', ')} };\n`;
    }
  }

  /**
   * Сгенерировать правильный реэкспорт
   */
  generateReExport(type: ModuleType, exports: string[], from: string): string {
    if (type === 'esm') {
      return `export { ${exports.join(', ')} } from '${from}';\n`;
    } else {
      return `Object.assign(exports, require('${from}'));\n`;
    }
  }

  /**
   * Определяет правильное расширение для модуля на основе содержимого и исходного файла
   * НОВЫЙ МЕТОД
   */
  getModuleExtension(content: string, sourceFilePath: string): string {
    // 1. Если исходный файл TypeScript, используем .ts
    if (sourceFilePath.endsWith('.ts') || sourceFilePath.endsWith('.tsx')) {
      return '.ts';
    }

    // 2. Если есть TypeScript синтаксис, используем .ts
    if (this.hasTypeScriptSyntax(content)) {
      return '.ts';
    }

    // 3. Если есть ESM синтаксис, используем .mjs
    if (this.hasESMSyntax(content)) {
      return '.mjs';
    }

    // 4. По умолчанию .js
    return '.js';
  }

  /**
   * Проверяет наличие TypeScript синтаксиса в коде
   * НОВЫЙ МЕТОД
   */
  private hasTypeScriptSyntax(content: string): boolean {
    // Проверяем наличие декораторов
    if (/@\w+\s*(?:\([^)]*\))?/.test(content)) return true;

    // Проверяем наличие generics (но не HTML теги)
    if (
      /<\s*\w+\s*(?:extends\s+\w+)?\s*>/g.test(content) &&
      !/<[a-z][a-z0-9]*\s*[>/]/i.test(content)
    ) {
      return true;
    }

    // Проверяем наличие type annotations
    if (/:\s*(?:string|number|boolean|any|void|unknown|never)\b/.test(content)) return true;

    // Проверяем наличие интерфейсов и type aliases
    if (/\b(?:interface|type)\s+\w+\s*(?:<[^>]*>)?\s*{/.test(content)) return true;

    // Проверяем наличие enum
    if (/\benum\s+\w+\s*{/.test(content)) return true;

    // Проверяем наличие namespace
    if (/\bnamespace\s+\w+\s*{/.test(content)) return true;

    // Проверяем наличие type-only imports
    if (/import\s+type\s+{/.test(content)) return true;

    // Проверяем наличие export type
    if (/export\s+type\s+{/.test(content)) return true;

    return false;
  }

  /**
   * Проверяет наличие ESM синтаксиса в коде
   * НОВЫЙ МЕТОД
   */
  private hasESMSyntax(content: string): boolean {
    // Проверяем наличие import.meta
    if (/\bimport\.meta\b/.test(content)) return true;

    // Проверяем наличие динамических импортов
    if (/import\s*\(/.test(content)) return true;

    // Проверяем наличие export default
    if (/\bexport\s+default\b/.test(content)) return true;

    // Проверяем наличие top-level await
    if (/^\s*await\s+/.test(content)) return true;

    return false;
  }
}
