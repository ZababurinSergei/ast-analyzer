// src/pipeline/errors.ts
// ============================================================
// ОШИБКИ PIPELINE
// ============================================================
// Версия: 1.0.0
//
// НАЗНАЧЕНИЕ
// ------------------------------------------------------------
// Иерархия ошибок для pipeline. Используется для:
//   - типизации throw в stages и оркестраторе
//   - различения ошибок pipeline от системных ошибок
//   - сохранения контекста (какой stage, какой файл)
//
// ИЕРАРХИЯ
// ------------------------------------------------------------
//
//   Error
//     │
//     ├── PipelineError
//     │     Базовая ошибка pipeline.
//     │     Содержит: stage, file, cause.
//     │
//     └── StageError (extends PipelineError)
//           Ошибка конкретного stage.
//           Формат сообщения: "[stage] message".
//
// ПРИНЦИПЫ
// ------------------------------------------------------------
//
//   1. ОБЁРТКА, А НЕ ЗАМЕНА
//      PipelineError НЕ заменяет оригинальную ошибку —
//      она её оборачивает. Оригинал доступен через
//      `error.cause` (стандартное поле ES2022).
//
//   2. КОНТЕКСТ
//      Каждая ошибка знает:
//        - stage  — на каком этапе произошла
//        - file   — в каком файле (если применимо)
//        - cause  — оригинальная ошибка
//
//   3. СТЕК ВЫЗОВОВ
//      Через `Error.captureStackTrace` (V8) сохраняем
//      стек, но исключаем из него конструктор — чтобы
//      не засорять вывод.
//
//   4. INSTANCEOF
//      Работает корректно благодаря правильной настройке
//      прототипа (`Object.setPrototypeOf`). Иначе в
//      транспилированном коде `instanceof` может
//      сломаться для наследников встроенных классов.
//
// ИСПОЛЬЗОВАНИЕ
// ------------------------------------------------------------
//
//   // 1. Простая ошибка pipeline
//   throw new PipelineError('Что-то пошло не так');
//
//   // 2. С контекстом stage
//   throw new PipelineError('Парсинг прерван', {
//     stage: 'parse-file',
//     file: '/abs/path/a.ts',
//   });
//
//   // 3. StageError — сокращённая форма
//   throw new StageError('parse-file', 'Синтаксическая ошибка',
//                        '/abs/path/a.ts', originalError);
//
//   // 4. Проверка типа
//   try {
//     await pipeline.run();
//   } catch (e) {
//     if (e instanceof StageError) {
//       console.error(`Stage ${e.stage}: ${e.message}`);
//     } else if (e instanceof PipelineError) {
//       console.error(`Pipeline: ${e.message}`);
//     }
//   }
//
// ============================================================

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Опции для создания `PipelineError`.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЛЯ
 * ════════════════════════════════════════════════════════════
 *
 *   stage  — имя stage, где произошла ошибка
 *   file   — путь к файлу (если ошибка связана с файлом)
 *   cause  — оригинальная ошибка (для обёртки)
 *
 * ════════════════════════════════════════════════════════════
 * ВСЕ ПОЛЯ ОПЦИОНАЛЬНЫ
 * ════════════════════════════════════════════════════════════
 *
 *   PipelineError можно создавать в любом контексте:
 *     - внутри stage (есть stage, file)
 *     - в оркестраторе (есть stage, но нет file)
 *     - при создании контекста (нет ни stage, ни file)
 */
export interface PipelineErrorOptions {
  /**
   * Имя stage, где произошла ошибка.
   *
   * Примеры: 'discover-files', 'parse-file',
   *          'enrich-re-exports', 'normalize-entities',
   *          'build-report'.
   */
  stage?: string;

  /**
   * Путь к файлу, с которым связана ошибка.
   *
   * Специальное значение '<pipeline>' — ошибка самого
   * pipeline (не привязана к конкретному файлу).
   */
  file?: string;

  /**
   * Оригинальная ошибка (для обёртки).
   *
   * Сохраняется в стандартном поле ES2022 `Error.cause`.
   * Позволяет восстановить полную цепочку ошибок.
   */
  cause?: unknown;
}

// ============================================================
// БАЗОВАЯ ОШИБКА PIPELINE
// ============================================================

/**
 * Базовая ошибка pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ ОБЫЧНОГО Error
 * ════════════════════════════════════════════════════════════
 *
 *   - Содержит опциональные поля `stage` и `file`
 *   - Корректно работает с `instanceof` (в т.ч. в
 *     транспилированном коде)
 *   - Правильно настраивает `name` = 'PipelineError'
 *   - Поддерживает `cause` (ES2022)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // 1. Минимальная
 *   throw new PipelineError('Не удалось инициализировать pipeline');
 *
 *   // 2. Со stage
 *   throw new PipelineError('Stage не вернул контекст', {
 *     stage: 'parse-file',
 *   });
 *
 *   // 3. Со stage и файлом
 *   throw new PipelineError('Ошибка чтения файла', {
 *     stage: 'parse-file',
 *     file: '/abs/path/a.ts',
 *   });
 *
 *   // 4. С cause (обёртка)
 *   try {
 *     doSomething();
 *   } catch (err) {
 *     throw new PipelineError('Внутренняя ошибка', {
 *       stage: 'parse-file',
 *       cause: err,
 *     });
 *   }
 *
 *   // 5. Проверка типа
 *   if (err instanceof PipelineError) {
 *     console.log(err.stage);   // string | undefined
 *     console.log(err.file);    // string | undefined
 *     console.log(err.cause);   // unknown
 *   }
 */
export class PipelineError extends Error {
  // ==========================================================
  // ПУБЛИЧНЫЕ ПОЛЯ
  // ==========================================================

  /**
   * Имя stage, где произошла ошибка.
   *
   * `undefined`, если ошибка не привязана к конкретному stage.
   */
  public readonly stage?: string;

  /**
   * Путь к файлу, с которым связана ошибка.
   *
   * `undefined`, если ошибка не привязана к конкретному файлу.
   * Может быть `<pipeline>` для ошибок самого оркестратора.
   */
  public readonly file?: string;

  // ==========================================================
  // КОНСТРУКТОР
  // ==========================================================

  /**
   * Создаёт ошибку pipeline.
   *
   * @param message — сообщение об ошибке
   * @param options — опциональный контекст (stage, file, cause)
   *
   * @example
   * ```typescript
   * // Минимальная
   * new PipelineError('Something went wrong');
   *
   * // С контекстом
   * new PipelineError('Parse failed', {
   *   stage: 'parse-file',
   *   file: '/abs/path/a.ts',
   *   cause: originalError,
   * });
   * ```
   */
  constructor(message: string, options: PipelineErrorOptions = {}) {
    // --------------------------------------------------------
    // 1. Передаём message и cause в родительский Error.
    //
    //    `cause` поддерживается с ES2022. В Node.js 16.9+
    //    и современных браузерах работает нативно.
    //
    //    TypeScript: ErrorConstructor с двумя аргументами
    //    объявлен в lib.es2022.error.d.ts.
    // --------------------------------------------------------
    super(message, { cause: options.cause });

    // --------------------------------------------------------
    // 2. Устанавливаем имя класса.
    //
    //    Без этого `error.name` был бы 'Error' — это
    //    затрудняет логирование и отладку.
    // --------------------------------------------------------
    this.name = 'PipelineError';

    // --------------------------------------------------------
    // 3. Сохраняем контекст.
    // --------------------------------------------------------
    this.stage = options.stage;
    this.file = options.file;

    // --------------------------------------------------------
    // 4. Восстанавливаем прототип.
    //
    //    ⚠️ ВАЖНО: при транспиляции в ES5 (target: 'es5')
    //    TypeScript использует `__extends`, который
    //    копирует статические методы, но НЕ настраивает
    //    `__proto__` правильно для встроенных классов.
    //
    //    В результате `err instanceof PipelineError`
    //    вернул бы `false`, хотя объект — экземпляр
    //    PipelineError.
    //
    //    Явная установка `Object.setPrototypeOf` решает
    //    проблему.
    // --------------------------------------------------------
    Object.setPrototypeOf(this, PipelineError.prototype);

    // --------------------------------------------------------
    // 5. Чистим стек вызовов.
    //
    //    `Error.captureStackTrace` — нестандартный метод V8
    //    (Node.js, Chrome). Убирает из стека кадры,
    //    связанные с конструктором, чтобы первая строка
    //    стека указывала на место throw, а не на `new`.
    //
    //    Проверяем наличие метода — в других движках
    //    (SpiderMonkey, JavaScriptCore) его нет.
    // --------------------------------------------------------
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

// ============================================================
// ОШИБКА STAGE
// ============================================================

/**
 * Ошибка конкретного stage pipeline.
 *
 * ════════════════════════════════════════════════════════════
 * ОТЛИЧИЯ ОТ PipelineError
 * ════════════════════════════════════════════════════════════
 *
 *   1. Обязательный `stage` (первый аргумент конструктора).
 *   2. Сообщение автоматически форматируется:
 *        `[${stage}] ${message}`
 *      Это удобно для логов — сразу видно, где упало.
 *   3. `name` = 'StageError' (а не 'PipelineError').
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   // 1. Минимальная
 *   throw new StageError('parse-file', 'Синтаксическая ошибка');
 *   // message: '[parse-file] Синтаксическая ошибка'
 *
 *   // 2. С файлом
 *   throw new StageError(
 *     'parse-file',
 *     'Не удалось прочитать файл',
 *     '/abs/path/a.ts'
 *   );
 *   // message: '[parse-file] Не удалось прочитать файл'
 *   // file: '/abs/path/a.ts'
 *
 *   // 3. С cause
 *   try {
 *     parseSomething();
 *   } catch (err) {
 *     throw new StageError(
 *       'parse-file',
 *       'Внутренняя ошибка',
 *       '/abs/path/a.ts',
 *       err
 *     );
 *   }
 *
 *   // 4. Проверка типа
 *   if (err instanceof StageError) {
 *     console.log(err.stage);   // string (не undefined!)
 *     console.log(err.file);    // string | undefined
 *   }
 *
 * ════════════════════════════════════════════════════════════
 * ГДЕ ИСПОЛЬЗУЕТСЯ
 * ════════════════════════════════════════════════════════════
 *
 *   - ParseFileStage — при падении парсинга файла
 *     (если continueOnError: false)
 *   - EnrichReExportsStage — при ошибке ts-morph
 *   - NormalizeEntitiesStage — при ошибке конвертации
 *   - BuildReportStage — при ошибке generateCompactReport
 *
 *   В штатном режиме (continueOnError: true) stages НЕ бросают
 *   StageError — они записывают ошибку в `ctx.errors`.
 *
 *   StageError используется для «жёсткого» режима и для
 *   внутренних проверок инвариантов.
 */
export class StageError extends PipelineError {
  // ==========================================================
  // ПУБЛИЧНЫЕ ПОЛЯ
  // ==========================================================

  /**
   * Имя stage (переопределено: всегда string, не undefined).
   *
   * В `PipelineError.stage` — `string | undefined`.
   * В `StageError.stage` — `string` (обязательный).
   */
  declare public readonly stage: string;

  // ==========================================================
  // КОНСТРУКТОР
  // ==========================================================

  /**
   * Создаёт ошибку stage.
   *
   * @param stage   — имя stage (обязательно)
   * @param message — сообщение об ошибке
   * @param file    — путь к файлу (опционально)
   * @param cause   — оригинальная ошибка (опционально)
   *
   * @example
   * ```typescript
   * throw new StageError('parse-file', 'Синтаксическая ошибка');
   *
   * throw new StageError(
   *   'parse-file',
   *   'Не удалось прочитать файл',
   *   '/abs/path/a.ts',
   *   originalError
   * );
   * ```
   */
  constructor(stage: string, message: string, file?: string, cause?: unknown) {
    // --------------------------------------------------------
    // 1. Форматируем сообщение: '[stage] message'.
    //
    //    Это делает логи читаемее:
    //      "[parse-file] Синтаксическая ошибка"
    //    вместо
    //      "Синтаксическая ошибка"
    // --------------------------------------------------------
    const formattedMessage = `[${stage}] ${message}`;

    // --------------------------------------------------------
    // 2. Вызываем родительский конструктор.
    //
    //    Передаём stage и file, чтобы они попали в поля
    //    PipelineError. cause — для цепочки ошибок.
    // --------------------------------------------------------
    super(formattedMessage, { stage, file, cause });

    // --------------------------------------------------------
    // 3. Переопределяем имя класса.
    //
    //    Родитель установил 'PipelineError', но мы хотим
    //    'StageError' — чтобы было видно в стеке.
    // --------------------------------------------------------
    this.name = 'StageError';

    // --------------------------------------------------------
    // 4. Восстанавливаем прототип для instanceof.
    //
    //    Аналогично PipelineError — защита от проблем
    //    транспиляции в ES5.
    // --------------------------------------------------------
    Object.setPrototypeOf(this, StageError.prototype);

    // --------------------------------------------------------
    // 5. Чистим стек вызовов.
    // --------------------------------------------------------
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

// ============================================================
// ФАБРИКИ (сокращённые конструкторы)
// ============================================================

/**
 * Создаёт `PipelineError` с контекстом stage.
 *
 * Сокращённая форма для типичного случая:
 *
 *   // Было:
 *   throw new PipelineError('Парсинг прерван', {
 *     stage: 'parse-file',
 *     file: '/abs/path/a.ts',
 *   });
 *
 *   // Стало:
 *   throw pipelineError('parse-file', 'Парсинг прерван', '/abs/path/a.ts');
 *
 * @param stage   — имя stage
 * @param message — сообщение
 * @param file    — путь к файлу (опционально)
 * @returns новый PipelineError
 *
 * @example
 * ```typescript
 * // В stage:
 * if (!ctx.files.length) {
 *   throw pipelineError('discover-files', 'Не найдено файлов');
 * }
 * ```
 */
export function pipelineError(stage: string, message: string, file?: string): PipelineError {
  return new PipelineError(message, { stage, file });
}

/**
 * Создаёт `PipelineError` с cause.
 *
 * Сокращённая форма для обёртки оригинальной ошибки:
 *
 *   // Было:
 *   throw new PipelineError('Внутренняя ошибка', {
 *     stage: 'parse-file',
 *     cause: err,
 *   });
 *
 *   // Стало:
 *   throw wrappedError('parse-file', 'Внутренняя ошибка', err);
 *
 * @param stage   — имя stage
 * @param message — сообщение
 * @param cause   — оригинальная ошибка
 * @param file    — путь к файлу (опционально)
 * @returns новый PipelineError
 *
 * @example
 * ```typescript
 * try {
 *   parseSomething();
 * } catch (err) {
 *   throw wrappedError('parse-file', 'Парсинг упал', err, '/abs/path/a.ts');
 * }
 * ```
 */
export function wrappedError(
  stage: string,
  message: string,
  cause: unknown,
  file?: string
): PipelineError {
  return new PipelineError(message, { stage, file, cause });
}

// ============================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ОШИБКАМИ
// ============================================================

/**
 * Проверяет, является ли значение `PipelineError`.
 *
 * Использует `instanceof`, но дополнительно проверяет
 * `name` — на случай, если `instanceof` сломан (например,
 * при сериализации/десериализации через JSON).
 *
 * @param value — значение для проверки
 * @returns true, если это PipelineError (или наследник)
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (isPipelineError(err)) {
 *     console.error(`Stage: ${err.stage}`);
 *   }
 * }
 * ```
 */
export function isPipelineError(value: unknown): value is PipelineError {
  if (value instanceof PipelineError) {
    return true;
  }

  // Fallback: проверка по name (для случая, когда instanceof
  // сломан — например, после сериализации или в разных
  // реалмах/context-ах).
  if (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    typeof (value as { name: unknown }).name === 'string'
  ) {
    const name = (value as { name: string }).name;
    return name === 'PipelineError' || name === 'StageError';
  }

  return false;
}

/**
 * Проверяет, является ли значение `StageError`.
 *
 * @param value — значение для проверки
 * @returns true, если это StageError
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (isStageError(err)) {
 *     console.error(`Stage ${err.stage}: ${err.message}`);
 *   }
 * }
 * ```
 */
export function isStageError(value: unknown): value is StageError {
  if (value instanceof StageError) {
    return true;
  }

  // Fallback по name
  if (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    (value as { name: unknown }).name === 'StageError'
  ) {
    return true;
  }

  return false;
}

/**
 * Извлекает сообщение из произвольного значения.
 *
 * Полезно в catch-блоках, где неизвестно, что прилетело:
 * Error, строка, объект или что-то ещё.
 *
 *   const msg = getErrorMessage(err);
 *
 * @param value — значение для извлечения сообщения
 * @returns строковое сообщение
 *
 * @example
 * ```typescript
 * try {
 *   doSomething();
 * } catch (err) {
 *   const msg = getErrorMessage(err);
 *   console.error(msg);
 * }
 * ```
 */
export function getErrorMessage(value: unknown): string {
  // 1. Error и наследники — берём message
  if (value instanceof Error) {
    return value.message;
  }

  // 2. Строка — как есть
  if (typeof value === 'string') {
    return value;
  }

  // 3. Объект с message
  if (
    value !== null &&
    typeof value === 'object' &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    return (value as { message: string }).message;
  }

  // 4. Fallback — String(value)
  return String(value);
}

/**
 * Создаёт `FileError` (структура из types.ts) из любой ошибки.
 *
 * Используется в stages, когда `continueOnError: true` —
 * вместо throw они кладут результат этой функции в `ctx.errors`.
 *
 * @param stage — имя stage
 * @param file  — путь к файлу (или '<pipeline>')
 * @param error — оригинальная ошибка
 * @returns объект для ctx.errors
 *
 * @example
 * ```typescript
 * catch (err) {
 *   ctx.errors.push(
 *     toFileError('parse-file', file, err)
 *   );
 * }
 * ```
 */
export function toFileError(
  stage: string,
  file: string,
  error: unknown
): {
  file: string;
  stage: string;
  message: string;
  stack?: string;
} {
  return {
    file,
    stage,
    message: getErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Собираем все экспорты в один объект для удобства.
//
//   import errors from './errors.js';
//   throw new errors.StageError('parse-file', 'Ошибка');
//   if (errors.isStageError(err)) { ... }
// ============================================================

export default {
  // ============================================
  // Классы
  // ============================================
  PipelineError,
  StageError,

  // ============================================
  // Фабрики
  // ============================================
  pipelineError,
  wrappedError,

  // ============================================
  // Утилиты
  // ============================================
  isPipelineError,
  isStageError,
  getErrorMessage,
  toFileError,
};
