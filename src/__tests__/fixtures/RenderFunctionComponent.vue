<script setup lang="ts">
import { h } from 'vue';

defineProps<{
  message: string;
}>();

const render = () => h('div', 'message');
</script>
