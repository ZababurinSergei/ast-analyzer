import type { Tab } from '../../components/ui/AiTabs/types';
import { useTabsState, type UseTabsStateReturn } from './useTabsState';

/** идентификатор для provide/inject API табов  */
export const TABS_API_KEY = 'tabsApi' as const;

export interface UseTabsBaseOperationsReturn {
    homeView: UseTabsStateReturn['homeView'];
    tabs: UseTabsStateReturn['tabs'];
    activeTab: UseTabsStateReturn['activeTab'];

    /** Устанавливает активную вкладку. */
    setActiveTab: UseTabsStateReturn['setActiveTab'];

    /** Полностью заменяет состояние вкладок. */
    setTabs: UseTabsStateReturn['setTabs'];

    /** Сбрасывает состояние вкладок на начальное. */
    resetTabState: UseTabsStateReturn['resetTabState'];

    /**
     * Изменяет статус модификации вкладки (isModified).
     * Переключает флаг `isModified` (true/false) у вкладки по её названию.
     *
     * @param tabName Название вкладки для модификации.
     * @remarks Используется для отображения индикатора несохраненных изменений.
     */
    modifyTab: (tabName: string) => void;

    /**
     * Обновляет userData у вкладки по title или viewId.
     *
     * @function
     * @param {string} tabKey - Название вкладки (title) или её viewId
     * @param {any} payload - Данные для записи в userData
     */
    setTabUserData: (tabKey: string, payload: any) => void;

    /**
     * Проверяет наличие вкладки в панели вкладок.
     *
     * @param tab Вкладка для проверки.
     * @returns Признак наличия вкладки и найденный экземпляр вкладки.
     */
    isInTabBarFunc: (tab: Tab) => { isInTabBar: boolean; tabInstance: Tab | undefined };

    /**
     * Добавляет новую вкладку в панель вкладок.
     * Если вкладка уже существует, делает её активной.
     *
     * @param tab Вкладка для добавления.
     */
    addTabToTabBar: (tab: Tab) => void;

    /**
     * Удаляет вкладку из панели вкладок по `title` или `viewId`.
     * Автоматически переключает активную вкладку при удалении текущей.
     *
     * @param tabName Название или `viewId` вкладки для удаления.
     * @remarks
     * - Не удаляет последнюю вкладку.
     * - Не удаляет домашнюю вкладку (`homeView`).
     * - При удалении активной вкладки активирует соседнюю.
     */
    removeTabFromTabBar: (tabName: string) => void;

    /**
     * Обрабатывает клик по вкладке.
     * Активирует вкладку по `title`, иначе активирует `homeView`.
     *
     * @param tabName Название вкладки, по которой кликнули.
     */
    tabClick: (tabName: string) => void;

    /**
     * Возвращает экземпляр вкладки по её названию.
     *
     * @param title Название вкладки.
     * @returns Найденная вкладка или `undefined`.
     */
    getTabInstanceByTitle: (title: string) => Tab | undefined;
    /**
     * Изменение статуса поля isModified у вкладки по полю title
     * @param tabName Название вкладки
     * @param value Новое значение поля isModified (по умолчанию `false`)
     * @returns void
     */
    modifyTabByTabName: (tabName: string, value?: boolean) => void;
}

/**
 * Хук для базовых операций с вкладками (табами)
 *
 * @description Предоставляет все необходимые методы для управления вкладками:
 * добавление, удаление, переключение, модификация состояния (isModified)
 * @returns {Object} Объект с методами и состояниями для управления вкладками
 */
export const useTabsBaseOperations = (): UseTabsBaseOperationsReturn => {
    const { homeView, activeTab, tabs, setActiveTab, setTabs, resetTabState } = useTabsState();

    const getTabInstanceByTitle = (title: string) => {
        return tabs.value.find((x: Tab) => x.title === title);
    };

    const isInTabBarFunc = (tab: Tab) => {
        const tabsList = tabs.value;
        const isInTabBar = !!tabsList.find((x: Tab) => {
            if (x.extensionName && tab.extensionName) {
                return x.extensionName === tab.extensionName;
            }
            return x.title === tab.title;
        });
        const tabInstance: Tab | undefined = tabsList.find((x: Tab) => {
            if (tab.extensionName) {
                return x.extensionName === tab.extensionName;
            }
            return x.title === tab.title;
        });
        return { isInTabBar, tabInstance };
    };

    const addTabToTabBar = (tab: Tab) => {
        const { isInTabBar, tabInstance } = isInTabBarFunc(tab);
        if (!isInTabBar) {
            setTabs({ tabs: [...tabs.value, tab], activeTab: tab });
        } else {
            setActiveTab(tabInstance as Tab);
        }
    };

    const removeTabFromTabBar = (tabName: string) => {
        const currentTabs = tabs.value;

        if (currentTabs.length === 1) {
            return;
        } else if (tabName === homeView.title) {
            return;
        }

        const index: number = currentTabs.findIndex((x: Tab) => tabName === x.title || tabName === x.viewId);
        if (index === -1) return;

        const nextTabs = [...currentTabs];
        nextTabs.splice(index, 1);

        const isRemovingActive = activeTab.value.title === tabName;
        const nextActiveTab = isRemovingActive
            ? (nextTabs[Math.min(index, nextTabs.length - 1)] ?? nextTabs[0] ?? homeView)
            : activeTab.value;

        setTabs({ tabs: nextTabs, activeTab: nextActiveTab as Tab });

        if (!isRemovingActive) {
            const stillExists = nextTabs.some(x => x.viewId === (nextActiveTab as Tab).viewId);
            if (!stillExists) {
                setTabs({ tabs: nextTabs, activeTab: homeView });
            }
        }
    };

    const tabClick = (tabName: string) => {
        const foundTab: Tab | undefined = tabs.value.find((x: Tab) => tabName === x.title);
        if (foundTab) {
            setActiveTab(foundTab);
        } else {
            setActiveTab(homeView);
        }
    };

    const modifyTab = (tabName: string) => {
        const currentTabs = tabs.value;

        const updatedTabs = currentTabs.map((tab: Tab) =>
            tab.title === tabName ? { ...tab, isModified: !tab.isModified } : tab
        );

        const updatedActive = updatedTabs.find((tab: Tab) => tab.title === tabName) ?? (activeTab.value as Tab);

        setTabs({ tabs: updatedTabs, activeTab: updatedActive });
    };

    /**
     * Обновляет userData у вкладки по title или viewId.
     *
     * @function
     * @param {string} tabKey - Название вкладки (title) или её viewId
     * @param {any} payload - Данные для записи в userData
     */
    const setTabUserData = (tabKey: string, payload: any) => {
        const currentTabs = tabs.value;
        const targetTab = currentTabs.find((tab: Tab) => tab.title === tabKey || tab.viewId === tabKey);
        if (!targetTab) return;

        const updatedTabs = currentTabs.map((tab: Tab) =>
            tab.title === tabKey || tab.viewId === tabKey ? { ...tab, userData: payload } : tab
        );

        const updatedActive =
            activeTab.value.title === tabKey || activeTab.value.viewId === tabKey
                ? ({ ...activeTab.value, userData: payload } as Tab)
                : (activeTab.value as Tab);

        setTabs({ tabs: updatedTabs, activeTab: updatedActive });
    };

    /**
     * Изменение статуса поля isModified у вкладки по полю title
     * @param tabName Название вкладки
     * @param value(default: false) Новое значение поля isModified
     * @returns void
     */
    const modifyTabByTabName = (tabName: string, value: boolean = false) => {
        const currentTabs = tabs.value;
        const updateTabs = currentTabs.map((tab: Tab) => (tab.title === tabName ? { ...tab, isModified: value } : tab));
        setTabs({ tabs: updateTabs, activeTab: activeTab.value });
    };

    return {
        homeView,
        tabs,
        activeTab,
        setActiveTab,
        modifyTab,
        modifyTabByTabName,
        setTabUserData,
        setTabs,
        resetTabState,
        isInTabBarFunc,
        addTabToTabBar,
        removeTabFromTabBar,
        tabClick,
        getTabInstanceByTitle,
    };
};
