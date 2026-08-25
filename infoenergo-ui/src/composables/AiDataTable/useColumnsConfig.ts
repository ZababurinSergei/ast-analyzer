import { computed, h, reactive } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { DataTableBaseColumn, DataTableRowData } from 'naive-ui';
import type { NDataTable } from 'naive-ui';
import AiCell from '@/components/ui/AiCell/AiCell.vue';
import { getDefaultColumnConfig } from '@/components/ui/AiDataTable/defaults.ts';
import type {
    Meta,
    UserOnlyColumn,
    Column,
    BaseColumn,
    SelectionColumn,
    GroupColumn,
    ServiceColumn,
    EmptyColumn,
} from '@/components/ui/AiDataTable/types.ts';
import type { ColumnChooser } from '@/components/ui/AiToolbar/types';
import type { DataFieldValue, DataFieldDisplayValue, RowKey } from '@/interfaces/common.ts';
import { useFilterState } from '@/composables/AiDataTable/useFilterState';
import HeaderCell from '@/components/ui/AiDataTable/components/FilterCell/HeaderCell.vue';
import SortButton from '@/components/ui/AiDataTable/components/FilterCell/SortButton/SortButton.vue';
import { DEFAULT_DATA_TYPE } from '@/defaults/common';
import { makeSorter } from '@/composables/AiDataTable/common';

/**
 * Композабл для конфигурации колонок таблицы на основе метаданных
 *
 * @param meta - Вычисляемая ссылка на метаданные таблицы, содержащие конфигурацию колонок
 * @param modifyData - Обновление значения в строке по ключу и имени поля
 * @param isModified - Проверка, изменилось ли поле относительно данных с сервера
 * @param keyExpr - Имя поля ключа строки для чтения `row[keyExpr]` в рендере ячеек
 * @param parentContainerSelectorForError - Родительский селектор контейнера для позиционирования ошибки
 *
 * @returns Объект с массивом колонок и методом для настройки колонок
 */
export const useColumnsConfig = (
    meta: ComputedRef<Meta>,
    modifyData: (key: RowKey, dataField: string, value: DataFieldValue) => void,
    isModified: (key: RowKey, dataField: string) => boolean,
    keyExpr: string,
    dataTable: Ref<InstanceType<typeof NDataTable> | null>,
    parentContainerSelectorForError?: string
) => {
    /** Массив сконфигурированных колонок */
    const {
        filterState,
        setFilterInput,
        buildNaiveFilterValues,
        updateFilterState,
        getNaiveFilterConfigFunction,
        applyFilterSelection,
    } = useFilterState();
    const allColumns = reactive<Column[]>([]);
    const visibleColumns = computed<Column[]>((): Column[] => (allColumns as Column[]).filter(isVisibleColumn));
    const columnsChooser = reactive<ColumnChooser>({
        options: [],
        value: [],
    });

    const isBaseColumn = (column: Column): column is BaseColumn =>
        !('children' in column) && 'dataField' in column && 'caption' in column;

    const isSelectionColumn = (column: Column): column is SelectionColumn => column.type === 'selection';

    const isParentColumn = (column: UserOnlyColumn | Column): column is GroupColumn =>
        'children' in column && Array.isArray(column.children) && column.children.length > 0;

    const isEmptyColumn = (column: Column): column is EmptyColumn =>
        'dataField' in column && column.dataField === 'empty';

    const isServiceColumn = (column: Column): column is ServiceColumn =>
        isSelectionColumn(column) || isParentColumn(column) || isEmptyColumn(column);

    const isAlwaysVisibleColumn = (column: Column) =>
        isServiceColumn(column) || (column.showInColumnChooser === false && column.visible === true);

    const isVisibleColumn = (column: Column): boolean =>
        isAlwaysVisibleColumn(column) || (isBaseColumn(column) && column.visible !== false);

    const setupColumnChooser = () => {
        const baseColumns: BaseColumn[] = (allColumns as Column[]).filter(isBaseColumn);
        const choosableColumns = baseColumns.filter(column => column.showInColumnChooser !== false);

        columnsChooser.options = choosableColumns.map(column => ({
            value: column.dataField,
            label: column.caption ?? '',
        }));
        columnsChooser.value = choosableColumns
            .filter(column => column.visible === true)
            .map(column => column.dataField);
    };

    const setColumnsVisibility = (incomingVisibleColumns: string[]) => {
        for (const column of allColumns as Column[]) {
            if (!isBaseColumn(column)) continue;
            column.visible = isAlwaysVisibleColumn(column) || incomingVisibleColumns.includes(column.dataField);
        }
    };

    const createFieldRenderer =
        (userColumnConfig: UserOnlyColumn, isEditable: boolean): DataTableBaseColumn['render'] =>
        (row: DataTableRowData) => {
            const rowKey = row[keyExpr];
            const { dataField, displayField, dataType, editor, component } = userColumnConfig;

            return h(AiCell, {
                isModified: isModified(rowKey, dataField),
                isValidationError: false,
                validationErrorMessage: '',
                parentContainerSelectorForError,
                componentMeta: {
                    isEditable,
                    dataType,
                    editor,
                    component,
                    value: row[dataField],
                    displayValue: displayField !== undefined ? row[displayField] : undefined,
                    onUpdateValue: (value: DataFieldValue) => {
                        modifyData(rowKey, dataField, value);
                    },
                    onUpdateDisplayValue: (displayValue: DataFieldDisplayValue) => {
                        if (!displayField) return;
                        modifyData(rowKey, displayField, displayValue);
                    },
                },
            });
        };

    const transformToTableColumn = (userColumnConfig: UserOnlyColumn): BaseColumn => {
        const defaultColumnConfig: Partial<DataTableBaseColumn> = getDefaultColumnConfig(userColumnConfig.dataType);

        const extendedColumn: BaseColumn = {
            ...defaultColumnConfig,
            ...userColumnConfig,
            key: userColumnConfig.dataField,
            title: userColumnConfig.caption,
            visible: userColumnConfig.visible !== false,
            showInColumnChooser: userColumnConfig.showInColumnChooser !== false,
            sorter: makeSorter(userColumnConfig.dataField, userColumnConfig.dataType ?? DEFAULT_DATA_TYPE),
            renderSorter: ({ order }: { order: 'ascend' | 'descend' | false }) => h(SortButton, { order }),
            filter: (value, row) => getNaiveFilterConfigFunction(userColumnConfig, value, row),
        };

        const resolveEditable = () => {
            // Явное разрешение редактирования
            if (userColumnConfig.allowEditing === true) return true;

            // Явный запрет редактирования
            if (userColumnConfig.allowEditing === false) return false;

            // Иначе только если редактирование глобально разрешено
            return !!meta.value.isEditable;
        };

        const isEditable = resolveEditable();
        extendedColumn.render = createFieldRenderer(userColumnConfig, isEditable);
        const isParent = 'children' in extendedColumn;
        if (!isParent) {
            extendedColumn.render = createFieldRenderer(userColumnConfig, isEditable);
            updateFilterState(userColumnConfig.dataField, userColumnConfig.dataType ?? DEFAULT_DATA_TYPE);
            extendedColumn.title = () =>
                h(HeaderCell, {
                    caption: userColumnConfig.caption ?? '',
                    dataType: userColumnConfig.dataType ?? DEFAULT_DATA_TYPE,
                    dataField: userColumnConfig.dataField,
                    'onUpdate:filterOperation': (value: string, dataField: string) => {
                        console.log('onUpdate:filterOperation', value, dataField);
                        applyFilterSelection(dataField, userColumnConfig.dataType ?? DEFAULT_DATA_TYPE, value);
                        dataTable.value?.filter({
                            ...buildNaiveFilterValues(filterState),
                        });
                    },
                    'onUpdate:filterInput': (value: string | [string, string] | null, dataField: string) => {
                        console.log('onUpdate:filterInput', value, dataField);
                        setFilterInput(dataField, value, userColumnConfig.dataType ?? DEFAULT_DATA_TYPE);
                        dataTable.value?.filter({
                            ...buildNaiveFilterValues(filterState),
                        });
                    },
                });
        }

        return extendedColumn;
    };

    const buildColumnHierarchy = (userColumnConfig: UserOnlyColumn): Column => {
        if (isParentColumn(userColumnConfig)) {
            const children = userColumnConfig.children.map(childColumn => buildColumnHierarchy(childColumn));

            const groupColumn = {
                caption: userColumnConfig.caption,
                dataField: userColumnConfig.dataField,
                visible: true,
                title: userColumnConfig.caption,
                key: userColumnConfig.dataField,
                children,
            } as GroupColumn;

            return groupColumn;
        }

        return transformToTableColumn(userColumnConfig);
    };

    const setupSelectionColumn = () => {
        if (meta.value.selectionMode !== 'none') {
            const selectionColumn: SelectionColumn = {
                fixed: 'left',
                type: 'selection',
                multiple: meta.value.selectionMode === 'multiple',
                visible: true,
            };
            allColumns.push(selectionColumn);
        }
    };

    const setupMainColumns = () => {
        const userColumnsConfig = meta.value.columns;
        (allColumns as Column[]).push(...userColumnsConfig.map(buildColumnHierarchy));
    };

    const setupEmptyColumn = () => {
        const emptyColumn: EmptyColumn = {
            key: 'empty',
            dataField: 'empty',
            visible: true,
        };
        (allColumns as Column[]).push(emptyColumn);
    };

    /** Заново пересобирает колонки таблицы */
    const rebuildColumns = () => {
        allColumns.length = 0;
        setupSelectionColumn();
        setupMainColumns();
        setupEmptyColumn();
        setupColumnChooser();
    };

    // Инициализация колонок
    const initializeColumns = () => {
        rebuildColumns();
    };

    // Инициализирует колонки таблицы на моменте создания композабла
    initializeColumns();

    return {
        visibleColumns,
        columnsChooser,
        setColumnsVisibility,
        rebuildColumns,
    };
};
