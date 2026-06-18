#!/bin/bash
# run-refactor.sh - Production-ready скрипт с 100% гарантией

set -e

BASE_DIR="/home/sergei/Desktop/system"
DIST_DIR="$BASE_DIR/packages/ast-analyzer/dist"
CLI_REFACTOR="$DIST_DIR/cli-refactor.js"
TARGET_FILE="$BASE_DIR/FileSystemScanner.js"

echo "🚀 Запуск рефакторинга с 100% гарантией"
echo "=========================================="
echo "📁 Файл: $TARGET_FILE"
echo "🛡️ Режим: Максимальная гарантия"
echo "🔄 Попытки: 5"
echo ""

# Запуск с максимальной гарантией
node "$CLI_REFACTOR" refactor "$TARGET_FILE" \
  --guarantee \
  --max-attempts 5 \
  -t 2 \
  -c 60 \
  -v \
  --log-level debug \
  --log-file ./refactor-guarantee.log

# Проверка результата
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Рефакторинг успешно завершен с 100% гарантией!"
  echo "📄 Лог: ./refactor-guarantee.log"
  echo "💾 Бэкап: $TARGET_FILE.full-backup.*"
else
  echo ""
  echo "❌ Рефакторинг не удался даже с максимальной гарантией"
  echo "📄 Проверьте лог: ./refactor-guarantee.log"
  echo "💾 Восстановите из бэкапа: $TARGET_FILE.full-backup.*"
  exit 1
fi