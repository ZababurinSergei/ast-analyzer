import { describe, it, expect } from 'vitest';

import { useFieldComponent } from '@/composables/AiField/useFieldComponent.ts';
import { DEFAULT_COMPONENTS } from '@/components/ui/AiField/defaults.ts';
import type { Component as UserComponent, Editor } from '@/interfaces/common.ts';

describe('useFieldComponent', () => {
    const selectorEditor: Editor = {
        type: 'selector',
        id: 'id',
        text: 'name',
        config: { clearable: false },
    };

    const popoverEditor: Editor = {
        type: 'popover',
    };

    const customComponent: UserComponent = {
        name: 'RemoteSelector',
        id: 'code',
        text: 'title',
    };

    it('без editor выбирает компонент по dataType', () => {
        const { fieldComponent } = useFieldComponent('number');

        expect(fieldComponent.value).toBe(DEFAULT_COMPONENTS.number.component);
    });

    it('без editor использует propAliases из dataType', () => {
        const { propAliases } = useFieldComponent('number');

        expect(propAliases.value).toStrictEqual(DEFAULT_COMPONENTS.number.propAliases);
    });

    it('без editor использует defaultProps из dataType', () => {
        const { mergedComponentProps } = useFieldComponent('number');

        expect(mergedComponentProps.value).toStrictEqual(DEFAULT_COMPONENTS.number.defaultProps());
    });

    it('с editor выбирает компонент по editor.type', () => {
        const { fieldComponent } = useFieldComponent('string', selectorEditor);

        expect(fieldComponent.value).toBe(DEFAULT_COMPONENTS.selector.component);
    });

    it('с editor использует propAliases из editor.type', () => {
        const { propAliases } = useFieldComponent('string', selectorEditor);

        expect(propAliases.value).toStrictEqual(DEFAULT_COMPONENTS.selector.propAliases);
    });

    it('с editor без component добавляет idKey/textKey/editorConfig и не добавляет componentName', () => {
        const { mergedComponentProps } = useFieldComponent('string', selectorEditor);

        expect(mergedComponentProps.value.idKey).toBe('id');
        expect(mergedComponentProps.value.textKey).toBe('name');
        expect(mergedComponentProps.value.editorConfig).toStrictEqual(selectorEditor.config);
        expect('componentName' in mergedComponentProps.value).toBe(false);
    });

    it('с editor без component сохраняет базовые пропсы editor-компонента', () => {
        const { mergedComponentProps } = useFieldComponent('string', selectorEditor);

        expect(mergedComponentProps.value.valueField).toBe('id');
        expect(mergedComponentProps.value.labelField).toBe('name');
        expect(Array.isArray(mergedComponentProps.value.options)).toBe(true);
    });

    it('с editor и component подставляет componentName и ключи из component', () => {
        const { mergedComponentProps } = useFieldComponent('date', popoverEditor, customComponent);

        expect(mergedComponentProps.value.componentName).toBe('RemoteSelector');
        expect(mergedComponentProps.value.idKey).toBe('code');
        expect(mergedComponentProps.value.textKey).toBe('title');
    });

    it('с editor и component объединяет пропсы с defaultProps выбранного editor.type', () => {
        const { mergedComponentProps } = useFieldComponent('date', popoverEditor, customComponent);

        expect(mergedComponentProps.value).toStrictEqual({
            idKey: 'code',
            textKey: 'title',
            componentName: 'RemoteSelector',
            editorConfig: popoverEditor.config,
        });
    });
});
