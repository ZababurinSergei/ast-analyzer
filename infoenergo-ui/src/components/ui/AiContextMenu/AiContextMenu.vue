<template>
    <n-dropdown
        placement="bottom-start"
        trigger="manual"
        :x="xCoordinate"
        :y="yCoordinate"
        :options="props.options"
        :show="show"
        size="small"
        @clickoutside="close"
        @select="handleSelect"
    />
</template>
<script setup lang="ts">
import { NDropdown, type DropdownOption } from 'naive-ui';
import { useContextMenuState } from '@/composables/AiContextMenu/useContextMenuState';
import type { AiContextMenuProps, AiContextMenuEmits } from './types';

const { show, xCoordinate, yCoordinate, payload, openContextMenu, closeContextMenu } = useContextMenuState();

const props = withDefaults(defineProps<AiContextMenuProps>(), {
    options: () => [],
});

const emit = defineEmits<AiContextMenuEmits>();

const close = () => {
    closeContextMenu();
    emit('close');
};

const handleSelect = (key: string, option: DropdownOption) => {
    closeContextMenu();
    const name = String(option.label);
    emit('contextMenuSelect', name, key, payload.value );
};

defineExpose({ openContextMenu, closeContextMenu });
</script>
