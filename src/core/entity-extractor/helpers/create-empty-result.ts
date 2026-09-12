// packages/ast-analyzer/src/core/entity-extractor/helpers/create-empty-result.ts
import path from 'path';
import type { EntitiesResult } from '../../../types.js';

/**
 * Создает пустой результат сущностей
 */
export function createEmptyEntitiesResult(filePath?: string): EntitiesResult {
  return {
    functions: [],
    classes: [],
    constants: [],
    interfaces: [],
    types: [],
    variables: [],
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: filePath ? path.basename(filePath) : 'unknown',
    filePath: filePath || 'unknown',
  };
}
