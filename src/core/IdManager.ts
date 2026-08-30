// src/core/IdManager.ts
import { createHash } from 'crypto';
import path from 'path';

export interface IdContext {
  filePath: string;
  funcName: string;
  line: number;
  parentFunction?: string;
  depth?: number;
  componentName?: string;
  type?: 'function' | 'vue' | 'class' | 'constant' | 'interface' | 'type';
}

export class IdManager {
  private idMap: Map<string, string> = new Map();
  private usedIds: Set<string> = new Set();
  private debug: boolean = false;

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
   * Генерирует уникальный стабильный ID для функции
   */
  getFunctionId(context: IdContext): string {
    const { filePath, funcName, line, parentFunction, depth = 0, type = 'function' } = context;

    // 1. Нормализуем путь (абсолютный для стабильности)
    const absolutePath = path.resolve(filePath);

    // 2. Создаем контекстный ключ
    const contextKey = this.buildContextKey(absolutePath, funcName, line, parentFunction, depth);

    // 3. Проверяем кэш
    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    // 4. Генерируем уникальный хеш
    const hash = this.generateHash(contextKey);

    // 5. Санитайзим имя для читаемости
    const safeName = this.sanitizeName(funcName);

    // 6. Формируем ID с учетом типа
    const prefix = type === 'vue' ? 'vue' : 'func';
    let id = `${prefix}_${hash}_${safeName}`;

    // 7. Гарантируем уникальность (защита от коллизий)
    let counter = 0;
    while (this.usedIds.has(id)) {
      counter++;
      id = `${prefix}_${hash}_${safeName}_${counter}`;
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
    const absolutePath = path.resolve(filePath);
    const contextKey = `${absolutePath}:class:${className}:${line}`;

    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    const hash = this.generateHash(contextKey);
    const safeName = this.sanitizeName(className);
    const id = `class_${hash}_${safeName}`;

    let counter = 0;
    let finalId = id;
    while (this.usedIds.has(finalId)) {
      counter++;
      finalId = `class_${hash}_${safeName}_${counter}`;
    }

    this.idMap.set(contextKey, finalId);
    this.usedIds.add(finalId);

    return finalId;
  }

  /**
   * Генерирует ID для константы
   */
  getConstantId(filePath: string, constName: string, line: number): string {
    const absolutePath = path.resolve(filePath);
    const contextKey = `${absolutePath}:const:${constName}:${line}`;

    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    const hash = this.generateHash(contextKey);
    const safeName = this.sanitizeName(constName);
    const id = `const_${hash}_${safeName}`;

    let counter = 0;
    let finalId = id;
    while (this.usedIds.has(finalId)) {
      counter++;
      finalId = `const_${hash}_${safeName}_${counter}`;
    }

    this.idMap.set(contextKey, finalId);
    this.usedIds.add(finalId);

    return finalId;
  }

  /**
   * Генерирует ID для интерфейса
   */
  getInterfaceId(filePath: string, interfaceName: string, line: number): string {
    const absolutePath = path.resolve(filePath);
    const contextKey = `${absolutePath}:interface:${interfaceName}:${line}`;

    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    const hash = this.generateHash(contextKey);
    const safeName = this.sanitizeName(interfaceName);
    const id = `intf_${hash}_${safeName}`;

    let counter = 0;
    let finalId = id;
    while (this.usedIds.has(finalId)) {
      counter++;
      finalId = `intf_${hash}_${safeName}_${counter}`;
    }

    this.idMap.set(contextKey, finalId);
    this.usedIds.add(finalId);

    return finalId;
  }

  /**
   * Генерирует ID для типа
   */
  getTypeId(filePath: string, typeName: string, line: number): string {
    const absolutePath = path.resolve(filePath);
    const contextKey = `${absolutePath}:type:${typeName}:${line}`;

    if (this.idMap.has(contextKey)) {
      return this.idMap.get(contextKey)!;
    }

    const hash = this.generateHash(contextKey);
    const safeName = this.sanitizeName(typeName);
    const id = `type_${hash}_${safeName}`;

    let counter = 0;
    let finalId = id;
    while (this.usedIds.has(finalId)) {
      counter++;
      finalId = `type_${hash}_${safeName}_${counter}`;
    }

    this.idMap.set(contextKey, finalId);
    this.usedIds.add(finalId);

    return finalId;
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
    return this.usedIds.has(id);
  }

  /**
   * Очистить кэш
   */
  clear(): void {
    this.idMap.clear();
    this.usedIds.clear();
    if (this.debug) {
      console.log('🧹 [IdManager] Cache cleared');
    }
  }

  /**
   * Получить статистику
   */
  getStats(): { total: number; unique: number } {
    return {
      total: this.idMap.size,
      unique: this.usedIds.size,
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
    sampleMappings: { key: string; id: string }[];
  } {
    const sampleMappings: { key: string; id: string }[] = [];
    let count = 0;

    for (const [key, id] of this.idMap) {
      if (count < 10) {
        sampleMappings.push({ key, id });
        count++;
      } else {
        break;
      }
    }

    return {
      totalMappings: this.idMap.size,
      totalIds: this.usedIds.size,
      sampleMappings,
    };
  }
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ - ЕДИНЫЙ ЭКЗЕМПЛЯР
// ============================================

// Создаем и экспортируем единственный экземпляр
export const idManager = new IdManager();

// Также экспортируем класс для возможности создания новых экземпляров (для тестов)
export default idManager;
