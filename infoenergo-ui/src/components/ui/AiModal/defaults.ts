import type { CSSProperties } from 'vue';
import type { ModalProps } from 'naive-ui';

/** Стили для модального окна */
export const MODAL_STYLES: CSSProperties = {
    minWidth: '600px',
    minHeight: '400px',
    width: '80vw',
    height: '80vh',
    resize: 'both',
    overflow: 'auto',
};

/** Дефолтные пропсы для модального окна */
export const DEFAULT_MODAL_CONFIG: Partial<ModalProps> = {
    autoFocus: false,
    preset: 'card',
    contentScrollable: false,
    draggable: true,
    transformOrigin: 'center',
    segmented: true,
    maskClosable: false,
    contentStyle: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
};
