import type { Component } from 'vue';
import type { PopselectProps } from 'naive-ui';
import type { AiButtonProps } from '@/components/ui/AiButton/types';

/** Типы элементов тулбара */
export type ToolbarElementType = 'button' | 'input' | 'popselect';

/** Идентификаторы дефолтных элементов тулбара */
export type DefaultToolbarId = 'refresh' | 'add' | 'delete' | 'copy' | 'save' | 'column-chooser';

/** Основа для элемента тулбара */
interface ToolbarElementBase {
    elementType: ToolbarElementType;
    id: string;
    /** Флаг, показывающий модифицирует ли элемент данные */
    canModifyData: boolean;
}

/** Кнопка тулбара */
type ToolbarButton = ToolbarElementBase & AiButtonProps & { elementType: 'button' };

/** Дефолтная кнопка тулбара */
export type DefaultToolbarButton = ToolbarButton & { id: DefaultToolbarId };

type ToolbarPopselect = ToolbarElementBase &
    PopselectProps & { elementType: 'popselect'; icon: Component; hint: string };

export type DefaultToolbarPopselect = ToolbarPopselect & { id: DefaultToolbarId };

/** Дефолтный элемент тулбара */
export type DefaultToolbarElement = DefaultToolbarButton | DefaultToolbarPopselect;

export type ColumnChooser = {
    options: { value: string; label: string }[];
    value: string[];
};

/** Пропсы тулбара */
export interface AiToolbarProps {
    /** Флаг для редактирования таблицы */
    isEditable: boolean;
    /** Название таблицы */
    title?: string;
    /** Количество выделенных строк */
    countSelectedRows: number;
    /** Флаг наличия сфокусированной строки */
    hasFocusedRow: boolean;
    /** Флаг дизайбла всех элементов тулбара */
    disabled: boolean;
    /** Значения для выбора колонок */
    columnChooser: ColumnChooser;
    /** Флаг наличия изменений в данных */
    isDataModified: boolean;
}

/** События тулбара */
export interface AiToolbarEmits {
    /** Событие клика по элементу тулбара */
    click: [action: string];
    /** Событие изменения видимости колонок */
    'column-chooser-change': [value: string[]];
}
