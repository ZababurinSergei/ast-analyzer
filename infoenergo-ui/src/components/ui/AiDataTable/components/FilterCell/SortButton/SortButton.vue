<template>
    <div class="column-sorter">
        <div class="column-sorter__icon" :style="{ transform: `rotate(${order === 'ascend' ? 180 : 0}deg)` }">
            <SortIcon class="icon" />
        </div>
    </div>
</template>
<script setup lang="ts">
import SortIcon from '@/components/icons/sort/SortIcon.vue';
import type { SortButtonProps } from '@/components/ui/AiDataTable/components/FilterCell/types';
import { computed } from 'vue';

const props = withDefaults(defineProps<SortButtonProps>(), {
    order: false,
});

const opacity = computed(() => {
    return props.order === 'ascend' || props.order === 'descend' ? 1 : 0;
});
</script>
<style scoped lang="scss">
.column-sorter {
    position: absolute;
    right: 10px;
    display: flex;
    align-items: center;
    margin-bottom: 25px;
}

.column-sorter__icon {
    display: inline-flex;
    transition: transform 0.2s ease;
    opacity: v-bind(opacity);
}

.icon {
    color: var(--gray-800);
    &:hover {
        color: var(--dark-700);
    }
}
</style>
