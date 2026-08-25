import type { CSSProperties } from 'vue';
import type { ModalProps } from 'naive-ui';

export const DIALOG_STYLE: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: 'center',
};

/** Дефолтные пропсы */
export const DIALOG_PROPS: Partial<ModalProps> = {
    autoFocus: false,
    preset: 'dialog',
    showIcon: false,
    closable: false,
    maskClosable: false,
    transformOrigin: 'center',
};
