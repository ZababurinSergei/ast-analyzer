import type { GlobalThemeOverrides } from 'naive-ui';
import { ColorTokens } from '@/styles/colors/colorTokens.ts';

export const libraryCommonTheme: GlobalThemeOverrides = {
    common: {
        primaryColor: ColorTokens.BLUE_700,
        primaryColorHover: ColorTokens.BLUE_800,
        primaryColorPressed: ColorTokens.BLUE_900,
        primaryColorSuppl: ColorTokens.BLUE_800,

        warningColor: ColorTokens.LIGHT_BLUE_700,
        warningColorHover: ColorTokens.LIGHT_BLUE_900,
        warningColorPressed: ColorTokens.BLUE_500,
        warningColorSuppl: ColorTokens.LIGHT_BLUE_900,

        closeIconColor: ColorTokens.RED_500,
        closeIconColorHover: ColorTokens.RED_500,
        closeIconColorPressed: ColorTokens.RED_500,
    },
    Checkbox: {
        border: `1px solid ${ColorTokens.BLUE_700}`,
        borderDisabled: `1px solid ${ColorTokens.GRAY_700}`,
        borderDisabledChecked: `1px solid ${ColorTokens.GRAY_700}`,
    },
};
