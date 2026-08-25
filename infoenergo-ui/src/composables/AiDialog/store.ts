import { reactive, readonly } from 'vue';
import type { DialogState, DialogShowConfig, DialogResolve } from '@/composables/AiDialog/types';
import { INITIAL_DIALOG_STATE, DEFAULT_BUTTON, DEFAULT_TITLE } from '@/composables/AiDialog/defaults';
import type { ChoiceOption } from '@/interfaces/choice';

const dialogState = reactive<DialogState>({ ...INITIAL_DIALOG_STATE });

const configureButtons = (positiveText?: string, negativeText?: string, neutralText?: string) => {
    const buttons = dialogState.buttons;
    buttons.length = 0;

    const addButton = (option: ChoiceOption, rawText?: string) => {
        const text = rawText?.trim();
        if (text) buttons.push({ option, text });
    };

    addButton('positive', positiveText);
    addButton('negative', negativeText);
    addButton('neutral', neutralText);

    if (buttons.length === 0) buttons.push(DEFAULT_BUTTON);
};

export const getDialogState = () => readonly(dialogState);

export const showDialog = (config: DialogShowConfig) => {
    if (dialogState.pendingResolve !== null) {
        console.error('Диалоговое окно уже открыто');
        return Promise.resolve(null);
    }

    const { title, content, positiveText, negativeText, neutralText } = config;

    dialogState.title = title?.trim() || DEFAULT_TITLE;
    dialogState.content = content?.trim();
    configureButtons(positiveText, negativeText, neutralText);
    dialogState.isOpen = true;

    return new Promise<DialogResolve>(resolve => {
        dialogState.pendingResolve = resolve;
    });
};

export const closeDialog = (choice: ChoiceOption) => {
    dialogState.pendingResolve?.(choice);
    dialogState.pendingResolve = null;
    dialogState.isOpen = false;
};
