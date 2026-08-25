<template>
    <n-popover v-model:show="popoverVisibility" :show-arrow="false" trigger="click" @update:show="handleUpdateShow">
        <template #trigger>
            <span class="popover-trigger"> {{ value }} </span>
        </template>
        <div class="popover-content" :style="{ width: mergedEditorConfig.width, height: mergedEditorConfig.height }">
            <component :is="componentName" @[mergedEditorConfig.selectEvent]="handleUpdateValue" />
        </div>
    </n-popover>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NPopover } from 'naive-ui';
import type { DataTableRowData } from 'naive-ui';
import { EDITOR_DEFAULT_CONFIG } from '@/components/ui/AiPopoverEditor/defaults.ts';
import type { AiPopoverEditorProps, AiPopoverEditorEmits } from '@/components/ui/AiPopoverEditor/types.ts';

const popoverVisibility = ref(false);

const props = defineProps<AiPopoverEditorProps>();
const emit = defineEmits<AiPopoverEditorEmits>();

const mergedEditorConfig = { ...EDITOR_DEFAULT_CONFIG, ...props.editorConfig };

onMounted(() => {
    showPopover();
});

const showPopover = () => {
    popoverVisibility.value = true;
};

const hidePopover = () => {
    popoverVisibility.value = false;
};

const handleUpdateShow = (show: boolean) => {
    if (show) return;
    emit('blur');
};

const handleUpdateValue = (row: DataTableRowData) => {
    hidePopover();
    emit('update:value', row[props.idKey], row[props.textKey]);
    emit('blur');
};
</script>

<style scoped>
.popover-trigger {
    cursor: pointer;
    display: block;
    min-height: 23px;
    padding: 3px 7px 2px;

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
}

.popover-content {
    padding: 10px;
}
</style>
