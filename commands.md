# AST Analyzer - Полный справочник команд

## 📋 Содержание

1. [Конфигурация и переменные](#конфигурация)
2. [Режимы CLI.js](#режимы-clijs)
3. [Режимы CLI-Refactor.js](#режимы-cli-refactorjs)
4. [Восстановление из бэкапа](#восстановление)
5. [Алиасы](#алиасы)

---

## 🔧 Конфигурация и переменные {#конфигурация}

```bash
#!/bin/bash

# Базовые пути
BASE_DIR="/home/sergei/Desktop/system"
DIST_DIR="$BASE_DIR/packages/ast-analyzer/dist"
CLI_JS="$DIST_DIR/cli.js"
CLI_REFACTOR="$DIST_DIR/cli-refactor.js"

# Целевые файлы
TARGET_FILE="$BASE_DIR/FileSystemScanner.js"
VUE_FILE="$BASE_DIR/packages/ast-analyzer/src/__tests__/fixtures/SetupComponent.vue"

# Директории
MODULES_DIR="$BASE_DIR/packages/11/deepseek/modules"
OUTPUT_DIR="$BASE_DIR/refactor-output"

mkdir -p "$OUTPUT_DIR"
```

---

## 🚀 Режимы CLI.js {#режимы-clijs}

### 1.1 project - граф зависимостей проекта

```bash
node "$CLI_JS" project "$TARGET_FILE" 3 -o "$OUTPUT_DIR"
```

### 1.2 file - внутренний граф файла

```bash
node "$CLI_JS" file "$TARGET_FILE" -o "$OUTPUT_DIR"
```

### 1.3 minify - сжатие одного файла

```bash
node "$CLI_JS" minify "$TARGET_FILE" -o "$OUTPUT_DIR"
```

### 1.4 minify-folder - рекурсивное сжатие папки

```bash
node "$CLI_JS" minify-folder "$BASE_DIR/Directory/11" -d 2 -o "$OUTPUT_DIR/project-context.md"
```

### 1.5 prompt-pack - сборка контекста для ИИ

```bash
node "$CLI_JS" prompt-pack "$TARGET_FILE" 2 -o "$OUTPUT_DIR"
```

### 1.6 split-module - разбиение файла на модули

```bash
node "$CLI_JS" split-module "$TARGET_FILE" -t 3 -o "$OUTPUT_DIR/split-prompt.md"
```

### 1.7 impact - анализ зоны влияния

```bash
node "$CLI_JS" impact "$TARGET_FILE" EnhancedPageObserver -o "$OUTPUT_DIR"
```

### 1.8 dead-code - поиск мертвого кода

```bash
node "$CLI_JS" dead-code "$TARGET_FILE" -o "$OUTPUT_DIR"
```

### 1.9 vue-analyze - анализ Vue компонента

```bash
node "$CLI_JS" vue-analyze "$VUE_FILE" -o "$OUTPUT_DIR"
```

---

## 🔧 Режимы CLI-Refactor.js {#режимы-cli-refactorjs}

# Базовая команда анализа

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE"
```

# С пользовательскими параметрами кластеризации

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" -t 2 -c 20
```

# Полный анализ со всеми анализаторами (по умолчанию)

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" -t 2 -c 20 -v
```

# Анализ с формальной верификацией

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" -t 2 -c 20 --formal
```

# Анализ с отключением некоторых анализаторов для ускорения

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" --no-cfg --no-dataflow --no-jsx
```

# Анализ TypeScript файла с проверкой типов

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" --no-typescript false
```

# Анализ Vue файла

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" --no-vue false
```

# Полный анализ с сохранением отчета

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" -t 2 -c 20 --formal -v
```

# Сохранение результата в файл

```bash
node "$CLI_REFACTOR" analyze "$TARGET_FILE" -t 2 -c 20 > "$OUTPUT_DIR/analysis-report.txt"
```

### 2.2 refactor --dry-run - пробный рефакторинг

```bash
node "$CLI_REFACTOR" refactor "$TARGET_FILE" --dry-run > "$OUTPUT_DIR/dry-run-report.txt" --target-size 2 --min-cohesion 20
```

### 2.3 refactor - реальный рефакторинг

```bash
node "$CLI_REFACTOR" refactor "$TARGET_FILE" \
  -t 2 \
  -c 60 \
  -v
```

### 2.4 refactor с параметрами

```bash
node "$CLI_REFACTOR" refactor "$TARGET_FILE" -o "$MODULES_DIR" -t 3 -m 10 -c 60 -v > "$OUTPUT_DIR/refactor-verbose.log"
```

### 2.5 restore - восстановление из бэкапа

```bash
node "$CLI_REFACTOR" restore "$BACKUP_FILE" > "$OUTPUT_DIR/restore-log.txt"
```

### 2.6 help - справка

```bash
node "$CLI_REFACTOR" help > "$OUTPUT_DIR/help.txt"
```

---

## 💾 Восстановление из бэкапа {#восстановление}

### Поиск последнего бэкапа и восстановление

```bash
BACKUP_FILE=$(ls -t "$BASE_DIR/Directory/11/deepseek/"*.backup.* 2>/dev/null | head -1) && node "$CLI_REFACTOR" restore "$BACKUP_FILE" > "$OUTPUT_DIR/restore-log.txt"
```

### Ручное восстановление из конкретного бэкапа

```bash
node "$CLI_REFACTOR" restore "$BASE_DIR/Directory/11/deepseek/injectDeepSeek.js.backup.1703123456789" > "$OUTPUT_DIR/restore-log.txt"
```

---

## 📊 Просмотр результатов в OUTPUT_DIR

```bash
# Список всех файлов в выходной директории
ls -la "$OUTPUT_DIR"

# Просмотр отчета
cat "$OUTPUT_DIR/analysis-report.txt"

# Просмотр лога рефакторинга
cat "$OUTPUT_DIR/refactor-log.txt"
```

---

## 🔗 Алиасы для быстрого доступа {#алиасы}

### Добавить в ~/.bashrc

```bash
alias ast-analyzer='node /home/sergei/Desktop/system/packages/ast-analyzer/dist/cli.js'
alias ast-refactor='node /home/sergei/Desktop/system/packages/ast-analyzer/dist/cli-refactor.js'
alias ast-analyze='ast-refactor analyze'
alias ast-file='ast-analyzer file'
alias ast-project='ast-analyzer project'
alias ast-minify='ast-analyzer minify'
alias ast-split='ast-analyzer split-module'
alias ast-vue='ast-analyzer vue-analyze'
alias ast-impact='ast-analyzer impact'
alias ast-dead='ast-analyzer dead-code'
alias ast-refactor-dry='ast-refactor refactor --dry-run'

# Переменная для OUTPUT_DIR
export AST_OUTPUT_DIR="/home/sergei/Desktop/system/refactor-output"
```

### Применение алиасов

```bash
source ~/.bashrc

# Теперь доступны короткие команды:
ast-analyze "$TARGET_FILE" > "$AST_OUTPUT_DIR/analysis.txt"
ast-file "$TARGET_FILE" -o "$AST_OUTPUT_DIR"
ast-refactor-dry "$TARGET_FILE" > "$AST_OUTPUT_DIR/dry-run.txt"
ast-refactor "$TARGET_FILE" > "$AST_OUTPUT_DIR/refactor.txt"
```

---

**Версия:** 2.0  
**Дата:** 2026-06-12

```

```
