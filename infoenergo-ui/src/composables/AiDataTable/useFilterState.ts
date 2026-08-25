import type { ColumnFilterState, FilterStateByColumn } from '@/components/ui/AiDataTable/components/FilterCell/types';
import type { UserOnlyColumn } from '@/components/ui/AiDataTable/types';
import type { DataType } from '@/interfaces/common';
import type { FilterOptionValue, InternalRowData } from 'naive-ui/es/data-table/src/interface';
import { reactive } from 'vue';
import { DEFAULT_COLUMN_FILTER_STATE } from '@/components/ui/AiDataTable/components/FilterCell/defaults';

/**
 * Преобразование значения для фильтрации boolean
 * @param selection - Значение для фильтрации
 * @returns Значение для фильтрации boolean
 */
const toBooleanFilterState = (selection: string) =>
    selection === 'reset'
        ? { filterOperation: 'reset', filterInput: '' }
        : { filterOperation: 'equals', filterInput: selection };

const createDefaultColumnFilterState = (dataType: DataType): ColumnFilterState =>
    dataType === 'boolean' ? { filterOperation: 'reset', filterInput: '' } : { ...DEFAULT_COLUMN_FILTER_STATE };

export const useFilterState = () => {
    const filterState = reactive<FilterStateByColumn>({});

    const ensureColumnFilter = (dataField: string, dataType: DataType = 'string'): ColumnFilterState => {
        if (!filterState[dataField]) {
            filterState[dataField] = createDefaultColumnFilterState(dataType);
        }

        return filterState[dataField]!;
    };

    const updateFilterState = (dataField: string, dataType: DataType) => {
        filterState[dataField] = createDefaultColumnFilterState(dataType);
    };

    const setFilterInput = (
        dataField: string,
        filterInput: string | [string, string] | null,
        dataType: DataType = 'string'
    ) => {
        const column = ensureColumnFilter(dataField, dataType);

        column.filterInput = filterInput ?? '';
    };

    const buildNaiveFilterValues = (state: FilterStateByColumn): Record<string, string | [string, string]> => {
        return Object.fromEntries(Object.entries(state).map(([dataField, column]) => [dataField, column.filterInput]));
    };

    const getNaiveFilterConfigFunction = (
        userColumnConfig: UserOnlyColumn,
        value: FilterOptionValue,
        row: InternalRowData
    ) => {
        if (userColumnConfig.dataType === 'boolean') {
            const columnState = filterState[userColumnConfig.dataField];
            if (!columnState || columnState.filterOperation === 'reset' || !columnState.filterInput) {
                return true;
            }
            return Boolean(row[userColumnConfig.dataField]) === (columnState.filterInput === 'true');
        }

        const unifiedRowValue = String(row[userColumnConfig?.displayField ?? userColumnConfig.dataField]).toLowerCase();
        const unifiedFilterValue = String(value as string).toLowerCase();
        return Boolean(~unifiedRowValue.indexOf(unifiedFilterValue));
    };

    const applyFilterSelection = (dataField: string, dataType: DataType, selection: string) => {
        const column = ensureColumnFilter(dataField, dataType);

        if (dataType === 'boolean') {
            Object.assign(column, toBooleanFilterState(selection));
            return;
        }

        column.filterOperation = selection;
    };

    return {
        filterState,
        setFilterInput,
        buildNaiveFilterValues,
        updateFilterState,
        getNaiveFilterConfigFunction,
        applyFilterSelection,
    };
};
