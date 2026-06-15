<script setup lang="ts">
defineEmits<{
  (e: 'update', value: string): void;
  (e: 'delete', id: number): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <button @click="$emit('update', 'new value')">Update</button>
</template>
