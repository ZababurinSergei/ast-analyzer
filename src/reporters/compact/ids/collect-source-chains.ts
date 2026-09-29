// src/reporters/compact/ids/collect-source-chains.ts
// ============================================================
// СБОР УНИКАЛЬНЫХ SOURCE CHAINS (v16.1.0)
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ----------
// Собирает все sourceChain из component*-секций и интернирует их.
// Используется для заполнения full.sourceChains[] и compact.sourceChains[].
//
// ════════════════════════════════════════════════════════════
// ИСТОЧНИКИ SOURCE CHAIN
// ════════════════════════════════════════════════════════════
//
//   1. ComponentProp.sourceChain       — цепочка prop-значения
//   2. ComponentEvent.handlerChain     — цепочка handler-а события
//   3. HtmlInterpolation.sourceChain   — цепочка интерполяции
//
// ════════════════════════════════════════════════════════════
// ИНТЕРНИРОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   Одинаковые цепочки (после сериализации) сохраняются ОДИН раз.
//   Порядок первого появления сохраняется — это критично для
//   симметрии с codec-encode.ts::addSourceChain.
//
// ════════════════════════════════════════════════════════════
// СЕРИАЛИЗАЦИЯ
// ════════════════════════════════════════════════════════════
//
//   serializeSourceChain() из core/source-chain-resolver.js
//   преобразует SourceChainItem[] в компактную строку с разделителями:
//     \u0002 — между полями одного элемента
//     \u0003 — между элементами
//     \u0004 — вместо отсутствующего значения
//
// ════════════════════════════════════════════════════════════
// ЗАЩИТА ОТ ОШИБОК
// ════════════════════════════════════════════════════════════
//
//   safeSerializeChain() оборачивает вызов в try/catch.
//   Если сериализация упала — возвращает null, элемент пропускается.
//   Это предотвращает падение всего pipeline из-за одной битой цепочки.
// ============================================================

import { serializeSourceChain } from '../../../core/source-chain-resolver.js';

// ============================================================
// ВНУТРЕННЯЯ УТИЛИТА
// ============================================================

/**
 * Безопасная сериализация sourceChain.
 *
 * Возвращает null, если:
 *   - chain не массив или пустой
 *   - serializeSourceChain бросил исключение
 *
 * @param chain — значение из ComponentProp.sourceChain и т.д.
 * @returns сериализованная строка или null
 */
function safeSerializeChain(chain: unknown): string | null {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    try {
        return serializeSourceChain(chain as any);
    } catch {
        return null;
    }
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * v16.1.0: сбор уникальных sourceChains (интернирование).
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Пройти по всем allComponentProps → взять sourceChain
 *   2. Пройти по всем allComponentEvents → взять handlerChain
 *   3. Пройти по всем allHtmlInterpolations → взять sourceChain
 *   4. Для каждого — safeSerializeChain
 *   5. Дедупликация через Set с сохранением порядка
 *
 * ════════════════════════════════════════════════════════════
 * ПОРЯДОК ОБХОДА
 * ════════════════════════════════════════════════════════════
 *
 *   ВАЖНО: порядок обхода (props → events → interpolations)
 *   должен совпадать с порядком в codec-encode.ts::addSourceChain.
 *   Иначе compact.sourceChains и full.sourceChains разойдутся,
 *   и round-trip L1/L2/DL/RE упадёт.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   // Вход:
 *   allComponentProps = [
 *     { sourceChain: [{kind:'prop',symbol:'user'},{kind:'member',symbol:'name'}] },
 *     { sourceChain: [{kind:'local',symbol:'isDirty'}] },
 *     { sourceChain: [{kind:'prop',symbol:'user'},{kind:'member',symbol:'name'}] }, // дубль
 *   ]
 *
 *   // Выход:
 *   [
 *     'prop\u0002user\u0003member\u0002name',
 *     'local\u0002isDirty',
 *   ]
 *
 * ════════════════════════════════════════════════════════════
 * @param allComponentProps      — аккумулятор props
 * @param allComponentEvents     — аккумулятор events
 * @param allHtmlInterpolations  — аккумулятор interpolations
 * @returns массив уникальных сериализованных sourceChain
 */
export function collectUniqueSourceChains(
    allComponentProps: any[],
    allComponentEvents: any[],
    allHtmlInterpolations: any[]
): string[] {
    const allSourceChains: string[] = [];

    // 1. Props: sourceChain
    for (const p of allComponentProps) {
        const s = safeSerializeChain(p?.sourceChain);
        if (s) allSourceChains.push(s);
    }

    // 2. Events: handlerChain
    for (const e of allComponentEvents) {
        const s = safeSerializeChain(e?.handlerChain);
        if (s) allSourceChains.push(s);
    }

    // 3. Interpolations: sourceChain
    for (const i of allHtmlInterpolations) {
        const s = safeSerializeChain(i?.sourceChain);
        if (s) allSourceChains.push(s);
    }

    // Дедупликация с сохранением порядка первого появления
    const uniqueSourceChains: string[] = [];
    const seenSc = new Set<string>();
    for (const sc of allSourceChains) {
        if (!seenSc.has(sc)) {
            seenSc.add(sc);
            uniqueSourceChains.push(sc);
        }
    }

    return uniqueSourceChains;
}
