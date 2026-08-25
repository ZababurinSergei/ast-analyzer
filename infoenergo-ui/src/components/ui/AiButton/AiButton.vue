<template>
    <n-button
        :class="{ 'ai-icon-button': buttonProps.circle }"
        :title="hint"
        class="ai-button"
        v-bind="buttonProps"
        @click="onClick"
    >
        <template v-if="icon" #icon>
            <n-icon>
                <component :is="icon" />
            </n-icon>
        </template>
        <span v-if="text" class="ai-button__text">{{ text }}</span>
    </n-button>
</template>

<script lang="ts" setup>
import { NButton } from 'naive-ui';
import type { AiButtonEmit, AiButtonProps } from '@/components/ui/AiButton/types.ts';
import { DEFAULT_AI_BUTTON_PROPS } from '@/components/ui/AiButton/defaults.ts';
import { useButtonsConfig } from '@/composables/AiButton/useButtonsConfig.ts';

const props = withDefaults(defineProps<AiButtonProps>(), DEFAULT_AI_BUTTON_PROPS);
const emit = defineEmits<AiButtonEmit>();
const { buttonProps } = useButtonsConfig(props);

const onClick = () => {
    if (props.mode === 'choice') {
        emit('click', props.option);
        return;
    }
    emit('click');
};
</script>

<style lang="scss" scoped>
.ai-button {
    max-width: 250px;

    &__text {
        display: block;
        max-width: 100%;
        min-width: 0;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &.ai-icon-button {
        --n-color: transparent !important;
        --n-color-hover: transparent !important;
        --n-color-pressed: transparent !important;
        --n-color-focus: transparent !important;
        --n-color-disabled: transparent !important;

        :deep(.ai-icon__bg) {
            fill: var(--light-blue-100);
        }

        :deep(.ai-icon__fg) {
            fill: var(--blue-700);
        }

        &:hover:not(:disabled) {
            :deep(.ai-icon__bg) {
                fill: var(--blue-700);
            }

            :deep(.ai-icon__fg) {
                fill: var(--light-blue-100);
            }
        }

        &:active:not(:disabled) {
            :deep(.ai-icon__bg) {
                fill: var(--green-900);
            }

            :deep(.ai-icon__fg) {
                fill: var(--light-blue-100);
            }
        }

        &:disabled {
            :deep(.ai-icon__fg) {
                fill: var(--gray-700);
            }

            :deep(.ai-icon__bg) {
                fill: var(--light-blue-100);
            }
        }
    }
}
</style>
