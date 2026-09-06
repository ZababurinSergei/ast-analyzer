// packages/ast-analyzer/esbuild.bundle.config.js
import esbuild from 'esbuild';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
  'string_decoder'
];

// Функция для копирования WASM файлов
function copyWasmFiles() {
  console.log('\n📋 Copying WASM files...');

  const wasmDestDir = resolve(__dirname, 'dist/wasm');
  if (!fs.existsSync(wasmDestDir)) {
    fs.mkdirSync(wasmDestDir, { recursive: true });
  }

  let copiedCount = 0;
  const copiedFiles = [];

  // 1. Копируем из src/grammars (основные WASM файлы)
  const srcGrammarsDir = resolve(__dirname, 'src/grammars');
  if (fs.existsSync(srcGrammarsDir)) {
    try {
      const files = fs.readdirSync(srcGrammarsDir);
      console.log(`   📂 Found ${files.length} files in src/grammars`);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(srcGrammarsDir, file);
          const destPath = join(wasmDestDir, file);
          fs.copyFileSync(srcPath, destPath);
          console.log(`   ✅ Copied: ${file} (from src/grammars)`);
          copiedCount++;
          copiedFiles.push(file);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not copy from src/grammars: ${error}`);
    }
  }

  // 2. Копируем из tree-sitter-wasms/out
  const tsWasmDir = resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out');
  if (fs.existsSync(tsWasmDir)) {
    try {
      const files = fs.readdirSync(tsWasmDir);
      console.log(`   📂 Found ${files.length} files in tree-sitter-wasms/out`);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(tsWasmDir, file);
          const destPath = join(wasmDestDir, file);
          // Проверяем, не скопирован ли уже этот файл
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
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
  if (fs.existsSync(cfWasmDir)) {
    try {
      const files = fs.readdirSync(cfWasmDir);
      console.log(`   📂 Found ${files.length} files in @codeflow-map/wasm`);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          const srcPath = join(cfWasmDir, file);
          const destPath = join(wasmDestDir, file);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
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

  // 4. Дополнительно проверяем наличие tree-sitter.wasm
  const treeSitterPath = join(wasmDestDir, 'tree-sitter.wasm');
  if (!fs.existsSync(treeSitterPath)) {
    console.warn('   ⚠️ tree-sitter.wasm not found! Trying to copy from node_modules...');

    // Ищем tree-sitter.wasm в node_modules
    const possiblePaths = [
      resolve(process.cwd(), 'node_modules/web-tree-sitter/tree-sitter.wasm'),
      resolve(process.cwd(), 'node_modules/tree-sitter-wasms/out/tree-sitter.wasm'),
      resolve(process.cwd(), 'node_modules/@codeflow-map/wasm/tree-sitter.wasm'),
      resolve(process.cwd(), 'node_modules/tree-sitter/tree-sitter.wasm'),
    ];

    let found = false;
    for (const srcPath of possiblePaths) {
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, treeSitterPath);
        console.log(`   ✅ Copied tree-sitter.wasm from: ${srcPath}`);
        copiedCount++;
        copiedFiles.push('tree-sitter.wasm');
        found = true;
        break;
      }
    }

    if (!found) {
      console.error('   ❌ CRITICAL: tree-sitter.wasm not found anywhere!');
      console.error('   💡 Please install: npm install web-tree-sitter');
      console.error('   💡 Or copy tree-sitter.wasm to src/grammars/ manually');
    }
  } else {
    console.log('   ✅ tree-sitter.wasm already exists in dist/wasm');
  }

  // 5. Проверяем наличие всех необходимых WASM файлов
  const requiredFiles = [
    'tree-sitter.wasm',
    'tree-sitter-typescript.wasm',
    'tree-sitter-javascript.wasm',
    'tree-sitter-vue.wasm',
    'tree-sitter-tsx.wasm',
  ];

  console.log('\n   📋 Checking required WASM files:');
  let allRequiredFound = true;
  for (const required of requiredFiles) {
    const filePath = join(wasmDestDir, required);
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ ${required}`);
    } else {
      console.log(`   ❌ ${required} - MISSING!`);
      allRequiredFound = false;
    }
  }

  if (!allRequiredFound) {
    console.warn('\n   ⚠️ Some required WASM files are missing!');
    console.warn('   💡 Call Graph analysis for some languages may be limited.');
  }

  console.log(`\n   📦 Total WASM files copied: ${copiedCount}`);
  console.log(`   📋 Files: ${copiedFiles.join(', ')}`);

  if (copiedCount === 0) {
    console.log('   ⚠️ No WASM files found! Call Graph analysis will be limited.');
  }
}

const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  outfile: 'dist/index.js',
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
          const content = await fs.promises.readFile(args.path, 'utf8');
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
      name: 'ensure-wasm-permissions',
      setup(build) {
        build.onEnd(async () => {
          const wasmDir = resolve(__dirname, 'dist/wasm');
          if (fs.existsSync(wasmDir)) {
            try {
              const files = fs.readdirSync(wasmDir);
              for (const file of files) {
                if (file.endsWith('.wasm')) {
                  const filePath = join(wasmDir, file);
                  fs.chmodSync(filePath, 0o644);
                }
              }
              console.log('   ✅ WASM file permissions set');
            } catch (error) {
              console.warn(`   ⚠️ Could not set permissions: ${error}`);
            }
          }
        });
      },
    },
  ],
};

console.log('📦 Building single bundle...');
console.log(`🔧 Production mode: ${isProduction ? 'ON' : 'OFF'}`);

try {
  const result = await esbuild.build(buildOptions);
  console.log('\n✅ Bundle built successfully!');
  console.log(`📁 Output: ${resolve(__dirname, 'dist/index.js')}`);

  if (result.errors.length > 0) {
    console.error('\n❌ Build errors:', result.errors);
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️ Build warnings:', result.warnings);
  }

  // Проверяем размер бандла
  const stats = fs.statSync(resolve(__dirname, 'dist/index.js'));
  console.log(`📊 Bundle size: ${(stats.size / 1024).toFixed(2)} KB`);

  // Проверяем наличие WASM файлов после сборки
  const wasmDir = resolve(__dirname, 'dist/wasm');
  if (fs.existsSync(wasmDir)) {
    const wasmFiles = fs.readdirSync(wasmDir).filter(f => f.endsWith('.wasm'));
    console.log(`📊 WASM files in dist/wasm: ${wasmFiles.length}`);

    // Проверяем tree-sitter.wasm
    if (wasmFiles.includes('tree-sitter.wasm')) {
      console.log('   ✅ tree-sitter.wasm present');
    } else {
      console.error('   ❌ tree-sitter.wasm is MISSING!');
      console.error('   💡 This will cause errors when using Call Graph analysis');
    }
  }

  console.log('\n✨ Bundle build complete!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
