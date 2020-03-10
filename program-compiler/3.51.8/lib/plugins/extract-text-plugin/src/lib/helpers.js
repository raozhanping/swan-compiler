'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isInitialOrHasNoParents = isInitialOrHasNoParents;
exports.isInvalidOrder = isInvalidOrder;
exports.getOrder = getOrder;
exports.getLoaderObject = getLoaderObject;
exports.mergeOptions = mergeOptions;
exports.isString = isString;
exports.isFunction = isFunction;
exports.isType = isType;
/* eslint-disable */
function isInitialOrHasNoParents(chunk) {
  return chunk.isInitial() || chunk.parents.length === 0;
}

function isInvalidOrder(a, b) {
  const bBeforeA = a.getPrevModules().indexOf(b) >= 0;
  const aBeforeB = b.getPrevModules().indexOf(a) >= 0;
  return aBeforeB && bBeforeA;
}

function getOrder(a, b) {
  const aOrder = a.getOrder();
  const bOrder = b.getOrder();
  if (aOrder < bOrder) return -1;
  if (aOrder > bOrder) return 1;
  const aIndex = a.getOriginalModule().index2;
  const bIndex = b.getOriginalModule().index2;
  if (aIndex < bIndex) return -1;
  if (aIndex > bIndex) return 1;
  const bBeforeA = a.getPrevModules().indexOf(b) >= 0;
  const aBeforeB = b.getPrevModules().indexOf(a) >= 0;
  if (aBeforeB && !bBeforeA) return -1;
  if (!aBeforeB && bBeforeA) return 1;
  const ai = a.identifier();
  const bi = b.identifier();
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

function getLoaderObject(loader) {
  if (isString(loader)) {
    return { loader };
  }
  return loader;
}

function mergeOptions(a, b) {
  if (!b) return a;
  Object.keys(b).forEach(key => {
    a[key] = b[key];
  });
  return a;
}

function isString(a) {
  return typeof a === 'string';
}

function isFunction(a) {
  return typeof a === 'function';
}

function isType(type, obj) {
  return Object.prototype.toString.call(obj) === `[object ${type}]`;
}