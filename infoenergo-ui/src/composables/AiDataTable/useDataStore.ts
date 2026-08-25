import { reactive, ref } from 'vue';
import type { ComputedRef } from 'vue';
import { useMessage } from 'naive-ui';
import type { DataTableRowData } from 'naive-ui';
import type { DataFieldValue, RowKey } from '@/interfaces/common.ts';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';

export const useDataStore = (meta: ComputedRef<Meta>, keyExpr: string) => {
    const message = useMessage();

    const fieldKeys = meta.value.columns.flatMap(column =>
        column.displayField ? [column.dataField, column.displayField] : column.dataField
    );

    /** Массив с модифицируемыми данными */
    const data = reactive<DataTableRowData[]>([]);
    const loading = ref<boolean>(false);

    const getDataRowByKey = (key: RowKey) => data.find(row => row[keyExpr] === key);
    const getDataRowIndexByKey = (key: RowKey) => data.findIndex(row => row[keyExpr] === key);

    const get = meta.value.api.get;
    const set = meta.value.api.set;
    const getNewRowData = () => ({
        ...Object.fromEntries(fieldKeys.map(field => [field, null])),
        [keyExpr]: Math.random(),
        isNewRow: true,
    });
    const getNewCopiedRowData = (key: RowKey) => {
        const row = getDataRowByKey(key);
        return {
            ...row,
            [keyExpr]: Math.random(),
            isNewRow: true,
        };
    };

    /**
     * Получает данные с сервера и обновляет локальное состояние
     */
    const getData = async () => {
        try {
            loading.value = true;
            const response = await get();
            if (response.success) {
                message.success('Данные успешно загружены');
                const newData = response?.data ?? [];
                data.length = 0;
                data.push(...newData);
                return true;
            } else {
                message.error(`Ошибка при загрузке данных: ${response.error}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to fetch table data:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            message.error(`Ошибка при загрузке данных: ${errorMessage}`);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Отправляет данные на сервер (в разработке)
     *
     * @todo Добавить body
     * @todo Реализовать обновление локальных данных после успешной отправки
     */
    const setData = async (updatedDataKeys: RowKey[], insertedDataKeys: RowKey[]) => {
        if (!set) {
            console.error('apiSet is not defined');
            return;
        }

        const modifiedData = {
            insertDataArgs: insertedDataKeys.map(getDataRowByKey).filter(row => row !== undefined),
            updateDataArgs: updatedDataKeys.map(getDataRowByKey).filter(row => row !== undefined),
            deleteDataArgs: [],
        };

        try {
            loading.value = true;
            const response = await set(modifiedData);
            if (response.success) {
                message.success('Данные успешно сохранены');
                return true;
            } else {
                message.error(`Ошибка при сохранении данных: ${response.error}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to send data:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            message.error(`Ошибка при сохранении данных: ${errorMessage}`);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * Изменяет значение поля в строке по ключу строки
     *
     * @param key - Значение ключа строки (`row[keyExpr]`)
     * @param dataField - Название поля для изменения
     * @param value - Новое значение
     */
    const updateRowField = (key: RowKey, dataField: string, newValue: DataFieldValue) => {
        const rowData = getDataRowByKey(key);

        if (!rowData || !(dataField in rowData)) return;
        const oldValue = rowData[dataField];
        rowData[dataField] = newValue;

        return oldValue;
    };

    /**
     * Добавляет новую строку в начало массива
     */
    const insertNewRow = (focusedRowKey: RowKey | null) => {
        const newRow: DataTableRowData = getNewRowData();
        const focusedRowIndex = focusedRowKey !== null ? getDataRowIndexByKey(focusedRowKey) : -1;
        const newRowIndex = focusedRowIndex + 1;
        data.splice(newRowIndex, 0, newRow);
        return newRow[keyExpr];
    };

    /**
     * Удаляет строки из массива по ключам
     *
     * @param keys - Массив ключей строк
     *
     * @returns true, если строки были удалены, false в противном случае
     */
    const deleteRows = async (keys: RowKey[]) => {
        if (!set) {
            console.error('apiSet is not defined');
            return;
        }

        const onlyExistedRows = keys.filter(key => getDataRowByKey(key)?.isNewRow === undefined);
        const onlyNewRows = keys.filter(key => getDataRowByKey(key)?.isNewRow === true);

        const deleteNewRows = () => {
            onlyNewRows.forEach(key => delete data[getDataRowIndexByKey(key)]);
        };

        if(onlyExistedRows.length === 0) {
            deleteNewRows();
            message.success('Данные успешно удалены');
            return true;
        }

        const modifiedData = {
            insertDataArgs: [],
            updateDataArgs: [],
            deleteDataArgs: onlyExistedRows.map(getDataRowByKey).filter(row => row !== undefined),
        };

        try {
            loading.value = true;
            const response = await set(modifiedData);
            if (response.success) {
                message.success('Данные успешно удалены');
                deleteNewRows();
                return true;
            } else {
                message.error(`Ошибка при удалении данных: ${response.error}`);
                return false;
            }
        } catch (error) {
            console.error('Failed to send data:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            message.error(`Ошибка при удалении данных: ${errorMessage}`);
            return false;
        } finally {
            loading.value = false;
        }
    };

    const createCopiedRow = (focusedRowKey: RowKey) => {
        const copiedRow = getNewCopiedRowData(focusedRowKey);
        const focusedRowIndex = focusedRowKey !== null ? getDataRowIndexByKey(focusedRowKey) : -1;
        const newRowIndex = focusedRowIndex + 1;
        data.splice(newRowIndex, 0, copiedRow);
        return copiedRow[keyExpr];
    };

    return {
        data,
        loading,
        getData,
        getDataRowIndexByKey,
        setData,
        updateRowField,
        insertNewRow,
        createCopiedRow,
        deleteRows,
    };
};
