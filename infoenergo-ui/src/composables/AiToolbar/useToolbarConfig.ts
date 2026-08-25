import { reactive } from 'vue';
import { DEFAULT_ELEMENTS, STATIC_ELEMENTS_NAMES } from '@/components/ui/AiToolbar/defaults';
import type { ColumnChooser } from '@/components/ui/AiToolbar/types';

export const useToolbarConfig = (columnChooser: ColumnChooser, isEditable: boolean) => {
    const setupElements = () => {
        const staticElements = STATIC_ELEMENTS_NAMES.map(name => DEFAULT_ELEMENTS[name]);
        const columnChooserElement = {
            ...DEFAULT_ELEMENTS['column-chooser'],
            value: [...columnChooser.value],
            options: columnChooser.options,
        };
        const elements = [...staticElements, columnChooserElement].filter(element =>
            isEditable === true ? true : element.canModifyData === false
        );
        return elements;
    };

    const elements = reactive(setupElements());

    return {
        elements,
    };
};
