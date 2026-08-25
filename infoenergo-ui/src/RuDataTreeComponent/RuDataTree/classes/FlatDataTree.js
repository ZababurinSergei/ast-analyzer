// Объект для представления буфера RuDataGrid в виде плоского дерева, FlatTree
//
// Структура элемента строка:
// {
//   parentPosition,
//   localPosition,
//   idNode,
//   idParent,
//   dataRow,
//   hasChild,
//   childTotal,
//   childLoaded
//  }
import { FlatDataTreeArrayItem } from '@/RuDataTreeComponent/RuDataTree/classes/FlatDataTreeArrayItem.js';

export class FlatDataTree extends Object {
  #idParentName = '';
  #idNodeName = '';
  #hasChildName = '';
  #rootIdParentValue = [null];
  #flatDataTreeArray = [];

  rootTotal = 0;

  constructor(idNodeName = '', idParentName = '', hasChildName = '') {
    super();
    this.#idNodeName = idNodeName;
    this.#idParentName = idParentName;
    this.#hasChildName = hasChildName;
  }

  #getIndexByGlobalPosition(globalPosition) {
    const row = this.#findRowByGlobalPosition(globalPosition);
    if (row === null) {
      if (this.#flatDataTreeArray.length === 0) {
        return 0;
      }
      let prevRowIndex = null;
      for (let i = 0; i < this.#flatDataTreeArray.length; i++) {
        const item = this.#flatDataTreeArray[i];
        if (item.globalPosition > globalPosition) {
          break;
        }
        prevRowIndex = i;
      }
      if (prevRowIndex === null) {
        return 0;
      }
      return prevRowIndex + 1;
    } else {
      for (let i = 0; i < this.#flatDataTreeArray.length; i++) {
        const item = this.#flatDataTreeArray[i];
        if (item.globalPosition === globalPosition) {
          return i;
        }
      }
    }
  }

  #getGlobalPositionByRootLocal(rootLocalPosition = 0) {
    const rootArray = this.#flatDataTreeArray.filter((item) => {
      return this.#rootIdParentValue.includes(item.idParent);
    });
    if (rootArray.length === 0) {
      return 0;
    }
    // нужно найти первый элемент с localPosition < rootLocalPosition назовем его fRow
    // globalPosition = fRow.globalPosition + сумма childrenTotal всех и всех вложенных + разница в localPosition
    // нужно идти по массиву вниз от fRow пока элементы принадлежать fRow суммируем childrenTotal

    // если количество root строк не 0
    // найти первую root строку с localPosition < rootLocalPosition
    const getPrevRootSibling = (rootArray, rootLocalPosition) => {
      for (let i = rootArray.length - 1; i >= 0; i--) {
        const item = rootArray[i];
        if (item.localPosition < rootLocalPosition) {
          return item;
        }
      }
    };
    const prevRootSibling = getPrevRootSibling(rootArray, rootLocalPosition);
    // нужно найти сумму всех childrenTotal у всех элементов принадлежащих prevRootSibling
    const calcSumChildrenTotal = (rootGlobalPosition) => {
      const array = this.#flatDataTreeArray.filter((item) => {
        return item.globalPosition > rootGlobalPosition;
      });
      array.sort((a, b) => a.globalPosition - b.globalPosition);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        if (array[i].idParent === null) {
          break;
        }
        sum += array[i].childrenTotal;
      }
      return sum;
    };
    let sumChildrenTotal = 0;
    let localDelta = rootLocalPosition;
    let globalPosition = sumChildrenTotal + localDelta;
    if (prevRootSibling !== undefined) {
      calcSumChildrenTotal(prevRootSibling.globalPosition);
      // нужно найти разницу в localPosition
      localDelta = rootLocalPosition - prevRootSibling.localPosition;
      // находим globalPosition для rootLocalPosition
      globalPosition = prevRootSibling.globalPosition + sumChildrenTotal + localDelta;
    }

    return globalPosition;
  }

  #getGlobalPositionByChildLocal(parentRow = {}, localPosition = 0) {
    // находим все строки принадлежащие parentRow
    const array = this.#flatDataTreeArray.filter((item) => {
      return item.idParent === parentRow.idNode;
    });
    if (array.length === 0) {
      return parentRow.globalPosition + localPosition + 1;
    }
    // нужно найти первый элемент с localPosition < rootLocalPosition назовем его fRow
    // globalPosition = fRow.globalPosition + сумма childrenTotal всех и всех вложенных + разница в localPosition
    // нужно идти по массиву вниз от fRow пока элементы принадлежать fRow суммируем childrenTotal

    // если количество root строк не 0
    // найти первую root строку с localPosition < rootLocalPosition
    const getPrevChildSibling = (array, localPosition) => {
      for (let i = array.length - 1; i >= 0; i--) {
        const item = array[i];
        if (item.localPosition < localPosition) {
          return item;
        }
      }
      return null;
    };
    const prevChildSibling = getPrevChildSibling(array, localPosition);
    if (prevChildSibling === null) {
      return parentRow.globalPosition + 1 + localPosition;
    }
    // нужно найти сумму всех childrenTotal у всех элементов принадлежащих prevRootSibling
    const calcSumPrevChildrenTotal = (prevChildSibling) => {
      const array = this.#flatDataTreeArray.filter((item) => {
        return item.globalPosition > prevChildSibling.globalPosition;
      });
      array.sort((a, b) => a.globalPosition - b.globalPosition);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        if (array[i].idParent === null || array[i].idParent === prevChildSibling.idParent) {
          break;
        }
        sum += array[i].childrenTotal;
      }
      return sum;
    };
    const sumPrevChildrenTotal = calcSumPrevChildrenTotal(prevChildSibling);
    // нужно найти разницу в localPosition
    const localDelta = localPosition - prevChildSibling.localPosition;
    // находим globalPosition для localPosition
    const globalPosition = prevChildSibling.globalPosition + sumPrevChildrenTotal + localDelta;
    return globalPosition;
  }

  getLocalPositionByGlobalPosition(globalPosition) {
    // Неуверен в правильности этих рассуждений
    // нужно определить кто будет parent row в этой globalPosition:
    // нужно найти последнюю действительную строку lrow
    // если в ней idParent === null то экстраполируем исходя из root
    // иначе находим parent для lrow и смотрим все - ли узлы подгружены если все то в lrow берем следующую за последней строкой и так
    // до тех пор пока в lrow не окажется рутовая строка или родитель недогружен
    // если строка root то то экстраполируем исходя из root
    // иначе проверяем globalPosition родительской строки + childTotal + (childTotal всех проигнорированных недогруженных узлов)
    // если больше чем  искомый globalPosition значит вычисляем и возвращаем localPosition в этом родителе
    // иначе записываем узел и его childTotal в игнорируемые и в lrow отправляем следующий узел.
    const lrows = [];

    function _getChildCount() {
      let _count = 0;
      for (const row of lrows) {
        if (row.total !== 0) {
          _count += row.total;
        }
      }
      return _count;
    }

    for (let i = this.#flatDataTreeArray.length - 1; i >= 0; i--) {
      const row = this.#flatDataTreeArray[i];
      if (row.globalPosition === globalPosition) {
        throw Error('20587714-0540-4791-8d3c-2bf2ba403ca2');
      }
      if (row.globalPosition > globalPosition) {
        continue;
      }
      if (this.#rootIdParentValue.includes(row.idParent)) {
        //lrows.push({ total: row.childrenTotal, globalPos: row.globalPosition });
        const childCount = _getChildCount();
        if (
          row.childrenTotal > 0 &&
          row.globalPosition + row.childrenTotal + childCount >= globalPosition
        ) {
          return {
            localPosition: globalPosition - row.globalPosition - childCount,
            idParent: row.idNode,
          };
        }
        return {
          localPosition: row.localPosition + (globalPosition - row.globalPosition - childCount),
          idParent: row.idParent,
        };
      } else {
        if (row.childrenTotal === 0) {
          continue;
        }
        lrows.push({ total: row.childrenTotal, globalPos: row.globalPosition });
        if (row.globalPosition + _getChildCount() >= globalPosition) {
          // значит globalPosition ребенок этой row
          // находим к-во элементов между родителем и ребенком
          const delta = globalPosition - row.globalPosition;
          return { localPosition: delta, idParent: row.idNode };
        }
      }
    }
    return { localPosition: 0, idParent: this.#rootIdParentValue[0] };
  }

  findRowByIdNode(idNode) {
    const result = this.#flatDataTreeArray.find((item) => item.idNode === idNode);
    return result === undefined ? null : result;
  }

  #findRowByGlobalPosition(globalPosition) {
    const result = this.#flatDataTreeArray.find((item) => item.globalPosition === globalPosition);
    return result === undefined ? null : result;
  }

  getNextSibling(globalPosition, idParent) {
    for (const item of this.#flatDataTreeArray) {
      if (globalPosition < item.globalPosition && idParent === item.idParent) {
        return item;
      }
    }
    return null;
  }

  insertRows(idParent, startLocalPosition = 0, dataRows = [], total = 0) {
    if (!dataRows) {
      dataRows = [];
    }
    if (this.#rootIdParentValue.includes(idParent)) {
      // вставка рутовых строк
      const startGlobalPosition = this.#getGlobalPositionByRootLocal(startLocalPosition);
      let globalPosition = startGlobalPosition;
      const parentGlobalPosition = null;
      let localPosition = startLocalPosition;
      let prevRow = null;
      for (const row of dataRows) {
        const expanded =
          row[this.#hasChildName] > 0 || row[this.#hasChildName] === true ? false : null;
        const arrayItem = new FlatDataTreeArrayItem(
          this.#idNodeName,
          this.#idParentName,
          this.#hasChildName,
          globalPosition,
          parentGlobalPosition,
          localPosition,
          row,
          0,
          expanded,
        );
        // нужно проверить что элемента с таким globalPosition еще нет
        if (this.#findRowByGlobalPosition(arrayItem.globalPosition) !== null) {
          console.log(
            `insert row abort, globalPosition: ${arrayItem.globalPosition} exist, item idNode: ${arrayItem.idNode}`,
          );
          continue;
        }
        // нужно проверить что элемента с таким idNode еще нет
        if (this.findRowByIdNode(arrayItem.idNode) !== null) {
          console.log(
            `insert row abort, idNode: ${arrayItem.idNode} exist, item globalPosition: ${arrayItem.globalPosition}`,
          );
          continue;
        }
        this.#flatDataTreeArray.push(arrayItem);
        globalPosition++;
        localPosition++;
        if (prevRow !== null) {
          prevRow.nextSibling = true;
        }
        if (dataRows.indexOf(row) === dataRows.length - 1) {
          const nextRow = this.getNextSibling(arrayItem.globalPosition, arrayItem.idParent);
          if (nextRow !== null) {
            arrayItem.nextSibling = true;
          }
        }
        prevRow = arrayItem;
      }
      this.#flatDataTreeArray.sort((a, b) => a.globalPosition - b.globalPosition);
      this.rootTotal = total;
    } else {
      // вставка дочерних строк
      // находим родительскую строку
      const parentRow = this.findRowByIdNode(idParent);
      const startGlobalPosition = this.#getGlobalPositionByChildLocal(
        parentRow,
        startLocalPosition,
      );
      let globalPosition = startGlobalPosition;
      const parentGlobalPosition = parentRow.globalPosition;
      let localPosition = startLocalPosition;
      let insertIndex = null;
      let prevRow = null;
      for (const row of dataRows) {
        const expanded =
          row[this.#hasChildName] > 0 || row[this.#hasChildName] === true ? false : null;
        const arrayItem = new FlatDataTreeArrayItem(
          this.#idNodeName,
          this.#idParentName,
          this.#hasChildName,
          globalPosition,
          parentGlobalPosition,
          localPosition,
          row,
          0,
          expanded,
        );
        // // нужно проверить что элемента с таким globalPosition еще нет
        // if (this.#findRowByGlobalPosition(arrayItem.globalPosition) !== null) {
        //   console.log(
        //     `insert row abort, globalPosition: ${arrayItem.globalPosition} exist, item idNode: ${arrayItem.idNode}`,
        //   );
        //   continue;
        // }
        // нужно проверить что элемента с таким idNode еще нет
        if (this.findRowByIdNode(arrayItem.idNode) !== null) {
          console.log(
            `insert row abort, idNode: ${arrayItem.idNode} exist, item globalPosition: ${arrayItem.globalPosition}`,
          );
          continue;
        }
        // находим индекс для вставки строки (нужно чтобы строка с таким-же индексом оказалась ниже новой строки)
        if (insertIndex === null) {
          insertIndex = this.#getIndexByGlobalPosition(globalPosition);
        } else {
          insertIndex++;
        }
        this.#flatDataTreeArray.splice(insertIndex, 0, arrayItem);
        globalPosition++;
        localPosition++;
        if (prevRow !== null) {
          prevRow.nextSibling = true;
        }
        if (dataRows.indexOf(row) === dataRows.length - 1) {
          const nextRow = this.getNextSibling(arrayItem.globalPosition, arrayItem.idParent);
          if (nextRow !== null) {
            arrayItem.nextSibling = true;
          }
        }
        prevRow = arrayItem;
      }
      if (parentRow.childrenTotal !== total) {
        // теперь globalPosition у соседних элементов расположенных ниже, но имеющих тот-же idParent не должна поменяться,
        // а у остальных расположенных ниже должна увеличится на total
        const array = this.#flatDataTreeArray.slice(insertIndex + 1);
        for (const row of array) {
          if (row.idParent !== idParent) {
            row.globalPosition += total;
            if (row.parentGlobalPosition !== null) {
              row.parentGlobalPosition = this.findRowByIdNode(row.idParent).globalPosition;
            }
          }
        }
      }
      this.#flatDataTreeArray.sort((a, b) => a.globalPosition - b.globalPosition);
      // устанавливаем в родительскую строку childrenTotal
      parentRow.childrenTotal = total;
    }
  }

  getDataArray(startGlobalPosition, count) {
    // create Map
    const flatMap = new Map();
    for (let index = 0; index < this.#flatDataTreeArray.length; index++) {
      const row = this.#flatDataTreeArray[index];
      if (flatMap.has(row.globalPosition)) {
        continue;
        // throw Error('FlatDataTree core error 786c3daf-6963-451e-82b4-60892c59433a');
      }
      flatMap.set(row.globalPosition, row);
    }

    const arr = [];
    for (let index = startGlobalPosition; index < startGlobalPosition + count; index++) {
      if (flatMap.has(index)) {
        arr.push(flatMap.get(index));
      } else {
        arr.push(null);
      }
    }
    return arr;
  }

  getChildrensTotal() {
    let _total = 0;
    for (const row of this.#flatDataTreeArray) {
      if (!this.#rootIdParentValue.includes(row.parentKey)) {
        _total += row.childrenTotal;
      }
    }
    return _total;
  }

  getChildrenCount(idParent) {
    let _count = 0;
    for (const row of this.#flatDataTreeArray) {
      if (row.idParent === idParent) {
        _count++;
      }
    }
    return _count;
  }

  getRootLoadedCount() {
    let _count = 0;
    for (const row of this.#flatDataTreeArray) {
      if (this.#rootIdParentValue.includes(row.idParent)) {
        _count++;
      }
    }
    return _count;
  }

  getLength() {
    return this.rootTotal + this.getChildrensTotal();
  }

  getParentItems(globalPosition) {
    const pathArray = [];
    let row = null;
    for (const item of this.#flatDataTreeArray) {
      if (item.globalPosition === globalPosition) {
        row = item;
        break;
      }
    }
    if (row === null) {
      return null;
    }
    pathArray.push(row);
    if (row.idParent !== null) {
      const parentPath = this.#getParentItemsR(row);
      if (parentPath === null) {
        throw Error('b8c87bb6-ece1-4bd9-98d8-d2538e1baff5');
      }
      for (const rowP of parentPath) {
        pathArray.push(rowP);
      }
    }
    pathArray.sort((a, b) => a.globalPosition - b.globalPosition);
    return pathArray;
  }

  #getParentItemsR(row) {
    const pathArray = [];
    let rowParent = null;
    for (const item of this.#flatDataTreeArray) {
      if (item.idParent === row.idParent) {
        row = item;
        break;
      }
      rowParent = item;
    }
    if (rowParent === null) {
      return null;
    }
    pathArray.push(rowParent);
    if (rowParent.idParent !== null) {
      const parentPath = this.#getParentItemsR(rowParent);
      if (parentPath === null) {
        throw Error('b8c87bb6-ece1-4bd9-98d8-d2538e1baff5');
      }
      for (const rowP of parentPath) {
        pathArray.push(rowP);
      }
    }
    pathArray.sort((a, b) => a.globalPosition - b.globalPosition);
    return pathArray;
  }

  collapseChild(flatItem) {
    const removeItemsArray = [];

    function creteProxyItem(item) {
      return {
        item: item,
        globalPosition: item.globalPosition === null ? -1 : item.globalPosition,
        parentGlobalPosition: item.parentGlobalPosition === null ? -1 : item.parentGlobalPosition,
      };
    }

    const _flatItem = creteProxyItem(flatItem);
    let startReIndexGlobalPosition = null;
    for (const item of this.#flatDataTreeArray) {
      const _item = creteProxyItem(item);
      if (_flatItem.globalPosition < _item.globalPosition) {
        if (_item.parentGlobalPosition <= _flatItem.parentGlobalPosition) {
          startReIndexGlobalPosition = item.globalPosition;
          break;
        }
        if (_item.parentGlobalPosition > _flatItem.parentGlobalPosition) {
          removeItemsArray.push(item);
        }
      }
    }
    let allTotal = flatItem.childrenTotal;
    for (const item of removeItemsArray) {
      allTotal += item.childrenTotal;
    }
    // remove items from flatTree
    if (startReIndexGlobalPosition !== null) {
      for (const item of this.#flatDataTreeArray) {
        if (item.globalPosition >= startReIndexGlobalPosition) {
          item.globalPosition = item.globalPosition - allTotal;
        }
      }
    }
    const startIndex = this.#flatDataTreeArray.indexOf(removeItemsArray[0]);
    this.#flatDataTreeArray.splice(startIndex, removeItemsArray.length);
    flatItem.childrenTotal = 0;
    for (const item of this.#flatDataTreeArray) {
      if (item.parentGlobalPosition !== null) {
        item.parentGlobalPosition = this.findRowByIdNode(item.idParent).globalPosition;
      }
    }
    console.log('removeItemsArray.length', removeItemsArray.length);
  }

  // #reCalcGlobalIndex(){
  //   for (const item of this.#flatDataTreeArray) {
  //
  //   }
  // }
}
