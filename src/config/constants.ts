// src/config/constants.ts
/**
 * Единый источник конфигурационных констант
 * Все константы собраны в одном месте для предотвращения дублирования
 */

// ============================================
// РАСШИРЕНИЯ ФАЙЛОВ
// ============================================

export const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'] as const;

export const SUPPORTED_EXTENSIONS_SET = new Set(SUPPORTED_EXTENSIONS);

// ============================================
// ПАТТЕРНЫ ИСКЛЮЧЕНИЯ
// ============================================

export const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.cache',
  '.next',
  'out',
  '.nuxt',
  '.output',
  '.vercel',
  'tmp',
  'temp',
] as string[];

export const EXCLUDE_PATTERNS_SET = new Set(DEFAULT_EXCLUDE_PATTERNS);

// ============================================
// VUE ПАТТЕРНЫ
// ============================================

export const VUE_SCRIPT_PATTERN = /<script[^>]*>([\s\S]*?)<\/script>/i;
export const VUE_SCRIPT_SETUP_PATTERN = /<script\s+setup[^>]*>/i;

// ============================================
// ✅ НОВОЕ v14.0.0: CALLBACK-МЕТОДЫ
// ============================================
//
// Методы, первый аргумент которых — анонимная функция-колбэк.
// Используется в `extract-entities-from-ast.ts` для генерации
// callback-рёбер графа вызовов (gr.c с typeCode = 3 = callback).
//
// Единственное место расширения списка — при необходимости
// добавьте новые методы сюда.
//
// Категории:
//   - Array methods        — filter, map, reduce, forEach, ...
//   - Promise methods      — then, catch, finally
//   - Event listeners      — addEventListener, removeEventListener, ...
//   - Timers               — setTimeout, setInterval, requestAnimationFrame, ...
//   - Vue lifecycle        — onMounted, onUnmounted, watch, watchEffect, ...
//   - Subscription         — subscribe, unsubscribe
// ============================================

export const CALLBACK_METHODS = new Set<string>([
  // Array methods
  'filter',
  'map',
  'reduce',
  'reduceRight',
  'forEach',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'sort',

  // Promise methods
  'then',
  'catch',
  'finally',

  // Event listeners
  'addEventListener',
  'removeEventListener',
  'once',
  'on',

  // Timers
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'queueMicrotask',

  // Vue lifecycle & reactivity
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
  'onMounted',
  'onUnmounted',
  'onScopeDispose',
  'onActivated',
  'onDeactivated',
  'onErrorCaptured',
  'nextTick',

  // Subscription patterns
  'subscribe',
  'unsubscribe',
]);

// ============================================
// ПРОЧИЕ КОНСТАНТЫ
// ============================================

export const IGNORE_NODE_MODULES = true;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DEPTH_DEFAULT = 10;
export const MAX_DEPTH_PROJECT = 5;

// ============================================
// ТИПЫ ДЛЯ КОНСТАНТ
// ============================================

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
export type ExcludePattern = (typeof DEFAULT_EXCLUDE_PATTERNS)[number];
