// utils/askQuestion.ts
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
 * Асинхронно задаёт вопрос пользователю с таймаутом
 * @param question - Текст вопроса
 * @param timeoutMs - Таймаут в миллисекундах
 * @returns Promise с ответом пользователя или null при таймауте
 */
export function askQuestionWithTimeout(
  question: string,
  timeoutMs = 30000
): Promise<string | null> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    // Исправлено: используем ReturnType<typeof setTimeout> вместо NodeJS.Timeout
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Устанавливаем таймаут
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        rl.close();
        resolve(null);
      }, timeoutMs);
    }

    rl.question(question, (answer: string) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

  // Проверка на undefined перед возвратом
  const selectedOption = options[choice - 1];
  if (!selectedOption) {
    console.log('❌ Ошибка: вариант не найден');
    return askChoice(question, options);
  }

  return selectedOption;
}

/**
 * Асинхронно задаёт вопрос с валидацией ответа
 * @param question - Текст вопроса
 * @param validator - Функция валидации ответа
 * @param errorMessage - Сообщение об ошибке
 * @returns Promise с валидным ответом
 */
export async function askValidated(
  question: string,
  validator: (answer: string) => boolean,
  errorMessage = '❌ Некорректный ввод. Пожалуйста, попробуйте снова.'
): Promise<string> {
  const answer = await askQuestion(question);

  if (!validator(answer)) {
    console.log(errorMessage);
    return askValidated(question, validator, errorMessage);
  }

  return answer;
}

/**
 * Асинхронно задаёт вопрос и ожидает нажатия Enter
 * @param message - Сообщение перед ожиданием
 */
export async function pressEnterToContinue(
  message = 'Нажмите Enter для продолжения...'
): Promise<void> {
  await askQuestion(message);
}

/**
 * Асинхронно запрашивает числовой ввод в заданном диапазоне
 * @param question - Текст вопроса
 * @param min - Минимальное значение (включительно)
 * @param max - Максимальное значение (включительно)
 * @returns Promise с числом
 */
export async function askNumber(question: string, min?: number, max?: number): Promise<number> {
  let rangeText = '';
  if (min !== undefined && max !== undefined) {
    rangeText = ` (${min}-${max})`;
  } else if (min !== undefined) {
    rangeText = ` (≥${min})`;
  } else if (max !== undefined) {
    rangeText = ` (≤${max})`;
  }

  const answer = await askQuestion(question + rangeText + ': ');
  const number = parseInt(answer.trim(), 10);

  if (isNaN(number)) {
    console.log('❌ Пожалуйста, введите число.');
    return askNumber(question, min, max);
  }

  if (min !== undefined && number < min) {
    console.log(`❌ Число должно быть не меньше ${min}.`);
    return askNumber(question, min, max);
  }

  if (max !== undefined && number > max) {
    console.log(`❌ Число должно быть не больше ${max}.`);
    return askNumber(question, min, max);
  }

  return number;
}

/**
 * Асинхронно запрашивает пароль (скрывает ввод)
 * @param question - Текст вопроса
 * @returns Promise с паролем
 */
export async function askPassword(question = 'Введите пароль: '): Promise<string> {
  // Для скрытого ввода пароля используем стандартный readline
  const readlineModule = await import('readline');
  const rl = readlineModule.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);

    const onData = (_char: Buffer) => {
      // Просто возвращаем строку, звездочки для маскировки
      return '';
    };

    stdin.on('data', onData);

    rl.question('', answer => {
      stdin.removeListener('data', onData);
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Асинхронно запрашивает подтверждение перед выполнением опасной операции
 * @param operation - Описание операции
 * @param destructive - Является ли операция деструктивной (требует ввода 'yes' вместо 'y')
 * @returns Promise с boolean
 */
export async function confirmDangerousOperation(
  operation: string,
  destructive = true
): Promise<boolean> {
  console.log(`\n⚠️  ВНИМАНИЕ: ${operation}`);
  console.log(`   Это действие ${destructive ? 'НЕОБРАТИМО' : 'может повлиять на данные'}.`);

  if (destructive) {
    const answer = await askQuestion('Для подтверждения введите "yes": ');
    return answer.trim().toLowerCase() === 'yes';
  } else {
    return askYesNo('Вы уверены, что хотите продолжить?', 'n');
  }
}

// Пример использования
export async function exampleUsage() {
  // Простой вопрос
  const name = await askQuestion('Ваше имя: ');
  console.log(`Привет, ${name}!`);

  // Вопрос с таймаутом
  const answer = await askQuestionWithTimeout('У вас есть 5 секунд: ', 5000);
  if (answer === null) {
    console.log('Время вышло!');
  }

  // Yes/No вопрос
  const confirmed = await askYesNo('Вы уверены?', 'n');
  if (confirmed) {
    console.log('Подтверждено');
  }

  // Выбор из списка
  const color = await askChoice('Выберите цвет:', ['Красный', 'Зелёный', 'Синий']);
  console.log(`Вы выбрали: ${color}`);

  // Вопрос с валидацией
  const age = await askValidated(
    'Ваш возраст: ',
    answer => !isNaN(parseInt(answer, 10)) && parseInt(answer, 10) > 0,
    '❌ Пожалуйста, введите положительное число'
  );
  console.log(`Вам ${age} лет`);

  // Числовой ввод с диапазоном
  const score = await askNumber('Оценка', 1, 5);
  console.log(`Оценка: ${score}`);

  // Ожидание нажатия Enter
  await pressEnterToContinue();

  // Подтверждение опасной операции
  const proceed = await confirmDangerousOperation('Удалить все файлы', true);
  if (proceed) {
    console.log('Выполняется удаление...');
  }
}
