// packages/ast-analyzer/esbuild.cli.config.js
import esbuild from 'esbuild';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync, statSync, copyFileSync, mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// Внешние зависимости (не включаются в бандл)
const external = [
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

  // Тяжелые зависимости
  'z3-solver',
  'typescript',
  '@babel/generator',
  '@babel/parser',
  '@babel/traverse',
  '@hpcc-js/dataflow',
  '@hpcc-js/wasm-graphviz',
  '@jitl/ts-simple-type',
  '@typescript-eslint/parser',
  '@vue/compiler-sfc',
  '@vue/compiler-dom',
  'estree-walker',
  'ts-morph',
  'web-tree-sitter',
  '@codeflow-map/core',
  '@codeflow-map/wasm',
  'eslint',
  'commander',
  'glob',
  'vitest',
];

// Функция для копирования WASM файлов
function copyWasmFiles() {
  console.log('\n📋 Copying WASM files...');

  const wasmDestDir = resolve(__dirname, 'dist/wasm');
  if (!existsSync(wasmDestDir)) {
    mkdirSync(wasmDestDir, { recursive: true });
  }

  let copiedCount = 0;
  const copiedFiles = [];

  // 1. Копируем из src/grammars (ОСНОВНОЙ ИСТОЧНИК - содержит tree-sitter.wasm)
  const srcGrammarsDir = resolve(__dirname, 'src/grammars');
  if (existsSync(srcGrammarsDir)) {
    try {
      const files = readdirSync(srcGrammarsDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(srcGrammarsDir, file);
          const destPath = join(wasmDestDir, file);
          copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied: ${file} (from src/grammars)`);
          copiedCount++;
          copiedFiles.push(file);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from src/grammars: ${error}`);
    }
  } else {
    console.warn(`   ⚠️ src/grammars directory not found at: ${srcGrammarsDir}`);
  }

  // 2. Копируем из tree-sitter-wasms/out (дополнительные грамматики)
  const tsWasmDir = resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out');
  if (existsSync(tsWasmDir)) {
    try {
      const files = readdirSync(tsWasmDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(tsWasmDir, file);
          const destPath = join(wasmDestDir, file);
          // Проверяем, не скопирован ли уже этот файл
          if (!existsSync(destPath)) {
            copyFileSync(srcPath, destPath);
            console.log(`   ✅ Copied: ${file} (from tree-sitter-wasms)`);
            copiedCount++;
            copiedFiles.push(file);
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from tree-sitter-wasms: ${error}`);
    }
  }

  // 3. Копируем из @codeflow-map/wasm
  const cfWasmDir = resolve(process.cwd(), 'node_modules/@codeflow-map/wasm');
  if (existsSync(cfWasmDir)) {
    try {
      const files = readdirSync(cfWasmDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(cfWasmDir, file);
          const destPath = join(wasmDestDir, file);
          if (!existsSync(destPath)) {
            copyFileSync(srcPath, destPath);
            console.log(`   ✅ Copied: ${file} (from @codeflow-map/wasm)`);
            copiedCount++;
            copiedFiles.push(file);
          }
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from @codeflow-map/wasm: ${error}`);
    }
  }

  // 4. СПЕЦИАЛЬНАЯ ПРОВЕРКА: tree-sitter.wasm (критически важен)
  const treeSitterPath = join(wasmDestDir, 'tree-sitter.wasm');
  if (!existsSync(treeSitterPath)) {
    console.warn('   ⚠️ tree-sitter.wasm not found! Trying alternatives...');

    // Ищем в различных местах
    const alternatives = [
      resolve(process.cwd(), 'node_modules/web-tree-sitter/tree-sitter.wasm'),
      resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out/tree-sitter.wasm'),
      resolve(process.cwd(), 'node_modules/@codeflow-map/wasm/tree-sitter.wasm'),
      resolve(srcGrammarsDir, 'tree-sitter.wasm'),
    ];

    let found = false;
    for (const srcPath of alternatives) {
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, treeSitterPath);
        console.log(`   ✅ Copied tree-sitter.wasm from: ${srcPath}`);
        copiedCount++;
        copiedFiles.push('tree-sitter.wasm');
        found = true;
        break;
      }
    }

    if (!found) {
      console.error('   ❌ CRITICAL: tree-sitter.wasm not found in any location!');
      console.error('   💡 Please install web-tree-sitter: npm install web-tree-sitter');
      console.error('   💡 Or copy tree-sitter.wasm to src/grammars/ manually');
    }
  } else {
    console.log('   ✅ tree-sitter.wasm already exists in destination');
  }

  // 5. Проверяем общее количество WASM файлов
  const finalFiles = readdirSync(wasmDestDir).filter(f => f.endsWith('.wasm'));
  console.log(`   📦 Total WASM files in dist/wasm: ${finalFiles.length}`);
  console.log(`   📋 Files: ${finalFiles.join(', ')}`);

  if (finalFiles.length === 0) {
    console.warn('   ⚠️ No WASM files found! Call Graph analysis will be limited.');
  }

  // 6. Проверяем наличие основных грамматик
  const requiredGrammars = [
    'tree-sitter.wasm',
    'tree-sitter-typescript.wasm',
    'tree-sitter-javascript.wasm',
    'tree-sitter-vue.wasm',
    'tree-sitter-tsx.wasm',
  ];

  const missingGrammars = requiredGrammars.filter(g => !existsSync(join(wasmDestDir, g)));

  if (missingGrammars.length > 0) {
    console.warn(`   ⚠️ Missing required grammars: ${missingGrammars.join(', ')}`);
    console.warn('   💡 Some analysis features may be limited');
  }
}

const cliEntryPoints = [
  resolve(__dirname, 'src/cli.ts'),
  resolve(__dirname, 'src/cli-refactor.ts'),
  resolve(__dirname, 'src/cli-semantic.ts'),
  resolve(__dirname, 'src/cli-cicd.ts'),
  resolve(__dirname, 'src/cli-ts-validator.ts'),
];

console.log('📦 Building CLI files...');
console.log(`🔧 Production mode: ${isProduction ? 'ON' : 'OFF'}`);
console.log(`📄 Entry points: ${cliEntryPoints.length}`);

const buildOptions = {
  entryPoints: cliEntryPoints,
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  keepNames: true,
  treeShaking: true,
  external,
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
  resolveExtensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
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
            return { contents: scriptMatch[1], loader: 'ts' };
          }
          return { contents: 'export default {};', loader: 'js' };
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
    {
      name: 'ensure-shebang',
      setup(build) {
        build.onEnd(async () => {
          const cliFiles = [
            'cli.js',
            'cli-refactor.js',
            'cli-semantic.js',
            'cli-cicd.js',
            'cli-ts-validator.js',
          ];
          for (const file of cliFiles) {
            const filePath = resolve(__dirname, 'dist', file);
            if (existsSync(filePath)) {
              let content = await import('fs').then(fs => fs.promises.readFile(filePath, 'utf8'));
              if (!content.startsWith('#!/usr/bin/env node')) {
                content = '#!/usr/bin/env node\n' + content;
                await import('fs').then(fs => fs.promises.writeFile(filePath, content));
                console.log(`   ✅ Added shebang to ${file}`);
              }
            }
          }
        });
      },
    },
  ],
};

try {
  const result = await esbuild.build(buildOptions);
  console.log('\n✅ CLI built successfully!');

  if (result.errors.length > 0) {
    console.error('\n❌ Build errors:', result.errors);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️ Build warnings:', result.warnings);
  }

  // Проверяем созданные файлы
  const cliFiles = [
    'cli.js',
    'cli-refactor.js',
    'cli-semantic.js',
    'cli-cicd.js',
    'cli-ts-validator.js',
  ];
  console.log('\n📊 CLI files:');
  for (const file of cliFiles) {
    const filePath = resolve(__dirname, 'dist', file);
    if (existsSync(filePath)) {
      const stats = statSync(filePath);
      console.log(`   ✅ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`   ❌ ${file}: MISSING`);
    }
  }

  // Проверяем WASM директорию
  const wasmDir = resolve(__dirname, 'dist/wasm');
  if (existsSync(wasmDir)) {
    const wasmFiles = readdirSync(wasmDir).filter(f => f.endsWith('.wasm'));
    console.log(`\n📦 WASM files in dist/wasm: ${wasmFiles.length}`);

    // Проверяем наличие tree-sitter.wasm
    if (wasmFiles.includes('tree-sitter.wasm')) {
      console.log('   ✅ tree-sitter.wasm present');
    } else {
      console.warn('   ⚠️ tree-sitter.wasm MISSING!');
    }
  } else {
    console.warn('\n⚠️ dist/wasm directory not found!');
  }

  console.log('\n✨ CLI build complete!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
