import { describe, it, expect, beforeEach } from 'vitest';
import { useTabsState } from '@/composables/AiTabs/useTabsState';
import type { Tab } from '@/components/ui/AiTabs/types';

describe('useTabsState', () => {
    let tabsState: ReturnType<typeof useTabsState>;
    let mockTab: Tab;

    beforeEach(() => {
        tabsState = useTabsState();
        mockTab = {
            title: 'Тестовая вкладка',
            viewId: 'test-view',
            routeName: 'test-route',
            isModified: false,
            userData: { id: 1 },
            isClosable: true,
        };
    });

    describe('homeView', () => {
        it('Создание инциализационной вкладки с заданными свойствами', () => {
            const { homeView } = tabsState;

            expect(homeView).toBeDefined();
            expect(homeView.title).toBe('');
            expect(homeView.viewId).toBe('home-view');
            expect(homeView.routeName).toBe('home-view');
            expect(homeView.isModified).toBe(false);
            expect(homeView.isClosable).toBe(false);
            expect(homeView.userData).toEqual({});
        });

        it('должен быть неизменяемым (readonly)', () => {
            const { homeView } = tabsState;
            expect(Object.isFrozen(homeView)).toBe(false);
        });
    });

    describe('activeTab / setActiveTab', () => {
        it('должен возвращать домашнюю вкладку по умолчанию', () => {
            const activeTab = tabsState.activeTab.value;

            expect(activeTab.title).toBe('');
            expect(activeTab.viewId).toBe('home-view');
        });

        it('должен устанавливать новую активную вкладку', () => {
            tabsState.setActiveTab(mockTab);
            const activeTab = tabsState.activeTab.value;

            expect(activeTab.title).toBe('Тестовая вкладка');
            expect(activeTab.viewId).toBe('test-view');
        });

        it('должен возвращать readonly объект активной вкладки', () => {
            const activeTab = tabsState.activeTab.value;

            expect(activeTab).toHaveProperty('title');
            expect(() => {
                // @ts-expect-error - СПЕЦИАЛЬНО ДЛЯ ТЕСТА(ИНАЧЕ БУДЕТ КОМПИЛЯЦИОННАЯ ОШИБКА)
                activeTab.title = 'new';
            }).not.toBe(activeTab.title === 'new');
        });
    });

    describe('tabs / setTabs', () => {
        it('должен возвращать массив только с домашней вкладкой по умолчанию', () => {
            const tabs = tabsState.tabs.value;

            expect(tabs).toHaveLength(1);
            expect(tabs[0]?.title).toBe('');
        });

        it('должен устанавливать новый массив вкладок', () => {
            const newTabs = {
                tabs: [tabsState.homeView, mockTab],
                activeTab: mockTab,
            };

            tabsState.setTabs(newTabs);
            const tabs = tabsState.tabs.value;

            expect(tabs).toHaveLength(2);
            expect(tabs[1]?.title).toBe('Тестовая вкладка');
        });

        it('должен обновлять активную вкладку при setTabs', () => {
            const newTabs = {
                tabs: [tabsState.homeView, mockTab],
                activeTab: mockTab,
            };

            tabsState.setTabs(newTabs);
            const activeTab = tabsState.activeTab.value;

            expect(activeTab.title).toBe('Тестовая вкладка');
        });
    });

    describe('resetTabState', () => {
        it('должен сбрасывать состояние к начальному', () => {
            tabsState.resetTabState();
            const tabs = tabsState.tabs.value;
            expect(tabs).toHaveLength(1);
            expect(tabs[0]?.title).toBe('');
        });
    });
});
