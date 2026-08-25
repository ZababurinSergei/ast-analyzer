import type { DialogState } from '@/composables/AiDialog/types';
import type { ChoiceButtonModel } from '@/interfaces/choice';

export const INITIAL_DIALOG_STATE: DialogState = {
    title: '',
    content: '',
    isOpen: false,
    buttons: [],
    pendingResolve: null,
};

export const DEFAULT_TITLE = 'Подтвердите действие';

export const DEFAULT_BUTTON: ChoiceButtonModel = {
    option: 'positive',
    text: 'Ок',
};
