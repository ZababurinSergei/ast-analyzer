// packages/ast-analyzer/vitest.setup.ts
// Setup file for vitest tests
import { vi } from 'vitest';

// Мок для @vue/compiler-sfc если нужно
vi.mock('@vue/compiler-sfc', async () => {
  return {
    parse: vi.fn(() => ({
      descriptor: {
        script: null,
        scriptSetup: null,
        template: null,
        styles: [],
      },
      errors: [],
    })),
    compileScript: vi.fn(() => ({
      content: '',
      setup: false,
      props: {},
      emits: {},
      expose: [],
    })),
  };
});
