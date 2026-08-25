import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import storybook from 'eslint-plugin-storybook';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import ts from 'typescript-eslint';
import vueParser from '@vue/eslint-config-typescript';

export default [
    ...ts.configs.recommended,
    js.configs.recommended,
    ...vue.configs['flat/recommended'],
    ...storybook.configs['flat/recommended'],
    prettier,

    ...vueParser({
        files: ['**/*.{vue,ts}'],
        languageOptions: {
            parser: ts.parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                extraFileExtensions: ['.vue'],
            },
        },
    }),

    {
        files: ['**/*.{js,ts,vue}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022,
                defineProps: 'readonly',
                defineEmits: 'readonly',
                defineExpose: 'readonly',
                withDefaults: 'readonly',
            },
        },

        rules: {
            'vue/no-v-for-template-key': 'warn',
            'vue/valid-v-slot': 'off',
            'prefer-const': 'error',
            'vue/no-unused-components': 'error',
            'vue/no-unused-vars': 'error',
            'vue/require-default-prop': 'warn',
            'vue/prop-name-casing': ['error', 'camelCase'],
            'vue/multi-word-component-names': 'off',
            'vue/order-in-components': ['error', { /* ... */ }],
            'no-console': ['warn', { 'allow': ['warn', 'error'] }],
            'eqeqeq': ['error', 'always'],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single'],
            'arrow-parens': ['error', 'as-needed'],
            '@typescript-eslint/no-unused-vars': ['error', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_'
            }],
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-explicit-any': 'off', // будем самостоятельно следить за использованием типа any
        },
    },
    {
        files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
        rules: {
            'no-console': 'off',
            'no-undef': 'off',
        },
    },
    {
        files: ['**/*.stories.{js,ts,vue}'],
        rules: {
            'vue/require-default-prop': 'off',
            'no-console': 'off',
        },
    },
    {
        files: ['*.config.{js,ts}'],
        rules: {
            'arrow-parens': 'off',
        }
    },
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            '*.min.js',
            'storybook-static/**',
            '.storybook/**',
            '**/*.d.ts',
            'src/RuDataTreeComponent/**', // игнорируем пока что компонент
        ],
    },
];
