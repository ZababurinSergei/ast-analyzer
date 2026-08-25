<template>
    <div class="filter-option-content" @click="() => onUpdate(value)">
        <div class="filter-option-icon">
            <component :is="icon" />
        </div>
        <span class="filter-option-label">{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
import type { SelectOptionProps } from '../types';

defineProps<SelectOptionProps>();
</script>

<style scoped>
.filter-option-content {
    width: 180px;
    height: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
}

.filter-option-content:hover {
    background-color: var(--light-gray-100);
}

.filter-option-content:active {
    background-color: var(--light-blue-800);
}

.filter-option-label {
    font-size: 13px;
    font-weight: 400;
    color: var(--dark-900);
}
.filter-option-icon {
    width: 50px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
