import { ref } from 'vue';
import type { DataTableRowData } from 'naive-ui';
import { DEFAULT_KEY_EXPR } from '@/components/ui/AiDataTable/defaults';
import type { RowKey } from '@/interfaces/common.ts';

/**
 * Композабл для управления состоянием таблицы
 *
 * @param keyExprSource - Имя поля ключа строки
 *
 * @returns Объект с состоянием и методами для управления состоянием таблицы
 */
export const useTableState = (keyExprSource?: string) => {
    /** Имя поля ключа строки */
    const keyExpr: string = keyExprSource ?? DEFAULT_KEY_EXPR;
    /** Ключ строки, на которой фокусируется таблица */
    const focusedRowKey = ref<RowKey | null>(null);
    /** Ключи строк, выделенных в таблице */
    const checkedRowKeys = ref<RowKey[]>([]);
    /** Ссылка на данные таблицы */
    const data = ref<DataTableRowData[]>([]);

    /** Функция для получения ключа строки */
    const getRowKey = (row: DataTableRowData) => row[keyExpr];
    /** Проверяет, является ли строка фокусированной */
    const isFocusedRow = (row: DataTableRowData) => row[keyExpr] === focusedRowKey.value;
    /** Проверяет, является ли строка выделенной */
    const isCheckedRow = (row: DataTableRowData) => checkedRowKeys.value.includes(row[keyExpr]);
    /** Сбрасывает выделенные строки */
    const resetState = (incomingData: DataTableRowData[]) => {
        data.value = incomingData;
        focusedRowKey.value = incomingData.at(0)?.[keyExpr] ?? null;
        checkedRowKeys.value.length = 0;
    };

    /** Синхронизирует выделенные строки */
    const syncState = () => {
        focusedRowKey.value = data.value.find(row => row[keyExpr] === focusedRowKey.value)?.[keyExpr] ?? null;
        checkedRowKeys.value = data.value
            .filter(row => checkedRowKeys.value.includes(row[keyExpr]))
            .map(row => row[keyExpr]);
    };

    /** Устанавливает фокус на строку */
    const setFocusedRow = (row: DataTableRowData) => {
        focusedRowKey.value = row[keyExpr];
    };

    return {
        keyExpr,
        focusedRowKey,
        checkedRowKeys,
        getRowKey,
        resetState,
        syncState,
        isFocusedRow,
        isCheckedRow,
        setFocusedRow,
    };
};
