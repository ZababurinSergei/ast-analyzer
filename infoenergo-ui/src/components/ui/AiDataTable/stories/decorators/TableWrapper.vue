<template>
    <div :style="{ width, height }">
        <slot />
    </div>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        width?: string;
        height?: string;
    }>(),
    {
        width: '100%',
        height: '500px',
    }
);
</script>
