// src/process/process_meta.mjs
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SHORT_KEYS = {
  functionIndex: 'fi',
  fileIndex: 'fl',
  moduleIndex: 'mi',
  functions: 'fns',
  constants: 'cn',
  files: 'fls',
  modules: 'mods',
  exports: 'exps',
  imports: 'imps',
  externalLibs: 'ext',
  stats: 'st',
  totalFunctions: 'tf',
  totalCalls: 'tc',
  totalModules: 'tm',
  totalFiles: 'tfils',
  totalImports: 'ti',
  totalExports: 'te',
  totalUnused: 'tun',
  totalReExports: 'tre',
  totalInheritance: 'tr',
  totalTypeDeps: 'ttd',
  totalConstants: 'tcn',
  totalConstExports: 'tce',
  totalConstUses: 'tuc',
  totalConstDeps: 'tcd',
  totalSelfFunctions: 'tsf',
  hasCycles: 'cy',
  timestamp: 'ts',
  version: 'v',
  root: 'r',
  asyncCount: 'async',
  avgCalls: 'avgCalls',
  maxCalls: 'maxCalls',
  isolated: 'isolated',
  funcsWithCalls: 'funcsWithCalls',
  calledFuncs: 'calledFuncs',
  modulesWithFunctions: 'modulesWithFunctions',
  filesWithFunctions: 'filesWithFunctions',
  exportedWithCalls: 'exportedWithCalls',
  defaultExports: 'defaultExports',
  typeExports: 'typeExports',
  typeImports: 'typeImports',
  dynamicImports: 'di',
  configRefs: 'cfg',
  externalLibsCount: 'ext',
  vueTemplates: 'vt',
  asyncChains: 'asyncChains',
  closures: 'closures',
  reflections: 'reflections',
  typeDeps: 'typeDeps',
};

const FLAG_MAP = {
  a: 'standard',
  e: 'exported',
  m: 'method',
  r: 'arrow',
  v: 'vue',
  n: 'nested',
  s: 'self',
  d: 'dead',
  c: 'cyclic',
  x: 'external',
  t: 'type',
  l: 'lazy',
  y: 'async',
};

function reverseShortKeys() {
  const map = {};
  for (const [full, short] of Object.entries(SHORT_KEYS)) {
    map[short] = full;
  }
  return map;
}

const LONG_KEYS = reverseShortKeys();

function decodeFlags(flags) {
  if (!flags || typeof flags !== 'string') return [];
  const result = [];
  for (const char of flags) {
    if (FLAG_MAP[char]) result.push(FLAG_MAP[char]);
  }
  return result;
}

function expandObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => expandObject(item));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const longKey = LONG_KEYS[key] || key;
    result[longKey] = expandObject(value);
  }
  return result;
}

function decode(data) {
  const result = expandObject(data);

  // Decode flags in stats
  if (result.flg) {
    result.flags = {};
    for (const [key, value] of Object.entries(result.flg)) {
      result.flags[value] = decodeFlags(key);
    }
  }

  // Decode function flags if present
  if (result.fns && Array.isArray(result.fns)) {
    result.fns = result.fns.map(fn => {
      if (Array.isArray(fn) && fn.length >= 7) {
        // fn = [id, name, module, file, line, type, flags?]
        const decoded = {
          id: fn[0],
          name: fn[1],
          module: fn[2],
          file: fn[3],
          line: fn[4],
          type: fn[5],
        };
        if (fn[6]) {
          decoded.flags = decodeFlags(fn[6]);
        }
        return decoded;
      }
      return fn;
    });
  }

  // Decode constants if present
  if (result.cn && Array.isArray(result.cn)) {
    result.constants = result.cn.map(c => {
      if (Array.isArray(c) && c.length >= 6) {
        // cn = [id, name, value, module, file, line, type?, flags?]
        const decoded = {
          id: c[0],
          name: c[1],
          value: c[2],
          module: c[3],
          file: c[4],
          line: c[5],
        };
        if (c[6]) decoded.type = c[6];
        if (c[7]) decoded.flags = decodeFlags(c[7]);
        return decoded;
      }
      return c;
    });
  }

  // Decode self-functions if present
  if (result.sf && Array.isArray(result.sf)) {
    result.selfFunctions = result.sf.map(sf => {
      if (Array.isArray(sf) && sf.length >= 4) {
        return {
          id: sf[0],
          name: sf[1],
          file: sf[2],
          line: sf[3],
        };
      }
      return sf;
    });
  }

  // Expand graph data
  if (result.gr) {
    result.graph = expandObject(result.gr);
  }

  // Move root module to readable
  if (result.r) {
    result.rootModule = result.r;
  }

  // Expand shortened stats
  if (result.st) {
    result.statistics = expandObject(result.st);
  }

  return result;
}

function decodeJsonFile(inputPath, outputPath) {
  const content = readFileSync(inputPath, 'utf8');
  const data = JSON.parse(content);
  const decoded = decode(data);
  writeFileSync(outputPath, JSON.stringify(decoded, null, 2), 'utf8');
  console.log(`✅ Decoded: ${inputPath} -> ${outputPath}`);
}

// CLI
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node decoder.mjs <input.json> [output.json]');
  process.exit(1);
}

const outputFile = process.argv[3] || inputFile.replace(/\.json$/, '.decoded.json');
decodeJsonFile(inputFile, outputFile);

export { decode, decodeJsonFile, decodeFlags };
