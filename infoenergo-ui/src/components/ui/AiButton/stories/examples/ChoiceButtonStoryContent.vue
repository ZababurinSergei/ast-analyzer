<template>
    <div class="ai-choice-button-row">
        <AiButton
            v-for="button in choiceButtons"
            :key="button.option"
            :option="button.option"
            :text="button.text"
            mode="choice"
            width="130px"
            @click="onChoiceClick"
        />
    </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import AiButton from '@/components/ui/AiButton/AiButton.vue';
import type { AiChoiceOption } from '@/components/ui/AiButton/types.ts';

const message = useMessage();

const choiceButtons: { option: AiChoiceOption; text: string }[] = [
    { option: 'positive', text: 'Да' },
    { option: 'negative', text: 'Нет' },
    { option: 'neutral', text: 'Отмена' },
];

const onChoiceClick = (choice: AiChoiceOption) => {
    if (choice === 'positive') message.success('positive');
    else if (choice === 'negative') message.error('negative');
    else if (choice === 'neutral') message.info('neutral');
};
</script>

<style scoped>
.ai-choice-button-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
</style>
