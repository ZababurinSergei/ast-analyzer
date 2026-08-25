import { computed, ref } from 'vue';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useDataState } from '@/composables/AiDataTable/useDataState.ts';
import { useDataStore } from '@/composables/AiDataTable/useDataStore.ts';
import { useChangesTracker } from '@/composables/AiDataTable/useChangesTracker.ts';
import { useDialog } from '@/composables/AiDialog/useDialog.ts';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';

vi.mock('@/composables/AiDataTable/useDataStore.ts', () => ({
    useDataStore: vi.fn(),
}));
vi.mock('@/composables/AiDataTable/useChangesTracker.ts', () => ({
    useChangesTracker: vi.fn(),
}));
vi.mock('@/composables/AiDialog/useDialog.ts', () => ({
    useDialog: vi.fn(),
}));

describe('useDataState', () => {
    const data = ref<any[]>([]);
    const loading = ref(false);
    const getDataMock = vi.fn();
    const setDataMock = vi.fn();
    const updateRowFieldMock = vi.fn();
    const insertNewRowMock = vi.fn();
    const deleteRowsMock = vi.fn();

    const isDirty = ref(false);
    const resetChangesMock = vi.fn();
    const isModifiedMock = vi.fn();
    const trackInsertMock = vi.fn();
    const trackUpdateMock = vi.fn();
    const trackDeleteMock = vi.fn();
    const getUpdatedRowKeysMock = vi.fn(() => [] as (string | number)[]);
    const getInsertedRowKeysMock = vi.fn(() => [] as (string | number)[]);

    const showDialogMock = vi.fn();

    const createMeta = (overrides: Partial<Meta> = {}) =>
        computed(
            () =>
                ({
                    isEditable: true,
                    selectionMode: 'multiple',
                    keyExpr: 'id',
                    api: { get: vi.fn(), set: vi.fn() },
                    columns: [],
                    ...overrides,
                }) as Meta
        );

    beforeEach(() => {
        vi.clearAllMocks();
        isDirty.value = false;
        resetChangesMock.mockImplementation(() => {
            isDirty.value = false;
        });

        (useDataStore as any).mockReturnValue({
            data,
            loading,
            getData: getDataMock,
            setData: setDataMock,
            updateRowField: updateRowFieldMock,
            insertNewRow: insertNewRowMock,
            deleteRows: deleteRowsMock,
        });
        (useChangesTracker as any).mockReturnValue({
            isDirty,
            resetChanges: resetChangesMock,
            isModified: isModifiedMock,
            trackInsert: trackInsertMock,
            trackUpdate: trackUpdateMock,
            trackDelete: trackDeleteMock,
            getUpdatedRowKeys: getUpdatedRowKeysMock,
            getInsertedRowKeys: getInsertedRowKeysMock,
        });
        (useDialog as any).mockReturnValue({
            show: showDialogMock,
        });
    });

    it('loadData загружает данные при clean-состоянии без сброса изменений', async () => {
        getDataMock.mockResolvedValue(true);
        const state = useDataState(createMeta(), 'id');

        const result = await state.loadData();

        expect(result).toBe(true);
        expect(getDataMock).toHaveBeenCalledTimes(1);
        expect(resetChangesMock).not.toHaveBeenCalled();
        expect(showDialogMock).not.toHaveBeenCalled();
    });

    it('loadData при dirty и neutral возвращает false и не запрашивает getData', async () => {
        isDirty.value = true;
        showDialogMock.mockResolvedValue('neutral');
        const state = useDataState(createMeta(), 'id');

        const result = await state.loadData();

        expect(result).toBe(false);
        expect(getDataMock).not.toHaveBeenCalled();
        expect(resetChangesMock).not.toHaveBeenCalled();
    });

    it('loadData при dirty и negative загружает данные и сбрасывает изменения', async () => {
        isDirty.value = true;
        showDialogMock.mockResolvedValue('negative');
        getDataMock.mockResolvedValue(true);
        const state = useDataState(createMeta(), 'id');

        const result = await state.loadData();

        expect(result).toBe(true);
        expect(getDataMock).toHaveBeenCalledTimes(1);
        expect(resetChangesMock).toHaveBeenCalledTimes(1);
    });

    it('loadData при dirty и positive вызывает saveData', async () => {
        isDirty.value = true;
        showDialogMock.mockResolvedValue('positive');
        setDataMock.mockResolvedValue(true);
        getDataMock.mockResolvedValue(true);
        const state = useDataState(createMeta(), 'id');

        const result = await state.loadData();

        expect(result).toBe(true);
        expect(setDataMock).toHaveBeenCalledTimes(1);
        expect(resetChangesMock).toHaveBeenCalledTimes(1);
        expect(getDataMock).toHaveBeenCalledTimes(1);
    });

    it('saveData сбрасывает изменения и перезагружает данные только при успешном setData', async () => {
        setDataMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        getDataMock.mockResolvedValue(true);
        const state = useDataState(createMeta(), 'id');

        await state.saveData();
        await state.saveData();

        expect(setDataMock).toHaveBeenCalledTimes(2);
        expect(resetChangesMock).toHaveBeenCalledTimes(1);
        expect(getDataMock).toHaveBeenCalledTimes(1);
    });

    it('createRow добавляет строку и трекает insert', () => {
        insertNewRowMock.mockReturnValue('new-key');
        const state = useDataState(createMeta(), 'id');

        state.createRow(null);

        expect(insertNewRowMock).toHaveBeenCalledWith(null);
        expect(trackInsertMock).toHaveBeenCalledWith('new-key');
    });

    it('removeRows подтверждает удаление, трекает delete и перезагружает данные при успехе', async () => {
        showDialogMock.mockResolvedValue('positive');
        deleteRowsMock.mockResolvedValue(true);
        getDataMock.mockResolvedValue(true);
        const state = useDataState(createMeta(), 'id');

        const result = await state.removeRows([1, 2]);

        expect(result).toBe(true);
        expect(deleteRowsMock).toHaveBeenCalledWith([1, 2]);
        expect(trackDeleteMock).toHaveBeenCalledWith([1, 2]);
        expect(getDataMock).toHaveBeenCalledTimes(1);
    });

    it('updateRow обновляет поле и трекает изменение', () => {
        updateRowFieldMock.mockReturnValue('old');
        const state = useDataState(createMeta(), 'id');

        state.updateRow(1, 'name', 'new');

        expect(updateRowFieldMock).toHaveBeenCalledWith(1, 'name', 'new');
        expect(trackUpdateMock).toHaveBeenCalledWith(1, 'name', 'old', 'new');
    });
});
