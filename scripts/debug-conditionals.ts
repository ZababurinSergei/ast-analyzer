// scripts/debug-conditionals.ts
import { parseFile } from '../src/core/ast-parser.js';
import { extractEntities } from '../src/core/entity-extractor/index.js';

// Взять любой .vue-файл, где есть conditionals
const VUE_FILE = './infoenergo-ui/src/components/ui/AiTabs/AiTabs.vue';

const parsed = parseFile(VUE_FILE);
if (!parsed) {
  console.error('parseFile returned null');
  process.exit(1);
}

const entities = extractEntities(parsed.ast, VUE_FILE);

console.log('=== templateConditionals ===');
console.log('Count:', entities.templateConditionals?.length ?? 0);

for (let i = 0; i < (entities.templateConditionals?.length ?? 0); i++) {
  const cd = entities.templateConditionals![i];
  console.log(`\n[${i}]`);
  console.log('  directive:', cd?.directive);
  console.log('  line:', cd?.line);
  console.log('  conditionExpression:', cd?.conditionExpression);
  console.log('  renderedComponent:', cd?.renderedComponent);
  console.log('  typeof renderedComponent:', typeof cd?.renderedComponent);

  // Проверяем на циклические ссылки
  try {
    JSON.stringify(cd);
    console.log('  ✅ JSON.stringify OK');
  } catch (e) {
    console.log('  ❌ JSON.stringify FAILED:', (e as Error).message);
  }
}

// Проверяем весь объект
console.log('\n=== entities.templateConditionals JSON ===');
try {
  const json = JSON.stringify(entities.templateConditionals);
  console.log('✅ JSON OK, length:', json.length);
} catch (e) {
  console.log('❌ JSON FAILED:', (e as Error).message);
}
