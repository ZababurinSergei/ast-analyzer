// packages/ast-analyzer/src/core/entity-extractor/extract-entities.ts
// ============================================
// ИСПРАВЛЕННАЯ ВЕРСИЯ (патч 2.2)
// ============================================
// Что изменено по сравнению с оригиналом:
//   1. Vue-файл без <script> → возвращаем пустой EntitiesResult
//      вместо null, чтобы узел модуля попал в граф.
//   2. Ошибки Vue-анализа больше не шумят в console.warn —
//      понижены до console.debug (включается через AST_DEBUG_VUE=true).
//   3. Явный комментарий, что "Vue без script" — это НОРМА,
//      а не ошибка (иконки, презентационные компоненты).
// ============================================

import path from 'path';
import { analyzeVueComponent } from '../../modes/vue-analyzer.js';
import type { EntitiesResult } from '../../types.js';
import { createEmptyEntitiesResult } from './helpers/create-empty-result.js';
import { convertVueAnalysisToEntities } from './vue/convert-analysis.js';
import { extractEntitiesFromAST } from './ast/extract-entities-from-ast.js';

/**
 * Извлекает все сущности из AST.
 *
 * @param ast      — AST-дерево
 * @param filePath — путь к файлу (опционально)
 * @returns EntitiesResult — результат анализа
 */
export function extractEntities(ast: any, filePath?: string): EntitiesResult {
  // ==========================================
  // ЗАЩИТА ОТ ПУСТОГО AST
  // ==========================================
  if (!ast || !ast.body) {
    return createEmptyEntitiesResult(filePath);
  }

  if (!Array.isArray(ast.body)) {
    // Понижаем до debug — это редкий, но не критичный случай
    if (process.env.AST_DEBUG_ENTITIES === 'true') {
      console.debug(`ℹ️ AST.body не является массивом для ${filePath || 'unknown'}, пропускаем`);
    }
    return createEmptyEntitiesResult(filePath);
  }

  // ==========================================
  // ЕСЛИ ЭТО VUE-ФАЙЛ — ИСПОЛЬЗУЕМ СПЕЦИАЛЬНЫЙ АНАЛИЗАТОР
  // ==========================================
  if (filePath?.endsWith('.vue')) {
    try {
      const vueAnalysis = analyzeVueComponent(filePath);

      if (vueAnalysis) {
        if (process.env.AST_DEBUG_VUE === 'true') {
          console.debug(`🎯 Используем Vue-анализатор для ${path.basename(filePath)}`);
        }
        const entities = convertVueAnalysisToEntities(vueAnalysis, filePath);
        return entities;
      }

      // ✅ ПАТЧ 2.2:
      // Vue-файл без <script> (иконки, презентационные компоненты) — это НОРМА.
      // Возвращаем пустой результат, но с валидными moduleName/filePath,
      // чтобы узел модуля всё равно попал в граф проекта.
      if (process.env.AST_DEBUG_VUE === 'true') {
        console.debug(
            `ℹ️ Vue без <script>: ${path.basename(filePath)} — возвращаем пустой результат`
        );
      }
      return createEmptyEntitiesResult(filePath);
    } catch (error) {
      // ✅ ПАТЧ 2.2:
      // Понижаем до debug — для иконок и презентационных компонентов
      // ошибки Vue-анализа ожидаемы и не должны засорять stdout.
      if (process.env.AST_DEBUG_VUE === 'true') {
        console.debug(
            `ℹ️ Vue-анализ не удался для ${path.basename(filePath)}, используем пустой результат`
        );
        console.debug(`   Причина: ${error instanceof Error ? error.message : String(error)}`);
      }
      return createEmptyEntitiesResult(filePath);
    }
  }

  // ==========================================
  // СТАНДАРТНЫЙ АНАЛИЗ ЧЕРЕЗ AST
  // ==========================================
  return extractEntitiesFromAST(ast, filePath);
}
