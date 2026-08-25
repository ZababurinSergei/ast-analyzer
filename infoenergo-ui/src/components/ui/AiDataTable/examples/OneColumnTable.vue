<template>
    <AiDataTable :meta="meta" />
</template>

<script setup lang="ts">
import AiDataTable from '@/components/ui/AiDataTable/AiDataTable.vue';
import type { Meta } from '@/components/ui/AiDataTable/types.ts';

const meta: Meta = {
    isPopover: true,
    isEditable: false,
    selectionMode: 'none',
    api: {
        get: 'api/table/popover/data/get',
    },
    columns: [
        {
            caption: 'Текст (string)',
            dataField: 'text',
        },
    ],
};
</script>
