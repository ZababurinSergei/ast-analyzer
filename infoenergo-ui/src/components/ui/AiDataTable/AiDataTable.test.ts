import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, h, defineComponent } from 'vue';
import { NConfigProvider, NDataTable } from 'naive-ui';

import AiDataTable from '@/components/ui/AiDataTable/AiDataTable.vue';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';
import type { RowKey } from '@/interfaces/common.ts';

let loadDataMock: ReturnType<typeof vi.fn>;
let rebuildColumnsMock: ReturnType<typeof vi.fn>;
let resetStateMock: ReturnType<typeof vi.fn>;

let dataRef: ReturnType<typeof ref>;
let loadingRef: ReturnType<typeof ref>;
let checkedRowKeysRef: ReturnType<typeof ref>;

vi.mock('@/composables/AiDataTable/useDataState.ts', () => ({
    useDataState: vi.fn(() => ({
        data: dataRef,
        loading: loadingRef,
        updateRow: vi.fn(),
        isModified: vi.fn(() => false),
        loadData: loadDataMock,
        saveData: vi.fn(),
        createRow: vi.fn(),
        removeRows: vi.fn().mockResolvedValue(true),
    })),
}));

vi.mock('@/composables/AiDataTable/useColumnsConfig.ts', () => ({
    useColumnsConfig: vi.fn(() => ({
        visibleColumns: [{ key: 'name', title: 'Name' }] as any,
        columnsChooser: { options: [], value: [] },
        setColumnsVisibility: vi.fn(),
        rebuildColumns: rebuildColumnsMock,
    })),
}));

vi.mock('@/composables/AiDataTable/useTableState.ts', () => ({
    useTableState: vi.fn((keyExpr: string = 'id') => ({
        keyExpr,
        checkedRowKeys: checkedRowKeysRef,
        getRowKey: (row: Record<string, string>) => row[keyExpr] ?? row.id,
        resetState: resetStateMock,
        syncState: vi.fn(),
        setFocusedRow: vi.fn(),
        isFocusedRow: vi.fn(() => false),
        isCheckedRow: vi.fn(() => false),
    })),
}));

describe('AiDataTable', () => {
    const createMeta = (overrides: Partial<Meta> = {}): Meta =>
        ({
            isEditable: false,
            selectionMode: 'multiple',
            keyExpr: 'id',
            api: {
                get: '/api/get',
                set: '/api/set',
            },
            columns: [],
            ...overrides,
        }) as Meta;

    const mountComponent = (metaOverrides: Partial<Meta> = {}) =>
        mount(NConfigProvider, {
            slots: {
                default: () => h(AiDataTable, { meta: createMeta(metaOverrides) }),
            },
        });

    beforeEach(() => {
        dataRef = ref<any[]>([]);
        loadingRef = ref<boolean>(false);
        checkedRowKeysRef = ref<RowKey[]>([]);
        loadDataMock = vi.fn().mockResolvedValue(true);
        rebuildColumnsMock = vi.fn();
        resetStateMock = vi.fn();
    });

    it('инициализирует состояние и передаёт данные и колонки в NDataTable', async () => {
        dataRef.value = [{ id: 1, name: 'John' }];
        loadingRef.value = true;

        const wrapper = mountComponent();
        await flushPromises();

        const table = wrapper.findComponent(NDataTable);
        expect(table.exists()).toBe(true);
        expect(table.props('data')).toEqual(dataRef.value);
        expect(table.props('columns')).toEqual([{ key: 'name', title: 'Name' }]);
        expect(table.props('loading')).toBe(true);
    });

    it('вызывает loadData на монтировании', async () => {
        const wrapper = mountComponent();
        await flushPromises();

        expect(loadDataMock).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });

    it('использует meta.keyExpr для вычисления rowKey', async () => {
        const meta = createMeta({
            keyExpr: 'customId',
        });

        const wrapper = mount(NConfigProvider, {
            slots: {
                default: () => h(AiDataTable as any, { meta }),
            },
        });

        const table = wrapper.findComponent(NDataTable);
        const rowKey = table.props('rowKey') as (row: any) => string;

        const row = { id: '1', customId: 'abc' };
        expect(rowKey(row)).toBe('abc');
    });

    it('по умолчанию использует поле id для rowKey, если keyExpr не задан', async () => {
        const meta = createMeta({
            keyExpr: undefined,
        });

        const wrapper = mount(NConfigProvider, {
            slots: {
                default: () => h(AiDataTable, { meta }),
            },
        });

        const table = wrapper.findComponent(NDataTable);
        const rowKey = table.props('rowKey') as (row: any) => string;

        const row = { id: '123' };
        expect(rowKey(row)).toBe('123');
    });

    it('вызывает rebuildColumns при изменении meta', async () => {
        const TestWrapper = defineComponent({
            components: { NConfigProvider, AiDataTable },
            setup() {
                const metaRef = ref<Meta>(createMeta({ selectionMode: 'multiple' }));
                const setMeta = (m: Meta) => {
                    metaRef.value = m;
                };
                return { metaRef, setMeta };
            },
            template: '<n-config-provider><ai-data-table :meta="metaRef" /></n-config-provider>',
        });

        const wrapper = mount(TestWrapper);
        await flushPromises();
        rebuildColumnsMock.mockClear();

        const vm = wrapper.vm as { metaRef: Meta; setMeta: (m: Meta) => void };
        vm.setMeta({ ...vm.metaRef, selectionMode: 'single' });
        await flushPromises();

        expect(rebuildColumnsMock).toHaveBeenCalledTimes(1);
    });
});
