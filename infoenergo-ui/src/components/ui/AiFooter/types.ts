export interface AiFooterProps {
    /** Количество отмеченных строк */
    selectedCount: number;
    /** Количество строк */
    totalCount: number;
    /** Флаг отображения счётчика выбранных строк */
    showSelectionCount?: boolean;
}

export interface AiFooterEmits {
    (event: 'create-filter'): void;
}
