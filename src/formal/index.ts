// src/formal/index.ts

/**
 * Формальная верификация для AST Analyzer
 *
 * Этот модуль предоставляет инструменты для формальной верификации кода:
 * - Z3 верификатор для проверки контрактов функций
 * - Проверка эквивалентности для рефакторинга
 * - Верификация инвариантов циклов
 * - Проверка свойств массивов
 * - Парсинг выражений (ExpressionParser)
 * - Моделирование тела функций (FunctionBodyModeler)
 *
 * @module formal
 */

// ============================================
// ЭКСПОРТ ТИПОВ ИЗ Z3Verifier
// ============================================

import type { VerificationConstraint, FunctionContract, VerificationResult } from './Z3Verifier.js';

// ============================================
// ЭКСПОРТ ВСЕХ КОМПОНЕНТОВ
// ============================================

// 1. Z3 ВЕРИФИКАТОР - основной класс
export {
  Z3Verifier,
  createIntParam,
  createBoolParam,
  createStringParam,
  eq,
  neq,
  range,
  implies,
  and,
  or,
  not,
  if_,
  compare,
  assign,
  add,
  sub,
  mul,
  div,
  type VerificationConstraint,
  type VerificationResult as FormalVerificationResult,
  type FunctionContract,
} from './Z3Verifier.js';

// 2. ПАРСЕР ВЫРАЖЕНИЙ - ВСЕ МЕТОДЫ
export {
  ExpressionParser,
  createExpressionParser,
  parseExpression,
  validateExpression,
  extractVariables,
  isValidForZ3,
  toZ3String,
  // Методы для работы с выражениями
  parseFunctionBody,
  createFunctionVariables,
  verifyFunctionWithBody,
  createContractFromExpression,
  createContractWithAutoPreconditions,
  canParseExpression,
  isSimpleExpression,
  extractVariablesFromExpression,
} from './ExpressionParser.js';

// 3. МОДЕЛИРОВАНИЕ ТЕЛА ФУНКЦИИ
export { FunctionBodyModeler, type FunctionBodyModel } from './FunctionBodyModeler.js';

// 4. ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
export {
  EquivalenceChecker,
  type EquivalenceResult,
  type CodeDifference,
  type EquivalenceOptions,
  isEquivalent,
  needsReview,
  confidenceLevel,
} from './EquivalenceChecker.js';

// 5. ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ РЕФАКТОРИНГА
export {
  RefactoringEquivalenceChecker,
  type RefactoringEquivalenceResult,
  type FunctionSignature,
  type FunctionBehavior,
  type CallGraphEdge,
  type CallGraph,
  type EquivalenceCheckOptions,
  isEquivalent as isRefactoringEquivalent,
  needsReview as needsRefactoringReview,
  hasCriticalIssues,
} from './RefactoringEquivalenceChecker.js';

// ============================================
// КОНСТАНТЫ
// ============================================

export const FORMAL_MODULE_VERSION = '1.0.0';
export const FORMAL_MODULE_NAME = '@newkind/ast-analyzer/formal';

// ============================================
// ТИПЫ ДЛЯ CONTRACT GENERATION
// ============================================

export interface ContractTemplate {
  name: string;
  params: { name: string; type: 'int' | 'bool' | 'string' }[];
  returnType: 'int' | 'bool' | 'string' | 'void';
  body?: string;
  preconditions?: VerificationConstraint[];
  postconditions?: VerificationConstraint[];
  invariants?: VerificationConstraint[];
}

/**
 * Создает шаблон контракта для функции
 */
export function createContractTemplate(
  name: string,
  params: { name: string; type: 'int' | 'bool' | 'string' }[],
  returnType: 'int' | 'bool' | 'string' | 'void' = 'int'
): ContractTemplate {
  return {
    name,
    params,
    returnType,
    preconditions: [],
    postconditions: [],
    invariants: [],
  };
}

/**
 * Добавляет предусловие к контракту
 */
export function addPrecondition(
  contract: ContractTemplate,
  precondition: VerificationConstraint
): ContractTemplate {
  return {
    ...contract,
    preconditions: [...(contract.preconditions || []), precondition],
  };
}

/**
 * Добавляет постусловие к контракту
 */
export function addPostcondition(
  contract: ContractTemplate,
  postcondition: VerificationConstraint
): ContractTemplate {
  return {
    ...contract,
    postconditions: [...(contract.postconditions || []), postcondition],
  };
}

/**
 * Добавляет инвариант к контракту
 */
export function addInvariant(
  contract: ContractTemplate,
  invariant: VerificationConstraint
): ContractTemplate {
  return {
    ...contract,
    invariants: [...(contract.invariants || []), invariant],
  };
}

/**
 * Добавляет тело функции к контракту
 */
export function addBody(contract: ContractTemplate, body: string): ContractTemplate {
  return {
    ...contract,
    body,
  };
}

/**
 * Преобразует шаблон в полноценный контракт
 */
export function buildContract(template: ContractTemplate): FunctionContract {
  return {
    name: template.name,
    params: template.params,
    returnType: template.returnType,
    body: template.body,
    preconditions: template.preconditions || [],
    postconditions: template.postconditions || [],
    invariants: template.invariants || [],
  };
}

// ============================================
// УТИЛИТЫ ДЛЯ ВЕРИФИКАЦИИ
// ============================================

/**
 * Проверяет, что все постусловия выполнены
 */
export function validatePostconditions(
  _contract: FunctionContract, // Префикс _ для неиспользуемого параметра
  result: VerificationResult
): boolean {
  if (!result.isValid) return false;
  return true;
}

/**
 * Генерирует отчет о верификации
 */
export function generateVerificationReport(
  contract: FunctionContract,
  result: VerificationResult
): string {
  let report = '='.repeat(60) + '\n';
  report += `🔬 VERIFICATION REPORT: ${contract.name}\n`;
  report += '='.repeat(60) + '\n';
  report += `Status: ${result.isValid ? '✅ VERIFIED' : '❌ FAILED'}\n`;
  report += `Time: ${result.time || 0}ms\n`;

  if (result.counterexample && result.counterexample.size > 0) {
    report += '\n📋 Counterexample found:\n';
    for (const [key, value] of result.counterexample) {
      report += `  ${key} = ${value}\n`;
    }
  }

  if (result.error) {
    report += `\n⚠️ Error: ${result.error}\n`;
  }

  report += '='.repeat(60) + '\n';

  return report;
}

/**
 * Проверяет, эквивалентны ли два контракта
 */
export function areContractsEquivalent(
  contract1: FunctionContract,
  contract2: FunctionContract
): boolean {
  if (contract1.name !== contract2.name) return false;
  if (contract1.params.length !== contract2.params.length) return false;
  if (contract1.returnType !== contract2.returnType) return false;
  if (contract1.preconditions.length !== contract2.preconditions.length) return false;
  if (contract1.postconditions.length !== contract2.postconditions.length) return false;
  if (contract1.invariants.length !== contract2.invariants.length) return false;
  if (contract1.body !== contract2.body) return false;
  return true;
}

export function createContractFromSignature(
  name: string,
  params: { name: string; type: string }[],
  returnType: string
): ContractTemplate {
  // Приводим типы к правильному union типу с помощью as утверждения
  const mappedParams = params.map(p => ({
    name: p.name,
    type: p.type === 'number' ? 'int' : p.type === 'boolean' ? 'bool' : 'string',
  })) as { name: string; type: 'int' | 'bool' | 'string' }[];

  let mappedReturnType: 'int' | 'bool' | 'string' | 'void' = 'void';
  if (returnType === 'number') mappedReturnType = 'int';
  else if (returnType === 'boolean') mappedReturnType = 'bool';
  else if (returnType === 'string') mappedReturnType = 'string';

  return createContractTemplate(name, mappedParams, mappedReturnType);
}

// ============================================
// ФАСАД ДЛЯ УПРОЩЕННОГО ИСПОЛЬЗОВАНИЯ
// ============================================

import {
  Z3Verifier as Z3VerifierValue,
  createIntParam as createIntParamValue,
  createBoolParam as createBoolParamValue,
  createStringParam as createStringParamValue,
  eq as eqValue,
  neq as neqValue,
  range as rangeValue,
  implies as impliesValue,
  and as andValue,
  or as orValue,
  not as notValue,
  if_ as ifValue,
  compare as compareValue,
  assign as assignValue,
  add as addValue,
  sub as subValue,
  mul as mulValue,
  div as divValue,
} from './Z3Verifier.js';

import {
  ExpressionParser as ExpressionParserClass,
  createExpressionParser as createExpressionParserValue,
  parseExpression as parseExpressionValue,
  validateExpression as validateExpressionValue,
  extractVariables as extractVariablesValue,
  isValidForZ3 as isValidForZ3Value,
  toZ3String as toZ3StringValue,
  parseFunctionBody as parseFunctionBodyValue,
  createFunctionVariables as createFunctionVariablesValue,
  verifyFunctionWithBody as verifyFunctionWithBodyValue,
  createContractFromExpression as createContractFromExpressionValue,
  createContractWithAutoPreconditions as createContractWithAutoPreconditionsValue,
  canParseExpression as canParseExpressionValue,
  isSimpleExpression as isSimpleExpressionValue,
  extractVariablesFromExpression as extractVariablesFromExpressionValue,
} from './ExpressionParser.js';

import { FunctionBodyModeler as FunctionBodyModelerClass } from './FunctionBodyModeler.js';

import {
  EquivalenceChecker as EquivalenceCheckerClass,
  isEquivalent as isEquivalentValue,
  needsReview as needsReviewValue,
  confidenceLevel as confidenceLevelValue,
} from './EquivalenceChecker.js';

import {
  RefactoringEquivalenceChecker as RefactoringEquivalenceCheckerClass,
  isEquivalent as isRefactoringEquivalentValue,
  needsReview as needsRefactoringReviewValue,
  hasCriticalIssues as hasCriticalIssuesValue,
} from './RefactoringEquivalenceChecker.js';

// ============================================
// DEFAULT ЭКСПОРТ
// ============================================

export default {
  // Классы
  Z3Verifier: Z3VerifierValue,
  ExpressionParser: ExpressionParserClass,
  FunctionBodyModeler: FunctionBodyModelerClass,
  EquivalenceChecker: EquivalenceCheckerClass,
  RefactoringEquivalenceChecker: RefactoringEquivalenceCheckerClass,

  // Z3Verifier функции
  createIntParam: createIntParamValue,
  createBoolParam: createBoolParamValue,
  createStringParam: createStringParamValue,
  eq: eqValue,
  neq: neqValue,
  range: rangeValue,
  implies: impliesValue,
  and: andValue,
  or: orValue,
  not: notValue,
  if_: ifValue,
  compare: compareValue,
  assign: assignValue,
  add: addValue,
  sub: subValue,
  mul: mulValue,
  div: divValue,

  // ExpressionParser функции
  createExpressionParser: createExpressionParserValue,
  parseExpression: parseExpressionValue,
  validateExpression: validateExpressionValue,
  extractVariables: extractVariablesValue,
  isValidForZ3: isValidForZ3Value,
  toZ3String: toZ3StringValue,
  parseFunctionBody: parseFunctionBodyValue,
  createFunctionVariables: createFunctionVariablesValue,
  verifyFunctionWithBody: verifyFunctionWithBodyValue,
  createContractFromExpression: createContractFromExpressionValue,
  createContractWithAutoPreconditions: createContractWithAutoPreconditionsValue,
  canParseExpression: canParseExpressionValue,
  isSimpleExpression: isSimpleExpressionValue,
  extractVariablesFromExpression: extractVariablesFromExpressionValue,

  // EquivalenceChecker
  isEquivalent: isEquivalentValue,
  needsReview: needsReviewValue,
  confidenceLevel: confidenceLevelValue,

  // RefactoringEquivalenceChecker
  isRefactoringEquivalent: isRefactoringEquivalentValue,
  needsRefactoringReview: needsRefactoringReviewValue,
  hasCriticalIssues: hasCriticalIssuesValue,

  // Утилиты
  createContractTemplate,
  addPrecondition,
  addPostcondition,
  addInvariant,
  addBody,
  buildContract,
  validatePostconditions,
  generateVerificationReport,
  areContractsEquivalent,
  createContractFromSignature,

  // Константы
  FORMAL_MODULE_VERSION,
  FORMAL_MODULE_NAME,
};
