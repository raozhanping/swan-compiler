'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理自定义组件css-处理import的css文件
 * @author zhuxin04
 */
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
module.exports = function processContent(content, filename, options) {
    const postcssInitial = postcss();
    const isIgnoreAutoPrefix = options.isIgnoreAutoPrefix;
    if (!isIgnoreAutoPrefix) {
        postcssInitial.use(autoprefixer({ browsers: ['Chrome > 20'] }));
    }
    return postcssInitial.process(content, {
        from: filename,
        parser: null
    }).catch(() => {
        return '';
    });
};