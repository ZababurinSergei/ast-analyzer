import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useTabsScroll } from '@/composables/AiTabs/useTabsScroll';

describe('useTabsScroll', () => {
    const createContainer = () => {
        const container = document.createElement('div');
        const scrollBy = vi.fn();
        Object.defineProperty(container, 'scrollBy', {
            value: scrollBy,
            writable: true,
            configurable: true,
        });
        return { container, scrollBy };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('scrollRight вызывает scrollBy с положительным смещением', () => {
        const root = document.createElement('div');
        const { container, scrollBy } = createContainer();
        container.className = 'v-x-scroll';
        root.appendChild(container);

        const tabsRootRef = ref<HTMLElement | null>(root);
        const { scrollRight } = useTabsScroll(tabsRootRef);

        scrollRight();

        expect(scrollBy).toHaveBeenCalledTimes(1);
        expect(scrollBy).toHaveBeenCalledWith({ left: 50, behavior: 'smooth' });
    });

    it('scrollLeft вызывает scrollBy с отрицательным смещением', () => {
        const root = document.createElement('div');
        const { container, scrollBy } = createContainer();
        container.className = 'v-x-scroll';
        root.appendChild(container);

        const tabsRootRef = ref<HTMLElement | null>(root);
        const { scrollLeft } = useTabsScroll(tabsRootRef);

        scrollLeft();

        expect(scrollBy).toHaveBeenCalledTimes(1);
        expect(scrollBy).toHaveBeenCalledWith({ left: -50, behavior: 'smooth' });
    });

    it('Не падает, если tabsRootRef пустой', () => {
        const tabsRootRef = ref<HTMLElement | null>(null);
        const { scrollLeft, scrollRight } = useTabsScroll(tabsRootRef);

        expect(() => scrollLeft()).not.toThrow();
        expect(() => scrollRight()).not.toThrow();
    });

    it('Не вызывает scrollBy, если контейнер .v-x-scroll не найден', () => {
        const root = document.createElement('div');
        const { container, scrollBy } = createContainer();
        container.className = 'another-class';
        root.appendChild(container);

        const tabsRootRef = ref<HTMLElement | null>(root);
        const { scrollRight } = useTabsScroll(tabsRootRef);

        scrollRight();

        expect(scrollBy).not.toHaveBeenCalled();
    });
});
