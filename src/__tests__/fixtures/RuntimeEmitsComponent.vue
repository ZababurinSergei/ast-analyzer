<script setup lang="ts">
const emit = defineEmits(['update', 'delete', 'close']);
</script>

<template>
  <button @click="emit('update', 'value')">Update</button>
</template>
