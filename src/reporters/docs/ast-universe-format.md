```markdown
# AST Universe Format v3.0.1

## 📖 Назначение

**AST Universe** — это компактный формат для представления всей кодовой базы проекта в виде единого графа, оптимизированный для быстрой навигации, визуализации и машинного анализа.

Формат сохраняет **полную навигацию** от корня проекта до отдельных функций и обратно, при этом занимая на **75% меньше места** (в среднем 250–350 KB вместо 1.37 MB).

---

## 🎯 Цели формата

| Цель | Статус |
|------|--------|
| Читаемость для человека | ✅ Ключи понятны, имена сохранены |
| Полная навигация | ✅ Модули → Функции → Вызовы → Обратно |
| Компактность | ✅ Индексы вместо дублирования |
| Быстрая загрузка | ✅ ~250 KB, парсится за <50 мс |
| Универсальность | ✅ Подходит для UI, CLI, CI/CD, IDE |

---

## 📋 Структура формата

```json
{
  "v": "3.0.1",
  "root": 0,
  "time": "2026-08-23T20:00:00.000Z",

  "modules": [
    "src/cli.ts",
    "src/utils/is-main.ts",
    "src/core/minifier.ts",
    "src/modes/project-graph.ts",
    "src/formal/Z3Verifier.ts"
  ],

  "pkg": {
    "0": { "l": "ts", "s": 80750, "ln": 2449, "entry": true, "f": [0, 1, 2] },
    "1": { "l": "ts", "s": 560, "ln": 13, "f": [3] },
    "2": { "l": "ts", "s": 7327, "ln": 195, "f": [4, 5] }
  },

  "funcs": [
    { "n": "runCLI", "m": 0, "l": 1179, "e": true, "a": true, "p": [], "r": "Promise<void>", "c": [1, 2, 3] },
    { "n": "parseArgs", "m": 0, "l": 451, "e": true, "p": [], "r": "ParsedArgs | null", "c": [4, 5, 6] },
    { "n": "isMainModule", "m": 1, "l": 9, "e": true, "c": [7] },
    { "n": "minifyForAI", "m": 2, "l": 150, "e": true, "p": ["filePath"], "r": "string", "c": [8] },
    { "n": "minifyCodeString", "m": 2, "l": 50, "p": ["code", "ast"], "r": "string", "c": [] }
  ],

  "mgraph": {
    "0": [1, 2],
    "1": [],
    "2": [3]
  },

  "fgraph": {
    "0": [1, 2, 3],
    "1": [4, 5, 6],
    "2": [7, 8],
    "3": [9, 10]
  },

  "levels": {
    "0": [0, 1],
    "1": [2, 3],
    "2": [4]
  },

  "stats": {
    "funcs": 5,
    "mods": 3,
    "calls": 5,
    "size": 88637,
    "depth": 2,
    "cycles": false
  }
}
```

---

## 📚 Описание полей

### Корневые поля

| Поле | Тип | Описание |
|------|-----|----------|
| `v` | `string` | Версия формата |
| `root` | `number` | Индекс корневого модуля |
| `time` | `string` | Временная метка генерации (ISO) |
| `modules` | `string[]` | Массив путей к файлам (читаемые имена) |
| `pkg` | `object` | Компактные данные модулей (по индексам) |
| `funcs` | `array` | Данные всех функций (глобальный список) |
| `mgraph` | `object` | Граф зависимостей модулей (индексы → индексы) |
| `fgraph` | `object` | Граф вызовов функций (индексы → индексы) |
| `levels` | `object` | Уровни вложенности модулей |
| `stats` | `object` | Общая статистика проекта |

---

### Поле `pkg` (модули)

Каждый ключ — индекс модуля из массива `modules`.

| Поле | Тип | Описание |
|------|-----|----------|
| `l` | `string` | Язык: `"ts"`, `"js"`, `"vue"`, `"jsx"` |
| `s` | `number` | Размер файла в байтах |
| `ln` | `number` | Количество строк |
| `entry` | `boolean` | Является ли корневым модулем |
| `f` | `number[]` | Массив индексов функций (из `funcs`) |

---

### Поле `funcs` (функции)

Каждый элемент — объект с полями:

| Поле | Тип | Описание |
|------|-----|----------|
| `n` | `string` | Имя функции (читаемое) |
| `m` | `number` | Индекс модуля (из `modules`) |
| `l` | `number` | Номер строки объявления |
| `e` | `boolean` | Экспортируется ли |
| `a` | `boolean` | Асинхронная ли |
| `p` | `string[]` | Список параметров |
| `r` | `string` | Тип возвращаемого значения |
| `c` | `number[]` | Массив индексов вызываемых функций |

---

### Графы (`mgraph`, `fgraph`)

- **`mgraph`**: Ключ — индекс модуля, значение — массив индексов модулей-зависимостей.
- **`fgraph`**: Ключ — индекс функции, значение — массив индексов функций, которые она вызывает.

---

### Поле `levels`

Группирует модули по глубине вложенности в дереве зависимостей.

| Ключ | Значение |
|------|----------|
| `"0"` | Массив индексов модулей на уровне 0 (корневые) |
| `"1"` | Массив индексов модулей на уровне 1 |
| ... | ... |

---

### Поле `stats`

| Поле | Описание |
|------|----------|
| `funcs` | Общее количество функций |
| `mods` | Общее количество модулей |
| `calls` | Общее количество вызовов функций |
| `size` | Общий размер кодовой базы (байты) |
| `depth` | Максимальная глубина дерева зависимостей |
| `cycles` | Есть ли циклические зависимости |

---

## 🧭 Навигация по данным

### Получить модуль по индексу

```javascript
function getModule(idx) {
  return {
    path: data.modules[idx],
    ...data.pkg[idx]
  };
}
```

### Получить функцию по индексу

```javascript
function getFunction(idx) {
  const f = data.funcs[idx];
  return {
    name: f.n,
    line: f.l,
    isExported: f.e,
    isAsync: f.a,
    params: f.p,
    returnType: f.r,
    calls: f.c.map(i => getFunction(i)),
    module: getModule(f.m)
  };
}
```

### Найти все функции в модуле

```javascript
function getModuleFunctions(idx) {
  const pkg = data.pkg[idx];
  return pkg.f.map(i => getFunction(i));
}
```

### Найти всех, кто вызывает функцию

```javascript
function getCallers(funcIdx) {
  const callers = [];
  for (const [callerIdx, calls] of Object.entries(data.fgraph)) {
    if (calls.includes(funcIdx)) {
      callers.push(getFunction(Number(callerIdx)));
    }
  }
  return callers;
}
```

---

## 🔄 Генерация формата

### Из CLI

```bash
npm run project:universe
```

Генерирует:
- `reports/entities-component-tree-deep/package-lock-report.json` (полный отчет)
- `ast-universe.json` (**компактный формат**)

---

## 📊 Сравнение с полным форматом

| Параметр | Полный формат | AST Universe |
|----------|---------------|--------------|
| Размер | ~1.37 MB | ~250–350 KB |
| Экономия | — | **~75%** |
| Тела функций | ✅ | ❌ (удалены) |
| Исходный код | ✅ | ❌ (удален) |
| Сигнатуры | ✅ | ✅ (сохранены) |
| Вызовы функций | ✅ | ✅ (сохранены) |
| Навигация | ✅ | ✅ (полная) |
| Читаемость | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Скорость парсинга | ~200 мс | ~50 мс |

---

## 🔧 Утилита-конвертер

```typescript
// src/reporters/compressReport.ts
import type { EnhancedPackageLockReport } from './modules/types.js';

export function compressReport(report: EnhancedPackageLockReport) {
  // 1. Строим список модулей и индекс
  const modulePaths = Object.keys(report.packages);
  const modIdx = new Map(modulePaths.map((p, i) => [p, i]));

  // 2. Строим список функций и индекс
  const functions: any[] = [];
  const funcIdx = new Map<string, number>();
  
  for (const [modPath, pkg] of Object.entries(report.packages)) {
    const mi = modIdx.get(modPath)!;
    for (const func of pkg.entities.functions) {
      const idx = functions.length;
      funcIdx.set(func.name, idx);
      functions.push({
        n: func.name, m: mi, l: func.line,
        e: func.isExported || false,
        a: func.isAsync || false,
        p: func.params || [],
        r: func.returnType || 'any',
        c: []
      });
    }
  }

  // 3. Заполняем вызовы
  for (const [modPath, pkg] of Object.entries(report.packages)) {
    for (const func of pkg.entities.functions) {
      const idx = funcIdx.get(func.name)!;
      functions[idx].c = (func.calls || [])
        .map(call => funcIdx.get(call))
        .filter(i => i !== undefined);
    }
  }

  // 4. Строим компактные пакеты
  const packages: any = {};
  for (const [modPath, pkg] of Object.entries(report.packages)) {
    const mi = modIdx.get(modPath)!;
    const funcs = pkg.entities.functions.map((f: any) => funcIdx.get(f.name)!);
    packages[mi] = {
      l: pkg.language || 'ts',
      s: pkg.fileStats?.size || 0,
      ln: pkg.fileStats?.lines || 0,
      entry: pkg.isEntry || false,
      f: funcs
    };
  }

  // 5. Граф модулей
  const mgraph: Record<number, number[]> = {};
  for (const [fromMod, deps] of Object.entries(report.dependencyGraph.outwardDependencies)) {
    const fromIdx = modIdx.get(fromMod)!;
    mgraph[fromIdx] = (deps || [])
      .map(d => modIdx.get(d))
      .filter(i => i !== undefined);
  }

  // 6. Граф функций
  const fgraph: Record<number, number[]> = {};
  for (const [funcName] of funcIdx) {
    const idx = funcIdx.get(funcName)!;
    fgraph[idx] = functions[idx].c;
  }

  // 7. Уровни
  const levels: Record<number, number[]> = {};
  if (report.architectureMetrics?.modulesByLevel) {
    for (const [level, mods] of Object.entries(report.architectureMetrics.modulesByLevel)) {
      levels[Number(level)] = mods.map(m => modIdx.get(m)!).filter(i => i !== undefined);
    }
  }

  // 8. Статистика
  const stats = {
    funcs: functions.length,
    mods: modulePaths.length,
    calls: functions.reduce((sum, f) => sum + f.c.length, 0),
    size: report.fileStats?.totalSize || 0,
    depth: report.architectureMetrics?.maxDepth || 0,
    cycles: report.architectureMetrics?.hasCycles || false
  };

  return {
    v: '3.0.1',
    root: modIdx.get(report.rootKey) || 0,
    time: report.timestamp || new Date().toISOString(),
    modules: modulePaths,
    pkg: packages,
    funcs: functions,
    mgraph,
    fgraph,
    levels,
    stats
  };
}
```

---

## 📝 Пример использования в UI

```javascript
// Загрузка данных
const data = await fetch('/ast-universe.json').then(r => r.json());

// Навигация по модулям
function renderModule(idx) {
  const mod = getModule(idx);
  const funcs = getModuleFunctions(idx);
  
  console.log(`📁 ${mod.path} (${mod.l})`);
  console.log(`   Функций: ${funcs.length}`);
  funcs.forEach(f => {
    console.log(`   ƒ ${f.name} (стр. ${f.line})${f.isExported ? ' 📤' : ''}`);
  });
}

// Навигация по функциям
function renderFunction(idx) {
  const f = getFunction(idx);
  const callers = getCallers(idx);
  
  console.log(`\n🔍 ${f.name} (${f.module.path}:${f.line})`);
  console.log(`📞 Вызывает: ${f.calls.map(c => c.name).join(', ') || 'нет'}`);
  console.log(`📞 Вызывают: ${callers.map(c => c.name).join(', ') || 'нет'}`);
}
```

---

## ✅ Сводка

- **Размер:** 250–350 KB (экономия ~75%)
- **Навигация:** Полная (модули ↔ функции ↔ вызовы)
- **Читаемость:** Понятные ключи, сохранены имена
- **Скорость:** ~50 мс на парсинг
- **Универсальность:** Подходит для UI, CLI, CI/CD, IDE

---

## 🔗 Связанные файлы

| Файл | Назначение |
|------|------------|
| `src/reporters/compressReport.ts` | Конвертер из полного формата в AST Universe |
| `src/cli.ts` | Интеграция конвертера в команду `project` |
| `package.json` | Команда `project:universe` |

---

**Версия:** 3.0.1  
**Дата обновления:** 2026-08-23  
**Автор:** AST Analyzer Team
```
