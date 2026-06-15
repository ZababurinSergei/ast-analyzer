<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    required: true,
    default: 'Default Title',
  },
  count: {
    type: Number,
    default: 0,
  },
  disabled: Boolean,
});
</script>

<template>
  <div>{{ title }}: {{ count }}</div>
</template>
