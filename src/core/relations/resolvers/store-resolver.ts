// src/core/relations/resolvers/store-resolver.ts
// ============================================================
// МОДУЛЬ 11.1: РЕЗОЛВИНГ PINIA STORES
// ============================================================
// Версия: 1.0.2
//
// ИЗМЕНЕНИЯ v1.0.2:
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты
//     (ImportRecord, FunctionRecord, LocalBinding)
//   - ✅ ИСПРАВЛЕНО: regex-экранирование (\\s → \s)
//   - ✅ ИСПРАВЛЕНО: используется ctx.importsByFileId, ctx.functionsByFileId,
//     ctx.scriptASTs
//   - ✅ ИСПРАВЛЕНО: неиспользуемый ctx в computeStats → _ctx
//   - ✅ УПРОЩЕНО: единая логика анализа содержимого <script setup>
// ============================================================

import type { ResolverContext } from '../types.js';

// ============================================================
// ТИПЫ (внутренние)
// ============================================================

type StoreUsageKind =
  | 'call' // useUserStore()
  | 'storeToRefs' // storeToRefs(useUserStore())
  | 'map-state' // mapState(useUserStore, ...)
  | 'map-actions' // mapActions(useUserStore, ...)
  | 'map-getters'; // mapGetters(useUserStore, ...)

interface StoreUsage {
  storeName: string;
  kind: StoreUsageKind;
  fileId: string;
  line: number;
  resolved: boolean;
  storeId?: string;
  storeFileId?: string;
}

interface StoreResolveStats {
  totalUsages: number;
  resolved: number;
  unresolved: number;
  byStore: Record<string, number>;
  byKind: Record<StoreUsageKind, number>;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

export function resolveStores(ctx: ResolverContext): number {
  const usages: StoreUsage[] = [];

  // Проходим по всем файлам, у которых есть scriptASTs
  if (!ctx.scriptASTs) return 0;

  for (const [fileId, astBundle] of ctx.scriptASTs) {
    const content = safeReadSource(astBundle);
    if (!content) continue;

    // Ищем все использования stores через regex (надёжнее для Vue SFC)
    const foundUsages = findStoreUsages(content, fileId);
    usages.push(...foundUsages);
  }

  // Разрешаем каждый usage через index.stores
  for (const usage of usages) {
    const store = ctx.index.stores.get(usage.storeName);
    if (store) {
      usage.resolved = true;
      usage.storeId = store.id;
      usage.storeFileId = store.fileId;
    } else {
      usage.resolved = false;
    }
  }

  // Обогащаем функции routeRefs-подобным полем stores
  attachUsagesToFunctions(ctx, usages);

  const stats = computeStats(ctx, usages);

  if (ctx.debug) {
    console.log(
      `   🏬 Stores: ${stats.resolved}/${stats.totalUsages} (unresolved: ${stats.unresolved})`
    );
    for (const [name, count] of Object.entries(stats.byStore)) {
      console.log(`      • ${name}: ${count}`);
    }
  }

  return stats.resolved;
}

// ============================================================
// ПОИСК STORE USAGE В ИСХОДНИКЕ
// ============================================================

function findStoreUsages(content: string, fileId: string): StoreUsage[] {
  const usages: StoreUsage[] = [];

  // 1. Прямые вызовы: useUserStore() / const store = useUserStore()
  const callRe = /\b(use[A-Z]\w*Store)\s*\(/g;
  addMatches(usages, content, fileId, callRe, 'call');

  // 2. storeToRefs(useUserStore())
  const storeToRefsRe = /storeToRefs\s*\(\s*(use[A-Z]\w*Store)/g;
  addMatches(usages, content, fileId, storeToRefsRe, 'storeToRefs');

  // 3. mapState(useUserStore, ...) / mapState('user', ...)
  const mapStateRe = /mapState\s*\(\s*(use[A-Z]\w*Store)/g;
  addMatches(usages, content, fileId, mapStateRe, 'map-state');

  // 4. mapActions(useUserStore, ...)
  const mapActionsRe = /mapActions\s*\(\s*(use[A-Z]\w*Store)/g;
  addMatches(usages, content, fileId, mapActionsRe, 'map-actions');

  // 5. mapGetters(useUserStore, ...)
  const mapGettersRe = /mapGetters\s*\(\s*(use[A-Z]\w*Store)/g;
  addMatches(usages, content, fileId, mapGettersRe, 'map-getters');

  // Дедупликация: одинаковые (storeName, kind, line) → один usage
  const seen = new Set<string>();
  return usages.filter(u => {
    const key = `${u.storeName}|${u.kind}|${u.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function addMatches(
  out: StoreUsage[],
  content: string,
  fileId: string,
  regex: RegExp,
  kind: StoreUsageKind
): void {
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    const storeName = m[1];
    if (!storeName) continue;

    const line = content.substring(0, m.index).split('\n').length;

    out.push({
      storeName,
      kind,
      fileId,
      line,
      resolved: false,
    });
  }
}

// ============================================================
// ОБОГАЩЕНИЕ ФУНКЦИЙ
// ============================================================

/**
 * Пробуем привязать usage к конкретной функции в файле.
 * Если usage внутри функции — вешаем на неё; иначе — на файл.
 */
function attachUsagesToFunctions(ctx: ResolverContext, usages: StoreUsage[]): void {
  const byFile = new Map<string, StoreUsage[]>();
  for (const u of usages) {
    const list = byFile.get(u.fileId) ?? [];
    list.push(u);
    byFile.set(u.fileId, list);
  }

  for (const [fileId, fileUsages] of byFile) {
    const fileFunctions = ctx.functionsByFileId.get(fileId) ?? [];

    for (const usage of fileUsages) {
      // Ищем функцию, в диапазоне строк которой находится usage
      // (грубо: line функции <= line usage <= line следующей функции)
      const sorted = [...fileFunctions].sort((a, b) => a.line - b.line);
      let owner: any = null;

      for (const fn of sorted) {
        if (fn.line <= usage.line) {
          owner = fn;
        } else {
          break;
        }
      }

      if (owner) {
        owner.storeUsages = owner.storeUsages ?? [];
        owner.storeUsages.push({
          storeName: usage.storeName,
          kind: usage.kind,
          line: usage.line,
          resolved: usage.resolved,
          storeId: usage.storeId,
          storeFileId: usage.storeFileId,
        });
      }
    }
  }
}

// ============================================================
// СТАТИСТИКА
// ============================================================

function computeStats(_ctx: ResolverContext, usages: StoreUsage[]): StoreResolveStats {
  const byStore: Record<string, number> = {};
  const byKind: Record<StoreUsageKind, number> = {
    call: 0,
    storeToRefs: 0,
    'map-state': 0,
    'map-actions': 0,
    'map-getters': 0,
  };

  let resolved = 0;
  let unresolved = 0;

  for (const u of usages) {
    byStore[u.storeName] = (byStore[u.storeName] ?? 0) + 1;
    byKind[u.kind]++;
    if (u.resolved) resolved++;
    else unresolved++;
  }

  return {
    totalUsages: usages.length,
    resolved,
    unresolved,
    byStore,
    byKind,
  };
}

// ============================================================
// УТИЛИТЫ
// ============================================================

function safeReadSource(astBundle: any): string | null {
  try {
    if (!astBundle) return null;

    // ts-morph SourceFile
    if (astBundle.sourceFile && typeof astBundle.sourceFile.getFullText === 'function') {
      return astBundle.sourceFile.getFullText();
    }
    if (astBundle.sourceFile && typeof astBundle.sourceFile.getText === 'function') {
      return astBundle.sourceFile.getText();
    }

    // ESTree AST с _originalCode
    if (astBundle.ast && astBundle.ast._originalCode) {
      return astBundle.ast._originalCode;
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { resolveStores };
