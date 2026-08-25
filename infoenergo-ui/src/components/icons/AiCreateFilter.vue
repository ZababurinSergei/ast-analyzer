<script setup lang="ts"></script>

<template>
    <svg
        class="ai-create-filter"
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <circle class="ai-create-filter__bg" cx="12.5" cy="12.5" r="12.5" />
        <rect class="ai-create-filter__bar" x="5" y="8" width="15" height="2" rx="1" />
        <rect class="ai-create-filter__bar" x="8" y="12" width="9" height="2" rx="1" />
        <rect class="ai-create-filter__bar" x="10" y="16" width="5" height="2" rx="1" />
    </svg>
</template>

<style scoped>
.ai-create-filter__bg {
    fill: var(--light-blue-100);
}

.ai-create-filter__bar {
    fill: var(--blue-700);
}
</style>
