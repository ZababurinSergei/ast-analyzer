// ast-analyzer/src/__tests__/vue-analyzer.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeVueComponent, generateVueComponentReport } from '../modes/vue-analyzer.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Vue Analyzer with @vue/compiler-sfc', () => {
  const testDir = path.join(__dirname, 'fixtures');
  const testFiles: string[] = [];

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    for (const file of testFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    testFiles.length = 0;
  });

  const createTestFile = (content: string, filename: string = 'TestComponent.vue'): string => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  };

  describe('Basic parsing', () => {
    it('should parse basic Vue component with options API', () => {
      const content = `
<template>
  <div>{{ message }}</div>
</template>

<script>
export default {
  data() {
    return {
      message: 'Hello Vue'
    }
  },
  methods: {
    greet() {
      console.log(this.message)
    }
  }
}
</script>

<style>
div { color: red; }
</style>
            `;

      const filePath = createTestFile(content, 'OptionsComponent.vue');
      const analysis = analyzeVueComponent(filePath, {
        includeTemplateAST: true,
        includeScriptAST: true,
      });

      expect(analysis).not.toBeNull();
      expect(analysis?.componentName).toBe('OptionsComponent');
      expect(analysis?.script.isSetup).toBe(false);
      expect(analysis?.script.isTS).toBe(false);
      expect(analysis?.stats.styleCount).toBe(1);
      expect(analysis?.template.content).toContain('<div>{{ message }}</div>');
    });

    it('should parse Vue component with script setup', () => {
      const content = `
<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  count?: number
}>()

defineEmits<{
  update: [value: number]
  close: []
}>()

const message = ref('Hello')
</script>

<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <button @click="$emit('update', count + 1)">
      Increment
    </button>
  </div>
</template>
            `;

      const filePath = createTestFile(content, 'SetupComponent.vue');
      const analysis = analyzeVueComponent(filePath, {
        includeTemplateAST: true,
        includeScriptAST: true,
      });

      expect(analysis).not.toBeNull();
      expect(analysis?.componentName).toBe('SetupComponent');
      expect(analysis?.script.isSetup).toBe(true);
      expect(analysis?.script.isTS).toBe(true);
      expect(analysis?.props.names).toContain('title');
      expect(analysis?.props.names).toContain('count');
      expect(analysis?.emits.names).toContain('update');
      expect(analysis?.emits.names).toContain('close');
    });

    it('should handle component without template', () => {
      const content = `
<script setup lang="ts">
import { h } from 'vue'

defineProps<{
  message: string
}>()

const render = () => h('div', message)
</script>
            `;

      const filePath = createTestFile(content, 'RenderFunctionComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis).not.toBeNull();
      expect(analysis?.template.content).toBeNull();
      expect(analysis?.props.names).toContain('message');
    });
  });

  describe('Props analysis', () => {
    it('should extract props with TypeScript types', () => {
      const content = `
<script setup lang="ts">
interface User {
  id: number
  name: string
}

defineProps<{
  stringProp: string
  numberProp: number
  booleanProp: boolean
  arrayProp: string[]
  objectProp: User
  optionalProp?: string
}>()
</script>

<template>
  <div>{{ stringProp }}</div>
</template>
            `;

      const filePath = createTestFile(content, 'TypedPropsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.props.names).toEqual([
        'stringProp',
        'numberProp',
        'booleanProp',
        'arrayProp',
        'objectProp',
        'optionalProp',
      ]);
      expect(analysis?.props.required['stringProp']).toBe(true);
      expect(analysis?.props.required['optionalProp']).toBe(false);
    });

    it('should extract props with runtime declaration', () => {
      const content = `
<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
    default: 'Default Title'
  },
  count: {
    type: Number,
    default: 0
  },
  disabled: Boolean
})
</script>

<template>
  <div>{{ title }}: {{ count }}</div>
</template>
            `;

      const filePath = createTestFile(content, 'RuntimePropsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.props.names).toContain('title');
      expect(analysis?.props.names).toContain('count');
      expect(analysis?.props.names).toContain('disabled');
      expect(analysis?.props.required['title']).toBe(true);
      expect(analysis?.props.defaults['title']).toBe('Default Title');
    });

    it('should handle withDefaults macro', () => {
      const content = `
<script setup lang="ts">
interface Props {
  title: string
  count?: number
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  disabled: false
})
</script>

<template>
  <div>{{ title }}: {{ count }}</div>
</template>
            `;

      const filePath = createTestFile(content, 'WithDefaultsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.props.names).toContain('title');
      expect(analysis?.props.names).toContain('count');
      expect(analysis?.props.names).toContain('disabled');
      expect(analysis?.props.defaults['count']).toBe(0);
      expect(analysis?.props.defaults['disabled']).toBe(false);
    });
  });

  describe('Emits analysis', () => {
    it('should extract emits with TypeScript types', () => {
      const content = `
<script setup lang="ts">
defineEmits<{
  (e: 'update', value: string): void
  (e: 'delete', id: number): void
  (e: 'close'): void
}>()
</script>

<template>
  <button @click="$emit('update', 'new value')">Update</button>
</template>
            `;

      const filePath = createTestFile(content, 'TypedEmitsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.emits.names).toContain('update');
      expect(analysis?.emits.names).toContain('delete');
      expect(analysis?.emits.names).toContain('close');
    });

    it('should extract emits with runtime declaration', () => {
      const content = `
<script setup>
const emit = defineEmits(['update', 'delete', 'close'])
</script>

<template>
  <button @click="emit('update', 'value')">Update</button>
</template>
            `;

      const filePath = createTestFile(content, 'RuntimeEmitsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.emits.names).toContain('update');
      expect(analysis?.emits.names).toContain('delete');
      expect(analysis?.emits.names).toContain('close');
    });
  });

  describe('Template analysis', () => {
    it('should extract slots from template', () => {
      const content = `
<script setup lang="ts">
// Component logic
</script>

<template>
  <div class="wrapper">
    <slot name="header" />
    <div class="content">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>
            `;

      const filePath = createTestFile(content, 'SlotsComponent.vue');
      const analysis = analyzeVueComponent(filePath, { includeTemplateAST: true });

      expect(analysis?.slots).toContain('header');
      expect(analysis?.slots).toContain('default');
      expect(analysis?.slots).toContain('footer');
    });

    it('should extract directives from template', () => {
      const content = `
<script setup lang="ts">
const items = [1, 2, 3]
const isVisible = true
</script>

<template>
  <div>
    <p v-if="isVisible">Visible text</p>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
    <button v-on:click="handleClick" @mouseover="handleHover">Click</button>
    <input v-model="inputValue" />
  </div>
</template>
            `;

      const filePath = createTestFile(content, 'DirectivesComponent.vue');
      const analysis = analyzeVueComponent(filePath, { includeTemplateAST: true });

      expect(analysis?.template.directives).toContain('v-if');
      expect(analysis?.template.directives).toContain('v-for');
      expect(analysis?.template.directives).toContain('v-on');
      expect(analysis?.template.directives).toContain('v-model');
      expect(analysis?.template.events).toContain('click');
      expect(analysis?.template.events).toContain('mouseover');
    });

    it('should calculate template complexity', () => {
      const content = `
<template>
  <div>
    <header>
      <h1>Title</h1>
      <nav>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </nav>
    </header>
    <main>
      <section>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </section>
    </main>
    <footer>
      <p>Footer</p>
    </footer>
  </div>
</template>
            `;

      const filePath = createTestFile(content, 'ComplexTemplate.vue');
      const analysis = analyzeVueComponent(filePath, { includeTemplateAST: true });

      expect(analysis?.template.complexity).toBeGreaterThan(10);
      expect(analysis?.template.rootElements).toContain('div');
    });
  });

  describe('Composables analysis', () => {
    it('should extract composable calls', () => {
      const content = `
<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'
import { useFetch } from '@/composables/useFetch'
import { useLocalStorage } from '@vueuse/core'

const { user, login } = useAuth()
const { data, loading } = useFetch('/api/users')
const theme = useLocalStorage('theme', 'dark')
</script>

<template>
  <div>{{ user?.name }}</div>
</template>
            `;

      const filePath = createTestFile(content, 'ComposablesComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.composables).toHaveLength(3);
      expect(analysis?.composables[0]?.name).toBe('useAuth');
      expect(analysis?.composables[1]?.name).toBe('useFetch');
      expect(analysis?.composables[2]?.name).toBe('useLocalStorage');
    });
  });

  describe('Imports analysis', () => {
    it('should extract all imports', () => {
      const content = `
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { User, Post } from '@/types'
import DefaultComponent from './DefaultComponent.vue'
import { useAuth as useCustomAuth } from '@/composables/auth'
import * as Vue from 'vue'
</script>

<template>
  <div>Content</div>
</template>
            `;

      const filePath = createTestFile(content, 'ImportsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.imports).toHaveLength(5);

      const vueImport = analysis?.imports.find(i => i.source === 'vue');
      expect(vueImport?.specifiers).toContain('ref');
      expect(vueImport?.specifiers).toContain('computed');
      expect(vueImport?.specifiers).toContain('watch');

      const typesImport = analysis?.imports.find(i => i.source === '@/types');
      expect(typesImport?.isTypeOnly).toBe(true);

      const defaultImport = analysis?.imports.find(i => i.source === './DefaultComponent.vue');
      expect(defaultImport?.specifiers[0]).toContain('default');
    });
  });

  describe('Expose analysis', () => {
    it('should extract expose declarations', () => {
      const content = `
<script setup lang="ts">
import { ref } from 'vue'

const internalMethod = () => {
  console.log('internal')
}

const publicMethod = () => {
  console.log('public')
}

defineExpose({
  publicMethod,
  publicValue: ref(42)
})
</script>

<template>
  <div>Component</div>
</template>
            `;

      const filePath = createTestFile(content, 'ExposeComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.expose).toContain('publicMethod');
      expect(analysis?.expose).toContain('publicValue');
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const content = `
<script setup lang="ts">
// Line 1
// Line 2
// Line 3
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div>
    <!-- Template line 1 -->
    <!-- Template line 2 -->
    <span>{{ count }}</span>
  </div>
</template>

<style scoped>
/* Style 1 */
div { color: red; }
</style>

<style>
/* Style 2 */
span { font-weight: bold; }
</style>
            `;

      const filePath = createTestFile(content, 'StatsComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      expect(analysis?.stats.scriptLines).toBeGreaterThan(5);
      expect(analysis?.stats.templateLines).toBeGreaterThan(3);
      expect(analysis?.stats.styleCount).toBe(2);
      expect(analysis?.stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid Vue file gracefully', () => {
      const content = `
<script setup lang="ts">
// Syntax error: missing closing bracket
const count = ref(0
</script>

<template>
  <div>{{ count }}</div>
</template>
            `;

      const filePath = createTestFile(content, 'InvalidComponent.vue');
      const analysis = analyzeVueComponent(filePath);

      // Should not crash, should return partial analysis or null
      expect(analysis).not.toBeNull();
    });

    it('should return null for non-Vue files', () => {
      const nonVuePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(nonVuePath, 'Just text');
      testFiles.push(nonVuePath);

      const analysis = analyzeVueComponent(nonVuePath);
      expect(analysis).toBeNull();
    });

    it('should handle non-existent file', () => {
      const analysis = analyzeVueComponent('/non/existent/file.vue');
      expect(analysis).toBeNull();
    });
  });

  describe('Report generation', () => {
    it('should generate comprehensive Markdown report', () => {
      const content = `
<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

defineProps<{
  title: string
  count?: number
}>()

defineEmits<{
  update: [value: number]
}>()

const { user } = useAuth()
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <slot name="actions" />
    <button @click="$emit('update', count + 1)">
      Update
    </button>
  </div>
</template>

<style scoped>
h1 { color: blue; }
</style>
            `;

      const filePath = createTestFile(content, 'ReportComponent.vue');
      const analysis = analyzeVueComponent(filePath);
      const report = generateVueComponentReport(analysis!);

      expect(report).toContain('# 🎯 Анализ Vue компонента: ReportComponent');
      expect(report).toContain('## 📊 Статистика');
      expect(report).toContain('## 📥 Props');
      expect(report).toContain('title');
      expect(report).toContain('count');
      expect(report).toContain('## 📤 Events');
      expect(report).toContain('update');
      expect(report).toContain('## 🧩 Composables');
      expect(report).toContain('useAuth');
      expect(report).toContain('## 🎭 Slots');
      expect(report).toContain('actions');
      expect(report).toContain('## 🏗️ Шаблон');
    });
  });

  describe('Integration with existing analyzer', () => {
    it('should work with TypeScript AST parser', () => {
      const content = `
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  items: string[]
}>()

const filteredItems = computed(() => 
  props.items.filter(item => item.length > 0)
)
</script>

<template>
  <ul>
    <li v-for="item in filteredItems" :key="item">
      {{ item }}
    </li>
  </ul>
</template>
            `;

      const filePath = createTestFile(content, 'IntegrationComponent.vue');
      const analysis = analyzeVueComponent(filePath, { includeScriptAST: true });

      expect(analysis?.script.ast).not.toBeNull();
      expect(analysis?.props.names).toContain('items');
      expect(analysis?.template.directives).toContain('v-for');
    });
  });
});
