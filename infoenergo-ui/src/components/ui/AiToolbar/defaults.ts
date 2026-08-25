import type { DefaultToolbarId, DefaultToolbarElement } from '@/components/ui/AiToolbar/types';
import AiRefreshIcon from '@/components/icons/toolbar/AiRefreshIcon.vue';
import AiCopyIcon from '@/components/icons/toolbar/AiCopyIcon.vue';
import AiAddIcon from '@/components/icons/toolbar/AiAddIcon.vue';
import AiDeleteIcon from '@/components/icons/toolbar/AiDeleteIcon.vue';
import AiSaveIcon from '@/components/icons/toolbar/AiSaveIcon.vue';
import AiColumnChooserIcon from '@/components/icons/toolbar/AiColumnChooserIcon.vue';

export const STATIC_ELEMENTS_NAMES: DefaultToolbarId[] = ['refresh', 'copy', 'add', 'delete', 'save'];

export const DEFAULT_ELEMENTS: Record<DefaultToolbarId, DefaultToolbarElement> = {
    refresh: {
        elementType: 'button',
        id: 'refresh',
        buttonType: 'icon',
        hint: 'Обновить',
        icon: AiRefreshIcon,
        canModifyData: false,
    },
    copy: {
        elementType: 'button',
        id: 'copy',
        buttonType: 'icon',
        hint: 'Создать копию сфокусированной строки',
        icon: AiCopyIcon,
        canModifyData: true,
    },
    add: {
        elementType: 'button',
        id: 'add',
        buttonType: 'icon',
        hint: 'Добавить строку',
        icon: AiAddIcon,
        canModifyData: true,
    },
    delete: {
        elementType: 'button',
        id: 'delete',
        buttonType: 'icon',
        hint: 'Удалить',
        icon: AiDeleteIcon,
        canModifyData: true,
    },
    save: {
        elementType: 'button',
        id: 'save',
        buttonType: 'icon',
        hint: 'Сохранить',
        icon: AiSaveIcon,
        canModifyData: true,
    },
    'column-chooser': {
        elementType: 'popselect',
        id: 'column-chooser',
        hint: 'Выбрать колонки',
        icon: AiColumnChooserIcon,
        multiple: true,
        canModifyData: false,
    },
};
