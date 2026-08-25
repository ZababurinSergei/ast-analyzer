<template>
    <n-config-provider abstract :theme-overrides="themeOverrides">
        <n-popselect
            v-model:show="show"
            :value="currentOptionValue"
            :options="options"
            placement="bottom-start"
            size="small"
            class="header-cell-filter"
        >
            <SelectedOption :icon="currentOption?.icon ?? DEFAULT_FILTER_ICON" />
        </n-popselect>
    </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NPopselect, NConfigProvider } from 'naive-ui';
import type { ExtendedFilterOption, HeaderCellFilterSelectProps, FilterSelectEmits } from '../types';
import {
    DEFAULT_FILTER_ICON,
    DEFAULT_FILTER_OPTION,
    getFilterOptions,
} from '@/components/ui/AiDataTable/components/FilterCell/defaults';
import SelectedOption from '@/components/ui/AiDataTable/components/FilterCell/SelectedOption/SelectedOption.vue';
import { themeOverrides } from '@/styles/AiFilterSelect/AiFilterSelectStyles';

const props = defineProps<HeaderCellFilterSelectProps>();
const emit = defineEmits<FilterSelectEmits>();

const show = ref(false);

const currentOptionValue = ref<string>(DEFAULT_FILTER_OPTION(props.filterType));

const options = computed<ExtendedFilterOption[]>(() => getFilterOptions(props.filterType, onSelectionChange));
const currentOption = computed<ExtendedFilterOption | undefined>(() =>
    getFilterOptions(props.filterType, onSelectionChange).find(option => option.value === currentOptionValue.value)
);

const onSelectionChange = (value: string) => {
    currentOptionValue.value = value;
    emit('update:value', value);
    show.value = false;
};
</script>

<style scoped lang="scss">
.header-cell-filter {
    height: 100%;
}
</style>
