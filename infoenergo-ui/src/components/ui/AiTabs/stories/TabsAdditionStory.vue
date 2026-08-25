<script setup lang="ts">
import { NButton } from 'naive-ui';
import { provide, ref } from 'vue';
import type { Tab } from '@/components/ui/AiTabs/types';
import AiTabs from '@/components/ui/AiTabs/AiTabs.vue';
import { TABS_API_KEY, useTabsBaseOperations } from '@/composables/AiTabs/useTabsBaseOperations';
import { createTab } from './helpers';

const tabsApi = useTabsBaseOperations();
provide(TABS_API_KEY, tabsApi);

const counter = ref(0);
for (let i = 0; i < 3; i++) {
    tabsApi.addTabToTabBar(createTab(`Таб ${i}`, `new-tab-${i}`, `new-tab-${i}`));
    counter.value = i + 1;
}

tabsApi.setActiveTab(tabsApi.tabs.value[0] as Tab);

const addTab = () => {
    const tab = createTab(`Таб ${counter.value}`, `new-tab-${counter.value}`, `new-tab-${counter.value}`);
    counter.value++;
    tabsApi.addTabToTabBar(tab);
};

const closeTab = (tabName: string) => {
    tabsApi.removeTabFromTabBar(tabName);
};
</script>

<template>
    <div style="display: flex; flex-direction: column; gap: 12px">
        <AiTabs
            @onDialogPositiveClick="closeTab"
            @onDialogNegativeClick="closeTab"
            @onDialogNeutralClick="() => {}"
        />
        <div style="display: flex; gap: 10px; margin-top: 10px">
            <n-button @click="addTab"> Добавить </n-button>
        </div>
    </div>
</template>
