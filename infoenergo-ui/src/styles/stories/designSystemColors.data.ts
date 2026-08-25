export type DesignColorRow = {
    name: string;
    cssVar: string;
    components: string[];
    description: string;
};

export function getDesignColorRows(): DesignColorRow[] {
    return [
        {
            name: 'WHITE',
            cssVar: '--white',
            components: ['AiButton', 'AiTabs'],
            description: 'Светлый текст; фон tertiary-кнопки.',
        },
        {
            name: 'DARK_900',
            cssVar: '--dark-900',
            components: ['Общая тема', 'AiButton', 'AiLeftTabsArrow', 'AiRightTabsArrow'],
            description: 'Основной тёмный текст.',
        },
        {
            name: 'DARK_700',
            cssVar: '--dark-700',
            components: ['—'],
            description: '',
        },
        {
            name: 'BLUE_900',
            cssVar: '--blue-900',
            components: ['Общая тема', 'AiTabs'],
            description: 'Primary-кнопка pressed.',
        },
        {
            name: 'BLUE_800',
            cssVar: '--blue-800',
            components: ['Общая тема', 'AiTabs'],
            description: 'Primary-кнопка hover.',
        },
        {
            name: 'BLUE_700',
            cssVar: '--blue-700',
            components: ['Общая тема', 'AiButton', 'AiTabs', 'AiDataTable', 'Иконки'],
            description: 'Основной синий.',
        },
        {
            name: 'BLUE_600',
            cssVar: '--blue-600',
            components: ['AiButton'],
            description: 'Неактивная primary-кнопка.',
        },
        {
            name: 'BLUE_500',
            cssVar: '--blue-500',
            components: ['Общая тема', 'AiButton'],
            description: 'Secondary-кнопка pressed.',
        },
        {
            name: 'LIGHT_BLUE_900',
            cssVar: '--light-blue-900',
            components: ['Общая тема', 'AiButton'],
            description: 'Secondary-кнопка hover.',
        },
        {
            name: 'LIGHT_BLUE_800',
            cssVar: '--light-blue-800',
            components: ['AiDataTable'],
            description: 'Фон выделенной строки.',
        },
        {
            name: 'LIGHT_BLUE_700',
            cssVar: '--light-blue-700',
            components: ['Общая тема', 'AiButton'],
            description: 'Заливка secondary-кнопки (default и focus).',
        },
        {
            name: 'LIGHT_BLUE_100',
            cssVar: '--light-blue-100',
            components: ['AiDataTable', 'AiTabs', 'Иконки'],
            description: 'Фон шапки таблицы, круг под иконками.',
        },
        {
            name: 'GRAY_900',
            cssVar: '--gray-900',
            components: ['AiButton'],
            description: 'Обводка tertiary-кнопки при наведении.',
        },
        {
            name: 'GRAY_800',
            cssVar: '--gray-800',
            components: ['—'],
            description: '',
        },
        {
            name: 'GRAY_700',
            cssVar: '--gray-700',
            components: ['NCheckbox', 'AiButton', 'AiCell'],
            description: 'Рамка tertiary-кнопки, неактивный чекбокс, тень popover ошибки.',
        },
        {
            name: 'LIGHT_GRAY_900',
            cssVar: '--light-gray-900',
            components: ['AiButton'],
            description: 'Неактивная secondary-кнопка.',
        },
        {
            name: 'LIGHT_GRAY_800',
            cssVar: '--light-gray-800',
            components: ['AiCell'],
            description: 'Фон popover ошибки в ячейке.',
        },
        {
            name: 'LIGHT_GRAY_700',
            cssVar: '--light-gray-700',
            components: ['AiTabs', 'AiHomeIcon'],
            description: 'Нажатие неактивного таба.',
        },
        {
            name: 'LIGHT_GRAY_100',
            cssVar: '--light-gray-100',
            components: ['AiTabs', 'AiHomeIcon'],
            description: 'Hover неактивного таба.',
        },
        {
            name: 'GREEN_900',
            cssVar: '--green-900',
            components: ['AiButton'],
            description: 'Заливка иконки при нажатии.',
        },
        {
            name: 'GREEN_200',
            cssVar: '--green-200',
            components: ['AiCell'],
            description: 'Фон изменённой ячейки.',
        },
        {
            name: 'RED_900',
            cssVar: '--red-900',
            components: ['AiCell'],
            description: 'Маркер ошибки ячейки.',
        },
        {
            name: 'RED_500',
            cssVar: '--red-500',
            components: ['Общая тема'],
            description: 'Крестик закрытия в модалках.',
        },
        {
            name: 'RED_100',
            cssVar: '--red-100',
            components: ['AiCell'],
            description: 'Фон ячейки с ошибкой.',
        },
        {
            name: 'YELLOW',
            cssVar: '--yellow',
            components: ['AiModifiedEllipse'],
            description: 'Индикатор изменённого таба.',
        },
    ];
}
