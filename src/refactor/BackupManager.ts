// src/refactor/BackupManager.ts
import fs from 'fs';
import path from 'path';
import { type Logger } from '../utils/Logger.js';

export class BackupManager {
  private logger: Logger;
  private backups: string[] = [];
  private checkpoints: string[] = [];
  private workingCopies: string[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Создает полную резервную копию файла
   */
  async createFullBackup(
    filePath: string
  ): Promise<{ backupPath: string; timestamp: number } | null> {
    try {
      const timestamp = Date.now();
      const backupPath = `${filePath}.full-backup.${timestamp}`;
      await fs.promises.copyFile(filePath, backupPath);
      this.backups.push(backupPath);
      this.logger.debug('Full backup created', { backupPath });
      return { backupPath, timestamp };
    } catch (error) {
      this.logger.error('Failed to create full backup', { filePath, error });
      return null;
    }
  }

  /**
   * Создает рабочую копию для рефакторинга
   */
  async createWorkingCopy(filePath: string): Promise<string | null> {
    try {
      const workingCopy = `${filePath}.working-copy.${Date.now()}`;
      await fs.promises.copyFile(filePath, workingCopy);
      this.workingCopies.push(workingCopy);
      this.logger.debug('Working copy created', { workingCopy });
      return workingCopy;
    } catch (error) {
      this.logger.error('Failed to create working copy', { filePath, error });
      return null;
    }
  }

  /**
   * Создает чекпоинт на определенном этапе
   */
  async createCheckpoint(filePath: string, stage: string): Promise<string | null> {
    try {
      const checkpoint = `${filePath}.checkpoint.${stage}.${Date.now()}`;
      await fs.promises.copyFile(filePath, checkpoint);
      this.checkpoints.push(checkpoint);
      this.logger.debug('Checkpoint created', { checkpoint, stage });
      return checkpoint;
    } catch (error) {
      this.logger.error('Failed to create checkpoint', { filePath, stage, error });
      return null;
    }
  }

  /**
   * Восстанавливает файл из чекпоинта
   */
  async restoreCheckpoint(filePath: string, checkpointPath: string): Promise<boolean> {
    try {
      if (fs.existsSync(checkpointPath)) {
        await fs.promises.copyFile(checkpointPath, filePath);
        this.logger.warn('Checkpoint restored', { filePath, checkpointPath });
        return true;
      } else {
        this.logger.warn('Checkpoint not found', { checkpointPath });
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to restore checkpoint', { filePath, checkpointPath, error });
      return false;
    }
  }

  /**
   * Восстанавливает последний чекпоинт
   */
  async restoreLastCheckpoint(filePath: string): Promise<boolean> {
    if (this.checkpoints.length === 0) {
      this.logger.debug('No checkpoints to restore');
      return false;
    }
    const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
    if (lastCheckpoint && fs.existsSync(lastCheckpoint)) {
      return this.restoreCheckpoint(filePath, lastCheckpoint);
    }
    return false;
  }

  /**
   * Восстанавливает файл из полного бэкапа
   */
  async restore(filePath: string): Promise<boolean> {
    if (this.backups.length === 0) {
      this.logger.warn('No backup found to restore');
      return false;
    }
    const lastBackup = this.backups[this.backups.length - 1];
    if (lastBackup && fs.existsSync(lastBackup)) {
      try {
        await fs.promises.copyFile(lastBackup, filePath);
        this.logger.info('Full backup restored', { filePath, backupPath: lastBackup });
        return true;
      } catch (error) {
        this.logger.error('Failed to restore backup', { filePath, lastBackup, error });
        return false;
      }
    }
    return false;
  }

  /**
   * Удаляет чекпоинт
   */
  async removeCheckpoint(checkpointPath: string): Promise<boolean> {
    try {
      if (fs.existsSync(checkpointPath)) {
        await fs.promises.unlink(checkpointPath);
        this.checkpoints = this.checkpoints.filter(c => c !== checkpointPath);
        this.logger.debug('Checkpoint removed', { checkpointPath });
        return true;
      }
      return false;
    } catch (error) {
      this.logger.debug('Failed to remove checkpoint', { checkpointPath, error });
      return false;
    }
  }

  /**
   * Очищает все временные файлы
   */
  async cleanup(): Promise<void> {
    // Удаляем чекпоинты
    for (const checkpoint of this.checkpoints) {
      try {
        if (fs.existsSync(checkpoint)) {
          await fs.promises.unlink(checkpoint);
        }
      } catch (error) {
        this.logger.debug('Failed to remove checkpoint', { checkpoint, error });
      }
    }
    this.checkpoints = [];

    // Удаляем рабочие копии
    for (const workingCopy of this.workingCopies) {
      try {
        if (fs.existsSync(workingCopy)) {
          await fs.promises.unlink(workingCopy);
        }
      } catch (error) {
        this.logger.debug('Failed to remove working copy', { workingCopy, error });
      }
    }
    this.workingCopies = [];

    this.logger.debug('Cleanup completed', {
      checkpointsRemoved: this.checkpoints.length,
      workingCopiesRemoved: this.workingCopies.length,
    });
  }

  /**
   * Очищает временные файлы в директории
   */
  async cleanupDirectory(directory: string): Promise<void> {
    try {
      if (!fs.existsSync(directory)) {
        return;
      }
      const files = await fs.promises.readdir(directory);
      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = await fs.promises.stat(filePath);
        if (stat.isFile()) {
          if (
            filePath.includes('.checkpoint.') ||
            filePath.includes('.working-copy.') ||
            filePath.includes('.full-backup.')
          ) {
            try {
              await fs.promises.unlink(filePath);
              cleanedCount++;
              this.logger.debug('Cleaned up temp file', { filePath });
            } catch (error) {
              this.logger.debug('Failed to remove temp file', { filePath, error });
            }
          }
        }
      }
      if (cleanedCount > 0) {
        this.logger.debug('Directory cleanup completed', { directory, cleanedCount });
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup directory', { directory, error });
    }
  }

  /**
   * Получить список всех бэкапов
   */
  getBackups(): string[] {
    return [...this.backups];
  }

  /**
   * Получить список всех чекпоинтов
   */
  getCheckpoints(): string[] {
    return [...this.checkpoints];
  }

  /**
   * Очистить все бэкапы
   */
  async clearAllBackups(): Promise<void> {
    for (const backup of this.backups) {
      try {
        if (fs.existsSync(backup)) {
          await fs.promises.unlink(backup);
        }
      } catch (error) {
        this.logger.debug('Failed to remove backup', { backup, error });
      }
    }
    this.backups = [];
  }

  /**
   * Проверяет, существует ли бэкап
   */
  hasBackups(): boolean {
    return this.backups.length > 0;
  }

  /**
   * Проверяет, существует ли чекпоинт
   */
  hasCheckpoints(): boolean {
    return this.checkpoints.length > 0;
  }

  /**
   * Возвращает последний бэкап
   */
  getLastBackup(): string | null {
    if (this.backups.length === 0) return null;
    return this.backups[this.backups.length - 1] || null;
  }

  /**
   * Возвращает последний чекпоинт
   */
  getLastCheckpoint(): string | null {
    if (this.checkpoints.length === 0) return null;
    return this.checkpoints[this.checkpoints.length - 1] || null;
  }
}
