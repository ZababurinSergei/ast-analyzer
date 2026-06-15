<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
  count?: number;
}>();

defineEmits<{
  update: [value: number];
}>();

const message = ref('Hello');
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('update', count || 0 + 1)">Update</button>
  </div>
</template>

<style scoped>
h1 {
  color: blue;
}
</style>
