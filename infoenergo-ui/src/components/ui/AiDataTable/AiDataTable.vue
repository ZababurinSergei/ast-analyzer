<template>
    <AiToolbar
        v-if="!mergedMeta.isPopover"
        :is-editable="!!mergedMeta.isEditable"
        :title="mergedMeta.title"
        :count-selected-rows="checkedRowKeys.length"
        :has-focused-row="!!focusedRowKey"
        :is-data-modified="isDirty"
        :disabled="loading"
        :column-chooser="columnsChooser"
        @column-chooser-change="setColumnsVisibility"
        @click="handleToolbarAction"
    />
    <n-data-table
        ref="dataTable"
        v-model:checked-row-keys="checkedRowKeys"
        :scrollbar-props="{ size: 1 }"
        :columns="visibleColumns"
        :data="data"
        :loading="loading"
        :row-key="getRowKey"
        :row-props="rowProps"
        :row-class-name="rowClassName"
        class="ai-data-table"
        v-bind="mergedTableConfig"
    />
    <AiFooter
        v-if="mergedMeta.showFooter"
        :selected-count="checkedRowKeys.length"
        :show-selection-count="mergedMeta.selectionMode !== 'none'"
        :total-count="data.length"
        @create-filter="emit('create-filter')"
    />
</template>

<script lang="ts" setup>
/**
 * Таблица данных на базе Naive UI `NDataTable`
 */
import { computed, onMounted, watch, ref } from 'vue';
import { NDataTable } from 'naive-ui';
import type { DataTableRowData } from 'naive-ui';
import { DEFAULT_META, DEFAULT_TABLE_PROPS, DEFAULT_ROW_PROPS } from '@/components/ui/AiDataTable/defaults';
import type { TableProps, TableEmits } from '@/components/ui/AiDataTable/types';
import AiToolbar from '@/components/ui/AiToolbar/AiToolbar.vue';
import AiFooter from '@/components/ui/AiFooter/AiFooter.vue';
import { useTableState } from '@/composables/AiDataTable/useTableState';
import { useDataState } from '@/composables/AiDataTable/useDataState';
import { useColumnsConfig } from '@/composables/AiDataTable/useColumnsConfig';

const props = defineProps<TableProps>();
const emit = defineEmits<TableEmits>();
const dataTable = ref<InstanceType<typeof NDataTable> | null>(null);

const mergedMeta = computed(() => ({ ...DEFAULT_META, ...props.meta }));
const mergedTableConfig = computed(() => ({ ...DEFAULT_TABLE_PROPS, ...(props.meta.config ?? {}) }));

const {
    keyExpr,
    checkedRowKeys,
    focusedRowKey,
    getRowKey,
    resetState,
    syncState,
    setFocusedRow,
    isFocusedRow,
    isCheckedRow,
} = useTableState(props.meta.keyExpr);
const { data, loading, isDirty, updateRow, copyRow, isModified, loadData, createRow, removeRows, saveData } =
    useDataState(mergedMeta, keyExpr);
const { visibleColumns, columnsChooser, setColumnsVisibility, rebuildColumns } = useColumnsConfig(
    mergedMeta,
    updateRow,
    isModified,
    keyExpr,
    dataTable,
    '.ai-data-table'
);

const actions: Record<string, () => Promise<void> | void> = {
    refresh: async () => {
        const success = await loadData();
        if (success) resetState(data);
    },
    add: () => {
        createRow(focusedRowKey.value);
    },
    delete: async () => {
        const success = await removeRows(checkedRowKeys.value);
        if (success) syncState();
    },
    copy: async () => {
        const success = await copyRow(focusedRowKey.value);
        if (success) syncState();
    },
    save: async () => {
        const success = await saveData();
        if (success) resetState(data);
    },
};

const rowClassName = (row: DataTableRowData) => {
    if (isFocusedRow(row)) return 'focused-row';
    if (isCheckedRow(row)) return 'checked-row';
    return '';
};

const rowProps = (row: DataTableRowData) => ({
    ...DEFAULT_ROW_PROPS,
    onDblclick: () => {
        emit('row-doubleclick', row);
    },
    onClick: () => {
        setFocusedRow(row);
        emit('row-click', row);
    },
});

onMounted(async () => {
    await loadData();
    resetState(data);
});

const handleToolbarAction = async (id: string) => {
    await actions[id]?.();
};

watch(mergedMeta, rebuildColumns, { deep: true });
</script>

<style scoped lang="scss">
.ai-data-table :deep(td) {
    position: relative;
}

.ai-data-table :deep(.focused-row > td) {
    background: var(--light-blue-800) !important;
}

.ai-data-table :deep(.checked-row > td) {
    background: var(--light-blue-800) !important;
}
</style>
