import type { Ref } from 'vue';

/**
 * Тип данных, которые будут переданы в контекстное меню
 * @example
 * const payload: ContextMenuPayload = {
 *     name: 'John Doe',
 *     age: 30,
 *     email: 'john.doe@example.com',
 * };
 */
export type ContextMenuPayload = any;

/**
 * Тип состояния контекстного меню
 */
export interface ContextMenuState<T = unknown> {
    /** Флаг, который определяет, будет ли контекстное меню отображаться */
    readonly show: Readonly<Ref<boolean>>;
    /** Ссылка на x-координату контекстного меню */
    readonly xCoordinate: Readonly<Ref<number>>;
    /** Ссылка на y-координату контекстного меню */
    readonly yCoordinate: Readonly<Ref<number>>;
    /** Ссылка на данные, которые будут переданы в контекстное меню */
    readonly payload: Readonly<ContextMenuPayload>;
    /** Метод для открытия контекстного меню */
    openContextMenu: (e: MouseEvent, nextPayload?: T | null) => void;
    /** Метод для закрытия контекстного меню */
    closeContextMenu: () => void;
}
