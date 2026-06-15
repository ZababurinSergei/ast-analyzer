<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

defineProps<{
  title: string;
  count?: number;
}>();

defineEmits<{
  (e: 'update', value: number): void;
}>();

const { user } = useAuth();
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <slot name="actions" />
    <button @click="$emit('update', (count || 0) + 1)">Update</button>
  </div>
</template>

<style scoped>
h1 {
  color: blue;
}
</style>
