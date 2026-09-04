// packages/ast-analyzer/src/utils/askQuestion.ts
// ОБНОВЛЕННЫЙ ФАЙЛ - Удалены неиспользуемые функции

import { createInterface } from 'readline';

/**
 * Асинхронно задаёт вопрос пользователю и возвращает ответ
 * @param question - Текст вопроса
 * @returns Promise с ответом пользователя
 */
export function askQuestion(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Асинхронно задаёт вопрос с выбором "yes/no"
 * @param question - Текст вопроса
 * @param defaultAnswer - Ответ по умолчанию ('y' или 'n')
 * @returns Promise с boolean (true для 'y', false для 'n')
 */
export async function askYesNo(question: string, defaultAnswer?: 'y' | 'n'): Promise<boolean> {
  const suffix =
    defaultAnswer === 'y' ? ' (Y/n): ' : defaultAnswer === 'n' ? ' (y/N): ' : ' (y/n): ';
  const fullQuestion = question + suffix;

  let answer = await askQuestion(fullQuestion);
  answer = answer.trim().toLowerCase();

  if (answer === '') {
    return defaultAnswer === 'y';
  }

  return answer === 'y' || answer === 'yes';
}

/**
 * Асинхронно задаёт вопрос с выбором из списка
 * @param question - Текст вопроса
 * @param options - Массив вариантов ответа
 * @returns Promise с выбранным вариантом
 */
export async function askChoice(question: string, options: string[]): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  const answer = await askQuestion(`Выберите вариант (1-${options.length}): `);
  const choice = parseInt(answer.trim(), 10);

  if (isNaN(choice) || choice < 1 || choice > options.length) {
    console.log(`❌ Неверный выбор. Пожалуйста, выберите число от 1 до ${options.length}.`);
    return askChoice(question, options);
  }

  const selectedOption = options[choice - 1];
  if (!selectedOption) {
    console.log('❌ Ошибка: вариант не найден');
    return askChoice(question, options);
  }

  return selectedOption;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  askQuestion,
  askYesNo,
  askChoice,
};
