<template>
    <div class="ai-button-story-wrapper">
        <slot />
    </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.ai-button-story-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
}
</style>
