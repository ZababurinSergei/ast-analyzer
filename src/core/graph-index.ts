// packages/ast-analyzer/src/core/graph-index.ts
// ============================================
// ГРАФОВЫЙ ИНДЕКС ДЛЯ БЫСТРОЙ НАВИГАЦИИ
// ============================================

/**
 * Система индексов для графа зависимостей с поддержкой:
 * - Быстрого поиска по имени (инвертированный индекс)
 * - Поиска по типу сущности
 * - Поиска по модулю
 * - Поиска по пути вызовов
 * - Векторного поиска (embeddings) - готов к замене
 * - Поиска в окрестности (neighborhood search)
 */

export interface IndexableEntity {
  id: string; // Уникальный ID: module#entity
  name: string; // Имя сущности
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable' | 'module';
  module: string; // Родительский модуль
  line: number; // Строка объявления
  metadata: Record<string, any>; // Метаданные
  // Для векторного поиска
  embedding?: number[]; // Векторное представление (опционально)
  embeddingKey?: string; // Ключ для получения embedding из внешнего хранилища
}

export interface IndexableEdge {
  from: string; // ID источника
  to: string; // ID цели
  type: string; // Тип связи
  weight?: number; // Вес связи
  line?: number; // Строка кода
}

export interface SearchResult<T> {
  item: T;
  score: number; // Оценка релевантности (0-1)
  distance?: number; // Расстояние (для векторного поиска)
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'vector' | 'neighborhood';
  path?: string[]; // Путь в графе (для навигации)
}

export interface GraphIndexStats {
  totalEntities: number;
  totalEdges: number;
  totalModules: number;
  byType: Record<string, number>;
  byModule: Record<string, number>;
  avgDegree: number;
  maxDepth: number;
  hasCycles: boolean;
  cyclesCount: number;
}

// ============================================
// ОСНОВНОЙ КЛАСС ГРАФОВОГО ИНДЕКСА
// ============================================

export class GraphIndex {
  // Основные хранилища
  private entities: Map<string, IndexableEntity> = new Map();
  private edges: IndexableEdge[] = [];
  private adjacencyOut: Map<string, Set<string>> = new Map(); // Исходящие связи
  private adjacencyIn: Map<string, Set<string>> = new Map(); // Входящие связи

  // Инвертированные индексы
  private nameIndex: Map<string, Set<string>> = new Map(); // Имя -> ID сущностей
  private typeIndex: Map<string, Set<string>> = new Map(); // Тип -> ID сущностей
  private moduleIndex: Map<string, Set<string>> = new Map(); // Модуль -> ID сущностей
  private prefixIndex: Map<string, Set<string>> = new Map(); // Префикс имени -> ID

  // Кэш для быстрого доступа
  private moduleEntitiesCache: Map<string, IndexableEntity[]> = new Map();
  private typeEntitiesCache: Map<string, IndexableEntity[]> = new Map();

  // Статистика
  private stats: GraphIndexStats = {
    totalEntities: 0,
    totalEdges: 0,
    totalModules: 0,
    byType: {},
    byModule: {},
    avgDegree: 0,
    maxDepth: 0,
    hasCycles: false,
    cyclesCount: 0,
  };

  // Векторный индекс (заглушка для embeddings)
  private vectorIndex: Map<string, number[]> = new Map(); // ID -> embedding
  private vectorIndexReady = false;
  private embeddingProvider?: (text: string) => Promise<number[]>;

  constructor(embeddingProvider?: (text: string) => Promise<number[]>) {
    this.embeddingProvider = embeddingProvider;
  }

  // ============================================
  // 1. ПОСТРОЕНИЕ ИНДЕКСА
  // ============================================

  /**
   * Построить индекс из данных графа
   */
  build(
    entities: IndexableEntity[],
    edges: IndexableEdge[],
    options?: { generateEmbeddings?: boolean }
  ): void {
    console.log('🔨 Построение графового индекса...');
    const startTime = Date.now();

    // Очистка старых данных
    this.clear();

    // 1. Добавление сущностей
    for (const entity of entities) {
      this.addEntity(entity);
    }

    // 2. Добавление ребер
    for (const edge of edges) {
      this.addEdge(edge);
    }

    // 3. Построение инвертированных индексов
    this.buildInvertedIndexes();

    // 4. Расчет статистики
    this.calculateStats();

    // 5. Генерация embeddings (если требуется)
    if (options?.generateEmbeddings && this.embeddingProvider) {
      this.generateEmbeddings().catch(console.error);
    }

    console.log(`✅ Индекс построен за ${Date.now() - startTime}ms`);
    console.log(`   📊 Сущностей: ${this.stats.totalEntities}`);
    console.log(`   🔗 Ребер: ${this.stats.totalEdges}`);
    console.log(`   📁 Модулей: ${this.stats.totalModules}`);
  }

  /**
   * Добавить сущность в индекс
   */
  private addEntity(entity: IndexableEntity): void {
    const id = entity.id;

    // Основное хранилище
    this.entities.set(id, entity);

    // Обновляем статистику
    this.stats.totalEntities++;
    this.stats.byType[entity.type] = (this.stats.byType[entity.type] || 0) + 1;
    this.stats.byModule[entity.module] = (this.stats.byModule[entity.module] || 0) + 1;

    // Инициализируем списки смежности
    if (!this.adjacencyOut.has(id)) {
      this.adjacencyOut.set(id, new Set());
    }
    if (!this.adjacencyIn.has(id)) {
      this.adjacencyIn.set(id, new Set());
    }
  }

  /**
   * Добавить ребро в индекс
   */
  private addEdge(edge: IndexableEdge): void {
    this.edges.push(edge);
    this.stats.totalEdges++;

    // Обновляем списки смежности
    const outSet = this.adjacencyOut.get(edge.from);
    if (outSet) {
      outSet.add(edge.to);
    }

    const inSet = this.adjacencyIn.get(edge.to);
    if (inSet) {
      inSet.add(edge.from);
    }
  }

  /**
   * Построить инвертированные индексы
   */
  private buildInvertedIndexes(): void {
    console.log('   📇 Построение инвертированных индексов...');

    for (const [_id, entity] of this.entities) {
      // Индекс по имени (точное совпадение)
      this.addToIndex(this.nameIndex, entity.name, _id);

      // Индекс по имени (строчный вариант для регистронезависимого поиска)
      const lowerName = entity.name.toLowerCase();
      this.addToIndex(this.nameIndex, lowerName, _id);

      // Индекс по типу
      this.addToIndex(this.typeIndex, entity.type, _id);

      // Индекс по модулю
      this.addToIndex(this.moduleIndex, entity.module, _id);

      // Индекс по префиксу (для поиска по началу имени)
      const parts = entity.name.split(/[._-]/);
      for (const part of parts) {
        if (part.length >= 2) {
          this.addToIndex(this.prefixIndex, part, _id);
          this.addToIndex(this.prefixIndex, part.toLowerCase(), _id);
        }
      }

      // Префиксы для быстрого поиска (все возможные префиксы имени)
      for (let i = 2; i <= Math.min(entity.name.length, 10); i++) {
        const prefix = entity.name.substring(0, i);
        this.addToIndex(this.prefixIndex, prefix, _id);
        this.addToIndex(this.prefixIndex, prefix.toLowerCase(), _id);
      }
    }

    // Индексы для модулей (по имени модуля)
    for (const modulePath of Object.keys(this.stats.byModule)) {
      const moduleName = modulePath.split('/').pop() || modulePath;
      this.addToIndex(this.nameIndex, moduleName, modulePath);
      this.addToIndex(this.nameIndex, moduleName.toLowerCase(), modulePath);
    }
  }

  /**
   * Вспомогательная функция для добавления в индекс
   */
  private addToIndex(index: Map<string, Set<string>>, key: string, value: string): void {
    if (!key || !value) return;
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    const indexSet = index.get(key);
    if (indexSet) {
      indexSet.add(value);
    }
  }

  /**
   * Расчет статистики
   */
  private calculateStats(): void {
    // Количество модулей
    this.stats.totalModules = Object.keys(this.stats.byModule).length;

    // Средняя степень
    let totalDegree = 0;
    for (const [id] of this.entities) {
      const outDegree = this.adjacencyOut.get(id)?.size || 0;
      const inDegree = this.adjacencyIn.get(id)?.size || 0;
      totalDegree += outDegree + inDegree;
    }
    this.stats.avgDegree =
      this.stats.totalEntities > 0 ? totalDegree / this.stats.totalEntities : 0;

    // Поиск циклов (упрощенный)
    const cycles = this.findCycles();
    this.stats.hasCycles = cycles.length > 0;
    this.stats.cyclesCount = cycles.length;

    // Максимальная глубина (BFS от всех узлов)
    this.stats.maxDepth = this.calculateMaxDepth();
  }

  /**
   * Найти циклы в графе (упрощенная версия)
   */
  private findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string) => {
      if (recursionStack.has(nodeId)) {
        // Найден цикл
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = this.adjacencyOut.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor);
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
    };

    for (const [id] of this.entities) {
      if (!visited.has(id)) {
        dfs(id);
      }
    }

    return cycles;
  }

  /**
   * Вычислить максимальную глубину
   */
  private calculateMaxDepth(): number {
    let maxDepth = 0;
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);

      const neighbors = this.adjacencyOut.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor, depth + 1);
        }
      }
    };

    for (const [id] of this.entities) {
      if (!visited.has(id)) {
        dfs(id, 0);
      }
    }

    return maxDepth;
  }

  // ============================================
  // 2. ПОИСКОВЫЕ МЕТОДЫ
  // ============================================

  /**
   * Поиск по точному совпадению имени
   */
  searchExact(name: string, type?: string): SearchResult<IndexableEntity>[] {
    const results: SearchResult<IndexableEntity>[] = [];
    const ids = this.nameIndex.get(name) || new Set();

    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity && (!type || entity.type === type)) {
        results.push({
          item: entity,
          score: 1.0,
          matchType: 'exact',
        });
      }
    }

    return results;
  }

  /**
   * Поиск по префиксу (автодополнение)
   */
  searchByPrefix(prefix: string, limit?: number): SearchResult<IndexableEntity>[] {
    const results: SearchResult<IndexableEntity>[] = [];
    const lowerPrefix = prefix.toLowerCase();
    const ids = this.prefixIndex.get(lowerPrefix) || new Set();

    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity && entity.name.toLowerCase().startsWith(lowerPrefix)) {
        const score = prefix.length / entity.name.length;
        results.push({
          item: entity,
          score: Math.min(score, 1),
          matchType: 'prefix',
        });
      }
    }

    // Сортировка по релевантности
    results.sort((a, b) => b.score - a.score);
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Нечеткий поиск по имени (Levenshtein distance)
   */
  searchFuzzy(query: string, threshold = 0.7, limit?: number): SearchResult<IndexableEntity>[] {
    const results: SearchResult<IndexableEntity>[] = [];
    const queryLower = query.toLowerCase();

    for (const [_id, entity] of this.entities) {
      const nameLower = entity.name.toLowerCase();
      const distance = this.levenshteinDistance(queryLower, nameLower);
      const maxLen = Math.max(queryLower.length, nameLower.length);
      const score = maxLen > 0 ? 1 - distance / maxLen : 0;

      if (score >= threshold) {
        results.push({
          item: entity,
          score: score,
          matchType: 'fuzzy',
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Поиск по типу
   */
  searchByType(type: string): IndexableEntity[] {
    const ids = this.typeIndex.get(type) || new Set();
    const results: IndexableEntity[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) results.push(entity);
    }
    return results;
  }

  /**
   * Поиск по модулю
   */
  searchByModule(modulePath: string): IndexableEntity[] {
    const ids = this.moduleIndex.get(modulePath) || new Set();
    const results: IndexableEntity[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) results.push(entity);
    }
    return results;
  }

  /**
   * Поиск в окрестности (neighborhood search)
   */
  searchNeighborhood(
    entityId: string,
    depth: number = 2,
    maxResults: number = 50
  ): SearchResult<IndexableEntity>[] {
    const results: SearchResult<IndexableEntity>[] = [];
    const visited = new Set<string>();
    const queue: { id: string; path: string[]; distance: number }[] = [
      { id: entityId, path: [entityId], distance: 0 },
    ];

    while (queue.length > 0 && results.length < maxResults) {
      const { id, path, distance } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      const entity = this.entities.get(id);
      if (entity && id !== entityId) {
        const score = 1 - distance / depth;
        results.push({
          item: entity,
          score: Math.max(score, 0),
          matchType: 'neighborhood',
          path: path,
        });
      }

      if (distance < depth) {
        // Исходящие связи
        const outNeighbors = this.adjacencyOut.get(id) || new Set();
        for (const neighbor of outNeighbors) {
          if (!visited.has(neighbor)) {
            queue.push({
              id: neighbor,
              path: [...path, neighbor],
              distance: distance + 1,
            });
          }
        }

        // Входящие связи
        const inNeighbors = this.adjacencyIn.get(id) || new Set();
        for (const neighbor of inNeighbors) {
          if (!visited.has(neighbor)) {
            queue.push({
              id: neighbor,
              path: [...path, neighbor],
              distance: distance + 1,
            });
          }
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Поиск пути между двумя сущностями (BFS)
   */
  findPath(fromId: string, toId: string): string[] | null {
    if (fromId === toId) return [fromId];

    const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      const neighbors = this.adjacencyOut.get(id) || new Set();
      for (const neighbor of neighbors) {
        if (neighbor === toId) {
          return [...path, neighbor];
        }
        if (!visited.has(neighbor)) {
          queue.push({
            id: neighbor,
            path: [...path, neighbor],
          });
        }
      }
    }

    return null;
  }

  /**
   * Поиск всех путей между сущностями (ограниченная глубина)
   */
  findAllPaths(fromId: string, toId: string, maxDepth: number = 5): string[][] {
    const paths: string[][] = [];

    const dfs = (currentId: string, path: string[], depth: number) => {
      if (depth > maxDepth) return;
      if (path.includes(currentId)) return; // Предотвращаем циклы

      const newPath = [...path, currentId];

      if (currentId === toId) {
        paths.push(newPath);
        return;
      }

      const neighbors = this.adjacencyOut.get(currentId) || new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor, newPath, depth + 1);
      }
    };

    dfs(fromId, [], 0);
    return paths;
  }

  // ============================================
  // 3. ВЕКТОРНЫЙ ПОИСК (EMBEDDINGS)
  // ============================================

  /**
   * Генерирует embeddings для всех сущностей
   */
  async generateEmbeddings(): Promise<void> {
    if (!this.embeddingProvider) {
      console.warn('⚠️ Embedding provider not set');
      return;
    }

    console.log('🧠 Генерация embeddings для сущностей...');
    let count = 0;

    for (const [id, entity] of this.entities) {
      // Используем id для логирования и отслеживания прогресса
      if (count % 10 === 0 && count > 0) {
        console.log(`   📊 Обработано ${count} сущностей, текущий ID: ${id}`);
      }

      if (!this.vectorIndex.has(id)) {
        try {
          const text = this.getEntityText(entity);
          const embedding = await this.embeddingProvider(text);
          this.vectorIndex.set(id, embedding);
          count++;
        } catch (error) {
          console.warn(`   ⚠️ Failed to generate embedding for ${entity.name} (${id}):`, error);
        }
      }
    }

    this.vectorIndexReady = true;
    console.log(`   ✅ Generated ${count} embeddings`);
  }

  /**
   * Получить текстовое представление сущности для embedding
   */
  private getEntityText(entity: IndexableEntity): string {
    const parts = [entity.type, entity.name, entity.module];

    if (entity.metadata.params) {
      parts.push(`params: ${entity.metadata.params.join(', ')}`);
    }
    if (entity.metadata.returnType) {
      parts.push(`returns: ${entity.metadata.returnType}`);
    }
    if (entity.metadata.properties) {
      parts.push(`properties: ${entity.metadata.properties.join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Векторный поиск (cosine similarity)
   */
  async searchByVector(
    query: string | number[],
    topK: number = 10,
    threshold: number = 0.5
  ): Promise<SearchResult<IndexableEntity>[]> {
    if (!this.vectorIndexReady && this.embeddingProvider) {
      await this.generateEmbeddings();
    }

    if (!this.vectorIndexReady) {
      console.warn('⚠️ Vector index not ready, falling back to text search');
      return this.searchByPrefix(query as string, topK);
    }

    // Получаем query embedding
    let queryEmbedding: number[];
    if (typeof query === 'string') {
      if (!this.embeddingProvider) {
        return this.searchByPrefix(query, topK);
      }
      queryEmbedding = await this.embeddingProvider(query);
    } else {
      queryEmbedding = query;
    }

    // Вычисляем similarity для всех сущностей
    const results: SearchResult<IndexableEntity>[] = [];

    for (const [id, embedding] of this.vectorIndex) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      if (similarity >= threshold) {
        const entity = this.entities.get(id);
        if (entity) {
          results.push({
            item: entity,
            score: similarity,
            distance: 1 - similarity,
            matchType: 'vector',
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Cosine similarity между двумя векторами с проверками
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    // Проверка на null/undefined
    if (!a || !b || a.length === 0 || b.length === 0) {
      return 0;
    }

    const minLen = Math.min(a.length, b.length);
    if (minLen === 0) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      const aVal = i < a.length ? (a[i] ?? 0) : 0;
      const bVal = i < b.length ? (b[i] ?? 0) : 0;
      dot += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ============================================
  // 4. МЕТОДЫ ДЛЯ НАВИГАЦИИ
  // ============================================

  /**
   * Получить соседей сущности (исходящие связи)
   */
  getOutgoing(entityId: string): IndexableEntity[] {
    const neighbors = this.adjacencyOut.get(entityId) || new Set();
    const result: IndexableEntity[] = [];
    for (const id of neighbors) {
      const entity = this.entities.get(id);
      if (entity) result.push(entity);
    }
    return result;
  }

  /**
   * Получить соседей сущности (входящие связи)
   */
  getIncoming(entityId: string): IndexableEntity[] {
    const neighbors = this.adjacencyIn.get(entityId) || new Set();
    const result: IndexableEntity[] = [];
    for (const id of neighbors) {
      const entity = this.entities.get(id);
      if (entity) result.push(entity);
    }
    return result;
  }

  /**
   * Получить все связи сущности
   */
  getConnections(entityId: string): {
    outgoing: IndexableEntity[];
    incoming: IndexableEntity[];
  } {
    return {
      outgoing: this.getOutgoing(entityId),
      incoming: this.getIncoming(entityId),
    };
  }

  /**
   * Получить сущность по ID
   */
  getEntity(id: string): IndexableEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Получить все сущности
   */
  getAllEntities(): IndexableEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Получить все ребра
   */
  getAllEdges(): IndexableEdge[] {
    return [...this.edges];
  }

  /**
   * Получить статистику
   */
  getStats(): GraphIndexStats {
    return { ...this.stats };
  }

  // ============================================
  // 5. УТИЛИТЫ
  // ============================================

  /**
   * Levenshtein distance для нечеткого поиска с проверками
   */
  private levenshteinDistance(a: string, b: string): number {
    // Проверка на null/undefined
    if (!a && !b) return 0;
    if (!a || a.length === 0) return b ? b.length : 0;
    if (!b || b.length === 0) return a ? a.length : 0;

    const matrix: number[][] = [];
    const aLen = a.length;
    const bLen = b.length;

    // Инициализация матрицы
    for (let i = 0; i <= aLen; i++) {
      matrix[i] = [i];
    }

    // Проверяем, что matrix[0] существует
    if (!matrix[0]) {
      matrix[0] = [];
    }
    for (let j = 0; j <= bLen; j++) {
      if (matrix[0]) {
        matrix[0][j] = j;
      }
    }

    // Заполнение матрицы с проверками
    for (let i = 1; i <= aLen; i++) {
      // Проверяем, что строка существует
      if (!matrix[i]) {
        matrix[i] = [];
      }

      const prevRow = matrix[i - 1];
      const currRow = matrix[i];

      for (let j = 1; j <= bLen; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        // Проверяем существование всех элементов перед доступом
        let val1 = Infinity;
        let val2 = Infinity;
        let val3 = Infinity;

        // Проверяем, что prevRow существует и имеет нужные индексы
        if (prevRow) {
          const prevRowJ = prevRow[j];
          const prevRowJMinus1 = prevRow[j - 1];
          val1 = (prevRowJ !== undefined ? prevRowJ : 0) + 1;
          val3 = (prevRowJMinus1 !== undefined ? prevRowJMinus1 : 0) + cost;
        }

        // Проверяем, что currRow существует и имеет нужные индексы
        if (currRow) {
          const currRowJMinus1 = currRow[j - 1];
          val2 = (currRowJMinus1 !== undefined ? currRowJMinus1 : 0) + 1;
        }

        // Проверяем, что matrix[i] существует перед записью
        if (!matrix[i]) {
          matrix[i] = [];
        }

        // Проверяем, что currRow существует
        if (!currRow) {
          // Убеждаемся, что matrix[i] существует
          if (!matrix[i]) {
            matrix[i] = [];
          }

          // @ts-ignore
          matrix[i][j] = Math.max(i, j);
          continue;
        }

        // Убеждаемся, что matrix[i] существует
        if (!matrix[i]) {
          matrix[i] = [];
        }

        // Проверяем, что matrix[i][j] существует перед записью
        if (!matrix[i]) {
          matrix[i] = [];
        }

        // Теперь безопасно записываем значение
        // @ts-ignore
        matrix[i][j] = Math.min(val1, val2, val3);
      }
    }

    // Проверяем, что результат существует
    const resultRow = matrix[aLen];
    const result = resultRow ? resultRow[bLen] : undefined;
    return result !== undefined ? result : Math.max(aLen, bLen);
  }

  /**
   * Очистка индекса
   */
  clear(): void {
    this.entities.clear();
    this.edges = [];
    this.adjacencyOut.clear();
    this.adjacencyIn.clear();
    this.nameIndex.clear();
    this.typeIndex.clear();
    this.moduleIndex.clear();
    this.prefixIndex.clear();
    this.moduleEntitiesCache.clear();
    this.typeEntitiesCache.clear();
    this.vectorIndex.clear();
    this.vectorIndexReady = false;
    this.stats = {
      totalEntities: 0,
      totalEdges: 0,
      totalModules: 0,
      byType: {},
      byModule: {},
      avgDegree: 0,
      maxDepth: 0,
      hasCycles: false,
      cyclesCount: 0,
    };
  }

  /**
   * Экспорт индекса в JSON
   */
  exportToJSON(): string {
    const data = {
      entities: Array.from(this.entities.values()),
      edges: this.edges,
      stats: this.stats,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Импорт индекса из JSON
   */
  importFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.clear();

    for (const entity of data.entities) {
      this.addEntity(entity);
    }

    for (const edge of data.edges) {
      this.addEdge(edge);
    }

    this.buildInvertedIndexes();
    this.calculateStats();
  }
}

// ============================================
// 6. ФАБРИКА ДЛЯ СОЗДАНИЯ ИНДЕКСА ИЗ ДАННЫХ
// ============================================

export class GraphIndexFactory {
  /**
   * Создать индекс из данных анализа
   */
  static fromAnalysisData(
    data: {
      rootKey: string;
      graph: Record<string, string[]>;
      entities?: Record<string, any>;
    },
    options?: {
      includeModules?: boolean;
      includeFunctions?: boolean;
      includeClasses?: boolean;
      includeConstants?: boolean;
      includeInterfaces?: boolean;
      includeTypes?: boolean;
      includeVariables?: boolean;
      embeddingProvider?: (text: string) => Promise<number[]>;
    }
  ): GraphIndex {
    const index = new GraphIndex(options?.embeddingProvider);
    const entities: IndexableEntity[] = [];
    const edges: IndexableEdge[] = [];

    // Добавляем модули как сущности
    if (options?.includeModules !== false) {
      for (const [modulePath] of Object.entries(data.graph)) {
        const entity: IndexableEntity = {
          id: modulePath,
          name: modulePath.split('/').pop() || modulePath,
          type: 'module',
          module: modulePath,
          line: 0,
          metadata: {
            isRoot: modulePath === data.rootKey,
            dependencies: data.graph[modulePath] || [],
          },
        };
        entities.push(entity);
      }
    }

    // Добавляем сущности из entities
    if (data.entities) {
      for (const [modulePath, moduleEntities] of Object.entries(data.entities)) {
        // Используем id для построения уникальных идентификаторов
        const moduleId = modulePath;

        // Функции
        if (options?.includeFunctions !== false && moduleEntities.functions) {
          for (const func of moduleEntities.functions) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${func.name}`,
              name: func.name,
              type: 'function',
              module: modulePath,
              line: func.line || 0,
              metadata: {
                isAsync: func.isAsync || false,
                isExported: func.isExported || false,
                params: func.params || [],
                returnType: func.returnType,
                isMethod: func.isMethod || false,
                className: func.className,
                isNested: func.isNested || false,
                parentFunction: func.parentFunction,
                isArrow: func.isArrow || false,
                isEventHandler: func.isEventHandler || false,
                eventType: func.eventType,
                depth: func.depth || 0,
                calls: func.calls || [],
                calledBy: func.calledBy || [],
              },
            };
            entities.push(entity);
          }
        }

        // Классы
        if (options?.includeClasses !== false && moduleEntities.classes) {
          for (const cls of moduleEntities.classes) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${cls.name}`,
              name: cls.name,
              type: 'class',
              module: modulePath,
              line: cls.line || 0,
              metadata: {
                isExported: cls.isExported || false,
                methods: cls.methods || [],
                properties: cls.properties || [],
                extends: cls.extends,
                implements: cls.implements || [],
              },
            };
            entities.push(entity);
          }
        }

        // Константы
        if (options?.includeConstants !== false && moduleEntities.constants) {
          for (const const_ of moduleEntities.constants) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${const_.name}`,
              name: const_.name,
              type: 'constant',
              module: modulePath,
              line: const_.line || 0,
              metadata: {
                isExported: const_.isExported || false,
                value: const_.value,
                type: const_.type,
              },
            };
            entities.push(entity);
          }
        }

        // Интерфейсы
        if (options?.includeInterfaces !== false && moduleEntities.interfaces) {
          for (const intf of moduleEntities.interfaces) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${intf.name}`,
              name: intf.name,
              type: 'interface',
              module: modulePath,
              line: intf.line || 0,
              metadata: {
                isExported: intf.isExported || false,
                properties: intf.properties || [],
                extends: intf.extends || [],
              },
            };
            entities.push(entity);
          }
        }

        // Типы
        if (options?.includeTypes !== false && moduleEntities.types) {
          for (const type of moduleEntities.types) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${type.name}`,
              name: type.name,
              type: 'type',
              module: modulePath,
              line: type.line || 0,
              metadata: {
                isExported: type.isExported || false,
                definition: type.definition,
              },
            };
            entities.push(entity);
          }
        }

        // Переменные
        if (options?.includeVariables !== false && moduleEntities.variables) {
          for (const var_ of moduleEntities.variables) {
            const entity: IndexableEntity = {
              id: `${moduleId}#${var_.name}`,
              name: var_.name,
              type: 'variable',
              module: modulePath,
              line: var_.line || 0,
              metadata: {
                isExported: var_.isExported || false,
                value: var_.value,
                type: var_.type,
              },
            };
            entities.push(entity);
          }
        }
      }
    }

    // Добавляем ребра (вызовы функций)
    for (const [from, toList] of Object.entries(data.graph)) {
      for (const to of toList) {
        // Проверяем, существует ли целевая сущность
        const targetId = to;
        if (entities.some(e => e.id === targetId || e.id === `${to}`)) {
          edges.push({
            from: from,
            to: targetId,
            type: 'import',
            weight: 1,
          });
        }
      }
    }

    // Добавляем ребра вызовов из metadata
    for (const entity of entities) {
      if (entity.type === 'function' && entity.metadata.calls) {
        for (const call of entity.metadata.calls) {
          // Ищем целевую функцию
          const targetEntity = entities.find(
            e => e.name === call || e.id === call || e.id.endsWith(`#${call}`)
          );
          if (targetEntity) {
            edges.push({
              from: entity.id,
              to: targetEntity.id,
              type: 'function_call',
              weight: 1,
            });
          }
        }
      }
    }

    // Строим индекс
    index.build(entities, edges, { generateEmbeddings: !!options?.embeddingProvider });

    return index;
  }

  /**
   * Создать индекс из массива сущностей
   */
  static fromEntities(
    entities: IndexableEntity[],
    edges: IndexableEdge[],
    embeddingProvider?: (text: string) => Promise<number[]>
  ): GraphIndex {
    const index = new GraphIndex(embeddingProvider);
    index.build(entities, edges);
    return index;
  }
}

// ============================================
// 7. ИНТЕРФЕЙС ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

export interface IGraphNavigator {
  // Поиск
  searchExact(name: string, type?: string): SearchResult<IndexableEntity>[];
  searchByPrefix(prefix: string, limit?: number): SearchResult<IndexableEntity>[];
  searchFuzzy(query: string, threshold?: number, limit?: number): SearchResult<IndexableEntity>[];
  searchByType(type: string): IndexableEntity[];
  searchByModule(modulePath: string): IndexableEntity[];
  searchNeighborhood(
    entityId: string,
    depth?: number,
    maxResults?: number
  ): SearchResult<IndexableEntity>[];
  searchByVector(
    query: string | number[],
    topK?: number,
    threshold?: number
  ): Promise<SearchResult<IndexableEntity>[]>;

  // Навигация
  getEntity(id: string): IndexableEntity | undefined;
  getOutgoing(entityId: string): IndexableEntity[];
  getIncoming(entityId: string): IndexableEntity[];
  getConnections(entityId: string): { outgoing: IndexableEntity[]; incoming: IndexableEntity[] };
  findPath(fromId: string, toId: string): string[] | null;
  findAllPaths(fromId: string, toId: string, maxDepth?: number): string[][];

  // Данные
  getAllEntities(): IndexableEntity[];
  getAllEdges(): IndexableEdge[];
  getStats(): GraphIndexStats;

  // Сериализация
  exportToJSON(): string;
  importFromJSON(json: string): void;
}

export default GraphIndex;
