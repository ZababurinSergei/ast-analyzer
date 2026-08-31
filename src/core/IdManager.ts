// src/core/IdManager.ts
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

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Установить режим отладки
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Генерирует компактный ID в формате f{индекс}_{номер_строки}
   * Пример: f142_704
   *
   * Преимущества:
   * - Максимальная экономия места (8-10 символов вместо 30-40)
   * - Номер строки сохраняется для навигации
   * - Индекс обеспечивает уникальность
   * - При переименовании функции ID остается стабильным
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
   * @param context - контекст сущности
   * @param options - опции генерации
   * @returns компактный ID
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
   * ✅ НОВЫЙ СТАТИЧЕСКИЙ МЕТОД для генерации стабильного ID
   * Используется в ultra-compact режиме
   */
  static generateStableId(filePath: string, funcName: string, line: number): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileHash = simpleHash(relativePath);
    const nameHash = simpleHash(funcName);
    return `f${fileHash}_${nameHash}_${line}`;
  }

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

  /**
   * Генерирует ID для Vue компонента
   */
  getVueFunctionId(
    filePath: string,
    funcName: string,
    componentName: string,
    line: number
  ): string {
    return this.getFunctionId({
      filePath,
      funcName,
      line,
      type: 'vue',
      componentName,
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
    return this.usedIds.has(id) || this.compactUsedIds.has(id);
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
    if (this.debug) {
      console.log('🧹 [IdManager] Cache cleared');
    }
  }

  /**
   * Получить статистику
   */
  getStats(): { total: number; unique: number } {
    return {
      total: this.idMap.size + this.compactIdMap.size,
      unique: this.usedIds.size + this.compactUsedIds.size,
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
    sampleMappings: { key: string; id: string }[];
  } {
    const sampleMappings: { key: string; id: string }[] = [];
    let count = 0;

    for (const [key, id] of this.idMap) {
      if (count < 5) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    for (const [key, id] of this.compactIdMap) {
      if (count < 10) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    return {
      totalMappings: this.idMap.size + this.compactIdMap.size,
      totalIds: this.usedIds.size + this.compactUsedIds.size,
      compactMappings: this.compactIdMap.size,
      sampleMappings,
    };
  }

  /**
   * ✅ НОВЫЙ МЕТОД: Массовая генерация компактных ID
   */
  generateCompactIdsBatch(contexts: IdContext[]): string[] {
    return contexts.map(ctx => this.generateCompactId(ctx));
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
   * ✅ НОВЫЙ МЕТОД: Проверка, является ли ID компактным
   */
  isCompactId(id: string): boolean {
    return /^f\d+_\d+$/.test(id) || /^f\d+_\d+[a-z]$/.test(id);
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
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ - ЕДИНЫЙ ЭКЗЕМПЛЯР
// ============================================

// Создаем и экспортируем единственный экземпляр
export const idManager = new IdManager();

// Также экспортируем класс для возможности создания новых экземпляров (для тестов)
export default idManager;
