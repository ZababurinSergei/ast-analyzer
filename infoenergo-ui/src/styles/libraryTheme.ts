import type { GlobalThemeOverrides } from 'naive-ui';
import { themeOverrides as aiButtonThemeOverrides } from '@/styles/AiButton/AiButtonStyles';
import { themeOverrides as aiDataTableThemeOverrides } from '@/styles/AiDataTable/AiDataTableStyles';
import { themeOverrides as aiDialogThemeOverrides } from '@/styles/AiDialog/AiDialogStyles';
import { themeOverrides as aiTabsThemeOverrides } from '@/styles/AiTabs/AiTabsStyles';
import { libraryCommonTheme } from '@/styles/libraryCommon';

export const libraryThemeOverrides: GlobalThemeOverrides = {
    ...libraryCommonTheme,
    ...aiButtonThemeOverrides,
    ...aiDataTableThemeOverrides,
    ...aiDialogThemeOverrides,
    ...aiTabsThemeOverrides,
};
