import type { ButtonProps } from 'naive-ui';
import type { Component } from 'vue';

export type VisualType = ButtonProps['type'];

/** Режим работы кнопки */
export type AiButtonMode = 'default' | 'choice';

/** Тип кнопки (для choice) которые будут применены к кнопке*/
export type AiChoiceButtonType = 'positive' | 'negative' | 'neutral';

export type AiChoiceOption = AiChoiceButtonType;

/** Тип кнопки (для default) которые будут применены к кнопке */
export type AiDefaultButtonType = 'icon' | 'primary' | 'secondary' | 'tertiary';

/** События компонента AiButton */
export type AiButtonEmit = {
    (event: 'click'): void;
    (event: 'click', option: AiChoiceOption): void;
};

/** Общие пропсы для обоих режимов кнопки */
interface AiButtonBaseProps {
    mode?: AiButtonMode;
    /** Иконка для кнопки */
    icon?: Component;
    /** Текст кнопки */
    text?: string;
    /** Текст подсказки (title) */
    hint?: string;
    /** Флаг неактивного состояния кнопки */
    disabled?: boolean;
    /** Ширина кнопки */
    width?: string;
    /** Высота кнопки */
    height?: string;
    /** Дополнительные пропсы, которые пробрасываются в NButton */
    config?: Partial<ButtonProps>;
}

/** Пропсы для default кнопки */
interface AiButtonDefaultModeProps extends AiButtonBaseProps {
    /** Режим работы кнопки */
    mode?: 'default';
    /** Визуальный тип кнопки в обычном режиме */
    buttonType?: AiDefaultButtonType;
    /** Для режима default option не используется */
    option?: never;
}

/** Пропсы для choice кнопки */
interface AiButtonChoiceModeProps extends AiButtonBaseProps {
    /** Режим работы кнопки */
    mode: 'choice';
    /** В режиме choice тип кнопки не задается вручную */
    buttonType?: never;
    /** Вариант choice-кнопки, определяет ее внешний вид */
    option: AiChoiceOption;
}

/** Пропсы для компонента AiButton */
export type AiButtonProps = AiButtonDefaultModeProps | AiButtonChoiceModeProps;
