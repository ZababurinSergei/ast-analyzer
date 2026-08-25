
import AiContextMenu from '@/components/ui/AiContextMenu/AiContextMenu.vue';
import AiContextMenuExample from './AiContextMenuExample.vue';
import type { AiContextMenuProps } from '@/components/ui/AiContextMenu/types';

export default {
    title: 'Компоненты/AiContextMenu',
    component: AiContextMenu,
    tags: ['autodocs'],
};

export const Default = {
    args: {
        options: [
            { label: 'TEST', key: 'item' },
            { label: 'TEST 2', key: 'item2' },
            { label: 'TEST 3', key: 'item3' },
        ],
    },
    render: (args: AiContextMenuProps) => ({
        components: { AiContextMenuExample },
        template: '<AiContextMenuExample v-bind="args" />',
        setup() {
            return { args };
        },
    }),
};
