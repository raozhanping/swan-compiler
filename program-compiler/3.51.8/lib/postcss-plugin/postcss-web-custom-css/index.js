'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理web化自定义组件中的css
 * @author jiamiao
 */
const postcss = require('postcss');
const TAG_SELECTOR_REG = new RegExp('^((?:[A-Za-z\\u00c0-\\uFFFF\\*\\-]|\\\\.)+)');
const IGNORE_TAGS = ['html', 'body'];

module.exports = postcss.plugin('postcss-web-custom-css', function (namespace) {
    return function (root) {
        root.walkRules(rule => {
            rule.selectors = rule.selectors.map(selector => {
                const newNamespace = `${namespace}__`;
                const reg = new RegExp(`\\.${newNamespace}`, 'g');
                selector = selector.replace(reg, '.');
                selector = selector.replace(/\./g, '.' + newNamespace);
                // 只给都是标签的选择器加前置选择器限制
                if (TAG_SELECTOR_REG.test(selector) && !IGNORE_TAGS.includes(selector)) {
                    return `swan-${namespace} ${selector}`;
                }
                return selector;
            });
        });
    };
});