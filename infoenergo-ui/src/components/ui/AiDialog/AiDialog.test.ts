import { beforeEach, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AiDialog from '@/components/ui/AiDialog/AiDialog.vue';
import AiButton from '@/components/ui/AiButton/AiButton.vue';
import { closeDialog, getDialogState, showDialog } from '@/composables/AiDialog/store';

const modalStub = {
    name: 'NModal',
    props: ['show'],
    template: '<div v-if="show" class="n-modal-stub"><slot name="header" /><slot /></div>',
};

const configProviderStub = {
    name: 'NConfigProvider',
    template: '<div class="n-config-provider-stub"><slot /></div>',
};

const resetDialog = () => {
    const state = getDialogState();
    if (state.isOpen) {
        closeDialog('positive');
    }
};

const mountDialog = () =>
    mount(AiDialog, {
        global: {
            stubs: {
                NModal: modalStub,
                NConfigProvider: configProviderStub,
            },
        },
    });

beforeEach(() => {
    resetDialog();
});

test('AiDialog — отображает заголовок', async () => {
    mountDialog();

    void showDialog({
        title: 'Удалить запись?',
        content: 'Действие необратимо',
    });

    await nextTick();

    expect(document.body.textContent).toContain('Удалить запись?');
});

test('AiDialog — отображает контент', async () => {
    mountDialog();

    void showDialog({
        content: 'Действие необратимо',
    });

    await nextTick();

    expect(document.body.textContent).toContain('Действие необратимо');
});

test('AiDialog — отображает кнопки', async () => {
    const wrapper = mountDialog();

    void showDialog({
        content: 'Действие необратимо',
        positiveText: 'Да',
        negativeText: 'Нет',
    });

    await nextTick();

    const buttons = wrapper.findAllComponents(AiButton);
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.props('option')).toBe('positive');
    expect(buttons[1]?.props('option')).toBe('negative');
});

test('AiDialog — клик по кнопке закрывает диалог и резолвит выбор', async () => {
    const wrapper = mountDialog();

    const pending = showDialog({
        content: 'Подтвердите действие',
        positiveText: 'Ок',
    });
    await nextTick();

    const choiceButton = wrapper.findComponent(AiButton);
    expect(choiceButton.exists()).toBe(true);

    choiceButton.vm.$emit('click', 'positive');
    await nextTick();

    await expect(pending).resolves.toBe('positive');
    expect(getDialogState().isOpen).toBe(false);
});
