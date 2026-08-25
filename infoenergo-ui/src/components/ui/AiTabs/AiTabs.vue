<template>
    <div ref="tabsRootRef" class="ai-tabs-root">
        <n-tabs
            :value="activeTab.title"
            class="ai-tabs"
            closable
            tab-style="height: 29px;"
            type="card"
            @close="handleClose"
            @update-value="handleUpdate"
        >
            <n-tab
                v-for="panel in tabs"
                :key="panel.viewId"
                :name="panel?.title"
                :tab="panel?.title"
                :closable="panel?.isClosable ?? true"
            >
                <div @contextmenu.prevent="(e: MouseEvent) => handleContextMenu(e, panel)">
                    <AiHomeIcon v-if="!panel?.isClosable" />
                    <div v-else class="ai-tabs__tab-content">
                        <AiModifiedEllipse v-show="panel?.isModified" />
                        <span>{{ panel?.extensionName ?? panel?.title }}</span>
                    </div>
                </div>
            </n-tab>
            <template #prefix> <AiLeftTabsArrow @click="handleLeftArrowClick" /> </template>
            <template #suffix> <AiRightTabsArrow @click="handleRightArrowClick" /> </template>
        </n-tabs>
        <AiContextMenu
            ref="contextMenuRef"
            :options="DEFAULT_AI_TABS_CONTEXT_MENU_OPTIONS"
            @contextMenuSelect="handleContextMenuSelect"
        />
    </div>
</template>

<script lang="ts" setup>
import AiHomeIcon from '@/components/icons/AiHomeIcon.vue';
import AiModifiedEllipse from '@/components/icons/AiModifiedEllipse.vue';
import AiLeftTabsArrow from '@/components/icons/AiLeftTabsArrow.vue';
import AiRightTabsArrow from '@/components/icons/AiRightTabsArrow.vue';
import AiContextMenu from '@/components/ui/AiContextMenu/AiContextMenu.vue';
import { NTab, NTabs } from 'naive-ui';
import { inject, ref } from 'vue';
import { TABS_API_KEY } from '@/composables/AiTabs/useTabsBaseOperations';
import { useTabsScroll } from '@/composables/AiTabs/useTabsScroll';
import type { Tab } from '@/components/ui/AiTabs/types';
import { useDialog } from '@/composables/AiDialog/useDialog';
import type { ContextMenuPayload } from '@/composables/AiContextMenu/types';
import { DEFAULT_AI_TABS_CONTEXT_MENU_OPTIONS } from './defaults';
import type { AiTabsEmits, UseTabsBaseOperationsReturn } from './types';

const tabsApi = inject<UseTabsBaseOperationsReturn>(TABS_API_KEY) as UseTabsBaseOperationsReturn;
const tabsRootRef = ref<HTMLElement | null>(null);
const contextMenuRef = ref<InstanceType<typeof AiContextMenu> | null>(null);
const pendingCloseTabName = ref<string | null>(null);
const { scrollLeft, scrollRight } = useTabsScroll(tabsRootRef);
const { tabs, activeTab, tabClick, removeTabFromTabBar, getTabInstanceByTitle } = tabsApi;
const dialog = useDialog();
const handleContextMenu = (e: MouseEvent, panel: Tab) => {
    contextMenuRef.value?.openContextMenu(e, { tabName: panel.title, viewId: panel.viewId });
};

const handleContextMenuSelect = (key: string, payload: ContextMenuPayload) => {
    switch (key) {
        case 'close-all-tabs':
            emit('closeAllTabs');
            break;
        case 'close-all-except-current':
            emit('closeAllExceptCurrent', payload.tabName);
            break;
    }
};
const emit = defineEmits<AiTabsEmits>();

const handleLeftArrowClick = () => {
    scrollLeft();
};

const handleRightArrowClick = () => {
    scrollRight();
};

const handleClose = async (name: string) => {
    if (getTabInstanceByTitle(name)?.isModified) {
        pendingCloseTabName.value = name;
        const choice = await dialog.show({
            title: 'Подтвердите действие',
            content: 'В закрывающейся вкладке есть несохраненные изменения. Сохранить изменения?',
            positiveText: 'Да',
            negativeText: 'Нет',
            neutralText: 'Отмена',
        });

        if (choice === 'positive') onDialogPositiveClick();
        else if (choice === 'negative') onDialogNegativeClick();
        else if (choice === 'neutral') onDialogNeutralClick();
    } else {
        removeTabFromTabBar(name);
        emit('closeTab', name);
    }
};

const handleUpdate = async (tabName: string) => {
    tabClick(tabName);
    emit('focusTab', tabName);
};

const onDialogPositiveClick = () => {
    const name = pendingCloseTabName.value;
    if (!name) return;
    emit('onDialogPositiveClick', name);
    pendingCloseTabName.value = null;
};

const onDialogNegativeClick = () => {
    const name = pendingCloseTabName.value;
    if (!name) return;
    emit('onDialogNegativeClick', name);
    pendingCloseTabName.value = null;
};

const onDialogNeutralClick = () => {
    const name = pendingCloseTabName.value;
    if (!name) return;
    emit('onDialogNeutralClick', name);
    pendingCloseTabName.value = null;
};
</script>

<style scoped lang="scss">
.ai-tabs-root {
    margin: 0 20px;
}

.ai-tabs {
    &__tab-content {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    :deep(.n-tabs-tab) {
        transition: none !important;
        border-radius: 3px !important;
        padding: 0 10px !important;

        &:hover {
            background: var(--light-gray-100);
            color: var(--blue-700);
        }

        &:active {
            background: var(--light-gray-700);
            color: var(--blue-700);
        }

        &:has(.ai-home-flag) {
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 3px;
            padding: 0 !important;
            margin: 0 !important;
        }
    }

    :deep(.n-tabs-tab--active) {
        background: var(--blue-700) !important;
        color: var(--white) !important;

        &:hover {
            background: var(--blue-800) !important;
        }

        &:active {
            background: var(--blue-900) !important;
        }

        > .n-tabs .n-tabs-tab .n-tabs-tab__close {
            background: var(--blue-700) !important;
        }

        .n-tabs-tab__close {
            svg {
                color: var(--white) !important;
            }
        }

        .ai-home-rect {
            fill: none;
        }

        .ai-home-rect:hover {
            fill: var(--blue-800);
        }

        .ai-home-rect:active {
            fill: var(--blue-900);
        }

        .ai-home-icon {
            fill: var(--white);
        }
    }
}

:deep(.n-tabs .n-tabs-nav.n-tabs-nav--top.n-tabs-nav--card-type .n-tabs-tab-pad) {
    background: none !important;
    width: 8px;
    border: none !important;
}
</style>
