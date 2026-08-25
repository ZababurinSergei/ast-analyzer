import type { DataFieldValue, DataFieldDisplayValue, EditorDefaultConfig } from '@/interfaces/common.ts';
import type { AiModalProps } from '@/components/ui/AiModal/types.ts';

type ModalEditorConfig = EditorDefaultConfig & Omit<AiModalProps, 'show'>;

/** Пропсы для компонента AiModalEditor */
export interface AiModalEditorProps {
    /** Значение поля в строке (`dataField`) */
    value: DataFieldValue;
    /** Название компонента */
    componentName: string;
    /** Имя поля с ключом */
    idKey: string;
    /** Имя поля с текстом */
    textKey: string;
    /** Пропсы для редактора */
    editorConfig: ModalEditorConfig;
}

/** Эмиты для компонента AiModalEditor */
export interface AiModalEditorEmits {
    /** Событие обновления значения поля */
    'update:value': [value: DataFieldValue, displayValue: DataFieldDisplayValue];
    /** Событие потери фокуса с поля */
    blur: [];
}
