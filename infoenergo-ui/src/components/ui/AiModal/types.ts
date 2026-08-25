import type { ModalProps } from 'naive-ui';

/** Пропсы для компонента AiModal */
export interface AiModalProps {
    /** Заголовок окна */
    title: string;
    /** Флаг видимости окна */
    show: boolean;
    /** Флаг изменённости данных */
    isDirty?: boolean;
    /** Пропсы для компонента NModal */
    config?: Partial<ModalProps>;
}

/** События для компонента AiModal */
export interface AiModalEmits {
    /** Событие обновления флага видимости окна */
    'update:show': [show: boolean];
    /** Событие закрытия окна */
    close: [];
}
