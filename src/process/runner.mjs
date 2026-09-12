// runner.mjs
import { fork, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// WeakMap для хранения активных процессов
const activeProcesses = new WeakMap();
const processRegistry = new Set();

class ManagedProcess extends EventEmitter {
  constructor(scriptPath, args = [], options = {}) {
    super();
    this.scriptPath = scriptPath;
    this.args = args;
    this.options = {
      silent: true,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      ...options,
    };
    this.process = null;
    this.isRunning = false;
    this.startTime = null;
    this.exitCode = null;
    this.output = '';
    this.error = '';
    this._cleanupTimeout = null;
    this._stdinWriter = null;
    this._readline = null;

    // Регистрируем в WeakMap
    activeProcesses.set(this, {
      pid: null,
      startTime: null,
    });
    processRegistry.add(this);
  }

  start() {
    if (this.isRunning) {
      throw new Error('Process already running');
    }

    // Определяем метод запуска
    if (this.options.useSpawn) {
      this._startSpawn();
    } else {
      this._startFork();
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.exitCode = null;
    this.output = '';
    this.error = '';

    // Обновляем WeakMap
    const record = activeProcesses.get(this);
    if (record) {
      record.pid = this.process.pid;
      record.startTime = this.startTime;
    }

    // Настройка stdin
    if (this.process.stdin) {
      this._stdinWriter = this.process.stdin;
    }

    // Настройка stdout
    if (this.process.stdout) {
      this.process.stdout.on('data', data => {
        const text = data.toString();
        this.output += text;
        this.emit('stdout', text);
      });

      // Создаем readline для построчного чтения
      this._readline = createInterface({
        input: this.process.stdout,
        terminal: false,
      });

      this._readline.on('line', line => {
        this.emit('line', line);
      });
    }

    // Настройка stderr
    if (this.process.stderr) {
      this.process.stderr.on('data', data => {
        const text = data.toString();
        this.error += text;
        this.emit('stderr', text);
      });
    }

    // Обработка завершения
    this.process.on('exit', (code, signal) => {
      this.isRunning = false;
      this.exitCode = code;
      this.emit('exit', code, signal);
      this._cleanup();
    });

    this.process.on('error', err => {
      this.error += err.message;
      this.emit('error', err);
      this.isRunning = false;
      this._cleanup();
    });

    return this;
  }

  _startFork() {
    this.process = fork(this.scriptPath, this.args, {
      ...this.options,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });
  }

  _startSpawn() {
    this.process = spawn(this.scriptPath, this.args, {
      ...this.options,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  // Управление stdin
  writeToStdin(data) {
    if (this._stdinWriter && !this._stdinWriter.destroyed) {
      this._stdinWriter.write(data);
      return true;
    }
    return false;
  }

  writeLineToStdin(line) {
    return this.writeToStdin(line + '\n');
  }

  endStdin() {
    if (this._stdinWriter && !this._stdinWriter.destroyed) {
      this._stdinWriter.end();
      return true;
    }
    return false;
  }

  // Чтение stdout построчно
  onLine(callback) {
    this.on('line', callback);
    return this;
  }

  onStdout(callback) {
    this.on('stdout', callback);
    return this;
  }

  onStderr(callback) {
    this.on('stderr', callback);
    return this;
  }

  // Ожидание определенной строки в выводе
  waitForLine(pattern, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('line', handler);
        reject(new Error(`Timeout waiting for pattern: ${pattern}`));
      }, timeout);

      const handler = line => {
        if (typeof pattern === 'string') {
          if (line.includes(pattern)) {
            clearTimeout(timer);
            this.removeListener('line', handler);
            resolve(line);
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(line)) {
            clearTimeout(timer);
            this.removeListener('line', handler);
            resolve(line);
          }
        }
      };

      this.on('line', handler);
    });
  }

  // Ожидание завершения с таймаутом
  waitForExit(timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve(this.exitCode);
        return;
      }

      const timer = setTimeout(() => {
        if (this.isRunning) {
          this.forceStop();
          reject(new Error(`Process timed out after ${timeout}ms`));
        }
      }, timeout);

      this.once('exit', code => {
        clearTimeout(timer);
        resolve(code);
      });

      this.once('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // Интерактивный режим
  async interactive(handlers = {}) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Перенаправляем stdin в процесс
    rl.on('line', line => {
      if (handlers.onLine) {
        handlers.onLine(line, this);
      }
      this.writeLineToStdin(line);
    });

    // Перенаправляем stdout процесса на консоль
    this.on('line', line => {
      if (handlers.onOutput) {
        handlers.onOutput(line, this);
      } else {
        console.log('[PROCESS]', line);
      }
    });

    this.on('stderr', data => {
      if (handlers.onError) {
        handlers.onError(data, this);
      } else {
        console.error('[PROCESS ERR]', data);
      }
    });

    await this.waitForExit();

    rl.close();
    return this.exitCode;
  }

  // Pipe между процессами
  pipeTo(targetProcess) {
    this.on('line', line => {
      targetProcess.writeLineToStdin(line);
    });
    return this;
  }

  stop(signal = 'SIGTERM') {
    if (this.process && this.isRunning) {
      this.process.kill(signal);
      return true;
    }
    return false;
  }

  forceStop() {
    return this.stop('SIGKILL');
  }

  send(message) {
    if (this.process && this.isRunning && this.process.send) {
      this.process.send(message);
      return true;
    }
    return false;
  }

  onMessage(callback) {
    if (this.process) {
      this.process.on('message', callback);
    }
  }

  getPid() {
    return this.process?.pid || null;
  }

  getUptime() {
    if (!this.startTime) {return 0;}
    return Date.now() - this.startTime;
  }

  isAlive() {
    return this.isRunning && this.process && !this.process.killed;
  }

  _cleanup() {
    if (this._cleanupTimeout) {
      clearTimeout(this._cleanupTimeout);
      this._cleanupTimeout = null;
    }

    if (this._readline) {
      this._readline.close();
      this._readline = null;
    }

    // Автоматически удаляем из реестра через 5 секунд
    this._cleanupTimeout = setTimeout(() => {
      processRegistry.delete(this);
      activeProcesses.delete(this);
    }, 5000);
  }

  [Symbol.dispose]() {
    this.destroy();
  }

  destroy() {
    this.forceStop();
    this._cleanup();
    processRegistry.delete(this);
    activeProcesses.delete(this);
    this.removeAllListeners();
  }

  toString() {
    return `ManagedProcess(pid=${this.getPid()}, running=${this.isRunning}, uptime=${this.getUptime()}ms)`;
  }
}

// Лямбда для создания и запуска процесса
function createRunner(scriptPath, args = [], options = {}) {
  const managed = new ManagedProcess(scriptPath, args, options);
  managed.start();
  return managed;
}

// Автоматический менеджер процессов
class ProcessManager {
  constructor() {
    this._autoCleanup = true;
    this._cleanupInterval = null;
    this._maxUptime = 3600000; // 1 час
    this._startAutoCleanup();
  }

  _startAutoCleanup() {
    if (this._cleanupInterval) {return;}
    this._cleanupInterval = setInterval(() => {
      this._cleanupStaleProcesses();
    }, 30000); // Каждые 30 секунд
  }

  _cleanupStaleProcesses() {
    const now = Date.now();
    const toRemove = [];

    for (const proc of processRegistry) {
      if (proc instanceof ManagedProcess) {
        // Удаляем завершенные процессы старше 10 секунд
        if (!proc.isAlive() && proc.exitCode !== null) {
          const age = now - (proc.startTime || 0);
          if (age > 10000) {
            toRemove.push(proc);
          }
        }

        // Принудительно завершаем процессы, работающие слишком долго
        if (proc.isAlive() && proc.getUptime() > this._maxUptime) {
          proc.forceStop();
          toRemove.push(proc);
        }
      }
    }

    for (const proc of toRemove) {
      proc.destroy();
    }
  }

  stopAll() {
    for (const proc of processRegistry) {
      if (proc instanceof ManagedProcess && proc.isAlive()) {
        proc.stop();
      }
    }
  }

  forceStopAll() {
    for (const proc of processRegistry) {
      if (proc instanceof ManagedProcess && proc.isAlive()) {
        proc.forceStop();
      }
    }
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    this.forceStopAll();
  }

  getStats() {
    const total = processRegistry.size;
    const running = Array.from(processRegistry).filter(
      p => p instanceof ManagedProcess && p.isAlive(),
    ).length;
    return { total, running, uptime: process.uptime() };
  }
}

// Создаем менеджер
const manager = new ProcessManager();

// Обработка завершения Node.js
process.on('exit', () => {
  manager.destroy();
});

process.on('SIGINT', () => {
  manager.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  manager.destroy();
  process.exit(0);
});

// Фабрика для создания runner с автоматическим управлением
function createAutoRunner(scriptPath, args = [], options = {}) {
  const runner = createRunner(scriptPath, args, options);

  return new Proxy(runner, {
    get(target, prop) {
      if (prop === 'dispose' || prop === Symbol.dispose) {
        return () => {
          target.destroy();
          manager._cleanupStaleProcesses();
        };
      }
      if (prop === 'autoDestroy') {
        return (delay = 5000) => {
          setTimeout(() => {
            if (!target.isAlive()) {
              target.destroy();
            }
          }, delay);
        };
      }
      if (prop === 'interactive') {
        return handlers => target.interactive(handlers);
      }
      if (prop === 'pipe') {
        return targetProcess => target.pipeTo(targetProcess);
      }
      const value = target[prop];
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  });
}

// Функция для выполнения с автоматическим уничтожением
async function runAndAutoDestroy(scriptPath, args = [], options = {}) {
  const runner = createAutoRunner(scriptPath, args, options);

  try {
    const result = await runner.waitForExit(options.timeout || 30000);
    return {
      success: result === 0,
      exitCode: result,
      output: runner.output,
      error: runner.error,
      pid: runner.getPid(),
      uptime: runner.getUptime(),
    };
  } finally {
    runner.destroy();
  }
}

// Функция для интерактивного запуска
async function runInteractive(scriptPath, args = [], handlers = {}) {
  const runner = createAutoRunner(scriptPath, args, { useSpawn: true });
  return runner.interactive(handlers);
}

// Функция для pipe между процессами
function createPipeline(processes) {
  let previous = null;
  for (const proc of processes) {
    if (previous) {
      previous.pipeTo(proc);
    }
    previous = proc;
  }
  return {
    start: () => {
      for (const proc of processes) {
        if (!proc.isAlive()) {
          proc.start();
        }
      }
    },
    waitAll: async () => {
      const last = processes[processes.length - 1];
      return last.waitForExit();
    },
    stopAll: () => {
      for (const proc of processes) {
        proc.stop();
      }
    },
  };
}

// New Function wrapper для динамического создания runner
async function createDynamicRunner(runnerCode, args = [], options = {}) {
  const fs = await import('fs');
  const tempScript = resolve(__dirname, `temp-runner-${Date.now()}.mjs`);

  const scriptContent = `
    import { createAutoRunner } from './runner.mjs';
    const fn = ${runnerCode};
    const result = fn(args, options);
    if (result && typeof result.then === 'function') {
      await result;
    }
  `;

  fs.writeFileSync(tempScript, scriptContent, 'utf8');

  const runner = createAutoRunner(tempScript, args, options);

  // Автоматически удаляем временный файл при завершении
  runner.once('exit', () => {
    if (fs.existsSync(tempScript)) {
      fs.unlinkSync(tempScript);
    }
  });

  return runner;
}

export {
  ManagedProcess,
  createRunner,
  createAutoRunner,
  runAndAutoDestroy,
  runInteractive,
  createPipeline,
  createDynamicRunner,
  manager as processManager,
  processRegistry,
};
