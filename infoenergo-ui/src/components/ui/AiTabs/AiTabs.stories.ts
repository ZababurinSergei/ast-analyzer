import AiTabs from '@/components/ui/AiTabs/AiTabs.vue';
import {
    withTabsProvider,
    withTabsAddition,
    withTabsModification,
    defaultSourceCode,
    additionDescription,
    additionSourceCode,
    modificationDescription,
    modificationSourceCode,
} from './stories';
import AiTabsMd from './AiTabs.md?raw';
import UseTabsBaseOperationsMd from './useTabsBaseOperations.md?raw';

export default {
    title: 'Компоненты/AiTabs',
    component: AiTabs,
    parameters: {
        docs: {
            description: {
                component: AiTabsMd,
            },
        },
    },
    tags: ['autodocs'],
};

export const Default = {
    decorators: [withTabsProvider({ initialCount: 2 })],
    parameters: {
        docs: {
            description: { story: UseTabsBaseOperationsMd },
            source: { code: defaultSourceCode },
        },
    },
};

export const Addition = {
    name: 'Добавление табов',
    decorators: [withTabsAddition()],
    parameters: {
        docs: {
            description: { story: additionDescription },
            source: { code: additionSourceCode },
        },
    },
};

export const Modification = {
    name: 'Модификация табов',
    decorators: [withTabsModification()],
    parameters: {
        docs: {
            description: { story: modificationDescription },
            source: { code: modificationSourceCode },
        },
    },
};
