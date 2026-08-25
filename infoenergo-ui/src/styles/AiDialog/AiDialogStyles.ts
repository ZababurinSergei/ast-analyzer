import type { GlobalThemeOverrides } from 'naive-ui';
import { weightTokens } from '@/styles/fonts/fontsTokens.ts';

export const themeOverrides: GlobalThemeOverrides = {
    Dialog: {
        fontSize: '14px',
        borderRadius: '10px',
        closeIconSize: '18px',
        titleFontSize: '24px',
        titleFontWeight: weightTokens.MEDIUM,
    },
};
