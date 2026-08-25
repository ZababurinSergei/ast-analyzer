// src/modes/vue-analyzer/parser.ts

import fs from 'fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import type { SFCDescriptor, SFCScriptBlock } from '@vue/compiler-sfc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Парсинг Vue файла
 */
export function parseVueFile(filePath: string): {
  descriptor: SFCDescriptor;
  errors: Error[];
} | null {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const { descriptor, errors } = parse(source, {
      filename: filePath,
      sourceMap: false,
    });

    if (errors.length > 0) {
      console.warn(`⚠️ Ошибки при парсинге ${filePath}:`, errors);
    }

    return { descriptor, errors };
  } catch (error) {
    console.error(`❌ Ошибка парсинга Vue файла ${filePath}:`, error);
    return null;
  }
}

/**
 * 🔧 Поиск TypeScript в проекте
 */
function findTypeScriptPath(): string | undefined {
  try {
    // 1. Пробуем найти через require.resolve
    const tsPath = require.resolve('typescript', {
      paths: [process.cwd()],
    });
    return path.dirname(tsPath);
  } catch (error) {
    // 2. Проверяем возможные пути
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'typescript'),
      path.join(__dirname, '../../node_modules/typescript'),
      path.join(__dirname, '../../../node_modules/typescript'),
      path.join(process.cwd(), 'node_modules', 'typescript'),
      path.join(process.cwd(), '..', 'node_modules', 'typescript'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return undefined;
  }
}

/**
 * ✅ ИСПРАВЛЕННАЯ функция компиляции script блока
 */
export function compileScriptBlock(
  descriptor: SFCDescriptor,
  filePath: string
): SFCScriptBlock | null {
  try {
    if (!descriptor.script && !descriptor.scriptSetup) {
      return null;
    }

    // 🔍 Находим TypeScript
    const tsPath = findTypeScriptPath();
    if (tsPath) {
      console.log(`   🔧 TypeScript найден: ${tsPath}`);
    }

    // ✅ Пытаемся скомпилировать с поддержкой TypeScript
    try {
      const script = compileScript(descriptor, {
        id: filePath,
        isProd: false,
        fs: {
          fileExists: (file: string) => fs.existsSync(file),
          readFile: (file: string) => {
            try {
              return fs.readFileSync(file, 'utf-8');
            } catch {
              return undefined;
            }
          },
        },
        babelParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
        // ✅ Указываем путь к TypeScript
        ...(tsPath
          ? {
              compilerOptions: {
                typescript: tsPath,
              },
            }
          : {}),
      });

      return script;
    } catch (compileError) {
      // ✅ Если компиляция не удалась, возвращаем null для использования AST fallback
      console.debug(`   ℹ️ Компиляция через @vue/compiler-sfc не удалась, используем AST fallback`);
      return null;
    }
  } catch (error) {
    console.debug(`   ⚠️ Ошибка в compileScriptBlock:`, error);
    return null;
  }
}

// Экспорт по умолчанию
export default {
  parseVueFile,
  compileScriptBlock,
};
