import type { AiButtonMode, AiChoiceOption, AiDefaultButtonType, VisualType } from '@/components/ui/AiButton/types.ts';

/** Значения типа кнопки по умолчанию */
export const DEFAULT_BUTTON_TYPE: AiDefaultButtonType = 'primary';

/** Значения режима работы кнопки по умолчанию */
export const DEFAULT_BUTTON_MODE: AiButtonMode = 'default';

/** Значения пропсов по умолчанию */
export const DEFAULT_AI_BUTTON_PROPS = {
    mode: DEFAULT_BUTTON_MODE,
} as const;

/** Соответствие семантического типа кнопки (`AiButtonType`) типу темы `NButton` */
export const DEFAULT_BUTTON_TO_VISUAL_TYPE: Record<AiDefaultButtonType, VisualType> = {
    icon: 'primary',
    primary: 'primary',
    secondary: 'warning',
    tertiary: 'error',
};

/** Тип кнопки в зависимости от выбора `AiChoiceOption` */
export const CHOICE_BUTTON_TO_VISUAL_TYPE: Record<AiChoiceOption, VisualType> = {
    positive: 'primary',
    negative: 'warning',
    neutral: 'error',
};
