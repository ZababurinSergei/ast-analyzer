// scripts/debug-full-json.ts
import fs from 'fs';

const FULL_JSON = './ast-graph-viewer/index.full.json';
const full = JSON.parse(fs.readFileSync(FULL_JSON, 'utf-8'));

console.log('=== Проверка ДУБЛИРОВАНИЯ ===\n');

// 1. Верхний уровень
console.log('full.conditionals.length:', full.conditionals?.length ?? 0);
console.log('full.conditionals[0]:', JSON.stringify(full.conditionals?.[0]));

// 2. Внутри templates
console.log('\nfull.templates.length:', full.templates?.length ?? 0);
for (let i = 0; i < full.templates.length; i++) {
  const t = full.templates[i];
  const cd = t.conditionals;
  if (Array.isArray(cd) && cd.length > 0) {
    console.log(`\ntemplates[${i}].conditionals.length: ${cd.length}`);
    console.log(`templates[${i}].conditionals[0]:`, JSON.stringify(cd[0]));
    console.log(`templates[${i}].conditionals[0] === "[Circular]": ${cd[0] === '[Circular]'}`);
  }
}

// 3. Ищем строки "[Circular]" где-либо
console.log('\n=== Поиск "[Circular]" в JSON ===\n');
const jsonText = fs.readFileSync(FULL_JSON, 'utf-8');
const circularCount = (jsonText.match(/\[Circular\]/g) || []).length;
console.log(`Всего вхождений "[Circular]": ${circularCount}`);

// 4. Проверяем templates[i].templateRefs и т.п. — не они ли
console.log('\n=== Проверка templateRefs ===\n');
for (let i = 0; i < full.templates.length; i++) {
  const t = full.templates[i];
  if (t.templateRefs?.length > 0) {
    console.log(`templates[${i}].templateRefs[0]:`, JSON.stringify(t.templateRefs[0]));
  }
}
