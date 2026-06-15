<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  disabled: false,
});
</script>

<template>
  <div>{{ title }}: {{ count }}</div>
</template>
