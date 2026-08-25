<template>
    <div class="ai-toolbar">
        <p class="ai-toolbar__title">{{ title }}</p>
        <div class="ai-toolbar__elements">
            <span v-for="element in elements" :key="element.id" class="elements__element">
                <AiButton
                    v-if="element.elementType === 'button'"
                    :disabled="isButtonDisabled(element.id)"
                    :icon="element.icon"
                    :button-type="element.buttonType"
                    :hint="element.hint"
                    @click="handleClick(element.id)"
                />
                <n-popselect
                    v-else-if="element.elementType === 'popselect'"
                    v-model:value="element.value"
                    trigger="click"
                    :options="element.options"
                    :multiple="element.multiple"
                    @update:value="handleUpdateColumnChooserValue"
                >
                    <AiButton
                        :disabled="isElementDisabled()"
                        button-type="icon"
                        :icon="element.icon"
                        :hint="element.hint"
                    />
                </n-popselect>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { NPopselect } from 'naive-ui';
import AiButton from '@/components/ui/AiButton/AiButton.vue';
import type { AiToolbarProps, AiToolbarEmits } from '@/components/ui/AiToolbar/types';
import { useToolbarConfig } from '@/composables/AiToolbar/useToolbarConfig';

const props = defineProps<AiToolbarProps>();
const emit = defineEmits<AiToolbarEmits>();

const { elements } = useToolbarConfig(props.columnChooser, props.isEditable);

const handleClick = (id: string) => {
    emit('click', id);
};

const handleUpdateColumnChooserValue = (visibleColumns: string[]) => {
    emit('column-chooser-change', visibleColumns);
};

const isButtonDisabled = (id: string) => {
    if (isElementDisabled()) return true;
    if (id === 'delete') return props.countSelectedRows === 0;
    if (id === 'copy') return !props.hasFocusedRow;
    if (id === 'save') return !props.isDataModified;
    return false;
};

const isElementDisabled = () => !!props.disabled;
</script>

<style scoped lang="scss">
.ai-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #e5e7eb;
    border-bottom: none;
    padding: 2px 10px;

    &__title {
        margin: 0;
        font-size: 20px;
        font-weight: 400;
    }

    &__elements {
        display: flex;
        gap: 10px;
    }
}

.elements {
    &__element {
        display: flex;
        gap: 10px;
        justify-content: center;
    }
}
</style>
