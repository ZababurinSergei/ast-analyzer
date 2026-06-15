// src/ci-cd/ESLintPipeline.ts
import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';

export interface ESLintConfig {
  extends?: string[];
  rules?: Record<string, any>;
  parser?: string;
  parserOptions?: {
    ecmaVersion?: number;
    sourceType?: 'module' | 'script';
    ecmaFeatures?: {
      jsx?: boolean;
      tsx?: boolean;
    };
  };
  settings?: {
    react?: {
      version?: string;
    };
  };
  env?: {
    browser?: boolean;
    node?: boolean;
    es2022?: boolean;
  };
}

export interface ESLintMessage {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

export interface ESLintFixResult {
  file: string;
  fixed: boolean;
  messages: ESLintMessage[];
  fixCount: number;
  output?: string;
}

export class ESLintPipeline {
  private eslint: ESLint;

  constructor(config?: ESLintConfig) {
    const defaultConfig: ESLintConfig = {
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          tsx: true,
        },
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
      rules: {
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.eslint = new ESLint({
      fix: true,
      baseConfig: finalConfig as any,
    });
  }

  async run(filePaths: string[], autoFix = true): Promise<ESLintFixResult[]> {
    const results: ESLintFixResult[] = [];

    for (const filePath of filePaths) {
      if (!this.shouldLint(filePath)) continue;

      console.log(`  📝 Linting: ${path.basename(filePath)}`);

      const lintResults = await this.eslint.lintFiles([filePath]);

      for (const result of lintResults) {
        const fixResult: ESLintFixResult = {
          file: result.filePath,
          fixed: false,
          messages: result.messages.map(msg => ({
            ruleId: msg.ruleId || 'unknown',
            severity: msg.severity,
            message: msg.message,
            line: msg.line || 1,
            column: msg.column || 1,
            endLine: msg.endLine,
            endColumn: msg.endColumn,
            fix: msg.fix,
          })),
          fixCount: 0,
        };

        if (autoFix && result.messages.some(m => m.fix)) {
          // ESLint 8+ не принимает второй аргумент
          const fixedResult = await this.eslint.lintFiles([filePath]);
          if (fixedResult[0] && fixedResult[0].output) {
            fs.writeFileSync(filePath, fixedResult[0].output);
            fixResult.fixed = true;
            fixResult.fixCount = result.messages.filter(m => m.fix).length;
            fixResult.output = fixedResult[0].output;
            console.log(`     ✅ Fixed ${fixResult.fixCount} issues`);
          }
        }

        results.push(fixResult);
      }
    }

    return results;
  }

  async runWithRules(
    filePaths: string[],
    rules: Record<string, any>,
    autoFix = true
  ): Promise<ESLintFixResult[]> {
    const config: ESLintConfig = {
      rules: rules,
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          tsx: true,
        },
      },
    };

    const customEslint = new ESLint({
      fix: autoFix,
      baseConfig: config as any,
    });

    const results: ESLintFixResult[] = [];

    for (const filePath of filePaths) {
      if (!this.shouldLint(filePath)) continue;

      const lintResults = await customEslint.lintFiles([filePath]);

      for (const result of lintResults) {
        const fixResult: ESLintFixResult = {
          file: result.filePath,
          fixed: false,
          messages: result.messages.map(msg => ({
            ruleId: msg.ruleId || 'unknown',
            severity: msg.severity,
            message: msg.message,
            line: msg.line || 1,
            column: msg.column || 1,
            endLine: msg.endLine,
            endColumn: msg.endColumn,
            fix: msg.fix,
          })),
          fixCount: 0,
        };

        if (autoFix && result.messages.some(m => m.fix)) {
          const fixedResult = await customEslint.lintFiles([filePath]);
          if (fixedResult[0] && fixedResult[0].output) {
            fs.writeFileSync(filePath, fixedResult[0].output);
            fixResult.fixed = true;
            fixResult.fixCount = result.messages.filter(m => m.fix).length;
            fixResult.output = fixedResult[0].output;
          }
        }

        results.push(fixResult);
      }
    }

    return results;
  }

  async checkOnly(filePaths: string[]): Promise<ESLintFixResult[]> {
    return this.run(filePaths, false);
  }

  private shouldLint(filePath: string): boolean {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    return extensions.includes(path.extname(filePath));
  }

  async generateConfig(
    projectPath: string,
    framework: 'react' | 'vue' | 'vanilla' = 'react'
  ): Promise<void> {
    const configPath = path.join(projectPath, '.eslintrc.json');

    let config: any;

    switch (framework) {
      case 'react':
        config = {
          extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:react/recommended',
            'plugin:react-hooks/recommended',
          ],
          parser: '@typescript-eslint/parser',
          parserOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            ecmaFeatures: {
              jsx: true,
            },
          },
          env: {
            browser: true,
            node: true,
            es2022: true,
          },
          settings: {
            react: {
              version: 'detect',
            },
          },
          rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            'react/jsx-uses-react': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/jsx-boolean-value': 'warn',
            'react/self-closing-comp': 'warn',
            'react/jsx-pascal-case': 'warn',
            'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
            'react/jsx-tag-spacing': ['warn', { beforeSelfClosing: 'always' }],
            'react/jsx-wrap-multilines': [
              'warn',
              {
                declaration: 'parens-new-line',
                assignment: 'parens-new-line',
                return: 'parens-new-line',
                arrow: 'parens-new-line',
                condition: 'parens-new-line',
                logical: 'parens-new-line',
                prop: 'ignore',
              },
            ],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'always'],
            'prefer-const': 'warn',
            'no-var': 'error',
            'prefer-arrow-callback': 'warn',
            'object-shorthand': ['warn', 'always'],
            'arrow-body-style': ['warn', 'as-needed'],
          },
        };
        break;

      case 'vue':
        config = {
          extends: [
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:vue/vue3-recommended',
          ],
          parser: 'vue-eslint-parser',
          parserOptions: {
            parser: '@typescript-eslint/parser',
            ecmaVersion: 2022,
            sourceType: 'module',
          },
          env: {
            browser: true,
            node: true,
            es2022: true,
          },
          rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'vue/multi-word-component-names': 'off',
            'vue/no-v-html': 'warn',
            'vue/require-default-prop': 'warn',
            'vue/attribute-hyphenation': ['warn', 'always'],
            'vue/v-on-event-hyphenation': ['warn', 'always'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'always'],
            'prefer-const': 'warn',
          },
        };
        break;

      case 'vanilla':
      default:
        config = {
          extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
          parser: '@typescript-eslint/parser',
          parserOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
          },
          env: {
            node: true,
            es2022: true,
          },
          rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            eqeqeq: ['error', 'always'],
            'prefer-const': 'warn',
            'no-var': 'error',
          },
        };
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ ESLint config created: ${configPath}`);
  }

  async generateIgnoreFile(projectPath: string): Promise<void> {
    const ignorePath = path.join(projectPath, '.eslintignore');
    const ignoreContent = `# Dependencies
node_modules/
**/node_modules/

# Build outputs
dist/
build/
coverage/
**/dist/
**/build/

# Configuration files
*.config.js
*.config.ts
.eslintrc.json
.prettierrc.json

# Logs
*.log
logs/

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Generated files
*.d.ts
**/*.generated.ts

# Test files (optional - uncomment if needed)
# **/*.test.ts
# **/*.spec.ts
# **/__tests__/
`;

    fs.writeFileSync(ignorePath, ignoreContent);
    console.log(`✅ ESLint ignore file created: ${ignorePath}`);
  }

  async mergeConfigs(configs: ESLintConfig[]): Promise<ESLintConfig> {
    const merged: ESLintConfig = {
      extends: [],
      rules: {},
      parserOptions: {},
      env: {},
    };

    for (const config of configs) {
      if (config.extends) {
        merged.extends = [...new Set([...(merged.extends || []), ...config.extends])];
      }

      if (config.rules) {
        merged.rules = { ...merged.rules, ...config.rules };
      }

      if (config.parserOptions) {
        merged.parserOptions = { ...merged.parserOptions, ...config.parserOptions };
      }

      if (config.env) {
        merged.env = { ...merged.env, ...config.env };
      }

      if (config.parser && !merged.parser) merged.parser = config.parser;
      if (config.settings) merged.settings = { ...merged.settings, ...config.settings };
    }

    return merged;
  }

  async printReport(results: ESLintFixResult[]): Promise<void> {
    const totalFiles = results.length;
    const fixedFiles = results.filter(r => r.fixed).length;
    const totalFixes = results.reduce((sum, r) => sum + r.fixCount, 0);
    const filesWithIssues = results.filter(r => r.messages.length > 0 && !r.fixed);
    const totalIssues = filesWithIssues.reduce((sum, r) => sum + r.messages.length, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 ESLint REPORT');
    console.log('='.repeat(60));
    console.log(`📁 Files analyzed: ${totalFiles}`);
    console.log(`✅ Fixed files: ${fixedFiles}`);
    console.log(`🔧 Total fixes applied: ${totalFixes}`);
    console.log(`⚠️  Files with remaining issues: ${filesWithIssues.length}`);
    console.log(`📝 Total remaining issues: ${totalIssues}`);

    if (filesWithIssues.length > 0) {
      console.log('\n📋 Top issues by rule:');
      const ruleCount = new Map<string, number>();
      for (const result of filesWithIssues) {
        for (const msg of result.messages) {
          ruleCount.set(msg.ruleId, (ruleCount.get(msg.ruleId) || 0) + 1);
        }
      }
      const sorted = Array.from(ruleCount.entries()).sort((a, b) => b[1] - a[1]);
      for (const [rule, count] of sorted.slice(0, 10)) {
        console.log(`   • ${rule}: ${count} issues`);
      }

      console.log('\n📁 Files with most issues:');
      const sortedFiles = [...filesWithIssues].sort(
        (a, b) => b.messages.length - a.messages.length
      );
      for (const file of sortedFiles.slice(0, 5)) {
        console.log(`   • ${path.basename(file.file)}: ${file.messages.length} issues`);
      }
    }

    console.log('='.repeat(60) + '\n');
  }

  getFixableRuleIds(): string[] {
    return [
      'semi',
      'quotes',
      'no-trailing-spaces',
      'eol-last',
      'no-multiple-empty-lines',
      'comma-dangle',
      'prefer-const',
      'eqeqeq',
      'no-var',
      'object-shorthand',
      'arrow-body-style',
      'no-unused-expressions',
      '@typescript-eslint/no-unused-vars',
      '@typescript-eslint/no-extra-semi',
      '@typescript-eslint/member-delimiter-style',
      'react/self-closing-comp',
      'react/jsx-boolean-value',
      'react/jsx-curly-brace-presence',
      'react/jsx-tag-spacing',
      'react/jsx-wrap-multilines',
      'react/jsx-closing-bracket-location',
      'react/jsx-closing-tag-location',
      'react/jsx-curly-spacing',
      'react/jsx-equals-spacing',
      'react/jsx-first-prop-new-line',
      'react/jsx-indent',
      'react/jsx-indent-props',
      'react/jsx-max-props-per-line',
      'react/jsx-props-no-multi-spaces',
      'vue/html-indent',
      'vue/script-indent',
      'vue/max-attributes-per-line',
      'vue/html-closing-bracket-newline',
      'vue/html-closing-bracket-spacing',
      'vue/html-end-tags',
      'vue/html-self-closing',
      'vue/no-multi-spaces',
      'vue/no-spaces-around-equal-signs-in-attribute',
      'vue/attribute-hyphenation',
      'vue/v-on-event-hyphenation',
    ];
  }
}

export default ESLintPipeline;
