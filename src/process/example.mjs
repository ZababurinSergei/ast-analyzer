// example.mjs
import { createAutoRunner } from './runner.mjs';

// Создаем runner для run.mjs
const runner = createAutoRunner('./process_data.mjs', ['./index.json']);

// Подсветка вывода с цветами
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function highlightOutput(line) {
  // Подсветка разных типов сообщений
  if (line.includes('✅') || line.includes('success') || line.includes('Decoded')) {
    return `${colors.green}${line}${colors.reset}`;
  }
  if (
    line.includes('❌') ||
    line.includes('Error') ||
    line.includes('error') ||
    line.includes('failed')
  ) {
    return `${colors.red}${line}${colors.reset}`;
  }
  if (line.includes('⚠️') || line.includes('Warning') || line.includes('warning')) {
    return `${colors.yellow}${line}${colors.reset}`;
  }
  if (line.includes('📊') || line.includes('info') || line.includes('Info')) {
    return `${colors.cyan}${line}${colors.reset}`;
  }
  if (line.includes('📝') || line.includes('debug')) {
    return `${colors.gray}${line}${colors.reset}`;
  }
  if (line.includes('PID') || line.includes('process')) {
    return `${colors.magenta}${line}${colors.reset}`;
  }
  // Для JSON или структурированных данных
  if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
    return `${colors.blue}${line}${colors.reset}`;
  }
  return line;
}

// Обработка stdout с подсветкой
runner.onStdout(data => {
  const lines = data.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(highlightOutput(line));
  });
});

// Обработка stderr с подсветкой
runner.onStderr(data => {
  const lines = data.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.red}${colors.bright}[ERR]${colors.reset} ${highlightOutput(line)}`);
  });
});

// Построчный вывод с подсветкой
runner.onLine(line => {
  if (line.trim()) {
    console.log(`${colors.dim}[LINE]${colors.reset} ${highlightOutput(line)}`);
  }
});

// Логирование событий процесса
console.log(`${colors.cyan}🚀 Starting process...${colors.reset}`);
console.log(`${colors.gray}📋 Script: ./process_data.mjs${colors.reset}`);
console.log(`${colors.gray}📋 Args: ./index.json${colors.reset}`);
console.log(`${colors.gray}🆔 PID: ${runner.getPid()}${colors.reset}`);

// Обработка завершения процесса
runner.once('exit', (code, signal) => {
  console.log(
    `\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`
  );
  console.log(`${colors.bright}${colors.cyan}📦 Process finished${colors.reset}`);
  console.log(`${colors.gray}🆔 PID: ${runner.getPid()}${colors.reset}`);
  console.log(
    `${colors.gray}⏱️  Uptime: ${(runner.getUptime() / 1000).toFixed(2)}s${colors.reset}`
  );
  console.log(`${colors.gray}📊 Exit code: ${code !== null ? code : 'N/A'}${colors.reset}`);
  console.log(`${colors.gray}📊 Signal: ${signal || 'N/A'}${colors.reset}`);

  if (code === 0) {
    console.log(`${colors.green}✅ Process completed successfully${colors.reset}`);
  } else if (code !== null) {
    console.log(`${colors.red}❌ Process failed with code ${code}${colors.reset}`);
  }

  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`
  );

  // Автоматическое уничтожение процесса
  console.log(`${colors.gray}🧹 Cleaning up...${colors.reset}`);
  runner.destroy();
  console.log(`${colors.green}✅ Process destroyed${colors.reset}`);
  process.exit(code === 0 ? 0 : 1);
});

// Обработка ошибок процесса
runner.once('error', err => {
  console.log(`${colors.red}${colors.bright}💥 Process error:${colors.reset}`, err.message);
  runner.destroy();
  process.exit(1);
});

// Таймаут на случай зависания
const timeout = setTimeout(() => {
  console.log(`${colors.red}${colors.bright}⏰ Timeout! Force killing process...${colors.reset}`);
  runner.forceStop();
  runner.destroy();
  process.exit(1);
}, 60000); // 60 секунд

// Отмена таймаута при завершении
runner.once('exit', () => {
  clearTimeout(timeout);
});

// Обработка Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}⚠️  Received SIGINT, shutting down...${colors.reset}`);
  runner.stop();
  runner.destroy();
  process.exit(0);
});

console.log(`${colors.green}✅ Runner started, waiting for output...${colors.reset}\n`);
