<template>
  <div class="app-div">
    <div>any top content</div>
    <div>info-ui-data-tree</div>
    <info-ui-data-tree
        :meta="meta"
        :refCallbacks="{
        setRefreshDataFunc: setRefreshDataFunc,
        setNextPageDataFunc: setNextPageDataFunc
      }"
        :getNextPageDataCallback="getNextPageDataCallback"
    />

    <div>any bottom content</div>
    <div>any bottom content</div>
    <div>any bottom content</div>
  </div>
</template>
<script setup>
import InfoUiDataTree from '@/RuDataTreeComponent/info-ui-data-tree.vue';
import {h, onMounted} from 'vue';

const pageSize = 20;
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

const meta = {
  keyName: 'id',
  keyParentName: 'id_parent',
  positionInParentName: 'pos',
  firstColumnId: 'id',
  hasChildName: 'child_count',
  levelColumnName: 'level',
  columns: [
    {
      field: 'id',
      id: 'id',
      caption: 'id',
      data_type: 'integer',
      visible: true,
      title: 'id',
      key: 'id',
      width: 200,
    },
    {
      field: 'id_parent',
      id: 'id_parent',
      caption: 'id_parent',
      data_type: 'integer',
      sorting: false,
      visible: true,
      title: 'id_parent',
      key: 'id_parent',
    },
    {
      caption: 'eobj_id Пример текста длинного заголовка колонки',
      field: 'eobj_id',
      id: 'eobj_id',
      width: 250,
      title: 'eobj_id Пример текста длинного заголовка колонки',
      key: 'eobj_id',
    },
    {
      caption: 'supply_id',
      field: 'supply_id',
      id: 'supply_id',
      sorting: false,
      title: 'supply_id',
      key: 'supply_id',
    },
    {
      caption: '',
      field: 'child_count',
      id: 'child_count',
      title: 'child_count',
      key: 'child_count',
    },
  ],
  dataPages: true,
  servPageSize: pageSize,
  rowHeaderHeight: 70,
  rowHeight: 47,
  sortMode: 'single',
};


onMounted(async () => {
  // получаем данные от сервера
  const dataResult = await fetch(0, pageSize - 1, null);
  // вызов метода refreshData в компоненте ru-data-tree
  refreshData(dataResult.data, dataResult.totalCount);
});

// получает и сохраняет функцию refreshData компонента ru-data-tree
function setRefreshDataFunc(func) {
  refreshData = func;
}

// получает и сохраняет функцию setNextPageData компонента ru-data-tree
function setNextPageDataFunc(func) {
  setNextPageData = func;
}

// переменная для функции refreshData из компонента ru-data-tree
let refreshData = null;
// переменная для функции setNextPageData из компонента ru-data-tree
let setNextPageData = null;
const onScroll = (position) => {
  // console.log('onScroll:', position)
};

// Передается компоненту ru-data-tree в params.getNextPageDataCallback вызывается компонентом ru-data-tree
async function getNextPageDataCallback(position, parent_id) {
  // запускает получение данных с сервера (если setNextPageData функция уже не null)
  if (setNextPageData) {
    console.log('getNextPageDataCallback:', position, 'parent_id: ', parent_id);
    const dataResult = await fetch(position, position + pageSize, parent_id);
    // вызывает функцию setNextPageData в компоненте ru-data-tree
    await setNextPageData(dataResult.data, dataResult.totalCount, position, parent_id);
  }
}

async function fetch(positionStart, positionEnd, parentKey) {
  return new Promise((resolve) => {
    function getDataParent(keyParent) {
      let _keyParent = null;
      if (keyParent === undefined) {
        _keyParent = null;
      } else {
        _keyParent = keyParent;
      }
      return data.filter((item) => item[meta.keyParentName] === _keyParent);
    }

    setTimeout(() => {
      const parentData = getDataParent(parentKey);
      let dataResult = [];
      // if (positionStart >= parentData.length){
      //   throw Error('error: 4ea68e5a-9c4f-4489-ba20-ed9fb95406f6')
      // }
      if (positionEnd >= parentData.length) {
        dataResult = parentData.slice(positionStart, parentData.length);
      } else {
        dataResult = parentData.slice(positionStart, positionEnd);
      }
      let index = positionStart;
      for (const row of dataResult) {
        row.pos = index;
        index++;
      }

      resolve({
        data: dataResult,
        totalCount: parentData.length,
      });
    }, 100);
  });
}

const data = [
  {id: 0, id_parent: null, eobj_id: 541, supply_id: 322, child_count: 31, level: 0},
  {id: 1, id_parent: 0, eobj_id: 23, supply_id: 114, child_count: 1, level: 1},
  {id: 2, id_parent: 1, eobj_id: 23, supply_id: 215, child_count: 1, level: 2},
  {id: 2001, id_parent: 2, eobj_id: 23, supply_id: 277, child_count: 0, level: 3},
  {id: 3, id_parent: 0, eobj_id: 24, supply_id: 314, child_count: 1, level: 1},
  {id: 2000, id_parent: 3, eobj_id: 33, supply_id: 315, child_count: 0, level: 2},
  {id: 4, id_parent: 0, eobj_id: 24, supply_id: 415, child_count: 0, level: 1},
  {id: 5, id_parent: 0, eobj_id: 25, supply_id: 516, child_count: 0, level: 1},
  {id: 6, id_parent: 0, eobj_id: 26, supply_id: 617, child_count: 0, level: 1},
  {id: 7, id_parent: 0, eobj_id: 27, supply_id: 718, child_count: 0, level: 1},
  {id: 8, id_parent: 0, eobj_id: 23, supply_id: 819, child_count: 0, level: 1},
  {id: 9, id_parent: 0, eobj_id: 24, supply_id: 920, child_count: 0, level: 1},
  {id: 10, id_parent: 0, eobj_id: 25, supply_id: 105, child_count: 0, level: 1},
  {id: 11, id_parent: 0, eobj_id: 26, supply_id: 203, child_count: 0, level: 1},
  {id: 12, id_parent: 0, eobj_id: 27, supply_id: 307, child_count: 0, level: 1},
  {id: 13, id_parent: 0, eobj_id: 23, supply_id: 401, child_count: 0, level: 1},
  {id: 14, id_parent: 0, eobj_id: 24, supply_id: 502, child_count: 0, level: 1},
  {id: 15, id_parent: 0, eobj_id: 25, supply_id: 604, child_count: 0, level: 1},
  {id: 16, id_parent: 0, eobj_id: 26, supply_id: 708, child_count: 0, level: 1},
  {id: 17, id_parent: 0, eobj_id: 27, supply_id: 806, child_count: 0, level: 1},
  {id: 18, id_parent: 0, eobj_id: 23, supply_id: 909, child_count: 0, level: 1},
  {id: 19, id_parent: 0, eobj_id: 24, supply_id: 110, child_count: 0, level: 1},
  {id: 20, id_parent: 0, eobj_id: 25, supply_id: 220, child_count: 0, level: 1},
  {id: 21, id_parent: 0, eobj_id: 26, supply_id: 330, child_count: 0, level: 1},
  {id: 22, id_parent: 0, eobj_id: 27, supply_id: 440, child_count: 0, level: 1},
  {id: 23, id_parent: 0, eobj_id: 23, supply_id: 550, child_count: 0, level: 1},
  {id: 24, id_parent: 0, eobj_id: 24, supply_id: 660, child_count: 0, level: 1},
  {id: 25, id_parent: 0, eobj_id: 25, supply_id: 770, child_count: 0, level: 1},
  {id: 26, id_parent: 0, eobj_id: 26, supply_id: 880, child_count: 0, level: 1},
  {id: 27, id_parent: 0, eobj_id: 27, supply_id: 990, child_count: 2, level: 1},
  {id: 270, id_parent: 27, eobj_id: 27, supply_id: 990, child_count: 0, level: 2},
  {id: 271, id_parent: 27, eobj_id: 28, supply_id: 991, child_count: 0, level: 2},
  {id: 28, id_parent: 0, eobj_id: 23, supply_id: 123, child_count: 0, level: 1},
  {id: 29, id_parent: 0, eobj_id: 24, supply_id: 234, child_count: 0, level: 1},
  {id: 30, id_parent: 0, eobj_id: 25, supply_id: 345, child_count: 0, level: 1},
  {id: 31, id_parent: 0, eobj_id: 26, supply_id: 456, child_count: 0, level: 1},
  {id: 32, id_parent: 0, eobj_id: 27, supply_id: 567, child_count: 1, level: 1},
  {id: 33, id_parent: 32, eobj_id: 23, supply_id: 678, child_count: 0, level: 2},
  {id: 34, id_parent: null, eobj_id: 24, supply_id: 789, child_count: 0, level: 0},
  {id: 35, id_parent: null, eobj_id: 25, supply_id: 890, child_count: 0, level: 0},
  {id: 36, id_parent: null, eobj_id: 26, supply_id: 901, child_count: 0, level: 0},
  {id: 37, id_parent: null, eobj_id: 27, supply_id: 112, child_count: 0, level: 0},
  {id: 38, id_parent: null, eobj_id: 23, supply_id: 223, child_count: 0, level: 0},
  {id: 39, id_parent: null, eobj_id: 24, supply_id: 334, child_count: 0, level: 0},
  {id: 40, id_parent: null, eobj_id: 25, supply_id: 445, child_count: 0, level: 0},
  {id: 41, id_parent: null, eobj_id: 26, supply_id: 556, child_count: 0, level: 0},
  {id: 42, id_parent: null, eobj_id: 27, supply_id: 667, child_count: 0, level: 0},
  {id: 43, id_parent: null, eobj_id: 23, supply_id: 778, child_count: 0, level: 0},
  {id: 44, id_parent: null, eobj_id: 24, supply_id: 889, child_count: 0, level: 0},
  {id: 45, id_parent: null, eobj_id: 25, supply_id: 991, child_count: 0, level: 0},
  {id: 46, id_parent: null, eobj_id: 26, supply_id: 100, child_count: 0, level: 0},
  {id: 47, id_parent: null, eobj_id: 27, supply_id: 200, child_count: 0, level: 0},
  {id: 48, id_parent: null, eobj_id: 23, supply_id: 300, child_count: 0, level: 0},
  {id: 49, id_parent: null, eobj_id: 24, supply_id: 400, child_count: 1, level: 0},
  {id: 490, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 491, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 492, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 1, level: 0},
  {
    id: 594,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 595,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 596,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 597,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 598,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 599,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 600,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 601,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 602,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 603,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 604,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 605,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 606,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 607,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 608,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 609,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 610,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 611,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 612,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 613,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 614,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 615,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 616,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 617,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 618,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 619,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 620,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 621,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 622,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 623,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 624,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 625,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 626,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 627,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 628,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 629,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 630,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 631,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 632,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 633,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 634,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 635,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 636,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 637,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 638,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 639,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 640,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 641,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {
    id: 642,
    id_parent: 492,
    eobj_id: 24,
    supply_id: 407,
    child_count: 0,
    level: 0,
  },
  {
    id: 643,
    id_parent: 492,
    eobj_id: 21,
    supply_id: 409,
    child_count: 0,
    level: 0,
  },
  {id: 493, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 494, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 495, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 496, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 497, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 498, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 499, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 500, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 501, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 502, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 503, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 504, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 505, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 506, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 507, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 508, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 509, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 510, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 511, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 512, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 513, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 514, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 515, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 516, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 517, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 518, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 519, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 520, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 521, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 522, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 523, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 524, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 525, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 526, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 527, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 528, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 529, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 530, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 531, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 532, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 533, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 534, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 535, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 536, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 537, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 538, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 539, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 540, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 541, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 542, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 543, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 544, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 545, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 546, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 547, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 548, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 549, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 550, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 551, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 552, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 553, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 554, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 555, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 556, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 557, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 558, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 559, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 560, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 561, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 562, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 563, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 564, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 565, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 566, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 567, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 568, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 569, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 570, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 571, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 572, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 573, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 574, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 575, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 576, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 577, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 578, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 579, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 580, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 581, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 582, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 583, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 584, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 585, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 586, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 587, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 588, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 589, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 590, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 591, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 592, id_parent: 49, eobj_id: 24, supply_id: 407, child_count: 0, level: 0},
  {id: 593, id_parent: 49, eobj_id: 21, supply_id: 409, child_count: 0, level: 0},
  {id: 50, id_parent: null, eobj_id: 25, supply_id: 500, child_count: 0, level: 0},
  {id: 51, id_parent: null, eobj_id: 26, supply_id: 600, child_count: 0, level: 0},
  {id: 52, id_parent: null, eobj_id: 27, supply_id: 700, child_count: 0, level: 0},
  {id: 53, id_parent: null, eobj_id: 23, supply_id: 800, child_count: 0, level: 0},
  {id: 54, id_parent: null, eobj_id: 24, supply_id: 900, child_count: 0, level: 0},
  {id: 55, id_parent: null, eobj_id: 25, supply_id: 101, child_count: 0, level: 0},
  {id: 56, id_parent: null, eobj_id: 26, supply_id: 202, child_count: 0, level: 0},
  {id: 57, id_parent: null, eobj_id: 27, supply_id: 303, child_count: 0, level: 0},
  {id: 58, id_parent: null, eobj_id: 23, supply_id: 404, child_count: 0, level: 0},
  {id: 59, id_parent: null, eobj_id: 24, supply_id: 505, child_count: 0, level: 0},
  {id: 60, id_parent: null, eobj_id: 25, supply_id: 606, child_count: 0, level: 0},
  {id: 61, id_parent: null, eobj_id: 26, supply_id: 707, child_count: 0, level: 0},
  {id: 62, id_parent: null, eobj_id: 27, supply_id: 808, child_count: 0, level: 0},
  {id: 63, id_parent: null, eobj_id: 23, supply_id: 909, child_count: 0, level: 0},
  {id: 64, id_parent: null, eobj_id: 24, supply_id: 121, child_count: 0, level: 0},
  {id: 65, id_parent: null, eobj_id: 25, supply_id: 232, child_count: 0, level: 0},
  {id: 66, id_parent: null, eobj_id: 26, supply_id: 343, child_count: 0, level: 0},
  {id: 67, id_parent: null, eobj_id: 27, supply_id: 454, child_count: 0, level: 0},
  {id: 68, id_parent: null, eobj_id: 23, supply_id: 565, child_count: 0, level: 0},
  {id: 69, id_parent: null, eobj_id: 24, supply_id: 676, child_count: 0, level: 0},
  {id: 70, id_parent: null, eobj_id: 25, supply_id: 787, child_count: 0, level: 0},
  {id: 71, id_parent: null, eobj_id: 26, supply_id: 898, child_count: 0, level: 0},
  {id: 72, id_parent: null, eobj_id: 27, supply_id: 919, child_count: 0, level: 0},
  {id: 73, id_parent: null, eobj_id: 23, supply_id: 131, child_count: 0, level: 0},
  {id: 74, id_parent: null, eobj_id: 24, supply_id: 242, child_count: 0, level: 0},
  {id: 75, id_parent: null, eobj_id: 25, supply_id: 353, child_count: 0, level: 0},
  {id: 76, id_parent: null, eobj_id: 26, supply_id: 464, child_count: 0, level: 0},
  {id: 77, id_parent: null, eobj_id: 27, supply_id: 575, child_count: 0, level: 0},
  {id: 78, id_parent: null, eobj_id: 23, supply_id: 686, child_count: 0, level: 0},
  {id: 79, id_parent: null, eobj_id: 24, supply_id: 797, child_count: 0, level: 0},
  {id: 80, id_parent: null, eobj_id: 25, supply_id: 818, child_count: 0, level: 0},
  {id: 81, id_parent: null, eobj_id: 26, supply_id: 929, child_count: 0, level: 0},
  {id: 82, id_parent: null, eobj_id: 27, supply_id: 141, child_count: 0, level: 0},
  {id: 83, id_parent: null, eobj_id: 23, supply_id: 252, child_count: 0, level: 0},
  {id: 84, id_parent: null, eobj_id: 24, supply_id: 363, child_count: 0, level: 0},
  {id: 85, id_parent: null, eobj_id: 25, supply_id: 474, child_count: 0, level: 0},
  {id: 86, id_parent: null, eobj_id: 26, supply_id: 585, child_count: 0, level: 0},
  {id: 87, id_parent: null, eobj_id: 27, supply_id: 696, child_count: 0, level: 0},
  {id: 88, id_parent: null, eobj_id: 23, supply_id: 717, child_count: 0, level: 0},
  {id: 89, id_parent: null, eobj_id: 24, supply_id: 828, child_count: 0, level: 0},
  {id: 90, id_parent: null, eobj_id: 25, supply_id: 939, child_count: 0, level: 0},
  {id: 91, id_parent: null, eobj_id: 26, supply_id: 151, child_count: 0, level: 0},
  {id: 92, id_parent: null, eobj_id: 27, supply_id: 262, child_count: 0, level: 0},
  {id: 93, id_parent: null, eobj_id: 23, supply_id: 373, child_count: 0, level: 0},
  {id: 94, id_parent: null, eobj_id: 24, supply_id: 484, child_count: 0, level: 0},
  {id: 95, id_parent: null, eobj_id: 25, supply_id: 595, child_count: 0, level: 0},
  {id: 96, id_parent: null, eobj_id: 26, supply_id: 616, child_count: 0, level: 0},
  {id: 97, id_parent: null, eobj_id: 27, supply_id: 727, child_count: 0, level: 0},
  {id: 98, id_parent: null, eobj_id: 23, supply_id: 838, child_count: 0, level: 0},
  {id: 99, id_parent: null, eobj_id: 24, supply_id: 949, child_count: 0, level: 0},
  {id: 100, id_parent: null, eobj_id: 25, supply_id: 161, child_count: 0, level: 0},
  {id: 101, id_parent: null, eobj_id: 26, supply_id: 272, child_count: 0, level: 0},
  {id: 102, id_parent: null, eobj_id: 27, supply_id: 383, child_count: 0, level: 0},
  {id: 103, id_parent: null, eobj_id: 23, supply_id: 494, child_count: 0, level: 0},
  {id: 104, id_parent: null, eobj_id: 24, supply_id: 515, child_count: 0, level: 0},
  {id: 105, id_parent: null, eobj_id: 25, supply_id: 626, child_count: 0, level: 0},
  {id: 106, id_parent: null, eobj_id: 26, supply_id: 737, child_count: 0, level: 0},
  {id: 107, id_parent: null, eobj_id: 27, supply_id: 848, child_count: 0, level: 0},
  {id: 108, id_parent: null, eobj_id: 23, supply_id: 959, child_count: 0, level: 0},
  {id: 109, id_parent: null, eobj_id: 24, supply_id: 171, child_count: 0, level: 0},
  {id: 110, id_parent: null, eobj_id: 25, supply_id: 282, child_count: 0, level: 0},
  {id: 111, id_parent: null, eobj_id: 26, supply_id: 393, child_count: 0, level: 0},
  {id: 112, id_parent: null, eobj_id: 27, supply_id: 414, child_count: 0, level: 0},
  {id: 113, id_parent: null, eobj_id: 23, supply_id: 525, child_count: 0, level: 0},
  {id: 114, id_parent: null, eobj_id: 24, supply_id: 636, child_count: 0, level: 0},
  {id: 115, id_parent: null, eobj_id: 25, supply_id: 747, child_count: 0, level: 0},
  {id: 116, id_parent: null, eobj_id: 26, supply_id: 858, child_count: 0, level: 0},
  {id: 117, id_parent: null, eobj_id: 27, supply_id: 969, child_count: 0, level: 0},
  {id: 118, id_parent: null, eobj_id: 23, supply_id: 181, child_count: 0, level: 0},
  {id: 119, id_parent: null, eobj_id: 24, supply_id: 292, child_count: 0, level: 0},
  {id: 120, id_parent: null, eobj_id: 25, supply_id: 313, child_count: 0, level: 0},
  {id: 121, id_parent: null, eobj_id: 26, supply_id: 424, child_count: 0, level: 0},
  {id: 122, id_parent: null, eobj_id: 27, supply_id: 535, child_count: 0, level: 0},
  {id: 123, id_parent: null, eobj_id: 23, supply_id: 646, child_count: 0, level: 0},
  {id: 124, id_parent: null, eobj_id: 24, supply_id: 757, child_count: 0, level: 0},
  {id: 125, id_parent: null, eobj_id: 25, supply_id: 868, child_count: 0, level: 0},
  {id: 126, id_parent: null, eobj_id: 26, supply_id: 979, child_count: 0, level: 0},
  {id: 127, id_parent: null, eobj_id: 27, supply_id: 191, child_count: 0, level: 0},
  {id: 128, id_parent: null, eobj_id: 23, supply_id: 212, child_count: 0, level: 0},
  {id: 129, id_parent: null, eobj_id: 24, supply_id: 323, child_count: 0, level: 0},
  {id: 130, id_parent: null, eobj_id: 25, supply_id: 434, child_count: 0, level: 0},
  {id: 131, id_parent: null, eobj_id: 26, supply_id: 545, child_count: 0, level: 0},
  {id: 132, id_parent: null, eobj_id: 27, supply_id: 656, child_count: 0, level: 0},
  {id: 133, id_parent: null, eobj_id: 23, supply_id: 767, child_count: 0, level: 0},
  {id: 134, id_parent: null, eobj_id: 24, supply_id: 878, child_count: 0, level: 0},
  {id: 135, id_parent: null, eobj_id: 25, supply_id: 989, child_count: 0, level: 0},
  {id: 136, id_parent: null, eobj_id: 26, supply_id: 102, child_count: 0, level: 0},
  {id: 137, id_parent: null, eobj_id: 27, supply_id: 213, child_count: 0, level: 0},
  {id: 138, id_parent: null, eobj_id: 23, supply_id: 324, child_count: 0, level: 0},
  {id: 139, id_parent: null, eobj_id: 24, supply_id: 435, child_count: 0, level: 0},
  {id: 140, id_parent: null, eobj_id: 25, supply_id: 546, child_count: 0, level: 0},
  {id: 141, id_parent: null, eobj_id: 26, supply_id: 657, child_count: 0, level: 0},
  {id: 142, id_parent: null, eobj_id: 27, supply_id: 768, child_count: 0, level: 0},
  {id: 143, id_parent: null, eobj_id: 23, supply_id: 879, child_count: 0, level: 0},
  {id: 144, id_parent: null, eobj_id: 24, supply_id: 980, child_count: 0, level: 0},
  {id: 145, id_parent: null, eobj_id: 25, supply_id: 103, child_count: 0, level: 0},
  {id: 146, id_parent: null, eobj_id: 26, supply_id: 214, child_count: 0, level: 0},
  {id: 147, id_parent: null, eobj_id: 27, supply_id: 325, child_count: 0, level: 0},
  {id: 148, id_parent: null, eobj_id: 23, supply_id: 436, child_count: 1, level: 0},
  {id: 149, id_parent: 148, eobj_id: 26, supply_id: 136, child_count: 0, level: 1},
  {id: 150, id_parent: null, eobj_id: 23, supply_id: 436, child_count: 1, level: 0},
  {id: 151, id_parent: 150, eobj_id: 26, supply_id: 136, child_count: 0, level: 1},
  {id: 152, id_parent: 150, eobj_id: 27, supply_id: 137, child_count: 1, level: 1},
  {id: 153, id_parent: 152, eobj_id: 28, supply_id: 138, child_count: 1, level: 2},
  {id: 154, id_parent: 153, eobj_id: 29, supply_id: 139, child_count: 1, level: 3},
  {id: 155, id_parent: 154, eobj_id: 30, supply_id: 141, child_count: 1, level: 4},
  {id: 156, id_parent: 155, eobj_id: 31, supply_id: 121, child_count: 0, level: 5},
];
// ▼ Основная ветка
// ├─▶ Свёрнутая подветка
// └─▼ Раскрытая подветка
//    ├── Элемент 1
//    └── Элемент 2

</script>
<style scoped>
.app-div {
  display: flex;
  flex-direction: column;
  width: 100%;
}

:deep(.info-ui-data-tree-node-cell) {
  display: flex;
}

:deep(.info-ui-data-tree-node-cell-expand) {
  display: flex;
  padding-left: 20px;
}

:deep(.info-ui-data-tree-node-cell-text) {
  display: flex;
  padding-left: 10px;
}
</style>
