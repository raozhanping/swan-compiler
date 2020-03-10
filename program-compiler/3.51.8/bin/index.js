#!/usr/bin/env node

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 * @file 入口文件
 * @author zhuxin04
 */
const path = require('path');
process.cwd = function () {
    return path.resolve(__dirname, '..');
}
require('./main');
