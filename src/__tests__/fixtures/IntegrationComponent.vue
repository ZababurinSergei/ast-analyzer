<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  items: string[];
}>();

const filteredItems = computed(() => props.items.filter(item => item.length > 0));
</script>

<template>
  <ul>
    <li v-for="item in filteredItems" :key="item">
      {{ item }}
    </li>
  </ul>
</template>
