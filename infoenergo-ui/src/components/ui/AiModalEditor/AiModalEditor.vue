<template>
    <span class="modal-trigger" @click="showModal"> {{ value }} </span>
    <AiModal v-model:show="modalVisibility" v-bind="editorConfig" @close="handleCloseModal">
        <component :is="componentName" @[mergedEditorConfig.selectEvent]="handleUpdateValue" />
    </AiModal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { DataTableRowData } from 'naive-ui';
import AiModal from '@/components/ui/AiModal/AiModal.vue';
import { EDITOR_DEFAULT_CONFIG } from '@/components/ui/AiModalEditor/defaults.ts';
import type { AiModalEditorProps, AiModalEditorEmits } from '@/components/ui/AiModalEditor/types.ts';

const modalVisibility = ref(false);

const props = defineProps<AiModalEditorProps>();
const emit = defineEmits<AiModalEditorEmits>();

const mergedEditorConfig = { ...EDITOR_DEFAULT_CONFIG, ...props.editorConfig };

onMounted(() => {
    showModal();
});

const showModal = () => {
    modalVisibility.value = true;
};

const hideModal = () => {
    modalVisibility.value = false;
};

const handleCloseModal = () => {
    emit('blur');
};

const handleUpdateValue = (row: DataTableRowData) => {
    hideModal();
    emit('update:value', row[props.idKey], row[props.textKey]);
    emit('blur');
};
</script>

<style scoped>
.modal-trigger {
    cursor: pointer;
    display: block;
    min-height: 23px;
    padding: 3px 7px 2px;

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
}
</style>
