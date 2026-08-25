## useTabsBaseOperations: API

Ниже перечислены состояния и методы, которые возвращает `useTabsBaseOperations`.

### Пример подключения (единственный экземпляр API)

```ts
/**
 * Единый экземпляр API табов.
 *
 * Можно использовать для `provide(TABS_API_KEY, TABS_API)` в корневом компоненте/layout,
 * а также импортировать в других модулях (роутер, сервисы, утилиты), где нельзя/неудобно делать `inject`.
 */
/** @type {import('@infoenergo/infoenergo-ui').UseTabsBaseOperationsReturn} */
export const TABS_API = useTabsBaseOperations();

// Далее используем ИМЕННО ЭТОТ ГЕТТЕР
export const getTabsApi = () => TABS_API;
```

### Состояния

- `homeView`: домашняя вкладка (всегда существует и не закрывается).
- `tabs`: список вкладок (readonly).
- `activeTab`: текущая активная вкладка (readonly).

### Примеры аргументов/объектов

```ts
const tabExample: Tab = {
    title: 'Профиль',
    viewId: 'profile-1',
    routeName: 'profile',
    routePath: '/profile/1',
    isModified: false,
    userData: { form: { firstName: 'Иван' } },
    isClosable: true,
    params: { id: 1 },
    extensionName: null,
};

const tabStateExample: TabState = {
    tabs: [tabExample],
    activeTab: tabExample,
};
```

### Методы

**setActiveTab**

Устанавливает активную вкладку.

```ts
setActiveTab(tab: Tab): void
```

**Пример:**

```ts
tabsApi.setActiveTab(tabExample);
```

**setTabs**

Полностью заменяет состояние вкладок.

```ts
setTabs(newTabs: TabState): void
```

**Пример:**

```ts
tabsApi.setTabs(tabStateExample);
```

**resetTabState**

Сбрасывает состояние вкладок на начальное (оставляет только `homeView` и делает её активной).

```ts
resetTabState(): void
```

**Пример:**

```ts
tabsApi.resetTabState();
```

**modifyTab**

Изменяет статус модификации вкладки: переключает флаг `isModified` (true/false) у вкладки по её названию.

```ts
modifyTab(tabName: string): void
```

**Пример аргумента:** `tabName = "Профиль"`

**Пример:**

```ts
tabsApi.modifyTab('Профиль');
```

**modifyTabByTabName**

Изменяет статус модификации вкладки по tabName - поле title: переключает флаг `isModified` (true/false) у вкладки по её названию на переданное value - boolean (value поле опциональное - по умолчанию если значение не передается, то подставляется false).

```ts
modifyTabByTabName(tabName: string, value?: boolean): void
```

**Пример аргумента:** `tabName = "Профиль"`

**Пример:**

```ts
// Значение isModified меняется на true
tabsApi.modifyTabByTabName('Профиль', true);

// Значение isModified меняется на false
tabsApi.modifyTabByTabName('Профиль');
```

**setTabUserData**

Обновляет `userData` у вкладки по `title` или `viewId`.

```ts
setTabUserData(tabKey: string, payload: any): void
```

**Пример аргументов:**

- `tabKey`: `"Профиль"` (или `"profile-1"`)
- `payload`: `{ form: { firstName: "Иван" }, filters: { activeOnly: true } }`

**Пример:**

```ts
tabsApi.setTabUserData('Профиль', { form: { firstName: 'Иван' }, filters: { activeOnly: true } });
```

**isInTabBarFunc**

Проверяет наличие вкладки в панели вкладок и возвращает найденный экземпляр.

```ts
isInTabBarFunc(tab: Tab): { isInTabBar: boolean; tabInstance: Tab | undefined }
```

**Пример:**

```ts
const { isInTabBar, tabInstance } = tabsApi.isInTabBarFunc(tabExample);
```

**addTabToTabBar**

Добавляет новую вкладку в панель; если вкладка уже существует — делает её активной.

```ts
addTabToTabBar(tab: Tab): void
```

**Пример:**

```ts
tabsApi.addTabToTabBar(tabExample);
```

**removeTabFromTabBar**

Удаляет вкладку по `title` или `viewId` и при необходимости переключает активную (не удаляет последнюю и `homeView`).

```ts
removeTabFromTabBar(tabName: string): void
```

**Пример аргумента:** `tabName = "profile-1"` (можно также `"Профиль"`)

**Пример:**

```ts
tabsApi.removeTabFromTabBar('profile-1');
```

**tabClick**

Обрабатывает клик по вкладке: активирует вкладку по `title`, иначе активирует `homeView`.

```ts
tabClick(tabName: string): void
```

**Пример:**

```ts
tabsApi.tabClick('Профиль');
```

**getTabInstanceByTitle**

Возвращает экземпляр вкладки по её названию.

```ts
getTabInstanceByTitle(title: string): Tab | undefined
```

**Пример:**

```ts
const tab = tabsApi.getTabInstanceByTitle('Профиль');
```
