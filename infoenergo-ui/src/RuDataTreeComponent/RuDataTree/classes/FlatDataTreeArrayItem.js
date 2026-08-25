// Элемент массива flatDataTreeArray в классе FlatDataTree

import { isIntNotNegative, isIntNotNegativeOrNull } from '@/RuDataTreeComponent/ValidationUtil.js';

export class FlatDataTreeArrayItem {
  _idNodeName = '';
  _idParentName = '';
  #hasChildName = '';
  _globalPosition = 0;
  _parentGlobalPosition = 0;
  #localPosition = 0;
  _dataRow = {};
  _childrenTotal = 0;
  _expanded = null;
  _nextSibling = false;

  constructor(
    idNodeName = '',
    idParentName = '',
    hasChildName = '',
    globalPosition = 0,
    parentGlobalPosition = 0,
    localPosition = 0,
    dataRow = {},
    childrenTotal = 0,
    expanded = null,
  ) {
    this._idNodeName = idNodeName;
    this._idParentName = idParentName;
    this.#hasChildName = hasChildName;
    this._globalPosition = globalPosition;
    this._parentGlobalPosition = parentGlobalPosition;
    this.#localPosition = localPosition;
    this._dataRow = dataRow;
    this._childrenTotal = childrenTotal;
    this._expanded = expanded;
  }

  get globalPosition() {
    return this._globalPosition;
  }

  set globalPosition(value) {
    if (!isIntNotNegative(value)) {
      throw Error('6c0a0105-cd6e-4573-918c-9b8018d8619d');
    }
    this._globalPosition = value;
  }

  get parentGlobalPosition() {
    return this._parentGlobalPosition;
  }

  set parentGlobalPosition(value) {
    if (!isIntNotNegativeOrNull(value)) {
      throw Error('8eafaa5e-da48-42c9-a409-c632ec843f02');
    }
    this._parentGlobalPosition = value;
  }

  get childrenTotal() {
    return this._childrenTotal;
  }

  set childrenTotal(value) {
    if (!isIntNotNegative(value)) {
      throw Error('f1d15efd-54de-469b-8d64-4cdbeea684d3');
    }
    this._childrenTotal = value;
  }

  get localPosition() {
    return this.#localPosition;
  }

  get idNode() {
    return this._dataRow[this._idNodeName];
  }

  get idParent() {
    return this._dataRow[this._idParentName];
  }

  get dataRow() {
    return this._dataRow;
  }

  get expanded() {
    return this._expanded;
  }

  set expanded(value) {
    this._expanded = value;
  }

  get nextSibling() {
    return this._nextSibling;
  }

  set nextSibling(value) {
    this._nextSibling = value;
  }
}
