# AST Analyzer - AI Toolkit for Code Analysis

<div align="center">

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6)](https://www.typescriptlang.org/)
[![Vue](https://img.shields.io/badge/Vue-3.0+-42b883)](https://vuejs.org/)

**Инструмент статического анализа кода для оптимизации взаимодействия с ИИ**

[Установка](#-установка) • [Режимы работы](#-режимы-работы) • [Примеры](#-примеры-использования) • [Промпты для ИИ](#-промпты-для-ии)

</div>

---

## 📋 Оглавление

- [Описание](#-описание)
- [Установка](#-установка)
- [Быстрый старт](#-быстрый-старт)
- [Режимы работы](#-режимы-работы)
  - [1. project - Граф зависимостей проекта](#1-project---граф-зависимостей-проекта)
  - [2. file - Внутренний граф файла](#2-file---внутренний-граф-файла)
  - [3. minify - Сжатие одного файла](#3-minify---сжатие-одного-файла)
  - [4. minify-folder - Рекурсивное сжатие проекта](#4-minify-folder---рекурсивное-сжатие-проекта)
  - [5. prompt-pack - Сборка контекста для ИИ](#5-prompt-pack---сборка-контекста-для-ии)
  - [6. split-module - Разбиение файла на модули](#6-split-module---разбиение-файла-на-модули)
  - [7. impact - Анализ зоны влияния](#7-impact---анализ-зоны-влияния)
  - [8. dead-code - Поиск мертвого кода](#8-dead-code---поиск-мертвого-кода)
  - [9. vue-analyze - Анализ Vue компонентов](#9-vue-analyze---анализ-vue-компонентов)
- [Примеры использования](#-примеры-использования)
- [Промпты для ИИ](#-промпты-для-ии)
- [Структура выходных файлов](#-структура-выходных-файлов)
- [Советы и рекомендации](#-советы-и-рекомендации)
- [Лицензия](#-лицензия)

---

## 🎯 Описание

**AST Analyzer** — это мощный инструмент статического анализа кода, специально разработанный для оптимизации взаимодействия с большими языковыми моделями (ChatGPT, Claude, Gemini и др.).

### Ключевые возможности

| Возможность            | Описание                                 | Экономия                  |
| ---------------------- | ---------------------------------------- | ------------------------- |
| 🔍 **AST-парсинг**     | Глубокий анализ структуры кода           | -                         |
| ✂️ **Сжатие кода**     | Удаление реализации, сохранение сигнатур | до **90%** токенов        |
| 📁 **minify-folder**   | Рекурсивное сжатие всего проекта         | до **85%** размера        |
| 🔪 **split-module**    | Анализ для разбиения файла на модули     | подготовка к рефакторингу |
| 🎒 **Smart-контекст**  | Автоматический сбор связанных файлов     | до **70%** контекста      |
| 💥 **Impact Analysis** | Оценка последствий изменений             | время анализа             |
| 🗑️ **Dead Code**       | Поиск неиспользуемого кода               | чистота кода              |
| 📊 **Визуализация**    | Интерактивные графы зависимостей         | понимание архитектуры     |
| 🎯 **Vue Analysis**    | Глубокий анализ Vue компонентов          | оптимизация Vue-проектов  |

### Поддерживаемые форматы

- ✅ **JavaScript** (.js, .mjs, .cjs)
- ✅ **TypeScript** (.ts, .tsx)
- ✅ **Vue.js** (.vue) - полный анализ SFC
- ✅ **JSX** (.jsx)

---

## 📦 Установка

### Предварительные требования

```bash
# Node.js версии 18 или выше
node --version

# Graphviz (для визуализации графов)
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows
# Скачайте с https://graphviz.org/download/
```

### Установка пакета

```bash
# Локальная установка в проект
npm install @newkind/ast-analyzer

# Глобальная установка
npm install -g @newkind/ast-analyzer

# Или использование без установки через npx
npx @newkind/ast-analyzer --help
```

### Проверка работы

```bash
# Локальная установка
npx @newkind/ast-analyzer --help

# Глобальная установка
ast-analyzer --help

# Режим разработки (из исходников)
npm run dev -- --help
```

---

## 🚀 Быстрый старт

```bash
# 1. Разбить монолитный файл на модули
npx @newkind/ast-analyzer split-module ./src/monolith.js

# 2. Сжать весь проект для отправки ИИ
npx @newkind/ast-analyzer minify-folder ./src

# 3. Сжать один файл
npx @newkind/ast-analyzer minify ./src/component.js

# 4. Собрать контекст для задачи
npx @newkind/ast-analyzer prompt-pack ./src/main.js 2

# 5. Проверить влияние изменений
npx @newkind/ast-analyzer impact ./src/utils.js calculateTotal

# 6. Найти мертвый код
npx @newkind/ast-analyzer dead-code ./src/legacy.js

# 7. Проанализировать Vue компонент
npx @newkind/ast-analyzer vue-analyze ./src/components/App.vue

# 8. Визуализировать архитектуру
npx @newkind/ast-analyzer project ./src/index.js 3
# Открыть report.html в браузере
```

---

## 📖 Режимы работы

### 1. project - Граф зависимостей проекта

**Назначение:** Построение интерактивной карты зависимостей всего проекта от корневого файла.

**Последовательность шагов:**

1. Парсит указанный входной файл в AST
2. Рекурсивно обходит все импорты (import/require)
3. Резолвит пути к файлам с учетом расширений (.js, .ts, .vue и др.)
4. Строит граф зависимостей в формате ключ-значение
5. Находит циклические зависимости алгоритмом DFS
6. Генерирует DOT-код для Graphviz
7. Компилирует SVG через WebAssembly Graphviz
8. Создает интерактивный HTML-отчет с панорамированием и масштабированием

**Выходные файлы:**

- `report.html` - Интерактивный граф с возможностью zoom/pan
- `output.svg` - Векторный граф зависимостей
- `output.json` - Структура графа в JSON
- `output.dot` - Исходный код на языке DOT

**Команда:**

```bash
npx @newkind/ast-analyzer project <путь_к_файлу> [глубина]
```

**Примеры:**

```bash
# Полный граф (все зависимости)
npx @newkind/ast-analyzer project ./src/index.js

# Ограничение глубиной 2 уровня
npx @newkind/ast-analyzer project ./src/index.js 2

# С указанием tsconfig для алиасов
npx @newkind/ast-analyzer project ./src/index.ts --tsconfig ./tsconfig.json
```

---

### 2. file - Внутренний граф файла

**Назначение:** Анализ внутренних связей внутри одного файла.

**Последовательность шагов:**

1. Парсит файл в AST
2. Собирает все объявления функций, классов, переменных
3. Анализирует идентификаторы внутри функций
4. Строит граф вызовов между локальными сущностями
5. Визуализирует внутренние связи

**Команда:**

```bash
npx @newkind/ast-analyzer file <путь_к_файлу>
```

**Пример:**

```bash
npx @newkind/ast-analyzer file ./src/services/api.js
```

---

### 3. minify - Сжатие одного файла

**Назначение:** Максимальное сжатие одного файла для отправки в ИИ.

**Что удаляется:**

- ❌ Тела функций (остаются сигнатуры)
- ❌ Логика вычислений
- ❌ Циклы и условия
- ❌ Внутренние переменные

**Что сохраняется:**

- ✅ Импорты/экспорты
- ✅ Сигнатуры функций
- ✅ JSDoc комментарии
- ✅ TypeScript интерфейсы

**Команда:**

```bash
npx @newkind/ast-analyzer minify <путь_к_файлу>
```

**Выход:** `ai-context.txt`

**Пример:**

```bash
npx @newkind/ast-analyzer minify ./src/components/UserProfile.tsx
```

---

### 4. minify-folder - Рекурсивное сжатие проекта

**Назначение:** Рекурсивная минификация всех файлов в каталоге с сохранением структуры.

**Последовательность шагов:**

1. Рекурсивно обходит указанную директорию
2. Фильтрует файлы по расширениям (.js, .ts, .vue и др.)
3. Исключает стандартные директории (node_modules, .git, dist)
4. Для каждого найденного файла выполняет минификацию
5. Собирает статистику по исходному и сжатому размеру
6. Генерирует Markdown-отчет с:

- Системным промптом для ИИ
- Оглавлением со ссылками на файлы
- Древовидной структурой каталогов
- Сжатым содержимым каждого файла
- Таблицей статистики сжатия

7. Сохраняет результат в выходной файл

**Команда:**

```bash
npx @newkind/ast-analyzer minify-folder <путь_к_каталогу> [опции]
```

**Опции:**

| Опция            | Сокращение | Описание                         | По умолчанию                       |
| ---------------- | ---------- | -------------------------------- | ---------------------------------- |
| `--output`       | `-o`       | Выходной файл                    | `ai-project-context.md`            |
| `--depth`        | `-d`       | Глубина рекурсии                 | `10`                               |
| `--extensions`   | `-e`       | Расширения через запятую         | `.js,.ts,.tsx,.jsx,.vue,.mjs,.cjs` |
| `--exclude`      | `-x`       | Паттерны для исключения          | `node_modules,.git,dist,build,...` |
| `--no-structure` | -          | Не показывать структуру каталога | `false`                            |
| `--no-toc`       | -          | Не показывать оглавление         | `false`                            |

**Примеры:**

```bash
# Базовое использование
npx @newkind/ast-analyzer minify-folder ./src

# С кастомным выходным файлом
npx @newkind/ast-analyzer minify-folder ./src -o docs/project-context.md

# Ограничение глубины
npx @newkind/ast-analyzer minify-folder ./src -d 2

# Только JS и TS файлы
npx @newkind/ast-analyzer minify-folder ./src -e .js,.ts
```

---

### 5. prompt-pack - Сборка контекста для ИИ

**Назначение:** Автоматическая сборка оптимального контекста для передачи ИИ при работе над конкретным файлом.

**Последовательность шагов:**

1. Строит граф зависимостей от целевого файла на заданную глубину
2. Собирает множество всех связанных файлов
3. Целевой файл включает **полностью** (без сжатия)
4. Каждый файл зависимости пропускает через минификацию
5. Генерирует Markdown с системным промптом
6. Добавляет инструкцию для ИИ
7. Сохраняет результат в выходной файл

**Команда:**

```bash
npx @newkind/ast-analyzer prompt-pack <путь_к_файлу> [глубина]
```

**Выход:** `ai-prompt-bundle.md`

**Пример:**

```bash
npx @newkind/ast-analyzer prompt-pack ./src/checkout/OrderService.ts 2
```

---

### 6. split-module - Разбиение файла на модули ⭐

**Назначение:** Глубокий анализ файла для подготовки к разбиению на логически связанные модули. Идеально для рефакторинга монолитных файлов.

**Последовательность шагов:**

1. **Парсинг и анализ AST**

- Разбирает файл в абстрактное синтаксическое дерево
- Извлекает все импорты с их спецификаторами
- Собирает все экспорты (named, default)
- Находит функции, классы, константы, интерфейсы, типы

2. **Построение графа вызовов (Call Graph)**

- Отслеживает контекст текущей функции
- Анализирует все вызовы функций внутри каждой функции
- Строит карту: функция → [вызываемые функции]

3. **Идентификация кластеров**

- Выполняет поиск сильно связанных компонентов
- Группирует функции, которые часто вызывают друг друга
- Определяет тип каждого кластера (core/helper)
- Вычисляет размер и зависимости кластеров

4. **Статистический анализ**

- Подсчитывает общее количество строк
- Собирает статистику по экспортам, функциям, классам
- Анализирует интерфейсы и типы

5. **Поиск циклических зависимостей**

- Строит граф внутренних зависимостей
- Выполняет поиск циклов алгоритмом DFS
- Отмечает проблемные связи

6. **Генерация предложений по структуре**

- На основе кластеров предлагает имена модулей
- Формирует рекомендуемую структуру каталогов
- Определяет, какие сущности в какой модуль перенести

7. **Создание выходных данных**

- Генерирует основной промпт для ИИ (Markdown)
- Сохраняет сжатую версию файла
- Экспортирует граф вызовов в JSON
- Сохраняет структурный анализ в JSON

**Команда:**

```bash
npx @newkind/ast-analyzer split-module <путь_к_файлу> [опции]
```

**Опции:**

| Опция                       | Описание                     | По умолчанию                |
| --------------------------- | ---------------------------- | --------------------------- |
| `--output, -o`              | Выходной файл промпта        | `ai-split-module-prompt.md` |
| `--target-cluster-size, -t` | Желаемый размер кластера     | `3`                         |
| `--max-cluster-size, -m`    | Максимальный размер кластера | `10`                        |
| `--max-depth, -d`           | Глубина анализа              | `5`                         |
| `--exclude, -x`             | Паттерны исключения          | `node_modules,.git,...`     |
| `--prefix, -p`              | Префикс для выходных файлов  | `''`                        |
| `--no-full-code`            | Не включать полный код файла | `false`                     |
| `--no-minified`             | Не включать сжатую версию    | `false`                     |
| `--no-graph`                | Не включать граф вызовов     | `false`                     |
| `--no-stats`                | Не включать статистику       | `false`                     |
| `--no-suggestions`          | Не включать предложения      | `false`                     |

**Примеры:**

```bash
# Полный анализ для разбиения
npx @newkind/ast-analyzer split-module ./src/monolith.js

# С кастомным выходным файлом
npx @newkind/ast-analyzer split-module ./src/app.ts -o split-prompt.md

# Минимальный анализ (только статистика и предложения)
npx @newkind/ast-analyzer split-module ./src/component.jsx --no-full-code --no-minified --no-graph

# С указанием tsconfig для алиасов
npx @newkind/ast-analyzer split-module ./src/app.ts --tsconfig ./tsconfig.json
```

**Выходные файлы:**

| Файл                        | Описание                                         |
| --------------------------- | ------------------------------------------------ |
| `ai-split-module-prompt.md` | **Главный промпт** для отправки ИИ               |
| `ai-context.txt`            | Сжатая версия файла (только сигнатуры)           |
| `internal-graph.json`       | Граф вызовов между функциями                     |
| `module-analysis.json`      | Структурный анализ (кластеры, экспорты, функции) |

---

### 7. impact - Анализ зоны влияния

**Назначение:** Оценка того, какие файлы и функции будут затронуты при изменении сущности.

**Последовательность шагов:**

1. Сканирует все файлы проекта (рекурсивно)
2. Для каждого файла парсит AST
3. Ищет импорты целевого файла
4. Проверяет, импортируется ли указанная сущность
5. Отслеживает локальное имя импорта (с учетом алиасов)
6. Анализирует использование идентификатора в коде
7. Определяет контекст использования (какая функция вызывает)
8. Формирует отчет со списком всех использований

**Команда:**

```bash
npx @newkind/ast-analyzer impact <путь_к_файлу> <имя_сущности>
```

**Выход:** `ai-impact-report.md`

**Пример:**

```bash
npx @newkind/ast-analyzer impact ./src/database/queries.ts findUserById
```

---

### 8. dead-code - Поиск мертвого кода

**Назначение:** Выявление неиспользуемого кода для безопасного удаления.

**Последовательность шагов:**

**Локальный анализ (внутри файла):**

1. Парсит файл в AST
2. Собирает все объявления (функции, переменные, классы)
3. Разделяет на экспортируемые и локальные
4. Собирает все использованные идентификаторы
5. Находит локальные сущности, не использованные в файле

**Глобальный анализ (по проекту):**

1. Для каждого экспорта проверяет все файлы проекта
2. Ищет импорты этой сущности в других файлах
3. Если импортов нет — помечает как бесполезный экспорт

**Команда:**

```bash
npx @newkind/ast-analyzer dead-code <путь_к_файлу>
```

**Выход:** `ai-dead-code-report.md`

**Пример:**

```bash
npx @newkind/ast-analyzer dead-code ./src/legacy/utils.ts
```

---

### 9. vue-analyze - Анализ Vue компонентов 🎯 НОВЫЙ РЕЖИМ

**Назначение:** Глубокий анализ Vue Single-File Components (SFC) для понимания структуры, связей и возможностей рефакторинга.

**Анализируемые данные:**

- 📥 **Props** - имена, типы, обязательность, значения по умолчанию
- 📤 **Events (emits)** - имена событий и их типы
- 🎭 **Slots** - именованные слоты
- 🧩 **Composables** - вызовы use\* функций
- 📦 **Imports** - внешние и внутренние зависимости
- 🏗️ **Template** - сложность, корневые элементы, директивы, события
- 🔓 **Exposed API** - публичные методы через defineExpose
- 📊 **Статистика** - количество строк в script/template, блоки стилей

**Команда:**

```bash
npx @newkind/ast-analyzer vue-analyze <путь_к_vue_файлу> [опции]
# или короткая форма
npx @newkind/ast-analyzer vue <путь_к_vue_файлу> [опции]
```

**Опции:**

| Опция               | Описание                     | По умолчанию |
| ------------------- | ---------------------------- | ------------ |
| `--no-template-ast` | Не анализировать AST шаблона | `false`      |
| `--no-script-ast`   | Не анализировать AST скрипта | `false`      |
| `--no-composables`  | Не искать вызовы композаблов | `false`      |

**Выходные файлы:**

- `vue-analysis.json` - полные данные анализа в JSON
- `vue-analysis.md` - читаемый Markdown отчет

**Примеры:**

```bash
# Базовый анализ компонента
npx @newkind/ast-analyzer vue-analyze ./src/components/UserProfile.vue

# Анализ с отключением анализа шаблона (быстрее)
npx @newkind/ast-analyzer vue ./src/components/DataTable.vue --no-template-ast

# Короткая форма
npx @newkind/ast-analyzer vue ./src/App.vue

# С указанием tsconfig для алиасов
npx @newkind/ast-analyzer vue-analyze ./src/components/Form.vue --tsconfig ./tsconfig.json
```

**Пример отчета:**

```markdown
# 🎯 Анализ Vue компонента: UserProfile

## 📊 Статистика

- **Размер файла:** 12.34 KB
- **Скрипт:** 156 строк (setup)
- **Шаблон:** 45 строк
- **Стили:** 2 блоков
- **TypeScript:** ✅

## 📥 Props (3)

| Имя          | Тип       | Обязательный | По умолчанию |
| ------------ | --------- | ------------ | ------------ |
| `userId`     | `number`  | ✅           | -            |
| `title`      | `string`  | ✅           | -            |
| `showAvatar` | `boolean` | ❌           | true         |

## 📤 Events (2)

- **update** : `value`
- **close**

## 🧩 Composables (2)

- `useAuth` → переменная `auth`
- `useFetch` → переменная `data`

## 🏗️ Шаблон

- **Сложность:** 24 элементов
- **Корневые элементы:** div
- **Директивы:** v-if, v-for
- **События:** click, change

## 💡 Рекомендации

⚠️ **Скрипт слишком большой** (156 строк). Разбейте на несколько composables.
```

---

## 💡 Примеры использования

### Сценарий 1: Разбиение монолитного файла

```bash
# 1. Анализируем файл
npx @newkind/ast-analyzer split-module ./src/monolith.js

# 2. Открываем ai-split-module-prompt.md
#    Видим: статистику, кластеры функций, граф вызовов

# 3. Отправляем промпт в ИИ
#    ИИ предлагает структуру модулей и код

# 4. Внедряем предложенную структуру
```

### Сценарий 2: Подготовка всего проекта для ИИ

```bash
# Минифицируем весь проект
npx @newkind/ast-analyzer minify-folder ./src -o ai-full-context.md

# Отправляем ai-full-context.md в ИИ
# ИИ получает полную картину архитектуры за 15% от исходного размера!
```

### Сценарий 3: Быстрый вопрос о конкретном файле

```bash
# Сжать один файл
npx @newkind/ast-analyzer minify ./src/complex/Component.jsx

# Отправить ai-context.txt в ИИ с вопросом
```

### Сценарий 4: Подготовка задачи для ИИ

```bash
# Собрать контекст для файла, который нужно изменить
npx @newkind/ast-analyzer prompt-pack ./src/features/payment.js 2

# Загрузить ai-prompt-bundle.md в ChatGPT/Claude
```

### Сценарий 5: Безопасный рефакторинг

```bash
# Перед удалением функции проверить влияние
npx @newkind/ast-analyzer impact ./src/old/api.js deprecatedMethod

# Если отчет пуст - можно удалять
```

### Сценарий 6: Очистка легаси кода

```bash
# Найти мертвый код
npx @newkind/ast-analyzer dead-code ./src/legacy/module.js

# Почистить по отчету
```

### Сценарий 7: Анализ архитектуры

```bash
# Построить граф зависимостей
npx @newkind/ast-analyzer project ./src/main.js 2

# Открыть report.html в браузере
# Изучить визуализацию связей
```

### Сценарий 8: Анализ Vue компонента

```bash
# Глубокий анализ Vue компонента
npx @newkind/ast-analyzer vue-analyze ./src/components/Dashboard.vue

# Получаем JSON и MD отчеты
# Понимаем структуру props, events, composables
```

---

## 🤖 Промпты для ИИ

### Для режима split-module

```markdown
## 📋 Инструкция для ИИ

Я загружаю файл с анализом монолитного модуля для разбиения.

**В файле содержится:**

- Полная статистика файла (строки, функции, экспорты)
- Список всех экспортируемых сущностей
- Граф вызовов между функциями
- Выявленные кластеры (кандидаты в модули)
- Полный код файла
- Сжатая версия (только сигнатуры)

**Задача:** Разбей этот монолитный файл на логически связанные модули.

**Требования:**

1. Используй выявленные кластеры как основу для модулей
2. Каждый модуль должен иметь одно чёткое назначение
3. Устрани циклические зависимости (если есть)
4. Сохрани все экспорты, обновив импорты
5. Добавь корневой файл index.ts для реэкспорта

**Ожидаемый ответ:**

1. Предлагаемая структура каталогов
2. Код каждого нового модуля
3. Обновленный корневой файл
4. План миграции
```

### Для режима vue-analyze

```markdown
## 📋 Инструкция для ИИ

Я загружаю анализ Vue компонента.

**Данные содержат:**

- Все props с типами и значениями по умолчанию
- Все events (emits)
- Используемые composables
- Импорты и зависимости
- Структуру шаблона

**Задача:** Проанализируй компонент и предложи улучшения.

**Вопросы для анализа:**

1. Нет ли избыточной сложности в шаблоне?
2. Можно ли вынести часть логики в composables?
3. Правильно ли типизированы props и events?
4. Нет ли проблем с производительностью?
```

---

## 📁 Структура выходных файлов

```
project/
├── Визуализация (project/file):
├── report.html                          # Интерактивный граф
├── output.svg                           # Векторный граф
├── output.json                          # JSON структура
├── output.dot                           # DOT код
│
├── Сжатие (minify):
├── ai-context.txt                       # Сжатый один файл
│
├── Рекурсивное сжатие (minify-folder):
├── ai-project-context.md                # Весь проект в сжатом виде
│
├── Контекст (prompt-pack):
├── ai-prompt-bundle.md                  # Контекст для ИИ
│
├── Разбиение модулей (split-module):
├── ai-split-module-prompt.md            # Главный промпт для ИИ
├── internal-graph.json                  # Граф вызовов
├── module-analysis.json                 # Структурный анализ
│
├── Vue анализ (vue-analyze):
├── vue-analysis.json                    # Полные данные анализа
├── vue-analysis.md                      # Markdown отчет
│
├── Анализ (impact):
├── ai-impact-report.md                  # Отчет о влиянии
│
└── Очистка (dead-code):
└── ai-dead-code-report.md               # Отчет о мертвом коде
```

---

## 📊 Сравнение режимов

| Режим           | Файлов              | Сжатие | Выход         | Когда использовать            |
| --------------- | ------------------- | ------ | ------------- | ----------------------------- |
| `project`       | Все зависимости     | -      | HTML/JSON/SVG | Визуализация архитектуры      |
| `file`          | 1                   | -      | HTML/JSON/SVG | Анализ внутренних связей      |
| `minify`        | 1                   | 70-90% | TXT           | Быстрый вопрос о файле        |
| `minify-folder` | Весь проект         | 80-90% | MD            | Полный анализ архитектуры     |
| `prompt-pack`   | Файл + зависимости  | 60-80% | MD            | Изменение конкретного файла   |
| `split-module`  | 1 (глубокий анализ) | -      | MD + JSON     | **Разбиение на модули** ⭐    |
| `vue-analyze`   | 1 (Vue SFC)         | -      | MD + JSON     | **Анализ Vue компонентов** 🎯 |
| `impact`        | Весь проект         | -      | MD            | Оценка влияния изменений      |
| `dead-code`     | 1 + проект          | -      | MD            | Поиск неиспользуемого кода    |

---

## 💡 Советы и рекомендации

### 1. Для разбиения монолита (split-module)

```bash
# 1. Запустите анализ
npx @newkind/ast-analyzer split-module ./src/monolith.js

# 2. Изучите выявленные кластеры в module-analysis.json
# 3. Отправьте ai-split-module-prompt.md в ИИ
# 4. Получите готовую структуру модулей
# 5. Внедряйте изменения по плану миграции
```

### 2. Для анализа Vue проектов

```bash
# 1. Проанализируйте корневой компонент
npx @newkind/ast-analyzer vue-analyze ./src/App.vue

# 2. Изучите отчет vue-analysis.md
# 3. Выявите проблемные места
# 4. Оптимизируйте компоненты
```

### 3. Экономия токенов

```bash
# Вместо отправки 50MB папки
du -sh ./src  # 50MB

# Получаем 5MB сжатого контекста
npx @newkind/ast-analyzer minify-folder ./src -o context.md
ls -lh context.md  # 5MB (экономия 90%!)
```

### 4. Выбор глубины

```bash
# Глубина 2 - основные модули (быстро)
npx @newkind/ast-analyzer minify-folder ./src -d 2

# Глубина 5 - большинство файлов (баланс)
npx @newkind/ast-analyzer minify-folder ./src -d 5
```

### 5. Интеграция в CI/CD

```yaml
# .github/workflows/analyze.yml
name: Code Analysis
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npx @newkind/ast-analyzer impact ./src/changed.ts functionName
      - run: cat ai-impact-report.md >> $GITHUB_STEP_SUMMARY
```

### 6. Работа с TypeScript и алиасами

```bash
# Укажите путь к tsconfig.json для корректного разрешения алиасов
npx @newkind/ast-analyzer project ./src/index.ts --tsconfig ./tsconfig.json
npx @newkind/ast-analyzer split-module ./src/app.ts --tsconfig ./tsconfig.json
npx @newkind/ast-analyzer vue-analyze ./src/App.vue --tsconfig ./tsconfig.json
```

### 7. Лучшие практики

- ✅ **Для рефакторинга монолита** используйте `split-module`
- ✅ **Для архитектурных вопросов** используйте `minify-folder`
- ✅ **Для точечных правок** используйте `prompt-pack`
- ✅ **Для Vue компонентов** используйте `vue-analyze`
- ✅ **Для быстрых вопросов** используйте `minify`
- ✅ **Перед удалением кода** всегда запускайте `impact`
- ✅ **Периодически** запускайте `dead-code` для чистоты
- ❌ Не отправляйте полные проекты без сжатия
- ❌ Не удаляйте экспорты без `impact` анализа

---

## 🛠️ API Reference

### Основные экспорты

```typescript
// Core
export { parseFile, isExternalModule, resolveFilePath, getAllProjectFiles, walk };
export { minifyCodeString, minifyForAI };
export { findCyclicEdges, convertToDOT, dfs };
export { setTsConfigPath, loadTsConfig, resolveAliasPath };

// Modes
export { buildProjectGraph } from './modes/project-graph.js';
export { buildFileInternalGraph } from './modes/file-graph.js';
export { minifyFile } from './modes/minify-file.js';
export { minifyFolder, generateDirectoryTree, collectFiles } from './modes/minify-folder.js';
export { buildAiPromptPack } from './modes/prompt-pack.js';
export {
  buildSplitModulePrompt,
  analyzeModuleStructure,
  identifyClusters,
} from './modes/split-module.js';
export { runImpactAnalysis } from './modes/impact.js';
export { findDeadCode } from './modes/dead-code.js';

// Vue analysis (NEW!)
export { parseVueFile, analyzeVueComponent, generateVueComponentReport, enhanceWithVueAnalysis };

// Reporters
export { generateHTMLReport, escapeHtml };

// Utils
export { showHelp, renderNode };
```

### Использование в коде

```typescript
import { buildProjectGraph, minifyForAI, analyzeVueComponent } from '@newkind/ast-analyzer';

// Построение графа зависимостей
const graph = buildProjectGraph('./src/index.ts', 3);
console.log(graph.graph);

// Минификация файла
const minified = minifyForAI('./src/component.ts');
console.log(minified);

// Анализ Vue компонента
const vueAnalysis = analyzeVueComponent('./src/App.vue');
console.log(vueAnalysis.props.names);
```

---

## 📄 Лицензия

**MIT License**

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## 👤 Контакты

**Автор:** Забабурин Сергей
**Email:** zababurins@vk.com
**GitHub:** [ZababurinSergei/ast-analyzer](https://github.com/ZababurinSergei/ast-analyzer)
**npm:** [@newkind/ast-analyzer](https://www.npmjs.com/package/@newkind/ast-analyzer)

---

<div align="center">

**⭐ Если этот инструмент помог вам в работе с ИИ, поставьте звезду на GitHub!**

[← Наверх](#-ast-analyzer---ai-toolkit-for-code-analysis)

</div>
