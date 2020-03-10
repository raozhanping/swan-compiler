'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理自定义组件中的css
 * @author zhuxin04
 */
const postcss = require('postcss');
const path = require('path');
const util = require('./../../util');
module.exports = postcss.plugin('postcss-swan', function (namespace, cssPath, hostPath) {
    return function (root) {
        // 自定义组件css中资源路劲替换
        root.replaceValues(/url\((.*)\)/g, function (str, filePath) {
            filePath = filePath.replace(/('|")/g, '');
            if (filePath.startsWith('data:') || filePath.startsWith('http')) {
                return `url(${filePath})`;
            } else {
                const cssDirPath = path.dirname(cssPath);
                const hosDirPath = path.dirname(hostPath);
                const fileAbsoulutePath = path.resolve(cssDirPath, filePath);
                const insteadPath = util.formatPath(path.relative(hosDirPath, fileAbsoulutePath));
                return `url(${insteadPath})`;
            }
        });
        root.each(node => {
            const newNamespace = `${namespace}__`;
            if (!node.name) {
                let selector = node.selector || '';
                const reg = new RegExp(`\\.${newNamespace}`, 'g');
                selector = selector.replace(reg, '.');
                selector = selector.replace(/\./g, '.' + newNamespace);
                // 自定义组件标签选择器增加 swan-组件名 前缀
                let selectors = selector.split(',');
                selectors = selectors.map(item => {
                    return `swan-${namespace} ${item}`;
                });
                node.selector = selectors.join(',');
            }
        });
    };
});