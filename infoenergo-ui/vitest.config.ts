import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig({
    plugins: [vue(), vueJsx()],

    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },

    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/components/**/*.{js,ts,vue}', 'src/composables/**/*.{js,ts,vue}'],
            exclude: [
                '**/*.stories.*',
                '**/defaults.ts',
                '**/types.ts',
                '**/index.ts',
                'src/components/icons/**',
                'src/assets/**',
                '**/stories/**',
                '**/examples/**',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },
        setupFiles: ['./test-setup.ts'],
    },
});
