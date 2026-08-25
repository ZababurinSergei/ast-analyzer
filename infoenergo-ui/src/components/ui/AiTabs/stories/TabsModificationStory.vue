<script setup lang="ts">
import { NButton } from 'naive-ui';
import { provide } from 'vue';
import type { Tab } from '@/components/ui/AiTabs/types';
import AiTabs from '@/components/ui/AiTabs/AiTabs.vue';
import { TABS_API_KEY, useTabsBaseOperations } from '@/composables/AiTabs/useTabsBaseOperations';
import { addInitialTabs } from './helpers';

const tabsApi = useTabsBaseOperations();
provide(TABS_API_KEY, tabsApi);
addInitialTabs(tabsApi, 3);
tabsApi.setActiveTab(tabsApi.tabs.value[0] as Tab);

const modTab = () => {
    const tab = tabsApi.activeTab.value as Tab;
    if (tab) {
        tabsApi.modifyTab(tab.title);
        tabsApi.setActiveTab(tab);
    }
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
            <n-button @click="modTab"> Модифицировать </n-button>
        </div>
    </div>
</template>
