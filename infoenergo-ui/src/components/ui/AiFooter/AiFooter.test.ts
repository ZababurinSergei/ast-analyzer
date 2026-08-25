import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { NConfigProvider } from 'naive-ui';
import { h } from 'vue';

import AiFooter from '@/components/ui/AiFooter/AiFooter.vue';

const mountFooter = (props: Record<string, unknown> = {}) =>
    mount(NConfigProvider, {
        slots: {
            default: () =>
                h(AiFooter, {
                    selectedCount: 2,
                    totalCount: 10,
                    ...props,
                }),
        },
    });

describe('AiFooter', () => {
    it('отображает счётчики выбранных и общего количества', () => {
        const wrapper = mountFooter();

        expect(wrapper.text()).toContain('Выбрано элементов: 2');
        expect(wrapper.text()).toContain('Всего элементов: 10');
    });

    it('скрывает счётчик выбранных при showSelectionCount=false', () => {
        const wrapper = mountFooter({ showSelectionCount: false });

        expect(wrapper.text()).not.toContain('Выбрано элементов');
        expect(wrapper.text()).toContain('Всего элементов: 10');
    });

    it('эмитит create-filter при клике на кнопку', async () => {
        const wrapper = mountFooter();
        const footer = wrapper.findComponent(AiFooter);

        await footer.find('.ai-footer__create-filter').trigger('click');

        expect(footer.emitted('create-filter')).toHaveLength(1);
    });
});
