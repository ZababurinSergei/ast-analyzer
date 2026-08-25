import { toRef, reactive } from 'vue';
import {
    DEFAULT_BUTTON_TO_VISUAL_TYPE,
    CHOICE_BUTTON_TO_VISUAL_TYPE,
    DEFAULT_BUTTON_TYPE,
} from '@/components/ui/AiButton/defaults.ts';
import type { AiButtonProps, VisualType } from '@/components/ui/AiButton/types.ts';

export const useButtonsConfig = (props: AiButtonProps) => {
    const getConfigureType = (): VisualType => {
        if (props.mode === 'default') {
            const buttonType = props.buttonType ?? DEFAULT_BUTTON_TYPE;
            return DEFAULT_BUTTON_TO_VISUAL_TYPE[buttonType];
        }
        if (props.mode === 'choice') return CHOICE_BUTTON_TO_VISUAL_TYPE[props.option];
    };

    const visualType: VisualType = getConfigureType();

    const buttonProps = reactive({
        type: visualType,
        circle: props.buttonType === 'icon',
        disabled: toRef(props, 'disabled'),
        style: {
            width: props.width,
            height: props.height,
        },
        ...props.config,
    });

    return { buttonProps };
};
