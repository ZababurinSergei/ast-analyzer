import type { GlobalThemeOverrides } from 'naive-ui';
import { ColorTokens } from '@/styles/colors/colorTokens.ts';
import { weightTokens } from '@/styles/fonts/fontsTokens.ts';

export const themeOverrides: GlobalThemeOverrides = {
    DataTable: {
        resizableContainerSize: '1px',
        resizableSize: '1px',
        loadingColor: ColorTokens.BLUE_700,

        thColor: ColorTokens.LIGHT_BLUE_100,
        thColorModal: ColorTokens.LIGHT_BLUE_100,
        thColorPopover: ColorTokens.LIGHT_BLUE_100,

        thFontWeight: weightTokens.SEMIBOLD,

        thPaddingSmall: '0px',
        tdPaddingSmall: '0',
        tdPaddingMedium: '0',
        tdPaddingLarge: '0',
        thPaddingMedium: '0',
        thPaddingLarge: '0',
    },
};
