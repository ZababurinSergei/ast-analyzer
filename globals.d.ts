// packages/ast-analyzer/globals.d.ts

// Node.js глобальные модули
declare module 'fs' {
  export * from 'fs';
}

declare module 'fs/promises' {
  export * from 'fs/promises';
}

declare module 'path' {
  export * from 'path';
}

declare module 'url' {
  export * from 'url';
}

declare module 'process' {
  export * from 'process';
}

declare module 'util' {
  export * from 'util';
}

declare module 'crypto' {
  export * from 'crypto';
}

declare module 'stream' {
  export * from 'stream';
}

declare module 'events' {
  export * from 'events';
}

declare module 'child_process' {
  export * from 'child_process';
}

declare module 'os' {
  export * from 'os';
}

declare module 'http' {
  export * from 'http';
}

declare module 'https' {
  export * from 'https';
}

declare module 'zlib' {
  export * from 'zlib';
}

declare module 'assert' {
  export * from 'assert';
}

declare module 'buffer' {
  export * from 'buffer';
}

declare module 'tty' {
  export * from 'tty';
}

declare module 'readline' {
  export * from 'readline';
}

declare module 'string_decoder' {
  export * from 'string_decoder';
}

// Глобальные переменные Node.js
declare const process: NodeJS.Process;
declare const __dirname: string;
declare const __filename: string;
declare const require: NodeJS.Require;
declare const module: NodeJS.Module;
declare const exports: any;

// Глобальные типы для обратной совместимости
declare type NodeJS = any;
