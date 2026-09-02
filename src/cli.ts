#!/usr/bin/env node

/**
 * CLI entry point for AST Analyzer
 *
 * Это упрощенная точка входа, которая делегирует все команды
 * модульному исполнителю CLIExecutor.
 *
 * Использование:
 *   npx ast-analyzer <command> [options]
 *   npx ast-analyzer project ./src/index.ts --entities
 *   npx ast-analyzer compact ./src/file.ts --ultra
 *   npx ast-analyzer help
 */

import { isMainModule } from './utils/is-main.js';
import { CLIExecutor } from './cli/CLIExecutor.js';

// ============================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
// ============================================

// Перехват необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:');
  console.error(error);
  if (error instanceof Error && error.stack) {
    console.error('\n📚 Stack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});

// Перехват необработанных rejected промисов
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:');
  console.error(reason);
  if (reason instanceof Error && reason.stack) {
    console.error('\n📚 Stack trace:');
    console.error(reason.stack);
  }
  process.exit(1);
});

// Обработка SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  process.exit(0);
});

// Обработка SIGTERM
process.on('SIGTERM', () => {
  console.log('\n\n👋 Terminating...');
  process.exit(0);
});

// ============================================
// ЗАПУСК CLI
// ============================================

// Создаем экземпляр исполнителя CLI
const cli = new CLIExecutor();

/**
 * Основная функция запуска
 */
async function main(): Promise<void> {
  try {
    // Если аргументов нет - показываем справку
    if (process.argv.length <= 2) {
      cli.showHelp();
      return;
    }

    // Запускаем CLI
    await cli.run();
  } catch (error) {
    console.error('❌ CLI error:', error);
    if (error instanceof Error && error.stack) {
      console.error('\n📚 Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// ============================================
// ЗАПУСК ТОЛЬКО ЕСЛИ ЭТО ГЛАВНЫЙ МОДУЛЬ
// ============================================

// Проверяем, запущен ли файл как основной (не импортирован)
if (isMainModule(import.meta.url)) {
  main();
}

// ============================================
// ЭКСПОРТЫ ДЛЯ ИСПОЛЬЗОВАНИЯ КАК БИБЛИОТЕКИ
// ============================================

// Экспортируем CLIExecutor для программного использования
export { CLIExecutor };

// Экспортируем экземпляр для обратной совместимости
export default cli;

// Также экспортируем утилиты для работы с CLI
export { isMainModule } from './utils/is-main.js';

// ============================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ ДЛЯ КОМАНД
// ============================================

// Экспортируем все команды для возможности их использования отдельно
export * from './cli/commands/ProjectCommand.js';
export * from './cli/commands/FileCommand.js';
export * from './cli/commands/MinifyCommand.js';
export * from './cli/commands/SplitModuleCommand.js';
export * from './cli/commands/VueAnalyzeCommand.js';
export * from './cli/commands/SemanticCommand.js';
export * from './cli/commands/VerifyCommand.js';
export * from './cli/commands/RefactorCommand.js';
export * from './cli/commands/CompactCommand.js';
export * from './cli/commands/HybridReportCommand.js';
export * from './cli/commands/InitCommand.js';
export * from './cli/commands/StatusCommand.js';
export * from './cli/commands/ImpactCommand.js';
export * from './cli/commands/DeadCodeCommand.js';
export * from './cli/commands/PromptPackCommand.js';
export * from './cli/commands/MinifyFolderCommand.js';
