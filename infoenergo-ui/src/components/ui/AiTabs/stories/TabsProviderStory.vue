<script setup lang="ts">
import { provide } from 'vue';
import AiTabs from '@/components/ui/AiTabs/AiTabs.vue';
import { TABS_API_KEY, useTabsBaseOperations } from '@/composables/AiTabs/useTabsBaseOperations';
import { addInitialTabs } from './helpers';

interface Props {
    initialCount?: number;
    prefix?: { title?: string; id?: string };
}

const props = withDefaults(defineProps<Props>(), {
    initialCount: 2,
});

const tabsApi = useTabsBaseOperations();
provide(TABS_API_KEY, tabsApi);
addInitialTabs(tabsApi, props.initialCount, props.prefix);

const closeTab = (tabName: string) => {
    tabsApi.removeTabFromTabBar(tabName);
};
</script>

<template>
    <AiTabs
        @onDialogPositiveClick="closeTab"
        @onDialogNegativeClick="closeTab"
        @onDialogNeutralClick="() => {}"
    />
</template>
