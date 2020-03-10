'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file postcss设置
 * @author yangjingjiu
 */

const swanPluginsAssets = require('./swan');
const webUsetPluginsAssets = require('./web-user');
const webCustomPluginsAssets = require('./web-custom');

const pluginsAssets = {
    swan: swanPluginsAssets,
    webUser: webUsetPluginsAssets,
    webCustom: webCustomPluginsAssets
};

module.exports = function (context) {
    const options = context.options || {};
    const type = options.type || 'swan';
    const plugins = pluginsAssets[type](context);
    return {
        parse: false,
        plugins
    };
};