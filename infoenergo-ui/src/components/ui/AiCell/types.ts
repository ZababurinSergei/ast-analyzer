import type { AiComponentProps } from '@/interfaces/common.ts';

/** Пропсы для компонента AiCell */
export interface AiCellProps {
    /** Подсветка ячейки как изменённой относительно данных с сервера */
    isModified?: boolean;
    /** Зарезервировано под явный флаг ошибки */
    isValidationError?: boolean;
    /** Зарезервировано под текст ошибки снаружи */
    validationErrorMessage?: string;
    /** Данные и колбэки для вложенного `AiField` */
    componentMeta: AiComponentProps;
    /** Родительский селектор контейнера для позиционирования ошибки */
    parentContainerSelectorForError?: string;
}
