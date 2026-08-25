<template>
    <div class="selected-option-content">
        <component :is="icon" />
    </div>
</template>
<script setup lang="ts">
import type { SelectedOptionProps } from '../types';

defineProps<SelectedOptionProps>();
</script>
<style scoped>
.selected-option-content {
    background-color: var(--white);
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 25px;
}

.selected-option-content:hover {
    background-color: var(--light-gray-100);
}
</style>
