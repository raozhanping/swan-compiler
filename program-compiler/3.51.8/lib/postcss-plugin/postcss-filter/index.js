'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 过滤用户css，如 expression 表达式
 * @author yangjingjiu
 */

const postcss = require('postcss');
const util = require('../../util');

function filterErrLog(errMsg) {
    const errObj = new Error(errMsg);
    util.errorNext(errObj, 0, 1);
}

module.exports = postcss.plugin('postcss-filter', function (options = {}) {
    // css url 计数器
    const urlMaxNum = 700;
    let urlNum = 0;
    return function (root) {
        root.walkDecls(decl => {
            try {
                const val = decl.value;
                const start = decl.source.start;
                const filePath = decl.source.input.file;
                const from = options.from || '';
                const posInfo = `${filePath}(${start.line}:${start.column})`;
                // 匹配 exprssion 表达式
                if (/^expression.*/.test(val)) {
                    filterErrLog(`expression 表达式禁止使用\n${posInfo}`);
                }
                if (/url\(.*\)/.test(val) && from === 'page') {
                    urlNum++;
                    if (Math.ceil(urlNum / 2) > urlMaxNum) {
                        filterErrLog(`css 样式中 url 个数超出总数${urlMaxNum}条限制\n${posInfo}`);
                    }
                }
            } catch (err) {
                util.log(err, 'error');
            }
        });
    };
});