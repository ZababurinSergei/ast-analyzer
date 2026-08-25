import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type * as NaiveUi from 'naive-ui';
import AiCell from '@/components/ui/AiCell/AiCell.vue';

vi.mock('naive-ui', async importOriginal => {
    const mod = await importOriginal<typeof NaiveUi>();
    return {
        ...mod,
        NPopover: defineComponent({
            name: 'NPopover',
            props: {
                disabled: {
                    type: Boolean,
                    default: false,
                },
                to: {
                    type: String,
                    default: 'body',
                },
            },
            template:
                '<div class="n-popover-stub" :data-disabled="String(disabled)" :data-to="to"><slot name="trigger" /><slot /></div>',
        }),
    };
});

vi.mock('@/components/ui/AiField/AiField.vue', () => ({
    default: defineComponent({
        name: 'AiField',
        inheritAttrs: false,
        props: {
            isEditable: { type: Boolean, required: true },
            value: { type: [String, Number, Boolean, Date, Array, null], required: true },
            onUpdateValue: { type: Function, required: true },
            onUpdateDisplayValue: { type: Function, required: true },
        },
        template: '<div class="ai-field-stub" :class="$attrs.class">{{ value }}</div>',
    }),
}));

describe('AiCell', () => {
    const baseComponentMeta = {
        isEditable: true,
        value: 'Значение',
        onUpdateValue: vi.fn(),
        onUpdateDisplayValue: vi.fn(),
    };

    const mountCell = (props: Record<string, unknown> = {}) =>
        mount(AiCell, {
            props: {
                componentMeta: baseComponentMeta,
                ...props,
            },
        });

    it('рендерит AiField и пробрасывает в него componentMeta', () => {
        const wrapper = mountCell();
        const field = wrapper.findComponent({ name: 'AiField' });

        expect(field.exists()).toBe(true);
        expect(field.props()).toMatchObject(baseComponentMeta);
        expect(field.text()).toContain('Значение');
    });

    it('добавляет класс modified-cell, когда ячейка изменена', () => {
        const wrapper = mountCell({ isModified: true });
        const fieldWrapper = wrapper.find('.ai-field-wrapper');

        expect(fieldWrapper.classes()).toContain('modified-cell');
        expect(fieldWrapper.classes()).not.toContain('error-cell');
    });

    it('при ошибке валидации включает popover, показывает сообщение и треугольник', () => {
        const wrapper = mountCell({
            isValidationError: true,
            validationErrorMessage: 'Некорректное значение',
        });

        const popover = wrapper.findComponent({ name: 'NPopover' });
        const fieldWrapper = wrapper.find('.ai-field-wrapper');

        expect(popover.attributes('data-disabled')).toBe('false');
        expect(fieldWrapper.classes()).toContain('error-cell');
        expect(wrapper.text()).toContain('Некорректное значение');
        expect(wrapper.find('.error-triangle').exists()).toBe(true);
    });

    it('без ошибки валидации отключает popover и не рендерит треугольник', () => {
        const wrapper = mountCell({
            isValidationError: false,
            validationErrorMessage: 'Не должно отображаться',
        });

        const popover = wrapper.findComponent({ name: 'NPopover' });

        expect(popover.attributes('data-disabled')).toBe('true');
        expect(wrapper.find('.error-triangle').exists()).toBe(false);
    });

    it('использует body по умолчанию', () => {
        const defaultWrapper = mountCell({ isValidationError: true });

        expect(defaultWrapper.findComponent({ name: 'NPopover' }).attributes('data-to')).toBe('body');
    });

    it('принимает кастомный контейнер для popover', () => {
        const customWrapper = mountCell({
            isValidationError: true,
            parentContainerSelectorForError: '.table-wrapper',
        });

        expect(customWrapper.findComponent({ name: 'NPopover' }).attributes('data-to')).toBe('.table-wrapper');
    });
});
