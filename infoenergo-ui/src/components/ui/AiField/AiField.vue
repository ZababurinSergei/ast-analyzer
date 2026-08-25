<template>
    <div v-if="isComponentVisible" class="editable-mode">
        <component
            :is="fieldComponent"
            ref="fieldRef"
            :[valueKey]="value"
            v-bind="mergedComponentProps"
            :disabled="isComponentDisabled"
            @blur="disableEditMode"
            @[updateEvent]="handleInput"
        />
    </div>

    <n-text v-else class="not-editable-mode" @click="enableEditMode">
        {{ value }}
    </n-text>
</template>

<script setup lang="ts">
/**
 * Поле ячейки: в режиме просмотра — текст с переходом в редактирование по клику;
 * для `boolean` редактор показывается сразу. Компонент редактора подставляется
 * по `dataType` / `editor` через `useFieldComponent`. Наружу отдаёт `activeTriggerRef`
 * для позиционирования popover в родителе.
 */
import { ref, nextTick, computed } from 'vue';
import { NText } from 'naive-ui';
import type { InputInst } from 'naive-ui';
import type { AiComponentEmits } from '@/components/ui/AiField/types.ts';
import { useFieldComponent } from '@/composables/AiField/useFieldComponent';
import { DEFAULT_DATA_TYPE } from '@/defaults/common.ts';
import type { DataFieldValue, AiComponentProps } from '@/interfaces/common.ts';

const fieldRef = ref<InputInst | null>(null);
const isEditableMode = ref(false);

const emit = defineEmits<AiComponentEmits>();
const props = withDefaults(defineProps<AiComponentProps>(), {
    dataType: DEFAULT_DATA_TYPE,
});

const value = computed(() => props.displayValue ?? props.value);
const isEditableField = computed(() => props.isEditable);
const isComponentDisabled = computed(() => props.dataType === 'boolean' && !isEditableField.value);
const isComponentVisible = computed(
    () => (isEditableField.value && isEditableMode.value) || props.dataType === 'boolean'
);
const valueKey = computed<string>(() => propAliases.value?.valueKey ?? 'value');
const updateEvent = computed<string>(() => propAliases.value?.updateEvent ?? 'update:value');

const { fieldComponent, propAliases, mergedComponentProps } = useFieldComponent(
    props.dataType,
    props.editor,
    props.component
);

const disableEditMode = async () => {
    isEditableMode.value = false;
};

const enableEditMode = async () => {
    isEditableMode.value = true;
    await nextTick();
    fieldRef.value?.focus?.();
};

const handleInput = (value: DataFieldValue, option?: any) => {
    emit('update-value', value);
    if (props.displayValue === undefined) return;

    const displayKey = props?.editor?.text ?? '';
    const displayValue = option?.[displayKey] ?? option;
    emit('update-display-value', displayValue);
};
</script>

<style scoped>
.not-editable-mode {
    display: block;
    min-height: 23px;
    padding: 3px 7px 2px;

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
}

.editable-mode {
    width: 100%;
    height: 100%;
}
</style>
