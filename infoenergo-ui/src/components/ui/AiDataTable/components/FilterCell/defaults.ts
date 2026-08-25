import { h } from 'vue';
import type { Component } from 'vue';
import type { ColumnFilterState, ExtendedFilterOption, FilterOptionsFactory } from './types';

import SelectOptionComponent from './SelectOption/SelectOption.vue';
import SearchIcon from '@/components/icons/filter/SearchIcon.vue';
import ContainsIcon from '@/components/icons/filter/ContainsIcon.vue';
import EqualsIcon from '@/components/icons/filter/EqualsIcon.vue';
import NotContainsIcon from '@/components/icons/filter/NotContainsIcon.vue';
import StartsWithIcon from '@/components/icons/filter/StartsWithIcon.vue';
import EndsWithIcon from '@/components/icons/filter/EndsWithIcon.vue';
import NotEqualsIcon from '@/components/icons/filter/NotEqualsIcon.vue';
import GreaterThanIcon from '@/components/icons/filter/GreaterThanIcon.vue';
import GreaterThanOrEqualIcon from '@/components/icons/filter/GreaterOrEqualIcon.vue';
import LessThanIcon from '@/components/icons/filter/LessThanIcon.vue';
import LessThanOrEqualIcon from '@/components/icons/filter/LessOrEqualIcon.vue';
import ResetIcon from '@/components/icons/filter/ResetIcon.vue';
import TrueIcon from '@/components/icons/filter/TrueIcon.vue';
import FalseIcon from '@/components/icons/filter/FalseIcon.vue';
import RangeIcon from '@/components/icons/filter/RangeIcon.vue';
import type { DataType } from '@/interfaces/common';

/**
 * Получение значения по умолчанию для фильтра
 * @param dataType - Тип данных
 * @returns Значение по умолчанию для фильтра
 */
export const DEFAULT_FILTER_OPTION = (dataType: DataType) => {
    return dataType === 'boolean' ? 'reset' : 'search';
};

/**
 * Иконка по умолчанию для фильтра
 */
export const DEFAULT_FILTER_ICON = SearchIcon;

/**
 * Значение по умолчанию для состояния фильтрации
 */
export const DEFAULT_COLUMN_FILTER_STATE: ColumnFilterState = {
    filterOperation: 'search',
    filterInput: '',
};

/**
 * Создание опции фильтра
 * @param label - Лейбл опции
 * @param value - Значение опции
 * @param icon - Иконка опции
 * @param onUpdate - Функция для обновления значения опции
 * @returns Опция фильтра
 */
const createFilterOption = (
    label: string,
    value: string,
    icon: Component,
    onUpdate: (value: string) => void
): ExtendedFilterOption => ({
    label,
    value,
    icon,
    render: () => {
        return h(SelectOptionComponent, {
            label,
            value,
            icon,
            onUpdate,
        });
    },
});

export const getDefaultBooleanFilterOptions = (onUpdate: (value: string) => void): ExtendedFilterOption[] => [
    createFilterOption('True', 'true', TrueIcon, onUpdate),
    createFilterOption('False', 'false', FalseIcon, onUpdate),
    createFilterOption('', 'reset', ResetIcon, onUpdate),
];

export const getDefaultStringFilterOptions = (onUpdate: (value: string) => void): ExtendedFilterOption[] => [
    createFilterOption('Поиск', 'search', SearchIcon, onUpdate),
    createFilterOption('Содержит', 'contains', ContainsIcon, onUpdate),
    createFilterOption('Не содержит', 'notContains', NotContainsIcon, onUpdate),
    createFilterOption('Начинается с', 'startsWith', StartsWithIcon, onUpdate),
    createFilterOption('Не равно', 'notEquals', NotEqualsIcon, onUpdate),
    createFilterOption('Заканчивается на', 'endsWith', EndsWithIcon, onUpdate),
];

export const getDefaultNumberFilterOptions = (onUpdate: (value: string) => void): ExtendedFilterOption[] => [
    createFilterOption('Поиск', 'search', SearchIcon, onUpdate),
    createFilterOption('Равно', 'equals', EqualsIcon, onUpdate),
    createFilterOption('Не равно', 'notEquals', NotEqualsIcon, onUpdate),
    createFilterOption('Больше', 'greaterThan', GreaterThanIcon, onUpdate),
    createFilterOption('Больше или равно', 'greaterThanOrEqual', GreaterThanOrEqualIcon, onUpdate),
    createFilterOption('Меньше', 'lessThan', LessThanIcon, onUpdate),
    createFilterOption('Меньше или равно', 'lessThanOrEqual', LessThanOrEqualIcon, onUpdate),
    createFilterOption('В диапазоне', 'inRange', RangeIcon, onUpdate),
];
const filterOptionsObject: Record<DataType, FilterOptionsFactory> = {
    string: getDefaultStringFilterOptions,
    number: getDefaultNumberFilterOptions,
    boolean: getDefaultBooleanFilterOptions,
    date: getDefaultStringFilterOptions,
    datetime: getDefaultStringFilterOptions,
};

/**
 * Получение опций фильтра
 * @param dataType - Тип данных
 * @param onUpdate - Функция для обновления значения опции
 * @returns Опции фильтра
 */
export const getFilterOptions = (dataType: DataType, onUpdate: (value: string) => void): ExtendedFilterOption[] => {
    return filterOptionsObject[dataType](onUpdate);
};
