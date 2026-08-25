<template>
  <div class="info-ui-data-tree-scroll-container" ref="scrollContainer" @wheel="onWheel">
    <n-data-table :columns="meta.columns"
                  :data="visibleData"
                  :bordered="false"
                  :max-height="328"
                  :min-height="328"
                  :scrollbar-props="{'content-class':'info-ui-n-data-table-y-scroll-none', 'y-placement': 'left', trigger: 'none'}"
                  @scroll="onScroll"
    />
    <div class="info-ui-data-tree-scroll-bar" @scroll="onScroll">
      <div class="scroll-track" :style="{ height: scrollTrackHeight + 'px' }"></div>
    </div>
  </div>
</template>
<script setup>
import {NDataTable} from 'naive-ui';
import {computed, h, onBeforeMount, onMounted, ref} from 'vue';
import {RuDataTreeBuffer} from '@/RuDataTreeComponent/RuDataTree/classes/RuDataTreeBuffer.js';

const containerHeight = ref(0);
const scrollContainer = ref(null);
const scrollTrackHeight = ref(1024);
const scrollPosition = ref(0);
const resizeObserver = ref(null);
const visibleItemsCount = ref(0);
const visibleData = ref([]);

async function onExpandClick(row) {
  if ((row.expanded !== null) && (row.expanded === false)) {
    row.expanded = true;
    await props.getNextPageDataCallback(0, row.dataRow[props.meta.keyName]);
    scrollTrackHeight.value = (_data.length / visibleItemsCount.value) * containerHeight.value;
    visibleData.value = await getVisibleData();
  } else if ((row.expanded !== null) && (row.expanded === true)) {
    _data.collapseChild(row);
    row.expanded = false;
    visibleData.value = await getVisibleData();
  }
  //console.log('onExpandClick: e.column', row.column, 'e.rowData:', row.rowData)

}

async function getVisibleData() {
  let data = await getVisibleDataRec();
  data = data.filter(item => item !== null);
  return data;
}

const headerHeight = computed(() =>
    props.meta.rowHeaderHeight ? parseInt(props.meta.rowHeaderHeight) : 70
);
const rowHeight = computed(() =>
    props.meta.rowHeight ? parseInt(props.meta.rowHeight) : 26
);

const props = defineProps({
  meta: {
    type: Object
  },
  refCallbacks: {
    type: Object,
    default: () => {
      return {
        setRefreshDataFunc: () => {
        },
        setNextPageDataFunc: () => {
        }
      };
    }
  },
  getNextPageDataCallback: {
    type: Function,
    default: () => {
    }
  }
});

onBeforeMount(() => {

});

onMounted(() => {
  initColumnsCell();
  props.refCallbacks.setRefreshDataFunc(refreshData);
  props.refCallbacks.setNextPageDataFunc(nextPageData);
  setupResizeObserver();
  console.log('resizeObserver.value: ', resizeObserver.value);
});

function initColumnsCell() {
  for (let _i in props.meta.columns) {
    const i = Number.parseInt(_i);
    if (i === 0) {
      props.meta.columns[i]['render'] = cellNodeRenderFunc(props.meta.columns[i].field);
    } else {
      props.meta.columns[i]['render'] = cellRenderFunc(props.meta.columns[i].field);
    }
  }
}

const cellNodeRenderFunc = (customKey = null) => {
  return (row, index, key) => {
    //       // Вычисляем отступ на основе уровня
    const indent = (row.levelMap?.size - 1) * 15; // 20px на каждый уровень
    const actualKey = customKey || key;
    // Вычисляем отступ на основе уровня
    // .info-ui-data-tree-node-cell
    const text = row.dataRow[actualKey];
    return h('div', {class: 'info-ui-data-tree-node-cell'},
        [
          h('span', {
            class: 'info-ui-data-tree-node-cell-expand', style: {
              'padding-left': `${indent}px`,
              'min-width': indent === 0 ? `${indent}px` : '0'
            },
            onClick: (event) => {
              if (row.dataRow[props.meta.hasChildName]) {
                onExpandClick(row);
                console.log('Клик по элементу', event);
              }
            }
          }, row.dataRow[props.meta.hasChildName] ? (row._expanded ? '▼' : '˃') : '∙'),
          h('span', {class: 'tree-node-cell-text'}, text)
        ]);
  };
};

const cellRenderFunc = (customKey = null) => {
  return (row, index, key) => {
    const actualKey = customKey || key;
    // Вычисляем отступ на основе уровня
    const text = row.dataRow[actualKey];
    return h('div', text);
  };
};
// TreeDataArray
let _data = new RuDataTreeBuffer(props.meta.keyName, props.meta.keyParentName, props.meta.hasChildName);

async function refreshData(data, servDataLength) {
  await props.getNextPageDataCallback(0, null);
  scrollTrackHeight.value = (_data.length / visibleItemsCount.value) * containerHeight.value;
  visibleData.value = await getVisibleData();

  console.log('visibleData.value', visibleData.value);
}

// список раскрытых узлов
const expandedMap = new Map();

function nextPageData(data, servDataLength, startPosition, keyParent) {
  if (keyParent === undefined) {
    throw Error('function nextPageData обязательный параметр "keyParent" === undefined');
  }
  // регистрируем ключ в списке раскрытых если он еще не был раскрыт
  if (!expandedMap.has(keyParent)) {
    expandedMap.set(keyParent, servDataLength);
    if (keyParent === null) {
      // вставка первых root элементов
      // _data.add(0, data)
    }
  }
  _data.add(startPosition, keyParent, data, servDataLength);
  scrollTrackHeight.value = (_data.length / visibleItemsCount.value) * containerHeight.value;
}

// расчет данных для видимых строк
let lastVisibleDataResult = null;
const emit = defineEmits(['scroll']);

async function getVisibleDataRec() {
  emit('scroll', scrollPosition.value);
  if (visibleItemsCount.value === 0) {
    calculateVisibleItems();
  }
  if (_data.length === 0) {
    return [];
  }
  if (_data.length <= scrollPosition.value + visibleItemsCount.value) {

    // Получаем элемент скроллбара

    const scrollBar = scrollContainer.value.querySelector('.info-ui-data-tree-scroll-bar');
    if (scrollBar.scrollTop <= 0) {
      visibleItemsCount.value = visibleItemsCount.value - (scrollPosition.value + visibleItemsCount.value - _data.length);
    }
  }
  const result = _data.getDataArray(scrollPosition.value, visibleItemsCount.value);

  let nullCount = result.filter((row) => row === null).length;
  if (nullCount !== 0) {
    let notNullRow = undefined;
    for (const row of result) {
      if (row !== null) {
        notNullRow = row;
      }
      if (row === null) {
        break;
      }
    }
    if (notNullRow) {
      const loadStatus = _data.loadStatus(notNullRow.dataRow[props.meta.keyParentName]);
      if (loadStatus.childrensTotal > loadStatus.childrensLoaded) {
        const startIndex = notNullRow.localPosition + 1;


        // const startIndex = _data.getIndexByKey(props.meta.keyName, notNullRow.dataRow[props.meta.keyName]) + 1;
        await props.getNextPageDataCallback(startIndex, notNullRow.dataRow[props.meta.keyParentName]);
        if (lastVisibleDataResult !== nullCount) {
          lastVisibleDataResult = nullCount;
          return await getVisibleData();
        } else {
          return trimEndNull(result);
        }
      } else {
        const startIndex = notNullRow.localPosition + 1;


        // const startIndex = _data.getIndexByKey(props.meta.keyName, notNullRow.dataRow[props.meta.keyName]) + 1;
        await props.getNextPageDataCallback(startIndex, notNullRow.dataRow[props.meta.keyParentName]);
        if (lastVisibleDataResult !== nullCount) {
          lastVisibleDataResult = nullCount;
          return await getVisibleData();
        } else {
          return result;
        }
      }
    } else {
      const LocalPositionRes = _data.flatDataTree.getLocalPositionByGlobalPosition(scrollPosition.value);
      await props.getNextPageDataCallback(LocalPositionRes.localPosition - 1, LocalPositionRes.idParent);
      if (lastVisibleDataResult !== nullCount) {
        lastVisibleDataResult = nullCount;
        return await getVisibleData();
      } else {
        return result;
      }
    }
  } else {
    calculateLevelMap(result);
  }
  // return Array.from({ length: 20 }, () => null);
  return result;

  function trimEndNull(rows) {
    if (rows.length === 0) {
      return rows;
    }
    let newLength = rows.length;
    for (let i = rows.length - 1; i > -1; i--) {
      if (rows[i] === null) {
        newLength--;
      } else {
        break;
      }
    }
    rows.length = newLength;
    return rows;
  }
}

function calculateLevelMap(data) {
  for (const row of data) {
    const levelMap = new Map();
    const path = _data.flatDataTree.getParentItems(row.globalPosition);
    for (const row of path) {
      levelMap.set(path.indexOf(row), {idNode: row.idNode, nextSibling: row.nextSibling});
    }
    row.levelMap = levelMap;
  }
  return data;
}

function setupResizeObserver() {
  resizeObserver.value = new ResizeObserver((entries) => {
    for (let entry of entries) {
      containerHeight.value = scrollContainer.value.clientHeight;
      calculateVisibleItems();
    }
  });
  if (containerHeight.value === 0) {
    containerHeight.value = scrollContainer.value.clientHeight;
    calculateVisibleItems();
  }
  resizeObserver.value.observe(scrollContainer.value);
}

function calculateVisibleItems() {
  const availableHeight = containerHeight.value - headerHeight.value - 10;
  const tempVisibleItemsCount = Math.max(1, Math.floor(availableHeight / rowHeight.value));
  visibleItemsCount.value = tempVisibleItemsCount >= 0 ? tempVisibleItemsCount : 0;
}

// обработка события прокрутки
function onWheel(event) {
  // Предотвращаем стандартное поведение прокрутки
  event.preventDefault();
  // Получаем элемент скроллбара
  const scrollBar = scrollContainer.value.querySelector('.info-ui-data-tree-scroll-bar');

  // Изменяем позицию скролла
  scrollBar.scrollTop += event.deltaY;

  // Вызываем наш обработчик скролла
  onScroll({
    target: scrollBar,
    scrollTop: scrollBar.scrollTop,
    wheel: true
  });
  console.log('scrollBar.scrollTop: ' + scrollBar.scrollTop);
}

let scrollTimout = null;

async function onScroll(event) {
  if (scrollTimout) {
    clearTimeout(scrollTimout);
  }
  scrollTimout = setTimeout(async () => {
    const scrollTop = event.target.scrollTop;
    // const scrollHeight = rowHeight * _data.length + headerHeight;
    const maxScrollTop = event.target.scrollHeight - event.target.clientHeight;

    let k = scrollTop / maxScrollTop;
    scrollPosition.value = Math.floor((k) * (_data.length - visibleItemsCount.value));
    // console.log('onScroll scrollPosition.value: ', scrollPosition.value)
    visibleData.value = await getVisibleData();
  }, 100);
}

// // Пример данных для таблицы
// const columns = [
//   {
//     title: 'ID',
//     key: 'id',
//     width: 200,
//     render: (row) => {
//       // Вычисляем отступ на основе уровня
//       const indent = (row.level) * 15; // 20px на каждый уровень
//       return h('div', {class: 'tree-node-cell'}, [h('span', {
//         class: 'tree-node-cell-expand', style: {
//           'padding-left': `${indent}px`,
//           'min-width': indent === 0 ? `${indent}px` : '0'
//         }
//       }, row.count ? (row.expanded ? '▼' : '˃') : '∙'), h('span', {class: 'tree-node-cell-text'}, row.id)]);
//     }
//   },
//   {
//     title: 'level',
//     key: 'level',
//   },
//   {
//     title: 'Name',
//     key: 'name',
//
//   },
//   {
//     title: 'Age',
//     key: 'age'
//   }
// ];
//
// const data = [
//   {
//     id: 1,
//     level: 3,
//     name: 'John Brown',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 2,
//     level: 3,
//     name: 'Jim Green',
//     expanded: false,
//     count: 0,
//     age: 42
//   },
//   {
//     id: 3,
//     level: 3,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 4,
//     level: 3,
//     name: 'Joe Black',
//     expanded: false,
//     count: 4,
//     age: 32
//   },
//   {
//     id: 5,
//     level: 3,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 6,
//     level: 3,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 7,
//     level: 2,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 8,
//     level: 2,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 9,
//     level: 2,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 10,
//     level: 1,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 11,
//     level: 1,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 12,
//     level: 1,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 13,
//     level: 0,
//     name: 'Joe Black',
//     expanded: false,
//     count: 0,
//     age: 32
//   },
//   {
//     id: 14,
//     level: 0,
//     name: 'Joe Black',
//     expanded: false,
//     count: 5,
//     age: 32
//   },
//   {
//     id: 15,
//     level: 0,
//     name: 'Joe Black',
//     expanded: false,
//     count: 1,
//     age: 32
//   },
//   {
//     id: 16,
//     level: 0,
//     name: 'Joe Black',
//     expanded: true,
//     count: 1,
//     age: 32
//   },
//   {
//     id: 17,
//     level: 1,
//     name: 'Joe Black',
//     expanded: false,
//     count: 2,
//     age: 32
//   }
// ];
</script>
<style scoped>
.info-ui-data-tree-scroll-container {
  display: flex;
  height: 100%; /* Начальная высота, можно изменить или сделать динамической */
  overflow: hidden;
  background-color: #deded9;
  position: relative; /* Для корректного позиционирования */
}

.info-ui-data-tree-scroll-bar {
  width: 20px !important;

  margin-left: 2px;
  background-color: #f0f0f0;
  overflow-y: scroll;
  height: 427px;

  .scroll-track {
    background-color: #c0c0c0;
  }
}

:deep(.tree-node-cell) {
  display: flex;
  font-family: 'Anka Coder', monospace;
}

:deep(.tree-node-cell-expand) {
  display: flex;
  padding-left: 20px;
}

:deep(.tree-node-cell-text) {
  display: flex;
  padding-left: 10px;
}

:deep(.info-ui-n-data-table-y-scroll-none) {
  overflow-y: hidden;
}

/* Или более специфично */
:deep(.n-scrollbar-rail__scrollbar) {
  opacity: 0 !important;
  visibility: hidden !important;
}
</style>
