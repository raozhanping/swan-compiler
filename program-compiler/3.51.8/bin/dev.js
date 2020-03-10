/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 开发环境下的入口
 * @author zhuxin04
 */
global.__DEV__ = true;
require('./base.setting');
require('babel-register')({
    retainLines: true,
    sourceMaps: 'inline',
    presets: [['env', {
        targets: {
            node: 'current'
        },
        loose: false
    }]]
});
require('../webpack/run');
