import type { DataTableBaseColumn, DataTableProps } from 'naive-ui';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';
import { DEFAULT_DATA_TYPE } from '@/defaults/common.ts';
import type { DataType, FieldType } from '@/interfaces/common.ts';

/** Дефолтное поле ключа строки (keyExpr) */
export const DEFAULT_KEY_EXPR = 'id';

/** Дефолтные настройки meta */
export const DEFAULT_META: Partial<Meta> = {
    selectionMode: 'multiple',
    showFooter: true,
} as const;

/** Дефолтные пропсы для NDataTable */
export const DEFAULT_TABLE_PROPS: Partial<DataTableProps & { style: string }> = {
    virtualScroll: true,
    singleLine: false,
    size: 'small',
    style: 'height: 100%;',
    flexHeight: true,
};

/** Дефолтные пропсы для всех колонок */
const DEFAULT_COLUMN_COMMON_PROPS: Partial<DataTableBaseColumn> = {
    resizable: true,
    titleAlign: 'left',
} as const;

/** Дефолтные пропсы для колонок относительно типа данных */
const DEFAULT_COLUMNS_PROPS_BY_TYPE: Record<FieldType, Partial<DataTableBaseColumn>> = {
    string: {
        minWidth: 100,
        width: 250,
    },
    number: {
        minWidth: 50,
        width: 100,
        align: 'right',
    },
    date: {
        minWidth: 110,
        width: 140,
    },
    datetime: {
        minWidth: 170,
        width: 200,
    },
    boolean: {
        minWidth: 50,
        width: 100,
        align: 'center',
    },
    selector: {
        minWidth: 100,
        width: 250,
    },
    popover: {
        minWidth: 100,
        width: 250,
    },
    modal: {
        minWidth: 100,
        width: 250,
    },
};

/** Геттер полного дефолтного конфига для колонки относительно dataType */
export const getDefaultColumnConfig = (dataType: DataType = DEFAULT_DATA_TYPE): Partial<DataTableBaseColumn> => ({
    ...DEFAULT_COLUMN_COMMON_PROPS,
    ...DEFAULT_COLUMNS_PROPS_BY_TYPE[dataType],
});

export const DEFAULT_ROW_PROPS: Partial<DataTableProps['rowProps']> & { style: string } = {
    style: 'cursor: pointer;',
} as const;
