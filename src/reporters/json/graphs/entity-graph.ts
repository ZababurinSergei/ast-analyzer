// packages/ast-analyzer/src/reporters/json/graphs/entity-graph.ts

import type { GraphData, EntitiesResult } from '../../../types.js';
import type {
  EntityNode,
  EntityEdge,
  EntityGraph,
  FunctionEntity,
} from '../../modules/types.js';
import { createDefaultSecurity } from '../../modules/types.js';
import {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  findModuleForEntity,
} from '../../modules/utils.js';
import idManager from '../../../core/IdManager.js';

// ============================================================
// ОСНОВНАЯ ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит граф сущностей проекта.
 *
 * Обрабатывает 6 типов сущностей:
 *   - functions  — функции (обычные, стрелочные, методы, вложенные)
 *   - classes    — классы
 *   - constants  — константы
 *   - interfaces — интерфейсы
 *   - types      — type aliases
 *   - variables  — переменные
 *
 * Возвращает объект с двумя массивами:
 *   - nodes — узлы (сущности с метаданными)
 *   - edges — рёбра (связи между сущностями)
 *
 * Узлы получают уникальный ID вида `<module>#<name>` (или `#<name>`,
 * если модуль не найден). Это позволяет однозначно идентифицировать
 * сущность в графе.
 *
 * @param data     — граф зависимостей (rootKey + graph)
 * @param entities — извлечённые сущности (EntitiesResult)
 * @returns EntityGraph — { nodes, edges }
 */
export function buildEntityGraph(
  data: GraphData,
  entities: EntitiesResult
): EntityGraph {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  // ────────────────────────────────────────────────────────
  // Функции
  // ────────────────────────────────────────────────────────
  buildFunctionNodes(entities, data, nodes, edges);

  // ────────────────────────────────────────────────────────
  // Классы
  // ────────────────────────────────────────────────────────
  buildClassNodes(entities, data, nodes, edges);

  // ────────────────────────────────────────────────────────
  // Константы
  // ────────────────────────────────────────────────────────
  buildConstantNodes(entities, data, nodes);

  // ────────────────────────────────────────────────────────
  // Интерфейсы
  // ────────────────────────────────────────────────────────
  buildInterfaceNodes(entities, data, nodes, edges);

  // ────────────────────────────────────────────────────────
  // Типы
  // ────────────────────────────────────────────────────────
  buildTypeNodes(entities, data, nodes);

  // ────────────────────────────────────────────────────────
  // Переменные
  // ────────────────────────────────────────────────────────
  buildVariableNodes(entities, data, nodes);

  return { nodes, edges };
}

// ============================================================
// ХЕЛПЕРЫ: ПОСТРОЕНИЕ ID УЗЛОВ
// ============================================================

/**
 * Создаёт уникальный ID узла: `<module>#<name>` или `#<name>`.
 */
function makeNodeId(modulePath: string | null, name: string): string {
  return modulePath ? `${modulePath}#${name}` : `#${name}`;
}

/**
 * Ищет модуль для сущности, а если не найден — пытается
 * сопоставить по подстроке в графе зависимостей.
 */
function resolveModuleForEntity(
  entityName: string,
  data: GraphData
): string | null {
  let modulePath = findModuleForEntity(entityName, data);

  if (!modulePath) {
    for (const [modPath, deps] of Object.entries(data.graph)) {
      const depsArray = deps as string[];
      if (
        modPath.includes(entityName) ||
        depsArray.some((d: string) => d.includes(entityName))
      ) {
        modulePath = modPath;
        break;
      }
    }
  }

  return modulePath;
}

// ============================================================
// ФУНКЦИИ
// ============================================================

function buildFunctionNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[],
  edges: EntityEdge[]
): void {
  const functions = ensureArray(entities.functions) as FunctionEntity[];

  for (const func of functions) {
    const funcName = safeString(func.name);
    const modulePath = findModuleForEntity(funcName, data);
    const nodeId = makeNodeId(modulePath, funcName);

    const calls: string[] = ensureArray(func.calls).map((call: any) =>
      safeString(call)
    );
    const calledBy: string[] = ensureArray(func.calledBy).map((cb: any) =>
      safeString(cb)
    );

    const funcAny = func as any;

    // ────────────────────────────────────────────────────────
    // Метаданные функции
    // ────────────────────────────────────────────────────────
    const metadata: EntityNode['metadata'] = {
      isExported: safeBoolean(func.isExported),
      params: ensureArray(func.params).map((p: any) => safeString(p)),
      returnType: safeString(func.returnType),
      isAsync: safeBoolean(func.isAsync),
      isMethod: safeBoolean(func.isMethod),
      className: safeString(func.className),
      calls: calls,
      calledBy: calledBy,
      startLine: safeNumber(func.startLine || func.line),
      endLine: safeNumber(func.endLine || func.line),
      complexity: safeNumber(func.complexity),
      security: func.security || createDefaultSecurity(),
      body: func.body || '',
      vscode: funcAny.vscode || '',
      id:
        funcAny.id ||
        idManager.getFunctionId({
          filePath: modulePath || 'unknown',
          funcName: funcName,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
        }),
    };

    // Опциональные поля
    if (funcAny.signature) {
      (metadata as any).signature = funcAny.signature;
    }

    if (modulePath && modulePath !== data.rootKey) {
      (metadata as any).importedFrom = modulePath;
    }

    // ────────────────────────────────────────────────────────
    // Узел
    // ────────────────────────────────────────────────────────
    nodes.push({
      id: nodeId,
      name: funcName,
      type: 'function',
      module: modulePath || 'unknown',
      line: safeNumber(func.line),
      metadata,
    });

    // ────────────────────────────────────────────────────────
    // Рёбра вызовов
    // ────────────────────────────────────────────────────────
    for (const call of calls) {
      const targetModule = resolveModuleForEntity(call, data);
      const targetId = makeNodeId(targetModule, call);

      edges.push({
        from: nodeId,
        to: targetId,
        type: 'function_call',
        line: safeNumber(func.line),
      });
    }
  }
}

// ============================================================
// КЛАССЫ
// ============================================================

function buildClassNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[],
  edges: EntityEdge[]
): void {
  for (const cls of entities.classes || []) {
    const className = safeString(cls.name);
    const modulePath = findModuleForEntity(className, data);
    const nodeId = makeNodeId(modulePath, className);

    // ────────────────────────────────────────────────────────
    // Метаданные класса
    // ────────────────────────────────────────────────────────
    const metadata: EntityNode['metadata'] = {
      isExported: safeBoolean(cls.isExported),
      methods: ensureArray(cls.methods).map((m: any) => safeString(m)),
      properties: ensureArray(cls.properties).map((p: any) => safeString(p)),
      extends: safeString(cls.extends) || undefined,
      implements: ensureArray(cls.implements).map((i: any) => safeString(i)),
      startLine: safeNumber(cls.startLine || cls.line),
      endLine: safeNumber(cls.endLine || cls.line),
      body: '',
      vscode: '',
    };

    nodes.push({
      id: nodeId,
      name: className,
      type: 'class',
      module: modulePath || 'unknown',
      line: safeNumber(cls.line),
      metadata,
    });

    // ────────────────────────────────────────────────────────
    // Рёбра: наследование (class_extends)
    // ────────────────────────────────────────────────────────
    if (cls.extends) {
      const extName = safeString(cls.extends);
      const targetModule = findModuleForEntity(extName, data);
      const targetId = makeNodeId(targetModule, extName);

      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_extends',
      });
    }

    // ────────────────────────────────────────────────────────
    // Рёбра: реализация интерфейсов (class_implements)
    // ────────────────────────────────────────────────────────
    for (const impl of ensureArray(cls.implements)) {
      const implName = safeString(impl);
      const targetModule = findModuleForEntity(implName, data);
      const targetId = makeNodeId(targetModule, implName);

      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_implements',
      });
    }
  }
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

function buildConstantNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[]
): void {
  for (const constant of entities.constants || []) {
    const constName = safeString(constant.name);
    const modulePath = findModuleForEntity(constName, data);
    const nodeId = makeNodeId(modulePath, constName);

    nodes.push({
      id: nodeId,
      name: constName,
      type: 'constant',
      module: modulePath || 'unknown',
      line: safeNumber(constant.line),
      metadata: {
        isExported: safeBoolean(constant.isExported),
        value: constant.value,
        dataType: safeString(constant.type),
      },
    });
  }
}

// ============================================================
// ИНТЕРФЕЙСЫ
// ============================================================

function buildInterfaceNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[],
  edges: EntityEdge[]
): void {
  for (const intf of entities.interfaces || []) {
    const intfName = safeString(intf.name);
    const modulePath = findModuleForEntity(intfName, data);
    const nodeId = makeNodeId(modulePath, intfName);

    // Преобразуем массив extends в строку для metadata
    const extendsStr = ensureArray(intf.extends)
      .map((e: any) => safeString(e))
      .filter((e): e is string => e !== undefined && e !== '')
      .join(', ');

    nodes.push({
      id: nodeId,
      name: intfName,
      type: 'interface',
      module: modulePath || 'unknown',
      line: safeNumber(intf.line),
      metadata: {
        isExported: safeBoolean(intf.isExported),
        properties: ensureArray(intf.properties).map((p: any) => safeString(p)),
        extends: extendsStr || undefined,
        startLine: safeNumber(intf.startLine || intf.line),
        endLine: safeNumber(intf.endLine || intf.line),
      },
    });

    // ────────────────────────────────────────────────────────
    // Рёбра: наследование интерфейсов (interface_extends)
    // ────────────────────────────────────────────────────────
    for (const ext of ensureArray(intf.extends)) {
      const extName = safeString(ext);
      const targetModule = findModuleForEntity(extName, data);
      const targetId = makeNodeId(targetModule, extName);

      edges.push({
        from: nodeId,
        to: targetId,
        type: 'interface_extends',
      });
    }
  }
}

// ============================================================
// ТИПЫ
// ============================================================

function buildTypeNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[]
): void {
  for (const type of entities.types || []) {
    const typeName = safeString(type.name);
    const modulePath = findModuleForEntity(typeName, data);
    const nodeId = makeNodeId(modulePath, typeName);

    nodes.push({
      id: nodeId,
      name: typeName,
      type: 'type',
      module: modulePath || 'unknown',
      line: safeNumber(type.line),
      metadata: {
        isExported: safeBoolean(type.isExported),
        definition: safeString(type.definition),
      },
    });
  }
}

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

function buildVariableNodes(
  entities: EntitiesResult,
  data: GraphData,
  nodes: EntityNode[]
): void {
  for (const variable of entities.variables || []) {
    const varName = safeString(variable.name);
    const modulePath = findModuleForEntity(varName, data);
    const nodeId = makeNodeId(modulePath, varName);

    nodes.push({
      id: nodeId,
      name: varName,
      type: 'variable',
      module: modulePath || 'unknown',
      line: safeNumber(variable.line),
      metadata: {
        isExported: safeBoolean(variable.isExported),
        dataType: safeString(variable.type),
        value: variable.value,
      },
    });
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default buildEntityGraph;