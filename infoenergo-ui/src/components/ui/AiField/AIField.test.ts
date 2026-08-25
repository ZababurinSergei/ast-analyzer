import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref, shallowRef, nextTick } from 'vue';

vi.mock('naive-ui', () => ({
    NText: {
        name: 'NText',
        template: '<span class="n-text-stub" @click="$emit(\'click\')"><slot /></span>',
    },
}));

vi.mock('@/composables/AiField/useFieldComponent', () => ({
    useFieldComponent: vi.fn(),
}));

import AiField from '@/components/ui/AiField/AiField.vue';
import { useFieldComponent } from '@/composables/AiField/useFieldComponent';

const focusMock = vi.fn();

const TestEditor = defineComponent({
    name: 'TestEditor',
    props: {
        value: { type: [String, Number, Boolean, Date, Array], default: undefined },
        modelValue: { type: [String, Number, Boolean, Date, Array], default: undefined },
        disabled: { type: Boolean, default: false },
    },
    emits: ['update:value', 'update:modelValue', 'blur'],
    setup(_, { expose }) {
        expose({ focus: focusMock });
        return {};
    },
    template: '<input data-testid="test-input" :disabled="disabled" :value="String(value ?? modelValue ?? \'\')" />',
});

describe('AiField', () => {
    const mockedUseFieldComponent = vi.mocked(useFieldComponent);

    const mountField = (props: Record<string, unknown> = {}) =>
        mount(AiField, {
            props: {
                isEditable: true,
                value: 'Исходное значение',
                onUpdateValue: vi.fn(),
                onUpdateDisplayValue: vi.fn(),
                ...props,
            },
        });

    beforeEach(() => {
        focusMock.mockClear();
        mockedUseFieldComponent.mockReturnValue({
            fieldComponent: shallowRef(TestEditor),
            propAliases: shallowRef({
                valueKey: 'value',
                updateEvent: 'update:value',
            }),
            mergedComponentProps: ref({}),
        });
    });

    it('в неактивном режиме показывает текстовое представление значения', () => {
        const wrapper = mountField();

        expect(wrapper.find('.not-editable-mode').exists()).toBe(true);
        expect(wrapper.text()).toContain('Исходное значение');
        expect(wrapper.findComponent(TestEditor).exists()).toBe(false);
    });

    it('по клику включает режим редактирования и фокусирует компонент', async () => {
        const wrapper = mountField();

        await wrapper.find('.not-editable-mode').trigger('click');
        await nextTick();

        const editor = wrapper.findComponent(TestEditor);
        expect(editor.exists()).toBe(true);
        expect(editor.props('value')).toBe('Исходное значение');
        expect(wrapper.find('.not-editable-mode').exists()).toBe(false);
        expect(focusMock).toHaveBeenCalled();
    });

    it('пробрасывает update-value при событии обновления из редактора', async () => {
        const wrapper = mountField();
        await wrapper.find('.not-editable-mode').trigger('click');

        wrapper.findComponent(TestEditor).vm.$emit('update:value', 'Новое значение');

        expect(wrapper.emitted('update-value')).toEqual([['Новое значение']]);
    });

    it('пробрасывает update-display-value через ключ editor.text, если displayValue задан', async () => {
        const wrapper = mountField({
            displayValue: 'Старый текст',
            editor: {
                type: 'selector',
                text: 'name',
            },
        });

        await wrapper.find('.not-editable-mode').trigger('click');
        wrapper.findComponent(TestEditor).vm.$emit('update:value', 10, { name: 'Человекочитаемый текст' });

        expect(wrapper.emitted('update-value')).toEqual([[10]]);
        expect(wrapper.emitted('update-display-value')).toEqual([['Человекочитаемый текст']]);
    });

    it('не эмитит update-display-value, если displayValue не передан', async () => {
        const wrapper = mountField({
            editor: {
                type: 'selector',
                text: 'name',
            },
        });

        await wrapper.find('.not-editable-mode').trigger('click');
        wrapper.findComponent(TestEditor).vm.$emit('update:value', 5, { name: 'Не должно уйти' });

        expect(wrapper.emitted('update-value')).toEqual([[5]]);
        expect(wrapper.emitted('update-display-value')).toBeUndefined();
    });

    it('для boolean дизейблит компонент, если поле нередактируемое', () => {
        const wrapper = mountField({
            isEditable: false,
            dataType: 'boolean',
            value: true,
        });

        const editor = wrapper.findComponent(TestEditor);
        expect(editor.props('disabled')).toBe(true);
    });
});
