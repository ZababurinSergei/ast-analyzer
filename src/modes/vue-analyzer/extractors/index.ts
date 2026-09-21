// src/modes/vue-analyzer/extractors/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ЭКСПОРТА ЭКСТРАКТОРОВ
// ============================================
// Версия: 3.0.0
//
// ИЗМЕНЕНИЯ v3.0.0:
//   - ✅ УДАЛЕНЫ: props.js, emits.js, expose.js
//     Их функциональность перенесена в
//     core/relations/vue-macros-extractor.ts
//     (единый модуль defineExpose/defineProps/defineEmits/
//      defineModel/defineSlots/defineOptions)
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ ДОБАВЛЕН экспорт './slots.js'
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовые экстракторы: imports, composables, functions,
//     constants, variables, types, interfaces
// ============================================

// ============================================
// 1. IMPORTS — извлечение импортов
// ============================================
// Функции:
//   - extractImportsFromAST(ast)
//   - extractImportsFromSource(content)
//   - extractImportsWithDetails(content)
//   - groupImportsByType(imports)
//   - isImportUsed(imp, content)
//   - filterUnusedImports(imports, content)
// ============================================
export * from './imports.js';

// ============================================
// 2. COMPOSABLES — извлечение composables (use*)
// ============================================
// Функции:
//   - extractComposablesFromAST(ast)
//   - extractComposablesFromSource(content)
// ============================================
export * from './composables.js';

// ============================================
// 3. FUNCTIONS — извлечение функций
// ============================================
// Функции:
//   - extractFunctionsFromScript(content, filePath)
// ============================================
export * from './functions.js';

// ============================================
// 4. CONSTANTS — извлечение констант
// ============================================
// Функции:
//   - extractConstantsFromAST(ast)
//   - extractConstantsFromScript(content, ast?)
// ============================================
export * from './constants.js';

// ============================================
// 5. VARIABLES — извлечение переменных (let, var)
// ============================================
// Функции:
//   - extractVariablesFromAST(ast)
//   - extractVariablesFromScript(content, ast?)
// ============================================
export * from './variables.js';

// ============================================
// 6. TYPES — извлечение TypeScript типов
// ============================================
// Функции:
//   - extractTypesFromAST(ast)
//   - extractTypesFromScript(content, ast?)
//   - getTypeDefinition(typeAnnotation)
// ============================================
export * from './types.js';

// ============================================
// 7. INTERFACES — извлечение TypeScript интерфейсов
// ============================================
// Функции:
//   - extractInterfacesFromAST(ast)
//   - extractInterfacesFromScript(content, ast?)
// ============================================
export * from './interfaces.js';

// ============================================
// 8. SLOTS — извлечение defineSlots<T>()
// ============================================
// Функции:
//   - extractSlotsFromSource(content) — regex-парсинг
//   - extractSlotsFromAST(ast) — парсинг через AST
//
// Типы:
//   - SlotDefinition (реэкспорт из ../types.js)
// ============================================
export * from './slots.js';

// ============================================
// 9. РЕЭКСПОРТ ТИПОВ
// ============================================
export type { SlotDefinition } from '../types.js';
