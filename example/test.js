import * as Core from './ast-analyzer-core.js';

// Пример 1: базовый
await Core.loadFromRoot();

// Пример 2: кастомный путь и TTL
await Core.loadFromRoot({
  basePath: './data/',
  cacheTTL: 60_000,   // 1 минута
});

// Пример 3: без кэша и без fallback
await Core.loadFromRoot({
  useCache: false,
  fallbackToFilePicker: false,
});

// Пример 4: сканировать директорию
await Core.loadFromRoot({ scanDir: true });
