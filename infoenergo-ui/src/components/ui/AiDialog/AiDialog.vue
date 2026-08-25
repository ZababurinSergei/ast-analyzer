<template>
    <n-modal :show="isOpen" :style="DIALOG_STYLE" class="ai-dialog" v-bind="DIALOG_PROPS">
        <template #header>
            <span class="ai-dialog__title">{{ title }}</span>
        </template>
        <span>{{ content }}</span>
        <div class="ai-dialog__buttons">
            <AiButton
                v-for="button in buttons"
                :key="button.option"
                :option="button.option"
                :text="button.text"
                mode="choice"
                width="130px"
                @click="closeDialog"
            />
        </div>
    </n-modal>
</template>

<script lang="ts" setup>
import { toRefs } from 'vue';
import { NModal } from 'naive-ui';
import { closeDialog, getDialogState } from '@/composables/AiDialog/store';
import { DIALOG_PROPS, DIALOG_STYLE } from '@/components/ui/AiDialog/defaults';
import AiButton from '@/components/ui/AiButton/AiButton.vue';

const dialogState = getDialogState();
const { isOpen, title, content, buttons } = toRefs(dialogState);
</script>

<style lang="scss" scoped>
.ai-dialog {
    &__title {
        width: 100%;
        text-align: center;
    }

    &__buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 20px;
    }
}
</style>
