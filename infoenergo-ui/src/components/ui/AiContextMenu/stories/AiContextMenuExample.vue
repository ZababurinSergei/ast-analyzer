<template>
    <div @contextmenu.prevent="handleContextMenu">
        <n-button>
            Нажмите правой кнопкой мыши
            <AiContextMenu
                ref="contextMenuRef"
                :options="props.options"
                @context-menu-select="handleContextMenuSelect"
            />
        </n-button>
    </div>
</template>

<script setup lang="ts">
import AiContextMenu from '@/components/ui/AiContextMenu/AiContextMenu.vue';
import { NButton, useMessage } from 'naive-ui';
import { ref } from 'vue';
import type { ContextMenuPayload } from '@/composables/AiContextMenu/types';
import type { AiContextMenuProps } from '@/components/ui/AiContextMenu/types';

const contextMenuRef = ref<InstanceType<typeof AiContextMenu> | null>(null);
const message = useMessage();

const props = defineProps<AiContextMenuProps>();

const handleContextMenu = (e: MouseEvent) => {
    contextMenuRef.value?.openContextMenu(e);
};

const handleContextMenuSelect = (name: string, key: string, payload: ContextMenuPayload) => {
    message.info(`Название пункта: ${name} Ключ: ${key} Payload: ${payload}`);
};
</script>
