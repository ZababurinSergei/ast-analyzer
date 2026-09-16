// src/core/type-graph-extractor.ts
// ============================================
// ЭКСТРАКТОР TYPE-ГРАФА (v9.0.0)
// ============================================
// Версия: 1.0.0
//
// Назначение:
//   Извлекает type-граф из проекта: объявления типов (interface,
//   type-alias, enum, class) и рёбра использования типов
//   (param, return, field, generic, union, extends).
//
// Технология:
//   ts-morph Project (уже используется в проекте: TypeScriptValidator,
//   AutoRefactor). Не требует отдельного TS-парсера.
//
// Что НЕ покрывает MVP:
//   - разрешение generic-цепочек (Array<TableProps> → TableProps);
//   - разрешение union через TypeChecker (только синтаксис);
//   - циклические зависимости типов (детектируются отдельно);
//   - type-only imports как отдельный вид связи.
//
// API:
//   extractTypeGraph(filePaths, options?) → TypeGraphResult
//
// Использование:
//   const result = extractTypeGraph(Object.keys(entitiesMap));
//   full.types = result.types;
//   full.typeRefs = result.typeRefs;
// ============================================

import path from 'path';
import fs from 'fs';
import { Project, Node } from 'ts-morph';
import type {
  TypeNodeData,
  TypeRefData,
  TypeKind,
  TypeUsageKind,
} from '../reporters/codec/codec-types.js';

// ============================================
// ОПЦИИ И РЕЗУЛЬТАТ
// ============================================

export interface TypeGraphOptions {
  /**
   * Корневая директория проекта.
   * Используется для разрешения относительных путей.
   * По умолчанию: process.cwd()
   */
  projectRoot?: string;

  /**
   * Максимальное количество файлов для анализа.
   * Защита от очень больших проектов.
   * По умолчанию: 5000
   */
  maxFiles?: number;

  /**
   * Включать ли классы как type-узлы.
   * По умолчанию: true
   */
  includeClasses?: boolean;

  /**
   * Включать ли enums.
   * По умолчанию: true
   */
  includeEnums?: boolean;

  /**
   * Подробный вывод.
   * По умолчанию: false
   */
  verbose?: boolean;
}

export interface TypeGraphResult {
  /** Объявления типов */
  types: TypeNodeData[];
  /** Рёбра использования типов */
  typeRefs: TypeRefData[];
  /** Статистика */
  stats: {
    totalTypes: number;
    totalRefs: number;
    byKind: Record<TypeKind, number>;
    byUsage: Record<TypeUsageKind, number>;
    duration: number;
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Извлекает type-граф из указанных файлов.
 *
 * @param filePaths — список путей к файлам (абсолютные или относительные)
 * @param options — опции извлечения
 * @returns TypeGraphResult с типами и рёбрами
 *
 * @example
 * ```ts
 * const result = extractTypeGraph(
 *   Object.keys(entitiesMap),
 *   { verbose: true }
 * );
 * console.log(`Types: ${result.stats.totalTypes}`);
 * console.log(`Refs: ${result.stats.totalRefs}`);
 * ```
 */
export function extractTypeGraph(
  filePaths: string[],
  options: TypeGraphOptions = {}
): TypeGraphResult {
  const startTime = Date.now();

  const {
    projectRoot = process.cwd(),
    maxFiles = 5000,
    includeClasses = true,
    includeEnums = true,
    verbose = false,
  } = options;

  const result: TypeGraphResult = {
    types: [],
    typeRefs: [],
    stats: {
      totalTypes: 0,
      totalRefs: 0,
      byKind: { interface: 0, 'type-alias': 0, enum: 0, class: 0 },
      byUsage: { param: 0, return: 0, field: 0, generic: 0, union: 0, extends: 0 },
      duration: 0,
    },
  };

  // ============================================
  // 1. ФИЛЬТРАЦИЯ ФАЙЛОВ
  // ============================================
  const validFiles = filePaths
    .map(fp => (path.isAbsolute(fp) ? fp : path.resolve(projectRoot, fp)))
    .filter(fp => {
      try {
        if (!fs.existsSync(fp)) return false;
        if (!fs.statSync(fp).isFile()) return false;
        // Только TypeScript-файлы
        return fp.endsWith('.ts') || fp.endsWith('.tsx');
      } catch {
        return false;
      }
    })
    .slice(0, maxFiles);

  if (validFiles.length === 0) {
    if (verbose) {
      console.log('   ⚠️ [type-graph] Нет .ts/.tsx файлов для анализа');
    }
    result.stats.duration = Date.now() - startTime;
    return result;
  }

  if (verbose) {
    console.log(`   🔍 [type-graph] Анализ ${validFiles.length} файлов...`);
  }

  // ============================================
  // 2. СОЗДАНИЕ PROJECT
  // ============================================
  let project: Project;
  try {
    project = new Project({
      compilerOptions: {
        target: 99, // ESNext
        module: 99, // ESNext
        allowJs: false,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: 2, // React JSX
        noEmit: true,
      },
      useInMemoryFileSystem: false,
    });
  } catch (error) {
    if (verbose) {
      console.warn(
        `   ⚠️ [type-graph] Не удалось создать Project: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    result.stats.duration = Date.now() - startTime;
    return result;
  }

  // ============================================
  // 3. ДОБАВЛЕНИЕ ФАЙЛОВ
  // ============================================
  let addedFiles = 0;
  const filePathToModuleId = new Map<string, string>();
  const filePathToFileId = new Map<string, string>();

  for (const fp of validFiles) {
    try {
      project.addSourceFileAtPath(fp);
      addedFiles++;

      // Определяем moduleId/fileId так же, как в compact-reporter
      const relativePath = path.relative(projectRoot, fp).replace(/\\/g, '/');
      const dirName = path.basename(path.dirname(relativePath)) || 'root';
      filePathToModuleId.set(fp, dirName);
      filePathToFileId.set(fp, relativePath);
    } catch {
      // Игнорируем ошибки отдельных файлов
    }
  }

  if (verbose) {
    console.log(`   📁 [type-graph] Добавлено файлов: ${addedFiles}/${validFiles.length}`);
  }

  // ============================================
  // 4. ОБХОД ФАЙЛОВ
  // ============================================
  let typeCounter = 0;
  let refCounter = 0;

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const moduleId = filePathToModuleId.get(filePath) || 'root';
    const fileId = filePathToFileId.get(filePath) || path.basename(filePath);

    try {
      // 4.1. Интерфейсы
      for (const intf of sourceFile.getInterfaces()) {
        typeCounter++;
        const members = intf.getProperties().map(p => p.getName());
        const extendsTypes = intf.getExtends().map(e => e.getText());

        result.types.push({
          id: `t${typeCounter}`,
          kind: 'interface',
          name: intf.getName(),
          moduleId,
          fileId,
          line: intf.getStartLineNumber(),
          members,
          extendsTypes,
        });

        // Рёбра extends
        for (const ext of extendsTypes) {
          refCounter++;
          result.typeRefs.push({
            id: `tr${refCounter}`,
            typeName: ext,
            moduleId,
            fileId,
            line: intf.getStartLineNumber(),
            usageKind: 'extends',
          });
        }
      }

      // 4.2. Type aliases
      for (const ta of sourceFile.getTypeAliases()) {
        typeCounter++;
        const typeNode = ta.getTypeNode();
        const members: string[] = [];

        // Разрешаем object literal
        if (typeNode && Node.isTypeLiteral(typeNode)) {
          for (const member of typeNode.getMembers()) {
            if (Node.isPropertySignature(member)) {
              const name = member.getName();
              if (name) members.push(name);
            }
          }
        }

        result.types.push({
          id: `t${typeCounter}`,
          kind: 'type-alias',
          name: ta.getName(),
          moduleId,
          fileId,
          line: ta.getStartLineNumber(),
          members,
          extendsTypes: [],
        });

        // Рёбра union
        if (typeNode && Node.isUnionTypeNode(typeNode)) {
          for (const unionType of typeNode.getTypeNodes()) {
            const name = unionType.getText();
            if (isSimpleIdentifier(name)) {
              refCounter++;
              result.typeRefs.push({
                id: `tr${refCounter}`,
                typeName: name,
                moduleId,
                fileId,
                line: ta.getStartLineNumber(),
                usageKind: 'union',
              });
            }
          }
        }
      }

      // 4.3. Enums
      if (includeEnums) {
        for (const enumDecl of sourceFile.getEnums()) {
          typeCounter++;
          const members = enumDecl.getMembers().map(m => m.getName());

          result.types.push({
            id: `t${typeCounter}`,
            kind: 'enum',
            name: enumDecl.getName(),
            moduleId,
            fileId,
            line: enumDecl.getStartLineNumber(),
            members,
            extendsTypes: [],
          });
        }
      }

      // 4.4. Classes
      if (includeClasses) {
        for (const cls of sourceFile.getClasses()) {
          const name = cls.getName();
          if (!name) continue;

          typeCounter++;
          const members = [
            ...cls.getProperties().map(p => p.getName()),
            ...cls.getMethods().map(m => m.getName()),
          ];
          const extendsType = cls.getExtends()?.getText();

          result.types.push({
            id: `t${typeCounter}`,
            kind: 'class',
            name,
            moduleId,
            fileId,
            line: cls.getStartLineNumber(),
            members,
            extendsTypes: extendsType ? [extendsType] : [],
          });

          if (extendsType) {
            refCounter++;
            result.typeRefs.push({
              id: `tr${refCounter}`,
              typeName: extendsType,
              moduleId,
              fileId,
              line: cls.getStartLineNumber(),
              usageKind: 'extends',
            });
          }
        }
      }

      // 4.5. Использование типов в функциях (param, return)
      for (const func of sourceFile.getFunctions()) {
        // Параметры
        for (const param of func.getParameters()) {
          const typeNode = param.getTypeNode();
          if (typeNode) {
            const typeName = typeNode.getText();
            if (isSimpleIdentifier(typeName)) {
              refCounter++;
              result.typeRefs.push({
                id: `tr${refCounter}`,
                typeName,
                moduleId,
                fileId,
                line: param.getStartLineNumber(),
                usageKind: 'param',
              });
            }

            // Generic-параметры (MVP: только верхний уровень)
            if (Node.isTypeReference(typeNode)) {
              const typeArgs = typeNode.getTypeArguments();
              for (const arg of typeArgs) {
                const argName = arg.getText();
                if (isSimpleIdentifier(argName)) {
                  refCounter++;
                  result.typeRefs.push({
                    id: `tr${refCounter}`,
                    typeName: argName,
                    moduleId,
                    fileId,
                    line: param.getStartLineNumber(),
                    usageKind: 'generic',
                  });
                }
              }
            }
          }
        }

        // Возвращаемый тип
        const returnTypeNode = func.getReturnTypeNode();
        if (returnTypeNode) {
          const typeName = returnTypeNode.getText();
          if (isSimpleIdentifier(typeName)) {
            refCounter++;
            result.typeRefs.push({
              id: `tr${refCounter}`,
              typeName,
              moduleId,
              fileId,
              line: func.getStartLineNumber(),
              usageKind: 'return',
            });
          }

          // Generic в возврате
          if (Node.isTypeReference(returnTypeNode)) {
            const typeArgs = returnTypeNode.getTypeArguments();
            for (const arg of typeArgs) {
              const argName = arg.getText();
              if (isSimpleIdentifier(argName)) {
                refCounter++;
                result.typeRefs.push({
                  id: `tr${refCounter}`,
                  typeName: argName,
                  moduleId,
                  fileId,
                  line: func.getStartLineNumber(),
                  usageKind: 'generic',
                });
              }
            }
          }
        }
      }

      // 4.6. Использование типов в переменных (field)
      for (const varDecl of sourceFile.getVariableDeclarations()) {
        const typeNode = varDecl.getTypeNode();
        if (typeNode) {
          const typeName = typeNode.getText();
          if (isSimpleIdentifier(typeName)) {
            refCounter++;
            result.typeRefs.push({
              id: `tr${refCounter}`,
              typeName,
              moduleId,
              fileId,
              line: varDecl.getStartLineNumber(),
              usageKind: 'field',
            });
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки отдельных файлов
      if (verbose) {
        console.debug(
          `   ⚠️ [type-graph] Ошибка в ${path.basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  // ============================================
  // 5. СТАТИСТИКА
  // ============================================
  result.stats.totalTypes = result.types.length;
  result.stats.totalRefs = result.typeRefs.length;

  for (const t of result.types) {
    result.stats.byKind[t.kind] = (result.stats.byKind[t.kind] || 0) + 1;
  }

  for (const r of result.typeRefs) {
    result.stats.byUsage[r.usageKind] = (result.stats.byUsage[r.usageKind] || 0) + 1;
  }

  result.stats.duration = Date.now() - startTime;

  if (verbose) {
    console.log(
      `   ✅ [type-graph] Types: ${result.stats.totalTypes}, ` +
        `Refs: ${result.stats.totalRefs} (${result.stats.duration}ms)`
    );
    console.log(
      `      • interface: ${result.stats.byKind.interface}, ` +
        `type-alias: ${result.stats.byKind['type-alias']}, ` +
        `enum: ${result.stats.byKind.enum}, ` +
        `class: ${result.stats.byKind.class}`
    );
    console.log(
      `      • param: ${result.stats.byUsage.param}, ` +
        `return: ${result.stats.byUsage.return}, ` +
        `field: ${result.stats.byUsage.field}, ` +
        `generic: ${result.stats.byUsage.generic}, ` +
        `union: ${result.stats.byUsage.union}, ` +
        `extends: ${result.stats.byUsage.extends}`
    );
  }

  return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, является ли имя простым идентификатором типа.
 *
 * Отсеивает:
 *   - литералы ('string', 42, true);
 *   - встроенные примитивы (string, number, boolean, any, void, unknown, never);
 *   - сложные выражения (Array<X>, { a: X }, X | Y);
 *   - пустые строки.
 *
 * Оставляет:
 *   - PascalCase имена пользовательских типов (TableProps, DataType);
 *   - SCREAMING_CASE константы (TABS_API_KEY — на случай InjectionKey).
 *
 * @param name — текстовое представление типа
 * @returns true, если имя похоже на пользовательский тип
 */
function isSimpleIdentifier(name: string): boolean {
  if (!name) return false;
  if (name.length < 2) return false;
  if (name.length > 100) return false;

  // Литералы
  if (name.startsWith("'") || name.startsWith('"') || name.startsWith('`')) return false;

  // Встроенные примитивы
  const builtins = new Set([
    'string',
    'number',
    'boolean',
    'any',
    'void',
    'unknown',
    'never',
    'null',
    'undefined',
    'object',
    'symbol',
    'bigint',
    'this',
    'String',
    'Number',
    'Boolean',
    'Object',
    'Function',
    'Array',
    'Promise',
    'Date',
    'RegExp',
    'Error',
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
  ]);
  if (builtins.has(name)) return false;

  // Только идентификатор: [A-Za-z_$][A-Za-z0-9_$]*
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/**
 * Возвращает true, если файл является TypeScript-файлом.
 */
export function isTypeScriptFile(filePath: string): boolean {
  return filePath.endsWith('.ts') || filePath.endsWith('.tsx');
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  extractTypeGraph,
  isTypeScriptFile,
};
