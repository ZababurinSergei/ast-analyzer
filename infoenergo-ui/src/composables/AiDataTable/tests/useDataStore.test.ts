import { computed } from 'vue';
import type * as NaiveUi from 'naive-ui';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useDataStore } from '@/composables/AiDataTable/useDataStore.ts';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';

const messageApi = {
    success: vi.fn(),
    error: vi.fn(),
};

vi.mock('naive-ui', async importOriginal => {
    const actual = await importOriginal<typeof NaiveUi>();
    return {
        ...actual,
        useMessage: () => messageApi,
    };
});

describe('useDataStore', () => {
    const getMock = vi.fn();
    const setMock = vi.fn();

    const createMeta = (overrides: Partial<Meta> = {}) =>
        computed(
            () =>
                ({
                    isEditable: true,
                    keyExpr: 'id',
                    selectionMode: 'multiple',
                    api: { get: getMock, set: setMock },
                    columns: [
                        { dataField: 'name', dataType: 'string' },
                        { dataField: 'cityId', dataType: 'number', displayField: 'cityName' },
                    ],
                    ...overrides,
                }) as Meta
        );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getData загружает и заменяет локальные данные при success=true', async () => {
        const meta = createMeta();
        const { data, getData } = useDataStore(meta, 'id');
        getMock.mockResolvedValue({ success: true, data: [{ id: 1 }, { id: 2 }] });

        const result = await getData();

        expect(result).toBe(true);
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(data).toEqual([{ id: 1 }, { id: 2 }]);
        expect(messageApi.success).toHaveBeenCalledWith('Данные успешно загружены');
    });

    it('getData возвращает false и показывает ошибку при success=false', async () => {
        const meta = createMeta();
        const { getData } = useDataStore(meta, 'id');
        getMock.mockResolvedValue({ success: false, error: 'boom' });

        const result = await getData();

        expect(result).toBe(false);
        expect(messageApi.error).toHaveBeenCalledWith('Ошибка при загрузке данных: boom');
    });

    it('updateRowField меняет поле и возвращает старое значение', () => {
        const meta = createMeta();
        const { data, updateRowField } = useDataStore(meta, 'id');
        data.push({ id: 1, name: 'old' });

        const oldValue = updateRowField(1, 'name', 'new');

        expect(oldValue).toBe('old');
        expect(data[0]?.name).toBe('new');
    });

    it('insertNewRow добавляет строку с null-полями и признаком isNewRow', () => {
        const newRowId = 0.123456789;
        vi.spyOn(Math, 'random').mockReturnValue(newRowId);

        const meta = createMeta();
        const { data, insertNewRow } = useDataStore(meta, 'id');

        const rowKey = insertNewRow(null);

        expect(rowKey).toBe(newRowId);
        expect(data[0]).toMatchObject({
            id: newRowId,
            name: null,
            cityId: null,
            cityName: null,
            isNewRow: true,
        });
    });

    it('deleteRows отправляет данные существующих строк на сервер', async () => {
        const meta = createMeta();
        const { data, deleteRows } = useDataStore(meta, 'id');
        data.push({ id: 1 }, { id: 2 }, { id: 3 });
        setMock.mockResolvedValue({ success: true });

        const result = await deleteRows([2, 3]);

        expect(result).toBe(true);
        expect(setMock).toHaveBeenCalledWith({
            insertDataArgs: [],
            updateDataArgs: [],
            deleteDataArgs: [{ id: 2 }, { id: 3 }],
        });
        expect(data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
        expect(messageApi.success).toHaveBeenCalledWith('Данные успешно удалены');
    });

    it('deleteRows удаляет новую строку локально без запроса на сервер', async () => {
        const meta = createMeta();
        const { data, deleteRows } = useDataStore(meta, 'id');
        data.push({ id: 1 }, { id: 'new-1', isNewRow: true });

        const result = await deleteRows(['new-1']);

        expect(result).toBe(true);
        expect(setMock).not.toHaveBeenCalled();
        expect(data.filter(Boolean)).toEqual([{ id: 1 }]);
        expect(messageApi.success).toHaveBeenCalledWith('Данные успешно удалены');
    });
});
