import { defineAsyncComponent } from 'vue';
import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { NConfigProvider } from 'naive-ui';
import AiAppProviders from '@/components/ui/common/AiAppProviders.vue';

setup(app => {
    app.component('NConfigProvider', NConfigProvider);
    app.component('OneColumnTable', defineAsyncComponent(() => import('@/components/ui/AiDataTable/examples/OneColumnTable.vue')));
});

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        a11y: {
            test: 'todo',
        },
        tags: ['autodocs'],
    },
    decorators: [
        story => ({
            components: { story, AiAppProviders },
            template: `
                <AiAppProviders> 
                    <story />
                </AiAppProviders>`,
        }),
    ],
};

export default preview;
