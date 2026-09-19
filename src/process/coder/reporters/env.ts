// src/reporters/env.ts
import path from 'path';

/**
 * Пресеты путей для различных окружений
 */
export type EnvPreset = 'infoenergo-ui' | 'development' | 'production' | 'test' | 'monorepo' | 'custom';

export interface EnvConfig {
  rootPath: string;
}

/**
 * Возвращает корневой путь для указанного пресета
 */
export function getRootPath(preset: EnvPreset = 'development', customPath?: string): string {
  switch (preset) {
    case 'infoenergo-ui':
      return path.resolve('/home/sergei/Desktop/system/packages/ast-analyzer/infoenergo-ui');
    case 'development':
      return path.resolve(process.cwd());
    case 'production':
      return path.resolve(process.cwd());
    case 'test':
      return path.resolve(process.cwd(), 'test');
    case 'monorepo':
      return path.resolve(process.cwd(), 'packages/ast-analyzer');
    case 'custom':
      return customPath ? path.resolve(customPath) : path.resolve(process.cwd());
    default:
      return path.resolve(process.cwd());
  }
}

/**
 * Генерирует символ для подстановки пути в отчетах
 */
export function getPathSymbol(): string {
  return '__AST_ROOT_PATH__';
}

export default {
  getRootPath,
  getPathSymbol,
};
