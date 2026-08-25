import { readonly, ref } from 'vue';
import type { ContextMenuState, ContextMenuPayload } from './types';

/**
 * Хук для управления состоянием контекстного меню
 * @returns {ContextMenuState}
 */
export const useContextMenuState = <T = unknown>(): ContextMenuState<T> => {
    const show = ref(false);
    const x = ref(0);
    const y = ref(0);
    const payload = ref<ContextMenuPayload>(null);

    const openContextMenu = (e: MouseEvent, nextPayload: ContextMenuPayload = null) => {
        e.preventDefault();
        x.value = e.clientX;
        y.value = e.clientY;
        payload.value = nextPayload;
        show.value = true;
    };

    const closeContextMenu = () => {
        show.value = false;
    };

    return {
        show: readonly(show),
        xCoordinate: readonly(x),
        yCoordinate: readonly(y),
        payload: readonly(payload),
        openContextMenu,
        closeContextMenu,
    };
};
