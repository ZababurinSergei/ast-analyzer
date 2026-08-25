import type { PopoverProps } from 'naive-ui';
import type { DataFieldValue, DataFieldDisplayValue, EditorDefaultConfig } from '@/interfaces/common.ts';

type PopoverEditorConfig = EditorDefaultConfig & Partial<Omit<PopoverProps, 'width'>>;

/** Пропсы для компонента AiPopoverEditor */
export interface AiPopoverEditorProps {
    /** Значение поля в строке (`dataField`) */
    value: DataFieldValue;
    /** Название компонента */
    componentName: string;
    /** Имя поля с ключом */
    idKey: string;
    /** Имя поля с текстом */
    textKey: string;
    /** Пропсы для редактора */
    editorConfig?: PopoverEditorConfig;
}

/** Эмиты для компонента AiPopoverEditor */
export interface AiPopoverEditorEmits {
    /** Событие обновления значения поля */
    'update:value': [value: DataFieldValue, displayValue: DataFieldDisplayValue];
    /** Событие потери фокуса с поля */
    blur: [];
}
