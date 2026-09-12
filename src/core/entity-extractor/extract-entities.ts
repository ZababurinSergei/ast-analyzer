// packages/ast-analyzer/src/core/entity-extractor/extract-entities.ts
import path from 'path';
import { analyzeVueComponent } from '../../modes/vue-analyzer.js';
import type { EntitiesResult } from '../../types.js';
import { createEmptyEntitiesResult } from './helpers/create-empty-result.js';
import { convertVueAnalysisToEntities } from './vue/convert-analysis.js';
import { extractEntitiesFromAST } from './ast/extract-entities-from-ast.js';

/**
 * Извлекает все сущности из AST
 *
 * @param ast      — AST-дерево
 * @param filePath — путь к файлу (опционально)
 * @returns EntitiesResult — результат анализа
 */
export function extractEntities(ast: any, filePath?: string): EntitiesResult {
    // ==========================================\
    // ЗАЩИТА ОТ ПУСТОГО AST\
    // ==========================================\
    if (!ast || !ast.body) {
        return createEmptyEntitiesResult(filePath);
    }

    if (!Array.isArray(ast.body)) {
        console.warn(
            `⚠️ AST.body не является массивом для ${filePath || 'unknown'}, пропускаем`
        );
        return createEmptyEntitiesResult(filePath);
    }

    // ==========================================\
    // ЕСЛИ ЭТО VUE-ФАЙЛ — ИСПОЛЬЗУЕМ СПЕЦИАЛЬНЫЙ АНАЛИЗАТОР\
    // ==========================================\
    if (filePath?.endsWith('.vue')) {
        try {
            const vueAnalysis = analyzeVueComponent(filePath);
            if (vueAnalysis) {
                console.log(`🎯 Используем Vue-анализатор для ${path.basename(filePath)}`);
                const entities = convertVueAnalysisToEntities(vueAnalysis, filePath);
                return entities;
            }
        } catch (error) {
            console.warn(
                `⚠️ Vue-анализ не удался для ${filePath}, используем стандартный AST`
            );
        }
    }

    // ==========================================\
    // СТАНДАРТНЫЙ АНАЛИЗ ЧЕРЕЗ AST\
    // ==========================================\
    return extractEntitiesFromAST(ast, filePath);
}
