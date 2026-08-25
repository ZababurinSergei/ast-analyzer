import { shallowRef, ref } from 'vue';
import type { Component, ShallowRef, Ref } from 'vue';
import { DEFAULT_COMPONENTS } from '@/components/ui/AiField/defaults.ts';
import type { Component as UserComponent, DataType, Editor, FieldType } from '@/interfaces/common.ts';

/**
 * Композабл для динамической загрузки UI-компонента поля на основе типа данных
 *
 * @param dataType - Базовый тип поля, если нет переопределения редактором
 * @param editor - Редактор с типом `selector` | `popover` и своими `config`
 * @param component - Пользовательские метаданные компонента и `config` для слияния с дефолтами
 *
 * @returns Объект с динамическим компонентом поля, псевдонимами пропсов и объединёнными пропсами
 */
export const useFieldComponent = (dataType: DataType, editor?: Editor, component?: UserComponent) => {
    const fieldType: FieldType = editor ? editor.type : dataType;

    /** Динамический компонент */
    const fieldComponent: ShallowRef<Component | null> = shallowRef(null);

    /** Псевдонимы пропсов */
    const propAliases: ShallowRef<Record<string, string>> = shallowRef({});

    /** Объединенные пропсы (дефолтные и пользовательские) */
    const mergedComponentProps: Ref<Record<string, any>> = ref({});

    const setComponent = () => {
        const { component } = DEFAULT_COMPONENTS[fieldType];
        fieldComponent.value = component;
    };

    const setPropAliases = () => {
        const { propAliases: incomingPropAliases } = DEFAULT_COMPONENTS[fieldType];
        propAliases.value = incomingPropAliases;
    };

    const setMergedComponentProps = () => {
        const { defaultProps } = DEFAULT_COMPONENTS[fieldType];

        const props = editor ? defaultProps(editor) : defaultProps();

        // что-то глобально зарегистрированное, поэтому используем компонент
        if (editor && component) {
            mergedComponentProps.value = {
                ...props,
                idKey: component.id,
                textKey: component.text,
                componentName: component.name,
                editorConfig: editor.config,
            };
        }
        // только если существует редактор без компонента, следовательно это selector
        else if (editor) {
            mergedComponentProps.value = {
                ...props,
                idKey: editor.id,
                textKey: editor.text,
                editorConfig: editor.config,
            };
        }
        // ничего не существует, следовательно это обычное поле
        else {
            mergedComponentProps.value = props;
        }
    };

    const initComponent = () => {
        setComponent();
        setPropAliases();
        setMergedComponentProps();
    };

    initComponent();

    return {
        fieldComponent,
        propAliases,
        mergedComponentProps,
    };
};
