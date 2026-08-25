import type { DataFieldValue, DataFieldDisplayValue } from '@/interfaces/common.ts';

/** Эмиты для компонента AiComponent */
export interface AiComponentEmits {
    'update-value': [value: DataFieldValue];
    'update-display-value': [displayValue: DataFieldDisplayValue];
}
