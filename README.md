# ast-analyzer

> Инструмент глубокого статического анализа TypeScript/JavaScript/Vue/React-проектов.
> Строит AST, графы вызовов, потоки данных и рендера. Сжимает результаты в компактный JSON (×5).

[![Version](https://img.shields.io/badge/version-17.4.0-blue)]()
[![Node](https://img.shields.io/badge/node-%E2%89%A518-green)]()
[![Round-trip](https://img.shields.io/badge/round--trip-100%25-success)]()
[![Tests](https://img.shields.io/badge/tests-160%2F160-success)]()

---

## Что делает

- **Анализ** — модули, файлы, функции, классы, константы, импорты, экспорты, вызовы.
- **Semantic** — CFG (Control Flow Graph), Call Graph, Type Analysis, Data Flow.
- **Formal** — Z3-верификация, проверка эквивалентности (рефакторинг).
- **Vue/React** — SFC, composables, macros, hooks, JSX, state flows, event flows, render tree.
- **CI/CD** — ESLint pipeline, Semantic pipeline, AutoFix, Dead Code.
- **Codec** — компактный JSON (≈20% от full), полный round-trip.

---

## Установка

```bash
npm install @newkind/ast-analyzer
# или
npx @newkind/ast-analyzer --help
```

Требования: **Node ≥ 18**, **TypeScript ≥ 5**.

---

## Быстрый старт

```bash
# 1. Анализ проекта → compact.json
npx ast-analyzer compact-recursive ./src/index.ts --preset full -o ./reports/index.json

# 2. Round-trip проверка (codec)
npm run check:roundtrip
# → 158/158 ✅

# 3. Golden проверка (проект-специфичная)
npm run check:golden
# → 160/160 ✅
```

---

## CLI — основные команды

```bash
# Анализ проекта
ast-analyzer compact-recursive <entry> [options]

# Пресеты
--preset minimal | standard | full | relationships | ultra

# Проверки
npm run check:roundtrip         # проверка codec (158/158)
npm run check:golden            # проверка проекта (160/160)
npm run save:golden             # обновить golden-снимок

# Другие режимы
ast-analyzer project <entry>    # анализ проекта
ast-analyzer vue-analyze <file> # Vue SFC
ast-analyzer semantic <file>    # CFG/CallGraph/Types
ast-analyzer refactor <file>    # рефакторинг + верификация
```

Полная справка: `ast-analyzer --help`.

---

## Архитектура

```
src/
├── core/                 # AST-парсер, IdManager, ProjectGraphBuilder
│   ├── ast-parser.ts
│   ├── react-entity-classifier.ts
│   ├── entity-extractor/       # Извлечение сущностей
│   └── relations/              # Анализ связей
├── modes/                # Режимы анализа
│   ├── vue-analyzer/           # Vue SFC + composables + macros
│   └── react-analyzer/         # React JSX + hooks + flows
├── semantic/             # CFG, CallGraph, Type, DataFlow
├── formal/               # Z3-верификация, эквивалентность
├── refactor/             # AutoRefactor, CodeFixer, Validator
├── reporters/            # Compact, HTML, Markdown, Codec
│   └── codec/                  # Сжатие JSON (round-trip 100%)
├── pipeline/             # Оркестрация (7 стадий)
└── cli/                  # Команды
```

---

## Codec — сжатие JSON

Компактный формат: **≈20%** от полного размера.

| Формат | Размер | Примечание |
|---|---|---|
| `index.full.json` | 4.7 MB | полный JSON |
| `index.json` | 950 KB | compact (20%) |

**Особенности:**
- **Columnar** — данные в параллельных массивах.
- **RLE** — сжатие повторяющихся значений.
- **Tokenization** — строки → токены.
- **Legend** — все схемы/коды в одном месте.
- **Round-trip** — 100% восстановление.

---

## Тесты и проверки

```bash
# Codec round-trip (158 проверок)
npm run check:roundtrip
# → 158/158 ✅

# Golden проверка проекта (160 проверок)
npm run check:golden
# → 160/160 ✅

# TypeScript
npx tsc --noEmit

# Unit-тесты
npm run test
```

**Покрытие:**
- L0–L4: encode/decode, byte-exact, idempotency.
- I1–I63: семантические инварианты.
- G1–G2: golden-фикстуры.
- Spot-checks: 25 точечных проверок.

---

## Golden-фикстуры

**Golden** — снимок проекта для защиты от регрессий.

```bash
# Сохранить снимок
npm run save:golden

# Проверить проект
npm run check:golden
```

**Golden проект-специфичны:**
```
scripts/fixtures/
  ast-graph-viewer.golden.json
  ast-graph-viewer.full.golden.json
```

---

## Лицензия

MIT

---

# 🗺️ Roadmap

## ✅ v17.4.0 — P0 закрыт (текущий релиз)

- ✅ **Round-trip 100%** на 4 проектах
- ✅ **Codec**: jsx_N → rjN маппинг, массив индексов для props
- ✅ **SSOT версий** (`LEGEND_VERSION`, `CODEC_VERSION`)
- ✅ **Golden-система** проект-специфичных фикстур
- ✅ **tsc чист**, 160/160 проверок

## 🚧 v17.5.0 — CLI `trace-flow`

- 🚧 Команда `ast-analyzer trace-flow --event=<id>`
- 🚧 Печать цепочки: event → handler → call → state → render
- 🚧 `--state=<id>` — трассировка state
- 🚧 `--json` — машинно-читаемый вывод

## 📋 v17.6.0 — HTML-визуализация flow

- 📋 Граф event-flow в `ast-graph-viewer`
- 📋 Interactive state-flow diagram
- 📋 Render-tree с зависимостями

## 📋 v17.7.0 — Vue flow-симметрия

- 📋 `VueStateFlow` (ref/reactive → mutations → renders)
- 📋 `VueEventFlow` (@click → handler → state → render)
- 📋 `VueRenderTree` (template hierarchy + deps)

## 📋 v18.0.0 — Расширение модели

- 📋 `ReactHookEntity.usedIn/mutatedBy/readBy`
- 📋 `ReactComponentEntity.usedIn/stateHooks/propsStructured/emits/exposed`
- 📋 `VueComponentEntity` — обогащение
- 📋 Cross-project analysis (монорепо)

## 🔮 v19.0.0 — AI-интеграция

- 🔮 Semantic embedding сущностей
- 🔮 Vector search по коду
- 🔮 AI-подсказки при рефакторинге
- 🔮 Автогенерация документации
