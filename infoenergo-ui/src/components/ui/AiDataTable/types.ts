import type {
    DataTableProps,
    DataTableBaseColumn,
    DataTableSelectionColumn,
    DataTableColumnGroup,
    DataTableRowData,
} from 'naive-ui';
import type { Component, DataType, Editor } from '@/interfaces/common.ts';

/** Поля для нашей бизнес-логики */
export interface UserOnlyColumn {
    /** Флаг для редактирования ячеек в колонке */
    allowEditing?: boolean;
    /** Название колонки */
    caption?: string;
    /** Компонент для отображения данных */
    component?: Component;
    /** Редактор для ячейки */
    editor?: Editor;
    /** Название поля в БД */
    dataField: string;
    /** Название поля для отображения */
    displayField?: string;
    /** Тип данных в колонке */
    dataType?: DataType;
    /** Дочерние колонки для таблиц с иерархическими колонками */
    children?: UserOnlyColumn[];
    /** Флаг видимости колонки */
    visible?: boolean;
    /** Флаг показа колонки в "выборе колонок" */
    showInColumnChooser?: boolean;
}

/** Базовая колонка */
export type BaseColumn = UserOnlyColumn & DataTableBaseColumn;

/** Колонка таблицы, которая совмещает в себе интерфейс нашей бизнес-логики и интерфейс DataTableSelectionColumn */
export interface SelectionColumn extends DataTableSelectionColumn {
    type: 'selection';
    visible: true;
}

/** Групповая колонка */
export interface GroupColumn extends DataTableColumnGroup {
    caption: string;
    dataField: string;
    visible: true;
}

/** Пустая колонка */
export interface EmptyColumn extends BaseColumn {
    key: 'empty';
    dataField: 'empty';
    visible: true;
}

/** Служебная колонка */
export type ServiceColumn = SelectionColumn | GroupColumn | EmptyColumn;

/** Колонка таблицы */
export type Column = BaseColumn | SelectionColumn | GroupColumn | EmptyColumn;

/** Глобальный объект для настройки таблицы */
export interface Meta {
    /** Название таблицы */
    title?: string;
    /** Флаг, показывающий, что в таблица находится в popover */
    isPopover?: boolean;
    /** Флаг для редактирования таблицы */
    isEditable?: boolean;
    /** Режим выбора (selection column) */
    selectionMode?: 'multiple' | 'single' | 'none';
    /** Название поля с ключом */
    keyExpr?: string;
    /** Пропсы конкретно для NDataTable */
    config?: Partial<DataTableProps>;
    /** Эндпоинты для получения и сохранения данных */
    api: {
        /** Получение данных */
        get: (
            args?: any
        ) => Promise<{ result: boolean; success?: boolean; data?: DataTableRowData[]; total?: number; error?: string }>;
        /** Сохранение данных */
        set?: (args: {
            insertDataArgs: DataTableRowData[];
            updateDataArgs: DataTableRowData[];
            deleteDataArgs: DataTableRowData[];
        }) => Promise<{
            result: boolean;
            success?: boolean;
            data?: DataTableRowData[];
            total?: number;
            error?: string;
        }>;
    };
    /** Массив с настройками колонок */
    columns: UserOnlyColumn[];
    /** Флаг для отображения футера */
    showFooter?: boolean;
}

/** Пропсы для компонента AiDataTable */
export interface TableProps {
    meta: Meta;
}

/** Эмиты для компонента AiDataTable */
export interface TableEmits {
    'row-click': [row: DataTableRowData];
    'row-doubleclick': [row: DataTableRowData];
    'create-filter': [];
}
