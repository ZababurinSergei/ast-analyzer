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
 *
 * ⚠️ ВАЖНО: ESM-импорты поднимаются (hoisting) до выполнения кода,
 * поэтому статические `import` для CLIExecutor использовать нельзя —
 * фильтр шума от ts-morph должен быть установлен ДО загрузки CLIExecutor.
 * Используем динамический `import()` после установки фильтра.
 */

// ============================================
// ФИЛЬТР ШУМА ОТ ts-morph (должен быть установлен ПЕРВЫМ)
// ============================================
import { silenceTsMorphNoise } from './utils/silence-ts-morph.js';
silenceTsMorphNoise();

// ============================================
// ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
// ============================================

// Перехват необработанных исключений
process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:');
  console.error(error);
  if (error instanceof Error && error.stack) {
    console.error('\n📚 Stack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});

// Перехват необработанных rejected промисов
process.on('unhandledRejection', reason => {
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
// ДИНАМИЧЕСКИЕ ИМПОРТЫ (после установки фильтра)
// ============================================

/**
 * Динамически загружаем модули ПОСЛЕ установки фильтра stderr.
 * Это критично, потому что ts-morph начинает писать в stderr
 * при первой же попытке построить Type, а это происходит внутри
 * CLIExecutor.
 */
const { CLIExecutor } = await import('./cli/CLIExecutor.js');
const { isMainModule } = await import('./utils/is-main.js');

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

// Экспортируем все команды для возможности их использования отдельно.
// ⚠️ Используем динамические реэкспорты — они выполнятся уже после
// установки фильтра stderr, что предотвратит шум при загрузке модулей.
export const ProjectCommand = (await import('./cli/commands/ProjectCommand.js')).ProjectCommand;
export const FileCommand = (await import('./cli/commands/FileCommand.js')).FileCommand;
export const MinifyCommand = (await import('./cli/commands/MinifyCommand.js')).MinifyCommand;
export const SplitModuleCommand = (await import('./cli/commands/SplitModuleCommand.js'))
  .SplitModuleCommand;
export const VueAnalyzeCommand = (await import('./cli/commands/VueAnalyzeCommand.js'))
  .VueAnalyzeCommand;
export const SemanticCommand = (await import('./cli/commands/SemanticCommand.js')).SemanticCommand;
export const VerifyCommand = (await import('./cli/commands/VerifyCommand.js')).VerifyCommand;
export const RefactorCommand = (await import('./cli/commands/RefactorCommand.js')).RefactorCommand;
export const CompactCommand = (await import('./cli/commands/CompactCommand.js')).CompactCommand;
export const HybridReportCommand = (await import('./cli/commands/HybridReportCommand.js'))
  .HybridReportCommand;
export const InitCommand = (await import('./cli/commands/InitCommand.js')).InitCommand;
export const StatusCommand = (await import('./cli/commands/StatusCommand.js')).StatusCommand;
export const ImpactCommand = (await import('./cli/commands/ImpactCommand.js')).ImpactCommand;
export const DeadCodeCommand = (await import('./cli/commands/DeadCodeCommand.js')).DeadCodeCommand;
export const PromptPackCommand = (await import('./cli/commands/PromptPackCommand.js'))
  .PromptPackCommand;
export const MinifyFolderCommand = (await import('./cli/commands/MinifyFolderCommand.js'))
  .MinifyFolderCommand;
