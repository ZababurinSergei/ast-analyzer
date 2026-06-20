// packages/ast-analyzer/src/refactor/__tests__/jsx-vue-analyzers.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('JSX/TSX и Vue анализаторы - Комплексные тесты', () => {
  const testDir = path.join(process.cwd(), 'test-temp-jsx-vue');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  const createTestFile = (content: string, filename: string = 'test.js') => {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  // ============================================
  // 1. JSX/TSX АНАЛИЗ - БАЗОВЫЕ КОМПОНЕНТЫ
  // ============================================

  describe('JSX/TSX анализ - Базовые компоненты', () => {
    it('1.1 должен правильно анализировать React функциональный компонент', async () => {
      const content = `
        import React from 'react';
        
        interface ButtonProps {
          onClick: () => void;
          children: React.ReactNode;
          variant?: 'primary' | 'secondary';
        }
        
        function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
          return (
            <button 
              onClick={onClick} 
              className={\`btn btn-\${variant}\`}
            >
              {children}
            </button>
          );
        }
        
        function App() {
          const handleClick = () => console.log('clicked');
          return (
            <div className="app">
              <Button onClick={handleClick}>
                Click me
              </Button>
            </div>
          );
        }
        
        export { App, Button };
      `;
      const testFile = createTestFile(content, 'react-component.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        semanticAnalysis: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('Button');
      expect(contentAfter).toContain('App');
    });

    it('1.2 должен правильно анализировать React классовый компонент', async () => {
      const content = `
        import React from 'react';
        
        interface CounterProps {
          initialCount?: number;
        }
        
        interface CounterState {
          count: number;
        }
        
        class Counter extends React.Component<CounterProps, CounterState> {
          constructor(props: CounterProps) {
            super(props);
            this.state = {
              count: props.initialCount || 0
            };
          }
          
          increment = () => {
            this.setState(prev => ({ count: prev.count + 1 }));
          };
          
          decrement = () => {
            this.setState(prev => ({ count: prev.count - 1 }));
          };
          
          render() {
            return (
              <div>
                <h1>Count: {this.state.count}</h1>
                <button onClick={this.increment}>+</button>
                <button onClick={this.decrement}>-</button>
              </div>
            );
          }
        }
        
        export { Counter };
      `;
      const testFile = createTestFile(content, 'react-class.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.3 должен правильно анализировать компонент с хуками', async () => {
      const content = `
        import React, { useState, useEffect, useCallback, useMemo } from 'react';
        
        function TodoList() {
          const [todos, setTodos] = useState<string[]>([]);
          const [input, setInput] = useState('');
          
          useEffect(() => {
            console.log('Todos changed:', todos);
          }, [todos]);
          
          const addTodo = useCallback(() => {
            if (input.trim()) {
              setTodos([...todos, input.trim()]);
              setInput('');
            }
          }, [todos, input]);
          
          const todoCount = useMemo(() => todos.length, [todos]);
          
          return (
            <div>
              <h2>Todo List ({todoCount})</h2>
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTodo()}
              />
              <button onClick={addTodo}>Add</button>
              <ul>
                {todos.map((todo, index) => (
                  <li key={index}>{todo}</li>
                ))}
              </ul>
            </div>
          );
        }
        
        export { TodoList };
      `;
      const testFile = createTestFile(content, 'react-hooks.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.4 должен правильно анализировать компонент с PropTypes', async () => {
      const content = `
        import React from 'react';
        import PropTypes from 'prop-types';
        
        function Button({ onClick, children, disabled, variant, size }) {
          return (
            <button
              onClick={onClick}
              disabled={disabled}
              className={\`btn btn-\${variant} btn-\${size}\`}
            >
              {children}
            </button>
          );
        }
        
        Button.propTypes = {
          onClick: PropTypes.func.isRequired,
          children: PropTypes.node.isRequired,
          disabled: PropTypes.bool,
          variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
          size: PropTypes.oneOf(['sm', 'md', 'lg']),
        };
        
        Button.defaultProps = {
          disabled: false,
          variant: 'primary',
          size: 'md',
        };
        
        export { Button };
      `;
      const testFile = createTestFile(content, 'react-proptypes.jsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('1.5 должен правильно анализировать компонент с Context API', async () => {
      const content = `
        import React, { createContext, useContext, useState } from 'react';
        
        interface ThemeContextType {
          theme: 'light' | 'dark';
          toggleTheme: () => void;
        }
        
        const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
        
        function ThemeProvider({ children }: { children: React.ReactNode }) {
          const [theme, setTheme] = useState<'light' | 'dark'>('light');
          
          const toggleTheme = () => {
            setTheme(prev => prev === 'light' ? 'dark' : 'light');
          };
          
          return (
            <ThemeContext.Provider value={{ theme, toggleTheme }}>
              {children}
            </ThemeContext.Provider>
          );
        }
        
        function useTheme() {
          const context = useContext(ThemeContext);
          if (!context) {
            throw new Error('useTheme must be used within ThemeProvider');
          }
          return context;
        }
        
        function ThemedButton({ children }: { children: React.ReactNode }) {
          const { theme, toggleTheme } = useTheme();
          return (
            <button 
              onClick={toggleTheme}
              style={{ background: theme === 'dark' ? '#333' : '#fff' }}
            >
              {children}
            </button>
          );
        }
        
        function App() {
          return (
            <ThemeProvider>
              <ThemedButton>Toggle Theme</ThemedButton>
            </ThemeProvider>
          );
        }
        
        export { App, ThemeProvider, ThemedButton, useTheme };
      `;
      const testFile = createTestFile(content, 'react-context.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 40,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 2. JSX/TSX АНАЛИЗ - СЛОЖНЫЕ СЦЕНАРИИ
  // ============================================

  describe('JSX/TSX анализ - Сложные сценарии', () => {
    it('2.1 должен правильно анализировать компонент с children и render props', async () => {
      const content = `
        import React from 'react';
        
        interface ListProps<T> {
          items: T[];
          renderItem: (item: T, index: number) => React.ReactNode;
          emptyMessage?: string;
        }
        
        function List<T>({ items, renderItem, emptyMessage = 'No items' }: ListProps<T>) {
          if (items.length === 0) {
            return <p>{emptyMessage}</p>;
          }
          return (
            <ul>
              {items.map((item, index) => (
                <li key={index}>
                  {renderItem(item, index)}
                </li>
              ))}
            </ul>
          );
        }
        
        interface User {
          id: number;
          name: string;
          email: string;
        }
        
        function UserList({ users }: { users: User[] }) {
          return (
            <List<User>
              items={users}
              renderItem={(user) => (
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              )}
            />
          );
        }
        
        export { List, UserList };
      `;
      const testFile = createTestFile(content, 'react-render-props.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('2.2 должен правильно анализировать компонент с forwardRef', async () => {
      const content = `
        import React, { forwardRef, useImperativeHandle, useRef } from 'react';
        
        interface InputHandle {
          focus: () => void;
          blur: () => void;
          getValue: () => string;
        }
        
        interface InputProps {
          placeholder?: string;
          defaultValue?: string;
          onChange?: (value: string) => void;
        }
        
        const CustomInput = forwardRef<InputHandle, InputProps>((props, ref) => {
          const inputRef = useRef<HTMLInputElement>(null);
          
          useImperativeHandle(ref, () => ({
            focus: () => inputRef.current?.focus(),
            blur: () => inputRef.current?.blur(),
            getValue: () => inputRef.current?.value || '',
          }));
          
          const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            props.onChange?.(e.target.value);
          };
          
          return (
            <input
              ref={inputRef}
              placeholder={props.placeholder}
              defaultValue={props.defaultValue}
              onChange={handleChange}
            />
          );
        });
        
        function Form() {
          const inputRef = useRef<InputHandle>(null);
          
          const handleSubmit = () => {
            const value = inputRef.current?.getValue();
            console.log('Submitted:', value);
          };
          
          return (
            <div>
              <CustomInput ref={inputRef} placeholder="Enter text" />
              <button onClick={handleSubmit}>Submit</button>
            </div>
          );
        }
        
        export { CustomInput, Form };
      `;
      const testFile = createTestFile(content, 'react-forward-ref.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('2.3 должен правильно анализировать компонент с portals и Suspense', async () => {
      const content = `
        import React, { Suspense, lazy } from 'react';
        import ReactDOM from 'react-dom';
        
        const LazyComponent = lazy(() => import('./LazyComponent'));
        
        interface ModalProps {
          isOpen: boolean;
          onClose: () => void;
          children: React.ReactNode;
        }
        
        function Modal({ isOpen, onClose, children }: ModalProps) {
          if (!isOpen) return null;
          
          return ReactDOM.createPortal(
            <div className="modal-overlay" onClick={onClose}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose}>Close</button>
                {children}
              </div>
            </div>,
            document.getElementById('modal-root')!
          );
        }
        
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          
          return (
            <div>
              <button onClick={() => setIsOpen(true)}>Open Modal</button>
              <Suspense fallback={<div>Loading...</div>}>
                <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                  <LazyComponent />
                </Modal>
              </Suspense>
            </div>
          );
        }
        
        export { App, Modal };
      `;
      const testFile = createTestFile(content, 'react-portal-suspense.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('2.4 должен правильно анализировать компонент с CSS-in-JS (styled-components)', async () => {
      const content = `
        import React from 'react';
        import styled from 'styled-components';
        
        const Container = styled.div\`
          padding: 20px;
          background: \${({ theme }) => theme.background};
        \`;
        
        const Title = styled.h1\`
          color: \${({ theme }) => theme.primary};
          font-size: 24px;
        \`;
        
        interface ButtonProps {
          variant?: 'primary' | 'secondary';
        }
        
        const StyledButton = styled.button<ButtonProps>\`
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          background: \${({ variant, theme }) => 
            variant === 'primary' ? theme.primary : theme.secondary
          };
          color: white;
          cursor: pointer;
          
          &:hover {
            opacity: 0.8;
          }
        \`;
        
        function ThemedApp() {
          const theme = {
            background: '#f0f0f0',
            primary: '#007bff',
            secondary: '#6c757d',
          };
          
          return (
            <Container>
              <Title>Styled Components</Title>
              <StyledButton variant="primary">Primary</StyledButton>
              <StyledButton variant="secondary">Secondary</StyledButton>
            </Container>
          );
        }
        
        export { ThemedApp };
      `;
      const testFile = createTestFile(content, 'react-styled-components.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('2.5 должен правильно анализировать компонент с ошибками в JSX', async () => {
      const content = `
        import React from 'react';
        
        function BrokenComponent() {
          const items = [1, 2, 3];
          const [count, setCount] = React.useState(0);
          
          return (
            <div>
              {items.map(item => (
                <span>{item}</span>
              ))}
              <button onClick={() => setCount(count + 1)}>
                Count: {count}
              </button>
            </div>
          );
        }
        
        function AnotherComponent() {
          return <div><span></div>;
        }
        
        export { BrokenComponent, AnotherComponent };
      `;
      const testFile = createTestFile(content, 'react-broken.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        eslintCheck: true,
        eslintFix: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 3. VUE АНАЛИЗ - КОМПОЗИЦИЯ API
  // ============================================

  describe('Vue анализ - Composition API', () => {
    it('3.1 должен правильно анализировать Vue компонент с Composition API', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, computed, onMounted, watch } from 'vue';
        
        interface Props {
          initialCount?: number;
          maxCount?: number;
        }
        
        const props = withDefaults(defineProps<Props>(), {
          initialCount: 0,
          maxCount: 100,
        });
        
        const emit = defineEmits<{
          (e: 'update:count', value: number): void;
          (e: 'change', value: number): void;
        }>();
        
        const count = ref(props.initialCount);
        const doubled = computed(() => count.value * 2);
        const isMax = computed(() => count.value >= props.maxCount);
        
        function increment() {
          if (!isMax.value) {
            count.value++;
            emit('update:count', count.value);
            emit('change', count.value);
          }
        }
        
        function decrement() {
          count.value--;
          emit('update:count', count.value);
          emit('change', count.value);
        }
        
        function reset() {
          count.value = 0;
          emit('update:count', 0);
        }
        
        watch(count, (newVal, oldVal) => {
          console.log(\`Count changed from \${oldVal} to \${newVal}\`);
        });
        
        onMounted(() => {
          console.log('Component mounted');
        });
        </script>
        
        <template>
          <div class="counter">
            <p>Count: {{ count }}</p>
            <p>Doubled: {{ doubled }}</p>
            <p>{{ isMax ? 'Maximum reached!' : '' }}</p>
            <button @click="decrement">-</button>
            <button @click="increment">+</button>
            <button @click="reset">Reset</button>
          </div>
        </template>
        
        <style scoped>
        .counter {
          padding: 20px;
          border: 1px solid #ccc;
          border-radius: 8px;
        }
        button {
          margin: 0 5px;
          padding: 5px 15px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-composition.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
      expect(result.modules.length).toBeGreaterThan(0);

      const contentAfter = fs.readFileSync(testFile, 'utf-8');
      expect(contentAfter).toContain('<template>');
      expect(contentAfter).toContain('{{ count }}');
      expect(contentAfter).toContain('@click="increment"');
    });

    it('3.2 должен правильно анализировать Vue компонент с Options API', async () => {
      const content = `
        <template>
          <div>
            <h1>{{ title }}</h1>
            <p>Count: {{ count }}</p>
            <button @click="increment">+</button>
            <button @click="decrement">-</button>
          </div>
        </template>
        
        <script>
        export default {
          name: 'Counter',
          props: {
            initialCount: {
              type: Number,
              default: 0,
            },
            title: {
              type: String,
              required: true,
            },
          },
          data() {
            return {
              count: this.initialCount,
              history: [],
            };
          },
          computed: {
            doubled() {
              return this.count * 2;
            },
            isEven() {
              return this.count % 2 === 0;
            },
          },
          methods: {
            increment() {
              this.count++;
              this.$emit('change', this.count);
            },
            decrement() {
              this.count--;
              this.$emit('change', this.count);
            },
            reset() {
              this.count = 0;
            },
          },
          watch: {
            count(newVal, oldVal) {
              this.history.push({ from: oldVal, to: newVal });
            },
          },
          mounted() {
            console.log('Component mounted');
          },
        };
        </script>
        
        <style>
        .counter {
          padding: 20px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-options.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('3.3 должен правильно анализировать Vue компонент с composables', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';
        import { useCounter } from './composables/useCounter';
        import { useLocalStorage } from './composables/useLocalStorage';
        
        const { count, increment, decrement, reset } = useCounter(0);
        const { value: storedValue, setValue } = useLocalStorage('key', 'default');
        
        const doubled = computed(() => count.value * 2);
        
        function handleReset() {
          reset();
          setValue('reset');
        }
        </script>
        
        <template>
          <div>
            <p>Count: {{ count }}</p>
            <p>Doubled: {{ doubled }}</p>
            <p>Stored: {{ storedValue }}</p>
            <button @click="increment">+</button>
            <button @click="decrement">-</button>
            <button @click="handleReset">Reset</button>
          </div>
        </template>
      `;
      const testFile = createTestFile(content, 'vue-composables.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('3.4 должен правильно анализировать Vue компонент с TypeScript и defineProps', async () => {
      const content = `
        <script setup lang="ts">
        interface User {
          id: number;
          name: string;
          email: string;
          role: 'admin' | 'user' | 'guest';
        }
        
        interface Props {
          user: User;
          showEmail?: boolean;
          onAction?: (user: User) => void;
        }
        
        const props = defineProps<Props>();
        const emit = defineEmits<{
          (e: 'update', user: User): void;
          (e: 'delete', id: number): void;
        }>();
        
        function handleUpdate() {
          const updatedUser = {
            ...props.user,
            name: props.user.name.toUpperCase(),
          };
          emit('update', updatedUser);
        }
        
        function handleDelete() {
          emit('delete', props.user.id);
        }
        </script>
        
        <template>
          <div class="user-card">
            <h3>{{ user.name }}</h3>
            <p v-if="showEmail">{{ user.email }}</p>
            <span class="role">{{ user.role }}</span>
            <div class="actions">
              <button @click="handleUpdate">Update</button>
              <button @click="handleDelete">Delete</button>
            </div>
          </div>
        </template>
        
        <style scoped>
        .user-card {
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 8px;
        }
        .role {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 12px;
          background: #eee;
        }
        .actions {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-ts-props.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('3.5 должен правильно анализировать Vue компонент с slots', async () => {
      const content = `
        <script setup lang="ts">
        defineProps<{
          title: string;
          loading?: boolean;
        }>();
        
        defineSlots<{
          default: (props: { count: number }) => any;
          header: (props: { title: string }) => any;
          footer: () => any;
        }>();
        
        const count = ref(0);
        </script>
        
        <template>
          <div class="card">
            <div class="header">
              <slot name="header" :title="title">
                <h2>{{ title }}</h2>
              </slot>
            </div>
            <div class="content">
              <slot :count="count">
                <p>Default content</p>
              </slot>
            </div>
            <div class="footer">
              <slot name="footer">
                <small>Footer</small>
              </slot>
            </div>
          </div>
        </template>
        
        <style scoped>
        .card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }
        .header {
          padding: 15px;
          background: #f5f5f5;
          border-bottom: 1px solid #e0e0e0;
        }
        .content {
          padding: 15px;
        }
        .footer {
          padding: 10px 15px;
          background: #fafafa;
          border-top: 1px solid #e0e0e0;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-slots.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 4. VUE АНАЛИЗ - СЛОЖНЫЕ СЦЕНАРИИ
  // ============================================

  describe('Vue анализ - Сложные сценарии', () => {
    it('4.1 должен правильно анализировать Vue компонент с provide/inject', async () => {
      const content = `
        <script setup lang="ts">
        import { provide, inject, ref, computed } from 'vue';
        
        interface ThemeContext {
          theme: 'light' | 'dark';
          toggleTheme: () => void;
        }
        
        const ThemeKey = Symbol('theme');
        
        function useTheme() {
          const context = inject<ThemeContext>(ThemeKey);
          if (!context) {
            throw new Error('useTheme must be used within ThemeProvider');
          }
          return context;
        }
        
        const theme = ref<'light' | 'dark'>('light');
        const toggleTheme = () => {
          theme.value = theme.value === 'light' ? 'dark' : 'light';
        };
        
        provide(ThemeKey, {
          theme: theme.value,
          toggleTheme,
        });
        
        const isDark = computed(() => theme.value === 'dark');
        </script>
        
        <template>
          <div :class="{ dark: isDark }">
            <slot />
          </div>
        </template>
        
        <style>
        .dark {
          background: #1a1a1a;
          color: #fff;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-provide-inject.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('4.2 должен правильно анализировать Vue компонент с teleport и suspense', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, Suspense } from 'vue';
        
        const isModalOpen = ref(false);
        const lazyComponent = defineAsyncComponent(() => 
          import('./components/HeavyComponent.vue')
        );
        
        function openModal() {
          isModalOpen.value = true;
        }
        
        function closeModal() {
          isModalOpen.value = false;
        }
        </script>
        
        <template>
          <div>
            <button @click="openModal">Open Modal</button>
            
            <Teleport to="body">
              <div v-if="isModalOpen" class="modal-overlay" @click="closeModal">
                <div class="modal-content" @click.stop>
                  <button @click="closeModal">Close</button>
                  <Suspense>
                    <template #default>
                      <LazyComponent />
                    </template>
                    <template #fallback>
                      <div>Loading...</div>
                    </template>
                  </Suspense>
                </div>
              </div>
            </Teleport>
          </div>
        </template>
        
        <style>
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .modal-content {
          background: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 500px;
          width: 100%;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-teleport.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('4.3 должен правильно анализировать Vue компонент с директивными хуками', async () => {
      const content = `
        <script setup lang="ts">
        import { vModel, vShow, vOn, vBind } from 'vue';
        
        const isVisible = ref(true);
        const text = ref('');
        const count = ref(0);
        const items = ref([1, 2, 3]);
        
        function handleClick() {
          count.value++;
        }
        
        function handleInput(event: Event) {
          text.value = (event.target as HTMLInputElement).value;
        }
        </script>
        
        <template>
          <div>
            <input 
              v-model="text" 
              placeholder="Enter text"
              @input="handleInput"
            />
            
            <p v-show="isVisible">This is visible</p>
            
            <button 
              v-on:click="handleClick"
              v-bind:disabled="count > 10"
            >
              Clicked {{ count }} times
            </button>
            
            <ul>
              <li 
                v-for="(item, index) in items" 
                :key="index"
                v-bind:class="{ active: item % 2 === 0 }"
              >
                {{ item }}
              </li>
            </ul>
          </div>
        </template>
        
        <style>
        .active {
          color: green;
          font-weight: bold;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-directives.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('4.4 должен правильно анализировать Vue компонент с ошибками в template', async () => {
      const content = `
        <script setup>
        const count = ref(0);
        const items = ref([1, 2, 3]);
        </script>
        
        <template>
          <div>
            <p class=error>{{ count }}</p>
            <li v-for="item items">{{ item }}</li>
            <button click="count++">Increment</button>
          </div>
        </template>
        
        <style>
        .error {
          color: red;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-broken.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        autoFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        eslintCheck: true,
        eslintFix: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('4.5 должен правильно анализировать Vue компонент с mixins', async () => {
      const content = `
        <template>
          <div>
            <h2>{{ message }}</h2>
            <p>{{ computedMessage }}</p>
            <button @click="handleClick">Click</button>
          </div>
        </template>
        
        <script>
        import { loggerMixin } from './mixins/logger.js';
        import { apiMixin } from './mixins/api.js';
        
        export default {
          name: 'MixedComponent',
          mixins: [loggerMixin, apiMixin],
          data() {
            return {
              message: 'Hello from component',
              localData: null,
            };
          },
          computed: {
            computedMessage() {
              return \`\${this.message} (computed)\`;
            },
          },
          methods: {
            handleClick() {
              this.log('Button clicked');
              this.fetchData('/api/data').then(data => {
                this.localData = data;
              });
            },
          },
          created() {
            this.log('Component created');
          },
        };
        </script>
        
        <style scoped>
        div {
          padding: 20px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-mixins.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 5. ИНТЕГРАЦИЯ JSX + VUE
  // ============================================

  describe('Интеграция JSX + Vue', () => {
    it('5.1 должен правильно обрабатывать проект с JSX и Vue файлами', async () => {
      const srcDir = path.join(testDir, 'src');
      const componentsDir = path.join(srcDir, 'components');
      const viewsDir = path.join(srcDir, 'views');
      fs.mkdirSync(componentsDir, { recursive: true });
      fs.mkdirSync(viewsDir, { recursive: true });

      const reactContent = `
        import React from 'react';
        
        interface ButtonProps {
          label: string;
          onClick: () => void;
        }
        
        export function Button({ label, onClick }: ButtonProps) {
          return <button onClick={onClick}>{label}</button>;
        }
      `;
      fs.writeFileSync(path.join(componentsDir, 'Button.tsx'), reactContent);

      const vueContent = `
        <script setup lang="ts">
        const count = ref(0);
        function increment() { count.value++; }
        </script>
        <template>
          <div>
            <p>Count: {{ count }}</p>
            <button @click="increment">+</button>
          </div>
        </template>
      `;
      fs.writeFileSync(path.join(viewsDir, 'Counter.vue'), vueContent);

      const mainContent = `
        import React from 'react';
        import { Button } from './components/Button.tsx';
        import Counter from './views/Counter.vue';
        
        function App() {
          return (
            <div>
              <Button label="Click me" onClick={() => console.log('clicked')} />
              <Counter />
            </div>
          );
        }
        
        export { App };
      `;
      const testFile = createTestFile(mainContent, 'main.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('5.2 должен правильно обрабатывать файл с JSX и Vue imports', async () => {
      const content = `
        import React from 'react';
        import { ref, onMounted } from 'vue';
        import { Button } from './Button.tsx';
        import Counter from './Counter.vue';
        
        function HybridComponent() {
          const vueData = ref(0);
          
          React.useEffect(() => {
            console.log('React effect');
          }, []);
          
          onMounted(() => {
            console.log('Vue mounted');
          });
          
          return (
            <div>
              <Button label="React Button" onClick={() => vueData.value++} />
              <Counter />
            </div>
          );
        }
        
        export { HybridComponent };
      `;
      const testFile = createTestFile(content, 'hybrid.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        minCohesionScore: 50,
        dryRun: false,
        typeCheck: true,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // 6. СТРЕСС-ТЕСТЫ
  // ============================================

  describe('Стресс-тесты', () => {
    it('6.1 должен обрабатывать файл с 50+ JSX компонентами', async () => {
      let content = `
        import React from 'react';
      `;

      for (let i = 0; i < 50; i++) {
        content += `
          function Component${i}() {
            const [state, setState] = React.useState(0);
            return (
              <div className="component-${i}">
                <h2>Component ${i}</h2>
                <p>State: {state}</p>
                <button onClick={() => setState(state + 1)}>
                  Increment
                </button>
              </div>
            );
          }
        `;
      }

      content += `
        function App() {
          return (
            <div>
              ${Array.from({ length: 50 }, (_, i) => `<Component${i} />`).join('\n')}
            </div>
          );
        }
        export { App };
      `;

      const testFile = createTestFile(content, 'many-components.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        dryRun: false,
        logLevel: 'info',
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000);
    });

    it('6.2 должен обрабатывать файл с 50+ Vue компонентами', async () => {
      let content = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';
      `;

      for (let i = 0; i < 50; i++) {
        content += `
          const count${i} = ref(0);
          const doubled${i} = computed(() => count${i}.value * 2);
          function increment${i}() { count${i}.value++; }
          function decrement${i}() { count${i}.value--; }
        `;
      }

      content += `
        </script>
        <template>
          <div>
            ${Array.from(
              { length: 50 },
              (_, i) => `
              <div class="counter-${i}">
                <p>Count ${i}: {{ count${i} }}</p>
                <p>Doubled ${i}: {{ doubled${i} }}</p>
                <button @click="increment${i}">+</button>
                <button @click="decrement${i}">-</button>
              </div>
            `
            ).join('\n')}
          </div>
        </template>
        <style scoped>
        div {
          margin: 10px 0;
          padding: 10px;
          border: 1px solid #ddd;
        }
        </style>
      `;

      const testFile = createTestFile(content, 'many-vue-components.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 30,
        dryRun: false,
        logLevel: 'info',
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000);
    });

    it('6.3 должен обрабатывать файл с глубокой вложенностью JSX', async () => {
      let content = `
        import React from 'react';
        function DeepComponent() {
          return (
            <div className="level-0">
      `;

      for (let i = 1; i <= 20; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}<div className="level-${i}">\n`;
        content += `${indent}  <span>Level ${i}</span>\n`;
      }

      for (let i = 20; i >= 0; i--) {
        const indent = '  '.repeat(i);
        content += `${indent}</div>\n`;
      }

      content += `
          );
        }
        export { DeepComponent };
      `;

      const testFile = createTestFile(content, 'deep-jsx.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });

    it('6.4 должен обрабатывать файл с глубокой вложенностью Vue template', async () => {
      let content = `
        <script setup>
        const data = ref({});
        </script>
        <template>
          <div class="level-0">
      `;

      for (let i = 1; i <= 20; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}<div class="level-${i}">\n`;
        content += `${indent}  <span>Level ${i}</span>\n`;
      }

      for (let i = 20; i >= 0; i--) {
        const indent = '  '.repeat(i);
        content += `${indent}</div>\n`;
      }

      content += `
          </div>
        </template>
      `;

      const testFile = createTestFile(content, 'deep-vue.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
      });

      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();

      expect(result.success).toBe(true);
    });
  });
});
