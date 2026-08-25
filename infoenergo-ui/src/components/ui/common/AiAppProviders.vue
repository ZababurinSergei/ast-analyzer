<script lang="ts" setup>
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import { dateRuRU, ruRU } from 'naive-ui/lib/locales';
import AiDialog from '@/components/ui/AiDialog/AiDialog.vue';
import { libraryThemeOverrides } from '@/styles/libraryTheme';
import '@/styles/colors/colorTokens.css';
import '@/styles/fonts/global-font.css';
</script>

<template>
    <n-config-provider :date-locale="dateRuRU" :locale="ruRU" :theme-overrides="libraryThemeOverrides">
        <n-message-provider placement="bottom">
            <slot />
            <AiDialog />
        </n-message-provider>
    </n-config-provider>
</template>
