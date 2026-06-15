<script setup lang="ts">
import { ref } from 'vue';

const items = ref([1, 2, 3]);
const isVisible = ref(true);
const inputValue = ref('');

const handleClick = () => {};
const handleHover = () => {};
</script>

<template>
  <div>
    <p v-if="isVisible">Visible text</p>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
    <button v-on:click="handleClick" @mouseover="handleHover">Click</button>
    <input v-model="inputValue" />
  </div>
</template>
