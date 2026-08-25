<script setup lang="ts"></script>
<template>
    <div class="ai-tabs-arrow-container">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M0.234303 5.32549C-0.078117 5.63791 -0.0781172 6.14444 0.234302 6.45686L5.32547 11.548C5.63789 11.8604 6.14442 11.8604 6.45684 11.548C6.76926 11.2356 6.76926 10.7291 6.45684 10.4167L1.93136 5.89117L6.45684 1.36569C6.76926 1.05327 6.76926 0.546742 6.45684 0.234322C6.14443 -0.0780974 5.63789 -0.0780976 5.32547 0.234322L0.234303 5.32549ZM1.79999 5.89117L1.79999 5.09117L0.799988 5.09117L0.799988 5.89117L0.799987 6.69117L1.79999 6.69117L1.79999 5.89117Z"
                fill="var(--dark-900)"
                fill-opacity="0.5"
            />
        </svg>
    </div>
</template>
<style scoped>
.ai-tabs-arrow-container {
    height: 22px;
    width: 22px;
    display: flex;
    justify-content: center;
    align-items: center;
}
.ai-tabs-arrow-container:hover {
    cursor: pointer;
    background-color: #e5e5e5;
    border-radius: 4px;
}
.ai-tabs-arrow-container:hover {
    .ai-tabs-arrow path {
        fill-opacity: 0.8;
    }
}
</style>
