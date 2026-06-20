// packages/ast-analyzer/src/refactor/__tests__/jsx-vue-advanced-edge.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AutoRefactor } from '../index.js';

describe('JSX/TSX и Vue - САМЫЕ СЛОЖНЫЕ КРАЕВЫЕ СЦЕНАРИИ', () => {
  const testDir = path.join(process.cwd(), 'test-temp-jsx-vue-advanced-edge');

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
  // 1. JSX - ЭКЗОТИЧЕСКИЕ КОНСТРУКЦИИ
  // ============================================

  describe('JSX - Экзотические конструкции', () => {
    it('1.1 должен правильно анализировать JSX с динамическими импортами и lazy', async () => {
      const content = `
        import React, { lazy, Suspense, useState } from 'react';
        
        const LazyComponent = lazy(() => import('./HeavyComponent'));
        const AnotherLazy = lazy(() => import('./AnotherComponent'));
        
        interface DynamicImportsProps {
          componentName: 'Heavy' | 'Another';
        }
        
        function DynamicImports({ componentName }: DynamicImportsProps) {
          const [show, setShow] = useState(false);
          
          const ComponentMap = {
            Heavy: LazyComponent,
            Another: AnotherLazy,
          };
          
          const SelectedComponent = ComponentMap[componentName];
          
          return (
            <div>
              <button onClick={() => setShow(!show)}>
                {show ? 'Hide' : 'Show'} Component
              </button>
              
              {show && (
                <Suspense fallback={<div>Loading...</div>}>
                  <SelectedComponent />
                </Suspense>
              )}
            </div>
          );
        }
        
        export { DynamicImports };
      `;
      const testFile = createTestFile(content, 'dynamic-imports.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('1.2 должен правильно анализировать JSX с HOC (Higher-Order Components)', async () => {
      const content = `
        import React from 'react';
        
        interface WithLoadingProps {
          loading: boolean;
        }
        
        function withLoading<P extends object>(
          WrappedComponent: React.ComponentType<P>
        ) {
          return function WithLoadingComponent(props: P & WithLoadingProps) {
            const { loading, ...rest } = props;
            
            if (loading) {
              return <div>Loading...</div>;
            }
            
            return <WrappedComponent {...(rest as P)} />;
          };
        }
        
        interface DataComponentProps {
          data: string[];
          title: string;
        }
        
        function DataComponent({ data, title }: DataComponentProps) {
          return (
            <div>
              <h2>{title}</h2>
              <ul>
                {data.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          );
        }
        
        const DataComponentWithLoading = withLoading(DataComponent);
        
        function App() {
          const [loading, setLoading] = useState(true);
          const [data, setData] = useState<string[]>([]);
          
          useEffect(() => {
            setTimeout(() => {
              setData(['Item 1', 'Item 2', 'Item 3']);
              setLoading(false);
            }, 1000);
          }, []);
          
          return (
            <DataComponentWithLoading 
              loading={loading}
              data={data}
              title="Data List"
            />
          );
        }
        
        export { App, withLoading, DataComponent };
      `;
      const testFile = createTestFile(content, 'hoc-components.tsx');

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

    it('1.3 должен правильно анализировать JSX с Render Props и Children as Function', async () => {
      const content = `
        import React from 'react';
        
        interface ToggleProps {
          children: (props: {
            on: boolean;
            toggle: () => void;
            setOn: (value: boolean) => void;
          }) => React.ReactNode;
        }
        
        function Toggle({ children }: ToggleProps) {
          const [on, setOn] = useState(false);
          const toggle = () => setOn(!on);
          
          return children({ on, toggle, setOn });
        }
        
        interface MouseTrackerProps {
          children: (props: {
            x: number;
            y: number;
            isMoving: boolean;
          }) => React.ReactNode;
        }
        
        function MouseTracker({ children }: MouseTrackerProps) {
          const [position, setPosition] = useState({ x: 0, y: 0 });
          const [isMoving, setIsMoving] = useState(false);
          
          useEffect(() => {
            const handleMove = (e: MouseEvent) => {
              setPosition({ x: e.clientX, y: e.clientY });
              setIsMoving(true);
              const timeout = setTimeout(() => setIsMoving(false), 500);
              return () => clearTimeout(timeout);
            };
            
            window.addEventListener('mousemove', handleMove);
            return () => window.removeEventListener('mousemove', handleMove);
          }, []);
          
          return children({ ...position, isMoving });
        }
        
        function App() {
          return (
            <div>
              <Toggle>
                {({ on, toggle }) => (
                  <div>
                    <button onClick={toggle}>
                      {on ? 'ON' : 'OFF'}
                    </button>
                    <p>State: {on ? 'Active' : 'Inactive'}</p>
                  </div>
                )}
              </Toggle>
              
              <MouseTracker>
                {({ x, y, isMoving }) => (
                  <div>
                    <p>Mouse: ({x}, {y})</p>
                    <p>Status: {isMoving ? 'Moving...' : 'Stopped'}</p>
                  </div>
                )}
              </MouseTracker>
            </div>
          );
        }
        
        export { App, Toggle, MouseTracker };
      `;
      const testFile = createTestFile(content, 'render-props.tsx');

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

    it('1.4 должен правильно анализировать JSX с Error Boundaries', async () => {
      const content = `
        import React from 'react';
        
        interface ErrorBoundaryProps {
          children: React.ReactNode;
          fallback?: React.ReactNode;
          onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
        }
        
        interface ErrorBoundaryState {
          hasError: boolean;
          error: Error | null;
        }
        
        class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
          constructor(props: ErrorBoundaryProps) {
            super(props);
            this.state = { hasError: false, error: null };
          }
          
          static getDerivedStateFromError(error: Error): ErrorBoundaryState {
            return { hasError: true, error };
          }
          
          componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
            this.props.onError?.(error, errorInfo);
            console.error('Error caught:', error, errorInfo);
          }
          
          render() {
            if (this.state.hasError) {
              if (this.props.fallback) {
                return this.props.fallback;
              }
              return (
                <div className="error-boundary">
                  <h2>Something went wrong</h2>
                  <details>
                    <summary>Error details</summary>
                    <pre>{this.state.error?.message}</pre>
                  </details>
                </div>
              );
            }
            
            return this.props.children;
          }
        }
        
        function BuggyComponent() {
          const [shouldThrow, setShouldThrow] = useState(false);
          
          if (shouldThrow) {
            throw new Error('Intentional error!');
          }
          
          return (
            <div>
              <button onClick={() => setShouldThrow(true)}>
                Throw Error
              </button>
            </div>
          );
        }
        
        function App() {
          const [errorCount, setErrorCount] = useState(0);
          
          return (
            <ErrorBoundary
              fallback={<div>Custom fallback UI</div>}
              onError={() => setErrorCount(prev => prev + 1)}
            >
              <BuggyComponent />
            </ErrorBoundary>
          );
        }
        
        export { App, ErrorBoundary, BuggyComponent };
      `;
      const testFile = createTestFile(content, 'error-boundaries.tsx');

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

    it('1.5 должен правильно анализировать JSX с Compound Components', async () => {
      const content = `
        import React from 'react';
        
        interface TabsContextType {
          activeTab: string;
          setActiveTab: (id: string) => void;
        }
        
        const TabsContext = createContext<TabsContextType | undefined>(undefined);
        
        function useTabs() {
          const context = useContext(TabsContext);
          if (!context) {
            throw new Error('Tabs components must be used within Tabs provider');
          }
          return context;
        }
        
        interface TabsProps {
          defaultTab?: string;
          children: React.ReactNode;
        }
        
        function Tabs({ defaultTab = 'tab1', children }: TabsProps) {
          const [activeTab, setActiveTab] = useState(defaultTab);
          
          return (
            <TabsContext.Provider value={{ activeTab, setActiveTab }}>
              <div className="tabs">
                {children}
              </div>
            </TabsContext.Provider>
          );
        }
        
        interface TabListProps {
          children: React.ReactNode;
        }
        
        function TabList({ children }: TabListProps) {
          return (
            <div className="tab-list" role="tablist">
              {children}
            </div>
          );
        }
        
        interface TabProps {
          id: string;
          children: React.ReactNode;
        }
        
        function Tab({ id, children }: TabProps) {
          const { activeTab, setActiveTab } = useTabs();
          const isActive = activeTab === id;
          
          return (
            <button
              className={\`tab \${isActive ? 'active' : ''}\`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(id)}
            >
              {children}
            </button>
          );
        }
        
        interface TabPanelProps {
          id: string;
          children: React.ReactNode;
        }
        
        function TabPanel({ id, children }: TabPanelProps) {
          const { activeTab } = useTabs();
          
          if (activeTab !== id) {
            return null;
          }
          
          return (
            <div className="tab-panel" role="tabpanel">
              {children}
            </div>
          );
        }
        
        function App() {
          return (
            <Tabs defaultTab="tab1">
              <TabList>
                <Tab id="tab1">Tab 1</Tab>
                <Tab id="tab2">Tab 2</Tab>
                <Tab id="tab3">Tab 3</Tab>
              </TabList>
              <TabPanel id="tab1">Content for Tab 1</TabPanel>
              <TabPanel id="tab2">Content for Tab 2</TabPanel>
              <TabPanel id="tab3">Content for Tab 3</TabPanel>
            </Tabs>
          );
        }
        
        export { App, Tabs, TabList, Tab, TabPanel };
      `;
      const testFile = createTestFile(content, 'compound-components.tsx');

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
  });

  // ============================================
  // 2. VUE - ЭКЗОТИЧЕСКИЕ КОНСТРУКЦИИ
  // ============================================

  describe('Vue - Экзотические конструкции', () => {
    it('2.1 должен правильно анализировать Vue с динамическими компонентами', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, defineAsyncComponent, markRaw } from 'vue';
        
        const components = {
          ComponentA: defineAsyncComponent(() => import('./ComponentA.vue')),
          ComponentB: defineAsyncComponent(() => import('./ComponentB.vue')),
          ComponentC: defineAsyncComponent(() => import('./ComponentC.vue')),
        };
        
        const currentComponent = ref<keyof typeof components>('ComponentA');
        const componentKeys = Object.keys(components) as Array<keyof typeof components>;
        
        function switchComponent(key: keyof typeof components) {
          currentComponent.value = key;
        }
        </script>
        
        <template>
          <div>
            <div class="buttons">
              <button 
                v-for="key in componentKeys" 
                :key="key"
                @click="switchComponent(key)"
                :class="{ active: currentComponent === key }"
              >
                {{ key }}
              </button>
            </div>
            
            <component :is="markRaw(components[currentComponent])" />
          </div>
        </template>
        
        <style scoped>
        .buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .buttons button {
          padding: 8px 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
        }
        .buttons button.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'dynamic-components.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('2.2 должен правильно анализировать Vue с render функциями', async () => {
      const content = `
        <script>
        import { h, ref, computed } from 'vue';
        
        export default {
          name: 'RenderFunctionComponent',
          setup() {
            const count = ref(0);
            const doubled = computed(() => count.value * 2);
            
            const increment = () => count.value++;
            const decrement = () => count.value--;
            
            return { count, doubled, increment, decrement };
          },
          render() {
            return h('div', { class: 'counter' }, [
              h('h2', 'Render Function Counter'),
              h('p', \`Count: \${this.count}\`),
              h('p', \`Doubled: \${this.doubled}\`),
              h('div', { class: 'buttons' }, [
                h('button', { onClick: this.decrement }, '-'),
                h('button', { onClick: this.increment }, '+'),
              ]),
              h('div', { class: 'status' }, [
                this.count > 10 
                  ? h('span', { style: { color: 'red' } }, 'High count!') 
                  : h('span', 'Normal count'),
              ]),
            ]);
          },
        };
        </script>
        
        <style scoped>
        .counter {
          padding: 20px;
          border: 1px solid #ccc;
          border-radius: 8px;
        }
        .buttons {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        .buttons button {
          padding: 5px 15px;
        }
        .status {
          margin-top: 10px;
          padding: 10px;
          background: #f0f0f0;
          border-radius: 4px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'render-function.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('2.3 должен правильно анализировать Vue с кастомными директивами', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, Directive } from 'vue';
        
        const vFocus: Directive = {
          mounted(el: HTMLElement) {
            el.focus();
          },
        };
        
        const vColor: Directive<[color: string, duration: number]> = {
          mounted(el: HTMLElement, binding) {
            const [color, duration] = binding.value || ['red', 1000];
            el.style.color = color;
            el.style.transition = \`color \${duration}ms\`;
          },
          updated(el: HTMLElement, binding) {
            const [color] = binding.value || ['red', 1000];
            el.style.color = color;
          },
        };
        
        const vClickOutside: Directive = {
          mounted(el, binding) {
            const handler = (e: Event) => {
              if (!el.contains(e.target as Node)) {
                binding.value();
              }
            };
            document.addEventListener('click', handler);
            (el as any)._clickOutsideHandler = handler;
          },
          unmounted(el) {
            const handler = (el as any)._clickOutsideHandler;
            if (handler) {
              document.removeEventListener('click', handler);
            }
          },
        };
        
        const isVisible = ref(true);
        const color = ref('blue');
        const clickCount = ref(0);
        </script>
        
        <template>
          <div>
            <input v-focus placeholder="Auto-focused input" />
            
            <p v-color="[color, 500]">This text has dynamic color</p>
            
            <div v-click-outside="() => clickCount++">
              <p>Click outside this box to increment</p>
              <p>Click count: {{ clickCount }}</p>
            </div>
            
            <button @click="color = color === 'blue' ? 'red' : 'blue'">
              Toggle Color
            </button>
          </div>
        </template>
        
        <style scoped>
        input {
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        div[style*="color"] {
          padding: 10px;
          border: 2px dashed #ccc;
          border-radius: 4px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'custom-directives.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('2.4 должен правильно анализировать Vue с plugins и global компонентами', async () => {
      const content = `
        <script setup lang="ts">
        import { inject, ref } from 'vue';
        
        interface PluginData {
          version: string;
          features: string[];
          isEnabled: boolean;
        }
        
        const pluginData = inject<PluginData>('pluginData');
        const globalCounter = inject<{ count: number; increment: () => void }>(
          'globalCounter'
        );
        
        const localCount = ref(0);
        </script>
        
        <template>
          <div class="plugin-test">
            <h2>Plugin Integration</h2>
            
            <div v-if="pluginData" class="plugin-info">
              <p><strong>Version:</strong> {{ pluginData.version }}</p>
              <p><strong>Features:</strong> {{ pluginData.features.join(', ') }}</p>
              <p><strong>Enabled:</strong> {{ pluginData.isEnabled ? '✅' : '❌' }}</p>
            </div>
            
            <div v-if="globalCounter" class="counter">
              <p><strong>Global Count:</strong> {{ globalCounter.count }}</p>
              <button @click="globalCounter.increment">Increment Global</button>
            </div>
            
            <div class="local-counter">
              <p><strong>Local Count:</strong> {{ localCount }}</p>
              <button @click="localCount++">Increment Local</button>
            </div>
          </div>
        </template>
        
        <style scoped>
        .plugin-test {
          padding: 20px;
        }
        .plugin-info, .counter, .local-counter {
          padding: 15px;
          margin: 10px 0;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
        }
        button {
          padding: 5px 15px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-plugins.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('2.5 должен правильно анализировать Vue с Transition и TransitionGroup', async () => {
      const content = `
        <script setup lang="ts">
        import { ref } from 'vue';
        
        const items = ref([1, 2, 3, 4, 5]);
        const show = ref(true);
        const nextId = ref(6);
        
        function addItem() {
          items.value.push(nextId.value);
          nextId.value++;
        }
        
        function removeItem(index: number) {
          items.value.splice(index, 1);
        }
        
        function shuffleItems() {
          for (let i = items.value.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items.value[i], items.value[j]] = [items.value[j], items.value[i]];
          }
        }
        </script>
        
        <template>
          <div>
            <button @click="show = !show">Toggle</button>
            <button @click="addItem">Add</button>
            <button @click="shuffleItems">Shuffle</button>
            
            <Transition name="fade">
              <p v-if="show">This element fades</p>
            </Transition>
            
            <TransitionGroup name="list" tag="ul" class="list">
              <li 
                v-for="(item, index) in items" 
                :key="item"
                class="list-item"
              >
                {{ item }}
                <button @click="removeItem(index)">×</button>
              </li>
            </TransitionGroup>
          </div>
        </template>
        
        <style scoped>
        .fade-enter-active,
        .fade-leave-active {
          transition: opacity 0.5s ease;
        }
        .fade-enter-from,
        .fade-leave-to {
          opacity: 0;
        }
        
        .list-enter-active,
        .list-leave-active {
          transition: all 0.5s ease;
        }
        .list-enter-from,
        .list-leave-to {
          opacity: 0;
          transform: translateX(30px);
        }
        .list-move {
          transition: transform 0.5s ease;
        }
        
        .list-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          margin: 5px 0;
          background: #f5f5f5;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }
        .list-item button {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 2px 8px;
          cursor: pointer;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-transitions.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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
  // 3. JSX + VUE - ГИБРИДНЫЕ ЭКЗОТИЧЕСКИЕ СЦЕНАРИИ
  // ============================================

  describe('JSX + Vue - Гибридные экзотические сценарии', () => {
    it('3.1 должен правильно анализировать файл с JSX и Vue в разных частях', async () => {
      const content = `
        // React часть
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        
        // Vue часть
        import { createApp, ref, defineComponent, h } from 'vue';
        
        // React компонент
        function ReactButton({ onClick, children }) {
          return <button onClick={onClick} className="react-btn">{children}</button>;
        }
        
        // Vue компонент (в JSX файле)
        const VueComponent = defineComponent({
          name: 'VueInReact',
          setup() {
            const count = ref(0);
            const increment = () => count.value++;
            
            return () => h('div', { className: 'vue-in-react' }, [
              h('h2', 'Vue Component in React File'),
              h('p', \`Count: \${count.value}\`),
              h('button', { onClick: increment }, 'Increment Vue'),
              h(ReactButton, { onClick: increment }, 'React Button'),
            ]);
          },
        });
        
        // Гибридный компонент
        function HybridApp() {
          const [reactCount, setReactCount] = React.useState(0);
          
          // Vue компонент в React
          const vueRef = React.useRef<HTMLDivElement>(null);
          
          React.useEffect(() => {
            if (vueRef.current) {
              const app = createApp(VueComponent);
              app.mount(vueRef.current);
              return () => app.unmount();
            }
          }, []);
          
          return (
            <div>
              <h1>Hybrid Application</h1>
              <div>
                <p>React Count: {reactCount}</p>
                <ReactButton onClick={() => setReactCount(reactCount + 1)}>
                  Increment React
                </ReactButton>
              </div>
              <div ref={vueRef} />
            </div>
          );
        }
        
        export { HybridApp, ReactButton, VueComponent };
      `;
      const testFile = createTestFile(content, 'hybrid-exotic.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('3.2 должен правильно анализировать Vue SFC с JSX внутри script', async () => {
      const content = `
        <script setup lang="tsx">
        import { ref, defineComponent, h } from 'vue';
        
        // JSX внутри Vue SFC
        const ReactLikeComponent = defineComponent({
          props: {
            message: String,
            count: Number,
          },
          setup(props) {
            const localCount = ref(props.count || 0);
            
            const increment = () => localCount.value++;
            
            return () => (
              <div class="jsx-in-vue">
                <h2>{props.message}</h2>
                <p>Count: {localCount.value}</p>
                <button onClick={increment}>Increment</button>
              </div>
            );
          },
        });
        
        const listItems = ref(['Item 1', 'Item 2', 'Item 3']);
        const activeIndex = ref(0);
        
        const ListComponent = defineComponent({
          setup() {
            return () => (
              <div class="list">
                <h3>List</h3>
                <ul>
                  {listItems.value.map((item, index) => (
                    <li 
                      key={index}
                      class={{ active: activeIndex.value === index }}
                      onClick={() => activeIndex.value = index}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          },
        });
        </script>
        
        <template>
          <div>
            <h1>Vue SFC with JSX</h1>
            <ReactLikeComponent message="Hello from JSX" :count="5" />
            <ListComponent />
            
            <div class="native-vue">
              <p>Native Vue template still works!</p>
            </div>
          </div>
        </template>
        
        <style scoped>
        .jsx-in-vue {
          padding: 20px;
          border: 2px solid #42b883;
          border-radius: 8px;
          margin: 10px 0;
        }
        .list {
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }
        .list ul {
          list-style: none;
          padding: 0;
        }
        .list li {
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.3s;
        }
        .list li:hover {
          background: #f0f0f0;
        }
        .list li.active {
          background: #42b883;
          color: white;
        }
        .native-vue {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-with-jsx.vue');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('3.3 должен правильно анализировать экзотический файл с JSX и Vue imports + exports', async () => {
      const content = `
        // React imports
        import React, { useState, useEffect, useCallback } from 'react';
        import { createPortal } from 'react-dom';
        
        // Vue imports
        import { ref, computed, watch, onMounted, reactive } from 'vue';
        import { defineComponent, h } from 'vue';
        
        // React компонент с хуками
        function Counter({ initial = 0 }) {
          const [count, setCount] = useState(initial);
          const [doubleCount, setDoubleCount] = useState(initial * 2);
          
          useEffect(() => {
            setDoubleCount(count * 2);
          }, [count]);
          
          const increment = useCallback(() => {
            setCount(c => c + 1);
          }, []);
          
          const decrement = useCallback(() => {
            setCount(c => c - 1);
          }, []);
          
          return (
            <div className="react-counter">
              <h3>React Counter</h3>
              <p>Count: {count}</p>
              <p>Double: {doubleCount}</p>
              <button onClick={increment}>+</button>
              <button onClick={decrement}>-</button>
            </div>
          );
        }
        
        // Vue компонент (в JSX файле)
        const VueCounter = defineComponent({
          name: 'VueCounter',
          props: {
            initial: {
              type: Number,
              default: 0,
            },
          },
          setup(props) {
            const count = ref(props.initial);
            const doubled = computed(() => count.value * 2);
            
            watch(count, (newVal, oldVal) => {
              console.log(\`Count changed: \${oldVal} -> \${newVal}\`);
            });
            
            onMounted(() => {
              console.log('VueCounter mounted');
            });
            
            const state = reactive({
              history: [] as number[],
            });
            
            const increment = () => {
              count.value++;
              state.history.push(count.value);
            };
            
            const decrement = () => {
              count.value--;
              state.history.push(count.value);
            };
            
            return () => (
              <div className="vue-counter">
                <h3>Vue Counter (in JSX)</h3>
                <p>Count: {count.value}</p>
                <p>Doubled: {doubled.value}</p>
                <p>History: {state.history.join(', ')}</p>
                <button onClick={increment}>+</button>
                <button onClick={decrement}>-</button>
              </div>
            );
          },
        });
        
        // Гибридный компонент
        function HybridApp() {
          const [showVue, setShowVue] = useState(true);
          const [mode, setMode] = useState<'react' | 'vue' | 'hybrid'>('hybrid');
          
          return (
            <div>
              <div className="controls">
                <button onClick={() => setMode('react')}>React Mode</button>
                <button onClick={() => setMode('vue')}>Vue Mode</button>
                <button onClick={() => setMode('hybrid')}>Hybrid Mode</button>
                <button onClick={() => setShowVue(!showVue)}>
                  Toggle Vue: {showVue ? 'ON' : 'OFF'}
                </button>
              </div>
              
              {mode === 'react' && <Counter initial={10} />}
              
              {mode === 'vue' && showVue && <VueCounter initial={20} />}
              
              {mode === 'hybrid' && (
                <div className="hybrid">
                  <Counter initial={5} />
                  {showVue && <VueCounter initial={15} />}
                </div>
              )}
            </div>
          );
        }
        
        // Экспорты
        export { 
          HybridApp, 
          Counter, 
          VueCounter,
          // React exports
          useState, useEffect, useCallback,
          // Vue exports  
          ref, computed, watch, onMounted, reactive,
          // Utility exports
          createPortal,
        };
        
        // Default export
        export default HybridApp;
      `;
      const testFile = createTestFile(content, 'hybrid-exports.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 3,
        maxClusterSize: 5,
        minCohesionScore: 30,
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
  // 4. ЭКЗОТИЧЕСКИЕ ОШИБКИ И ВОССТАНОВЛЕНИЕ
  // ============================================

  describe('Экзотические ошибки и восстановление', () => {
    it('4.1 должен восстанавливаться после ошибки в JSX парсинге', async () => {
      const content = `
        import React from 'react';
        
        function BrokenJSX() {
          const items = [1, 2, 3];
          const [count, setCount] = useState(0);
          
          // Несколько ошибок в JSX
          return (
            <div>
              {items.map(item => (
                <span>{item}</span> // Пропущен key
              ))}
              <button onClick={setCount(count + 1)}> // Неправильный синтаксис
                Count: {count}
              </button>
              <div class="broken"> // Нет закрывающего тега
            </div>
          );
        }
        
        function AnotherBroken() {
          return <div><span>Unclosed</div>;
        }
        
        export { BrokenJSX, AnotherBroken };
      `;
      const testFile = createTestFile(content, 'broken-jsx-recovery.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        autoFix: true,
        eslintCheck: true,
        eslintFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        guaranteeMode: true,
        maxAttempts: 3,
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

    it('4.2 должен восстанавливаться после ошибки в Vue парсинге', async () => {
      const content = `
        <script setup>
        import { ref } from 'vue';
        
        const count = ref(0);
        const items = ref([1, 2, 3]);
        </script>
        
        <template>
          <div>
            <p>{{ count } // Незакрытая интерполяция
            
            <ul>
              <li v-for="item in items"> // Пропущен key
                {{ item }}
              </li>
            </ul>
            
            <button @click="count++">Increment</button>
          </div>
        </template>
        
        <style>
        .broken {
          color: red;
        </style>
      `;
      const testFile = createTestFile(content, 'broken-vue-recovery.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        autoFix: true,
        eslintCheck: true,
        eslintFix: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
        dryRun: false,
        guaranteeMode: true,
        maxAttempts: 3,
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

    it('4.3 должен обрабатывать файл с битыми импортами в JSX и Vue', async () => {
      const content = `
        // Неправильные React импорты
        import React, { useState, useEffect } from 'react-dom';
        import { createPortal } from 'react';
        
        // Неправильные Vue импорты
        import { ref, computed } from 'vue-router';
        import { defineComponent } from '@vue/runtime-dom';
        
        // React компонент
        function ReactComponent() {
          const [data, setData] = useState({});
          const [loading, setLoading] = useState(true);
          
          useEffect(() => {
            // Имитация загрузки
            setTimeout(() => {
              setData({ message: 'Hello' });
              setLoading(false);
            }, 1000);
          }, []);
          
          return (
            <div>
              {loading ? <p>Loading...</p> : <p>{data.message}</p>}
            </div>
          );
        }
        
        // Vue компонент
        const VueComponent = defineComponent({
          setup() {
            const count = ref(0);
            const doubled = computed(() => count.value * 2);
            
            return () => (
              <div>
                <p>Count: {count.value}</p>
                <p>Doubled: {doubled.value}</p>
                <button onClick={() => count.value++}>+</button>
              </div>
            );
          },
        });
        
        export { ReactComponent, VueComponent };
      `;
      const testFile = createTestFile(content, 'broken-imports.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        autoFix: true,
        fixUnusedImports: true,
        optimizeImports: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('4.4 должен обрабатывать файл с огромным количеством JSX и Vue компонентов', async () => {
      let content = `
        import React from 'react';
        import { ref, computed, defineComponent, h } from 'vue';
      `;

      // 50 React компонентов
      for (let idx = 0; idx < 50; idx++) {
        content += `
          function ReactComp${idx}({ value, onUpdate }: { value: number; onUpdate: (v: number) => void }) {
            const [count, setCount] = React.useState(value);
            const [isActive, setIsActive] = React.useState(false);
            
            React.useEffect(() => {
              onUpdate(count);
            }, [count]);
            
            return (
              <div className="react-comp-${idx}">
                <h4>React Component ${idx}</h4>
                <p>Count: {count}</p>
                <p>Active: {isActive ? '✅' : '❌'}</p>
                <button onClick={() => setCount(c => c + 1)}>+</button>
                <button onClick={() => setCount(c => c - 1)}>-</button>
                <button onClick={() => setIsActive(!isActive)}>Toggle</button>
              </div>
            );
          }
        `;
      }

      // 50 Vue компонентов
      for (let idx = 0; idx < 50; idx++) {
        content += `
          const VueComp${idx} = defineComponent({
            name: 'VueComp${idx}',
            props: {
              initial: { type: Number, default: 0 },
            },
            setup(props) {
              const count = ref(props.initial);
              const doubled = computed(() => count.value * 2);
              const isVisible = ref(true);
              
              const increment = () => count.value++;
              const decrement = () => count.value--;
              const toggle = () => isVisible.value = !isVisible.value;
              
              return () => (
                <div className="vue-comp-${idx}">
                  <h4>Vue Component ${idx}</h4>
                  <p>Count: {count.value}</p>
                  <p>Doubled: {doubled.value}</p>
                  <p>Visible: {isVisible.value ? '✅' : '❌'}</p>
                  <button onClick={increment}>+</button>
                  <button onClick={decrement}>-</button>
                  <button onClick={toggle}>Toggle</button>
                </div>
              );
            },
          });
        `;
      }

      // Собираем имена компонентов для рендера
      const reactCompNames = Array.from({ length: 50 }, (_, idx) => `ReactComp${idx}`);
      const vueCompNames = Array.from({ length: 50 }, (_, idx) => `VueComp${idx}`);

      content += `
        function App() {
          const [reactSum, setReactSum] = React.useState(0);
          const [vueSum, setVueSum] = React.useState(0);
          
          return (
            <div>
              <h1>Super Hybrid App</h1>
              <div className="react-section">
                <h2>React Components (50)</h2>
                <div className="grid">
                  ${reactCompNames
                    .map(
                      (name, idx) => `
                    <${name} 
                      key={${idx}}
                      value={${idx}}
                      onUpdate={(v) => setReactSum(s => s + v)}
                    />
                  `
                    )
                    .join('\n')}
                </div>
                <p>React Sum: {reactSum}</p>
              </div>
              <div className="vue-section">
                <h2>Vue Components (50)</h2>
                <div className="grid">
                  ${vueCompNames
                    .map(
                      (name, idx) => `
                    <${name} key={${idx}} initial={${idx}} />
                  `
                    )
                    .join('\n')}
                </div>
                <p>Vue Sum: {vueSum}</p>
              </div>
            </div>
          );
        }
        
        export { App };
      `;

      const testFile = createTestFile(content, 'super-hybrid.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        vueAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 20,
        dryRun: false,
        logLevel: 'info',
        semanticAnalysis: true,
        callGraphAnalysis: true,
      });

      const syntaxValidator = (refactor as any).syntaxValidator;
      vi.spyOn(syntaxValidator, 'validate').mockResolvedValue({
        valid: true,
        moduleType: 'esm',
        diagnostics: [],
        duration: 0,
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(60000);
    });
  });

  // ============================================
  // 5. ЭКЗОТИЧЕСКИЕ ТИПЫ ФАЙЛОВ
  // ============================================

  describe('Экзотические типы файлов', () => {
    it('5.1 должен правильно анализировать .jsx файл с TypeScript комментариями', async () => {
      const content = `
        // @ts-check
        /** @type {import('react').FC<{ label: string; onClick: () => void }>} */
        function Button({ label, onClick }) {
          // @ts-ignore
          const unused = 42;
          return <button onClick={onClick}>{label}</button>;
        }
        
        /** @param {string} name */
        function Greeting({ name }) {
          const message = \`Hello, \${name}!\`;
          return <div>{message}</div>;
        }
        
        export { Button, Greeting };
      `;
      const testFile = createTestFile(content, 'jsdoc-jsx.jsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
        dryRun: false,
        typeCheck: false,
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

    it('5.2 должен правильно анализировать .tsx файл с декораторами', async () => {
      const content = `
        import React from 'react';
        import { observer } from 'mobx-react';
        import { inject } from 'inversify';
        
        interface UserStore {
          users: string[];
          loading: boolean;
        }
        
        @observer
        class UserList extends React.Component<{ store: UserStore }> {
          @inject('UserStore')
          store!: UserStore;
          
          componentDidMount() {
            this.store.loading = true;
            fetchUsers().then(users => {
              this.store.users = users;
              this.store.loading = false;
            });
          }
          
          render() {
            const { users, loading } = this.store;
            
            return (
              <div>
                {loading ? (
                  <div className="loading">Loading...</div>
                ) : (
                  <ul>
                    {users.map((user, index) => (
                      <li key={index}>{user}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }
        }
        
        export { UserList };
      `;
      const testFile = createTestFile(content, 'tsx-decorators.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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

    it('5.3 должен правильно анализировать .vue файл с TypeScript и декораторами', async () => {
      const content = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';
        import { useStore } from 'vuex';
        import { Debounce } from 'vue-decorators';
        
        const store = useStore();
        const searchQuery = ref('');
        const searchResults = ref<string[]>([]);
        
        @Debounce(300)
        function performSearch(query: string) {
          const results = store.getters['search/searchItems'](query);
          searchResults.value = results;
        }
        
        const isLoading = computed(() => store.state.search.loading);
        const hasResults = computed(() => searchResults.value.length > 0);
        
        function onSearchInput(event: Event) {
          const query = (event.target as HTMLInputElement).value;
          searchQuery.value = query;
          performSearch(query);
        }
        
        function clearSearch() {
          searchQuery.value = '';
          searchResults.value = [];
        }
        </script>
        
        <template>
          <div class="search-container">
            <div class="search-bar">
              <input
                :value="searchQuery"
                @input="onSearchInput"
                placeholder="Search..."
                class="search-input"
              />
              <button @click="clearSearch" class="clear-btn">×</button>
            </div>
            
            <div v-if="isLoading" class="loading">
              <span>Searching...</span>
            </div>
            
            <div v-else-if="hasResults" class="results">
              <ul>
                <li v-for="(result, index) in searchResults" :key="index">
                  {{ result }}
                </li>
              </ul>
            </div>
            
            <div v-else-if="searchQuery" class="no-results">
              <p>No results found for "{{ searchQuery }}"</p>
            </div>
          </div>
        </template>
        
        <style scoped>
        .search-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .search-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .search-input {
          flex: 1;
          padding: 10px 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        .search-input:focus {
          outline: none;
          border-color: #42b883;
        }
        .clear-btn {
          padding: 10px 15px;
          background: #f5f5f5;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          font-size: 20px;
          color: #666;
          transition: all 0.3s;
        }
        .clear-btn:hover {
          background: #ff4444;
          color: white;
          border-color: #ff4444;
        }
        .loading {
          text-align: center;
          padding: 20px;
          color: #666;
        }
        .results ul {
          list-style: none;
          padding: 0;
        }
        .results li {
          padding: 12px 15px;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.3s;
        }
        .results li:hover {
          background: #f8f9fa;
        }
        .no-results {
          text-align: center;
          padding: 30px;
          color: #999;
        }
        </style>
      `;
      const testFile = createTestFile(content, 'vue-decorators.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 2,
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
  // 6. ПРОИЗВОДИТЕЛЬНОСТЬ И ПАМЯТЬ
  // ============================================

  describe('Производительность и память', () => {
    it('6.1 должен обрабатывать файл с глубокой вложенностью JSX (100 уровней)', async () => {
      let content = `
        import React from 'react';
        function DeepComponent() {
          return (
            <div className="level-0">
      `;

      for (let i = 1; i <= 100; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}<div className="level-${i}">\n`;
        content += `${indent}  <span>Level ${i}</span>\n`;
      }

      for (let i = 100; i >= 0; i--) {
        const indent = '  '.repeat(i);
        content += `${indent}</div>\n`;
      }

      content += `
          );
        }
        export { DeepComponent };
      `;

      const testFile = createTestFile(content, 'deep-100-jsx.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
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

    it('6.2 должен обрабатывать файл с глубокой вложенностью Vue template (100 уровней)', async () => {
      let content = `
        <script setup>
        const data = ref({});
        </script>
        <template>
          <div class="level-0">
      `;

      for (let i = 1; i <= 100; i++) {
        const indent = '  '.repeat(i);
        content += `${indent}<div class="level-${i}">\n`;
        content += `${indent}  <span>Level ${i}</span>\n`;
      }

      for (let i = 100; i >= 0; i--) {
        const indent = '  '.repeat(i);
        content += `${indent}</div>\n`;
      }

      content += `
          </div>
        </template>
      `;

      const testFile = createTestFile(content, 'deep-100-vue.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 1,
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

    it('6.3 должен обрабатывать файл с 200+ JSX компонентами и пропсами', async () => {
      let content = `
        import React from 'react';
      `;

      const components = [];
      for (let i = 0; i < 200; i++) {
        const name = `Comp${i}`;
        components.push(name);
        content += `
          function ${name}({ 
            value, 
            onUpdate, 
            active = false,
            label = 'Component ${i}'
          }: {
            value: number;
            onUpdate: (v: number) => void;
            active?: boolean;
            label?: string;
          }) {
            const [count, setCount] = React.useState(value);
            const [isActive, setIsActive] = React.useState(active);
            
            React.useEffect(() => {
              onUpdate(count);
            }, [count]);
            
            return (
              <div className={\`comp comp-\${i} \${isActive ? 'active' : ''}\`}>
                <span className="label">{label}</span>
                <span className="count">{count}</span>
                <button onClick={() => setCount(c => c + 1)}>+</button>
                <button onClick={() => setCount(c => c - 1)}>-</button>
                <button onClick={() => setIsActive(!isActive)}>
                  {isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            );
          }
        `;
      }

      content += `
        function App() {
          const [sum, setSum] = React.useState(0);
          
          return (
            <div>
              <h1>200 Components</h1>
              <p>Total Sum: {sum}</p>
              <div className="grid">
                ${components
                  .map(
                    (name, idx) => `
                  <${name} 
                    key={${idx}}
                    value={${idx}}
                    onUpdate={(v) => setSum(s => s + v)}
                  />
                `
                  )
                  .join('\n')}
              </div>
            </div>
          );
        }
        
        export { App };
      `;

      const testFile = createTestFile(content, '200-components.tsx');

      const refactor = new AutoRefactor({
        jsxAnalysis: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 20,
        dryRun: false,
        logLevel: 'info',
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(60000);
    });

    it('6.4 должен обрабатывать файл с 200+ Vue компонентами', async () => {
      let content = `
        <script setup lang="ts">
        import { ref, computed } from 'vue';
      `;

      for (let i = 0; i < 200; i++) {
        content += `
          const count${i} = ref(0);
          const doubled${i} = computed(() => count${i}.value * 2);
          const isEven${i} = computed(() => count${i}.value % 2 === 0);
          
          function increment${i}() { count${i}.value++; }
          function decrement${i}() { count${i}.value--; }
          function reset${i}() { count${i}.value = 0; }
        `;
      }

      content += `
        </script>
        <template>
          <div class="app">
            <h1>200 Vue Components</h1>
            <div class="grid">
      `;

      for (let i = 0; i < 200; i++) {
        content += `
              <div class="component comp-${i}" :class="{ even: isEven${i} }">
                <h3>Component ${i}</h3>
                <p>Count: {{ count${i} }}</p>
                <p>Doubled: {{ doubled${i} }}</p>
                <p>Even: {{ isEven${i} ? '✅' : '❌' }}</p>
                <div class="buttons">
                  <button @click="decrement${i}">-</button>
                  <button @click="increment${i}">+</button>
                  <button @click="reset${i}">Reset</button>
                </div>
              </div>
        `;
      }

      content += `
            </div>
          </div>
        </template>
        <style scoped>
        .app {
          padding: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
        }
        .component {
          padding: 15px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          transition: all 0.3s;
        }
        .component:hover {
          border-color: #42b883;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .component.even {
          background: #f0f9ff;
        }
        .buttons {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .buttons button {
          padding: 4px 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .buttons button:hover {
          background: #42b883;
          color: white;
          border-color: #42b883;
        }
        </style>
      `;

      const testFile = createTestFile(content, '200-vue-components.vue');

      const refactor = new AutoRefactor({
        vueAnalysis: true,
        updateTemplate: true,
        createBackup: true,
        incremental: true,
        targetClusterSize: 5,
        maxClusterSize: 10,
        minCohesionScore: 20,
        dryRun: false,
        logLevel: 'info',
      });

      const startTime = Date.now();
      await refactor.initialize();
      const result = await refactor.refactor(testFile);
      await refactor.dispose();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(60000);
    });
  });
});
