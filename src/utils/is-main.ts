// src/utils/is-main.ts
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Универсальная проверка, запущен ли текущий файл как основной
 * Работает на Windows, Linux, macOS с nvm/npm link
 */
export function isMainModule(importMetaUrl: string): boolean {
  if (!process.argv[1]) return false;
  const currentName = path.basename(fileURLToPath(importMetaUrl));
  const mainName = path.basename(process.argv[1]);
  return currentName === mainName;
}

export default isMainModule;
