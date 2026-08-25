import type { SelectOption } from 'naive-ui';
import type { Component } from 'vue';
import type { DataType } from '@/interfaces/common';

/**
 * Интерфейс для эмиттов компонента FilterSelect
 */
export interface FilterSelectEmits {
    (e: 'update:value', value: string): void;
}

/**
 * Тип для фабрики опций фильтра
 * @param onUpdate - Функция для обновления значения опции
 * @returns Опции фильтра
 */
export type FilterOptionsFactory = (onUpdate: (value: string) => void) => ExtendedFilterOption[];

/**
 * Интерфейс для опции фильтра
 * @param icon - Иконка опции
 */
export interface FilterOption {
    icon: Component;
}

/**
 * Тип для расширенной опции фильтра
 */
export type ExtendedFilterOption = SelectOption & FilterOption;

/**
 * @param filterType - Тип фильтра
 */
export interface HeaderCellFilterSelectProps {
    /** Тип фильтра */
    filterType: DataType;
}

/**
 * Интерфейс для эмиттов компонента HeaderCell
 */
export interface HeaderCellEmits {
    /** Обновление операции фильтра */
    'update:filterOperation': [filterOperation: string, dataField: string];
    /** Обновление значения фильтра */
    'update:filterInput': [filterInput: string | [string, string] | null, dataField: string];
}

/**
 * Интерфейс для пропсов компонента HeaderCell
 */
export interface HeaderCellProps {
    /** Заголовок */
    caption: string;
    /** Тип данных */
    dataType: DataType;
    /** Имя поля */
    dataField?: string;
}

/**
 * Интерфейс для пропсов компонента SelectOption
 */
export interface SelectOptionProps {
    /** Лейбл */
    label: string;
    /** Значение */
    value: string;
    /** Иконка */
    icon: Component;
    /** Функция для обновления значения */
    onUpdate: (value: string) => void;
}

/**
 * Интерфейс для пропсов компонента SelectedOption
 */
export interface SelectedOptionProps {
    /** Иконка */
    icon: Component;
}

/**
 * Интерфейс для состояния фильтрации
 */
export interface ColumnFilterState {
    /** Операция фильтрации */
    filterOperation: string;
    /** Значение фильтрации */
    filterInput: string | [string, string];
}

/**
 * Тип для состояния фильтрации по колонке
 */
export type FilterStateByColumn = Record<string, ColumnFilterState>;

/**
 * Интерфейс для пропсов компонента SortButton
 */
export interface SortButtonProps {
    /** Порядок сортировки */
    order: 'ascend' | 'descend' | false;
}
