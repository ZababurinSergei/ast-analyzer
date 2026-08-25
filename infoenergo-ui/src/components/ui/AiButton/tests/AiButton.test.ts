import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import AiButton from '../AiButton.vue';

const IconStub = defineComponent({
    name: 'IconStub',
    template: '<svg data-testid="icon-stub" />',
});

const getButton = (wrapper: ReturnType<typeof mount>) => wrapper.find('.ai-button');

describe('AiButton', () => {
    it('рендерит переданный текст', () => {
        const wrapper = mount(AiButton, {
            props: { text: 'Подтвердить' },
        });

        expect(wrapper.text()).toContain('Подтвердить');
    });

    it('проставляет title из hint', () => {
        const wrapper = mount(AiButton, {
            props: { text: 'OK', hint: 'Подсказка' },
        });

        expect(getButton(wrapper).attributes('title')).toBe('Подсказка');
    });

    it('в режиме default при клике эмитит click без аргументов', async () => {
        const wrapper = mount(AiButton, {
            props: { text: 'Действие' },
        });

        await getButton(wrapper).trigger('click');

        expect(wrapper.emitted('click')).toBeTruthy();
        expect(wrapper.emitted('click')?.[0]).toEqual([]);
    });

    it('в режиме choice при клике эмитит click с option', async () => {
        const wrapper = mount(AiButton, {
            props: {
                mode: 'choice',
                option: 'negative',
                text: 'Нет',
            },
        });

        await getButton(wrapper).trigger('click');

        expect(wrapper.emitted('click')?.[0]).toEqual(['negative']);
    });

    it('при disabled не эмитит click', async () => {
        const wrapper = mount(AiButton, {
            props: { text: 'Неактивна', disabled: true },
        });

        await getButton(wrapper).trigger('click');

        expect(wrapper.emitted('click')).toBeFalsy();
    });

    it('для buttonType icon добавляет класс ai-icon-button', () => {
        const wrapper = mount(AiButton, {
            props: {
                buttonType: 'icon',
                icon: IconStub,
            },
        });

        expect(getButton(wrapper).classes()).toContain('ai-icon-button');
    });

    it('рендерит иконку из prop icon', () => {
        const wrapper = mount(AiButton, {
            props: {
                buttonType: 'icon',
                icon: IconStub,
            },
        });

        expect(wrapper.find('[data-testid="icon-stub"]').exists()).toBe(true);
    });
});
