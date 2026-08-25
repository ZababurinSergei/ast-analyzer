import type { ChoiceOption, ChoiceButtonModel } from '@/interfaces/choice';

/** Состояние диалога */
export interface DialogState {
    /** Заголовок диалога */
    title: string;
    /** Основной текст внутри диалога */
    content: string;
    /** Видимость диалога */
    isOpen: boolean;
    /** Кнопки диалога */
    buttons: ChoiceButtonModel[];
    /** Функция для закрытия диалога */
    pendingResolve: ((choice: ChoiceOption | null) => void) | null;
}

/** Конфигурация для показа диалога */
export interface DialogShowConfig {
    /** Заголовок диалога */
    title?: string;
    /** Основной текст внутри диалога */
    content: string;
    /** Текст positive кнопки */
    positiveText?: string;
    /** Текст negative кнопки */
    negativeText?: string;
    /** Текст neutral кнопки */
    neutralText?: string;
}

/** Результат выбора */
export type DialogResolve = ChoiceOption | null;
