import { reactive, ref } from 'vue';
import type { Component } from 'vue';
import { NCheckbox, NDatePicker, NInput, NInputNumber, NSelect } from 'naive-ui';
import type { InputProps, InputNumberProps, DatePickerProps, CheckboxProps, SelectProps } from 'naive-ui';
import AiPopoverEditor from '@/components/ui/AiPopoverEditor/AiPopoverEditor.vue';
import AiModalEditor from '@/components/ui/AiModalEditor/AiModalEditor.vue';
import type { AiPopoverEditorProps } from '@/components/ui/AiPopoverEditor/types.ts';
import type { AiModalEditorProps } from '@/components/ui/AiModalEditor/types.ts';
import { useFetch } from '@/composables/common/useFetch.ts';
import type { Editor, FieldType } from '@/interfaces/common.ts';

type DefaultProps =
    | Partial<InputProps>
    | Partial<InputNumberProps>
    | Partial<DatePickerProps>
    | Partial<CheckboxProps>
    | Partial<SelectProps>
    | Partial<AiPopoverEditorProps>
    | Partial<AiModalEditorProps>;

/** Конфиг компонента */
interface DefaultComponentConfig {
    /** Сам компонент */
    component: Component;
    /** Псевдонимы для названия некоторых пропсов */
    propAliases: {
        valueKey: string;
        updateEvent: string;
    };
    /** Дефолтные пропсы */
    defaultProps: (editor?: Editor) => DefaultProps;
}

/** Мапит тип данных с компонентом, с псевдонимами для названия некоторых пропсов и с дефолтными пропсами */
export const DEFAULT_COMPONENTS: Record<FieldType, DefaultComponentConfig> = {
    string: {
        component: NInput,
        propAliases: {
            valueKey: 'value',
            updateEvent: 'update:value',
        },
        defaultProps: () => ({
            bordered: false,
        }),
    },
    number: {
        component: NInputNumber,
        propAliases: {
            valueKey: 'value',
            updateEvent: 'update:value',
        },
        defaultProps: () => ({
            bordered: false,
            showButton: false,
            defaultValue: 0,
        }),
    },
    date: {
        component: NDatePicker,
        propAliases: {
            valueKey: 'formatted-value',
            updateEvent: 'update:formatted-value',
        },
        defaultProps: () => ({
            clearable: true,
            bordered: false,
            format: 'dd.MM.yyyy',
            type: 'date',
            valueFormat: 'dd.MM.yyyy',
        }),
    },
    datetime: {
        component: NDatePicker,
        propAliases: {
            valueKey: 'formatted-value',
            updateEvent: 'update:formatted-value',
        },
        defaultProps: () => ({
            clearable: true,
            bordered: false,
            format: 'dd.MM.yyyy, HH:mm:ss',
            type: 'datetime',
            valueFormat: 'dd.MM.yyyy, HH:mm:ss',
        }),
    },
    boolean: {
        component: NCheckbox,
        propAliases: {
            valueKey: 'checked',
            updateEvent: 'update:checked',
        },
        defaultProps: () => ({
            clearable: true,
            bordered: false,
        }),
    },
    selector: {
        component: NSelect,
        propAliases: {
            valueKey: 'value',
            updateEvent: 'update:value',
        },
        defaultProps: (editor?: Editor) => {
            const { send } = useFetch();

            const data = reactive<any[]>([]);

            const loading = ref(false);

            const props = {
                bordered: false,
                valueField: editor?.id,
                labelField: editor?.text,
                options: data,
                loading: loading,
                filterable: true,
                clearable: true,
                showOnFocus: true,
                onFocus: async () => {
                    if (editor?.api) {
                        loading.value = true;
                        data.length = 0;
                        const result = await send(editor.api);
                        data.push(...(result?.data ?? []));
                        loading.value = false;
                    }
                },
            };
            return props;
        },
    },
    popover: {
        component: AiPopoverEditor,
        propAliases: {
            valueKey: 'value',
            updateEvent: 'update:value',
        },
        defaultProps: () => ({}),
    },
    modal: {
        component: AiModalEditor,
        propAliases: {
            valueKey: 'value',
            updateEvent: 'update:value',
        },
        defaultProps: () => ({}),
    },
};
