import type { ComputedRef } from 'vue';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';
import { useDataStore } from '@/composables/AiDataTable/useDataStore.ts';
import { useChangesTracker } from '@/composables/AiDataTable/useChangesTracker.ts';
import { useDialog } from '@/composables/AiDialog/useDialog.ts';
import type { DataFieldValue, RowKey } from '@/interfaces/common.ts';

/**
 * Композабл для управления состоянием данных таблицы
 *
 * @param meta - Реактивные метаданные (эндпоинты API и прочее)
 * @param keyExpr - Имя поля ключа строки (совпадает с {@link Meta.keyExpr} после дефолтов)
 *
 * @returns Объект с состоянием и методами
 */
export const useDataState = (meta: ComputedRef<Meta>, keyExpr: string) => {
    const {
        data,
        loading,
        getData,
        getDataRowIndexByKey,
        setData,
        updateRowField,
        insertNewRow,
        createCopiedRow,
        deleteRows,
    } = useDataStore(meta, keyExpr);
    const {
        isDirty,
        resetChanges,
        isModified,
        trackInsert,
        trackUpdate,
        trackDelete,
        getUpdatedRowKeys,
        getInsertedRowKeys,
    } = useChangesTracker();

    const dialog = useDialog();

    /**
     * Загружает данные с сервера и сбрасывает состояние изменений
     */
    const loadData = async () => {
        if (isDirty.value) {
            const choice = await dialog.show({
                content: 'Есть несохраненные изменения. Сохранить изменения?',
                positiveText: 'Да',
                negativeText: 'Нет',
                neutralText: 'Отмена',
            });
            if (choice === 'positive') {
                const success = await saveData();
                return success;
            }
            if (choice === 'negative') {
                const success = await getData();
                if (success) resetChanges();
                return success;
            }
            if (choice === 'neutral') return false;
        }
        const success = await getData();
        return success;
    };

    /**
     * Сохраняет данные на сервер и сбрасывает состояние изменений
     */
    const saveData = async () => {
        const updatedRowKeys = getUpdatedRowKeys();
        const insertedRowKeys = getInsertedRowKeys();
        const success = await setData(updatedRowKeys, insertedRowKeys);
        if (success) {
            resetChanges();
            await loadData();
        }
        return success;
    };

    /**
     * Создает новую строку и отслеживает ее
     */
    const createRow = (focusedRowKey: RowKey | null) => {
        const newRowKey = insertNewRow(focusedRowKey);
        trackInsert(newRowKey);
    };

    /**
     * Удаляет строки из данных и отслеживает удаленные строки
     *
     * @param keys - Массив ключей строк
     */
    const removeRows = async (keys: RowKey[]) => {
        const choice = await dialog.show({
            content: 'Строки будут безвозвратно удалены. Продолжить?',
            positiveText: 'Да',
            negativeText: 'Нет',
        });
        if (choice === 'positive') {
            const success = await deleteRows(keys);
            if (success) {
                trackDelete(keys);
                resetChanges();
                return await loadData();
            }
            return success;
        }
        return false;
    };

    /**
     * Изменяет значение поля в строке и отслеживает изменение
     *
     * @param key - Значение ключа строки
     * @param dataField - Название поля для изменения
     * @param newValue - Новое значение
     */
    const updateRow = (key: RowKey, dataField: string, newValue: DataFieldValue) => {
        const oldValue = updateRowField(key, dataField, newValue);
        trackUpdate(key, dataField, oldValue, newValue);
    };

    /**
     * Копирует строку и отслеживает копию
     *
     * @param key - Значение ключа строки
     */
    const copyRow = (key: RowKey | null) => {
        if (key === null) return;
        const newRowKey = createCopiedRow(key);
        if (!newRowKey) return false;
        trackInsert(newRowKey);
        return true;
    };

    return {
        data,
        loading,
        isDirty,
        updateRow,
        getDataRowIndexByKey,
        isModified,
        loadData,
        saveData,
        createRow,
        copyRow,
        removeRows,
    };
};
