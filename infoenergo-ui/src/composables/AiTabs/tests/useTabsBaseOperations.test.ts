import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTabsBaseOperations } from '@/composables/AiTabs/useTabsBaseOperations';
import type { Tab } from '@/components/ui/AiTabs/types';

describe('useTabsBaseOperations', () => {
    let tabsBase: ReturnType<typeof useTabsBaseOperations>;
    let mockTab: Tab;
    let mockTab2: Tab;

    beforeEach(() => {
        tabsBase = useTabsBaseOperations();
        mockTab = {
            title: 'Тестовая вкладка',
            viewId: 'test-view',
            routeName: 'test-route',
            isModified: false,
            userData: { id: 1 },
            isClosable: true,
        };
        mockTab2 = {
            title: 'Вкладка 2',
            viewId: 'view-2',
            routeName: 'route-2',
            isModified: false,
            userData: { id: 2 },
            isClosable: true,
        };
    });

    describe('isInTabBarFunc', () => {
        it('Возвращение false для новой вкладки', () => {
            const result = tabsBase.isInTabBarFunc(mockTab);

            expect(result.isInTabBar).toBe(false);
            expect(result.tabInstance).toBeUndefined();
        });

        it('Нахождение существующей вкладки по title', () => {
            tabsBase.addTabToTabBar(mockTab);

            const result = tabsBase.isInTabBarFunc(mockTab);

            expect(result.isInTabBar).toBe(true);
            expect(result.tabInstance).toBeDefined();
            expect(result.tabInstance?.title).toBe('Тестовая вкладка');
        });

        it('Нахождение вкладки по extensionName', () => {
            const tabWithExtension: Tab = {
                ...mockTab,
                extensionName: 'test-extension',
            };

            tabsBase.addTabToTabBar(tabWithExtension);

            const searchTab: Tab = {
                ...mockTab,
                extensionName: 'test-extension',
            };
            const result = tabsBase.isInTabBarFunc(searchTab);

            expect(result.isInTabBar).toBe(true);
            expect(result.tabInstance?.extensionName).toBe('test-extension');
        });
    });

    describe('getTabInstanceByTitle', () => {
        it('Возвращает undefined, когда вкладки с таким title нет', () => {
            const result = tabsBase.getTabInstanceByTitle('Несуществующая вкладка');

            expect(result).toBeUndefined();
        });

        it('Возвращает домашнюю вкладку по пустому title', () => {
            const result = tabsBase.getTabInstanceByTitle('');

            expect(result).toBeDefined();
            expect(result?.title).toBe('');
            expect(result?.viewId).toBe('home-view');
        });

        it('Возвращает вкладку по точному title после добавления', () => {
            tabsBase.addTabToTabBar(mockTab);

            const result = tabsBase.getTabInstanceByTitle('Тестовая вкладка');

            expect(result).toBeDefined();
            expect(result?.title).toBe('Тестовая вкладка');
            expect(result?.viewId).toBe('test-view');
        });

        it('Возвращает undefined для несуществующего title при наличии других вкладок', () => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);

            const result = tabsBase.getTabInstanceByTitle('Другая вкладка');

            expect(result).toBeUndefined();
        });

        it('Возвращает правильный экземпляр вкладки со всеми полями', () => {
            tabsBase.addTabToTabBar(mockTab);

            const result = tabsBase.getTabInstanceByTitle('Тестовая вкладка');

            expect(result).toEqual(
                expect.objectContaining({
                    title: 'Тестовая вкладка',
                    viewId: 'test-view',
                    routeName: 'test-route',
                    isModified: false,
                    isClosable: true,
                })
            );
            expect(result?.userData).toEqual({ id: 1 });
        });

        it('При нескольких вкладках возвращает именно вкладку с совпадающим title', () => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);

            const result1 = tabsBase.getTabInstanceByTitle('Тестовая вкладка');
            const result2 = tabsBase.getTabInstanceByTitle('Вкладка 2');

            expect(result1?.title).toBe('Тестовая вкладка');
            expect(result1?.viewId).toBe('test-view');
            expect(result2?.title).toBe('Вкладка 2');
            expect(result2?.viewId).toBe('view-2');
        });
    });

    describe('addTabToTabBar', () => {
        it('Добавление новой вкладки', () => {
            tabsBase.addTabToTabBar(mockTab);

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(2);
            expect(tabs[1]?.title).toBe('Тестовая вкладка');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Тестовая вкладка');
        });

        it('При попытке добавить дубликат, делает существующую вкладку активной', () => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);

            tabsBase.setActiveTab(mockTab2);

            tabsBase.addTabToTabBar(mockTab);

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(3);

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Тестовая вкладка');
        });

        it('Выброс ошибки при неудачном добавлении', () => {
            const originalSetTabs = tabsBase.setTabs;
            tabsBase.setTabs = vi.fn(() => {
                throw new Error('Test error');
            });

            expect(tabsBase.addTabToTabBar(mockTab)).toBeFalsy();

            tabsBase.setTabs = originalSetTabs;
        });
    });

    describe('removeTabFromTabBar', () => {
        beforeEach(() => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);
        });

        it('Удаление вкладки по названию', () => {
            tabsBase.removeTabFromTabBar('Тестовая вкладка');

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(2);
            expect(tabs[1]?.title).toBe('Вкладка 2');
        });

        it('Удаление вкладки по viewId', () => {
            tabsBase.removeTabFromTabBar('test-view');

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(2);
            expect(tabs[1]?.viewId).toBe('view-2');
        });

        it('Неизменность состония в случае если один таб', () => {
            tabsBase.removeTabFromTabBar(mockTab.title);
            tabsBase.removeTabFromTabBar(mockTab2.title);
            const tabs = tabsBase.tabs.value;
            tabsBase.removeTabFromTabBar('home-view');
            expect(tabs).toHaveLength(1);
        });
        it('Неизменность состояния при попытке удалить домашнюю вкладку', () => {
            tabsBase.removeTabFromTabBar(tabsBase.homeView.title);

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(3);
        });

        it('Переключение активной вкладки при удалении текущей', () => {
            tabsBase.setActiveTab(mockTab);

            tabsBase.removeTabFromTabBar('Тестовая вкладка');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Вкладка 2');
        });

        it('Переключение на предыдущую вкладку при удалении активной (последней в списке)', () => {
            tabsBase.setActiveTab(mockTab2);

            tabsBase.removeTabFromTabBar('Вкладка 2');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Тестовая вкладка');
        });

        it('Переключение на домашнюю вкладку при удалении последней', () => {
            tabsBase.removeTabFromTabBar('Тестовая вкладка');
            tabsBase.removeTabFromTabBar('Вкладка 2');

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(1);
            expect(tabs[0]?.title).toBe('');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('');
        });

        it('Неизменность состояния при попытке удалить несуществующую вкладку', () => {
            const tabsBefore = tabsBase.tabs.value.length;

            tabsBase.removeTabFromTabBar('несуществующая');

            const tabsAfter = tabsBase.tabs.value.length;
            expect(tabsAfter).toBe(tabsBefore);
        });

        it('При удалении активной вкладки по viewId переключает активную на домашнюю', () => {
            tabsBase.setActiveTab(mockTab);

            tabsBase.removeTabFromTabBar('test-view');

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(2);
            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.viewId).toBe('home-view');
            expect(activeTab.title).toBe('');
        });
    });

    describe('tabClick', () => {
        beforeEach(() => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);
        });

        it('Активация вкладки при клике', () => {
            tabsBase.tabClick('Вкладка 2');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Вкладка 2');
        });

        it('Активация домашней вкладки при клике по несуществующей', () => {
            tabsBase.tabClick('несуществующая');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('');
        });
    });

    describe('modifyTab', () => {
        beforeEach(() => {
            tabsBase.addTabToTabBar(mockTab);
        });

        it('Установка isModified в true', () => {
            tabsBase.modifyTab('Тестовая вкладка');

            const tabs = tabsBase.tabs.value;
            expect(tabs[1]?.isModified).toBe(true);
        });

        it('Переключение isModified обратно в false', () => {
            tabsBase.modifyTab('Тестовая вкладка');
            tabsBase.modifyTab('Тестовая вкладка');

            const tabs = tabsBase.tabs.value;
            expect(tabs[1]?.isModified).toBe(false);
        });

        it('Обновление активной вкладки если она модифицируется', () => {
            tabsBase.setActiveTab(mockTab);
            tabsBase.modifyTab('Тестовая вкладка');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.isModified).toBe(true);
        });

        it('Неизменность других вкладок', () => {
            tabsBase.addTabToTabBar(mockTab2);

            tabsBase.modifyTab('Тестовая вкладка');

            const tabs = tabsBase.tabs.value;
            expect(tabs[1]?.isModified).toBe(true);
            expect(tabs[2]?.isModified).toBe(false);
        });

        it('При вызове с несуществующим tabName активная вкладка не меняется', () => {
            tabsBase.setActiveTab(mockTab);

            tabsBase.modifyTab('Несуществующая вкладка');

            const activeTab = tabsBase.activeTab.value;
            expect(activeTab.title).toBe('Тестовая вкладка');
            const tabs = tabsBase.tabs.value;
            expect(tabs[1]?.isModified).toBe(false);
        });
    });

    describe('modifyTabByTabName', () => {
        beforeEach(() => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);
        });

        it('Устанавливает isModified в true для вкладки по title', () => {
            tabsBase.modifyTabByTabName('Тестовая вкладка', true);

            const tab = tabsBase.tabs.value.find(t => t.title === 'Тестовая вкладка');
            expect(tab?.isModified).toBe(true);
        });

        it('Устанавливает isModified в false для вкладки по title', () => {
            tabsBase.modifyTabByTabName('Тестовая вкладка', true);
            tabsBase.modifyTabByTabName('Тестовая вкладка', false);

            const tab = tabsBase.tabs.value.find(t => t.title === 'Тестовая вкладка');
            expect(tab?.isModified).toBe(false);
        });

        it('Без второго аргумента использует значение по умолчанию false и сбрасывает isModified', () => {
            tabsBase.modifyTabByTabName('Тестовая вкладка', true);

            tabsBase.modifyTabByTabName('Тестовая вкладка');

            const tab = tabsBase.tabs.value.find(t => t.title === 'Тестовая вкладка');
            expect(tab?.isModified).toBe(false);
        });

        it('Не изменяет другие вкладки', () => {
            tabsBase.modifyTabByTabName('Тестовая вкладка', true);

            const tab1 = tabsBase.tabs.value.find(t => t.title === 'Тестовая вкладка');
            const tab2 = tabsBase.tabs.value.find(t => t.title === 'Вкладка 2');
            expect(tab1?.isModified).toBe(true);
            expect(tab2?.isModified).toBe(false);
        });

        it('Не падает и не меняет список, если вкладка не найдена', () => {
            const beforeTabs = tabsBase.tabs.value.map(t => ({ ...t }));
            const beforeActive = { ...tabsBase.activeTab.value };

            expect(() => tabsBase.modifyTabByTabName('missing-tab', true)).not.toThrow();

            expect(tabsBase.tabs.value).toEqual(beforeTabs);
            expect(tabsBase.activeTab.value).toEqual(beforeActive);
        });

        it('Не меняет activeTab при изменении isModified (активная вкладка остаётся той же)', () => {
            tabsBase.setActiveTab(mockTab2);

            tabsBase.modifyTabByTabName('Тестовая вкладка', true);

            expect(tabsBase.activeTab.value.title).toBe('Вкладка 2');
        });
    });

    describe('setTabUserData', () => {
        beforeEach(() => {
            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);
        });

        it('Обновляет userData по title', () => {
            const payload = { status: 'updated-by-title', count: 10 };

            tabsBase.setTabUserData('Тестовая вкладка', payload);

            const updated = tabsBase.tabs.value.find(tab => tab.title === 'Тестовая вкладка');
            expect(updated?.userData).toEqual(payload);
        });

        it('Обновляет userData по viewId', () => {
            const payload = { status: 'updated-by-view-id', count: 20 };

            tabsBase.setTabUserData('view-2', payload);

            const updated = tabsBase.tabs.value.find(tab => tab.viewId === 'view-2');
            expect(updated?.userData).toEqual(payload);
        });

        it('Обновляет activeTab, если обновляется активная вкладка', () => {
            tabsBase.setActiveTab(mockTab2);
            const payload = { active: true };

            tabsBase.setTabUserData('Вкладка 2', payload);

            expect(tabsBase.activeTab.value.title).toBe('Вкладка 2');
            expect(tabsBase.activeTab.value.userData).toEqual(payload);
        });

        it('Не изменяет состояние, если вкладка не найдена', () => {
            const before = tabsBase.tabs.value.map(tab => ({ ...tab }));
            const beforeActive = { ...tabsBase.activeTab.value };

            tabsBase.setTabUserData('missing-tab', { should: 'not-apply' });

            expect(tabsBase.tabs.value).toEqual(before);
            expect(tabsBase.activeTab.value).toEqual(beforeActive);
        });
    });

    describe('tabs (computed)', () => {
        it('Возвращение актуального списка вкладок', () => {
            expect(tabsBase.tabs.value).toHaveLength(1);

            tabsBase.addTabToTabBar(mockTab);

            expect(tabsBase.tabs.value).toHaveLength(2);
            expect(tabsBase.tabs.value[1]?.title).toBe('Тестовая вкладка');
        });

        it('Обновление при изменении вкладок', () => {
            const initialTabs = tabsBase.tabs.value.length;

            tabsBase.addTabToTabBar(mockTab);

            expect(tabsBase.tabs.value.length).toBe(initialTabs + 1);
        });
    });

    describe('интеграционные тесты', () => {
        it('Корректная работа полного цикла: добавить → модифицировать → переключить → удалить', () => {
            tabsBase.addTabToTabBar(mockTab);
            expect(tabsBase.tabs.value).toHaveLength(2);
            expect(tabsBase.activeTab.value.title).toBe('Тестовая вкладка');

            tabsBase.modifyTab('Тестовая вкладка');
            expect(tabsBase.activeTab.value.isModified).toBe(true);

            tabsBase.addTabToTabBar(mockTab2);
            expect(tabsBase.tabs.value).toHaveLength(3);

            tabsBase.tabClick('Вкладка 2');
            expect(tabsBase.activeTab.value.title).toBe('Вкладка 2');

            tabsBase.removeTabFromTabBar('Тестовая вкладка');
            expect(tabsBase.tabs.value).toHaveLength(2);

            const remainingTabs = tabsBase.tabs.value.map(t => t.title);
            expect(remainingTabs).not.toContain('Тестовая вкладка');
        });

        it('Правильная обработка множества операций', () => {
            const tab3: Tab = { ...mockTab, title: 'Вкладка 3', viewId: 'view-3' };

            tabsBase.addTabToTabBar(mockTab);
            tabsBase.addTabToTabBar(mockTab2);
            tabsBase.addTabToTabBar(tab3);

            expect(tabsBase.tabs.value).toHaveLength(4);

            tabsBase.modifyTab('Тестовая вкладка');
            tabsBase.modifyTab('Вкладка 3');

            tabsBase.removeTabFromTabBar('Вкладка 2');

            const tabs = tabsBase.tabs.value;
            expect(tabs).toHaveLength(3);
            expect(tabs[1]?.isModified).toBe(true);
            expect(tabs[2]?.isModified).toBe(true);
        });
    });
});
