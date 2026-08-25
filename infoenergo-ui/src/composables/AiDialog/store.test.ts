import { beforeEach, expect, test, vi } from 'vitest';
import { closeDialog, getDialogState, showDialog } from '@/composables/AiDialog/store';
import { DEFAULT_BUTTON, DEFAULT_TITLE } from '@/composables/AiDialog/defaults';

const resetDialog = () => {
    const state = getDialogState();
    if (state.isOpen) {
        closeDialog('positive');
    }
};

beforeEach(() => {
    resetDialog();
    vi.restoreAllMocks();
});

test('showDialog — открывает диалог и заполняет state', () => {
    const state = getDialogState();

    void showDialog({
        title: 'Удалить запись?',
        content: '  Действие необратимо  ',
        positiveText: 'Да',
        negativeText: 'Нет',
    });

    expect(state.isOpen).toBe(true);
    expect(state.title).toBe('Удалить запись?');
    expect(state.content).toBe('Действие необратимо');
    expect(state.buttons).toEqual([
        { option: 'positive', text: 'Да' },
        { option: 'negative', text: 'Нет' },
    ]);
});

test('showDialog — ставит title и кнопку по умолчанию', () => {
    const state = getDialogState();

    void showDialog({
        title: '   ',
        content: 'Текст без кнопок',
        positiveText: ' ',
        negativeText: '  ',
        neutralText: '',
    });

    expect(state.title).toBe(DEFAULT_TITLE);
    expect(state.buttons).toEqual([DEFAULT_BUTTON]);
});

test('showDialog — формирует кнопки в порядке positive/negative/neutral', () => {
    const state = getDialogState();

    void showDialog({
        content: 'Выберите действие',
        neutralText: 'Позже',
        positiveText: 'Подтвердить',
        negativeText: 'Отмена',
    });

    expect(state.buttons.map(button => button.option)).toEqual(['positive', 'negative', 'neutral']);
});

test('showDialog — не накапливает кнопки между открытиями', () => {
    const state = getDialogState();

    const firstPromise = showDialog({ content: 'Первый', positiveText: 'Да', negativeText: 'Нет' });
    closeDialog('positive');
    void firstPromise;

    void showDialog({ content: 'Второй', neutralText: 'Закрыть' });

    expect(state.buttons).toEqual([{ option: 'neutral', text: 'Закрыть' }]);
});

test('showDialog — при повторном открытии возвращает null и пишет ошибку', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const firstPromise = showDialog({ content: 'Первый' });
    const secondResult = await showDialog({ content: 'Второй' });

    expect(secondResult).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('Диалоговое окно уже открыто');

    closeDialog('positive');
    await expect(firstPromise).resolves.toBe('positive');
});

test('closeDialog — резолвит pending promise и закрывает диалог', async () => {
    const state = getDialogState();
    const pending = showDialog({ content: 'Подтвердите действие' });

    closeDialog('negative');

    await expect(pending).resolves.toBe('negative');
    expect(state.isOpen).toBe(false);
    expect(state.pendingResolve).toBeNull();
});

test('после closeDialog диалог можно открыть снова', async () => {
    const first = showDialog({ content: 'Первый' });
    closeDialog('positive');
    await expect(first).resolves.toBe('positive');

    const second = showDialog({ content: 'Второй' });
    closeDialog('negative');

    await expect(second).resolves.toBe('negative');
});
