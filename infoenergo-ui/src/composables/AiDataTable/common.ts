import type { DataType } from '@/interfaces/common';

const parseRussianDateTimeToTimestamp = (value: unknown): number => {
    const normalizedValue = String(value).trim();
    const dateTimeMatch = normalizedValue.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:,\s*(\d{2}):(\d{2}):(\d{2}))?$/);
    if (!dateTimeMatch) {
        return NaN;
    }
    const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = dateTimeMatch;
    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds)
    ).getTime();
};

export const makeSorter =
    (dataField: string, dataType: DataType) =>
    (leftRow: Record<string, unknown>, rightRow: Record<string, unknown>) => {
        const leftValue = leftRow[dataField];
        const rightValue = rightRow[dataField];

        if (leftValue === null && rightValue === null) return 0;
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;

        if (dataType === 'number') {
            return Number(leftValue) - Number(rightValue);
        }

        if (dataType === 'date' || dataType === 'datetime') {
            return parseRussianDateTimeToTimestamp(leftValue) - parseRussianDateTimeToTimestamp(rightValue);
        }

        if (dataType === 'boolean') {
            return Number(Boolean(leftValue)) - Number(Boolean(rightValue));
        }

        return String(leftValue).localeCompare(String(rightValue), 'ru');
    };
