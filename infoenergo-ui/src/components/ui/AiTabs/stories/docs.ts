/**
 * Параметры docs для сторис AiTabs (исходный код в документации и описания).
 */

export const defaultSourceCode = `
<script setup>
import { AiTabs } from './components'
import { useTabsBaseOperations } from './composables'

const tabsApi = useTabsBaseOperations()
provide(TABS_API_KEY, tabsApi)

for (let i = 1; i <= 3; i++) {
    tabsApi.addTabToTabBar({
        title: \`Таб \${i}\`,
        viewId: \`tab-\${i}\`,
        routeName: \`tab-\${i}\`,
        isModified: false,
        userData: {},
        isClosable: true,
    })
}
tabsApi.setActiveTab(tabsApi.tabs.value[0])
</script>

<template>
<AiTabs />
</template>
`;

export const additionDescription =
    '**Добавление табов осуществляется с помощью функции:**\n\n' +
    '```ts\n' +
    'addTabToTabBar(tab: Tab)\n' +
    '```\n\n' +
    'Функция по аргументу *tab*, проверяет наличие таба в массиве всех табов по полю **title** или **viewId**, в случае если таб уже существует, то делает его активной, в противном случае добавляет его в массив всех табов и делает его активным.';

export const additionSourceCode = `
<script setup>
const tabsApi = useTabsBaseOperations();
provide(TABS_API_KEY, tabsApi);
const counter = ref(0);
for (let i = 0; i < 3; i++) {
    tabsApi.addTabToTabBar(createTab(\`Таб \${i}\`, \`new-tab-\${i}\`, \`new-tab-\${i}\`));
    counter.value = i + 1;
}
const addTab = () => {
    const tab = createTab(\`Таб \${counter.value}\`, \`new-tab-\${counter.value}\`, \`new-tab-\${counter.value}\`);
    counter.value++;
    tabsApi.addTabToTabBar(tab);
};
tabsApi.setActiveTab(tabsApi.tabs.value[0]);
return { addTab };
</script>

<template>
<div style="display: flex; flex-direction: column; gap: 12px;">
    <AiTabs />
    <div style="display: flex; gap: 10px; margin-top: 10px">
        <n-button @click="addTab"> Добавить </n-button>
    </div>
</div>
</template>
`;

export const modificationDescription =
    '**Модификация табов осуществляется использованием функции:**\n\n' +
    '```ts\n' +
    'modifyTab(tabName: string)\n' +
    '```\n\n' +
    'Функция `modifyTab(tabName)` принимает строку *tabName*, которая должна совпадать со значением `title` нужной вкладки. Далее она находит вкладку с `tab.title === tabName` и изменяет её состояние “модифицирована/не модифицирована”, записывая в `isModified` противоположное значение (`false → true` или `true → false`).';

export const modificationSourceCode = `
<script setup>
const tabsApi = useTabsBaseOperations();
provide(TABS_API_KEY, tabsApi);
addInitialTabs(tabsApi, 3);
const modTab = () => {
    const tab = tabsApi.activeTab.value;
    if (tab) {
        tabsApi.modifyTab(tab.title);
        tabsApi.setActiveTab(tab);
    }
};
tabsApi.setActiveTab(tabsApi.tabs.value[0]);
return { modTab };
</script>

<template>
<div style="display: flex; flex-direction: column; gap: 12px;">
    <AiTabs />
    <div style="display: flex; gap: 10px; margin-top: 10px">
        <n-button @click="modTab"> Модифицировать </n-button>
    </div>
</div>
</template>
`;
