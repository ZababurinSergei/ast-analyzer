<template>
    <n-popover
        :disabled="!isValidationError"
        placement="bottom"
        :show-arrow="false"
        :style="{ background: 'var(--light-gray-800)', boxShadow: '0px 2px 4px 0px var(--gray-700)' }"
        :to="parentContainerSelectorForError"
        :width="220"
        trigger="hover"
    >
        <template #trigger>
            <div class="ai-field-wrapper" :class="{ 'modified-cell': isModified, 'error-cell': isValidationError }">
                <AiField v-bind="props.componentMeta" />
            </div>
        </template>
        <span>{{ validationErrorMessage }}</span>
    </n-popover>

    <div v-if="isValidationError" class="error-triangle" />
</template>

<script setup lang="ts">
/**
 * Обёртка ячейки таблицы: рендер поля через `AiField`, индикация «изменено» / ошибка,
 * при ошибке — подсказка в `NPopover`
 */
import { NPopover } from 'naive-ui';
import type { AiCellProps } from '@/components/ui/AiCell/types';
import AiField from '@/components/ui/AiField/AiField.vue';

const props = withDefaults(defineProps<AiCellProps>(), {
    parentContainerSelectorForError: 'body',
});
</script>

<style scoped>
.ai-field-wrapper {
    flex: 1;
}

.error-popover {
    padding: 10px;
    border-left: 4px solid var(--red-900);
}

.error-triangle {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 12px 12px 0;
    border-color: transparent var(--red-900) transparent transparent;
    z-index: 1;
    pointer-events: none;
}

.modified-cell {
    background: var(--green-200);
}

.error-cell {
    background: var(--red-100);
}
</style>
