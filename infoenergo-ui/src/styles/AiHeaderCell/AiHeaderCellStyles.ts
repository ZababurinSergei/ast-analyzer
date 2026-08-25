import type { GlobalThemeOverrides } from 'naive-ui';

export const themeOverrides: GlobalThemeOverrides = {
    Input: {
        border: 'none',
        borderHover: 'none',
        borderActive: 'none',
        borderFocus: 'none',
        borderPressed: 'none',
        borderShadow: 'none',
        boxShadowHover: 'none',
        paddingMedium: '0',
        heightMedium: '25px',
    },
    InternalSelection: {
        paddingSingle: '0',
        border: 'transparent',
        borderHover: 'transparent',
        borderActive: 'transparent',
        borderFocus: 'transparent',
        borderPressed: 'transparent',
        borderShadow: 'transparent',
        boxShadowFocus: 'transparent',
        boxShadowActive: 'transparent',
        clearSize: '0',
        arrowSize: '0',
    },
    InternalSelectMenu: {
        optionColorActive: 'transparent',
        optionColorPending: 'transparent',
        optionColorActivePending: 'transparent',
    },
};
