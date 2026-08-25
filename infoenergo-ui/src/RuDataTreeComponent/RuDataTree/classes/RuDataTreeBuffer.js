// Терминология:
// Index: индекс массива
// Item: элемент массива
// Key: ключ Map
// Value: значение в Map
// IdNode: идентификатор строки в базе данных
// IdParent: идентификатор родительской строки в базе данных
// Position: позиция строки
// GlobalPosition: позиция строки, в развернутом, с учетом мест для еще не полученных строк дереве
// LocalPosition: позиция строки в данных полученных от сервера по idParent, с учетом мест для еще не полученных строк
import { FlatDataTree } from '@/RuDataTreeComponent/RuDataTree/classes/FlatDataTree.js';

// Буфер данных для компонента RuDataTree
export class RuDataTreeBuffer {
  // Имя поля являющегося IdNode
  #idNodeName = '';
  // Имя поля являющегося IdParent
  _idParentName = '';
  // значения поля IdParent у рутовых строк, по умолчанию [null]
  #rootIdParentValue = [null];
  // буфер данных, в виде плоского списка узлов (FlatTree)
  flatDataTree = null;
  constructor(idNodeName = '', idParentName = '', hasChildName = '', rootIdParentValue = [null]) {
    if (typeof idNodeName !== 'string') {
      throw Error('RuDataTreeBuffer, constructor, arg error: idNodeName должен быть типом string');
    }
    if (typeof idParentName !== 'string') {
      throw Error(
        'RuDataTreeBuffer, constructor, arg error: idParentName должен быть типом string',
      );
    }
    if (typeof hasChildName !== 'string') {
      throw Error(
        'RuDataTreeBuffer, constructor, arg error: hasChildName должен быть типом string',
      );
    }
    this.flatDataTree = new FlatDataTree(idNodeName, idParentName, hasChildName, rootIdParentValue);
    this.#idNodeName = idNodeName;
    this._idParentName = idParentName;
    this.#rootIdParentValue = rootIdParentValue;
  }
  getNextSibling(globalPosition, idParent) {
    return this.flatDataTree.getNextSibling(globalPosition, idParent);
  }
  insertRows(idParent, startLocalPosition = 0, data = {}, total = 0) {
    this.flatDataTree.insertRows(idParent, startLocalPosition, data, total);
  }
  getDataArray(startGlobalPosition, count) {
    const arr = this.flatDataTree.getDataArray(startGlobalPosition, count);
    return arr;
  }

  add(startIndex, keyParent, data, total) {
    this.insertRows(keyParent, startIndex, data, total);
  }

  get length() {
    return this.flatDataTree.getLength();
  }
  loadStatus(idParent) {
    if (this.#rootIdParentValue.includes(idParent)) {
      return {
        childrensTotal: this.flatDataTree.rootTotal,
        childrensLoaded: this.flatDataTree.getRootLoadedCount(),
      };
    }
    const parentItem = this.flatDataTree.findRowByIdNode(idParent);
    if (parentItem === null) {
      return {
        childrensTotal: 0,
        childrensLoaded: 0,
      };
    }
    return {
      childrensTotal: parentItem.childrenTotal,
      childrensLoaded: this.flatDataTree.getChildrenCount(idParent),
    };
  }

  collapseChild(flatItem) {
    this.flatDataTree.collapseChild(flatItem);
  }
}
