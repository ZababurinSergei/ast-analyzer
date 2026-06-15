<script setup lang="ts">
// Component logic
</script>

<template>
  <div class="wrapper">
    <slot name="header" />
    <div class="content">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>
