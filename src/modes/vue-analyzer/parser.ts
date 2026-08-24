// src/modes/vue-analyzer/parser.ts

import fs from 'fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import type { SFCDescriptor, SFCScriptBlock } from '@vue/compiler-sfc';

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
 * Компиляция script блока
 */
export function compileScriptBlock(descriptor: SFCDescriptor, filePath: string): SFCScriptBlock | null {
  try {
    if (!descriptor.script && !descriptor.scriptSetup) {
      return null;
    }

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
      babelParserPlugins: ['typescript', 'jsx'],
    });

    return script;
  } catch (error) {
    console.warn(`⚠️ Ошибка компиляции script в ${filePath}:`, error);
    return null;
  }
}

// Экспорт по умолчанию
export default {
  parseVueFile,
  compileScriptBlock,
};