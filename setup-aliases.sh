#!/bin/bash
# setup-aliases.sh - Скрипт для автоматической настройки алиасов ast-analyzer

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Установка алиасов для ast-analyzer${NC}"
echo -e "${BLUE}========================================${NC}"

# Определяем путь к проекту
PROJECT_DIR="/home/sergei/Desktop/system"
AST_ANALYZER_DIR="$PROJECT_DIR/packages/ast-analyzer"

# Проверяем существование директории
if [ ! -d "$AST_ANALYZER_DIR" ]; then
    echo -e "${RED}❌ Ошибка: Директория $AST_ANALYZER_DIR не найдена${NC}"
    exit 1
fi

# Проверяем наличие собранных файлов
if [ ! -f "$AST_ANALYZER_DIR/dist/cli.js" ]; then
    echo -e "${YELLOW}⚠️  Предупреждение: dist/cli.js не найден. Сначала выполните сборку:${NC}"
    echo -e "   cd $AST_ANALYZER_DIR && npm run build"
fi

# Определяем какой файл конфигурации использовать
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    SHELL_NAME="zsh"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    SHELL_NAME="bash"
else
    echo -e "${RED}❌ Не найден .zshrc или .bashrc${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Найден конфигурационный файл: $SHELL_CONFIG (${SHELL_NAME})${NC}"

# Проверяем, есть ли уже алиасы
if grep -q "alias ast-analyzer=" "$SHELL_CONFIG"; then
    echo -e "${YELLOW}⚠️  Алиасы уже существуют в $SHELL_CONFIG${NC}"
    read -p "   Перезаписать? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}❌ Отменено${NC}"
        exit 0
    fi

    # Удаляем старые алиасы
    sed -i.bak '/alias ast-analyzer=/d' "$SHELL_CONFIG"
    sed -i.bak '/alias ast-refactor=/d' "$SHELL_CONFIG"
    sed -i.bak '/alias ast-semantic=/d' "$SHELL_CONFIG"
    echo -e "${GREEN}✅ Старые алиасы удалены${NC}"
fi

# Добавляем новые алиасы с комментарием
echo "" >> "$SHELL_CONFIG"
echo "# ============================================" >> "$SHELL_CONFIG"
echo "# AST Analyzer Aliases (добавлено $(date '+%Y-%m-%d %H:%M:%S'))" >> "$SHELL_CONFIG"
echo "# ============================================" >> "$SHELL_CONFIG"
echo "export AST_ANALYZER_DIR=\"$AST_ANALYZER_DIR\"" >> "$SHELL_CONFIG"
echo "" >> "$SHELL_CONFIG"
echo "alias ast-analyzer='node \"\$AST_ANALYZER_DIR/dist/cli.js\"'" >> "$SHELL_CONFIG"
echo "alias ast-refactor='node \"\$AST_ANALYZER_DIR/dist/cli-refactor.js\"'" >> "$SHELL_CONFIG"
echo "alias ast-semantic='node \"\$AST_ANALYZER_DIR/dist/cli-semantic.js\"'" >> "$SHELL_CONFIG"
echo "alias ast-cicd='node \"\$AST_ANALYZER_DIR/dist/cli-cicd.js\"'" >> "$SHELL_CONFIG"
echo "alias ast-validator='node \"\$AST_ANALYZER_DIR/dist/cli-ts-validator.js\"'" >> "$SHELL_CONFIG"
echo "" >> "$SHELL_CONFIG"
echo "# Дополнительные удобные алиасы" >> "$SHELL_CONFIG"
echo "alias ast-analyze='ast-refactor analyze'" >> "$SHELL_CONFIG"
echo "alias ast-refactor-dry='ast-refactor refactor --dry-run'" >> "$SHELL_CONFIG"
echo "alias ast-vue='ast-analyzer vue-analyze'" >> "$SHELL_CONFIG"
echo "alias ast-minify='ast-analyzer minify'" >> "$SHELL_CONFIG"
echo "alias ast-project='ast-analyzer project'" >> "$SHELL_CONFIG"
echo "" >> "$SHELL_CONFIG"

echo -e "${GREEN}✅ Алиасы добавлены в $SHELL_CONFIG${NC}"

# Создаем отдельный файл с алиасами для source
ALIASES_FILE="$HOME/.ast-analyzer-aliases"
cat > "$ALIASES_FILE" << 'EOF'
# AST Analyzer Aliases
# Source this file with: source ~/.ast-analyzer-aliases

export AST_ANALYZER_DIR="/home/sergei/Desktop/system/packages/ast-analyzer"

alias ast-analyzer='node "$AST_ANALYZER_DIR/dist/cli.js"'
alias ast-refactor='node "$AST_ANALYZER_DIR/dist/cli-refactor.js"'
alias ast-semantic='node "$AST_ANALYZER_DIR/dist/cli-semantic.js"'
alias ast-cicd='node "$AST_ANALYZER_DIR/dist/cli-cicd.js"'
alias ast-validator='node "$AST_ANALYZER_DIR/dist/cli-ts-validator.js"'

# Дополнительные алиасы
alias ast-analyze='ast-refactor analyze'
alias ast-refactor-dry='ast-refactor refactor --dry-run'
alias ast-vue='ast-analyzer vue-analyze'
alias ast-minify='ast-analyzer minify'
alias ast-project='ast-analyzer project'
alias ast-file='ast-analyzer file'
alias ast-impact='ast-analyzer impact'
alias ast-dead='ast-analyzer dead-code'
EOF

echo -e "${GREEN}✅ Создан файл с алиасами: $ALIASES_FILE${NC}"

# Показываем как использовать
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Установка завершена!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n${YELLOW}📌 Чтобы применить алиасы, выполните одну из команд:${NC}"
echo -e "   ${GREEN}source $SHELL_CONFIG${NC}        # Перезагрузить конфигурацию"
echo -e "   ${GREEN}source $ALIASES_FILE${NC}        # Загрузить только алиасы"
echo -e "   ${GREEN}exec $SHELL${NC}                 # Перезапустить оболочку"
echo -e "\n${YELLOW}📌 Или откройте новую вкладку терминала.${NC}"

# Показываем примеры использования
echo -e "\n${BLUE}Примеры использования:${NC}"
echo -e "  ${GREEN}ast-analyze ./src/file.ts${NC}              # Анализ файла"
echo -e "  ${GREEN}ast-analyze ./src/App.vue --formal${NC}     # Анализ Vue с верификацией"
echo -e "  ${GREEN}ast-refactor ./src/file.ts${NC}             # Рефакторинг"
echo -e "  ${GREEN}ast-semantic types ./src/file.ts${NC}       # Анализ типов"
echo -e "  ${GREEN}ast-vue ./src/Component.vue${NC}            # Анализ Vue компонента"
echo -e "  ${GREEN}ast-minify ./src/file.js${NC}               # Сжатие для ИИ"

# Предлагаем применить сейчас
echo -e "\n${YELLOW}Применить алиасы сейчас? (y/N):${NC} "
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    source "$ALIASES_FILE"
    echo -e "${GREEN}✅ Алиасы применены в текущей сессии!${NC}"
    echo -e "\nПроверка:"
    echo -e "  ${GREEN}which ast-refactor${NC}"
    which ast-refactor 2>/dev/null || echo "  ast-refactor is aliased"
fi

echo -e "\n${GREEN}🎉 Готово!${NC}"
