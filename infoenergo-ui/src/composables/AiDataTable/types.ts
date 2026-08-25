import type { DataFieldValue } from '@/interfaces/common.ts';

/** Изменение значения поля */
export type FieldChange = { originalValue: DataFieldValue; currentValue: DataFieldValue };
/** Изменения в строке */
export type RowChanges = Record<string, FieldChange>;
