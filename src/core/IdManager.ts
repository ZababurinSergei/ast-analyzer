// packages/ast-analyzer/src/core/IdManager.ts
// ИСПРАВЛЕННАЯ ВЕРСИЯ - устранены предупреждения TS6133

import { createHash } from 'crypto';
import path from 'path';

export interface IdContext {
  filePath: string;
  funcName: string;
  line: number; // ✅ line теперь обязательный
  parentFunction?: string;
  depth?: number;
  componentName?: string;
  type?: 'function' | 'vue' | 'class' | 'constant' | 'interface' | 'type';
}

/**
 * Простой хеш для генерации коротких ID
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

export class IdManager {
  private idMap: Map<string, string> = new Map();
  private usedIds: Set<string> = new Set();
  private debug: boolean = false;

  // ✅ НОВОЕ: счетчик для компактных ID
  private compactIdCounter: number = 0;
  private compactIdMap: Map<string, string> = new Map();
  private compactUsedIds: Set<string> = new Set();

  // ✅ НОВОЕ: счетчики для коротких ID (m1, f1, fn1, ...)
  private shortIdCounters: Map<string, number> = new Map();
  private shortIdMap: Map<string, string> = new Map(); // полное имя -> короткий ID
  private shortIdReverseMap: Map<string, string> = new Map(); // короткий ID -> полное имя

  constructor(debug: boolean = false) {
    this.debug = debug;
    // Инициализируем счетчики
    this.shortIdCounters.set('module', 0);
    this.shortIdCounters.set('file', 0);
    this.shortIdCounters.set('function', 0);
    this.shortIdCounters.set('class', 0);
    this.shortIdCounters.set('interface', 0);
  }

  /**
   * Установить режим отладки
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  // ============================================
  // ✅ НОВЫЙ МЕТОД: Генерация коротких ID
  // ============================================

  /**
   * Генерирует короткий уникальный ID для сущности
   * @param type - тип сущности: 'module' | 'file' | 'function' | 'class' | 'interface'
   * @param name - полное имя сущности (для обратного маппинга)
   * @returns короткий ID (m1, f1, fn1, c1, i1, ...)
   */
  generateShortId(
    type: 'module' | 'file' | 'function' | 'class' | 'interface',
    name: string
  ): string {
    // Проверяем, есть ли уже ID для этого имени
    const fullKey = `${type}:${name}`;
    if (this.shortIdMap.has(fullKey)) {
      return this.shortIdMap.get(fullKey)!;
    }

    // Получаем счетчик для типа
    let counter = this.shortIdCounters.get(type) || 0;
    counter++;
    this.shortIdCounters.set(type, counter);

    // Определяем префикс
    const prefix =
      type === 'module'
        ? 'm'
        : type === 'file'
          ? 'f'
          : type === 'function'
            ? 'fn'
            : type === 'class'
              ? 'c'
              : 'i'; // interface

    const shortId = `${prefix}${counter}`;

    // Сохраняем маппинг
    this.shortIdMap.set(fullKey, shortId);
    this.shortIdReverseMap.set(shortId, fullKey);

    if (this.debug) {
      console.log(`🔑 [IdManager] Generated short ID: ${shortId} for ${type}:${name}`);
    }

    return shortId;
  }

  /**
   * Получить полное имя по короткому ID
   */
  getFullName(shortId: string): string | null {
    return this.shortIdReverseMap.get(shortId) || null;
  }

  /**
   * Получить тип по короткому ID
   */
  getTypeFromShortId(shortId: string): string | null {
    const full = this.shortIdReverseMap.get(shortId);
    if (!full) return null;
    return full.split(':')[0] || null;
  }

  /**
   * Получить имя по короткому ID
   */
  getNameFromShortId(shortId: string): string | null {
    const full = this.shortIdReverseMap.get(shortId);
    if (!full) return null;
    const parts = full.split(':');
    return parts.length > 1 ? (parts[1] ?? null) : null;
  }

  /**
   * Получить все короткие ID
   */
  getAllShortIds(): string[] {
    return Array.from(this.shortIdReverseMap.keys());
  }

  /**
   * Получить статистику коротких ID
   */
  getShortIdStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const [type] of this.shortIdCounters) {
      byType[type] = this.shortIdCounters.get(type) || 0;
    }
    return {
      total: this.shortIdMap.size,
      byType,
    };
  }

  // ============================================
  // ✅ НОВЫЙ МЕТОД: Компактные ID
  // ============================================

  /**
   * ✅ НОВЫЙ МЕТОД: Генерирует компактный ID в формате f{индекс}_{номер_строки}
   * Пример: f142_704
   */
  generateCompactId(context: IdContext): string {
    const { filePath, funcName, line } = context;

    // Ключ для кэширования (без имени функции для стабильности при переименовании)
    const key = `${filePath}:${line}`;

    // Проверяем кэш
    if (this.compactIdMap.has(key)) {
      return this.compactIdMap.get(key)!;
    }

    // Генерируем новый компактный ID
    const index = ++this.compactIdCounter;
    let id = `f${index}_${line}`;

    // Гарантируем уникальность (защита от коллизий)
    let attempts = 0;
    while (this.compactUsedIds.has(id) && attempts < 100) {
      // Если коллизия, добавляем суффикс
      const suffix = String.fromCharCode(97 + (attempts % 26)); // a, b, c, ...
      id = `f${index}_${line}${suffix}`;
      attempts++;
    }

    // Сохраняем в кэш
    this.compactIdMap.set(key, id);
    this.compactUsedIds.add(id);

    if (this.debug) {
      console.log(
        `🔑 [IdManager] Generated compact ID: ${id} for ${funcName} in ${filePath}:${line}`
      );
    }

    return id;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Генерирует компактный ID с опциями
   */
  generateCompactIdWithOptions(
    context: IdContext,
    options: {
      includeName?: boolean;
      nameLength?: number;
      prefix?: string;
    } = {}
  ): string {
    const { filePath, funcName, line } = context;
    const { includeName = false, nameLength = 3, prefix = 'f' } = options;

    // Ключ для кэширования
    const key = includeName ? `${filePath}:${funcName}:${line}` : `${filePath}:${line}`;

    // Проверяем кэш
    if (this.compactIdMap.has(key)) {
      return this.compactIdMap.get(key)!;
    }

    // Генерируем ID
    const index = ++this.compactIdCounter;
    let id = `${prefix}${index}`;

    // Добавляем номер строки
    if (line > 0) {
      id += `_${line}`;
    }

    // Опционально: добавляем сокращенное имя
    if (includeName && funcName) {
      const shortName = funcName
        .replace(/^get|^set|^is|^has|^use/, '') // убираем префиксы
        .substring(0, nameLength)
        .toLowerCase();
      if (shortName) {
        id += `_${shortName}`;
      }
    }

    // Гарантируем уникальность
    let attempts = 0;
    while (this.compactUsedIds.has(id) && attempts < 100) {
      const suffix = String.fromCharCode(97 + (attempts % 26));
      id = `${prefix}${++this.compactIdCounter}_${line}${suffix}`;
      attempts++;
    }

    this.compactIdMap.set(key, id);
    this.compactUsedIds.add(id);

    if (this.debug) {
      console.log(
        `🔑 [IdManager] Generated compact ID: ${id} for ${funcName} in ${filePath}:${line}`
      );
    }

    return id;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Получить контекст по компактному ID
   */
  getContextByCompactId(id: string): { file: string; func: string; line: number } | null {
    for (const [key, value] of this.compactIdMap) {
      if (value === id) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          return {
            file: parts[0] || '',
            func: parts[1] || 'anonymous',
            line: parseInt(parts[2] || '0', 10),
          };
        }
      }
    }
    return null;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Получить статистику компактных ID
   */
  getCompactStats(): { total: number; unique: number; avgLength: number } {
    const ids = Array.from(this.compactUsedIds);
    const totalLength = ids.reduce((sum, id) => sum + id.length, 0);

    return {
      total: this.compactIdMap.size,
      unique: this.compactUsedIds.size,
      avgLength: ids.length > 0 ? totalLength / ids.length : 0,
    };
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Очистить компактный кэш
   */
  clearCompactCache(): void {
    this.compactIdCounter = 0;
    this.compactIdMap.clear();
    this.compactUsedIds.clear();
  }

  // ============================================
  // ОРИГИНАЛЬНЫЙ МЕТОД: Генерация ID функции
  // ============================================

  /**
   * ОРИГИНАЛЬНЫЙ МЕТОД: Генерирует уникальный стабильный ID для функции
   * ✅ ВСЕГДА использует номер строки
   */
  getFunctionId(context: IdContext): string {
    const { filePath, funcName, line, parentFunction, depth = 0, type = 'function' } = context;

    // 1. Нормализуем путь (абсолютный для стабильности)
    const absolutePath = path.resolve(filePath);

    // 2. Создаем контекстный ключ с номером строки
    const contextKey = this.buildContextKey(absolutePath, funcName, line, parentFunction, depth);

    // 3. Проверяем кэш
    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    // 4. Генерируем уникальный хеш
    const hash = this.generateHash(contextKey);

    // 5. Санитайзим имя для читаемости
    const safeName = this.sanitizeName(funcName);

    // 6. Формируем ID с типом и номером строки
    const prefix = type === 'vue' ? 'vue' : 'func';
    // ✅ ВСЕГДА добавляем номер строки
    let id = `${prefix}_${hash}_${safeName}_${line}`;

    // 7. Гарантируем уникальность (защита от коллизий)
    let counter = 0;
    while (this.usedIds.has(id)) {
      counter++;
      id = `${prefix}_${hash}_${safeName}_${line}_${counter}`;
    }

    // 8. Сохраняем в кэш
    this.idMap.set(contextKey, id);
    this.usedIds.add(id);

    if (this.debug) {
      console.log(`🔑 [IdManager] Generated ID: ${id} for ${funcName} in ${filePath}:${line}`);
    }

    return id;
  }

  // ============================================
  // СТАТИЧЕСКИЕ МЕТОДЫ (оригинальные)
  // ============================================

  /**
   * ✅ СТАТИЧЕСКИЙ МЕТОД для генерации ID функции без экземпляра
   * Используется в местах, где нет доступа к экземпляру IdManager
   */
  static generateFunctionId(filePath: string, funcName: string, line: number): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileHash = simpleHash(relativePath);
    // ✅ ВСЕГДА добавляем номер строки
    return `func_${fileHash}_${funcName}_${line}`;
  }

  /**
   * ✅ СТАТИЧЕСКИЙ МЕТОД для генерации ID файла
   */
  static generateFileId(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileHash = simpleHash(relativePath);
    return `file_${fileHash}`;
  }

  /**
   * ✅ СТАТИЧЕСКИЙ МЕТОД для генерации ID модуля
   */
  static generateModuleId(moduleName: string): string {
    const moduleHash = simpleHash(moduleName);
    return `module_${moduleHash}`;
  }

  /**
   * ✅ НОВЫЙ СТАТИСТИЧЕСКИЙ МЕТОД для генерации стабильного ID
   * Используется в ultra-compact режиме
   */
  static generateStableId(filePath: string, funcName: string, line: number): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileHash = simpleHash(relativePath);
    const nameHash = simpleHash(funcName);
    return `f${fileHash}_${nameHash}_${line}`;
  }

  // ============================================
  // УНИВЕРСАЛЬНЫЙ МЕТОД: Генерация ID для сущностей
  // ============================================

  /**
   * ✅ НОВЫЙ МЕТОД: Генерирует ID для сущности с учетом типа
   * Универсальный метод для всех типов сущностей
   */
  generateEntityId(
    filePath: string,
    name: string,
    line: number,
    type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' = 'function'
  ): string {
    const absolutePath = path.resolve(filePath);
    const contextKey = `${absolutePath}:${type}:${name}:${line}`;

    // Проверяем кэш
    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    // Генерируем ID
    const hash = this.generateHash(contextKey);
    const safeName = this.sanitizeName(name);
    const prefix =
      type === 'function'
        ? 'func'
        : type === 'class'
          ? 'cls'
          : type === 'constant'
            ? 'const'
            : type === 'interface'
              ? 'intf'
              : type === 'type'
                ? 'type'
                : 'var';

    let id = `${prefix}_${hash}_${safeName}_${line}`;

    // Гарантируем уникальность
    let counter = 0;
    while (this.usedIds.has(id)) {
      counter++;
      id = `${prefix}_${hash}_${safeName}_${line}_${counter}`;
    }

    this.idMap.set(contextKey, id);
    this.usedIds.add(id);

    if (this.debug) {
      console.log(`🔑 [IdManager] Generated entity ID: ${id} for ${name} in ${filePath}:${line}`);
    }

    return id;
  }

  // ============================================
  // СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ
  // ============================================

  /**
   * Генерирует ID для Vue компонента
   */
  getVueFunctionId(
    filePath: string,
    funcName: string,
    componentName: string,
    line: number
  ): string {
    // Используем _componentName для предотвращения предупреждения TS6133
    const _componentName = componentName;
    return this.getFunctionId({
      filePath,
      funcName,
      line,
      type: 'vue',
      componentName: _componentName,
    });
  }

  /**
   * Генерирует ID для класса
   */
  getClassId(filePath: string, className: string, line: number): string {
    return this.generateEntityId(filePath, className, line, 'class');
  }

  /**
   * Генерирует ID для константы
   */
  getConstantId(filePath: string, constName: string, line: number): string {
    return this.generateEntityId(filePath, constName, line, 'constant');
  }

  /**
   * Генерирует ID для интерфейса
   */
  getInterfaceId(filePath: string, interfaceName: string, line: number): string {
    return this.generateEntityId(filePath, interfaceName, line, 'interface');
  }

  /**
   * Генерирует ID для типа
   */
  getTypeId(filePath: string, typeName: string, line: number): string {
    return this.generateEntityId(filePath, typeName, line, 'type');
  }

  // ============================================
  // ✅ НОВЫЙ МЕТОД: Получить moduleId для файла
  // ============================================

  /**
   * Получает короткий ID модуля для файла
   * @param filePath - путь к файлу
   * @returns короткий ID модуля (m1, m2, ...) или undefined
   */
  getModuleId(filePath: string): string | undefined {
    if (!filePath) return undefined;
    const relativePath = path.relative(process.cwd(), filePath);
    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    return this.generateShortId('module', dirName);
  }

  // ============================================
  // ✅ НОВЫЙ МЕТОД: Получить fileId для файла
  // ============================================

  /**
   * Получает короткий ID файла
   * @param filePath - путь к файлу
   * @returns короткий ID файла (f1, f2, ...) или undefined
   */
  getFileId(filePath: string): string | undefined {
    if (!filePath) return undefined;
    const relativePath = path.relative(process.cwd(), filePath);
    return this.generateShortId('file', relativePath);
  }

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================

  /**
   * Построение контекстного ключа
   */
  private buildContextKey(
    absolutePath: string,
    funcName: string,
    line: number,
    parentFunction?: string,
    depth: number = 0
  ): string {
    if (parentFunction) {
      return `${absolutePath}:${parentFunction}.${funcName}:${line}:${depth}`;
    }
    return `${absolutePath}:${funcName}:${line}:${depth}`;
  }

  /**
   * Генерация хеша
   */
  private generateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 8);
  }

  /**
   * Санитайзинг имени для ID
   */
  private sanitizeName(name: string): string {
    if (!name) return 'anonymous';

    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .substring(0, 30);
  }

  /**
   * Получить ID по контексту (без генерации)
   */
  getExistingId(context: IdContext): string | null {
    const absolutePath = path.resolve(context.filePath);
    const contextKey = this.buildContextKey(
      absolutePath,
      context.funcName,
      context.line,
      context.parentFunction,
      context.depth || 0
    );

    return this.idMap.get(contextKey) || null;
  }

  /**
   * Проверить, существует ли ID
   */
  hasId(id: string): boolean {
    return this.usedIds.has(id) || this.compactUsedIds.has(id) || this.shortIdReverseMap.has(id);
  }

  /**
   * Очистить кэш
   */
  clear(): void {
    this.idMap.clear();
    this.usedIds.clear();
    this.compactIdCounter = 0;
    this.compactIdMap.clear();
    this.compactUsedIds.clear();
    // Очищаем короткие ID
    this.shortIdCounters.clear();
    this.shortIdMap.clear();
    this.shortIdReverseMap.clear();
    // Инициализируем заново
    this.shortIdCounters.set('module', 0);
    this.shortIdCounters.set('file', 0);
    this.shortIdCounters.set('function', 0);
    this.shortIdCounters.set('class', 0);
    this.shortIdCounters.set('interface', 0);

    if (this.debug) {
      console.log('🧹 [IdManager] Cache cleared');
    }
  }

  /**
   * Получить статистику
   */
  getStats(): { total: number; unique: number; shortIds: number } {
    return {
      total: this.idMap.size + this.compactIdMap.size + this.shortIdMap.size,
      unique: this.usedIds.size + this.compactUsedIds.size + this.shortIdMap.size,
      shortIds: this.shortIdMap.size,
    };
  }

  /**
   * Валидация всех ID
   */
  validate(): { valid: boolean; duplicates: string[] } {
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const id of this.usedIds) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }

    for (const id of this.compactUsedIds) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }

    for (const id of this.shortIdReverseMap.keys()) {
      if (seen.has(id)) {
        duplicates.push(id);
      }
      seen.add(id);
    }

    return {
      valid: duplicates.length === 0,
      duplicates,
    };
  }

  /**
   * Экспорт ID для отладки
   */
  exportDebugInfo(): {
    totalMappings: number;
    totalIds: number;
    compactMappings: number;
    shortMappings: number;
    sampleMappings: { key: string; id: string }[];
  } {
    const sampleMappings: { key: string; id: string }[] = [];
    let count = 0;

    for (const [key, id] of this.idMap) {
      if (count < 3) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    for (const [key, id] of this.compactIdMap) {
      if (count < 6) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    for (const [key, id] of this.shortIdMap) {
      if (count < 10) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    return {
      totalMappings: this.idMap.size + this.compactIdMap.size + this.shortIdMap.size,
      totalIds: this.usedIds.size + this.compactUsedIds.size + this.shortIdMap.size,
      compactMappings: this.compactIdMap.size,
      shortMappings: this.shortIdMap.size,
      sampleMappings,
    };
  }

  // ============================================
  // МАССОВЫЕ ОПЕРАЦИИ
  // ============================================

  /**
   * ✅ НОВЫЙ МЕТОД: Массовая генерация компактных ID
   */
  generateCompactIdsBatch(contexts: IdContext[]): string[] {
    return contexts.map(ctx => this.generateCompactId(ctx));
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Массовая генерация коротких ID
   */
  generateShortIdsBatch(
    items: { type: 'module' | 'file' | 'function' | 'class' | 'interface'; name: string }[]
  ): string[] {
    return items.map(item => this.generateShortId(item.type, item.name));
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Получить маппинг ID → полное имя
   */
  getCompactIdMapping(): Record<string, { file: string; func: string; line: number }> {
    const mapping: Record<string, { file: string; func: string; line: number }> = {};

    for (const [key, id] of this.compactIdMap) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        mapping[id] = {
          file: parts[0] || '',
          func: parts[1] || 'anonymous',
          line: parseInt(parts[2] || '0', 10),
        };
      }
    }

    return mapping;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Получить маппинг коротких ID → полное имя
   */
  getShortIdMapping(): Record<string, { type: string; name: string }> {
    const mapping: Record<string, { type: string; name: string }> = {};

    for (const [shortId, fullKey] of this.shortIdReverseMap) {
      const parts = fullKey.split(':');
      if (parts.length >= 2) {
        mapping[shortId] = {
          type: parts[0] || 'unknown',
          name: parts[1] || 'unknown',
        };
      }
    }

    return mapping;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Проверка, является ли ID компактным
   */
  isCompactId(id: string): boolean {
    return /^f\d+_\d+$/.test(id) || /^f\d+_\d+[a-z]$/.test(id);
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Проверка, является ли ID коротким
   */
  isShortId(id: string): boolean {
    return /^[mfnci]\d+$/.test(id);
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Конвертировать компактный ID в полный (если доступно)
   */
  expandCompactId(compactId: string): string | null {
    const context = this.getContextByCompactId(compactId);
    if (!context) return null;

    // Генерируем полный ID
    return this.getFunctionId({
      filePath: context.file,
      funcName: context.func,
      line: context.line,
    });
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Конвертировать короткий ID в полное имя
   */
  expandShortId(shortId: string): { type: string; name: string } | null {
    const full = this.shortIdReverseMap.get(shortId);
    if (!full) return null;
    const parts = full.split(':');
    if (parts.length >= 2) {
      return {
        type: parts[0] || 'unknown',
        name: parts[1] || 'unknown',
      };
    }
    return null;
  }

  // ============================================
  // ✅ НОВЫЙ МЕТОД: Получить маппинг ID к VSCode ссылкам
  // ============================================

  /**
   * Получить VSCode ссылку для функции по ID
   */
  getVscodeLink(id: string): string | null {
    const context = this.getContextByCompactId(id);
    if (!context) return null;
    return `vscode://file/${context.file}:${context.line}`;
  }

  /**
   * Получить VSCode ссылку для функции по контексту
   */
  getVscodeLinkForContext(context: IdContext): string {
    return `vscode://file/${context.filePath}:${context.line}`;
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ - ЕДИНЫЙ ЭКЗЕМПЛЯР
// ============================================

// Создаем и экспортируем единственный экземпляр
export const idManager = new IdManager();

// Также экспортируем класс для возможности создания новых экземпляров (для тестов)
export default idManager;
