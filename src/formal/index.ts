// packages/ast-analyzer/src/formal/index.ts

/**
 * Формальная верификация и проверка эквивалентности
 *
 * Этот модуль предоставляет инструменты для формальной верификации кода:
 * - Z3 верификатор для проверки контрактов функций
 * - Моделирование тела функций для Z3
 * - Проверка эквивалентности исходного и рефакторинг-кода
 * - Проверка эквивалентности рефакторинга с модулями
 *
 * @module formal
 */

// ============================================
// ОСНОВНЫЕ КОМПОНЕНТЫ
// ============================================

// Z3 верификатор - проверка контрактов функций через SMT-решатель Z3
export {
  Z3Verifier,
  type VerificationConstraint,
  type VerificationResult,
  type FunctionContract,
} from './Z3Verifier.js';

// Моделирование тела функций для Z3
export { FunctionBodyModeler, type FunctionBodyModel } from './FunctionBodyModeler.js';

// Проверка эквивалентности исходного и измененного кода
export {
  EquivalenceChecker,
  type EquivalenceResult,
  type CodeDifference,
  type EquivalenceOptions,
} from './EquivalenceChecker.js';

// Проверка эквивалентности рефакторинга с выделением модулей
export {
  RefactoringEquivalenceChecker,
  type RefactoringEquivalenceResult,
  type FunctionSignature,
  type FunctionBehavior,
  type CallGraphEdge,
  type CallGraph,
  type EquivalenceCheckOptions,
} from './RefactoringEquivalenceChecker.js';

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОЗДАНИЯ КОНТРАКТОВ
// ============================================

export {
  // Создание параметров
  createIntParam,
  createBoolParam,
  createStringParam,

  // Логические операции
  eq,
  neq,
  range,
  implies,
  and,
  or,
  not,
  compare,

  // Арифметические операции
  add,
  sub,
  mul,
  div,
} from './Z3Verifier.js';

// ============================================
// УТИЛИТЫ ДЛЯ ПРОВЕРКИ ЭКВИВАЛЕНТНОСТИ
// ============================================

export { isEquivalent, needsReview, confidenceLevel } from './EquivalenceChecker.js';

// ============================================
// ТИПЫ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ
// ============================================

// Типы из Z3Verifier
export type {
  VerificationConstraint as Z3Constraint,
  VerificationResult as Z3Result,
  FunctionContract as Contract,
} from './Z3Verifier.js';

// Типы из FunctionBodyModeler
export type { FunctionBodyModel as BodyModel } from './FunctionBodyModeler.js';

// Типы из EquivalenceChecker
export type {
  EquivalenceResult as EquivResult,
  CodeDifference as Diff,
  EquivalenceOptions as EquivOptions,
} from './EquivalenceChecker.js';

// Типы из RefactoringEquivalenceChecker
export type {
  RefactoringEquivalenceResult as RefactoringEquivResult,
  FunctionSignature as Signature,
  FunctionBehavior as Behavior,
  CallGraphEdge as Edge,
  CallGraph as Graph,
  EquivalenceCheckOptions as CheckOptions,
} from './RefactoringEquivalenceChecker.js';

// ============================================
// ВЕРСИЯ МОДУЛЯ
// ============================================

export const FORMAL_MODULE_VERSION = '3.0.0';
export const FORMAL_MODULE_NAME = '@newkind/ast-analyzer/formal';
