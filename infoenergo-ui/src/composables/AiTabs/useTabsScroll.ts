import type { Ref } from 'vue';

const TABS_SCROLL_STEP: number = 50;

/**
 * Хук для управления горизонтальным скроллом панели вкладок.
 *
 * @description
 * Используется в компоненте табов для прокрутки заголовков вкладок
 * по клику на стрелки влево/вправо.
 *
 * @param {Ref<HTMLElement | null>} tabsRootRef - Ref на корневой DOM-элемент с n-tabs.
 * @returns {Object} Методы управления скроллом.
 * @returns {Function} returns.scrollLeft - Прокрутка панели вкладок влево.
 * @returns {Function} returns.scrollRight - Прокрутка панели вкладок вправо.
 */
export const useTabsScroll = (tabsRootRef: Ref<HTMLElement | null>) => {
    /**
     * Возвращает DOM-контейнер горизонтального скролла табов.
     *
     * @returns {HTMLElement | null} Контейнер скролла или null.
     */
    const getTabsScrollContainer = () => {
        return tabsRootRef.value?.querySelector('.v-x-scroll') as HTMLElement | null;
    };

    /**
     * Прокручивает панель вкладок влево на фиксированный шаг.
     */
    const scrollLeft = () => {
        const container = getTabsScrollContainer();
        if (container) {
            container.scrollBy({ left: -TABS_SCROLL_STEP, behavior: 'smooth' });
        }
    };

    /**
     * Прокручивает панель вкладок вправо на фиксированный шаг.
     */
    const scrollRight = () => {
        const container = getTabsScrollContainer();
        if (container) {
            container.scrollBy({ left: TABS_SCROLL_STEP, behavior: 'smooth' });
        }
    };

    return {
        scrollLeft,
        scrollRight,
    };
};
