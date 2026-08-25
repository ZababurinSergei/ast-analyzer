import { showDialog } from '@/composables/AiDialog/store';

/** Композабл для управления диалоговым окном */
export const useDialog = () => ({ show: showDialog });
