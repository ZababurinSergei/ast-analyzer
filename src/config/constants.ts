// src/config/constants.ts - НОВЫЙ ФАЙЛ
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
// ПРОЧИЕ КОНСТАНТЫ
// ============================================

export const IGNORE_NODE_MODULES = true;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DEPTH_DEFAULT = 10;
export const MAX_DEPTH_PROJECT = 5;

// Типы для констант
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];
export type ExcludePattern = (typeof DEFAULT_EXCLUDE_PATTERNS)[number];
