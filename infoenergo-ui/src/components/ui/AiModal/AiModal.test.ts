import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type * as NaiveUi from 'naive-ui';
import AiModal from '@/components/ui/AiModal/AiModal.vue';

vi.mock('naive-ui', async importOriginal => {
    const mod = await importOriginal<typeof NaiveUi>();

    const NModalStub = defineComponent({
        name: 'NModal',
        props: {
            show: { type: Boolean, default: false },
            autoFocus: { type: Boolean, default: undefined },
            maskClosable: { type: Boolean, default: undefined },
            draggable: { type: Boolean, default: undefined },
        },
        emits: ['update:show', 'close'],
        template: `
            <div class="n-modal-stub" :data-show="String(show)">
                <button class="emit-update-show" @click="$emit('update:show', false)">hide</button>
                <button class="emit-close" @click="$emit('close')">close</button>
                <div class="slot-header"><slot name="header" /></div>
                <div class="slot-header-extra"><slot name="header-extra" /></div>
                <div class="slot-default"><slot /></div>
                <div class="slot-footer"><slot name="footer" /></div>
            </div>
        `,
    });

    const NFlexStub = defineComponent({
        name: 'NFlex',
        template: '<div class="n-flex-stub"><slot /></div>',
    });

    const NTextStub = defineComponent({
        name: 'NText',
        template: '<span class="n-text-stub"><slot /></span>',
    });

    return {
        ...mod,
        NModal: NModalStub,
        NFlex: NFlexStub,
        NText: NTextStub,
    };
});

describe('AiModal', () => {
    const mountModal = (config: Record<string, unknown> = {}) =>
        mount(AiModal, {
            props: {
                title: 'Тестовое окно',
                show: true,
                config,
            },
            slots: {
                default: '<div class="inside-content">Контент</div>',
                header: '<div class="inside-header">Header slot</div>',
                'header-extra': '<div class="inside-header-extra">Header extra slot</div>',
                footer: '<div class="inside-footer">Footer slot</div>',
            },
        });

    it('рендерит заголовок и все слоты', () => {
        const wrapper = mountModal();

        expect(wrapper.text()).toContain('Тестовое окно');
        expect(wrapper.find('.inside-content').exists()).toBe(true);
        expect(wrapper.find('.inside-header').exists()).toBe(true);
        expect(wrapper.find('.inside-header-extra').exists()).toBe(true);
        expect(wrapper.find('.inside-footer').exists()).toBe(true);
    });

    it('прокидывает update:show из NModal наружу', async () => {
        const wrapper = mountModal();

        await wrapper.find('.emit-update-show').trigger('click');

        expect(wrapper.emitted('update:show')?.[0]).toEqual([false]);
    });

    it('эмитит close при закрытии NModal', async () => {
        const wrapper = mountModal();

        await wrapper.find('.emit-close').trigger('click');

        expect(wrapper.emitted('close')?.length).toBe(1);
    });

    it('позволяет переопределять config поверх дефолтов', () => {
        const wrapper = mountModal({ autoFocus: true, maskClosable: true });
        const modal = wrapper.findComponent({ name: 'NModal' });

        expect(modal.props('autoFocus')).toBe(true);
        expect(modal.props('maskClosable')).toBe(true);
        expect(modal.props('draggable')).toBe(true);
    });
});
