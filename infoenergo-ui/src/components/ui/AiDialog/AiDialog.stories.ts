import { AiDialog } from '@/components/ui';
import AiDialogExample from '@/components/ui/AiDialog/stories/AiDialogExample.vue';
import type { DialogShowConfig } from '@/composables/AiDialog/types';

export default {
    title: 'Компоненты/AiDialog',
    component: AiDialog,
    argTypes: {
        title: {
            control: 'text',
            description: 'Заголовок диалога',
        },
        content: {
            control: 'text',
            description: 'Основной текст диалога',
        },
        positiveText: {
            control: 'text',
            description: 'Текст positive кнопки',
        },
        negativeText: {
            control: 'text',
            description: 'Текст negative кнопки',
        },
        neutralText: {
            control: 'text',
            description: 'Текст neutral кнопки',
        },
    },
};

const baseRender = (args: DialogShowConfig) => ({
    components: { AiDialogExample },
    setup() {
        return { args };
    },
    template: '<AiDialogExample v-bind="args" />',
});

const minimumArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
};

export const MinimumProps = {
    name: 'Минимальные пропсы',
    args: minimumArgs,
    render: baseRender,
};

const titleArgs: DialogShowConfig = {
    title: 'Кастомный заголовок',
    content: 'Текст диалогового окна',
};

export const Title = {
    name: 'Кастомный заголовок',
    args: titleArgs,
    render: baseRender,
};

const positiveButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    positiveText: 'Да',
};

export const PositiveButton = {
    name: 'Positive кнопка',
    args: positiveButtonArgs,
    render: baseRender,
};

const negativeButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    negativeText: 'Нет',
};

export const NegativeButton = {
    name: 'Negative кнопка',
    args: negativeButtonArgs,
    render: baseRender,
};

const neutralButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    neutralText: 'Отмена',
};

export const NeutralButton = {
    name: 'Neutral кнопка',
    args: neutralButtonArgs,
    render: baseRender,
};

const positiveAndNegativeButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    positiveText: 'Да',
    negativeText: 'Нет',
};

export const PositiveAndNegativeButton = {
    name: 'Positive и negative кнопки',
    args: positiveAndNegativeButtonArgs,
    render: baseRender,
};

const positiveAndNeutralButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    positiveText: 'Да',
    neutralText: 'Отмена',
};

export const PositiveAndNeutralButton = {
    name: 'Positive и neutral кнопки',
    args: positiveAndNeutralButtonArgs,
    render: baseRender,
};

const negativeAndNeutralButtonArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    negativeText: 'Нет',
    neutralText: 'Отмена',
};

export const NegativeAndNeutralButton = {
    name: 'Negative и neutral кнопки',
    args: negativeAndNeutralButtonArgs,
    render: baseRender,
};

const allButtonsArgs: DialogShowConfig = {
    content: 'Текст диалогового окна',
    positiveText: 'Да',
    negativeText: 'Нет',
    neutralText: 'Отмена',
};

export const AllButtons = {
    name: 'Все кнопки',
    args: allButtonsArgs,
    render: baseRender,
};

const allArgs: DialogShowConfig = {
    title: 'Кастомный заголовок',
    content: 'Текст диалогового окна',
    positiveText: 'Да',
    negativeText: 'Нет',
    neutralText: 'Отмена',
};

export const AllProps = {
    name: 'Все пропсы',
    args: allArgs,
    render: baseRender,
};
