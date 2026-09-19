// decoders/functionDecoder.js
import { getFullTypeName, decodeFlags, flagsToObject } from './types.js';

/**
 * Декодирует массив функций из сокращенного формата в полный
 * @param {Array} fns - массив функций в формате [id, name, moduleId, fileId, line, typeCode, flags]
 * @param {Object} moduleMap - карта соответствия moduleId -> moduleName
 * @param {Object} fileMap - карта соответствия fileId -> fileName
 * @returns {Array} массив декодированных функций
 */
export function decodeFunctions(fns, moduleMap, fileMap) {
  if (!fns || !Array.isArray(fns)) {
    return [];
  }

  return fns.map(fn => {
    if (!Array.isArray(fn)) {
      return fn;
    }

    const id = fn[0];
    const name = fn[1];
    const moduleId = fn[2];
    const fileId = fn[3];
    const line = fn[4];
    const typeCode = fn[5] || 's';
    const flags = fn[6] || '';

    // Получаем полные названия из карт
    let moduleName = moduleId;
    let fileName = fileId;

    if (moduleMap && moduleMap[moduleId]) {
      moduleName = moduleMap[moduleId];
    }

    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    // Декодируем флаги: строка "ae" -> ["standard", "exported"]
    const decodedFlags = decodeFlags(flags);

    return {
      id,
      name,
      module: moduleName,
      moduleId,
      file: fileName,
      fileId,
      line,
      type: getFullTypeName(typeCode),
      typeCode,
      flags: decodedFlags,
      flagObject: flagsToObject(decodedFlags),
    };
  });
}

/**
 * Декодирует массив self-functions из сокращенного формата в полный
 * @param {Array} sf - массив self-functions в формате [id, name, fileId, line]
 * @param {Object} fileMap - карта соответствия fileId -> fileName
 * @returns {Array} массив декодированных self-functions
 */
export function decodeSelfFunctions(sf, fileMap) {
  if (!sf || !Array.isArray(sf)) {
    return [];
  }

  return sf.map(item => {
    if (!Array.isArray(item)) {
      return item;
    }

    const id = item[0];
    const name = item[1];
    const fileId = item[2];
    const line = item[3];

    let fileName = fileId;
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    return {
      id,
      name,
      file: fileName,
      fileId,
      line,
    };
  });
}

/**
 * Декодирует массив констант из сокращенного формата в полный
 * @param {Array} cn - массив констант в формате [id, name, value, moduleId, fileId, line, typeCode, flags]
 * @param {Object} moduleMap - карта соответствия moduleId -> moduleName
 * @param {Object} fileMap - карта соответствия fileId -> fileName
 * @returns {Array} массив декодированных констант
 */
export function decodeConstants(cn, moduleMap, fileMap) {
  if (!cn || !Array.isArray(cn)) {
    return [];
  }

  return cn.map(c => {
    if (!Array.isArray(c) || c.length < 6) {
      return c;
    }

    const id = c[0];
    const name = c[1];
    const value = c[2];
    const moduleId = c[3];
    const fileId = c[4];
    const line = c[5];
    const typeCode = c[6] || 'val';
    const flags = c[7] || '';

    let moduleName = moduleId;
    let fileName = fileId;

    if (moduleMap && moduleMap[moduleId]) {
      moduleName = moduleMap[moduleId];
    }
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    // Декодируем флаги: строка "ae" -> ["standard", "exported"]
    const decodedFlags = decodeFlags(flags);

    return {
      id,
      name,
      value,
      module: moduleName,
      moduleId,
      file: fileName,
      fileId,
      line,
      type: getFullTypeName(typeCode),
      typeCode,
      flags: decodedFlags,
      flagObject: flagsToObject(decodedFlags),
    };
  });
}

/**
 * Декодирует массив файлов из сокращенного формата в полный
 * @param {Object} fileIndex - объект с индексом файлов {fileId: fileName}
 * @param {Object} fileMap - карта соответствия fileId -> fileName (для обратного преобразования)
 * @returns {Object} объект с расшифрованными именами файлов
 */
export function decodeFileIndex(fileIndex, fileMap) {
  if (!fileIndex || typeof fileIndex !== 'object') {
    return fileIndex;
  }

  const result = {};
  for (const [id, name] of Object.entries(fileIndex)) {
    // Если имя уже полное, оставляем как есть
    if (name && typeof name === 'string' && (name.includes('/') || name.includes('\\'))) {
      result[id] = name;
    } else {
      // Иначе пытаемся найти в карте
      result[id] = fileMap && fileMap[id] ? fileMap[id] : name;
    }
  }
  return result;
}

/**
 * Декодирует массив модулей из сокращенного формата в полный
 * @param {Object} moduleIndex - объект с индексом модулей {moduleId: moduleName}
 * @param {Object} moduleMap - карта соответствия moduleId -> moduleName (для обратного преобразования)
 * @returns {Object} объект с расшифрованными именами модулей
 */
export function decodeModuleIndex(moduleIndex, moduleMap) {
  if (!moduleIndex || typeof moduleIndex !== 'object') {
    return moduleIndex;
  }

  const result = {};
  for (const [id, name] of Object.entries(moduleIndex)) {
    // Если имя уже полное, оставляем как есть
    if (name && typeof name === 'string' && !name.startsWith('m')) {
      result[id] = name;
    } else {
      // Иначе пытаемся найти в карте
      result[id] = moduleMap && moduleMap[id] ? moduleMap[id] : name;
    }
  }
  return result;
}

/**
 * Декодирует массив функций с дополнительным контекстом
 * @param {Array} fns - массив функций
 * @param {Object} moduleMap - карта модулей
 * @param {Object} fileMap - карта файлов
 * @param {Object} entityMap - карта сущностей для расшифровки ссылок
 * @returns {Array} массив декодированных функций с дополнительной информацией
 */
export function decodeFunctionsWithContext(fns, moduleMap, fileMap, entityMap) {
  if (!fns || !Array.isArray(fns)) {
    return [];
  }

  return fns.map(fn => {
    if (!Array.isArray(fn)) {
      return fn;
    }

    const id = fn[0];
    const name = fn[1];
    const moduleId = fn[2];
    const fileId = fn[3];
    const line = fn[4];
    const typeCode = fn[5] || 's';
    const flags = fn[6] || '';

    let moduleName = moduleId;
    let fileName = fileId;

    if (moduleMap && moduleMap[moduleId]) {
      moduleName = moduleMap[moduleId];
    }

    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    // Получаем контекст вызовов из entityMap
    const calls = entityMap && entityMap[id] ? entityMap[id] : [];

    // Декодируем флаги
    const decodedFlags = decodeFlags(flags);

    return {
      id,
      name,
      module: moduleName,
      moduleId,
      file: fileName,
      fileId,
      line,
      type: getFullTypeName(typeCode),
      typeCode,
      flags: decodedFlags,
      flagObject: flagsToObject(decodedFlags),
      calls: Array.isArray(calls) ? calls : [],
    };
  });
}

/**
 * Восстанавливает полные имена для массива идентификаторов
 * @param {Array} ids - массив идентификаторов
 * @param {Object} entityMap - карта соответствия id -> name
 * @returns {Array} массив с полными именами
 */
export function resolveEntityNames(ids, entityMap) {
  if (!ids || !Array.isArray(ids)) {
    return ids;
  }
  if (!entityMap || typeof entityMap !== 'object') {
    return ids;
  }

  return ids.map(id => {
    if (typeof id === 'string' && entityMap[id]) {
      return entityMap[id];
    }
    return id;
  });
}

/**
 * Преобразует массив функций в объект с индексом по id
 * @param {Array} functions - массив функций
 * @returns {Object} объект {functionId: functionData}
 */
export function indexFunctionsById(functions) {
  if (!functions || !Array.isArray(functions)) {
    return {};
  }

  const result = {};
  for (const fn of functions) {
    if (fn && fn.id) {
      result[fn.id] = fn;
    }
  }
  return result;
}

/**
 * Преобразует массив функций в объект с индексом по имени
 * @param {Array} functions - массив функций
 * @returns {Object} объект {functionName: functionData}
 */
export function indexFunctionsByName(functions) {
  if (!functions || !Array.isArray(functions)) {
    return {};
  }

  const result = {};
  for (const fn of functions) {
    if (fn && fn.name) {
      if (!result[fn.name]) {
        result[fn.name] = [];
      }
      result[fn.name].push(fn);
    }
  }
  return result;
}

/**
 * Фильтрует функции по типу
 * @param {Array} functions - массив функций
 * @param {string|Array} types - тип или массив типов для фильтрации
 * @returns {Array} отфильтрованный массив функций
 */
export function filterFunctionsByType(functions, types) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }
  if (!types) {
    return functions;
  }

  const typeList = Array.isArray(types) ? types : [types];

  return functions.filter(fn => {
    if (!fn || !fn.type) {
      return false;
    }
    return typeList.includes(fn.type) || typeList.includes(fn.typeCode);
  });
}

/**
 * Фильтрует функции по флагам
 * @param {Array} functions - массив функций
 * @param {string|Array} flags - флаг или массив флагов для фильтрации
 * @param {boolean} matchAll - если true, должны совпадать все флаги, иначе любой
 * @returns {Array} отфильтрованный массив функций
 */
export function filterFunctionsByFlags(functions, flags, matchAll = false) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }
  if (!flags) {
    return functions;
  }

  const flagList = Array.isArray(flags) ? flags : [flags];

  return functions.filter(fn => {
    if (!fn || !fn.flags || !Array.isArray(fn.flags)) {
      return false;
    }

    if (matchAll) {
      return flagList.every(flag => fn.flags.includes(flag));
    } else {
      return flagList.some(flag => fn.flags.includes(flag));
    }
  });
}

/**
 * Находит функцию по id
 * @param {Array} functions - массив функций
 * @param {string} id - идентификатор функции
 * @returns {Object|null} найденная функция или null
 */
export function findFunctionById(functions, id) {
  if (!functions || !Array.isArray(functions) || !id) {
    return null;
  }
  return functions.find(fn => fn && fn.id === id) || null;
}

/**
 * Находит функцию по имени
 * @param {Array} functions - массив функций
 * @param {string} name - имя функции
 * @returns {Array} массив найденных функций
 */
export function findFunctionsByName(functions, name) {
  if (!functions || !Array.isArray(functions) || !name) {
    return [];
  }
  return functions.filter(fn => fn && fn.name === name);
}

/**
 * Получает все экспортированные функции
 * @param {Array} functions - массив функций
 * @returns {Array} массив экспортированных функций
 */
export function getExportedFunctions(functions) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }
  return functions.filter(fn => {
    if (!fn || !fn.flags) {
      return false;
    }
    return (
      fn.flags.includes('exported') || fn.type === 'exported' || fn.type === 'exported-standard'
    );
  });
}

/**
 * Получает все асинхронные функции
 * @param {Array} functions - массив функций
 * @returns {Array} массив асинхронных функций
 */
export function getAsyncFunctions(functions) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }
  return functions.filter(fn => {
    if (!fn) {
      return false;
    }
    return (
      (fn.flags && fn.flags.includes('async')) ||
      (fn.type && (fn.type.includes('async') || (fn.typeCode && fn.typeCode.includes('a'))))
    );
  });
}

/**
 * Группирует функции по модулям
 * @param {Array} functions - массив функций
 * @returns {Object} объект {moduleName: [functions]}
 */
export function groupFunctionsByModule(functions) {
  if (!functions || !Array.isArray(functions)) {
    return {};
  }

  const result = {};
  for (const fn of functions) {
    if (!fn || !fn.module) {
      continue;
    }
    if (!result[fn.module]) {
      result[fn.module] = [];
    }
    result[fn.module].push(fn);
  }
  return result;
}

/**
 * Группирует функции по файлам
 * @param {Array} functions - массив функций
 * @returns {Object} объект {fileName: [functions]}
 */
export function groupFunctionsByFile(functions) {
  if (!functions || !Array.isArray(functions)) {
    return {};
  }

  const result = {};
  for (const fn of functions) {
    if (!fn || !fn.file) {
      continue;
    }
    if (!result[fn.file]) {
      result[fn.file] = [];
    }
    result[fn.file].push(fn);
  }
  return result;
}

/**
 * Подсчитывает статистику по функциям
 * @param {Array} functions - массив функций
 * @returns {Object} объект со статистикой
 */
export function getFunctionStats(functions) {
  if (!functions || !Array.isArray(functions)) {
    return {
      total: 0,
      exported: 0,
      async: 0,
      exportedAsync: 0,
      byType: {},
      byModule: {},
      byFile: {},
    };
  }

  const stats = {
    total: functions.length,
    exported: 0,
    async: 0,
    exportedAsync: 0,
    byType: {},
    byModule: {},
    byFile: {},
  };

  for (const fn of functions) {
    if (!fn) {
      continue;
    }

    // Подсчет по типам
    const type = fn.type || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    // Подсчет по модулям
    if (fn.module) {
      stats.byModule[fn.module] = (stats.byModule[fn.module] || 0) + 1;
    }

    // Подсчет по файлам
    if (fn.file) {
      stats.byFile[fn.file] = (stats.byFile[fn.file] || 0) + 1;
    }

    // Проверка на экспорт
    const isExported =
      (fn.flags && fn.flags.includes('exported')) ||
      fn.type === 'exported' ||
      fn.type === 'exported-standard';
    if (isExported) {
      stats.exported++;
    }

    // Проверка на асинхронность
    const isAsync =
      (fn.flags && fn.flags.includes('async')) || (fn.type && fn.type.includes('async'));
    if (isAsync) {
      stats.async++;
      if (isExported) {
        stats.exportedAsync++;
      }
    }
  }

  return stats;
}

/**
 * Сортирует функции по имени
 * @param {Array} functions - массив функций
 * @param {boolean} ascending - по возрастанию (true) или убыванию (false)
 * @returns {Array} отсортированный массив функций
 */
export function sortFunctionsByName(functions, ascending = true) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }

  return [...functions].sort((a, b) => {
    if (!a || !b) {
      return 0;
    }
    const nameA = a.name || '';
    const nameB = b.name || '';
    return ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
  });
}

/**
 * Сортирует функции по строке
 * @param {Array} functions - массив функций
 * @param {boolean} ascending - по возрастанию (true) или убыванию (false)
 * @returns {Array} отсортированный массив функций
 */
export function sortFunctionsByLine(functions, ascending = true) {
  if (!functions || !Array.isArray(functions)) {
    return [];
  }

  return [...functions].sort((a, b) => {
    if (!a || !b) {
      return 0;
    }
    const lineA = a.line || 0;
    const lineB = b.line || 0;
    return ascending ? lineA - lineB : lineB - lineA;
  });
}

export default {
  decodeFunctions,
  decodeSelfFunctions,
  decodeConstants,
  decodeFileIndex,
  decodeModuleIndex,
  decodeFunctionsWithContext,
  resolveEntityNames,
  indexFunctionsById,
  indexFunctionsByName,
  filterFunctionsByType,
  filterFunctionsByFlags,
  findFunctionById,
  findFunctionsByName,
  getExportedFunctions,
  getAsyncFunctions,
  groupFunctionsByModule,
  groupFunctionsByFile,
  getFunctionStats,
  sortFunctionsByName,
  sortFunctionsByLine,
};
