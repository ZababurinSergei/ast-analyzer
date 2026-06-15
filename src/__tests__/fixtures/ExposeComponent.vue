<script setup lang="ts">
import { ref } from 'vue';

const internalMethod = () => {
  console.log('internal');
};

const publicMethod = () => {
  console.log('public');
};

const publicValue = ref(42);

defineExpose({
  publicMethod,
  publicValue,
});
</script>

<template>
  <div>Component</div>
</template>
