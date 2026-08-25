import type { PopoverProps, SelectProps } from 'naive-ui';
import type { AiModalProps } from '@/components/ui/AiModal/types.ts';

type DataFieldScalar = string | number | boolean | Date | null;
/** Значение поля в строке (`dataField`) */
export type DataFieldValue = DataFieldScalar | DataFieldScalar[] | null;

type DataFieldDisplayScalar = string | number | null;
/** Отображаемое значение при отдельном `displayField` в колонке */
export type DataFieldDisplayValue = DataFieldDisplayScalar | DataFieldDisplayScalar[];

/** Ключ строки */
export type RowKey = number | string;

/** Тип данных в ячейке таблицы */
export type DataType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';

/** Тип редактора в ячейке таблицы */
export type EditorType = 'selector' | 'popover' | 'modal';

/** Тип ячейки таблицы */
export type FieldType = DataType | EditorType;

/** Пропсы для редактора в ячейке таблицы */
export interface EditorDefaultConfig {
    /** Событие для выбора строки (количество значений будет увеличиваться в будущем) */
    selectEvent?: string;
    /** Ширина модалки */
    width?: string;
    /** Высота модалки */
    height?: string;
}

/** Пропсы для редактора */
type EditorConfig = EditorDefaultConfig & (Partial<SelectProps> | Partial<PopoverProps> | Partial<AiModalProps>);

/** Редактор таблицы */
export interface Editor {
    type: EditorType;
    api?: string;
    id?: string;
    text?: string;
    config?: EditorConfig;
}

/** Компонент для отображения данных в ячейке таблицы
 *
 *  @todo Доработать набор полей
 */
export interface Component {
    name: string;
    id: string;
    text: string;
}

/**
 * Контракт поля в ячейке таблицы: значение(я), тип, опциональный редактор/компонент
 * и колбэки для подъёма изменений в строку данных таблицы.
 */
export interface AiComponentProps {
    /** Является ли поле редактируемым */
    isEditable: boolean;
    /** Значение поля в строке (`dataField`) */
    value: DataFieldValue;
    /** Отображаемое значение при отдельном `displayField` в колонке */
    displayValue?: DataFieldDisplayValue;
    /** Тип данных для выбора дефолтного редактора */
    dataType?: DataType;
    /** Пользовательский компонент из метаданных колонки */
    component?: Component;
    /** Редактор-обёртка (selector/popover) поверх базового типа */
    editor?: Editor;
    /** Сообщить родителю новое значение поля данных */
    onUpdateValue: (value: DataFieldValue) => void;
    /** Сообщить родителю новое отображаемое значение, если задан `displayField` */
    onUpdateDisplayValue: (displayValue: DataFieldDisplayValue) => void;
}
