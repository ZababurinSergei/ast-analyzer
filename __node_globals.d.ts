// Node.js global declarations
declare module 'fs' {
  export * from 'fs';
  export default fs;
}

declare module 'fs/promises' {
  export * from 'fs/promises';
  export default fsPromises;
}

declare module 'path' {
  export * from 'path';
  export default path;
}

declare module 'url' {
  export * from 'url';
  export default url;
}

declare module 'process' {
  export * from 'process';
  export default process;
}

declare module 'util' {
  export * from 'util';
  export default util;
}

declare module 'crypto' {
  export * from 'crypto';
  export default crypto;
}

declare module 'stream' {
  export * from 'stream';
  export default stream;
}

declare module 'events' {
  export * from 'events';
  export default events;
}

declare module 'child_process' {
  export * from 'child_process';
  export default child_process;
}

declare module 'os' {
  export * from 'os';
  export default os;
}

declare module 'http' {
  export * from 'http';
  export default http;
}

declare module 'https' {
  export * from 'https';
  export default https;
}

declare module 'zlib' {
  export * from 'zlib';
  export default zlib;
}

declare module 'assert' {
  export * from 'assert';
  export default assert;
}

declare module 'buffer' {
  export * from 'buffer';
  export default buffer;
}

declare module 'tty' {
  export * from 'tty';
  export default tty;
}

declare module 'readline' {
  export * from 'readline';
  export default readline;
}

declare module 'string_decoder' {
  export * from 'string_decoder';
  export default string_decoder;
}

// Global variables
declare const process: NodeJS.Process;
declare const __dirname: string;
declare const __filename: string;
declare const require: NodeJS.Require;
declare const module: NodeJS.Module;
declare const exports: any;
