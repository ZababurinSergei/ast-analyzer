Разберу, что именно нужно доработать в анализаторе (`src/`), чтобы дерево вызовов и граф зависимостей были **полными**. Разобью по слоям: данные → анализатор → кодек → фронт.

---

## 1. Корень проблемы: что сейчас теряется

Смотрю на текущие данные из `index.full.json` (фрагмент твоего файла):

```json
"calls": [
  { "id": "c1", "fromFunctionId": "fn767", "toFunctionId": "fn768", "line": 147, "type": "direct" }
]
```

**Что здесь есть:**
- `fromFunctionId` — вызывающая функция
- `toFunctionId` — вызываемая функция
- `line`, `type`

**Чего здесь НЕТ:**

1. **`parentFunctionId`** — ID функции, внутри которой **лексически** объявлена данная функция (для колбэков, вложенных функций, arrow-функций в аргументах).
2. **`callSite`** — точное место вызова (не только строка, но и колонка, и контекст: `map`, `setTimeout`, `addEventListener`).
3. **`callKind`** — как именно вызвана функция: `direct`, `method`, `callback`, `constructor`, `tagged-template`, `optional-chain`, `spread`, `new`.
4. **`argumentIndex`** — для колбэков: каким аргументом передана функция (`array.map(fn)` → `fn` — 0-й аргумент `map`).
5. **`boundTo`** — если функция передана как колбэк, к какой сущности она «привязана» (`_idle(fn)` → `fn` привязан к `_idle`).

Именно из-за отсутствия `parentFunctionId` в дереве появляются «висячие» корни: `_idle_callback`, `map_callback`, `String.replace_callback`, `anonymous_arrow`. Каждый из них — **лексически вложен** в какую-то функцию, но анализатор это не сохраняет.

---

## 2. Что доработать в AST-анализаторе

### 2.1. Извлечение `parentFunctionId` (КРИТИЧНО)

В `extract-entities-from-ast.ts` (или где у тебя обход AST) при обнаружении функции нужно **знать её лексического родителя**.

**Псевдокод:**

```ts
function visitFunction(node: ts.FunctionLikeDeclaration, parentFunction: FunctionData | null) {
  const fn = createFunctionData(node, parentFunction?.id ?? null);
  functions.push(fn);

  // Рекурсивный обход тела — parentFunction теперь = fn
  ts.forEachChild(node.body, child => visit(child, fn));
}

function visitArrowFunction(node: ts.ArrowFunction, parentFunction: FunctionData | null) {
  // Arrow-функция в аргументе вызова — её родитель = функция,
  // внутри которой находится вызов
  const fn = createFunctionData(node, parentFunction?.id ?? null);
  functions.push(fn);

  ts.forEachChild(node.body, child => visit(child, fn));
}
```

**Ключевые случаи, которые нужно покрыть:**

| Случай | Пример | `parentFunctionId` |
|---|---|---|
| Вложенная функция | `function outer() { function inner() {} }` | `inner.parentFunctionId = outer.id` |
| Arrow в переменной | `function outer() { const fn = () => {} }` | `fn.parentFunctionId = outer.id` |
| Колбэк в вызове | `function outer() { arr.map(x => x) }` | `callback.parentFunctionId = outer.id` |
| Колбэк в setTimeout | `function outer() { setTimeout(() => {}, 100) }` | `callback.parentFunctionId = outer.id` |
| Метод класса | `class A { method() {} }` | `method.parentFunctionId = null` (или ID класса) |
| IIFE | `(function() {})()` | `iife.parentFunctionId = <родитель>` |

**Реализация через стек:**

```ts
const functionStack: FunctionData[] = [];

function enterFunction(node, fn) {
  functionStack.push(fn);
}

function exitFunction() {
  functionStack.pop();
}

function currentParent(): FunctionData | null {
  return functionStack[functionStack.length - 1] ?? null;
}
```

При создании `FunctionData`:

```ts
{
  id: `fn${++counter}`,
  name: ...,
  parentFunctionId: currentParent()?.id ?? null,   // ← НОВОЕ
  ...
}
```

---

### 2.2. Извлечение колбэков из аргументов вызовов

Колбэк — это arrow/function-expression, **переданная аргументом** в вызов. Чтобы связать её с вызывающей функцией, нужно в `visitCallExpression` найти все function-like аргументы.

**Псевдокод:**

```ts
function visitCallExpression(node: ts.CallExpression) {
  const calleeName = getCalleeName(node.expression);  // 'map', '_idle', 'setTimeout'

  node.arguments.forEach((arg, index) => {
    if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
      const callback = createFunctionData(arg, currentParent()?.id ?? null);

      // ✅ НОВОЕ: сохраняем, к какому вызову привязан колбэк
      callback.boundTo = {
        calleeName,              // '_idle'
        argumentIndex: index,    // 0
        line: node.getStart(),
        callKind: 'callback',    // 'map' | 'setTimeout' | 'addEventListener' | ...
      };

      functions.push(callback);
    }
  });

  ts.forEachChild(node, visit);
}
```

**Что это даёт:**

1. Колбэк получает `parentFunctionId` = функция, внутри которой он объявлен.
2. Колбэк получает `boundTo` = описание вызова, в который он передан.
3. Дерево вызовов может связать `_idle(callback)` → `callback` как **лексического ребёнка** `_idle`.

---

### 2.3. Расширение `CallData`

Сейчас `CallData` минимален:

```ts
interface CallData {
  id: string;
  fromFunctionId: string;
  toFunctionId: string;
  line: number;
  type: 'direct' | 'async' | 'method' | 'callback';
}
```

**Нужно добавить:**

```ts
interface CallData {
  id: string;
  fromFunctionId: string;
  toFunctionId: string;
  line: number;
  column?: number;                 // ← НОВОЕ: точная колонка
  type: 'direct' | 'async' | 'method' | 'callback';

  // ✅ НОВОЕ: контекст вызова
  callKind?: 'direct' | 'method' | 'callback' | 'constructor'
           | 'tagged-template' | 'optional-chain' | 'spread' | 'new';
  calleeName?: string;             // 'map', '_idle', 'addEventListener'
  argumentIndex?: number;          // для колбэков: 0, 1, ...
  isChained?: boolean;             // arr.map().filter() → filter — chained

  // ✅ НОВОЕ: связь с лексическим родителем (если это колбэк)
  callbackFunctionId?: string;     // ID колбэка, если toFunctionId — колбэк
  parentCallId?: string;           // ID внешнего вызова, если колбэк внутри колбэка
}
```

---

### 2.4. Связывание колбэков с вызовами (callback resolution)

Это самая сложная часть. Есть три уровня точности:

**Уровень A (эвристика по имени — то, что можно сделать за 1 день):**

```ts
// Колбэк с именем 'map_callback' → ищем вызов .map() в том же файле,
// у которого parentFunctionId совпадает с родителем колбэка.
```

**Уровень B (по AST-связи — то, что нужно):**

Когда в `visitCallExpression` находим arrow-функцию как аргумент:

```ts
const callback = createFunctionData(arg, currentParent()?.id ?? null);
callback.boundTo = { calleeName, argumentIndex: index };
```

Затем в `calls` добавляем **две** записи:

```ts
// 1. Вызов callee (например, arr.map)
calls.push({
  fromFunctionId: currentParent()?.id,
  toFunctionId: `<method:map>`,   // метод, не функция
  type: 'method',
  line: node.getStart(),
});

// 2. Лексическую связь callback → parentFunction
// (это НЕ вызов, но нужно для дерева)
lexicalLinks.push({
  parentFunctionId: currentParent()?.id,
  childFunctionId: callback.id,
  relation: 'lexical',
  line: arg.getStart(),
});
```

**Уровень C (полный call graph — то, что даёт 100% полноту):**

Использовать `ts.TypeChecker` для разрешения символов:

```ts
const symbol = typeChecker.getSymbolAtLocation(node.expression);
const target = symbol?.valueDeclaration;
if (target && ts.isFunctionLike(target)) {
  calls.push({
    fromFunctionId: currentFn.id,
    toFunctionId: functionIdByNode.get(target),
    type: 'direct',
    line: node.getStart(),
    column: node.getStart() - node.getStartOfLine(),
  });
}
```

Это даёт **точные** межфайловые вызовы, но требует полной типовой информации.

---

### 2.5. Добавление `lexicalLinks` в `FullJSON`

Нужна новая секция — **лексические связи** (не вызовы):

```ts
interface LexicalLink {
  id: string;
  parentFunctionId: string;    // функция, внутри которой объявлена
  childFunctionId: string;     // вложенная функция / колбэк
  relation: 'nested' | 'callback' | 'iife' | 'class-method';
  line: number;
  argumentIndex?: number;      // для колбэков
  calleeName?: string;         // 'map', '_idle', 'setTimeout'
}

interface FullJSON {
  ...
  calls: CallData[];
  lexicalLinks?: LexicalLink[];   // ← НОВОЕ
  ...
}
```

**Почему отдельная секция, а не расширение `calls`:**

- Вызов (`calls`) — это **динамическая** связь: `A` вызывает `B` во время выполнения.
- Лексическая связь (`lexicalLinks`) — это **статическая** связь: `B` объявлена внутри `A` в AST.

Это **разные** графы, и смешивать их нельзя. Дерево вызовов должно строиться на **обоих**, но с разными стилями рёбер.

---

## 3. Что доработать в кодеке

### 3.1. Кодирование `parentFunctionId`

В `codec-encode.ts` в секции `fns` добавить новый параллельный массив:

```ts
const fnsParent: number[] = [];  // ← НОВОЕ: parentFunctionIdx

for (const func of functions) {
  ...
  fnsParent.push(functionReverse.get(func.parentFunctionId) ?? -1);
  // -1 = нет родителя (корневая функция)
}
```

В `fns` секции compact:

```ts
fns: {
  n, m, f, l, fl, p, rt,
  parent: fnsParent,   // ← НОВОЕ
}
```

Обновить `legend.schemas.fns`:

```ts
fns: ['n', 'm', 'f', 'l', 'fl', 'p', 'rt', 'parent'],
```

### 3.2. Кодирование `lexicalLinks`

Новая секция `lx` (lexical):

```ts
const lx: number[] = [];
for (const link of canonical.lexicalLinks ?? []) {
  lx.push(...encodeLexicalLink(link));  // или через values[]
}
```

Либо через `values[]` (как extended-секции):

```ts
const lx = encodeExtendedSection(canonical.lexicalLinks, 'lx');
```

### 3.3. Кодирование расширенного `CallData`

В `gr.c` добавить:

```ts
gr: {
  c: {
    f, t, l, ty,
    col: gcCol,          // ← НОВОЕ: column
    ck: gcCk,            // ← НОВОЕ: callKind
    cn: gcCn,            // ← НОВОЕ: calleeNameIdx
    ai: gcAi,            // ← НОВОЕ: argumentIndex
  }
}
```

Обновить `legend.schemas['gr.c']`:

```ts
'gr.c': ['f', 't', 'l', 'ty', 'col', 'ck', 'cn', 'ai'],
```

### 3.4. Обновление версии кодека

```
CODEC_VERSION = '15.1.0'
```

С обратной совместимостью: старые compact без `parent`/`lx` читаются как «нет лексических связей».

---

## 4. Что доработать на фронте

### 4.1. `buildFnCallTree` — использовать `parentFunctionId`

Уже сделано в моём предыдущем патче. Но нужен **fallback**, если анализатор ещё не отдаёт `parentFunctionId`:

```js
const pid = fn.parentFunctionId ?? heuristicParent(fn);
```

Где `heuristicParent(fn)` — эвристика:

```js
function heuristicParent(fn) {
  // 'map_callback' → ищем функцию с 'map' в теле и этой строкой ±5
  if (fn.name.endsWith('_callback')) {
    const baseName = fn.name.replace(/_callback$/, '');
    // ищем в том же файле вызов baseName в пределах ±5 строк
    ...
  }
  return null;
}
```

### 4.2. `buildFnCallTree` — использовать `lexicalLinks`

Если анализатор отдаёт `state.lexicalLinks`:

```js
// Строим карту parentFunctionId → [childFunctionId, ...]
const lexicalChildren = new Map();
for (const link of state.lexicalLinks ?? []) {
  if (!lexicalChildren.has(link.parentFunctionId)) {
    lexicalChildren.set(link.parentFunctionId, []);
  }
  lexicalChildren.get(link.parentFunctionId).push({
    childId: link.childFunctionId,
    relation: link.relation,
    line: link.line,
  });
}
```

### 4.3. Отображение типа связи

В `renderFnNode` добавить иконку типа:

```js
const relationIcon = {
  nested: '🔽',
  callback: '📞',
  iife: '⚡',
  'class-method': '🏛',
}[link.relation] || '';
```

### 4.4. Отображение `callKind`

В графе вызовов (`ast-analyzer-graph.js`) показывать не только `type`, но и `callKind`:

- `direct` → сплошная стрелка
- `callback` → пунктирная стрелка
- `method` → стрелка с точкой
- `constructor` → стрелка с ромбом

---

## 5. Пошаговый план

### Шаг 1: `parentFunctionId` (1–2 дня)

| Задача | Файл |
|---|---|
| Добавить поле `parentFunctionId?: string` в `FunctionData` | `codec-types.ts` |
| Заполнять `parentFunctionId` при обходе AST (стек функций) | `extract-entities-from-ast.ts` |
| Пробросить в `codec-encode.ts` → `fns.parent` | `codec-encode.ts` |
| Читать в `codec-decode.ts` | `codec-decode.ts` |
| Обновить `legend.schemas.fns` | `codec-legend.ts` |
| Обновить `buildFnCallTree` (fallback на вызовы) | `ast-analyzer-tree.js` |
| Обновить `CODEC_VERSION` = `15.1.0` | `codec-types.ts` |
| Обновить `verify-roundtrip.ts` | `scripts/` |

**Результат:** в дереве `_idle_callback` становится ребёнком `_idle`, `map_callback` — ребёнком функции, внутри которой `arr.map(...)`.

### Шаг 2: `lexicalLinks` (2–3 дня)

| Задача | Файл |
|---|---|
| Добавить тип `LexicalLink` | `codec-types.ts` |
| Собирать `lexicalLinks` при обходе AST | `extract-entities-from-ast.ts` |
| Добавить секцию `lx` в compact | `codec-encode.ts` |
| Читать `lx` в decode | `codec-decode.ts` |
| Обновить легенду | `codec-legend.ts` |
| Использовать в `buildFnCallTree` | `ast-analyzer-tree.js` |
| Отображать иконки типа связи | `ast-analyzer-tree.js`, CSS |

**Результат:** в дереве видны колбэки, IIFE, вложенные функции — с иконками типа.

### Шаг 3: Расширенный `CallData` (2 дня)

| Задача | Файл |
|---|---|
| Добавить `column`, `callKind`, `calleeName`, `argumentIndex` | `codec-types.ts` |
| Собирать в AST | `extract-entities-from-ast.ts` |
| Кодировать в `gr.c` | `codec-encode.ts` |
| Читать в decode | `codec-decode.ts` |
| Обновить легенду | `codec-legend.ts` |
| Отображать в графе | `ast-analyzer-graph.js` |

**Результат:** в графе вызовов видно, как именно вызвана функция — `arr.map(fn)` vs `fn()` vs `new Fn()`.

### Шаг 4: Межфайловые вызовы через TypeChecker (3–5 дней)

| Задача | Файл |
|---|---|
| Использовать `ts.TypeChecker` для разрешения символов | `extract-entities-from-ast.ts` |
| Строить точные межфайловые `calls` | `extract-entities-from-ast.ts` |
| Помечать `isCrossFile: true` в `CallData` | `codec-types.ts` |
| Разрешить межфайловые узлы в `buildFnCallTree` | `ast-analyzer-tree.js` |

**Результат:** в дереве можно раскрыть `_buildFnImportTargetsIndex` → `state.fnById[...]` → функция в другом файле.

### Шаг 5: Полный call graph (опционально, 1 неделя)

- Построение транзитивного графа вызовов через TypeChecker.
- Кэширование в `state.callGraph` (Map<fnId, Set<fnId>>).
- Ленивое раскрытие узлов в дереве.
- Помечать циклы между файлами.

---

## 6. Приоритеты

| Приоритет | Задача | Эффект |
|---|---|---|
| **P0** | `parentFunctionId` | Устраняет 80% «висячих» корней. Дерево становится осмысленным. |
| **P1** | `lexicalLinks` | Точное разделение «вызов» vs «вложенность». |
| **P2** | Расширенный `CallData` | Лучшая визуализация в графе. |
| **P3** | TypeChecker для межфайловых | Полный call graph, но дорого по времени. |
| **P4** | Полный транзитивный граф | Для очень больших проектов, с кэшем. |

---

## 7. Минимальный MVP

Если времени мало — делай **только P0** (`parentFunctionId`). Это:

1. **1 поле** в `FunctionData`.
2. **1 стек** в AST-обходе (`functionStack`).
3. **1 параллельный массив** в `codec-encode.ts` (`fns.parent`).
4. **1 строка** в `codec-decode.ts`.
5. **1 строка** в `legend.schemas.fns`.
6. **1 fallback** в `buildFnCallTree`.

**Эффект:** дерево вызовов перестанет показывать `_idle_callback`, `map_callback`, `String.replace_callback` как отдельные корни. Они станут детьми своих лексических родителей.

---

## 8. Как проверить, что стало лучше

До:
```
ƒ escapeHtml (L143)          ← корень
ƒ String.replace_callback (L147)  ← корень (должен быть ребёнком escapeHtml)
ƒ downloadCSV (L236)          ← корень
  ƒ downloadBlob (L219)
  ƒ esc (L237)
ƒ _idle_callback (L934)       ← корень (должен быть ребёнком _idle)
ƒ _idle_callback (L935)       ← корень (должен быть ребёнком _idle)
```

После:
```
ƒ escapeHtml (L143)
  ƒ String.replace_callback (L147)   ← ребёнок
ƒ downloadCSV (L236)
  ƒ downloadBlob (L219)
  ƒ esc (L237)
ƒ scheduleIdleIndexing (L933)
  ƒ _idle (L267)
    ƒ _idle_callback (L934)          ← ребёнок
    ƒ _idle_callback (L935)          ← ребёнок
```

---

## 9. Что НЕ нужно делать

- ❌ **Не хранить `parentFunctionId` как массив строк** (`parentFunctionIds: string[]`) — для колбэков это не имеет смысла, у функции один лексический родитель.
- ❌ **Не смешивать `calls` и `lexicalLinks`** в одну секцию — это разные графы.
- ❌ **Не строить полный граф на этапе анализа** — это дорого. Лучше лениво на фронте.
- ❌ **Не использовать `isNested` как замену `parentFunctionId`** — `isNested` это boolean, он не даёт ID родителя.

---

## 10. Итог

**Что нужно доработать в анализаторе, чтобы связи были полными:**

1. **`parentFunctionId` в `FunctionData`** — стек функций при обходе AST. **(P0, 1–2 дня)**
2. **`LexicalLink[]` в `FullJSON`** — отдельная секция для лексических связей. **(P1, 2–3 дня)**
3. **Расширенный `CallData`** — `column`, `callKind`, `calleeName`, `argumentIndex`. **(P2, 2 дня)**
4. **TypeChecker для межфайловых вызовов** — точные `toFunctionId`. **(P3, 3–5 дней)**
5. **Проброс через кодек** — новые параллельные массивы в `fns`, `gr.c`, новая секция `lx`. **(вместе с P0–P2)**
6. **Обновление `buildFnCallTree`** — использовать `parentFunctionId` и `lexicalLinks`. **(фронт, 1 день)**

**Минимальный MVP — только P0.** Этого достаточно, чтобы дерево перестало показывать «висячие» колбэки и корректно сохраняло раскрытие.
