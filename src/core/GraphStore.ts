// src/core/GraphStore.ts
// Единое хранилище всех графов - ПОЛНАЯ ВЕРСИЯ

export interface ImportEdge {
  targetId: string;
  targetName: string;
  specifier: string;
  line: number;
  type: 'named' | 'default' | 'namespace' | 'type';
  isTypeOnly?: boolean;
}

export interface ExportEdge {
  funcId: string;
  funcName: string;
  isDefault: boolean;
  line: number;
  type: 'named' | 'default' | 're-export';
  source?: string;
}

export interface CallEdge {
  from: string;
  to: string;
  line: number;
  type: 'direct' | 'async' | 'method' | 'callback' | 'imported';
}

export class GraphStore {
  // ============================================
  // ГРАФ ВЫЗОВОВ (Call Graph)
  // ============================================
  private callEdges = new Map<string, Set<string>>();
  private callReverse = new Map<string, Set<string>>();
  private callMetadata = new Map<string, CallEdge>();

  /**
   * Добавляет ребро вызова
   */
  addCall(from: string, to: string, line: number = 0, type: CallEdge['type'] = 'direct'): void {
    if (!this.callEdges.has(from)) {
      this.callEdges.set(from, new Set());
    }
    this.callEdges.get(from)!.add(to);

    if (!this.callReverse.has(to)) {
      this.callReverse.set(to, new Set());
    }
    this.callReverse.get(to)!.add(from);

    const key = `${from}->${to}`;
    if (!this.callMetadata.has(key)) {
      this.callMetadata.set(key, { from, to, line, type });
    }
  }

  /**
   * Получает все вызовы функции
   */
  getCalls(funcId: string): string[] {
    return Array.from(this.callEdges.get(funcId) || []);
  }

  /**
   * Получает все функции, вызывающие данную
   */
  getCallers(funcId: string): string[] {
    return Array.from(this.callReverse.get(funcId) || []);
  }

  /**
   * Получает метаданные вызова
   */
  getCallMetadata(from: string, to: string): CallEdge | undefined {
    return this.callMetadata.get(`${from}->${to}`);
  }

  /**
   * Проверяет, есть ли у функции вызовы
   */
  hasCalls(funcId: string): boolean {
    return (this.callEdges.get(funcId)?.size || 0) > 0;
  }

  /**
   * Проверяет, вызывается ли функция
   */
  isCalled(funcId: string): boolean {
    return (this.callReverse.get(funcId)?.size || 0) > 0;
  }

  /**
   * Проверяет, является ли функция изолированной (self)
   */
  isSelfFunction(funcId: string): boolean {
    return !this.hasCalls(funcId) && !this.isCalled(funcId);
  }

  /**
   * Возвращает все self-функции
   */
  getSelfFunctions(): string[] {
    const result: string[] = [];
    for (const [funcId] of this.callEdges) {
      if (this.isSelfFunction(funcId)) {
        result.push(funcId);
      }
    }
    // Также проверяем функции, у которых нет вызовов и их никто не вызывает
    for (const [funcId] of this.callReverse) {
      if (this.isSelfFunction(funcId) && !result.includes(funcId)) {
        result.push(funcId);
      }
    }
    return result;
  }

  // ============================================
  // ГРАФ ИМПОРТОВ (Import Graph)
  // ============================================
  private importEdges = new Map<string, ImportEdge[]>();
  private importReverse = new Map<string, Set<string>>();

  /**
   * Добавляет ребро импорта
   */
  addImport(
    fileId: string,
    targetId: string,
    targetName: string,
    specifier: string,
    line: number,
    type: ImportEdge['type'] = 'named',
    isTypeOnly: boolean = false
  ): void {
    if (!this.importEdges.has(fileId)) {
      this.importEdges.set(fileId, []);
    }
    this.importEdges.get(fileId)!.push({
      targetId,
      targetName,
      specifier,
      line,
      type,
      isTypeOnly,
    });

    if (!this.importReverse.has(targetId)) {
      this.importReverse.set(targetId, new Set());
    }
    this.importReverse.get(targetId)!.add(fileId);
  }

  /**
   * Получает все импорты файла
   */
  getImports(fileId: string): ImportEdge[] {
    return this.importEdges.get(fileId) || [];
  }

  /**
   * Получает все файлы, импортирующие функцию
   */
  getImporters(funcId: string): string[] {
    return Array.from(this.importReverse.get(funcId) || []);
  }

  /**
   * Получает детальную информацию о том, кто импортирует функцию
   */
  getImportedBy(funcId: string): { fileId: string; specifier: string; line: number }[] {
    const result: { fileId: string; specifier: string; line: number }[] = [];
    for (const [fileId, edges] of this.importEdges) {
      for (const edge of edges) {
        if (edge.targetId === funcId) {
          result.push({ fileId, specifier: edge.specifier, line: edge.line });
        }
      }
    }
    return result;
  }

  /**
   * Проверяет, импортируется ли функция
   */
  isImported(funcId: string): boolean {
    return (this.importReverse.get(funcId)?.size || 0) > 0;
  }

  // ============================================
  // ГРАФ ЭКСПОРТОВ (Export Graph)
  // ============================================
  private exportEdges = new Map<string, ExportEdge[]>();
  private exportReverse = new Map<string, string>(); // funcId -> fileId
  private exportNames = new Map<string, string>(); // funcId -> exportName

  /**
   * Добавляет ребро экспорта
   */
  addExport(
    fileId: string,
    funcId: string,
    funcName: string,
    isDefault: boolean = false,
    line: number = 0,
    type: ExportEdge['type'] = 'named',
    source?: string
  ): void {
    if (!this.exportEdges.has(fileId)) {
      this.exportEdges.set(fileId, []);
    }
    this.exportEdges.get(fileId)!.push({
      funcId,
      funcName,
      isDefault,
      line,
      type,
      source,
    });

    this.exportReverse.set(funcId, fileId);
    this.exportNames.set(funcId, funcName);
  }

  /**
   * Получает все экспорты файла
   */
  getExports(fileId: string): ExportEdge[] {
    return this.exportEdges.get(fileId) || [];
  }

  /**
   * Получает файл, экспортирующий функцию
   */
  getExportFile(funcId: string): string | undefined {
    return this.exportReverse.get(funcId);
  }

  /**
   * Получает имя, под которым экспортируется функция
   */
  getExportName(funcId: string): string | undefined {
    return this.exportNames.get(funcId);
  }

  /**
   * Проверяет, экспортируется ли функция
   */
  isExported(funcId: string): boolean {
    return this.exportReverse.has(funcId);
  }

  // ============================================
  // ССЫЛОЧНАЯ ЦЕЛОСТНОСТЬ
  // ============================================

  /**
   * Валидирует все графы на наличие битых ссылок
   */
  validate(allFuncIds: Set<string>, allFileIds: Set<string>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Проверяем вызовы
    for (const [from, toSet] of this.callEdges) {
      if (!allFuncIds.has(from)) {
        errors.push(`Call: from '${from}' not found in functions`);
      }
      for (const to of toSet) {
        if (!allFuncIds.has(to)) {
          errors.push(`Call: to '${to}' not found in functions`);
        }
      }
    }

    // Проверяем импорты
    for (const [fileId, edges] of this.importEdges) {
      if (!allFileIds.has(fileId)) {
        errors.push(`Import: file '${fileId}' not found in files`);
      }
      for (const edge of edges) {
        if (!allFuncIds.has(edge.targetId)) {
          errors.push(`Import: target '${edge.targetId}' not found in functions`);
        }
      }
    }

    // Проверяем экспорты
    for (const [fileId, edges] of this.exportEdges) {
      if (!allFileIds.has(fileId)) {
        errors.push(`Export: file '${fileId}' not found in files`);
      }
      for (const edge of edges) {
        if (!allFuncIds.has(edge.funcId)) {
          errors.push(`Export: func '${edge.funcId}' not found in functions`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // СТАТИСТИКА
  // ============================================

  /**
   * Возвращает статистику по графам
   */
  getStats(): {
    totalCalls: number;
    totalImports: number;
    totalExports: number;
    uniqueCallers: number;
    uniqueCallees: number;
    selfFunctions: number;
    exportedFunctions: number;
    importedFunctions: number;
  } {
    let totalCalls = 0;
    for (const set of this.callEdges.values()) {
      totalCalls += set.size;
    }

    let totalImports = 0;
    for (const edges of this.importEdges.values()) {
      totalImports += edges.length;
    }

    let totalExports = 0;
    for (const edges of this.exportEdges.values()) {
      totalExports += edges.length;
    }

    const selfFunctions = this.getSelfFunctions().length;

    return {
      totalCalls,
      totalImports,
      totalExports,
      uniqueCallers: this.callEdges.size,
      uniqueCallees: this.callReverse.size,
      selfFunctions,
      exportedFunctions: this.exportReverse.size,
      importedFunctions: this.importReverse.size,
    };
  }

  // ============================================
  // ЭКСПОРТ В КОМПАКТНЫЙ ФОРМАТ
  // ============================================

  /**
   * Конвертирует графы в компактный формат для отчёта
   */
  toCompact(
    funcIndex: Map<string, number>,
    fileIndex: Map<string, number>
  ): {
    c: [number, number, number, string][];
    i: [number, number, string, number, string][];
    e: [number, number, string, number, string][];
  } {
    const calls: [number, number, number, string][] = [];
    for (const [from, toSet] of this.callEdges) {
      const fromIdx = funcIndex.get(from);
      if (fromIdx === undefined) continue;
      for (const to of toSet) {
        const toIdx = funcIndex.get(to);
        if (toIdx === undefined) continue;
        const meta = this.callMetadata.get(`${from}->${to}`);
        calls.push([fromIdx, toIdx, meta?.line || 0, meta?.type || 'direct']);
      }
    }

    const imports: [number, number, string, number, string][] = [];
    for (const [fileId, edges] of this.importEdges) {
      const fileIdx = fileIndex.get(fileId);
      if (fileIdx === undefined) continue;
      for (const edge of edges) {
        const funcIdx = funcIndex.get(edge.targetId);
        if (funcIdx === undefined) continue;
        imports.push([fileIdx, funcIdx, edge.specifier, edge.line, edge.type]);
      }
    }

    const exports: [number, number, string, number, string][] = [];
    for (const [fileId, edges] of this.exportEdges) {
      const fileIdx = fileIndex.get(fileId);
      if (fileIdx === undefined) continue;
      for (const edge of edges) {
        const funcIdx = funcIndex.get(edge.funcId);
        if (funcIdx === undefined) continue;
        // ✅ ИСПРАВЛЕНО: edge.line преобразуется в строку
        exports.push([fileIdx, funcIdx, edge.funcName, edge.isDefault ? 1 : 0, String(edge.line)]);
      }
    }

    return { c: calls, i: imports, e: exports };
  }

  // ============================================
  // ОЧИСТКА
  // ============================================

  /**
   * Очищает все графы
   */
  clear(): void {
    this.callEdges.clear();
    this.callReverse.clear();
    this.callMetadata.clear();
    this.importEdges.clear();
    this.importReverse.clear();
    this.exportEdges.clear();
    this.exportReverse.clear();
    this.exportNames.clear();
  }

  // ============================================
  // ИМПОРТ/ЭКСПОРТ
  // ============================================

  /**
   * Экспортирует графы в JSON
   */
  toJSON(): any {
    return {
      calls: Array.from(this.callEdges.entries()).map(([from, toSet]) => ({
        from,
        to: Array.from(toSet),
      })),
      imports: Array.from(this.importEdges.entries()).map(([fileId, edges]) => ({
        fileId,
        edges,
      })),
      exports: Array.from(this.exportEdges.entries()).map(([fileId, edges]) => ({
        fileId,
        edges,
      })),
      stats: this.getStats(),
    };
  }

  /**
   * Импортирует графы из JSON
   */
  fromJSON(data: any): void {
    this.clear();

    for (const call of data.calls || []) {
      for (const to of call.to || []) {
        this.addCall(call.from, to);
      }
    }

    for (const imp of data.imports || []) {
      for (const edge of imp.edges || []) {
        this.addImport(
          imp.fileId,
          edge.targetId,
          edge.targetName,
          edge.specifier,
          edge.line,
          edge.type,
          edge.isTypeOnly
        );
      }
    }

    for (const exp of data.exports || []) {
      for (const edge of exp.edges || []) {
        this.addExport(
          exp.fileId,
          edge.funcId,
          edge.funcName,
          edge.isDefault,
          edge.line,
          edge.type,
          edge.source
        );
      }
    }
  }
}

// ============================================
// СИНГЛТОН ДЛЯ ИСПОЛЬЗОВАНИЯ ВО ВСЁМ ПРОЕКТЕ
// ============================================

export const graphStore = new GraphStore();

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default graphStore;
