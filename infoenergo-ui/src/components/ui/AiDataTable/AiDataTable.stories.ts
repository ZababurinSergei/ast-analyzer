import AiDataTable from '@/components/ui/AiDataTable/AiDataTable.vue';
import TableWrapper from '@/components/ui/AiDataTable/stories/decorators/TableWrapper.vue';
import { useFetch } from '@/composables/common/useFetch.ts';

const { send } = useFetch();

export default {
    title: 'Компоненты/AiDataTable (в разработке)',
    component: AiDataTable,
    args: {},
};

const tableWrapperDecorator = () => ({
    components: { TableWrapper },
    template: `
        <TableWrapper height="650px">
            <story />
        </TableWrapper>
    `,
});

export const Default = {
    name: 'Основной пример',
    decorators: [tableWrapperDecorator],
    args: {
        meta: {
            isEditable: true,
            title: 'Основной пример таблицы',
            keyExpr: 'rowId',
            api: {
                get: () => send('api/table/data/get'),
            },
            columns: [
                {
                    caption: 'string',
                    dataField: 'name',
                },
                {
                    caption: 'number',
                    dataField: 'age',
                    dataType: 'number',
                },
                {
                    caption: 'boolean',
                    dataField: 'isActive',
                    dataType: 'boolean',
                },
                {
                    caption: 'date',
                    dataField: 'date',
                    dataType: 'date',
                },
                {
                    caption: 'datetime',
                    dataField: 'dateAndTime',
                    dataType: 'datetime',
                },
                {
                    caption: 'Селектор',
                    dataField: 'selectorId',
                    displayField: 'selectorText',
                    editor: {
                        type: 'selector',
                        api: 'api/table/selector/data/get',
                        id: 'id',
                        text: 'text',
                    },
                },
                {
                    caption: 'Поповер',
                    dataField: 'popoverId',
                    displayField: 'popoverText',
                    editor: {
                        type: 'popover',
                    },
                    component: {
                        name: 'OneColumnTable',
                        id: 'id',
                        text: 'text',
                    },
                },
                {
                    caption: 'Модалка',
                    dataField: 'modalId',
                    displayField: 'modalText',
                    editor: {
                        type: 'modal',
                        config: {
                            title: 'Модальное окно',
                        },
                    },
                    component: {
                        name: 'OneColumnTable',
                        id: 'id',
                        text: 'text',
                    },
                },
            ],
        },
    },
};

export const ParentAndChildColumns = {
    name: 'Родительские и дочерние колонки',
    decorators: [tableWrapperDecorator],
    args: {
        meta: {
            isEditable: true,
            keyExpr: 'rowId',
            title: 'Родительские и дочерние колонки',
            api: {
                get: 'api/table/data/get',
            },
            columns: [
                {
                    caption: 'Parent 1',
                    dataField: 'Parent 1',
                    children: [
                        {
                            caption: 'Child 1.1',
                            dataField: 'name',
                        },
                        {
                            caption: 'Child 1.2',
                            dataField: 'age',
                            dataType: 'number',
                        },
                        {
                            dataField: 'Child 1.3 и Parent 2',
                            caption: 'Child 1.3 и Parent 2',
                            children: [
                                {
                                    caption: 'Child 2.1',
                                    dataField: 'isActive',
                                    dataType: 'boolean',
                                },
                                {
                                    caption: 'Child 2.2',
                                    dataField: 'date',
                                    dataType: 'date',
                                },
                                {
                                    caption: 'Child 2.3',
                                    dataField: 'dateAndTime',
                                    dataType: 'datetime',
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    },
};
