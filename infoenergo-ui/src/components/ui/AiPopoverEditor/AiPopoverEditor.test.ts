import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type * as NaiveUi from 'naive-ui';
import AiPopoverEditor from '@/components/ui/AiPopoverEditor/AiPopoverEditor.vue';
import type { AiPopoverEditorProps } from '@/components/ui/AiPopoverEditor/types.ts';

vi.mock('naive-ui', async importOriginal => {
    const { vi: vitest } = await import('vitest');
    const mod = await importOriginal<typeof NaiveUi>();
    const NPopoverStub = defineComponent({
        name: 'NPopover',
        setup(_, { expose }) {
            const setShow = vitest.fn();
            expose({ setShow });
            return { setShow };
        },
        template: '<div class="n-popover-stub"><slot name="trigger" /><slot /></div>',
    });
    return {
        ...mod,
        NPopover: NPopoverStub,
    };
});
const TestGrid = defineComponent({
    name: 'TestGrid',
    emits: ['row-click'],
    template:
        '<button type="button" class="test-grid" @click="$emit(\'row-click\', { id: 42, title: \'Label\' })">pick</button>',
});

describe('AiPopoverEditor', () => {
    const baseProps: AiPopoverEditorProps = {
        value: 'Ячейка',
        editorConfig: {
            width: '300px',
            height: '200px',
        },
        componentName: 'TestGrid',
        idKey: 'id',
        textKey: 'title',
    };

    const mountPopover = () =>
        mount(AiPopoverEditor, {
            props: baseProps,
            global: {
                components: { TestGrid },
            },
        });

    it('показывает значение в триггере', () => {
        const wrapper = mountPopover();
        expect(wrapper.find('.popover-trigger').text()).toContain('Ячейка');
    });

    it('передаёт размеры контента из editor', () => {
        const wrapper = mountPopover();
        const content = wrapper.find('.popover-content');

        const el = content.element as HTMLElement;
        expect(el.style.width).toBe('300px');
        expect(el.style.height).toBe('200px');
    });

    it('по row-click эмитит update:value с id и text', async () => {
        const wrapper = mountPopover();

        await wrapper.find('.test-grid').trigger('click');

        expect(wrapper.emitted('update:value')?.[0]).toEqual([42, 'Label']);
    });

    it('по row-click эмитит blur', async () => {
        const wrapper = mountPopover();

        await wrapper.find('.test-grid').trigger('click');

        expect(wrapper.emitted('blur')?.length).toBeGreaterThan(0);
    });

    it('по update:show(false) эмитит blur', async () => {
        const wrapper = mountPopover();
        const popover = wrapper.findComponent({ name: 'NPopover' });

        await popover.vm.$emit('update:show', false);

        expect(wrapper.emitted('blur')?.length).toBeGreaterThan(0);
    });
});
