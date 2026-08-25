import { computed, ref, shallowRef } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import type { DataTableBaseColumn, DataTableColumnGroup, DataTableRowData } from 'naive-ui';

import { useColumnsConfig } from '@/composables/AiDataTable/useColumnsConfig.ts';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';
import type { RowKey } from '@/interfaces/common.ts';

describe('useColumnsConfig', () => {
    const createMeta = (meta: Meta) => {
        const metaRef = shallowRef<Meta>(meta);
        return { metaRef, metaComputed: computed(() => metaRef.value) };
    };

    const createColumns = (
        meta: Meta,
        params?: {
            modifyData?: (key: RowKey, dataField: string, value: unknown) => void;
            isModified?: (key: RowKey, dataField: string) => boolean;
            parentContainerSelectorForError?: string;
        }
    ) => {
        const { metaRef, metaComputed } = createMeta(meta);
        const result = useColumnsConfig(
            metaComputed,
            (params?.modifyData ?? vi.fn()) as (key: RowKey, dataField: string, value: any) => void,
            params?.isModified ?? vi.fn(() => false),
            'id',
            ref(null),
            params?.parentContainerSelectorForError
        );

        return {
            ...result,
            get columns() {
                return result.visibleColumns.value;
            },
            metaRef,
        };
    };

    const getComponentMetaFromRender = (column: DataTableBaseColumn, row: DataTableRowData) => {
        const vnode = column.render?.(row, 0);
        return (vnode as { props?: { componentMeta?: Record<string, unknown> } })?.props?.componentMeta;
    };

    it('добавляет selection-колонку в режиме multiple', () => {
        const { columns } = createColumns({
            selectionMode: 'multiple',
            api: { get: '/api' },
            columns: [{ caption: 'Имя', dataField: 'name' }],
        });

        expect(columns[0]).toMatchObject({ type: 'selection', fixed: 'left', multiple: true });
    });

    it('не добавляет selection-колонку в режиме none', () => {
        const { columns } = createColumns({
            selectionMode: 'none',
            api: { get: '/api' },
            columns: [{ caption: 'Код', dataField: 'code', dataType: 'string' }],
        });

        expect((columns[0] as DataTableBaseColumn).type).toBeUndefined();
    });

    it('добавляет пустую колонку в конец', () => {
        const { columns } = createColumns({
            selectionMode: 'none',
            api: { get: '/api' },
            columns: [{ caption: 'Имя', dataField: 'name' }],
        });

        expect(columns[1]).toMatchObject({ key: 'empty', dataField: 'empty', visible: true });
    });

    it('мапит caption/dataField в title/key и применяет дефолтные размеры', () => {
        const { columns } = createColumns({
            selectionMode: 'none',
            api: { get: '/api' },
            columns: [{ caption: 'Имя', dataField: 'name' }],
        });

        const column = columns[0] as DataTableBaseColumn;

        expect(column).toMatchObject({
            key: 'name',
            resizable: true,
            minWidth: 100,
            width: 250,
        });
        expect(typeof column.title).toBe('function');

        const titleVnode = (column.title as () => { props?: { caption?: string } })();
        expect(titleVnode.props?.caption).toBe('Имя');
    });

    it('прокидывает в vnode ячейки флаг modified и selector контейнера', () => {
        const { columns } = createColumns(
            {
                selectionMode: 'none',
                api: { get: '/api' },
                columns: [{ caption: 'Контрагент', dataField: 'partnerId' }],
            },
            {
                isModified: vi.fn(() => true),
                parentContainerSelectorForError: '.table-wrapper',
            }
        );
        const row = { id: 10, partnerId: 5 };
        const column = columns[0] as DataTableBaseColumn;
        const vnode = column.render?.(row, 0) as { props?: Record<string, unknown> };

        expect(vnode?.props?.isModified).toBe(true);
        expect(vnode?.props?.parentContainerSelectorForError).toBe('.table-wrapper');
    });

    it('передает value/displayValue/isEditable в componentMeta', () => {
        const { columns } = createColumns({
            isEditable: true,
            selectionMode: 'none',
            api: { get: '/api' },
            columns: [{ caption: 'Контрагент', dataField: 'partnerId', displayField: 'partnerName' }],
        });
        const row = { id: 10, partnerId: 5, partnerName: 'ООО Ромашка' };
        const column = columns[0] as DataTableBaseColumn;
        const componentMeta = getComponentMetaFromRender(column, row) as {
            isEditable: boolean;
            value: number;
            displayValue: string;
        };

        expect(componentMeta.isEditable).toBe(true);
        expect(componentMeta.value).toBe(5);
        expect(componentMeta.displayValue).toBe('ООО Ромашка');
    });

    it('onUpdateValue вызывает modifyData c dataField', () => {
        const modifyData = vi.fn();
        const { columns } = createColumns(
            {
                selectionMode: 'none',
                api: { get: '/api' },
                columns: [{ caption: 'Контрагент', dataField: 'partnerId' }],
            },
            { modifyData }
        );
        const row = { id: 10, partnerId: 5 };
        const column = columns[0] as DataTableBaseColumn;
        const componentMeta = getComponentMetaFromRender(column, row) as {
            onUpdateValue: (value: string | number) => void;
        };

        componentMeta.onUpdateValue(11);

        expect(modifyData).toHaveBeenCalledWith(10, 'partnerId', 11);
    });

    it('onUpdateDisplayValue вызывает modifyData c displayField', () => {
        const modifyData = vi.fn();
        const { columns } = createColumns(
            {
                selectionMode: 'none',
                api: { get: '/api' },
                columns: [{ caption: 'Контрагент', dataField: 'partnerId', displayField: 'partnerName' }],
            },
            { modifyData }
        );
        const row = { id: 10, partnerId: 5, partnerName: 'ООО Ромашка' };
        const column = columns[0] as DataTableBaseColumn;
        const componentMeta = getComponentMetaFromRender(column, row) as {
            onUpdateDisplayValue: (value: string | number) => void;
        };

        componentMeta.onUpdateDisplayValue('АО Тест');

        expect(modifyData).toHaveBeenCalledWith(10, 'partnerName', 'АО Тест');
    });

    it('onUpdateDisplayValue ничего не делает без displayField', () => {
        const modifyData = vi.fn();
        const { columns } = createColumns(
            {
                selectionMode: 'none',
                api: { get: '/api' },
                columns: [{ caption: 'Контрагент', dataField: 'partnerId' }],
            },
            { modifyData }
        );
        const row = { id: 10, partnerId: 5 };
        const column = columns[0] as DataTableBaseColumn;
        const componentMeta = getComponentMetaFromRender(column, row) as {
            onUpdateDisplayValue: (value: string | number) => void;
        };

        componentMeta.onUpdateDisplayValue('АО Тест');

        expect(modifyData).not.toHaveBeenCalled();
    });

    const createGroupedColumns = (isEditable: boolean) =>
        createColumns({
            isEditable,
            selectionMode: 'none',
            api: { get: '/api' },
            columns: [
                {
                    caption: 'Группа',
                    dataField: 'group',
                    children: [
                        { caption: 'Явно да', dataField: 'alwaysEditable', allowEditing: true },
                        { caption: 'Явно нет', dataField: 'alwaysReadonly', allowEditing: false },
                        { caption: 'По meta', dataField: 'fromMeta' },
                    ],
                },
            ],
        });

    it('групповая колонка не имеет render', () => {
        const { columns } = createGroupedColumns(false);
        const groupColumn = columns[0] as DataTableColumnGroup;

        expect((groupColumn as DataTableBaseColumn).render).toBeUndefined();
    });

    it('allowEditing=true делает дочернюю колонку редактируемой', () => {
        const { columns } = createGroupedColumns(false);
        const groupColumn = columns[0] as DataTableColumnGroup;
        const alwaysEditable = (groupColumn.children as DataTableBaseColumn[])[0];
        const row = { id: 1, alwaysEditable: 'A' };

        expect(alwaysEditable).toBeDefined();
        expect(getComponentMetaFromRender(alwaysEditable!, row)?.isEditable).toBe(true);
    });

    it('allowEditing=false делает дочернюю колонку read-only', () => {
        const { columns } = createGroupedColumns(true);
        const groupColumn = columns[0] as DataTableColumnGroup;
        const alwaysReadonly = (groupColumn.children as DataTableBaseColumn[])[1];
        const row = { id: 1, alwaysReadonly: 'B' };

        expect(alwaysReadonly).toBeDefined();
        expect(getComponentMetaFromRender(alwaysReadonly!, row)?.isEditable).toBe(false);
    });
});
