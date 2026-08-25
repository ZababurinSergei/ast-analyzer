<script setup lang="ts"></script>
<template>
    <div class="ai-home-flag">
        <svg width="43" height="27" viewBox="0 0 43 27" xmlns="http://www.w3.org/2000/svg">
            <rect class="ai-home-rect" width="43" height="27" rx="3" fill="none" />
            <path
                class="ai-home-icon"
                d="M30.5979 11.7233L27.595 9.38102L25.6131 7.83953L22.4701 5.39718C21.9096 4.95676 21.1088 4.95676 20.5482 5.39718L12.4204 11.7233C12.1602 11.9235 12 12.2438 12 12.5841V13.0045C12 13.3649 12.3003 13.6652 12.6606 13.6652H14.2622V20.8721C14.2622 21.4527 14.7426 21.9332 15.3232 21.9332H19.5072V16.5279C19.5072 16.1676 19.8075 15.8673 20.1679 15.8673H22.8304C23.1908 15.8673 23.4911 16.1676 23.4911 16.5279V21.9332H27.6751C28.2557 21.9332 28.7361 21.4527 28.7361 20.8721V13.6652H30.3377C30.698 13.6652 30.9983 13.3649 30.9983 13.0045V12.5841C31.0183 12.2438 30.8582 11.9435 30.5979 11.7233Z"
                fill="var(--blue-700)"
            />
        </svg>
    </div>
</template>

<style scoped>
.ai-home-flag {
    display: flex;
}

.ai-home-rect {
    fill: none;
}

.ai-home-rect:hover {
    fill: var(--light-gray-100);
}

.ai-home-rect:active {
    fill: var(--light-gray-700);
}

.ai-home-icon {
    fill: var(--blue-700);
}
</style>
