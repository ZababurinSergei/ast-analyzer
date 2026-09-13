// // decode.js
// import fs from 'fs';
// import { readAndDecode } from './src/index.js';
//
// const compactPath = './src/process/index.json';
// const outputPath = './index.full.json';
//
// // readAndDecode читает CompactJSON из файла и возвращает FullJSON
// const full = readAndDecode(compactPath);
//
// fs.writeFileSync(outputPath, JSON.stringify(full, null, 2));
// console.log(`✅ Decoded: ${outputPath}`);
// console.log(`   Модулей:     ${full.modules.length}`);
// console.log(`   Файлов:      ${full.files.length}`);
// console.log(`   Функций:     ${full.functions.length}`);
// console.log(`   Классов:     ${full.classes.length}`);
// console.log(`   Констант:    ${full.constants.length}`);
// console.log(`   Экспортов:   ${full.exports.length}`);
// console.log(`   Импортов:    ${full.imports.length}`);
// console.log(`   Вызовов:     ${full.calls.length}`);
// console.log(`   Реэкспортов: ${full.reExports.length}`);
// ==============================================================================================
// import fs from 'fs';
// import { Codec } from './src/index.js';

// const raw = JSON.parse(fs.readFileSync('./src/process/index.json', 'utf-8'));
// const full = Codec.decode(raw);

// fs.writeFileSync('./index.full.2.json', JSON.stringify(full, null, 2));

// ==============================================================================================
import { Codec } from './src/index.js';
import fs from 'fs';

const compact = JSON.parse(fs.readFileSync('./src/process/index.json', 'utf-8'));
const full = Codec.decode(compact);

// Проверяем round-trip: полный → сжатый → полный
const reEncoded = Codec.encode(full);
const reDecoded = Codec.decode(reEncoded);

console.log('Round-trip OK:', JSON.stringify(full) === JSON.stringify(reDecoded));
