// src/utils/silence-ts-morph.ts
// ============================================
// ФИЛЬТР ШУМА ОТ ts-morph
// ============================================
// Версия: 1.0.0
//
// Назначение:
//   ts-morph (и его внутренний TypeScript-чекер) иногда пишет в stderr
//   ошибки вида:
//     "Cannot read properties of undefined (reading 'escapedName')"
//     "Cannot read properties of undefined (reading 'flags')"
//   Эти ошибки возникают при попытке получить тип/сигнатуру для узлов,
//   которые TypeScript не может разрешить (например, для `<script setup>`
//   в .vue-файлах, где `defineProps`/`defineEmits` не имеют явной
//   типизации, для деструктуризации `ref`/`computed` и т.п.).
//
//   Это НЕ ошибки анализа — все они перехватываются в `safeGetType` /
//   `safeGetReturnType` и заменяются на `'any'`. Но ts-morph успевает
//   записать сообщение в stderr ДО того, как исключение будет поймано
//   вызывающим кодом.
//
//   Данный модуль перехватывает `process.stderr.write` и тихо
//   игнорирует сообщения, соответствующие известным паттернам.
//
// Использование:
//   import { silenceTsMorphNoise } from './utils/silence-ts-morph.js';
//   silenceTsMorphNoise(); // вызвать ОДИН РАЗ в точке входа CLI
//
// Отключение:
//   Установите переменную окружения AST_DEBUG_TYPES=true, и фильтр
//   начнёт пропускать сообщения (для отладки).
// ============================================

// ============================================
// ПАТТЕРНЫ ШУМА
// ============================================

/**
 * Регулярные выражения для сообщений, которые нужно игнорировать.
 *
 * Все паттерны заякорены на начало сообщения (или содержат ключевую
 * фразу), чтобы случайно не заглушить реальные ошибки.
 */
const IGNORED_STDERR_PATTERNS: RegExp[] = [
  // ts-morph / TypeScript checker: сломанный symbol
  /Cannot read properties of undefined \(reading 'escapedName'\)/,
  /Cannot read properties of undefined \(reading 'flags'\)/,
  // ts-morph: обращения к отсутствующему узлу
  /Cannot read properties of undefined \(reading 'kind'\)/,
  /Cannot read properties of undefined \(reading 'getKind'\)/,
  // Стек-трейсы, начинающиеся с этих сообщений (для многострочных выводов)
  /^\s+at .*getTypeAtLocation/,
  /^\s+at .*getTypeOfSymbolAtLocation/,
];

// ============================================
// ФЛАГИ
// ============================================

let installed = false;

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

/**
 * Устанавливает фильтр шума ts-morph на `process.stderr.write`.
 *
 * Идемпотентна: повторные вызовы не создают дополнительных обёрток.
 *
 * Если `process.env.AST_DEBUG_TYPES === 'true'` — фильтр НЕ устанавливается,
 * и все сообщения проходят как обычно (для отладки).
 *
 * @returns `true`, если фильтр был установлен; `false`, если он уже был установлен
 *          ранее или отключён через переменную окружения.
 */
export function silenceTsMorphNoise(): boolean {
  // Если уже установлен — ничего не делаем
  if (installed) {
    return false;
  }

  // Если включён режим отладки — не глушим
  if (process.env.AST_DEBUG_TYPES === 'true') {
    return false;
  }

  // Сохраняем оригинальный метод
  const originalWrite = process.stderr.write.bind(process.stderr);

  // Устанавливаем обёртку
  process.stderr.write = function (
    chunk: any,
    encoding?: BufferEncoding | ((err?: Error) => void),
    callback?: (err?: Error) => void
  ): boolean {
    // Приводим chunk к строке
    let text: string;
    if (typeof chunk === 'string') {
      text = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      text = chunk.toString('utf-8');
    } else if (chunk instanceof Uint8Array) {
      text = Buffer.from(chunk).toString('utf-8');
    } else {
      text = String(chunk);
    }

    // Проверяем на совпадение с паттернами шума
    if (isNoisyMessage(text)) {
      // Тихо игнорируем — но вызываем callback, если он был передан,
      // чтобы не сломать поток (некоторые потребители ждут его вызова).
      if (typeof encoding === 'function') {
        encoding();
      } else if (callback) {
        callback();
      }
      return true;
    }

    // Пропускаем как обычно
    return originalWrite(chunk, encoding as any, callback as any);
  } as typeof process.stderr.write;

  installed = true;
  return true;
}

// ============================================
// ВНУТРЕННИЕ ФУНКЦИИ
// ============================================

/**
 * Проверяет, соответствует ли сообщение одному из известных паттернов шума.
 */
function isNoisyMessage(text: string): boolean {
  if (!text) return false;

  for (const pattern of IGNORED_STDERR_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Снимает фильтр (возвращает оригинальный `process.stderr.write`).
 *
 * Полезно для тестов и для случаев, когда фильтр нужно отключить
 * после инициализации.
 *
 * @returns `true`, если фильтр был снят; `false`, если он не был установлен.
 */
export function unsilenceTsMorphNoise(): boolean {
  if (!installed) {
    return false;
  }

  // Восстанавливаем оригинальный метод через prototype
  // (мы не храним ссылку глобально, поэтому используем delete)
  // ⚠️ Это работает только если фильтр был установлен через нашу функцию
  // и оригинальный метод всё ещё доступен через prototype.
  try {
    delete (process.stderr as any).write;
    installed = false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Проверяет, установлен ли фильтр в данный момент.
 */
export function isSilenceInstalled(): boolean {
  return installed;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  silenceTsMorphNoise,
  unsilenceTsMorphNoise,
  isSilenceInstalled,
  IGNORED_STDERR_PATTERNS,
};
