// src/modes/vue-analyzer/extractors/index.ts
// ============================================
// ЕДИНАЯ ТОЧКА ЭКСПОРТА ВСЕХ ЭКСТРАКТОРОВ
// ============================================
// Версия: 2.0.0
//
// ИЗМЕНЕНИЯ v2.0.0:
//   - ✅ ДОБАВЛЕН экспорт './slots.js'
//     (экстрактор defineSlots<T>() и defineSlots([...]))
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Базовые экстракторы: props, emits, expose, imports,
//     composables, functions, constants, variables, types, interfaces
// ============================================

// ============================================
// 1. PROPS — извлечение props из Vue компонента
// ============================================
// Функции:
//   - extractPropsFromSource(content)
//   - extractPropsFromCompiledScript(compiledScript)
//   - extractPropsFromAST(ast)
// ============================================
export * from './props.js';

// ============================================
// 2. EMITS — извлечение событий (defineEmits)
// ============================================
// Функции:
//   - extractEmitsFromSource(content)
//   - extractEmitsFromCompiledScript(compiledScript)
//   - extractEmitsFromAST(ast)
// ============================================
export * from './emits.js';

// ============================================
// 3. EXPOSE — извлечение defineExpose
// ============================================
// Функции:
//   - extractExposeFromCompiledScript(compiledScript)
//   - extractExposeFromAST(ast)
// ============================================
export * from './expose.js';

// ============================================
// 4. IMPORTS — извлечение импортов
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
// 5. COMPOSABLES — извлечение composables (use*)
// ============================================
// Функции:
//   - extractComposablesFromAST(ast)
//   - extractComposablesFromSource(content)
// ============================================
export * from './composables.js';

// ============================================
// 6. FUNCTIONS — извлечение функций
// ============================================
// Функции:
//   - extractFunctionsFromScript(content, filePath)
// ============================================
export * from './functions.js';

// ============================================
// 7. CONSTANTS — извлечение констант
// ============================================
// Функции:
//   - extractConstantsFromAST(ast)
//   - extractConstantsFromScript(content, ast?)
// ============================================
export * from './constants.js';

// ============================================
// 8. VARIABLES — извлечение переменных (let, var)
// ============================================
// Функции:
//   - extractVariablesFromAST(ast)
//   - extractVariablesFromScript(content, ast?)
// ============================================
export * from './variables.js';

// ============================================
// 9. TYPES — извлечение TypeScript типов
// ============================================
// Функции:
//   - extractTypesFromAST(ast)
//   - extractTypesFromScript(content, ast?)
//   - getTypeDefinition(typeAnnotation)
// ============================================
export * from './types.js';

// ============================================
// 10. INTERFACES — извлечение TypeScript интерфейсов
// ============================================
// Функции:
//   - extractInterfacesFromAST(ast)
//   - extractInterfacesFromScript(content, ast?)
// ============================================
export * from './interfaces.js';

// ============================================
// 11. ✅ НОВОЕ: SLOTS — извлечение defineSlots<T>()
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
// 12. РЕЭКСПОРТ ТИПОВ
// ============================================
export type { SlotDefinition } from '../types.js';
