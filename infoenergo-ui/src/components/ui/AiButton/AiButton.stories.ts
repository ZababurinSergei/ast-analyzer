import AiButton from '@/components/ui/AiButton/AiButton.vue';
import ButtonWrapper from '@/components/ui/AiButton/stories/decorators/ButtonWrapper.vue';
import DefaultButtonStoryContent from '@/components/ui/AiButton/stories/examples/DefaultButtonStoryContent.vue';
import ChoiceButtonStoryContent from '@/components/ui/AiButton/stories/examples/ChoiceButtonStoryContent.vue';

type StoryArgs = {
    iconDisabled: boolean;
    primaryDisabled: boolean;
    secondaryDisabled: boolean;
    tertiaryDisabled: boolean;
    iconPrimaryDisabled: boolean;
};

const buttonStoryDecorator = () => ({
    components: { ButtonWrapper },
    template: `
        <ButtonWrapper>
            <story />
        </ButtonWrapper>
    `,
});

export default {
    title: 'Компоненты/AiButton',
    component: AiButton,
    decorators: [buttonStoryDecorator],
};

export const ExampleDefault = {
    name: 'Default-режим',
    args: {
        iconDisabled: false,
        primaryDisabled: false,
        secondaryDisabled: false,
        tertiaryDisabled: false,
        iconPrimaryDisabled: false,
    },
    argTypes: {
        iconDisabled: {
            control: { type: 'boolean' },
            name: 'Кнопка icon неактивна',
        },
        primaryDisabled: {
            control: { type: 'boolean' },
            name: 'Кнопка primary неактивна',
        },
        secondaryDisabled: {
            control: { type: 'boolean' },
            name: 'Кнопка secondary неактивна',
        },
        tertiaryDisabled: {
            control: { type: 'boolean' },
            name: 'Кнопка tertiary неактивна',
        },
        iconPrimaryDisabled: {
            control: { type: 'boolean' },
            name: 'Кнопка primary с иконкой неактивна',
        },
    },
    render: (args: StoryArgs) => ({
        components: { DefaultButtonStoryContent },
        setup: () => ({ args }),
        template: `
            <DefaultButtonStoryContent v-bind="args" />
        `,
    }),
};

export const ExampleChoice = {
    name: 'Choice-режим',
    render: () => ({
        components: { ChoiceButtonStoryContent },
        setup: () => ({}),
        template: `
            <ChoiceButtonStoryContent />
        `,
    }),
};
