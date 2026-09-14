// src/reporters/re-export-resolver.ts
// ============================================
// РАЗВОРАЧИВАНИЕ RE-EXPORTS НА ЭТАПЕ COLLECT ENTITIES
// ============================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ УДАЛЕН неиспользуемый импорт 'SyntaxKind' из 'ts-morph'
//   - ✅ УДАЛЕН неиспользуемый импорт 'Node' из 'ts-morph'
//   - ✅ УДАЛЕН неиспользуемый параметр 'currentFile' из метода expandSingle
//   - ✅ Обновлены все вызовы expandSingle (удален второй аргумент)
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовая реализация разворачивания re-exports
//   - Работа с ts-morph SourceFile
//   - Поддержка export * from, export { default } from, export * as ns from
// ============================================

import fs from 'fs';
import path from 'path';
import type { Project, SourceFile } from 'ts-morph';

// ============================================
// ТИПЫ
// ============================================

export interface ReExportChain {
  /** Файл, из которого делается re-export (начало цепочки) */
  fromFile: string;
  /** Файл, в котором символ РЕАЛЬНО объявлен */
  toFile: string;
  /** Имя символа в исходном файле */
  originalName: string;
  /** Имя, под которым символ доступен в fromFile */
  exposedName: string;
  /** Тип re-export */
  type: 'named' | 'default' | 'star' | 'namespace';
  /** Глубина цепочки (1 = прямая связь) */
  depth: number;
  /** Промежуточные файлы */
  chain: string[];
  /** Строка в исходном файле */
  line: number;
}

export interface ResolverOptions {
  /** Максимальная глубина разворачивания */
  maxDepth?: number;
  /** Корень проекта (для tsconfig) */
  projectRoot?: string;
  /** Подробный вывод */
  debug?: boolean;
}

export interface ResolverStats {
  totalReExports: number;
  expandedChains: number;
  cyclesSkipped: number;
  unresolved: number;
  maxDepthReached: number;
  cachedFiles: number;
}

export interface ResolveResult {
  chains: ReExportChain[];
  stats: ResolverStats;
  /** Карта: filePath → Set имён, которые файл РЕАЛЬНО экспортирует
   *  (после разворачивания re-exports) */
  effectiveExports: Map<string, Set<string>>;
}

// ============================================
// ВНУТРЕННИЕ ТИПЫ
// ============================================

interface RawReExport {
  /** Файл, из которого делается re-export */
  fromFile: string;
  /** Файл, куда указывает source (может быть null, если не разрешён) */
  targetFile: string | null;
  /** Имя в исходном файле */
  originalName: string;
  /** Имя в fromFile */
  exposedName: string;
  /** Тип re-export */
  type: 'named' | 'default' | 'star' | 'namespace';
  /** Строка */
  line: number;
  /** Исходный source */
  source: string;
}

// ============================================
// ОСНОВНОЙ КЛАСС
// ============================================

export class CoreReExportResolver {
  private project: Project;
  private options: Required<ResolverOptions>;

  /** Кэш: файл → SourceFile (не парсим дважды) */
  private sourceFileCache = new Map<string, SourceFile | null>();

  /** Кэш: файл → re-exports (чтобы не обходить AST повторно) */
  private reExportsCache = new Map<string, RawReExport[]>();

  /** Кэш: файл → declared symbols */
  private declaredSymbolsCache = new Map<string, Set<string>>();

  /** tsconfig paths: alias → targets */
  private tsconfigPaths = new Map<string, string[]>();
  private tsconfigBaseUrl = '';

  constructor(project: Project, options: ResolverOptions = {}) {
    this.project = project;
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      projectRoot: options.projectRoot ?? process.cwd(),
      debug: options.debug ?? false,
    };

    this.loadTsConfig();
  }

  // ============================================
  // ПУБЛИЧНЫЙ API
  // ============================================

  /**
   * Разворачивает re-exports для указанных файлов.
   *
   * @param filePaths — список файлов (абсолютные пути)
   * @returns Результат с цепочками и статистикой
   */
  resolve(filePaths: string[]): ResolveResult {
    const chains: ReExportChain[] = [];
    const effectiveExports = new Map<string, Set<string>>();
    const stats: ResolverStats = {
      totalReExports: 0,
      expandedChains: 0,
      cyclesSkipped: 0,
      unresolved: 0,
      maxDepthReached: 0,
      cachedFiles: 0,
    };

    // Шаг 1: Собираем все re-exports со всех файлов
    const allReExports: RawReExport[] = [];
    for (const filePath of filePaths) {
      const reExports = this.getReExports(filePath);
      allReExports.push(...reExports);
    }
    stats.totalReExports = allReExports.length;

    if (this.options.debug) {
      console.log(`   📊 Найдено re-exports: ${stats.totalReExports}`);
    }

    // Шаг 2: Для каждого re-export разворачиваем цепочку
    for (const re of allReExports) {
      const expanded = this.expandChain(re, stats);

      for (const chain of expanded) {
        chains.push(chain);
        stats.expandedChains++;

        if (chain.depth > stats.maxDepthReached) {
          stats.maxDepthReached = chain.depth;
        }

        // Записываем в effectiveExports
        if (!effectiveExports.has(chain.fromFile)) {
          effectiveExports.set(chain.fromFile, new Set());
        }
        effectiveExports.get(chain.fromFile)!.add(chain.exposedName);
      }
    }

    stats.cachedFiles = this.sourceFileCache.size;

    return { chains, stats, effectiveExports };
  }

  /**
   * Возвращает эффективные экспорты для файла (с учётом развёрнутых re-exports).
   */
  getEffectiveExports(filePath: string): Set<string> {
    const result = new Set<string>();

    // 1. Прямые экспорты
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) return result;

    for (const [name] of sourceFile.getExportedDeclarations()) {
      result.add(name);
    }

    // 2. Развёрнутые re-exports
    const reExports = this.getReExports(filePath);
    const localStats: ResolverStats = {
      totalReExports: reExports.length,
      expandedChains: 0,
      cyclesSkipped: 0,
      unresolved: 0,
      maxDepthReached: 0,
      cachedFiles: 0,
    };

    for (const re of reExports) {
      const chains = this.expandChain(re, localStats);
      for (const chain of chains) {
        result.add(chain.exposedName);
      }
    }

    return result;
  }

  /**
   * Очищает кэши.
   */
  clearCache(): void {
    this.sourceFileCache.clear();
    this.reExportsCache.clear();
    this.declaredSymbolsCache.clear();
  }

  // ============================================
  // РАЗВОРАЧИВАНИЕ
  // ============================================

  private expandChain(re: RawReExport, stats: ResolverStats): ReExportChain[] {
    return this.expandSingle(
      re.fromFile,
      re.targetFile,
      re.originalName,
      re.exposedName,
      re.type,
      [re.fromFile],
      0,
      stats,
      re.line
    );
  }

  private expandSingle(
    rootFromFile: string,
    targetFile: string | null,
    originalName: string,
    exposedName: string,
    type: ReExportChain['type'],
    chain: string[],
    depth: number,
    stats: ResolverStats,
    line: number
  ): ReExportChain[] {
    // Защита от переполнения
    if (depth > this.options.maxDepth) {
      stats.unresolved++;
      return [];
    }

    // Защита от циклов
    if (targetFile && chain.includes(targetFile)) {
      stats.cyclesSkipped++;
      if (this.options.debug) {
        console.log(`   🔄 Цикл: ${chain.join(' → ')} → ${targetFile}`);
      }
      return [];
    }

    if (!targetFile) {
      stats.unresolved++;
      return [];
    }

    // Проверяем, объявлен ли символ в targetFile
    const declared = this.getDeclaredSymbols(targetFile);
    if (declared.has(originalName)) {
      // ✅ Конец цепочки
      return [
        {
          fromFile: rootFromFile,
          toFile: targetFile,
          originalName,
          exposedName,
          type,
          depth: depth + 1,
          chain: [...chain, targetFile],
          line,
        },
      ];
    }

    // Ищем re-exports в targetFile
    const targetReExports = this.getReExports(targetFile);

    // Фильтруем подходящие
    const matching = targetReExports.filter(r => {
      // Star re-export подходит для любого имени
      if (r.type === 'star') return true;
      // Named re-export — по имени
      if (r.originalName === originalName) return true;
      // Default re-export
      if (r.type === 'default' && originalName === 'default') return true;
      // Namespace — редко, но поддерживаем
      if (r.type === 'namespace' && originalName === r.originalName) return true;
      return false;
    });

    if (matching.length === 0) {
      stats.unresolved++;
      return [];
    }

    const allChains: ReExportChain[] = [];
    const newChain = [...chain, targetFile];

    for (const nextRe of matching) {
      const subChains = this.expandSingle(
        rootFromFile,
        nextRe.targetFile,
        nextRe.originalName,
        exposedName,
        nextRe.type,
        newChain,
        depth + 1,
        stats,
        line
      );
      allChains.push(...subChains);
    }

    return allChains;
  }

  // ============================================
  // СБОР RE-EXPORTS ЧЕРЕЗ AST
  // ============================================

  private getReExports(filePath: string): RawReExport[] {
    const cached = this.reExportsCache.get(filePath);
    if (cached) return cached;

    const result: RawReExport[] = [];
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) {
      this.reExportsCache.set(filePath, result);
      return result;
    }

    // 1. ExportNamedDeclaration с source: export { a, b } from './foo'
    for (const exp of sourceFile.getExportDeclarations()) {
      const source = exp.getModuleSpecifierValue();
      if (!source) continue;

      const targetFile = this.resolvePath(filePath, source);
      const line = exp.getStartLineNumber();

      for (const named of exp.getNamedExports()) {
        const exportedName = named.getAliasNode()?.getText() || named.getName();
        const originalName = named.getName();

        result.push({
          fromFile: filePath,
          targetFile,
          originalName,
          exposedName: exportedName,
          type: 'named',
          line,
          source,
        });
      }
    }

    // 2. ExportAllDeclaration: export * from './foo'
    for (const exp of sourceFile.getExportDeclarations()) {
      const source = exp.getModuleSpecifierValue();
      if (!source) continue;

      // Проверяем, есть ли namespace import: export * as ns from './foo'
      const namespaceExport = exp.getNamespaceExport();
      if (namespaceExport) {
        result.push({
          fromFile: filePath,
          targetFile: this.resolvePath(filePath, source),
          originalName: '*',
          exposedName: namespaceExport.getName(),
          type: 'namespace',
          line: exp.getStartLineNumber(),
          source,
        });
      } else {
        // Чистый export * from './foo'
        result.push({
          fromFile: filePath,
          targetFile: this.resolvePath(filePath, source),
          originalName: '*',
          exposedName: '*',
          type: 'star',
          line: exp.getStartLineNumber(),
          source,
        });
      }
    }

    // 3. Default re-export: export { default } from './foo'
    //    (обрабатывается в пункте 1, т.к. default — это named с именем 'default')

    // 4. Экспорт по умолчанию с source: export { default as X } from './foo'
    //    (тоже в пункте 1)

    this.reExportsCache.set(filePath, result);
    return result;
  }

  // ============================================
  // DECLARED SYMBOLS
  // ============================================

  private getDeclaredSymbols(filePath: string): Set<string> {
    const cached = this.declaredSymbolsCache.get(filePath);
    if (cached) return cached;

    const result = new Set<string>();
    const sourceFile = this.getSourceFile(filePath);
    if (!sourceFile) {
      this.declaredSymbolsCache.set(filePath, result);
      return result;
    }

    // Используем API ts-morph
    try {
      for (const [name, decls] of sourceFile.getExportedDeclarations()) {
        // Проверяем, что символ объявлен ЗДЕСЬ, а не re-export
        for (const decl of decls) {
          const declFile = decl.getSourceFile().getFilePath();
          if (this.normalizePath(declFile) === this.normalizePath(filePath)) {
            result.add(name);
            break;
          }
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.log(`   ⚠️ Ошибка getExportedDeclarations для ${filePath}: ${error}`);
      }
    }

    // Fallback: обходим функции/классы/константы
    try {
      for (const func of sourceFile.getFunctions()) {
        const name = func.getName();
        if (name && func.isExported()) result.add(name);
      }
      for (const cls of sourceFile.getClasses()) {
        const name = cls.getName();
        if (name && cls.isExported()) result.add(name);
      }
      for (const v of sourceFile.getVariableDeclarations()) {
        const name = v.getName();
        const stmt = v.getVariableStatement();
        if (stmt?.isExported()) result.add(name);
      }
      for (const i of sourceFile.getInterfaces()) {
        const name = i.getName();
        if (i.isExported()) result.add(name);
      }
      for (const t of sourceFile.getTypeAliases()) {
        const name = t.getName();
        if (t.isExported()) result.add(name);
      }
      for (const e of sourceFile.getEnums()) {
        const name = e.getName();
        if (e.isExported()) result.add(name);
      }
    } catch (error) {
      // Игнорируем
    }

    this.declaredSymbolsCache.set(filePath, result);
    return result;
  }

  // ============================================
  // РЕЗОЛЮЦИЯ ПУТЕЙ
  // ============================================

  private resolvePath(fromFile: string, importPath: string): string | null {
    if (!importPath) return null;

    // 1. Алиасы
    const aliasResolved = this.resolveAlias(importPath);
    if (aliasResolved) return aliasResolved;

    // 2. Относительные пути
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, importPath);
      return this.findExistingFile(resolved);
    }

    // 3. Абсолютные
    if (path.isAbsolute(importPath)) {
      return this.findExistingFile(importPath);
    }

    // 4. Внешние пакеты — не разворачиваем
    return null;
  }

  private findExistingFile(basePath: string): string | null {
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];
    const indexSuffixes = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.mjs'];

    // Проверяем как есть
    for (const ext of extensions) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return this.normalizePath(candidate);
      }
    }

    // Проверяем index-файлы
    for (const suffix of indexSuffixes) {
      const candidate = basePath + suffix;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return this.normalizePath(candidate);
      }
    }

    return null;
  }

  private resolveAlias(importPath: string): string | null {
    for (const [alias, targets] of this.tsconfigPaths) {
      if (importPath === alias || importPath.startsWith(alias + '/')) {
        const rest = importPath.slice(alias.length).replace(/^\//, '');
        for (const target of targets) {
          const resolved = rest ? path.resolve(target, rest) : target;
          const found = this.findExistingFile(resolved);
          if (found) return found;
        }
      }
    }
    return null;
  }

  // ============================================
  // ЗАГРУЗКА TSCONFIG
  // ============================================

  private loadTsConfig(): void {
    try {
      const tsconfigPath = path.join(this.options.projectRoot, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) return;

      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      // Убираем комментарии и trailing commas (упрощённо)
      const cleaned = content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,(\s*[}\]])/g, '$1');

      const tsconfig = JSON.parse(cleaned);
      const paths = tsconfig.compilerOptions?.paths || {};
      const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
      this.tsconfigBaseUrl = path.resolve(this.options.projectRoot, baseUrl);

      for (const [alias, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets)) continue;
        // Убираем /* в конце
        const cleanAlias = alias.replace(/\/\*$/, '');
        const cleanTargets = (targets as string[]).map(t =>
          path.resolve(this.tsconfigBaseUrl, t.replace(/\/\*$/, ''))
        );
        this.tsconfigPaths.set(cleanAlias, cleanTargets);
      }

      if (this.options.debug && this.tsconfigPaths.size > 0) {
        console.log(`   📋 tsconfig paths: ${Array.from(this.tsconfigPaths.keys()).join(', ')}`);
      }
    } catch (error) {
      if (this.options.debug) {
        console.log(`   ⚠️ Не удалось загрузить tsconfig: ${error}`);
      }
    }
  }

  // ============================================
  // УТИЛИТЫ
  // ============================================

  private getSourceFile(filePath: string): SourceFile | null {
    const cached = this.sourceFileCache.get(filePath);
    if (cached !== undefined) return cached;

    try {
      const sourceFile =
        this.project.getSourceFile(filePath) || this.project.addSourceFileAtPath(filePath);
      this.sourceFileCache.set(filePath, sourceFile);
      return sourceFile;
    } catch (error) {
      this.sourceFileCache.set(filePath, null);
      return null;
    }
  }

  private normalizePath(p: string): string {
    if (!p) return '';
    return p.replace(/\\/g, '/');
  }
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Быстрая функция для разворачивания re-exports.
 */
export function resolveCoreReExports(
  project: Project,
  filePaths: string[],
  options?: ResolverOptions
): ResolveResult {
  const resolver = new CoreReExportResolver(project, options);
  return resolver.resolve(filePaths);
}

export default CoreReExportResolver;
