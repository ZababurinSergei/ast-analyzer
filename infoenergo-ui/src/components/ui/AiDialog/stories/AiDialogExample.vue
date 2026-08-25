<template>
    <div style="display: flex; flex-direction: column; gap: 12px">
        <n-button style="width: 220px" type="info" @click="openDialogByService"> Открыть диалоговое окно </n-button>
    </div>
</template>

<script setup lang="ts">
import { NButton, useMessage } from 'naive-ui';
import { useDialog } from '@/composables/AiDialog/useDialog';
import type { DialogShowConfig } from '@/composables/AiDialog/types';

const dialog = useDialog();
const message = useMessage();

const props = defineProps<DialogShowConfig>();

const openDialogByService = async () => {
    const choice = await dialog.show(props);
    if (choice === 'positive') message.success('positive');
    else if (choice === 'negative') message.error('negative');
    else if (choice === 'neutral') message.info('neutral');
};
</script>
