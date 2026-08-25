import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import AiModalEditor from '@/components/ui/AiModalEditor/AiModalEditor.vue';
import type { AiModalEditorProps } from '@/components/ui/AiModalEditor/types.ts';

vi.mock('@/components/ui/AiModal/AiModal.vue', () => {
    const AiModalStub = defineComponent({
        name: 'AiModal',
        props: {
            show: { type: Boolean, default: false },
        },
        emits: ['update:show', 'close'],
        template: `
            <div class="ai-modal-stub" :data-show="String(show)">
                <button class="modal-close" @click="$emit('close')">close</button>
                <slot />
            </div>
        `,
    });

    return { default: AiModalStub };
});

const TestGrid = defineComponent({
    name: 'TestGrid',
    emits: ['row-doubleclick'],
    template:
        '<button type="button" class="test-grid" @dblclick="$emit(\'row-doubleclick\', { id: 7, title: \'Row Label\' })">pick</button>',
});

describe('AiModalEditor', () => {
    const baseProps: AiModalEditorProps = {
        value: 'Текущее значение',
        componentName: 'TestGrid',
        idKey: 'id',
        textKey: 'title',
        editorConfig: {
            title: 'Выбор строки',
        },
    };

    const mountEditor = () =>
        mount(AiModalEditor, {
            props: baseProps,
            global: {
                components: { TestGrid },
            },
        });

    it('рендерит значение в триггере', () => {
        const wrapper = mountEditor();
        expect(wrapper.find('.modal-trigger').text()).toContain('Текущее значение');
    });

    it('открывает модалку при монтировании', async () => {
        const wrapper = mountEditor();
        await wrapper.vm.$nextTick();

        const modal = wrapper.find('.ai-modal-stub');
        expect(modal.attributes('data-show')).toBe('true');
    });

    it('по row-doubleclick эмитит update:value и blur', async () => {
        const wrapper = mountEditor();

        await wrapper.find('.test-grid').trigger('dblclick');

        expect(wrapper.emitted('update:value')?.[0]).toEqual([7, 'Row Label']);
        expect(wrapper.emitted('blur')?.length).toBeGreaterThan(0);
    });

    it('по close модалки эмитит blur', async () => {
        const wrapper = mountEditor();

        await wrapper.find('.modal-close').trigger('click');

        expect(wrapper.emitted('blur')?.length).toBeGreaterThan(0);
    });
});
