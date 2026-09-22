// src/core/cross-file-resolver/project-manager.ts
// ============================================================
// УПРАВЛЕНИЕ ts-morph Project (P3)
// ============================================================
// Версия: 1.1.0
//
// ИЗМЕНЕНИЯ v1.1.0 (диагностика tsconfig + явный путь):
//   - ✅ ДОБАВЛЕНО: логирование источника tsconfig (явный путь /
//     автопоиск / не найден) в verbose-режиме.
//   - ✅ ДОБАВЛЕНО: счётчик tsconfigSource в stats.
//   - ✅ УЛУЧШЕНО: findTsConfig теперь логирует каждый шаг поиска
//     вверх по иерархии (только при verbose).
//   - ✅ ДОБАВЛЕНО: метод getTsConfigPath() для отладки и внешних
//     потребителей.
//   - ✅ ДОБАВЛЕНО: метод getTsConfigSource() — 'explicit' | 'auto'
//     | 'none'.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия.
//
// НАЗНАЧЕНИЕ
// ----------
// Создаёт ts-morph Project, добавляет в него:
//   1. Все .ts/.tsx/.js/.jsx из entitiesMap
//   2. Виртуальные SourceFile для .vue (<script setup>)
//
// ВАЖНО
// -----
//   - Project создаётся ОДИН РАЗ (дорогой объект)
//   - addSourceFilesAtPaths НЕ используется (добавит node_modules)
//   - Для .vue создаётся виртуальный файл, хранится mapping
//   - tsconfig.json загружается через tsConfigFilePath (для алиасов)
//
// ЖИЗНЕННЫЙ ЦИКЛ
// --------------
//
//   const pm = new ProjectManager(options);
//   await pm.initialize(filePaths);
//   const project = pm.getProject();
//   // ... использование ...
//   pm.dispose();
//
// РИСКИ
// -----
//   - Долгая инициализация на больших проектах (>10k файлов)
//   - .vue с <script setup> требует mapping line numbers
//   - tsconfig.json может отсутствовать (тогда алиасы не резолвятся)
// ============================================================

import fs from 'fs';
import path from 'path';
import { Project, ts } from 'ts-morph';

import type { CrossFileResolverOptions, VueLineMapping } from './types.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Расширения файлов, которые добавляются в Project напрямую
 * (без виртуальных SourceFile).
 *
 * .vue НЕ входит в этот набор — для него используется
 * специальная логика через виртуальные SourceFile.
 */
const DIRECT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Расширения, которые считаются JavaScript (а не TypeScript).
 *
 * Используется для проверки опции `includeJs`.
 */
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs']);

/**
 * Максимум файлов по умолчанию.
 *
 * Защита от случайного добавления слишком большого количества
 * файлов (например, если `entitiesMap` содержит весь монорепо).
 */
const DEFAULT_MAX_FILES = 5000;

/**
 * Максимальная глубина поиска tsconfig.json вверх по иерархии.
 */
const MAX_TSCONFIG_SEARCH_DEPTH = 10;

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Источник tsconfig.json.
 */
export type TsConfigSource = 'explicit' | 'auto' | 'none';

/**
 * Расширенная статистика ProjectManager.
 *
 * ✅ v1.1.0: добавлены поля tsConfigPath и tsConfigSource.
 */
export interface ProjectManagerStats {
  filesAdded: number;
  vueFilesAdded: number;
  addFileErrors: number;
  tsConfigPath: string | null;
  tsConfigSource: TsConfigSource;
}

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

/**
 * Управляет ts-morph Project: создаёт, добавляет файлы, хранит mapping
 * для .vue-файлов.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Создаёт `Project` с опциями (target, module, jsx, ...).
 *   2. Загружает `tsconfig.json` (если есть) для алиасов.
 *   3. Добавляет прямые файлы (.ts/.tsx/.js/.jsx) через
 *      `project.addSourceFileAtPath()`.
 *   4. Для каждого `.vue`-файла:
 *        a. Извлекает `<script setup>` (или `<script>`).
 *        b. Создаёт виртуальный SourceFile `${vuePath}.__script__.ts`.
 *        c. Вычисляет `offset` для маппинга строк.
 *        d. Сохраняет `VueLineMapping` в двух Map (прямой и обратный).
 *   5. Предоставляет доступ к `Project` через `getProject()`.
 *
 * ЖИЗНЕННЫЙ ЦИКЛ
 * --------------
 *
 *   const pm = new ProjectManager(options);
 *   await pm.initialize(filePaths);
 *   const project = pm.getProject();
 *   // ... использование ...
 *   pm.dispose();
 *
 * ПОЧЕМУ НЕ addSourceFilesAtPaths
 * -------------------------------
 *
 *   project.addSourceFilesAtPaths('**\/*.ts') добавит ВСЕ .ts-файлы,
*   включая:
*     - node_modules
*     - dist
*     - build
*     - .d.ts
*
*   Это:
*     1. Замедлит инициализацию в 10-100 раз.
*     2. Займёт много памяти.
*     3. Приведёт к ложным резолвам (символы из node_modules).
*
*   Поэтому мы добавляем ТОЛЬКО те файлы, которые есть в
*   entitiesMap (то есть прошли через парсинг в pipeline).
*
* ПОЧЕМУ ВИРТУАЛЬНЫЕ SourceFile ДЛЯ .vue
* --------------------------------------
*
*   ts-morph (как и TypeScript) не понимает .vue-файлы —
*   это Single File Component, а не валидный TS/JS.
*
*   Решение: извлечь script setup и создать виртуальный
*   SourceFile с расширением .ts. Это позволяет ts-morph
*   построить symbol table и разрешить вызовы.
*
*   Проблема: line numbers в виртуальном файле НЕ совпадают
*   с line numbers в оригинальном .vue. Решение — VueLineMapping.
*/
export class ProjectManager {
  // ==========================================================
  // СВОЙСТВА
  // ==========================================================

  /**
   * ts-morph Project. Создаётся в конструкторе, инициализируется
   * в `initialize()`, освобождается в `dispose()`.
   */
  private project: Project;

  /**
   * Флаг инициализации. Пока false — `getProject()` бросает ошибку.
   */
  private initialized = false;

  /**
   * Mapping виртуальных .vue SourceFile:
   *   virtualPath → VueLineMapping
   *
   * Используется в `getVueMapping()`.
   */
  private vueMappings = new Map<string, VueLineMapping>();

  /**
   * Обратный mapping:
   *   originalVuePath → virtualPath
   *
   * Используется в `getVirtualPathForVue()`.
   */
  private vueReverseMappings = new Map<string, string>();

  /**
   * ✅ v1.1.0: путь к загруженному tsconfig.json (если найден).
   */
  private tsConfigPath: string | null = null;

  /**
   * ✅ v1.1.0: источник tsconfig.json.
   *   - 'explicit' — задан через options.tsConfigPath
   *   - 'auto'     — найден автопоиском вверх по иерархии
   *   - 'none'     — не найден
   */
  private tsConfigSource: TsConfigSource = 'none';

  /**
   * Статистика добавления файлов.
   *
   * ✅ v1.1.0: расширена полями tsConfigPath и tsConfigSource.
   */
  private stats: ProjectManagerStats = {
    filesAdded: 0,
    vueFilesAdded: 0,
    addFileErrors: 0,
    tsConfigPath: null,
    tsConfigSource: 'none',
  };

  // ==========================================================
  // КОНСТРУКТОР
  // ==========================================================

  /**
   * Создаёт ProjectManager.
   *
   * ════════════════════════════════════════════════════════════
   * ЧТО ДЕЛАЕТ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Создаёт ts-morph Project с базовыми compilerOptions.
   *   2. Пытается загрузить tsconfig.json:
   *        a. Если `options.tsConfigPath` задан и существует — используем его.
   *        b. Иначе — ищем tsconfig.json вверх от `options.projectRoot`.
   *   3. Если tsconfig найден — передаём его в Project (для алиасов).
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ `skipAddingFilesFromTsConfig: true`
   * ════════════════════════════════════════════════════════════
   *
   *   Если `tsConfigFilePath` задан, ts-morph по умолчанию
   *   добавит **все** файлы, перечисленные в tsconfig.include.
   *   Это может быть 10k+ файлов, включая те, которых нет в
   *   `entitiesMap`. Поэтому мы отключаем это и добавляем
   *   только нужные файлы вручную.
   *
   *   tsconfig при этом **всё равно загружается** (для paths,
   *   baseUrl, и других опций резолвинга алиасов).
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ `moduleResolution: Bundler`
   * ════════════════════════════════════════════════════════════
   *
   *   `Bundler` — современный режим, который:
   *     - Понимает `exports` в package.json
   *     - Работает с ESM и CJS
   *     - Совместим с Vite, esbuild, webpack 5
   *
   *   Альтернативы:
   *     - `Node` (legacy) — не понимает exports
   *     - `NodeNext` — требует .js расширения в импортах
   */
  constructor(private options: CrossFileResolverOptions) {
    // ========================================================
    // Базовые опции Project
    // ========================================================
    const projectOptions: any = {
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        noEmit: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: true,
        strict: false,
      },
    };

    // ========================================================
    // Загрузка tsconfig.json
    // ========================================================
    if (options.tsConfigPath && fs.existsSync(options.tsConfigPath)) {
      // Явный путь — используем
      projectOptions.tsConfigFilePath = options.tsConfigPath;
      this.tsConfigPath = options.tsConfigPath;
      this.tsConfigSource = 'explicit';

      if (this.options.verbose) {
        console.log(`[P3] tsconfig (явный): ${options.tsConfigPath}`);
      }
    } else {
      if (this.options.verbose && options.tsConfigPath) {
        console.warn(`[P3] tsconfig (явный) не найден: ${options.tsConfigPath}`);
        console.warn(`[P3]   → переключаемся на автопоиск от ${options.projectRoot}`);
      }

      // Автопоиск
      const autoTsConfig = this.findTsConfig(options.projectRoot);
      if (autoTsConfig) {
        projectOptions.tsConfigFilePath = autoTsConfig;
        this.tsConfigPath = autoTsConfig;
        this.tsConfigSource = 'auto';

        if (this.options.verbose) {
          console.log(`[P3] tsconfig (автопоиск): ${autoTsConfig}`);
        }
      } else {
        this.tsConfigPath = null;
        this.tsConfigSource = 'none';

        if (this.options.verbose) {
          console.warn(`[P3] tsconfig не найден — алиасы не будут резолвиться`);
        }
      }
    }

    // Обновляем stats
    this.stats.tsConfigPath = this.tsConfigPath;
    this.stats.tsConfigSource = this.tsConfigSource;

    // ========================================================
    // Создание Project
    // ========================================================
    this.project = new Project(projectOptions);
  }

  // ==========================================================
  // ПУБЛИЧНЫЙ API
  // ==========================================================

  /**
   * Инициализация: добавляет файлы в Project.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Ограничиваем количество файлов (`maxFiles`).
   *   2. Разделяем на прямые (.ts/.tsx/.js/.jsx) и .vue.
   *   3. Добавляем прямые через `addSourceFileAtPath`.
   *   4. Добавляем .vue через `addVueFile` (виртуальные SourceFile).
   *   5. Устанавливаем флаг `initialized = true`.
   *
   * ════════════════════════════════════════════════════════════
   * ОБРАБОТКА ОШИБОК
   * ════════════════════════════════════════════════════════════
   *
   *   - Если файл не существует — пропускаем.
   *   - Если `addSourceFileAtPath` бросает — увеличиваем
   *     `addFileErrors`, продолжаем.
   *   - Если `.vue` не содержит `<script>` — пропускаем
   *     (не считаем за ошибку).
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   const pm = new ProjectManager({ projectRoot: './src' });
   *   await pm.initialize(['src/a.ts', 'src/b.vue', 'src/c.ts']);
   *   // pm.getStats() → { filesAdded: 2, vueFilesAdded: 1, addFileErrors: 0 }
   *
   * @param filePaths — список путей (абсолютные или относительные)
   */
  async initialize(filePaths: string[]): Promise<void> {
    // Идемпотентность: если уже инициализирован — no-op
    if (this.initialized) return;

    const maxFiles = this.options.maxFiles ?? DEFAULT_MAX_FILES;
    const limited = filePaths.slice(0, maxFiles);

    if (this.options.verbose) {
      console.log(`[P3] Инициализация Project: ${limited.length} файлов`);
      if (filePaths.length > maxFiles) {
        console.warn(
          `[P3]   ⚠️ Ограничение maxFiles: обработано только ${maxFiles} из ${filePaths.length}`
        );
      }
    }

    // ========================================================
    // Шаг 1: разделяем на прямые и .vue
    // ========================================================
    const directFiles: string[] = [];
    const vueFiles: string[] = [];

    for (const fp of limited) {
      const abs = path.isAbsolute(fp) ? fp : path.resolve(this.options.projectRoot, fp);

      // Пропускаем несуществующие файлы
      if (!fs.existsSync(abs)) continue;

      const ext = path.extname(abs).toLowerCase();

      if (ext === '.vue') {
        vueFiles.push(abs);
      } else if (DIRECT_EXTENSIONS.has(ext)) {
        // Проверка includeJs
        if (JS_EXTENSIONS.has(ext) && this.options.includeJs === false) {
          continue;
        }
        directFiles.push(abs);
      }
      // Остальные расширения (.css, .json, .md) — игнорируем
    }

    if (this.options.verbose) {
      console.log(
        `[P3]   Прямых файлов: ${directFiles.length}, .vue: ${vueFiles.length}`
      );
    }

    // ========================================================
    // Шаг 2: добавляем прямые файлы
    // ========================================================
    for (const fp of directFiles) {
      try {
        this.project.addSourceFileAtPath(fp);
        this.stats.filesAdded++;
      } catch (err) {
        this.stats.addFileErrors++;
        if (this.options.verbose) {
          console.warn(`[P3] Не удалось добавить ${fp}: ${this.errMsg(err)}`);
        }
      }
    }

    // ========================================================
    // Шаг 3: добавляем .vue через виртуальные SourceFile
    // ========================================================
    if (this.options.includeVue !== false) {
      for (const vuePath of vueFiles) {
        try {
          this.addVueFile(vuePath);
          this.stats.vueFilesAdded++;
        } catch (err) {
          this.stats.addFileErrors++;
          if (this.options.verbose) {
            console.warn(`[P3] Не удалось добавить .vue ${vuePath}: ${this.errMsg(err)}`);
          }
        }
      }
    }

    // ========================================================
    // Шаг 4: финализация
    // ========================================================
    this.initialized = true;

    // Обновляем stats
    this.stats.tsConfigPath = this.tsConfigPath;
    this.stats.tsConfigSource = this.tsConfigSource;

    if (this.options.verbose) {
      console.log(
        `[P3] Project готов: ${this.stats.filesAdded} прямых, ` +
        `${this.stats.vueFilesAdded} .vue, ` +
        `ошибок: ${this.stats.addFileErrors}`
      );
      if (this.tsConfigPath) {
        console.log(`[P3] tsconfig: ${this.tsConfigPath} (${this.tsConfigSource})`);
      } else {
        console.warn(`[P3] tsconfig: НЕ ЗАГРУЖЕН — алиасы могут не работать`);
      }
    }
  }

  /**
   * Возвращает ts-morph Project.
   *
   * @throws Error, если `initialize()` не был вызван.
   */
  getProject(): Project {
    if (!this.initialized) {
      throw new Error('[P3] ProjectManager не инициализирован. Вызовите initialize().');
    }
    return this.project;
  }

  /**
   * Возвращает mapping для .vue-файла по виртуальному пути.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   const mapping = pm.getVueMapping('/src/App.vue.__script__.ts');
   *   // → { offset: 10, originalPath: '/src/App.vue', virtualPath: '...' }
   *
   * @param virtualPath — путь к виртуальному SourceFile
   */
  getVueMapping(virtualPath: string): VueLineMapping | undefined {
    return this.vueMappings.get(virtualPath);
  }

  /**
   * Возвращает виртуальный путь для оригинального .vue.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   const virtualPath = pm.getVirtualPathForVue('/src/App.vue');
   *   // → '/src/App.vue.__script__.ts'
   *
   * @param originalPath — путь к оригинальному .vue
   */
  getVirtualPathForVue(originalPath: string): string | undefined {
    return this.vueReverseMappings.get(originalPath);
  }

  /**
   * Проверяет, является ли путь виртуальным .vue SourceFile.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   pm.isVirtualVuePath('/src/App.vue.__script__.ts');  // → true
   *   pm.isVirtualVuePath('/src/App.vue');                 // → false
   *   pm.isVirtualVuePath('/src/a.ts');                    // → false
   *
   * @param filePath — путь для проверки
   */
  isVirtualVuePath(filePath: string): boolean {
    return this.vueMappings.has(filePath);
  }

  /**
   * Возвращает статистику добавления файлов.
   *
   * ✅ v1.1.0: расширена полями tsConfigPath и tsConfigSource.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   pm.getStats();
   *   // → {
   *   //     filesAdded: 150,
   *   //     vueFilesAdded: 30,
   *   //     addFileErrors: 2,
   *   //     tsConfigPath: '/project/tsconfig.json',
   *   //     tsConfigSource: 'auto'
   *   //   }
   */
  getStats(): ProjectManagerStats {
    return {
      filesAdded: this.stats.filesAdded,
      vueFilesAdded: this.stats.vueFilesAdded,
      addFileErrors: this.stats.addFileErrors,
      tsConfigPath: this.tsConfigPath,
      tsConfigSource: this.tsConfigSource,
    };
  }

  /**
   * ✅ v1.1.0: возвращает путь к загруженному tsconfig.json.
   * null — если tsconfig не найден.
   */
  getTsConfigPath(): string | null {
    return this.tsConfigPath;
  }

  /**
   * ✅ v1.1.0: возвращает источник tsconfig.json:
   *   - 'explicit' — задан через options.tsConfigPath
   *   - 'auto'     — найден автопоиском вверх по иерархии
   *   - 'none'     — не найден
   */
  getTsConfigSource(): TsConfigSource {
    return this.tsConfigSource;
  }

  /**
   * Освобождает ресурсы.
   *
   * ════════════════════════════════════════════════════════════
   * ЧТО ДЕЛАЕТ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Очищает `vueMappings` и `vueReverseMappings`.
   *   2. Сбрасывает флаг `initialized`.
   *   3. Сбрасывает `stats`.
   *   4. Сбрасывает `tsConfigPath` и `tsConfigSource`.
   *
   * ════════════════════════════════════════════════════════════
   * ЧЕГО НЕ ДЕЛАЕТ
   * ════════════════════════════════════════════════════════════
   *
   *   ts-morph не предоставляет явного `dispose()` для `Project`.
   *   Память освобождается сборщиком мусора после того, как
   *   ссылка на `project` потеряна.
   *
   *   Если нужно принудительно освободить память — используйте
   *   `project.forgetNodesCreatedInBlock()` (но это может
   *   сломать уже построенные SourceFile).
   *
   *   В большинстве случаев достаточно вызвать `dispose()` и
   *   потерять ссылку на `ProjectManager`.
   */
  dispose(): void {
    try {
      this.vueMappings.clear();
      this.vueReverseMappings.clear();
      this.initialized = false;
      this.tsConfigPath = null;
      this.tsConfigSource = 'none';
      this.stats = {
        filesAdded: 0,
        vueFilesAdded: 0,
        addFileErrors: 0,
        tsConfigPath: null,
        tsConfigSource: 'none',
      };
    } catch {
      // Игнорируем ошибки при очистке
    }
  }

  // ==========================================================
  // ВНУТРЕННИЕ МЕТОДЫ
  // ==========================================================

  /**
   * Добавляет .vue-файл как виртуальный SourceFile.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Читаем .vue-файл.
   *   2. Извлекаем `<script setup>` (или `<script>`) через regex.
   *   3. Если содержимое пустое — пропускаем (не ошибка).
   *   4. Создаём виртуальный SourceFile `${vuePath}.__script__.ts`.
   *   5. Считаем offset:
   *        - `contentStart` = позиция первого символа содержимого.
   *        - `originalStartLine` = номер строки оригинала, где
   *          начинается содержимое.
   *        - `offset = originalStartLine - 1`.
   *   6. Сохраняем mapping в обе стороны.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   <!-- App.vue -->
   *   <template>...</template>          <!-- строки 1-5 -->
   *   <script setup>                    <!-- строка 6 -->
   *   import { ref } from 'vue';        <!-- строка 7 -->
   *   const x = ref(0);                 <!-- строка 8 -->
   *   </script>                         <!-- строка 9 -->
   *
   *   Виртуальный (App.vue.__script__.ts):
   *   import { ref } from 'vue';        <!-- виртуальная 1 -->
   *   const x = ref(0);                 <!-- виртуальная 2 -->
   *
   *   Mapping:
   *     offset = 6 (виртуальная 1 = оригинальная 7)
   *     originalPath = '/path/to/App.vue'
   *     virtualPath = '/path/to/App.vue.__script__.ts'
   *
   * ════════════════════════════════════════════════════════════
   * ПОЧЕМУ REGEX, А НЕ @vue/compiler-sfc
   * ════════════════════════════════════════════════════════════
   *
   *   В проекте уже используется `@vue/compiler-sfc` в
   *   `parseVueFile`. Но для целей ts-morph достаточно regex:
   *     - Нам нужен только текст `<script>`.
   *     - Нам не нужен полный AST шаблона.
   *     - Regex работает быстрее и не требует зависимостей.
   *
   *   Если в будущем понадобится более сложный анализ —
   *   можно заменить на `@vue/compiler-sfc`.
   *
   * @param vuePath — абсолютный путь к .vue-файлу
   */
  private addVueFile(vuePath: string): void {
    // ========================================================
    // Шаг 1: читаем файл
    // ========================================================
    const content = fs.readFileSync(vuePath, 'utf-8');

    // ========================================================
    // Шаг 2: извлекаем <script setup> или <script>
    // ========================================================
    const setupMatch = content.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
    const basicMatch = content.match(/<script(?![^>]*\bsetup\b)[^>]*>([\s\S]*?)<\/script>/);

    const match = setupMatch ?? basicMatch;
    if (!match?.[1]) {
      // Нет <script> — это валидный .vue (например, иконка).
      // Не ошибка, просто пропускаем.
      if (this.options.verbose) {
        console.log(`[P3]   ⏭️  .vue без <script>: ${path.basename(vuePath)}`);
      }
      return;
    }

    const scriptContent = match[1];
    if (!scriptContent.trim()) {
      // Пустой <script> — тоже валидный случай.
      if (this.options.verbose) {
        console.log(`[P3]   ⏭️  .vue с пустым <script>: ${path.basename(vuePath)}`);
      }
      return;
    }

    // ========================================================
    // Шаг 3: вычисляем offset
    // ========================================================
    const fullMatch = match[0];

    // Позиция первого символа содержимого внутри fullMatch
    const contentStartInMatch = fullMatch.indexOf('>') + 1;

    // Абсолютная позиция в content
    const contentStart = match.index! + contentStartInMatch;

    // Считаем, на какой строке оригинала начинается содержимое
    const beforeContent = content.substring(0, contentStart);
    const originalStartLine = beforeContent.split('\n').length;

    // Виртуальная строка 1 = originalStartLine
    // → offset = originalStartLine - 1
    const offset = originalStartLine - 1;

    // ========================================================
    // Шаг 4: создаём виртуальный SourceFile
    // ========================================================
    const virtualPath = `${vuePath}.__script__.ts`;

    try {
      this.project.createSourceFile(virtualPath, scriptContent, { overwrite: true });
    } catch (err) {
      // Если уже существует — обновляем содержимое
      const existing = this.project.getSourceFile(virtualPath);
      if (existing) {
        existing.replaceWithText(scriptContent);
      } else {
        // Не удалось ни создать, ни найти — пробрасываем
        throw err;
      }
    }

    // ========================================================
    // Шаг 5: сохраняем mapping
    // ========================================================
    const mapping: VueLineMapping = {
      offset,
      originalPath: vuePath,
      virtualPath,
    };

    this.vueMappings.set(virtualPath, mapping);
    this.vueReverseMappings.set(vuePath, virtualPath);
  }

  /**
   * Ищет tsconfig.json вверх по иерархии от `startDir`.
   *
   * ════════════════════════════════════════════════════════════
   * АЛГОРИТМ
   * ════════════════════════════════════════════════════════════
   *
   *   1. Начинаем с `startDir`.
   *   2. Проверяем `<startDir>/tsconfig.json`.
   *   3. Если нет — поднимаемся на уровень выше.
   *   4. Повторяем до корня файловой системы или до
   *      `MAX_TSCONFIG_SEARCH_DEPTH` итераций.
   *
   * ════════════════════════════════════════════════════════════
   * ПРИМЕР
   * ════════════════════════════════════════════════════════════
   *
   *   findTsConfig('/project/packages/ast-analyzer/src');
   *   // → '/project/tsconfig.json' (если найден в корне)
   *
   * ✅ v1.1.0: логирует каждый шаг поиска в verbose-режиме.
   *
   * @param startDir — директория для старта поиска
   * @returns абсолютный путь к tsconfig.json или null
   */
  private findTsConfig(startDir: string): string | null {
    let currentDir = path.resolve(startDir);
    const root = path.parse(currentDir).root;
    let depth = 0;

    if (this.options.verbose) {
      console.log(`[P3] Поиск tsconfig.json от ${currentDir}`);
    }

    while (currentDir !== root && depth < MAX_TSCONFIG_SEARCH_DEPTH) {
      const candidate = path.join(currentDir, 'tsconfig.json');
      if (fs.existsSync(candidate)) {
        if (this.options.verbose) {
          console.log(`[P3]   ✅ найден: ${candidate} (глубина ${depth})`);
        }
        return candidate;
      }

      if (this.options.verbose) {
        console.log(`[P3]   ❌ нет: ${candidate}`);
      }

      currentDir = path.dirname(currentDir);
      depth++;
    }

    if (this.options.verbose) {
      console.warn(
        `[P3] tsconfig.json не найден после ${depth} итераций ` +
        `(достигнут корень ${root} или лимит ${MAX_TSCONFIG_SEARCH_DEPTH})`
      );
    }

    return null;
  }

  /**
   * Форматирует ошибку для логирования.
   *
   * ════════════════════════════════════════════════════════════
   * ЗАЧЕМ
   * ════════════════════════════════════════════════════════════
   *
   *   `catch (err)` в TypeScript даёт `unknown`. Чтобы безопасно
   *   вывести сообщение, нужна проверка `err instanceof Error`.
   *
   *   Эта утилита инкапсулирует проверку.
   *
   * @param err — значение из catch
   * @returns строковое сообщение
   */
  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================
// Класс ProjectManager уже экспортирован через `export class`.
// Default-экспорт оставлен для совместимости с инструментами,
// которые ожидают default.
// ============================================================

export default ProjectManager;
