<template>
    <n-config-provider style="width: 100%" :theme-overrides="themeOverrides">
        <div class="header-cell">
            <div class="header-cell__caption-row">
                <span class="caption-row__text">{{ caption }}</span>
            </div>
            <div class="header-cell__filter" @pointerdown.stop>
                <FilterSelect :filter-type="dataType" @update:value="onFilterSelectUpdate" />
                <n-input
                    v-if="dataType !== 'boolean'"
                    class="header-cell__filter__input"
                    placeholder=""
                    :value="inputValue"
                    :bordered="false"
                    @click.stop
                    @input="onFilterInputUpdate"
                >
                    <template #suffix>
                        <div class="input-suffix">
                            <AiCrossIcon
                                v-if="inputValue"
                                class="input-suffix__cross-icon"
                                @click="onFilterInputClear"
                            />
                        </div>
                    </template>
                </n-input>
            </div>
        </div>
    </n-config-provider>
</template>
<script setup lang="ts">
import { NInput } from 'naive-ui';
import { themeOverrides } from '@/styles/AiHeaderCell/AiHeaderCellStyles';
import FilterSelect from './FilterSelect/FilterSelect.vue';
import { ref } from 'vue';
import type { HeaderCellEmits, HeaderCellProps } from './types';
import AiCrossIcon from '@/components/icons/AiCrossIcon.vue';

const props = defineProps<HeaderCellProps>();
const emit = defineEmits<HeaderCellEmits>();
const inputValue = ref<string | [string, string] | null>(null);

const onFilterInputUpdate = (value: string | [string, string]) => {
    inputValue.value = value;
    emit('update:filterInput', value, props.dataField ?? '');
};

const onFilterSelectUpdate = (filterOperation: string) => {
    emit('update:filterOperation', filterOperation, props.dataField ?? '');
};

const onFilterInputClear = () => {
    inputValue.value = null;
    emit('update:filterInput', null, props.dataField ?? '');
};
</script>

<style scoped lang="scss">
.header-cell {
    &__caption-row {
        height: 50px;
        display: flex;
        padding: 5px 22px 5px 10px;
        align-items: center;
    }

    &__filter {
        height: 25px;
        display: flex;
        justify-content: center;
        flex-direction: row;
        background: var(--white);
        border-top: 1px solid var(--light-gray-100);
    }
}

.caption-row__text {
    flex: 1;
    min-width: 0;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    overflow-wrap: break-word;
}

.input-suffix {
    display: flex;
    justify-content: center;
    align-items: center;
    padding-right: 5px;
    height: 100%;
    width: 10px;
    cursor: pointer;

    &__cross-icon {
        color: var(--gray-800);
        &:hover {
            color: var(--dark-700);
        }
    }
}

:deep(.selected-filter-option-label) {
    display: flex;
    justify-content: center;
}
</style>
