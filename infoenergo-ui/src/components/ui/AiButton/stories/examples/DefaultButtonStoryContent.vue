<template>
    <div class="ai-toolbar-button-row">
        <AiButton
            v-for="button in toolbarButtons"
            :key="button.actionName"
            :button-type="button.buttonType"
            :disabled="button.disabled"
            :hint="button.hint"
            :icon="button.icon"
            :text="button.text"
            @click="showMessage(button.actionName)"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useMessage } from 'naive-ui';
import AiTestIcon from '@/components/icons/AiTestIcon.vue';
import AiRefreshIcon from '@/components/icons/toolbar/AiRefreshIcon.vue';
import AiButton from '@/components/ui/AiButton/AiButton.vue';
import type { AiButtonProps } from '@/components/ui/AiButton/types.ts';

const message = useMessage();

const props = defineProps<{
    iconDisabled: boolean;
    primaryDisabled: boolean;
    secondaryDisabled: boolean;
    tertiaryDisabled: boolean;
    iconPrimaryDisabled: boolean;
}>();

type ActionName = 'icon' | 'primary' | 'secondary' | 'tertiary' | 'primaryIcon';
type ToolbarButtonConfig = AiButtonProps & { actionName: ActionName };

const showMessage = (actionName: ActionName) => {
    message.info(`Кнопка с типом ${actionName} нажата`);
};

const toolbarButtons = computed<ToolbarButtonConfig[]>(() => [
    {
        actionName: 'icon',
        disabled: props.iconDisabled,
        buttonType: 'icon',
        hint: 'Обновить',
        icon: AiRefreshIcon,
    },
    {
        actionName: 'primary',
        disabled: props.primaryDisabled,
        buttonType: 'primary',
        text: 'Primary Primary Primary Primary Primary Primary Primary',
    },
    {
        actionName: 'secondary',
        disabled: props.secondaryDisabled,
        buttonType: 'secondary',
        text: 'Secondary',
    },
    {
        actionName: 'tertiary',
        disabled: props.tertiaryDisabled,
        buttonType: 'tertiary',
        text: 'Tertiary',
    },
    {
        actionName: 'primaryIcon',
        disabled: props.iconPrimaryDisabled,
        buttonType: 'primary',
        text: 'Primary with icon',
        icon: AiTestIcon,
    },
]);
</script>

<style scoped>
.ai-toolbar-button-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
</style>
