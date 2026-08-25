import { describe, it, expect } from 'vitest';

import { useTableState } from '@/composables/AiDataTable/useTableState.ts';
import { DEFAULT_KEY_EXPR } from '@/components/ui/AiDataTable/defaults.ts';

describe('useTableState', () => {
    it('инициализирует состояние таблицы значениями по умолчанию', () => {
        const keyExprSource = undefined;
        const state = useTableState(keyExprSource);

        expect(state.focusedRowKey.value).toBeNull();
        expect(state.checkedRowKeys.value).toEqual([]);
        expect(state.keyExpr).toBe(DEFAULT_KEY_EXPR);
    });

    it('использует переданный keyExpr и возвращает getRowKey для строки', () => {
        const keyExprSource = 'code';
        const { keyExpr, getRowKey } = useTableState(keyExprSource);
        const row = { id: 1, code: 'row-1' };

        expect(keyExpr).toBe('code');
        expect(getRowKey(row)).toBe('row-1');
    });

    it('setFocusedRow обновляет ключ фокусной строки', () => {
        const keyExprSource = 'id';
        const { focusedRowKey, setFocusedRow } = useTableState(keyExprSource);
        const row = { id: 101, name: 'test' };

        setFocusedRow(row);

        expect(focusedRowKey.value).toBe(101);
    });

    it('isFocusedRow корректно определяет фокусную строку', () => {
        const keyExprSource = 'id';
        const { setFocusedRow, isFocusedRow } = useTableState(keyExprSource);
        const row1 = { id: 2, value: 'focused' };
        const row2 = { id: 3, value: 'other' };

        setFocusedRow(row1);

        expect(isFocusedRow(row1)).toBe(true);
        expect(isFocusedRow(row2)).toBe(false);
    });

    it('isCheckedRow корректно определяет выделенную строку', () => {
        const { checkedRowKeys, isCheckedRow } = useTableState();

        const row1 = { id: 1, value: 'checked' };
        const row2 = { id: 2, value: 'checked' };
        const row3 = { id: 3, value: 'unchecked' };

        checkedRowKeys.value = [1, 2];

        expect(isCheckedRow(row1)).toBe(true);
        expect(isCheckedRow(row2)).toBe(true);
        expect(isCheckedRow(row3)).toBe(false);
    });

    it('resetState перезаписывает data, сбрасывает checkedRowKeys и ставит фокус на первую строку', () => {
        const { checkedRowKeys, focusedRowKey, resetState } = useTableState('id');
        checkedRowKeys.value = [1, 2];

        resetState([
            { id: 10, value: 'first' },
            { id: 20, value: 'second' },
        ]);

        expect(focusedRowKey.value).toBe(10);
        expect(checkedRowKeys.value).toEqual([]);
    });

    it('syncState очищает фокус и checkedRowKeys для удаленных строк', () => {
        const { checkedRowKeys, focusedRowKey, resetState, syncState } = useTableState('id');

        resetState([
            { id: 1, value: 'a' },
            { id: 2, value: 'b' },
        ]);
        checkedRowKeys.value = [1, 999];
        focusedRowKey.value = 999;

        syncState();

        expect(focusedRowKey.value).toBeNull();
        expect(checkedRowKeys.value).toEqual([1]);
    });
});
