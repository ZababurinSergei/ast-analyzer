<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>

<template>
  <div>
    <span>{{ count }}</span>
  </div>
</template>

<style scoped>
div {
  color: red;
}
</style>

<style>
span {
  font-weight: bold;
}
</style>
