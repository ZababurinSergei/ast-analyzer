// packages/ast-analyzer/src/core/graph-index-integration.ts
// ============================================
// ИНТЕГРАЦИЯ ГРАФОВОГО ИНДЕКСА С АНАЛИЗАТОРОМ
// ============================================

import type {
  GraphIndex,
  IndexableEntity,
  IndexableEdge,
  SearchResult,
  GraphIndexStats
} from './graph-index.js';
import { GraphIndexFactory } from './graph-index.js';
import type { EntitiesResult } from './entity-extractor.js';

export class GraphIndexIntegration {
  private index: GraphIndex | null = null;

  /**
   * Создать индекс из результатов анализа
   */
  buildFromAnalysis(
    graphData: {
      rootKey: string;
      graph: Record<string, string[]>;
    },
    entitiesMap: Record<string, EntitiesResult>,
    options?: {
      embeddingProvider?: (text: string) => Promise<number[]>;
      includeModules?: boolean;
      includeFunctions?: boolean;
      includeClasses?: boolean;
      includeConstants?: boolean;
      includeInterfaces?: boolean;
      includeTypes?: boolean;
      includeVariables?: boolean;
    }
  ): GraphIndex {
    // Преобразуем entitiesMap в формат для фабрики
    const data = {
      rootKey: graphData.rootKey,
      graph: graphData.graph,
      entities: entitiesMap,
    };

    this.index = GraphIndexFactory.fromAnalysisData(data, {
      includeModules: options?.includeModules !== false,
      includeFunctions: options?.includeFunctions !== false,
      includeClasses: options?.includeClasses !== false,
      includeConstants: options?.includeConstants !== false,
      includeInterfaces: options?.includeInterfaces !== false,
      includeTypes: options?.includeTypes !== false,
      includeVariables: options?.includeVariables !== false,
      embeddingProvider: options?.embeddingProvider,
    });

    return this.index;
  }

  /**
   * Поиск по точному имени с контекстом
   */
  searchExactWithContext(
    name: string,
    context?: { module?: string; type?: string }
  ): SearchResult<IndexableEntity>[] {
    if (!this.index) throw new Error('Index not built');

    let results = this.index.searchExact(name, context?.type);

    if (context?.module) {
      results = results.filter(r => r.item.module === context.module);
    }

    return results;
  }

  /**
   * Интеллектуальный поиск с автоопределением типа
   */
  smartSearch(
    query: string,
    options?: {
      module?: string;
      fuzzyThreshold?: number;
      maxResults?: number;
    }
  ): SearchResult<IndexableEntity>[] {
    if (!this.index) throw new Error('Index not built');

    // 1. Точное совпадение
    let results = this.index.searchExact(query);

    // 2. Если точных совпадений нет или мало, пробуем префикс
    if (results.length < 2) {
      results = this.index.searchByPrefix(query, 10);
    }

    // 3. Если все еще мало, пробуем нечеткий поиск
    if (results.length < 2) {
      results = this.index.searchFuzzy(query, options?.fuzzyThreshold || 0.6, 10);
    }

    // 4. Фильтр по модулю
    if (options?.module) {
      results = results.filter(r => r.item.module === options.module);
    }

    // 5. Сортировка по релевантности
    results.sort((a, b) => b.score - a.score);

    return options?.maxResults ? results.slice(0, options.maxResults) : results;
  }

  /**
   * Получить контекст сущности (модуль + соседи)
   */
  getEntityContext(entityId: string, depth: number = 2): {
    entity: IndexableEntity | undefined;
    neighbors: {
      outgoing: IndexableEntity[];
      incoming: IndexableEntity[];
    };
    neighborhood: SearchResult<IndexableEntity>[];
    stats: {
      totalConnections: number;
      depth: number;
    };
  } {
    if (!this.index) throw new Error('Index not built');

    const entity = this.index.getEntity(entityId);
    if (!entity) {
      return {
        entity: undefined,
        neighbors: { outgoing: [], incoming: [] },
        neighborhood: [],
        stats: { totalConnections: 0, depth: 0 },
      };
    }

    const connections = this.index.getConnections(entityId);
    const neighborhood = this.index.searchNeighborhood(entityId, depth);

    return {
      entity,
      neighbors: connections,
      neighborhood,
      stats: {
        totalConnections: connections.outgoing.length + connections.incoming.length,
        depth,
      },
    };
  }

  /**
   * Найти путь между сущностями с метаданными
   */
  findPathWithMetadata(fromId: string, toId: string): {
    path: string[] | null;
    entities: IndexableEntity[];
    edges: IndexableEdge[];
    length: number;
  } | null {
    if (!this.index) throw new Error('Index not built');

    const path = this.index.findPath(fromId, toId);
    if (!path) return null;

    const entities: IndexableEntity[] = [];
    const edges: IndexableEdge[] = [];

    for (const id of path) {
      const entity = this.index.getEntity(id);
      if (entity) entities.push(entity);
    }

    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.index.getAllEdges().find(e =>
        e.from === path[i] && e.to === path[i + 1]
      );
      if (edge) edges.push(edge);
    }

    return {
      path,
      entities,
      edges,
      length: path.length,
    };
  }

  /**
   * Получить статистику в удобном формате
   */
  getFormattedStats(): {
    summary: string;
    details: GraphIndexStats;
    topModules: { module: string; count: number }[];
    topTypes: { type: string; count: number }[];
  } {
    if (!this.index) throw new Error('Index not built');

    const stats = this.index.getStats();

    // Топ модулей
    const topModules = Object.entries(stats.byModule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([module, count]) => ({ module, count }));

    // Топ типов
    const topTypes = Object.entries(stats.byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const summary = [
      `📊 Всего сущностей: ${stats.totalEntities}`,
      `🔗 Всего ребер: ${stats.totalEdges}`,
      `📁 Модулей: ${stats.totalModules}`,
      `🔄 Циклов: ${stats.cyclesCount}`,
      `📏 Макс. глубина: ${stats.maxDepth}`,
      `📈 Средняя степень: ${stats.avgDegree.toFixed(2)}`,
    ].join('\n');

    return {
      summary,
      details: stats,
      topModules,
      topTypes,
    };
  }

  /**
   * Получить индекс для прямого использования
   */
  getIndex(): GraphIndex | null {
    return this.index;
  }
}

// ============================================
// 8. ВЕКТОРНЫЙ ПРОВАЙДЕР (заглушка для замены)
// ============================================

export interface IEmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Простой провайдер для тестирования (TF-IDF)
 */
export class SimpleEmbeddingProvider implements IEmbeddingProvider {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private dimension: number = 128;
  private trained = false;

  constructor(dimension: number = 128) {
    this.dimension = dimension;
  }

  /**
   * Обучить на текстах
   */
  train(texts: string[]): void {
    const docFreq = new Map<string, number>();

    for (const text of texts) {
      const words = this.tokenize(text);
      const unique = new Set(words);
      for (const word of unique) {
        docFreq.set(word, (docFreq.get(word) || 0) + 1);
      }
    }

    // Вычисляем IDF
    const N = texts.length;
    for (const [word, freq] of docFreq) {
      const idfValue = Math.log(N / (1 + freq));
      this.idf.set(word, idfValue);
    }

    // Строим словарь (топ слов по IDF)
    this.vocabulary = new Map(
      Array.from(this.idf.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, this.dimension)
        .map(([word], index) => [word, index])
    );

    this.trained = true;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.trained) {
      this.train([text]);
    }

    const vector = new Array(this.dimension).fill(0);
    const words = this.tokenize(text);

    for (const word of words) {
      const lowerWord = word.toLowerCase();
      const index = this.vocabulary.get(lowerWord);

      if (index !== undefined && index < this.dimension) {
        const idfValue = this.idf.get(lowerWord) || 1;
        vector[index] += idfValue;
      }
    }

    // Нормализация
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.trained) {
      this.train(texts);
    }
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9_]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }
}

export default GraphIndexIntegration;
