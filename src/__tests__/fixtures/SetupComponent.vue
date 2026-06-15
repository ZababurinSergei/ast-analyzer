<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
  count?: number;
}>();

defineEmits<{
  (e: 'update', value: number): void;
  (e: 'close'): void;
}>();

const message = ref('Hello');
</script>

<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <button @click="$emit('update', (count || 0) + 1)">Increment</button>
  </div>
</template>
