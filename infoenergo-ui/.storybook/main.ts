import { fileURLToPath } from "node:url";
import type { StorybookConfig } from '@storybook/vue3-vite';
import { mergeConfig } from 'vite';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
    staticDirs: ['../public'],
    stories: [
        '../src/**/*.mdx',
        '../stories/**/*.mdx',
        '../src/**/*.stories.@(js|jsx|ts|tsx|mjs)',
        '../stories/**/*.stories.@(js|jsx|ts|tsx|mjs)',
    ],
    addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
    framework: '@storybook/vue3-vite',
    viteFinal: async config => {
        const mergedConfig = mergeConfig(config, {
            resolve: {
                alias: {
                    '@': path.resolve(__dirname, '../src'),
                    '~': path.resolve(__dirname, '../'),
                },
            },
        });

        if (process.env.NODE_ENV === 'production') {
            const baseUrl = process.env.STORYBOOK_BASE_URL || '/';
            mergedConfig.define = {
                ...mergedConfig.define,
                'import.meta.env.BASE_URL': JSON.stringify(baseUrl),
            };
            mergedConfig.base = baseUrl;
        }

        return mergedConfig;
    },
};
export default config;
