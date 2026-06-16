// src/utils/Logger.ts
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private level: LogLevel;
  private logFile: string | null = null;
  private fileStream: fs.WriteStream | null = null;
  private useColors = true;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles = 5;

  constructor(level: LogLevel = LogLevel.INFO, logFile?: string, useColors = true) {
    this.level = level;
    this.useColors = useColors;
    if (logFile) {
      this.initializeLogFile(logFile);
    }
  }

  private initializeLogFile(logFile: string): void {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.logFile = logFile;

    // Проверяем размер файла и делаем ротацию при необходимости
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > this.maxFileSize) {
        this.rotateLogFile(logFile);
      }
    }

    this.fileStream = fs.createWriteStream(logFile, { flags: 'a' });
  }

  private rotateLogFile(logFile: string): void {
    // Переименовываем текущий файл в .1, .2 и т.д.
    for (let i = this.maxFiles - 1; i >= 0; i--) {
      const oldPath = i === 0 ? logFile : `${logFile}.${i}`;
      const newPath = `${logFile}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldPath);
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }
    // Создаём новый пустой файл
    fs.writeFileSync(logFile, '');
  }

  private getColor(level: string): string {
    const colors: Record<string, string> = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m', // Green
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
    };
    return colors[level] || '\x1b[0m';
  }

  private getIcon(level: string): string {
    const icons: Record<string, string> = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌',
    };
    return icons[level] || '';
  }

  private format(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx =
      context && Object.keys(context).length > 0 ? ` | ${this.formatContext(context)}` : '';
    const icon = this.getIcon(level);
    return `[${timestamp}] ${icon} [${level}] ${message}${ctx}`;
  }

  private formatContext(context: LogContext): string {
    const entries = Object.entries(context).map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    });
    return entries.join(' ');
  }

  private log(level: LogLevel, levelStr: string, message: string, context?: LogContext) {
    if (level < this.level) return;

    const formatted = this.format(levelStr, message, context);

    if (this.useColors) {
      const color = this.getColor(levelStr);
      console.log(`${color}${formatted}\x1b[0m`);
    } else {
      console.log(formatted);
    }

    if (this.fileStream) {
      this.fileStream.write(formatted + '\n');
    }
  }

  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }

  /**
   * Логирование с отметкой о начале операции
   */
  startOperation(operation: string, context?: LogContext): void {
    this.info(`▶️ START: ${operation}`, context);
  }

  /**
   * Логирование с отметкой об успешном завершении операции
   */
  endOperation(operation: string, context?: LogContext): void {
    this.info(`✅ END: ${operation}`, context);
  }

  /**
   * Логирование с отметкой о неудачном завершении операции
   */
  failOperation(operation: string, error?: string, context?: LogContext): void {
    this.error(`❌ FAIL: ${operation}${error ? ` - ${error}` : ''}`, context);
  }

  /**
   * Логирование прогресса выполнения
   */
  progress(message: string, current: number, total: number, context?: LogContext): void {
    const percent = Math.round((current / total) * 100);
    const bar = this.createProgressBar(current, total, 20);
    this.info(`${message} ${bar} ${percent}% (${current}/${total})`, context);
  }

  private createProgressBar(current: number, total: number, width: number): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Логирование с разделителем для выделения секций
   */
  section(title: string, context?: LogContext): void {
    const separator = '='.repeat(60);
    this.info(separator, context);
    this.info(`📌 ${title.toUpperCase()}`, context);
    this.info(separator, context);
  }

  /**
   * Логирование с табличным форматом
   */
  table(data: Record<string, any>, context?: LogContext): void {
    const entries = Object.entries(data);
    const maxKeyLength = Math.max(...entries.map(([key]) => key.length));

    for (const [key, value] of entries) {
      const paddedKey = key.padEnd(maxKeyLength);
      if (typeof value === 'object' && value !== null) {
        this.info(`  ${paddedKey} : ${JSON.stringify(value)}`, context);
      } else {
        this.info(`  ${paddedKey} : ${value}`, context);
      }
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setMaxFileSize(size: number) {
    this.maxFileSize = size;
  }

  setMaxFiles(count: number) {
    this.maxFiles = count;
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  /**
   * Создаёт дочерний логгер с тем же уровнем и файлом, но с префиксом
   */
  child(prefix: string): Logger {
    const childLogger = new Logger(this.level, this.logFile || undefined, this.useColors);
    // Сохраняем ссылку на родительский файловый поток
    if (this.fileStream) {
      childLogger.fileStream = this.fileStream;
    }
    // Оборачиваем методы для добавления префикса
    const originalInfo = childLogger.info.bind(childLogger);
    const originalDebug = childLogger.debug.bind(childLogger);
    const originalWarn = childLogger.warn.bind(childLogger);
    const originalError = childLogger.error.bind(childLogger);

    childLogger.info = (message: string, context?: LogContext) => {
      originalInfo(`[${prefix}] ${message}`, context);
    };
    childLogger.debug = (message: string, context?: LogContext) => {
      originalDebug(`[${prefix}] ${message}`, context);
    };
    childLogger.warn = (message: string, context?: LogContext) => {
      originalWarn(`[${prefix}] ${message}`, context);
    };
    childLogger.error = (message: string, context?: LogContext) => {
      originalError(`[${prefix}] ${message}`, context);
    };

    return childLogger;
  }
}

/**
 * Парсит строковый уровень логирования в enum
 */
export function parseLogLevel(level: string): LogLevel {
  const map: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    none: LogLevel.NONE,
  };
  return map[level.toLowerCase()] || LogLevel.INFO;
}

/**
 * Создаёт глобальный логгер с дефолтными настройками
 */
let globalLogger: Logger | null = null;

export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(LogLevel.INFO);
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  if (globalLogger) {
    globalLogger.close();
  }
  globalLogger = logger;
}
