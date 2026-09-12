// debug-exports.ts
// ============================================
// ОТЛАДОЧНЫЙ СКРИПТ ДЛЯ ДИАГНОСТИКИ ЭКСПОРТОВ
// ============================================
// Запуск: npx tsx debug-exports.ts
// ============================================

import { parseFile } from './src/core/ast-parser.js';
import { extractEntitiesFromFile } from './src/reporters/json-reporter.js';

const indexFile = './src/index.ts';

// ============================================
// 1. ПРОВЕРКА parseFile
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 1. Проверка parseFile ===');
console.log('='.repeat(70));

const parsed = parseFile(indexFile);
console.log('parsed:', parsed ? 'OK' : 'NULL');
console.log('exports count:', parsed?.exports?.length || 0);

if (parsed?.exports) {
    console.log('\nПервые 20 экспортов из parseFile:');
    for (const exp of parsed.exports.slice(0, 20)) {
        console.log(
            `  ${exp.name} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
        );
    }
}

// ============================================
// 2. ПРОВЕРКА extractEntitiesFromFile ДЛЯ index.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 2. Проверка extractEntitiesFromFile (index.ts) ===');
console.log('='.repeat(70));

const entities = extractEntitiesFromFile(indexFile);
console.log('functions:', entities.functions?.length || 0);
console.log('exports:', entities.exports?.length || 0);
console.log('imports:', entities.imports?.length || 0);

if (entities.exports) {
    console.log('\nПервые 20 экспортов из extractEntitiesFromFile:');
    for (const exp of entities.exports.slice(0, 20)) {
        console.log(
            `  ${exp.name} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
        );
    }
}

// ============================================
// 3. ПРОВЕРКА core/ast-parser.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 3. Проверка core/ast-parser.ts ===');
console.log('='.repeat(70));

const astParserEntities = extractEntitiesFromFile('./src/core/ast-parser.ts');
console.log('functions:', astParserEntities.functions?.length || 0);
console.log('constants:', astParserEntities.constants?.length || 0);
console.log('imports:', astParserEntities.imports?.length || 0);
console.log('exports:', astParserEntities.exports?.length || 0);

console.log('\nПервые 15 функций:');
for (const func of (astParserEntities.functions || []).slice(0, 15)) {
    console.log(`  ${func.name} (exported: ${func.isExported}, line: ${func.line})`);
}

console.log('\nЭкспорты из ast-parser.ts:');
for (const exp of (astParserEntities.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

// Проверяем наличие ключевых функций
const astParserFuncNames = (astParserEntities.functions || []).map(f => f.name);
console.log('\nПроверка ключевых функций:');
for (const name of ['parseFile', 'isExternalModule', 'resolveFilePath', 'collectExportsFromAST']) {
    const found = astParserFuncNames.includes(name);
    const func = (astParserEntities.functions || []).find(f => f.name === name);
    console.log(
        `  ${name}: ${found ? `✅ (exported: ${func?.isExported})` : '❌ НЕ НАЙДЕНА'}`
    );
}

// ============================================
// 4. ПРОВЕРКА core/minifier.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 4. Проверка core/minifier.ts ===');
console.log('='.repeat(70));

const minifierEntities = extractEntitiesFromFile('./src/core/minifier.ts');
console.log('functions:', minifierEntities.functions?.length || 0);
console.log('constants:', minifierEntities.constants?.length || 0);
console.log('exports:', minifierEntities.exports?.length || 0);

console.log('\nПервые 15 функций:');
for (const func of (minifierEntities.functions || []).slice(0, 15)) {
    console.log(`  ${func.name} (exported: ${func.isExported}, line: ${func.line})`);
}

console.log('\nЭкспорты из minifier.ts:');
for (const exp of (minifierEntities.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

const minifierFuncNames = (minifierEntities.functions || []).map(f => f.name);
console.log('\nПроверка ключевых функций:');
for (const name of ['minifyCodeString', 'minifyForAI']) {
    const found = minifierFuncNames.includes(name);
    const func = (minifierEntities.functions || []).find(f => f.name === name);
    console.log(
        `  ${name}: ${found ? `✅ (exported: ${func?.isExported})` : '❌ НЕ НАЙДЕНА'}`
    );
}

// ============================================
// 5. ПРОВЕРКА core/IdManager.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 5. Проверка core/IdManager.ts ===');
console.log('='.repeat(70));

const idManagerEntities = extractEntitiesFromFile('./src/core/IdManager.ts');
console.log('functions:', idManagerEntities.functions?.length || 0);
console.log('classes:', idManagerEntities.classes?.length || 0);
console.log('constants:', idManagerEntities.constants?.length || 0);
console.log('exports:', idManagerEntities.exports?.length || 0);

console.log('\nПервые 15 функций:');
for (const func of (idManagerEntities.functions || []).slice(0, 15)) {
    console.log(`  ${func.name} (exported: ${func.isExported}, line: ${func.line})`);
}

console.log('\nКлассы:');
for (const cls of (idManagerEntities.classes || []).slice(0, 10)) {
    console.log(`  ${cls.name} (exported: ${cls.isExported})`);
}

console.log('\nЭкспорты из IdManager.ts:');
for (const exp of (idManagerEntities.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

// ============================================
// 6. ПРОВЕРКА core/graph-utils.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 6. Проверка core/graph-utils.ts ===');
console.log('='.repeat(70));

const graphUtilsEntities = extractEntitiesFromFile('./src/core/graph-utils.ts');
console.log('functions:', graphUtilsEntities.functions?.length || 0);
console.log('exports:', graphUtilsEntities.exports?.length || 0);

console.log('\nФункции:');
for (const func of (graphUtilsEntities.functions || []).slice(0, 15)) {
    console.log(`  ${func.name} (exported: ${func.isExported}, line: ${func.line})`);
}

console.log('\nЭкспорты:');
for (const exp of (graphUtilsEntities.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

// ============================================
// 7. ПРОВЕРКА core/tsconfig-resolver.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 7. Проверка core/tsconfig-resolver.ts ===');
console.log('='.repeat(70));

const tsconfigEntities = extractEntitiesFromFile('./src/core/tsconfig-resolver.ts');
console.log('functions:', tsconfigEntities.functions?.length || 0);
console.log('exports:', tsconfigEntities.exports?.length || 0);

console.log('\nФункции:');
for (const func of (tsconfigEntities.functions || []).slice(0, 15)) {
    console.log(`  ${func.name} (exported: ${func.isExported}, line: ${func.line})`);
}

// ============================================
// 8. ИТОГОВАЯ СВОДКА
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 8. ИТОГОВАЯ СВОДКА ===');
console.log('='.repeat(70));

const summary = [
    { file: 'index.ts', entities: entities },
    { file: 'core/ast-parser.ts', entities: astParserEntities },
    { file: 'core/minifier.ts', entities: minifierEntities },
    { file: 'core/IdManager.ts', entities: idManagerEntities },
    { file: 'core/graph-utils.ts', entities: graphUtilsEntities },
    { file: 'core/tsconfig-resolver.ts', entities: tsconfigEntities },
];

console.log('\n| Файл | Функции | Экспорты | Реэкспорты |');
console.log('|------|---------|----------|------------|');

for (const { file, entities } of summary) {
    const funcsCount = entities.functions?.length || 0;
    const exportsCount = entities.exports?.length || 0;
    const reExportsCount = (entities.exports || []).filter(e => e.isReExport).length;
    console.log(`| ${file} | ${funcsCount} | ${exportsCount} | ${reExportsCount} |`);
}

// ============================================
// 9. ПРОВЕРКА СВЯЗИ: index.ts → core/ast-parser.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 9. ПРОВЕРКА СВЯЗИ index.ts → core/ast-parser.ts ===');
console.log('='.repeat(70));

const indexExports = entities.exports || [];
const astParserFuncNamesSet = new Set(astParserFuncNames);

console.log('\nПроверяем, что экспорты index.ts имеют соответствующие функции в ast-parser.ts:');
let matched = 0;
let unmatched = 0;

for (const exp of indexExports) {
    if (!exp.isReExport) continue;
    if (exp.source && !exp.source.includes('ast-parser')) continue;

    const expName = exp.name || '';
    if (astParserFuncNamesSet.has(expName)) {
        matched++;
        if (matched <= 5) {
            console.log(`  ✅ ${expName} — найдена в ast-parser.ts`);
        }
    } else {
        unmatched++;
        if (unmatched <= 5) {
            console.log(`  ❌ ${expName} — НЕ найдена в ast-parser.ts`);
        }
    }
}

console.log(`\nИтого: matched=${matched}, unmatched=${unmatched}`);

// ============================================
// 10. ПРОВЕРКА isExported У ФУНКЦИЙ В ast-parser.ts
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 10. Проверка isExported в ast-parser.ts ===');
console.log('='.repeat(70));

const exportedFuncs = (astParserEntities.functions || []).filter(f => f.isExported);
const notExportedFuncs = (astParserEntities.functions || []).filter(f => !f.isExported);

console.log(`Всего функций: ${astParserEntities.functions?.length || 0}`);
console.log(`  isExported=true: ${exportedFuncs.length}`);
console.log(`  isExported=false: ${notExportedFuncs.length}`);

console.log('\nФункции с isExported=false (первые 20):');
for (const func of notExportedFuncs.slice(0, 20)) {
    console.log(`  ${func.name} (line: ${func.line})`);
}

console.log('\nФункции с isExported=true (первые 20):');
for (const func of exportedFuncs.slice(0, 20)) {
    console.log(`  ${func.name} (line: ${func.line})`);
}

// ============================================
// 11. СРАВНЕНИЕ parseFile И extractEntitiesFromFile
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== 11. Сравнение parseFile и extractEntitiesFromFile ===');
console.log('='.repeat(70));

const parsedAstParser = parseFile('./src/core/ast-parser.ts');
console.log('parseFile для ast-parser.ts:');
console.log(`  exports: ${parsedAstParser?.exports?.length || 0}`);
console.log(`  imports: ${parsedAstParser?.imports?.length || 0}`);

console.log('\nparseFile экспорты (первые 20):');
for (const exp of (parsedAstParser?.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

console.log('\nextractEntitiesFromFile экспорты (первые 20):');
for (const exp of (astParserEntities.exports || []).slice(0, 20)) {
    console.log(
        `  ${exp.name} | type: ${exp.type} | isReExport: ${exp.isReExport} | source: ${exp.source || 'none'}`
    );
}

// ============================================
// 12. ФИНАЛЬНЫЙ ВЫВОД
// ============================================
console.log('\n' + '='.repeat(70));
console.log('=== ДИАГНОСТИКА ЗАВЕРШЕНА ===');
console.log('='.repeat(70));

if (entities.functions?.length === 0 && entities.exports && entities.exports.length > 0) {
    console.log('\n🎯 ВЫВОД: index.ts содержит только реэкспорты (barrel-файл).');
    console.log('   Это НОРМАЛЬНО для index.ts.');
    console.log('   Функции должны находиться в других файлах (core/*.ts).');
}

if (astParserEntities.functions && astParserEntities.functions.length > 0) {
    console.log('\n🎯 ВЫВОД: ast-parser.ts содержит функции.');
    console.log(`   Всего: ${astParserEntities.functions.length}`);
    console.log(`   Экспортированных: ${exportedFuncs.length}`);
} else {
    console.log('\n❌ ПРОБЛЕМА: ast-parser.ts НЕ содержит функций!');
    console.log('   Это означает, что extractEntitiesFromFile не может извлечь функции.');
    console.log('   Проверьте entity-extractor.ts.');
}

console.log('\n' + '='.repeat(70));
console.log('Для дальнейшей диагностики запустите:');
console.log('  npx tsx debug-exports.ts 2>&1 | tee debug-output.txt');
console.log('='.repeat(70) + '\n');
