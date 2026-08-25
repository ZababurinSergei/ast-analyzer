<script setup lang="ts"></script>
<template>
    <div class="ai-tabs-arrow-container">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M6.45686 6.45686C6.76928 6.14444 6.76928 5.63791 6.45686 5.32549L1.36569 0.23432C1.05327 -0.0780993 0.54674 -0.0780993 0.23432 0.23432C-0.0780993 0.54674 -0.0780993 1.05327 0.23432 1.36569L4.7598 5.89117L0.23432 10.4167C-0.0780993 10.7291 -0.0780993 11.2356 0.23432 11.548C0.54674 11.8604 1.05327 11.8604 1.36569 11.548L6.45686 6.45686ZM4.89117 5.89117V6.69117H5.89117V5.89117V5.09117H4.89117V5.89117Z"
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
