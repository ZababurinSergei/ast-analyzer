import { h } from 'vue';
import TabsProviderStory from './TabsProviderStory.vue';
import TabsAdditionStory from './TabsAdditionStory.vue';
import TabsModificationStory from './TabsModificationStory.vue';

export interface WithTabsProviderOptions {
    /** Количество начальных вкладок (по умолчанию 2). */
    initialCount?: number;
    /** Префикс для названий вкладок. */
    prefix?: { title?: string; id?: string };
}

/**
 * Декоратор: провайдер табов с начальным набором вкладок и только AiTabs.
 */
export const withTabsProvider = (options: WithTabsProviderOptions = {}) => {
    return () => h(TabsProviderStory, options);
};

/**
 * Декоратор: табы + кнопка «Добавить» для добавления новых вкладок.
 */
export const withTabsAddition = () => () => h(TabsAdditionStory);

/**
 * Декоратор: табы + кнопка «Модифицировать» для переключения isModified активной вкладки.
 */
export const withTabsModification = () => () => h(TabsModificationStory);
