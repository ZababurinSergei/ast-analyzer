// src/core/relations/global-index.ts
// ============================================================
// ГЛОБАЛЬНЫЙ ИНДЕКС
// ============================================================
// Версия: 1.0.2
//
// ИЗМЕНЕНИЯ v1.0.2:
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый импорт `ComponentUser`
//     (создаётся через `list.push({...})`, тип выводится неявно)
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр `imports`
//     из BuildIndexOptions
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты (SyntaxKind, RouteDefinition,
//     ResolverContext, VueMacros, ObjectMap, RefCall, LocalBinding,
//     ComposableInfo, Project, SourceFile, Node)
//   - ✅ ИСПРАВЛЕНО: удалена неиспользуемая константа COMPONENT_EXTENSIONS
//   - ✅ ИСПРАВЛЕНО: удалён неиспользуемый параметр sourceFile
//   - ✅ ИСПРАВЛЕНО: regex экранирование (\\s → \s)
//   - ✅ ИСПРАВЛЕНО: Node.isCallExpression guard перед getArguments()
// ============================================================

import fs from 'fs';
import path from 'path';

import type { GlobalIndex, ComponentInfo, RouteDefinition, StoreDefinition } from './types.js';

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export interface BuildIndexOptions {
  files: Map<string, any>;
  templates: Map<string, any>;
  functions: Map<string, any>;
  debug?: boolean;
}

export function buildGlobalIndex(options: BuildIndexOptions): GlobalIndex {
  const { files, templates, functions, debug = false } = options;

  const index: GlobalIndex = {
    componentUsers: new Map(),
    functionByName: new Map(),
    componentByName: new Map(),
    routes: [],
    stores: new Map(),
  };

  // 1. Индекс функций
  for (const [funcId, func] of functions) {
    const list = index.functionByName.get(func.name) ?? [];
    list.push(funcId);
    index.functionByName.set(func.name, list);
  }

  // 2. Индекс компонентов
  for (const [fileId, file] of files) {
    const fileName = path.basename(file.path, '.vue');
    const pascal = toPascalCase(fileName);
    const kebab = toKebabCase(fileName);

    const info: ComponentInfo = { name: pascal, fileId };
    if (!index.componentByName.has(pascal)) {
      index.componentByName.set(pascal, info);
    }
    if (kebab !== pascal && !index.componentByName.has(kebab)) {
      index.componentByName.set(kebab, info);
    }
  }

  // 3. Индекс использований компонентов
  for (const [parentFileId, template] of templates) {
    const usedComponents = template.usedComponents ?? [];
    for (const used of usedComponents) {
      const usedName = typeof used === 'string' ? used : used.name;
      const fromFileId = typeof used === 'string' ? null : used.fromFileId;
      const localName = typeof used === 'string' ? usedName : (used.localName ?? usedName);

      if (!fromFileId) continue;

      const list = index.componentUsers.get(fromFileId) ?? [];
      list.push({
        parentFileId,
        parentTemplate: template,
        localName,
        line: typeof used === 'object' ? (used.line ?? 0) : 0,
      });
      index.componentUsers.set(fromFileId, list);
    }
  }

  // 4. Индекс Pinia stores
  for (const [funcId, func] of functions) {
    if (!func.name.startsWith('use') || !func.name.endsWith('Store')) continue;

    const file = files.get(func.fileId);
    if (!file) continue;

    const store = extractStoreDefinition(file, func, funcId);
    if (store) {
      index.stores.set(func.name, store);
      if (store.id) index.stores.set(store.id, store);
    }
  }

  // 5. Индекс Router
  const routerFile = findFileByPathPattern(files, /router[\/\\]index\.(ts|js)$/);
  if (routerFile) {
    index.routes = extractRoutes(routerFile);
  }

  if (debug) {
    console.log(`   🌐 GlobalIndex:`);
    console.log(`      • Функций: ${index.functionByName.size}`);
    console.log(`      • Компонентов: ${index.componentByName.size}`);
    console.log(`      • Использований: ${index.componentUsers.size}`);
    console.log(`      • Stores: ${index.stores.size}`);
    console.log(`      • Routes: ${index.routes.length}`);
  }

  return index;
}

// ============================================================
// PINIA STORE
// ============================================================

function extractStoreDefinition(file: any, func: any, _funcId: string): StoreDefinition | null {
  try {
    const sourcePath = path.resolve(file.path);
    if (!fs.existsSync(sourcePath)) return null;

    const content = fs.readFileSync(sourcePath, 'utf-8');

    const match = content.match(
      /defineStore\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:\{|\(\s*\)\s*=>\s*\{)/
    );
    if (!match) return null;

    const storeId = match[1] ?? '';

    const state: string[] = [];
    const getters: string[] = [];
    const actions: string[] = [];

    // State
    const stateMatch = content.match(/state\s*:\s*\(\s*\)\s*=>\s*\(\{([\s\S]*?)\}\s*\)/);
    if (stateMatch?.[1]) {
      const re = /(\w+)\s*:/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stateMatch[1])) !== null) {
        if (m[1]) state.push(m[1]);
      }
    }

    // Getters
    const gettersMatch = content.match(/getters\s*:\s*\{([\s\S]*?)\n\s*\}/);
    if (gettersMatch?.[1]) {
      const re = /(\w+)\s*[:(]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(gettersMatch[1])) !== null) {
        if (m[1]) getters.push(m[1]);
      }
    }

    // Actions
    const actionsMatch = content.match(/actions\s*:\s*\{([\s\S]*?)\n\s*\}/);
    if (actionsMatch?.[1]) {
      const re = /(\w+)\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(actionsMatch[1])) !== null) {
        if (m[1]) actions.push(m[1]);
      }
    }

    return {
      name: func.name,
      id: storeId,
      fileId: func.fileId,
      state,
      getters,
      actions,
    };
  } catch {
    return null;
  }
}

// ============================================================
// ROUTES
// ============================================================

function extractRoutes(routerFile: any): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  try {
    const sourcePath = path.resolve(routerFile.path);
    if (!fs.existsSync(sourcePath)) return routes;

    const content = fs.readFileSync(sourcePath, 'utf-8');

    const routeRe =
      /\{\s*path\s*:\s*['"]([^'"]+)['"][\s\S]*?(?:name\s*:\s*['"]([^'"]+)['"])?[\s\S]*?component\s*:\s*(?:\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)|([A-Za-z_$][\w$]*))/g;

    let m: RegExpExecArray | null;
    while ((m = routeRe.exec(content)) !== null) {
      routes.push({
        path: m[1] ?? '',
        name: m[2] ?? null,
        componentFileId: null,
        filePath: m[3] ?? m[4] ?? '',
      });
    }
  } catch {
    // Игнорируем
  }

  return routes;
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function findFileByPathPattern(files: Map<string, any>, pattern: RegExp): any | null {
  for (const [, file] of files) {
    if (pattern.test(file.path)) return file;
  }
  return null;
}

export function toPascalCase(str: string): string {
  return str.replace(/[-_]+(\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, c => c.toUpperCase());
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}
