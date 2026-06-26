# 🔧 AST Refactor - Автоматический рефакторинг с выделением модулей

Модуль для автоматического анализа и рефакторинга файлов с выделением связных модулей. Поддерживает JavaScript, TypeScript и Vue компоненты.

## 📦 Установка

```bash
npm install @newkind/ast-analyzer
```

## 🚀 Быстрый старт

### 1. Анализ файла (без изменений)

Перед рефакторингом рекомендуется проанализировать файл:

```bash
npx ast-refactor analyze ./src/my-file.js
```

Результат покажет:

- Найденные кластеры функций
- Связность между функциями
- Рекомендации по разбиению

### 2. Автоматический рефакторинг

```bash
npx ast-refactor refactor ./src/my-file.js
```

### 3. Пробный запуск (dry-run)

```bash
npx ast-refactor refactor ./src/my-file.js --dry-run
```

## 📋 Команды CLI

### `analyze <file>`

Анализирует файл и показывает кластеры без внесения изменений.

**Опции:**

- `-t, --target-size <n>` - целевой размер кластера (по умолчанию: 3)
- `-m, --max-size <n>` - максимальный размер кластера (по умолчанию: 10)
- `-c, --min-cohesion <n>` - минимальная связность % (по умолчанию: 60)

**Пример:**

```bash
npx ast-refactor analyze ./src/utils.js -t 4 -c 70
```

### `refactor <file>`

Выполняет рефакторинг файла с выделением модулей.

**Опции:**

- `-o, --out-dir <dir>` - директория для модулей (по умолчанию: `modules`)
- `-t, --target-size <n>` - целевой размер кластера (по умолчанию: 3)
- `-m, --max-size <n>` - максимальный размер кластера (по умолчанию: 10)
- `-c, --min-cohesion <n>` - минимальная связность % (по умолчанию: 60)
- `-d, --dry-run` - пробный запуск без изменений
- `--no-backup` - не создавать резервную копию
- `--no-vue` - не обновлять template для Vue файлов
- `-v, --verbose` - подробный вывод

**Примеры:**

```bash
# Базовый рефакторинг
npx ast-refactor refactor ./src/huge-component.js

# С пользовательскими параметрами
npx ast-refactor refactor ./src/app.js -o ./src/modules -t 4 -m 12 -c 70

# Только анализ (без изменений)
npx ast-refactor refactor ./src/file.js --dry-run
```

### `restore <backup-file>`

Восстанавливает файл из резервной копии.

**Опции:**

- `-o, --output <file>` - целевой файл для восстановления

**Пример:**

```bash
npx ast-refactor restore ./src/file.js.backup.1703123456789
```

## 💻 Использование в коде

### Базовый пример

```typescript
import { AutoRefactor } from '@newkind/ast-analyzer/refactor';

const refactor = new AutoRefactor({
  modulesDir: 'modules',
  targetClusterSize: 3,
  maxClusterSize: 10,
  minCohesionScore: 60,
  dryRun: false,
  createBackup: true,
  updateTemplate: true,
  verbose: true,
});

const result = await refactor.refactor('./src/my-file.js');

if (result.success) {
  console.log(`✅ Создано модулей: ${result.modules.length}`);
  result.modules.forEach(module => {
    console.log(`   - ${module.name} (${module.exports.length} экспортов)`);
  });
} else {
  console.error(`❌ Ошибка: ${result.error}`);
}
```

### Расширенная конфигурация

```typescript
import { AutoRefactor } from '@newkind/ast-analyzer/refactor';

// Для JavaScript файлов
const jsRefactor = new AutoRefactor({
  modulesDir: './src/modules',
  targetClusterSize: 4,
  maxClusterSize: 15,
  minCohesionScore: 65,
  createBackup: true,
});

// Для Vue компонентов (обновит и template)
const vueRefactor = new AutoRefactor({
  modulesDir: './src/components/modules',
  targetClusterSize: 3,
  maxClusterSize: 10,
  minCohesionScore: 60,
  updateTemplate: true, // Обновит ссылки в template
  createBackup: true,
});

const result = await vueRefactor.refactor('./src/App.vue');
```

## 🎯 Как это работает

### Алгоритм рефакторинга

1. **Анализ зависимостей**

- Построение графа вызовов внутри файла
- Выявление связей между функциями/классами

2. **Кластеризация**

- Обнаружение сильно связанных компонентов
- Расчет связности (cohesion score)
- Фильтрация по минимальной связности

3. **Создание модулей**

- Создание новых файлов в директории `modules/`
- Перенос кода с добавлением `export`
- Обновление импортов в исходном файле

4. **Для Vue компонентов (дополнительно)**

- Обновление template ссылок
- Обновление script импортов
- Сохранение стилей

### Параметры кластеризации

| Параметр            | Описание                     | По умолчанию |
| ------------------- | ---------------------------- | ------------ |
| `targetClusterSize` | Желаемый размер кластера     | 3            |
| `maxClusterSize`    | Максимальный размер кластера | 10           |
| `minCohesionScore`  | Минимальная связность в %    | 60           |

### Связность (Cohesion Score)

Связность рассчитывается как отношение внутренних вызовов к максимально возможным:

```
cohesion = (internal_calls / max_possible_calls) * 100%
```

- **> 70%** - отличная связность
- **50-70%** - хорошая связность
- **< 50%** - низкая связность (не рекомендуется выделять)

## 📁 Структура после рефакторинга

### Для JavaScript/TypeScript файлов

```
src/
├── my-file.js           # Исходный файл (обновлён)
├── modules/             # Директория с модулями
│   ├── calculate-module.js
│   ├── validate-module.js
│   └── format-module.js
└── my-file.js.backup.1703123456789  # Резервная копия
```

### Для Vue компонентов

```
src/
├── App.vue              # Исходный компонент (обновлён)
├── modules/             # Директория с модулями
│   ├── useAuth-module.ts
│   ├── useFetch-module.ts
│   └── utils-module.ts
└── App.vue.backup.1703123456789      # Резервная копия
```

## 🔒 Безопасность

### Резервные копии

- Автоматически создаётся бэкап перед изменениями
- Формат: `{filename}.backup.{timestamp}`
- Восстановление: `ast-refactor restore {backup-file}`

### Dry-run режим

```bash
npx ast-refactor refactor ./src/file.js --dry-run
```

- Показывает, какие изменения будут сделаны
- Не изменяет файлы
- Полезен для проверки перед реальным запуском

### Восстановление после ошибки

```bash
# Найти бэкап
ls -la src/*.backup.*

# Восстановить
npx ast-refactor restore src/my-file.js.backup.1703123456789

# Или указать другой файл
npx ast-refactor restore backup.js -o src/restored.js
```

## 📊 Примеры

### Пример 1: Рефакторинг утилит

**Исходный файл `utils.js`:**

```javascript
function formatDate(date) {
  return date.toISOString();
}

function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

function validateEmail(email) {
  return email.includes('@');
}

function validatePhone(phone) {
  return phone.length === 10;
}

function processUser(user) {
  const formattedDate = formatDate(user.createdAt);
  const isValid = validateEmail(user.email);
  return { formattedDate, isValid };
}

export { formatDate, formatCurrency, validateEmail, validatePhone, processUser };
```

**Команда:**

```bash
npx ast-refactor refactor utils.js -t 2
```

**Результат:**

```
✅ Создано модулей: 3
   - format-module (2 экспортов)
   - validate-module (2 экспортов)
   - process-user-module (1 экспортов)
```

### Пример 2: Vue компонент

**Команда:**

```bash
npx ast-refactor refactor ./src/UserProfile.vue -o ./src/composables
```

**Результат:**

```
📊 Найдено кластеров: 2
   1. useAuthModule: [useAuth, checkPermission, hasRole] (связность: 85%)
   2. useFetchModule: [useFetch, cacheData, invalidateCache] (связность: 75%)

✅ Рефакторинг завершён!
📁 Создано модулей: 2
   - use-auth-module.ts (3 экспортов)
   - use-fetch-module.ts (3 экспортов)
💾 Бэкап: ./src/UserProfile.vue.backup.1703123456789
```

### Пример 3: Интеграция в CI/CD

```bash
#!/bin/bash
# .github/scripts/refactor.sh

# Анализ перед коммитом
npx ast-refactor analyze ./src/complex.js || exit 1

# Пробный рефакторинг
npx ast-refactor refactor ./src/complex.js --dry-run

# Если всё ок - реальный рефакторинг
if [ "$CI" = "true" ]; then
    npx ast-refactor refactor ./src/complex.js --no-backup
    npm run test
fi
```

## 🐛 Устранение проблем

### Проблема: Низкая связность кластеров

**Решение:** Уменьшите `minCohesionScore`:

```bash
npx ast-refactor refactor file.js -c 40
```

### Проблема: Слишком много мелких модулей

**Решение:** Увеличьте `targetClusterSize`:

```bash
npx ast-refactor refactor file.js -t 5 -m 15
```

### Проблема: Vue template не обновился

**Решение:** Проверьте флаг `--update-template`:

```bash
npx ast-refactor refactor Component.vue --update-template
```

### Проблема: Ошибка парсинга

**Решение:** Проверьте синтаксис файла:

```bash
# Проверить синтаксис
node --check file.js

# Для TypeScript
npx tsc --noEmit file.ts
```

## 📝 Советы

1. **Всегда начинайте с анализа:**

   ```bash
   npx ast-refactor analyze file.js
   ```

2. **Используйте dry-run перед реальным рефакторингом:**

   ```bash
   npx ast-refactor refactor file.js --dry-run
   ```

3. **Храните бэкапы до успешного тестирования:**

   ```bash
   npx ast-refactor refactor file.js  # создаст бэкап
   npm run test                        # запустить тесты
   rm file.js.backup.*                 # удалить бэкап после тестов
   ```

4. **Для Vue компонентов проверяйте template:**

   ```bash
   npx ast-refactor refactor Component.vue --verbose
   ```

5. **Постепенный рефакторинг:**

   ```bash
   # Сначала более крупные кластеры
   npx ast-refactor refactor file.js -t 5 -c 80

   # Затем более мелкие
   npx ast-refactor refactor file.js -t 3 -c 60
   ```

## 🔗 Связанные модули

- `@newkind/ast-analyzer` - основной пакет для анализа AST
- `split-module` - режим разбиения файла на модули
- `vue-analyzer` - анализ Vue компонентов

## 📄 Лицензия

MIT © Zababurin Sergei
