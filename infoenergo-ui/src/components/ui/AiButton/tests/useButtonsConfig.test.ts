import { describe, it, expect } from 'vitest';
import { reactive } from 'vue';

import { useButtonsConfig } from '@/composables/AiButton/useButtonsConfig.ts';
import type { AiButtonProps } from '@/components/ui/AiButton/types.ts';
import { DEFAULT_AI_BUTTON_PROPS } from '@/components/ui/AiButton/defaults.ts';

const withDefaults = (incomingProps?: AiButtonProps) => ({
    ...DEFAULT_AI_BUTTON_PROPS,
    ...(incomingProps ?? {}),
});

describe('useButtonsConfig', () => {
    it('в default без buttonType подставляет primary и type NButton primary', () => {
        const props = reactive<AiButtonProps>(withDefaults({ text: 'x' }));
        const { buttonProps } = useButtonsConfig(props);

        expect(buttonProps.type).toBe('primary');
        expect(buttonProps.circle).toBe(false);
    });

    it('в default для icon включает circle', () => {
        const props = reactive<AiButtonProps>(
            withDefaults({
                text: 'x',
                buttonType: 'icon',
            })
        );
        const { buttonProps } = useButtonsConfig(props);

        expect(buttonProps.circle).toBe(true);
        expect(buttonProps.type).toBe('primary');
    });

    it('маппит secondary и tertiary на warning и error', () => {
        const secondary = reactive<AiButtonProps>(withDefaults({ text: 'x', buttonType: 'secondary' }));
        const tertiary = reactive<AiButtonProps>(withDefaults({ text: 'x', buttonType: 'tertiary' }));

        expect(useButtonsConfig(secondary).buttonProps.type).toBe('warning');
        expect(useButtonsConfig(tertiary).buttonProps.type).toBe('error');
    });

    it('в choice маппит option в тот же type, что и у соответствующего buttonType', () => {
        const positive = reactive<AiButtonProps>(
            withDefaults({
                mode: 'choice',
                option: 'positive',
                text: 'Да',
            })
        );
        const negative = reactive<AiButtonProps>(
            withDefaults({
                mode: 'choice',
                option: 'negative',
                text: 'Нет',
            })
        );
        const neutral = reactive<AiButtonProps>(
            withDefaults({
                mode: 'choice',
                option: 'neutral',
                text: 'Отмена',
            })
        );

        expect(useButtonsConfig(positive).buttonProps.type).toBe('primary');
        expect(useButtonsConfig(negative).buttonProps.type).toBe('warning');
        expect(useButtonsConfig(neutral).buttonProps.type).toBe('error');
    });

    it('пробрасывает disabled, width и height', () => {
        const props = reactive<AiButtonProps>(
            withDefaults({
                text: 'x',
                disabled: true,
                width: '120px',
                height: '40px',
            })
        );
        const { buttonProps } = useButtonsConfig(props);

        expect(buttonProps.disabled).toBe(true);
        expect(buttonProps.style).toEqual({ width: '120px', height: '40px' });
    });

    it('мерджит config поверх вычисленных пропсов', () => {
        const props = reactive<AiButtonProps>(
            withDefaults({
                text: 'x',
                config: { size: 'large' },
            })
        );
        const { buttonProps } = useButtonsConfig(props);

        expect(buttonProps.size).toBe('large');
        expect(buttonProps.type).toBe('primary');
    });

    it('config может переопределить type', () => {
        const props = reactive<AiButtonProps>(
            withDefaults({
                text: 'x',
                config: { type: 'success' },
            })
        );
        const { buttonProps } = useButtonsConfig(props);

        expect(buttonProps.type).toBe('success');
    });
});
