# 📝 README.md + ROADMAP

**Создам два файла:**

1. **`README.md`** — общее описание проекта, установка, базовое использование.
2. **`ROADMAP.md`** — план развития, P0-P3, Фаза 1, история изменений.

**Плюс** — **отдельные секции** для **зрелых фич** (codec, golden, React/Vue flow).

---

## 📋 Задание 1 — Создать `README.md`

```bash
cd /home/sergei/Desktop/system/packages/ast-analyzer

cat > README.md << 'MDEOF'
# ast-analyzer

> **Статический анализ AST для TypeScript, JavaScript, Vue и React.**
> Round-trip 100% · Компактный формат · Golden-фикстуры · Flow-анализ.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-green)](https://nodejs.org/)
[![Round-trip](https://img.shields.io/badge/round--trip-100%25-success)](#-round-trip-100)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

---

## ✨ Возможности

### 🔍 Анализ кода

- **TypeScript/JavaScript** — AST-парсинг, извлечение сущностей, построение графов.
- **Vue** — SFC, composables, macros, templates, DOM API.
- **React** — компоненты, hooks, JSX, event handlers, flow-цепочки.

### 🎯 Графы и связи

- **Call graph** — кто кого вызывает.
- **Import/export flow** — граф модулей.
- **Type dependencies** — типовые зависимости.
- **Lexical links** — вложенность, замыкания, callback-и.

### 🔗 Flow-анализ

- **State flow** — где state мутируется и где читается.
- **Event flow** — click → handler → call → state → render.
- **Render tree** — иерархия JSX с зависимостями от state/props.
- **Fn JSX usage** — обратный индекс: функция → JSX.

### 📦 Компактный формат

- **Сжатие до ~20%** от полного JSON.
- **Columnar-структура** — быстрая сериализация.
- **RLE** — для повторяющихся значений.
- **Tokenized strings** — единый словарь.

### ✅ Round-trip 100%

- **Байтовое равенство** после `decode(encode(full))`.
- **Идемпотентность** — повторный encode даёт тот же результат.
- **Golden-фикстуры** — привязка к проекту.
- **82 инварианта** — семантические проверки.

---

## 🚀 Быстрый старт

### Установка

```bash
npm install @newkind/ast-analyzer
```

### CLI

```bash
# Полный отчёт по проекту
npx ast-analyzer compact-recursive ./src/index.ts \
  --preset full \
  --depth 1000 \
  -o ./reports/index.json

# Ультра-компактный
npx ast-analyzer compact-recursive ./src/index.ts \
  --preset ultra \
  --ultra \
  -o ./reports/ultra.json

# Только графы (минимальный размер)
npx ast-analyzer compact-recursive ./src/index.ts \
  --preset relationships \
  -o ./reports/graphs.json
```

### API

```typescript
import { Codec } from '@newkind/ast-analyzer/reporters/codec';
import { analyzeProject } from '@newkind/ast-analyzer';

// Анализ проекта
const full = await analyzeProject('./src/index.ts');

// Кодирование
const compact = Codec.encode(full);

// Декодирование
const decoded = Codec.decode(compact);

// Round-trip: decoded === full
console.log(decoded.modules.length === full.modules.length); // true
```

---

## 📖 Presets

| Preset | Размер | Что включает |
|---|---|---|
| `minimal` | минимальный | Только базовое |
| `standard` | средний | Функции, вызовы, импорты, экспорты |
| `full` | максимальный | Всё, включая flow-секции |
| `relationships` | минимум | Только графы |
| `ultra` | ~5% | Максимальное сжатие |

---

## 🧪 Проверки

### Round-trip

```bash
# Без golden (быстро, про codec)
npm run check:roundtrip
# → 158/158

# С golden (про конкретный проект)
npm run check:golden
# → 160/160
```

### Golden-фикстуры

```bash
# Сохранить снимок проекта
npm run save:golden
# → scripts/fixtures/ast-graph-viewer.golden.json

# Обновить вручную для другого проекта
npx tsx scripts/save-golden.ts --project=my-project --source=./my-reports
```

### TypeScript

```bash
npx tsc --noEmit
# → чист
```

---

## 🏗️ Архитектура

```
src/
  analyzers/          — анализаторы (CFG, call graph, types)
  ci-cd/              — CI/CD пайплайны
  cli/                — CLI-интерфейс
  core/               — ядро (AST parser, entity extractor, relations)
  modes/              — режимы анализа (vue-analyzer, react-analyzer)
  pipeline/           — пайплайн сбора данных
  refactor/           — рефакторинг и code fix
  reporters/          — генерация отчётов
    codec/            — компактный формат (encode/decode)
    compact/          — сборка compact JSON
  semantic/           — семантический анализ
```

### Пайплайн

```
parseTypeScriptFile
      ↓
entitiesMap
      ↓
collectFullJSON
      ├── pass1Modules
      ├── pass2Exports
      ├── pass3Calls
      ├── pass4Extended
      ├── pass5Vue
      ├── pass6DomApi
      └── pass7React
      ↓
FullJSON
      ↓
Codec.encode → CompactJSON
      ↓
Codec.decode → FullJSON (round-trip)
```

---

## 📊 Round-trip 100%

**Все уровни проходят:**

| Уровень | Проверка |
|---|---|
| **L0** | `encode(full) === compact` (семантически) |
| **L1** | `decode(compact) === full` (семантически) |
| **L2** | `decode(compact) === full` (побайтово) |
| **L3** | `compact на диске === encode(full)` (буквально) |
| **L4** | `encode(decode(encode(full))) === encode(full)` (идемпотентность) |
| **RE** | `encode(decode(compact)) === compact` |
| **DL** | `decode(encode(full)) === full` |
| **ENC** | encode идемпотентен |
| **DEC** | decode идемпотентен |

**82 инварианта** — структурные, семантические, ID-целостность.

---

## 📁 Результаты анализа

### Compact JSON

```json
{
  "v": "17.1.0",
  "ts": "2026-10-03T08:44:07.185Z",
  "legend": { "version": "3.1.0", "schemas": { ... } },
  "modules": { ... },
  "files": { ... },
  "functions": { ... },
  "react": {
    "components": [...],
    "hooks": [...],
    "jsxElements": [...],
    "stateFlows": [...],
    "eventFlows": [...],
    "renderTree": [...],
    "fnJsxUsage": [...]
  }
}
```

### Full JSON

Полный JSON с **всеми полями** — используется для **анализа** и **отладки**.

### Golden JSON

Снимок **конкретного проекта** — для **защиты от регрессий** кодека.

---

## 🎯 Что дальше

См. [ROADMAP.md](./ROADMAP.md) — план развития.

**Ближайшие цели:**

- 🔥 **CLI `trace-flow`** — трассировка event → state → render.
- **HTML-визуализация flow** — граф цепочек.
- **Vue flow-секции** — симметрия с React.

---

## 🤝 Contributing

1. Fork репозитория.
2. Создай feature-ветку.
3. **Проверь** `npm run check:roundtrip`.
4. **Проверь** `npx tsc --noEmit`.
5. Открой Pull Request.

---

## 📄 License

MIT
MDEOF

echo "README.md создан:"
ls -la README.md
wc -l README.md
```

---

## 📋 Задание 2 — Создать `ROADMAP.md`

```bash
cd /home/sergei/Desktop/system/packages/ast-analyzer

cat > ROADMAP.md << 'MDEOF'
# ROADMAP

> План развития `ast-analyzer`. Приоритеты, статусы, оценка.

---

## 📊 Легенда

| Приоритет | Значение |
|---|---|
| **P0** | Критично, блокирует всё |
| **P1** | Важно, следующий шаг |
| **P2** | Желательно |
| **P3** | Когда-нибудь |

| Статус | Значение |
|---|---|
| ✅ | Готово |
| 🔄 | В работе |
| ⏳ | Запланировано |
| 💤 | Отложено |

---

## 🎯 Текущий статус

**P0 полностью закрыт.** Round-trip 100% на всех проектах.

```
✅ tsc --noEmit                             чист
✅ check:roundtrip                          158/158
✅ check:golden                             160/160
✅ Round-trip на 4 проектах                 PASS
```

---

## P0 — Критично ✅ ЗАКРЫТО

| # | Задача | Статус |
|---|---|---|
| 1 | Round-trip 100% | ✅ |
| 2 | SSOT версий (`LEGEND_VERSION`, `CODEC_VERSION`) | ✅ |
| 3 | ID маппинг `jsx_N` → `rjN` | ✅ |
| 4 | `usageId` в `AnalyzedJsxElement` | ✅ |
| 5 | `usageId` в `parse-typescript.ts` | ✅ |
| 6 | `jsxEvents.modifiers` | ✅ |
| 7 | `jsxElements.expressionRefs` | ✅ |
| 8 | `components.props` — массив индексов | ✅ |
| 9 | `hooks.initialValue = ""` | ✅ |
| 10 | Типы `ReactSectionCompact` | ✅ |
| 11 | TS18048 guard clause | ✅ |
| 12 | Golden-система проект-специфичная | ✅ |

---

## P1 — Важно ⏳ В работе

### 1. CLI `trace-flow` 🔥

**Что:** команда для **трассировки flow-цепочек** из compact JSON.

**Пример:**

```bash
ast-analyzer trace-flow --event=rje1
ast-analyzer trace-flow --state=rh3
ast-analyzer trace-flow --function=fn42
```

**Что покажет:**

```
Event Flow: onClick (rje1)

  ├─ event:    onClick on <button> (line 15)
  ├─ handler:  handleClick() (line 22)
  ├─ call:     setIsOpen(true) (line 25)
  ├─ state:    isOpen = true (line 18)
  └─ render:   <Modal open={isOpen}> (line 30)
```

**Оценка:** ~300 строк.

**Зависимости:** `eventFlows[].chain` — **уже готов**.

**Плюс:** демонстрирует **возможности flow-анализа**.

### 2. HTML-визуализация flow

**Что:** граф event → handler → call → state → render в **`ast-graph-viewer`**.

**Что покажет:**

- **Узлы:** event, handler, call, state, render.
- **Рёбра:** из `eventFlows[].chain`.
- **Фильтры:** по state, по компоненту, по файлу.

**Оценка:** ~500 строк JS.

**Плюс:** удобно для **больших проектов**.

### 3. Vue flow-секции

**Что:** аналог React — `VueStateFlow`, `VueEventFlow`, `VueRenderTree`.

**Что включает:**

- **`VueStateFlow`** — `ref`/`reactive`/`computed` → `mutatedBy`/`readBy`/`renderedIn`.
- **`VueEventFlow`** — `@click` → handler → state → render.
- **`VueRenderTree`** — иерархия шаблона с зависимостями.

**Оценка:** ~700 строк.

**Плюс:** симметрия с React, полный flow-анализ.

---

## P2 — Желательно ⏳

| # | Задача | Оценка |
|---|---|---|
| 1 | `ReactComponentEntity.usedIn` | ~150 строк |
| 2 | `ReactComponentEntity.emits` | ~200 строк |
| 3 | `ReactHookEntity.usedIn/mutatedBy/readBy` | ~300 строк |
| 4 | CLI `analyze-flow` — сводный отчёт по flow | ~200 строк |
| 5 | HTML-отчёт flow с фильтрами | ~300 строк |

---

## P3 — Когда-нибудь 💤

| # | Задача |
|---|---|
| 1 | `ReactComponentEntity.propsStructured` |
| 2 | `ReactComponentEntity.exposed` |
| 3 | Vue `fnHtmlUsage` extension |
| 4 | CLI `compare` — сравнение двух проектов |
| 5 | Codec: больше dictionary compression |

---

## 🗓️ Roadmap по фазам

### Фаза 0 — P0 (закрыто)

**Цель:** round-trip 100% + стабильный codec.

**Статус:** ✅ ЗАКРЫТО.

### Фаза 1 — Flow-анализ (P1)

**Цель:** сделать flow-данные **доступными** для пользователя.

**Задачи:**

1. **CLI `trace-flow`** — 2-3 дня.
2. **HTML-визуализация flow** — 3-4 дня.
3. **Vue flow-секции** — 5-7 дней.

**Результат:**

- Разработчик **видит** цепочки event → state → render.
- Vue **симметричен** React.

### Фаза 2 — Расширение (P2)

**Цель:** покрыть **все кейсы** анализа.

**Задачи:**

1. **Обратные индексы в сущностях** — быстрый доступ.
2. **CLI `analyze-flow`** — сводные отчёты.
3. **HTML-отчёт flow с фильтрами** — UX.

**Результат:**

- Полное **покрытие** React/Vue.
- **Многоформатные** отчёты.

### Фаза 3 — Оптимизация (P3)

**Цель:** ускорить, уменьшить, расширить.

**Задачи:**

1. **Codec: dictionary compression** — уменьшить compact на 20-30%.
2. **Incremental analysis** — анализировать только изменённые файлы.
3. **Parallel parsing** — использовать воркеры.

**Результат:**

- Быстрее на **больших проектах**.
- Меньше **compact JSON**.

---

## 📜 История

### v17.4.0 (текущая)

**Дата:** 2026-10-03.

**Изменения:**

- ✅ **Golden-система** проект-специфичная.
- ✅ **`save-golden.ts`** — сохранение снимков.
- ✅ **`--project=<name>`** в `verify-roundtrip.ts`.
- ✅ **Двойной формат флагов** — `--flag value` и `--flag=value`.
- ✅ **TS18048 guard clause**.
- ✅ **`tmp/`** — в `.gitignore`.
- ✅ **P0 закрыт** — round-trip 100%.

### v17.3.0

**Изменения:**

- ✅ **`components.props`** — массив индексов.
- ✅ **`addString('')`** — разрешена пустая строка.
- ✅ **`hooks.initialValue = ""`** — explicit check.
- ✅ **`jsxElements.expressionRefs`**.
- ✅ **`jsxEvents.modifiers`**.

### v17.2.0

**Изменения:**

- ✅ **ID маппинг** `jsx_N` → `rjN`.
- ✅ **`usageId`** в `AnalyzedJsxElement`.
- ✅ **`usageId`** в `parse-typescript.ts`.

### v17.1.0

**Изменения:**

- ✅ **React flow-секции** (`stateFlows`, `eventFlows`, `renderTree`, `fnJsxUsage`).
- ✅ **Типы `ReactSectionCompact`**.
- ✅ **SSOT версий**.

### v17.0.0

**Изменения:**

- ✅ **React-секция**.
- ✅ **`ElementAttr`**.
- ✅ **`JsxElementEntity`** расширен.

---

## 🎯 Принципы развития

### 1. **Round-trip — свят**

**Ни одно изменение** не должно **ломать** round-trip. **`check:roundtrip`** — **обязателен**.

### 2. **Golden — снимок проекта**

**Golden** — **не часть** codec. **Каждый проект** — **свой снимок**. **Обновляется** — **явно**.

### 3. **Маленькие проекты скрывают баги**

**Тестировать** — на **реальных размерах**. **60+ компонентов**, **200+ модулей**.

### 4. **SSOT версий**

**`LEGEND_VERSION`**, **`CODEC_VERSION`** — **в одном месте** (`codec-types.ts`). **Импортировать**, **не хардкодить**.

### 5. **Явное лучше неявного**

**`!== undefined`** вместо **truthy-check**. **`if (!arg) continue`** вместо **assertion**. **Массив индексов** вместо **`[start, length]`**.

---

## 🤝 Как контрибьютить

**Перед PR:**

```bash
npm run check:roundtrip  # 158/158
npm run check:golden     # 160/160
npx tsc --noEmit         # чист
```

**Если добавляешь поле в codec:**

1. **Типы** — `codec-types.ts`.
2. **Схема** — `codec-legend.ts`.
3. **Encode** — `codec-encode.ts`.
4. **Decode** — `codec-decode.ts`.
5. **Инвариант** — `verify-roundtrip.ts`.
6. **Пересборка** — `save:golden`.

**Если меняешь формат** — **пересоздай golden** для **всех проектов**.

---

## 📞 Контакты

- **Issues:** GitHub Issues.
- **Discussions:** GitHub Discussions.

---

**Последнее обновление:** 2026-10-03.
MDEOF

echo "ROADMAP.md создан:"
ls -la ROADMAP.md
wc -l ROADMAP.md
```

---

## 📋 Задание 3 — Проверить и закоммитить

```bash
cd /home/sergei/Desktop/system/packages/ast-analyzer

echo "═══════════════════════════════════════════════════════════════"
echo "ЗАДАНИЕ 3 — Проверка и коммит"
echo "═══════════════════════════════════════════════════════════════"

echo "--- 3.1. Проверить файлы ---"
ls -la README.md ROADMAP.md

echo ""
echo "--- 3.2. Проверить ссылки в README ---"
grep -n "ROADMAP\|check:roundtrip\|check:golden\|save:golden" README.md | head -10

echo ""
echo "--- 3.3. Git status ---"
git status --short

echo ""
echo "--- 3.4. Коммит ---"
git add README.md ROADMAP.md
git commit -m "docs: README и ROADMAP

README.md:
- Общее описание проекта
- Возможности: анализ, графы, flow, компактный формат, round-trip
- Быстрый старт: CLI, API
- Presets, проверки, golden-фикстуры
- Архитектура и пайплайн

ROADMAP.md:
- Приоритеты P0-P3
- Фаза 0 (закрыта): round-trip 100%
- Фаза 1: CLI trace-flow, HTML flow, Vue flow-секции
- Фаза 2: обратные индексы, отчёты
- Фаза 3: оптимизация (compression, incremental, parallel)
- История версий (v17.0.0 — v17.4.0)
- Принципы развития

P0 закрыт: 158/158 без golden, 160/160 с golden, tsc чист"

echo ""
echo "--- 3.5. Лог ---"
git log --oneline -3


echo ""
echo "═══════════════════════════════════════════════════════════════
echo "ГОТОВО."
echo "═══════════════════════════════════════════════════════════════"
```

---

## 🎯 Что создано

### `README.md` (~300 строк)

- **Возможности** — анализ, графы, flow, компактный формат, round-trip.
- **Быстрый старт** — установка, CLI, API.
- **Presets** — таблица режимов.
- **Проверки** — round-trip, golden, tsc.
- **Архитектура** — директории, пайплайн.
- **Round-trip 100%** — все уровни.
- **Результаты анализа** — примеры compact/full/golden.
- **Contributing** — 5 шагов.
- **License** — MIT.

### `ROADMAP.md` (~400 строк)

- **Легенда** — приоритеты и статусы.
- **Текущий статус** — P0 закрыт.
- **P0** — ✅ **12 задач** закрыто.
- **P1** — ⏳ **3 задачи** (CLI trace-flow, HTML flow, Vue flow).
- **P2** — **5 задач**.
- **P3** — **5 задач**.
- **Фазы** — 4 фазы развития.
- **История** — v17.0.0 — v17.4.0.
- **Принципы** — 5 правил развития.
- **Contributing** — что проверять перед PR.

---

## ⚠️ Замечание

**README** — **для новых пользователей**. **ROADMAP** — **для тебя и контрибьюторов**.

**README** — **стабильный** (меняется редко). **ROADMAP** — **живой** (обновляется каждую итерацию).

**Принципы** в ROADMAP — **вынесены** из **уроков** этой сессии:

1. **Round-trip — свят.**
2. **Golden — снимок проекта.**
3. **Маленькие проекты скрывают баги.**
4. **SSOT версий.**
5. **Явное лучше неявного.**

**Эти принципы** — **не догма**. **Но они сэкономили тебе десятки часов** в этой сессии.

**Жду вывод Задания 3.**
