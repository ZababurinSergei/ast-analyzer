# 🔪 Разбиение файла на модули - Анализ и рекомендации

Отличный вопрос! Для задачи **разбиения одного файла на модули** нужен **комбинированный подход**. Ни один режим сам по себе не даст полную картину, но их комбинация даст ИИ всё необходимое.

## 🎯 Оптимальная стратегия

### Режим 1: `file` - Анализ внутренних связей

**Что даёт:** Понимает, какие функции/переменные внутри файла связаны между собой.

```bash
npx @newkind/ast-analyzer file ./src/huge-component.js
```

**Что покажет граф:**

```
calculateTotal() → applyDiscount() → validatePrice()
validatePrice()  → formatCurrency()
renderUI()        → calculateTotal() → formatCurrency()
```

**Как помогает:** Видно, какие функции образуют **связные кластеры** (кандидаты на выделение в модули).

---

### Режим 2: `minify` - Сжатие для анализа

**Что даёт:** Убирает детали реализации, оставляя только "скелет" файла.

```bash
npx @newkind/ast-analyzer minify ./src/huge-component.js
```

**Результат:**

```typescript
// Только сигнатуры функций, импорты, экспорты
// Идеально для быстрого понимания структуры
```

---

### Режим 3: `prompt-pack` с фокусом на файл

**Что даёт:** Собирает контекст для ИИ с инструкцией по разбиению.

```bash
npx @newkind/ast-analyzer prompt-pack ./src/huge-component.js 0
# Глубина 0 - только сам файл, без зависимостей
```

---

## 🚀 Оптимальный пайплайн для разбиения

```bash
# Шаг 1: Визуализируй внутренние связи
npx @newkind/ast-analyzer file ./src/huge-file.js
# Открой report.html - увидишь кластеры функций

# Шаг 2: Сгенерируй сжатый скелет
npx @newkind/ast-analyzer minify ./src/huge-file.js
# Получишь ai-context.txt для быстрого анализа

# Шаг 3: Собери контекст для ИИ
npx @newkind/ast-analyzer prompt-pack ./src/huge-file.js 0
# Получишь ai-prompt-bundle.md с инструкцией
```

---

## 🤖 Специализированный промпт для разбиения на модули

Создайте файл `split-module-prompt.md`:

````markdown
# 🔪 Разбиение файла на модули

## 📋 Исходные данные

**Анализируемый файл:** [путь к файлу]

**Граф внутренних зависимостей:** [вставьте содержимое output.json из режима file]

**Сжатый код файла:** [вставьте содержимое ai-context.txt]

---

## 🎯 Задача

Разбить монолитный файл на логически связанные модули.

### Критерии выделения модуля:

1. **Связность (Cohesion)** - функции, которые часто вызывают друг друга
2. **Ответственность (Responsibility)** - общая тема/домен
3. **Переиспользование (Reusability)** - функции, которые могут быть полезны отдельно
4. **Тестируемость (Testability)** - можно тестировать независимо

### Анти-паттерны:

- ❌ Циклические зависимости между модулями
- ❌ Один модуль знает слишком много о других
- ❌ "Мусорный" модуль со всем подряд

---

## 📤 Требуемый формат ответа

### 1. Анализ текущей структуры

Выяви кластеры функций, которые должны быть вместе:

```markdown
## Кластер A: [Название функциональности]

- `function1()` - потому что [причина]
- `function2()` - потому что [причина]
- `helper1()` - используется только function1/function2

## Кластер B: [Название функциональности]

...
```
````

### 2. Предлагаемая структура модулей

```markdown
src/
├── modules/
│ ├── [module-a].ts
│ │ ├── export { mainFunction }
│ │ ├── internal helper functions
│ │ └── types/interfaces
│ ├── [module-b].ts
│ └── index.ts (реэкспорт)
```

### 3. Код новых модулей

Для каждого модуля предоставь:

```typescript
// modules/[name].ts
import { ... } from './dependencies';

// ========== Types ==========
export interface ModuleType { ... }

// ========== Public API ==========
export function publicFunction() { ... }

// ========== Private helpers ==========
function privateHelper() { ... }
```

### 4. Обновленный корневой файл

```typescript
// Исходный файл после рефакторинга
import { functionA, functionB } from './modules/module-a';
import { functionC } from './modules/module-b';

// Только orchestration код
export { functionA, functionB, functionC };
```

### 5. План миграции

1. **Подготовка** - создание файлов модулей
2. **Перемещение** - перенос функций без изменения логики
3. **Обновление импортов** - внутри файла
4. **Тестирование** - проверка работоспособности
5. **Удаление старого кода**

---

## ⚠️ Ограничения

- Не изменяй публичное API (экспорты) без необходимости
- Сохраняй типы и интерфейсы там, где они используются
- Добавляй JSDoc для новых публичных функций
- Убедись, что нет циклических импортов между новыми модулями

````

---

## 📊 Пример: Разбиение e-commerce файла

### Исходный монолит (`checkout.ts`)

```typescript
// ===== Корзина =====
export function addToCart(item: Item) { ... }
export function removeFromCart(id: string) { ... }
function calculateSubtotal(items: Item[]) { ... }

// ===== Скидки =====
export function applyCoupon(code: string) { ... }
function calculateDiscount(total: number, coupon: Coupon) { ... }
function validateCoupon(code: string): boolean { ... }

// ===== Доставка =====
export function calculateShipping(items: Item[]) { ... }
function getZoneByAddress(address: Address): Zone { ... }
function getZoneRate(zone: Zone): number { ... }

// ===== Платежи =====
export function processPayment(amount: number) { ... }
function validateCard(card: Card): boolean { ... }
function callPaymentGateway(payment: Payment) { ... }

// ===== UI =====
export function renderCheckout() { ... }
function updateTotalDisplay() { ... }
function showError(message: string) { ... }
````

### Граф зависимостей (`npx @newkind/ast-analyzer file checkout.ts`)

```
addToCart() → calculateSubtotal()
removeFromCart() → calculateSubtotal()
applyCoupon() → calculateDiscount() → validateCoupon()
calculateShipping() → getZoneByAddress() → getZoneRate()
processPayment() → validateCard() → callPaymentGateway()
renderCheckout() → updateTotalDisplay() → calculateSubtotal()
renderCheckout() → showError()
renderCheckout() → calculateShipping()
```

### Результат анализа (кластеры)

| Кластер      | Функции                                          | Причина выделения                    |
| ------------ | ------------------------------------------------ | ------------------------------------ |
| **Cart**     | addToCart, removeFromCart, calculateSubtotal     | Работают с одной сущностью (корзина) |
| **Discount** | applyCoupon, calculateDiscount, validateCoupon   | Цепочка вызовов, общая логика        |
| **Shipping** | calculateShipping, getZoneByAddress, getZoneRate | Изолированная бизнес-логика          |
| **Payment**  | processPayment, validateCard, callPaymentGateway | Внешний сервис, чёткие границы       |
| **UI**       | renderCheckout, updateTotalDisplay, showError    | Презентационный слой                 |

### Предлагаемая структура

```
src/checkout/
├── modules/
│   ├── cart.ts          # Корзина
│   ├── discount.ts      # Скидки и купоны
│   ├── shipping.ts      # Доставка
│   ├── payment.ts       # Платежи
│   └── ui.ts            # UI компоненты
├── types.ts              # Общие типы
└── index.ts              # Точка входа (реэкспорт)
```

---

## 🔧 Утилита для автоматического анализа кластеров

Можно расширить `@newkind/ast-analyzer` новым режимом:

```bash
# Режим 7: cluster - выделение модулей
npx @newkind/ast-analyzer cluster ./src/huge-file.ts
```

**Что делает:**

1. Строит граф внутренних зависимостей
2. Находит сильно связанные компоненты (SCC)
3. Предлагает границы модулей
4. Генерирует структуру модулей

---

## 📝 Итоговая рекомендация

Для разбиения файла на модули используй **трёхшаговый подход**:

```bash
# 1. Визуализация связей (понять структуру)
npx @newkind/ast-analyzer file ./graph-analyzer_work.js
open report.html

# 2. Сжатие для анализа (быстрое понимание)
npx @newkind/ast-analyzer minify ./graph-analyzer_work.js
cat ai-context.txt

# 3. Сборка контекста для ИИ
npx @newkind/ast-analyzer prompt-pack ./graph-analyzer_work.js 0
# Отправь ai-prompt-bundle.md + промпт из этого README
```

**Результат:** ИИ получит полную картину внутренних связей и сможет предложить оптимальное разбиение на модули с сохранением всей функциональности.
