import type { Tab } from '@/components/ui/AiTabs/types';
import type { useTabsBaseOperations } from '@/composables/AiTabs/useTabsBaseOperations';

type TabsApi = ReturnType<typeof useTabsBaseOperations>;

export const createTab = (
    title: string,
    viewId: string = title,
    routeName: string = viewId
): Tab => {
    return {
        title,
        viewId,
        routeName,
        isModified: false,
        userData: {},
        isClosable: true,
    };
};

/**
 * Добавляет несколько вкладок в API и делает первую активной.
 * @param tabsApi - API из useTabsBaseOperations()
 * @param count - количество вкладок (кроме домашней)
 * @param prefix - префикс для title/viewId/routeName (по умолчанию "Таб" / "tab")
 */
export const addInitialTabs = (
    tabsApi: TabsApi,
    count: number,
    prefix: { title?: string; id?: string } = {}
): void => {
    const titlePrefix = prefix.title ?? 'Таб';
    const idPrefix = prefix.id ?? 'tab';
    for (let i = 1; i <= count; i++) {
        tabsApi.addTabToTabBar(
            createTab(`${titlePrefix} ${i}`, `${idPrefix}-${i}`, `${idPrefix}-${i}`)
        );
    }
    const tabs = tabsApi.tabs.value;
    if (tabs.length > 0) {
        tabsApi.setActiveTab(tabs[0] as Tab);
    }
};
