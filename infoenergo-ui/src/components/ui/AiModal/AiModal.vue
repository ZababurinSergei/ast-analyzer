<template>
    <n-modal
        :show="show"
        :style="MODAL_STYLES"
        v-bind="propsComputed"
        @update:show="handleUpdateShow"
        @close="handleCloseModal"
    >
        <template #header>
            <n-flex gap="small">
                <n-text>{{ title }}</n-text>
                <slot name="header" />
            </n-flex>
        </template>

        <template #header-extra>
            <slot name="header-extra" />
        </template>

        <slot />

        <template #footer>
            <slot name="footer" />
        </template>
    </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NFlex, NModal, NText } from 'naive-ui';
import { DEFAULT_MODAL_CONFIG, MODAL_STYLES } from '@/components/ui/AiModal/defaults.ts';
import type { AiModalProps, AiModalEmits } from '@/components/ui/AiModal/types.ts';

const props = defineProps<AiModalProps>();
const emit = defineEmits<AiModalEmits>();

const show = computed<boolean>({
    get: () => props.show,
    set: value => emit('update:show', value),
});

const propsComputed = computed(() => ({ ...DEFAULT_MODAL_CONFIG, ...props.config }));

const handleUpdateShow = (value: boolean) => {
    show.value = value;
};

const handleCloseModal = () => {
    emit('close');
};
</script>
