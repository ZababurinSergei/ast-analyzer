import { type GlobalThemeOverrides } from 'naive-ui';
import { ColorTokens } from '@/styles/colors/colorTokens.ts';

export const themeOverrides: GlobalThemeOverrides = {
    Tabs: {
        tabTextColorCard: ColorTokens.DARK_900,
        closeIconColor: ColorTokens.DARK_900,
        tabTextColorActiveCard: ColorTokens.WHITE,
        tabBorderRadius: '8px',
        closeIconSize: '17px',
        closeIconColorHover: ColorTokens.DARK_900,
        closeSize: '17px',
    },
};
