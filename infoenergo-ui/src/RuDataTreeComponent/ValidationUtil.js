export function isIntNotZero(value) {
  if (typeof value === 'number') {
    if (value === 0) {
      return false;
    }
    return parseInt(value) === value;
  }
}

export function isIntNotNegative(value) {
  if (typeof value === 'number') {
    if (parseInt(value) === value) {
      return value >= 0;
    }
  }
  return false;
}

export function isIntNotNegativeOrNull(value) {
  if (value === null) {
    return true;
  }
  if (typeof value === 'number') {
    if (parseInt(value) === value) {
      return value >= 0;
    }
  }
  return false;
}

export function isInt(value) {
  if (typeof value === 'number') {
    return parseInt(value) === value;
  }
}

export function isIntOrNull(value) {
  if (typeof value === 'number') {
    return parseInt(value) === value;
  } else {
    return value === null;
  }
}

export function isArrayInt(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (num) =>
      typeof num === 'number' &&
      Number.isInteger(num) &&
      !isNaN(num) &&
      num !== Infinity &&
      num !== -Infinity,
  );
}

export function isArrayIntNotNegative(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every(
    (num) =>
      typeof num === 'number' &&
      Number.isInteger(num) &&
      !isNaN(num) &&
      num !== Infinity &&
      num !== -Infinity &&
      num >= 0,
  );
}

export function isArrayObject(arr) {
  if (!Array.isArray(arr)) return false;
  return arr.every((obj) => typeof obj === 'object');
}

export function isUuidv4(uuid) {
  const pattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return pattern.test(uuid);
}
