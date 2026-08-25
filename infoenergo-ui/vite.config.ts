import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

export default defineConfig({
    plugins: [vue(), vueJsx()],

    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },

    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'InfoenergoUI',
            formats: ['es', 'cjs'],
            fileName: (format) => {
                if (format === 'es') return 'infoenergo-ui.mjs';
                if (format === 'cjs') return 'infoenergo-ui.cjs';
                return `infoenergo-ui.${format}.js`;
            },
        },
        rollupOptions: {
            external: ['vue', 'naive-ui'],
            output: {
                globals: {
                    vue: 'Vue',
                    'naive-ui': 'naive',
                },
            },
        },
        sourcemap: true,
        emptyOutDir: true,
        copyPublicDir: false,
    },
});
