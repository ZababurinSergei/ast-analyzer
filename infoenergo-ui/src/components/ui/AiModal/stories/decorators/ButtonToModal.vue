<template>
    <n-button type="info" @click="showModal = true">Открыть модальное окно</n-button>
    <AiModal v-model:show="showModal" :is-dirty="isDirty" title="Пример модального окна">
        <template #header>
            <n-tag type="info"> Слот header </n-tag>
        </template>

        <template #header-extra>
            <n-tag type="info"> Слот header-extra </n-tag>
        </template>

        <OneColumnTable />

        <template #footer>
            <n-flex justify="center">
                <n-tag type="info" size="large"> Слот footer </n-tag>
            </n-flex>
        </template>
    </AiModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NButton, NTag, NFlex } from 'naive-ui';
import AiModal from '@/components/ui/AiModal/AiModal.vue';
import OneColumnTable from '@/components/ui/AiDataTable/examples/OneColumnTable.vue';

const showModal = ref(false);
const isDirty = ref(false);
</script>
