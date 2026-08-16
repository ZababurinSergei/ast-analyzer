// src/formal/index.ts
// Единая точка входа для всех проверок эквивалентности и формальной верификации
// Версия: 3.0.0

// ============================================
// ИМПОРТЫ ТИПОВ - ВСЕ В ОДНОМ МЕСТЕ
// ============================================

import type { VerificationConstraint, VerificationResult, FunctionContract } from './Z3Verifier.js';

import type { FunctionBodyModel } from './FunctionBodyModeler.js';

import type {
  FileEquivalenceResult,
  FileEquivalenceOptions,
} from './checkers/FileEquivalenceChecker.js';

import type {
  RefactoringEquivalenceResult,
  EquivalenceCheckOptions,
} from './checkers/RefactoringEquivalenceChecker.js';

// ============================================
// ЭКСПОРТ ТИПОВ
// ============================================

export type {
  VerificationConstraint,
  VerificationResult,
  FunctionContract,
  FunctionBodyModel,
  FileEquivalenceResult,
  FileEquivalenceOptions,
  RefactoringEquivalenceResult,
  EquivalenceCheckOptions,
};

// ============================================
// ЭКСПОРТ КЛАССОВ И ФУНКЦИЙ
// ============================================

// 1. Z3Verifier - формальная верификация
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
  addExpr,
  subExpr,
  mulExpr,
  divExpr,
} from './Z3Verifier.js';

// 2. ExpressionParser - парсинг выражений
export {
  ExpressionParser,
  createExpressionParser,
  parseExpression,
  validateExpression,
  extractVariables,
  isValidForZ3,
  toZ3String,
  parseFunctionBody,
  createFunctionVariables,
  verifyFunctionWithBody,
  createContractFromExpression,
  createContractWithAutoPreconditions,
  canParseExpression,
  isSimpleExpression,
  extractVariablesFromExpression,
} from './ExpressionParser.js';

// 3. FunctionBodyModeler - моделирование тела функций
export { FunctionBodyModeler } from './FunctionBodyModeler.js';

// 4. FileEquivalenceChecker - проверка эквивалентности файлов
export { FileEquivalenceChecker } from './checkers/FileEquivalenceChecker.js';

// 5. RefactoringEquivalenceChecker - проверка рефакторинга
export {
  RefactoringEquivalenceChecker,
  isRefactoringEquivalent,
  needsRefactoringReview,
  hasCriticalIssues,
} from './checkers/RefactoringEquivalenceChecker.js';

// ============================================
// КОНСТАНТЫ
// ============================================

export const FORMAL_MODULE_VERSION = '3.0.0';
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

/**
 * Создает контракт из сигнатуры функции
 */
export function createContractFromSignature(
  name: string,
  params: { name: string; type: string }[],
  returnType: string
): ContractTemplate {
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
// УТИЛИТЫ ДЛЯ ВЕРИФИКАЦИИ
// ============================================

/**
 * Проверяет, что все постусловия выполнены
 */
export function validatePostconditions(
  _contract: FunctionContract,
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

// ============================================
// ФАСАДНЫЕ ФУНКЦИИ
// ============================================

/**
 * Быстрая проверка эквивалентности двух файлов
 */
export async function checkFileEquivalence(
  originalPath: string,
  modifiedPath: string,
  options: FileEquivalenceOptions = {}
): Promise<FileEquivalenceResult> {
  const { FileEquivalenceChecker } = await import('./checkers/FileEquivalenceChecker.js');
  const checker = new FileEquivalenceChecker(options);
  await checker.initialize();
  const result = await checker.checkFileEquivalence(originalPath, modifiedPath, options);
  await checker.dispose();
  return result;
}

/**
 * Быстрая проверка эквивалентности рефакторинга
 */
export async function checkRefactoringEquivalence(
  originalFilePath: string,
  refactoredFilePath: string,
  modulesDir?: string,
  options: EquivalenceCheckOptions = {}
): Promise<RefactoringEquivalenceResult> {
  const { RefactoringEquivalenceChecker } =
    await import('./checkers/RefactoringEquivalenceChecker.js');
  const checker = new RefactoringEquivalenceChecker(options);
  await checker.initialize();
  const result = await checker.checkRefactoringEquivalence(
    originalFilePath,
    refactoredFilePath,
    modulesDir
  );
  await checker.dispose();
  return result;
}

/**
 * Быстрая проверка эквивалентности двух функций
 */
export async function checkFunctionEquivalence(
  originalBody: string,
  modifiedBody: string,
  contract: FunctionContract,
  options: FileEquivalenceOptions = {}
): Promise<FileEquivalenceResult> {
  const { FileEquivalenceChecker } = await import('./checkers/FileEquivalenceChecker.js');
  const checker = new FileEquivalenceChecker(options);
  await checker.initialize();
  const result = await checker.checkFunctionEquivalence(originalBody, modifiedBody, contract);
  await checker.dispose();
  return result;
}

/**
 * Быстрая проверка эквивалентности двух выражений
 * Использует напрямую Z3Verifier для проверки выражений
 */
export async function checkExpressionEquivalence(
  original: string,
  modified: string,
  variables: Map<string, 'int' | 'bool' | 'string'>
): Promise<VerificationResult> {
  const { Z3Verifier } = await import('./Z3Verifier.js');
  const verifier = new Z3Verifier();
  await verifier.initialize();
  const result = await verifier.verifyEquivalence(original, modified, variables);
  await verifier.dispose();
  return result;
}

/**
 * Формальная верификация функции через Z3
 */
export async function verifyFunction(
  filePath: string,
  functionName: string,
  options: {
    preconditions?: VerificationConstraint[];
    postconditions?: VerificationConstraint[];
  } = {}
): Promise<VerificationResult> {
  const { Z3Verifier, createIntParam, range } = await import('./Z3Verifier.js');
  const { Project } = await import('ts-morph');

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const func = sourceFile.getFunction(functionName);

  if (!func) {
    throw new Error(`Function ${functionName} not found in ${filePath}`);
  }

  const verifier = new Z3Verifier();
  await verifier.initialize();

  const params = func.getParameters().map(p => createIntParam(p.getName()));
  const returnType = func.getReturnType();
  const returnTypeMap: 'int' | 'bool' | 'string' | 'void' = returnType.isNumber()
    ? 'int'
    : returnType.isBoolean()
      ? 'bool'
      : returnType.isString()
        ? 'string'
        : 'void';

  const contract: FunctionContract = {
    name: functionName,
    params,
    returnType: returnTypeMap,
    preconditions: options.preconditions || params.map(p => range(p.name, -1000, 1000)),
    postconditions: options.postconditions || [],
    invariants: [],
  };

  const result = await verifier.verifyFunction(contract);
  await verifier.dispose();
  return result;
}

// ============================================
// DEFAULT ЭКСПОРТ
// ============================================

export default {
  // Классы
  Z3Verifier: require('./Z3Verifier.js').Z3Verifier,
  ExpressionParser: require('./ExpressionParser.js').ExpressionParser,
  FunctionBodyModeler: require('./FunctionBodyModeler.js').FunctionBodyModeler,
  FileEquivalenceChecker: require('./checkers/FileEquivalenceChecker.js').FileEquivalenceChecker,
  RefactoringEquivalenceChecker: require('./checkers/RefactoringEquivalenceChecker.js')
    .RefactoringEquivalenceChecker,

  // Z3Verifier функции
  createIntParam: require('./Z3Verifier.js').createIntParam,
  createBoolParam: require('./Z3Verifier.js').createBoolParam,
  createStringParam: require('./Z3Verifier.js').createStringParam,
  eq: require('./Z3Verifier.js').eq,
  neq: require('./Z3Verifier.js').neq,
  range: require('./Z3Verifier.js').range,
  implies: require('./Z3Verifier.js').implies,
  and: require('./Z3Verifier.js').and,
  or: require('./Z3Verifier.js').or,
  not: require('./Z3Verifier.js').not,
  if_: require('./Z3Verifier.js').if_,
  compare: require('./Z3Verifier.js').compare,
  assign: require('./Z3Verifier.js').assign,
  add: require('./Z3Verifier.js').add,
  sub: require('./Z3Verifier.js').sub,
  mul: require('./Z3Verifier.js').mul,
  div: require('./Z3Verifier.js').div,
  addExpr: require('./Z3Verifier.js').addExpr,
  subExpr: require('./Z3Verifier.js').subExpr,
  mulExpr: require('./Z3Verifier.js').mulExpr,
  divExpr: require('./Z3Verifier.js').divExpr,

  // ExpressionParser функции
  createExpressionParser: require('./ExpressionParser.js').createExpressionParser,
  parseExpression: require('./ExpressionParser.js').parseExpression,
  validateExpression: require('./ExpressionParser.js').validateExpression,
  extractVariables: require('./ExpressionParser.js').extractVariables,
  isValidForZ3: require('./ExpressionParser.js').isValidForZ3,
  toZ3String: require('./ExpressionParser.js').toZ3String,
  parseFunctionBody: require('./ExpressionParser.js').parseFunctionBody,
  createFunctionVariables: require('./ExpressionParser.js').createFunctionVariables,
  verifyFunctionWithBody: require('./ExpressionParser.js').verifyFunctionWithBody,
  createContractFromExpression: require('./ExpressionParser.js').createContractFromExpression,
  createContractWithAutoPreconditions:
    require('./ExpressionParser.js').createContractWithAutoPreconditions,
  canParseExpression: require('./ExpressionParser.js').canParseExpression,
  isSimpleExpression: require('./ExpressionParser.js').isSimpleExpression,
  extractVariablesFromExpression: require('./ExpressionParser.js').extractVariablesFromExpression,

  // RefactoringEquivalenceChecker утилиты
  isRefactoringEquivalent: require('./checkers/RefactoringEquivalenceChecker.js')
    .isRefactoringEquivalent,
  needsRefactoringReview: require('./checkers/RefactoringEquivalenceChecker.js')
    .needsRefactoringReview,
  hasCriticalIssues: require('./checkers/RefactoringEquivalenceChecker.js').hasCriticalIssues,

  // Утилиты для контрактов
  createContractTemplate,
  addPrecondition,
  addPostcondition,
  addInvariant,
  addBody,
  buildContract,
  createContractFromSignature,
  validatePostconditions,
  generateVerificationReport,
  areContractsEquivalent,

  // Фасадные функции
  checkFileEquivalence,
  checkRefactoringEquivalence,
  checkFunctionEquivalence,
  checkExpressionEquivalence,
  verifyFunction,

  // Константы
  FORMAL_MODULE_VERSION,
  FORMAL_MODULE_NAME,
};
