'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理自定义组件css
 * @author zhuxin04
 */
const postcss = require('postcss');
const path = require('path');
const valueParser = require('postcss-value-parser');
const {
    getAssetPath,
    relativePath,
    formatPath,
    ALL_IMPORTED_CSS
} = require('../../util');
const loadContent = require('./lib/load-content');
const processContent = require('./lib/process-content');
const TAG_SELECTOR_REG = new RegExp('^((?:[A-Za-z\\u00c0-\\uFFFF\\*\\-]|\\\\.)+)');

function prependPrefix(str) {
    str = str.replace(/\s+/g, ' ');
    if (!str.startsWith('swan-') && str !== ' ' && !str.startsWith('html') && !str.startsWith('*') && !str.startsWith('body') && TAG_SELECTOR_REG.test(str)) {

        if (str === 'page') {
            return 'body';
        } else if (str === 'page,') {
            return 'body, ';
        } else if (TAG_SELECTOR_REG.test(str)) {
            return 'swan-' + str;
        } else {
            return 'swan-' + str;
        }
    }
    return str;
}

function walkStep(str, splitSymbol) {
    let arr = str.split(splitSymbol);
    return arr.map(item => {
        return prependPrefix(item);
    }).join(splitSymbol);
}

function handleSymbol(str) {
    str = walkStep(str, ' ');
    str = walkStep(str, ',');
    str = walkStep(str, '+');
    str = walkStep(str, '>');
    str = walkStep(str, ' ');
    return str;
}

function walkClassSelector(selector) {
    const arr = [];
    let pos = 0;
    let max = selector.length;
    let start = -1;
    let end = -1;
    while (pos < max) {
        const val = selector[pos];
        if (pos === 0 && val !== '.') {
            start = 0;
        }
        if (val === '.') {
            if (start === 0) {
                end = pos;
            } else if (start === -1) {
                start = pos + 1;
            } else {
                end = pos;
            }
        }
        pos++;
        if (pos === max && end === -1) {
            end = max;
        }
        if (start !== -1 && end !== -1) {
            if (start === 0) {
                arr.push([1], selector.slice(start, end));
            } else {
                arr.push('.', [0], selector.slice(start, end));
            }
            start = end + 1;
            end = -1;
        }
    }
    return arr;
}

function walkSelector(selector) {
    selector = handleSymbol(selector);
    const resultArr = [];
    selector = selector.replace(/\s*,\s*/g, ',');
    const selectorArr = selector.split(',');
    const len = selectorArr.length;
    selectorArr.forEach((item, index) => {
        if (index !== len - 1) {
            item = item + ',';
        }
        if (item.indexOf('.') !== -1) {
            resultArr.push(...walkClassSelector(item));
        } else {
            resultArr.push([1], item);
        }
    });
    return resultArr;
}

function loadImportContent(assetPath, options) {
    return Promise.resolve(options.load(assetPath)).then(content => {
        return processContent(content, assetPath, options).then(importedResult => {
            const styles = importedResult.root;
            return styles;
        });
    });
}

function transformCssResults(styles, options, from) {
    const workPath = options.workPath;
    const importedCss = {};
    const pathArr = [];
    function walkStyles(styles, importedPath) {
        return new Promise((resolve, reject) => {
            const arr = [];
            styles.each(node => {
                if (node.type === 'atrule') {
                    if (node.name === 'import') {
                        const params = valueParser(node.params).nodes;
                        const assetPath = getAssetPath(importedPath, params[0].value, workPath);
                        let importPromise = loadImportContent(assetPath, options).then(importStyles => {
                            transformURL(importStyles, assetPath, workPath);
                            importedCss[assetPath] = importStyles;
                            if (pathArr.indexOf(assetPath) === -1) {
                                pathArr.push(assetPath);
                                return walkStyles(importStyles, assetPath);
                            }
                        });
                        arr.push(importPromise);
                    }
                }
            });
            return Promise.all(arr).then(args => {
                resolve(args);
            }).catch(e => {
                reject(e);
            });
        });
    }
    return walkStyles(styles, from).then(() => importedCss).catch(e => {
        throw e;
    });
}

function transformRpx(val) {
    const rpxReg = new RegExp('(-?(\\.)?\\d+(\\.\\d+)?)rpx', 'g');
    return val.replace(rpxReg, (str, num) => {
        if (parseFloat(num, 10) === 1) {
            return '0.5px';
        } else {
            return parseFloat(num, 10) / 7.5 + 'vw';
        }
    });
}

function transformURL(styles, from, workPath) {
    return styles.replaceValues(/url\((.*?)\)/g, function (str, filePath) {
        filePath = filePath.replace(/('|")/g, '');
        if (filePath.startsWith('data:') || filePath.startsWith('http')) {
            return `url(${filePath})`;
        } else {
            const urlAbsolutePath = getAssetPath(from, filePath, workPath);
            const insteadPath = formatPath(path.join('__custom_prefix_path__', '/', relativePath(workPath, urlAbsolutePath)));
            return `url(${insteadPath})`;
        }
    });
}

function parseStyles(from, styles, options) {
    const workPath = options.workPath;
    const customCssResults = [];
    styles.each(node => {
        if (node.type === 'atrule') {
            const rpxReg = new RegExp('(-?(\\.)?\\d+(\\.\\d+)?)rpx', 'g');
            node.replaceValues(rpxReg, (str, num) => {
                return parseFloat(num, 10) / 7.5 + 'vw';
            });
            if (node.name === 'import') {
                const params = valueParser(node.params).nodes;
                const assetPath = getAssetPath(from, params[0].value, workPath);
                const importKey = relativePath(workPath, assetPath);
                customCssResults.push({
                    path: importKey
                });
            } else if (node.name !== 'charset') {
                customCssResults.push(node.toString());
            }
        } else {
            let selector = node.selector;
            if (selector) {
                const allSelector = walkSelector(selector);
                let declStr = '{';
                node.walkDecls(decl => {
                    const importantOrNot = decl.important;
                    let transformedVal = transformRpx(decl.value + (importantOrNot ? '!important' : ''));

                    declStr += `${decl.prop}: ${transformedVal}; `;
                });
                declStr += '}';
                customCssResults.push(...allSelector, declStr);
            }
        }
    });
    return customCssResults;
}

module.exports = postcss.plugin('custom-import-parse', function (opts) {
    const options = Object.assign({
        load: loadContent
    }, opts);
    return function (styles, result) {
        const from = result.opts.from;
        transformURL(styles, from, options.workPath);
        const baseCss = parseStyles(from, styles, options);
        const dependencies = [];
        return Promise.resolve(transformCssResults(styles, options, from)).then(importedCss => {
            Object.keys(importedCss).forEach(key => {
                const x = parseStyles(key, importedCss[key], options);
                const importKey = relativePath(options.workPath, key);
                ALL_IMPORTED_CSS[options.sourceType][importKey] = x;
                dependencies.push(key);
            });
            result.__dependencies__ = dependencies;
            result.__css__ = JSON.stringify(baseCss);
        });
    };
});
module.exports.walkSelector = walkSelector;