/** Опция выбора */
export type ChoiceOption = 'positive' | 'negative' | 'neutral';

/** Модель кнопки выбора */
export interface ChoiceButtonModel {
    /** Тип кнопки */
    option: ChoiceOption;
    /** Текст кнопки */
    text: string;
}
