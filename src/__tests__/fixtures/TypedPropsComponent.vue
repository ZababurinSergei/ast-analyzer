<script setup lang="ts">
interface User {
  id: number;
  name: string;
}

defineProps<{
  stringProp: string;
  numberProp: number;
  booleanProp: boolean;
  arrayProp: string[];
  objectProp: User;
  optionalProp?: string;
}>();
</script>

<template>
  <div>{{ stringProp }}</div>
</template>
