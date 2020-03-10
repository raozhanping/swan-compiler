'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理css文件中的标签选择器以及属性中 rpx转换
 * @author zhuxin04
 */
const postcss = require('postcss');
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

module.exports = postcss.plugin('postcss-swan', function (opts) {
    const type = opts.type;
    return function (root, result) {
        const rpxReg = new RegExp('(-?(\\.)?\\d+(\\.\\d+)?)rpx', 'g');
        root.replaceValues(rpxReg, (str, num) => {
            if (type === 'swan') {
                if (parseFloat(num, 10) === 1) {
                    return '0.5px';
                } else {
                    return parseFloat(num, 10) / 7.5 + 'vw';
                }
            }
            return `calc(var(--appwidth) / 750 * ${num})`;
        });
        root.walkRules(rule => {
            if (rule.parent && rule.parent.name !== 'keyframes') {
                rule.selectors = rule.selectors.map(selector => {
                    let afterSymbol = handleSymbol(selector);
                    return afterSymbol;
                });
            }
        });
    };
});