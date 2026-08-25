import type { DropdownOption } from 'naive-ui';

export const DEFAULT_AI_TABS_CONTEXT_MENU_OPTIONS: DropdownOption[] = [
    {
        label: 'Закрыть все вкладки',
        key: 'close-all-tabs',
    },
    {
        label: 'Закрыть все вкладки, кроме текущей',
        key: 'close-all-except-current',
    },
];
