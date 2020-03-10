'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理自定义组件css-加载文件内容
 * @author zhuxin04
 */
const readCache = require('read-cache');
module.exports = filename => readCache(filename, 'utf-8');