'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getFilterModuleDefination = getFilterModuleDefination;
exports.transformFilterSyntax = transformFilterSyntax;
exports.getNodeStr = getNodeStr;
exports.getFilterFuncArr = getFilterFuncArr;
exports.getFilterModule = getFilterModule;
exports.addFilteJsInDependencies = addFilteJsInDependencies;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('util');

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _helper = require('../helper');

var _decorateFilterJs = require('./decorate-filter-js');

var _decorateFilterJs2 = _interopRequireDefault(_decorateFilterJs);

var _util2 = require('../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const WORK_PATH = global.SWAN_CLI_ARGV.WORK_PATH;

/**
 * 根据filter模块对象，生成filter闭包函数
 * @param {Object} module 模块对象
 * @return {string} 闭包函数定义
 */
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理过滤器
 * @author zhuxin04@gmial.com
 */

function getFilterModuleDefination(module) {
    let { module: moduleName, content, src = '' } = module;
    try {
        content = (0, _decorateFilterJs2.default)(content).code;
        /* eslint-disable max-len */
        let moduleWrapper = `var ${moduleName}  = (function (require, module, exports, define, swan, getApp, window, 
                document, frames, self, location, navigator, localStorage, history, Caches) {
                ${content}
            })();
        `;
        /* eslint-enable max-len */
        return moduleWrapper;
    } catch (e) {
        const resourcePath = _path2.default.relative(WORK_PATH, src);
        (0, _util2.log)(`Error in ${resourcePath}: ${e}`, 'error');
    }
}

/**
 * 转换filter写法
 * @param {string} swanNode ast节点
 * @param {RegExp} funcReg function正则
 * @param {Array} filterArr 将匹配到function push到数组中
 */
function transformFilterSyntax(swanNode, funcReg, filterArr) {
    if (swanNode) {
        const { children, type, data, attribs, singleQuoteAttribs = {} } = swanNode;
        const detailChange = (data, singleQuoteFlag = false) => {
            let matchResult;
            while ((matchResult = funcReg.exec(data)) !== null) {
                const matchStr = matchResult[0];
                const funcInvokeName = matchStr.split('(')[0];
                const funcFormat = funcInvokeName.split('.');
                const filterName = funcFormat[0] + funcFormat[1];
                const filterItem = {
                    filterName,
                    module: funcFormat[0],
                    func: funcFormat[1]
                };
                filterArr.push(filterItem);
                const matchInput = matchStr.replace('.', '');
                const transformOutput = `${singleQuoteFlag ? '""' : '\'\''} | ${matchInput}`;
                data = data.replace(matchStr, transformOutput);
            }
            return data;
        };
        if (type === 'text' && data) {
            swanNode.data = detailChange(data) || swanNode.data;
        } else if (type === 'tag') {
            Object.keys(attribs).forEach(key => {
                attribs[key] = detailChange(attribs[key], singleQuoteAttribs[key]) || attribs[key];
            });
        }
        children && children.map(node => transformFilterSyntax(node, funcReg, filterArr));
    }
}

/**
 * 将ast节点转换成字符串
 * @param {Object} swanNode ast节点
 * @return {string}
 */
function getNodeStr(swanNode) {
    if (!swanNode) {
        return '';
    }
    let swan = '';
    let { name, attribs, singleQuoteAttribs, children, selfclose, type, data } = swanNode;
    switch (type) {
        case 'tag':
            {
                const content = children.map(node => getNodeStr(node)).join('');
                swan = (0, _helper.nodeToString)(name, (0, _helper.attribsToString)(attribs, singleQuoteAttribs), content, selfclose);
                break;
            }
        case 'text':
            {
                swan = data;
                break;
            }
    }
    return swan;
}

/**
 * 得到所有的fiter的定义，以及转换ast节点中的data值
 * @param {Array} filters filter数组
 * @param {string} pageContent 模板内容
 * @return {{transformContent: string, filterArr: Array}}
 */
function getFilterFuncArr(filters, pageContent) {
    if (!filters.length) {
        return {
            transformContent: pageContent,
            filterArr: []
        };
    }
    const filterArr = [];
    const modulesStr = filters.map(item => item.module).join('|');
    const moduleReg = new RegExp(`(${modulesStr})\\.\\w+\\(.*?\\)`, 'g');
    const astNode = (0, _helper.parser)(pageContent);
    astNode.map(node => transformFilterSyntax(node, moduleReg, filterArr));
    const transformContent = astNode.map(node => getNodeStr(node)).join('');
    return {
        transformContent,
        filterArr
    };
}

/**
 * 获取filer对象定义
 * @param {string} resource 资源路径
 * @param {Object} customParam 编译过程中自定义参数对象
 * @param {string} swanContent 模板内容
 * @param {boolean} isPage 模板、页面
 * @return {Promise<{replacedContent: string, filter: string, modules: string} | void>}
 */
function getFilterModule(resource, customParam, swanContent, isPage = true) {
    const filterObj = customParam.filterObj;
    const allFilters = filterObj[resource] || [];
    const filterPromiseArr = [];
    allFilters.forEach(item => {
        const { src, content, isTemplate, module } = item;
        const itemPromise = new Promise((resolve, reject) => {
            if (src) {
                (0, _util.promisify)(_fs2.default.readFile)(src, 'utf-8').then(result => {
                    resolve({
                        content: result,
                        module,
                        src
                    });
                }).catch(err => {
                    (0, _util2.log)(`${err} in '${resource}'`, 'error');
                    resolve({
                        content: '',
                        module
                    });
                });
            } else {
                resolve({
                    content,
                    module
                });
            }
        });
        if (isPage && !isTemplate) {
            filterPromiseArr.push(itemPromise);
        }
        if (!isPage && isTemplate) {
            filterPromiseArr.push(itemPromise);
        }
    });
    return Promise.all(filterPromiseArr).then(filters => {
        const moduleDefineArr = [];
        filters.forEach(item => {
            moduleDefineArr.push(getFilterModuleDefination(item));
        });
        const { transformContent, filterArr } = getFilterFuncArr(filters, swanContent);
        return {
            replacedContent: transformContent,
            filter: JSON.stringify(filterArr),
            modules: moduleDefineArr.join('')
        };
    }).catch(err => console.log(err));
}

/**
 * 将filterJs加入到依赖分析里
 * @param {Object} loaderContext loader上下文
 * @param {Object} customParam 编译过程中自定义参数对象
 */
function addFilteJsInDependencies(loaderContext, customParam) {
    const filterObj = customParam.filterObj;
    Object.keys(filterObj).forEach(key => {
        const filterAssets = filterObj[key];
        filterAssets.forEach(asset => {
            if (asset.src) {
                // 在win上硬处理，否则会导致多次读取缓存
                if (_os2.default.platform() === 'win32') {
                    loaderContext.addDependency((0, _util2.formatPath2)(asset.src));
                } else {
                    loaderContext.addDependency(asset.src);
                }
            }
        });
    });
}