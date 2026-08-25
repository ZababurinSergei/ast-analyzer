import type { ContextMenuPayload } from '@/composables/AiContextMenu/types';
import type { DropdownOption } from 'naive-ui';

export interface AiContextMenuProps {
    /**
     * Массив опций для контекстного меню.
     */
    options: DropdownOption[];
}

export interface AiContextMenuEmits {
    /**
     * Событие вызывается при выборе пункта контекстного меню. Возвращает название пункта(поле *name*), ключ(поле *key*) и payload(поле *payload*).
     */
    (e: 'contextMenuSelect', name: string, key: string, payload: ContextMenuPayload): void;
    /**
     * Событие вызывается при закрытии контекстного меню, не возвращает никаких объектов.
     */
    (e: 'close'): void;
}
