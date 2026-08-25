import type { Tab, TabState } from '../../components/ui/AiTabs/types';
import { computed, reactive, readonly, type ComputedRef } from 'vue';

/**
 * Создает и управляет состоянием вкладок (табов)
 *
 * @description Хук для управления состоянием табов в приложении. Предоставляет методы
 * для работы с активным табом, списком табов и их состояниями.
 *
 * @returns {Object} Объект с методами управления состоянием табов
 */
export interface UseTabsStateReturn {
    /**
     * Домашняя вкладка, которая всегда присутствует и не может быть закрыта.
     */
    homeView: Tab;

    /**
     * Текущий активный таб (реактивное поле, только для чтения).
     */
    activeTab: ComputedRef<Readonly<Tab>>;

    /**
     * Массив всех табов (реактивное поле, только для чтения).
     */
    tabs: ComputedRef<readonly Readonly<Tab>[]>;

    /**
     * Устанавливает новый активный таб.
     *
     * @param tab Таб, который нужно сделать активным.
     */
    setActiveTab: (tab: Tab) => void;

    /**
     * Полностью заменяет состояние табов на переданное значение `newTabs`.
     *
     * @param newTabs Новое состояние вкладок (список и активная вкладка).
     */
    setTabs: (newTabs: TabState) => void;

    /**
     * Сбрасывает состояние табов на начальное значение.
     * Оставляет только `homeView` и делает её активной.
     */
    resetTabState: () => void;
}

export const useTabsState = (): UseTabsStateReturn => {
    const homeView: Tab = {
        title: '',
        viewId: 'home-view',
        routeName: 'home-view',
        isModified: false,
        userData: {},
        isClosable: false,
    };

    const state: TabState = reactive<TabState>({
        activeTab: homeView,
        tabs: [homeView],
    });

    const activeTab = computed(() => readonly(state.activeTab));

    const setActiveTab = (tab: Tab): void => {
        state.activeTab = tab;
    };

    const tabs = computed(() => readonly(state.tabs));

    const setTabs = (newTabs: TabState) => {
        state.tabs = newTabs.tabs;
        state.activeTab = newTabs.activeTab;
    };

    const resetTabState = () => {
        state.tabs = [homeView];
        state.activeTab = homeView;
    };

    return {
        homeView,
        activeTab,
        tabs,
        setActiveTab,
        setTabs,
        resetTabState,
    };
};
