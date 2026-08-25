import AiModal from '@/components/ui/AiModal/AiModal.vue';
import ButtonToModal from '@/components/ui/AiModal/stories/decorators/ButtonToModal.vue';

export default {
    title: 'Компоненты/AiModal (в разработке)',
    component: AiModal,
    args: {
        title: 'Пример модального окна',
    },
};

export const Default = {
    name: 'Основной пример',
    render: () => ({
        components: { ButtonToModal },
        template: '<ButtonToModal />',
    }),
};
