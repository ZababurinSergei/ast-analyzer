<template>
    <footer class="ai-footer">
        <n-button class="ai-footer__create-filter" text title="Создать фильтр" @click="onCreateFilter">
            <template #icon>
                <n-icon>
                    <AiCreateFilter />
                </n-icon>
            </template>
            Создать фильтр
        </n-button>
        <div class="ai-footer__stats">
            <span v-if="showSelectionCount">Выбрано элементов: {{ selectedCount }}</span>
            <span>Всего элементов: {{ totalCount }}</span>
        </div>
    </footer>
</template>

<script lang="ts" setup>
import { NButton, NIcon } from 'naive-ui';
import AiCreateFilter from '@/components/icons/AiCreateFilter.vue';
import { DEFAULT_AI_FOOTER_PROPS } from '@/components/ui/AiFooter/default.ts';
import type { AiFooterEmits, AiFooterProps } from '@/components/ui/AiFooter/types.ts';

withDefaults(defineProps<AiFooterProps>(), DEFAULT_AI_FOOTER_PROPS);
const emit = defineEmits<AiFooterEmits>();

const onCreateFilter = () => {
    emit('create-filter');
};
</script>

<style lang="scss" scoped>
.ai-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 8px 12px;
    border: 1px solid var(--light-gray-700);
    border-top: none;
    font-size: 13px;
    line-height: 1.4;
    color: var(--gray-800);

    &__stats {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    &__create-filter {
        flex-shrink: 0;
        color: var(--blue-700);
        max-width: none;
        padding: 0;
        text-decoration: none;
        gap: 5px;

        &:hover:not(:active):not(:disabled) :deep(.n-button__content) {
            text-decoration: underline;
        }

        :deep(.n-icon),
        :deep(svg) {
            width: 25px;
            height: 25px;
        }
    }
}
</style>
