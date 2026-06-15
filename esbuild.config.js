// packages/ast-analyzer/esbuild.config.js
import esbuild from 'esbuild';
import { readdirSync, existsSync, statSync, copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProduction = process.env.NODE_ENV === 'production';

// Находим все entry points рекурсивно
function findEntryPoints(dir, baseDir = dir) {
  const entries = [];

  if (!existsSync(dir)) {
    console.warn(`⚠️ Directory does not exist: ${dir}`);
    return entries;
  }

  try {
    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const fullPath = resolve(dir, file.name);

      try {
        if (file.isDirectory()) {
          entries.push(...findEntryPoints(fullPath, baseDir));
        } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
          if (
            file.name === 'cli.ts' ||
            file.name === 'cli-refactor.ts' ||
            file.name === 'cli-cicd.ts' ||
            file.name === 'cli-ts-validator.ts' ||
            file.name === 'index.ts' ||
            fullPath.includes('/modes/') ||
            fullPath.includes('/core/') ||
            fullPath.includes('/reporters/') ||
            fullPath.includes('/refactor/') ||
            fullPath.includes('/semantic/') ||
            fullPath.includes('/formal/') ||
            fullPath.includes('/ci-cd/')
          ) {
            entries.push(resolve(fullPath));
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error reading directory ${dir}:`, error.message);
  }

  return entries;
}

const srcDir = resolve(__dirname, 'src');
const entryPoints = findEntryPoints(srcDir);

console.log(`📦 Building ${entryPoints.length} entry points...`);

// Функция для копирования WASM файлов
function copyWasmFiles() {
  console.log('\n📋 Copying WASM files...');

  const wasmDestDir = resolve(__dirname, 'dist/wasm');
  if (!existsSync(wasmDestDir)) {
    mkdirSync(wasmDestDir, { recursive: true });
  }

  let copiedCount = 0;

  // 1. Копируем из tree-sitter-wasms/out
  const tsWasmDir = resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out');
  if (existsSync(tsWasmDir)) {
    try {
      const files = readdirSync(tsWasmDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(tsWasmDir, file);
          const destPath = join(wasmDestDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied: ${file}`);
          copiedCount++;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from tree-sitter-wasms: ${error}`);
    }
  }

  // 2. Копируем из @codeflow-map/wasm
  const cfWasmDir = resolve(process.cwd(), 'node_modules/@codeflow-map/wasm');
  if (existsSync(cfWasmDir)) {
    try {
      const files = readdirSync(cfWasmDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(cfWasmDir, file);
          const destPath = join(wasmDestDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied: ${file}`);
          copiedCount++;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from @codeflow-map/wasm: ${error}`);
    }
  }

  // 3. Копируем из локальной grammars директории (если есть)
  const localGrammarsDir = resolve(process.cwd(), 'grammars');
  if (existsSync(localGrammarsDir)) {
    try {
      const files = readdirSync(localGrammarsDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(localGrammarsDir, file);
          const destPath = join(wasmDestDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied from grammars: ${file}`);
          copiedCount++;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from grammars: ${error}`);
    }
  }

  // 4. Копируем из callsight-vscode (fallback)
  const callsightGrammarsDir = resolve(process.cwd(), '../../Directory/callsight-vscode/grammars');
  if (existsSync(callsightGrammarsDir)) {
    try {
      const files = readdirSync(callsightGrammarsDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(callsightGrammarsDir, file);
          const destPath = join(wasmDestDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied from callsight-vscode: ${file}`);
          copiedCount++;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from callsight-vscode: ${error}`);
    }
  }

  // Создаём README с инструкцией
  const readmePath = join(wasmDestDir, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeContent = `# WASM Files for Tree-sitter

This directory contains WebAssembly files for Tree-sitter language parsers.

## Required files for JavaScript/TypeScript parsing:
- tree-sitter-javascript.wasm
- tree-sitter-typescript.wasm
- tree-sitter-tsx.wasm

## How to obtain WASM files:

### Option 1: Install tree-sitter-wasms package
\`\`\`bash
pnpm add tree-sitter-wasms
# Then copy from node_modules/tree-sitter-wasms/out/
\`\`\`

### Option 2: Copy from callsight-vscode
\`\`\`bash
cp ../../Directory/callsight-vscode/grammars/*.wasm ./
\`\`\`

### Option 3: Download from CDN
\`\`\`bash
curl -O https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-javascript.wasm
curl -O https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-typescript.wasm
curl -O https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-tsx.wasm
\`\`\`
`;
    writeFileSync(readmePath, readmeContent);
    console.log('   📄 Created README.md');
  }

  console.log(`   📦 Total WASM files copied: ${copiedCount}`);
  if (copiedCount === 0) {
    console.log('   ⚠️ No WASM files found! Call Graph analysis will be limited.');
    console.log('   💡 Run: cp -r ../../Directory/callsight-vscode/grammars/*.wasm grammars/');
  }
}

// Оптимизированный список external packages
const externalPackages = [
  // Node.js built-ins
  'fs',
  'fs/promises',
  'path',
  'url',
  'util',
  'crypto',
  'stream',
  'events',
  'child_process',
  'os',
  'http',
  'https',
  'zlib',
  'assert',
  'buffer',
  'tty',
  'readline',
  'string_decoder',

  // Тяжелые зависимости с нативными модулями
  'z3-solver', // Нативный бинарник Z3

  // Должен быть установлен отдельно пользователем
  'typescript',
];

const buildOptions = {
  entryPoints,
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  keepNames: true,
  treeShaking: true,
  external: externalPackages,
  packages: 'external',
  mainFields: ['module', 'main'],
  loader: {
    '.ts': 'ts',
    '.js': 'js',
    '.mjs': 'js',
    '.cjs': 'js',
    '.wasm': 'binary',
  },
  tsconfig: './tsconfig.json',
  logLevel: 'info',
  logOverride: {
    'unresolved-import': 'warning',
    'missing-explicit-type': 'silent',
  },
  plugins: [
    {
      name: 'resolve-vue-files',
      setup(build) {
        build.onResolve({ filter: /\.vue$/ }, args => ({
          path: args.path,
          namespace: 'vue-file',
        }));

        build.onLoad({ filter: /\.vue$/, namespace: 'vue-file' }, async args => {
          const fsModule = await import('fs');
          const content = await fsModule.promises.readFile(args.path, 'utf8');

          const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
          if (scriptMatch && scriptMatch[1]) {
            return {
              contents: scriptMatch[1],
              loader: 'ts',
            };
          }

          return {
            contents: 'export default {};',
            loader: 'js',
          };
        });
      },
    },
    {
      name: 'copy-wasm-after-build',
      setup(build) {
        build.onEnd(() => {
          copyWasmFiles();
        });
      },
    },
  ],
};

if (isProduction) {
  console.log('🏭 Production build: minifying...');
} else {
  console.log('🔧 Development build: sourcemaps enabled...');
}

try {
  const result = await esbuild.build(buildOptions);
  console.log('\n✅ Build completed successfully!');
  console.log(`📁 Output directory: ${resolve(__dirname, 'dist')}`);

  if (result.errors.length > 0) {
    console.error('\n❌ Build errors:', result.errors);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️ Build warnings:', result.warnings);
  }

  // Выводим информацию о размере бандла
  const distFiles = readdirSync(resolve(__dirname, 'dist'));
  let totalSize = 0;
  for (const file of distFiles) {
    if (file.endsWith('.js')) {
      const size = statSync(resolve(__dirname, 'dist', file)).size;
      totalSize += size;
      console.log(`   📄 ${file}: ${(size / 1024).toFixed(2)} KB`);
    }
  }

  // Проверяем WASM файлы
  const wasmDir = resolve(__dirname, 'dist/wasm');
  if (existsSync(wasmDir)) {
    const wasmFiles = readdirSync(wasmDir);
    console.log(`\n⚙️ WASM files in dist/wasm/: ${wasmFiles.length}`);
    for (const file of wasmFiles.slice(0, 10)) {
      const size = statSync(resolve(wasmDir, file)).size;
      console.log(`   📦 ${file}: ${(size / 1024).toFixed(2)} KB`);
    }
    if (wasmFiles.length > 10) {
      console.log(`   ... and ${wasmFiles.length - 10} more WASM files`);
    }
  } else {
    console.log('\n⚠️ No WASM directory created (no WASM files found)');
  }

  console.log(`\n📊 Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
