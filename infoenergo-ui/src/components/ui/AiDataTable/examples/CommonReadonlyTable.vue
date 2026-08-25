<template>
    <AiDataTable :meta="meta" />
</template>

<script setup lang="ts">
import AiDataTable from '@/components/ui/AiDataTable/AiDataTable.vue';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';

const meta: Meta = {
    isEditable: false,
    selectionMode: 'none',
    keyExpr: 'rowId',
    api: {
        get: 'api/table/data/get',
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
    ],
};
</script>
