'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file web-user css config
 * @author yangjingjiu
 */

const path = require('path');
const postcssCustomProperties = require('postcss-custom-properties');
const autoprefixer = require('autoprefixer');
const postcssFilter = require('../postcss-plugin/postcss-filter');
const postcssImport = require('../postcss-plugin/postcss-import');
const postcssSwan = require('../postcss-plugin/postcss-swan');
const postcssWeb = require('../postcss-plugin/postcss-web');

module.exports = function webUserPluginsAssets(context) {
    const {
        workPath,
        type,
        needMd5ClassFile = [],
        staticPrefix = '',
        webEnv
    } = context.options;
    const postcssFilterPlugin = postcssFilter();
    const postcssCustomPropertiesPlugin = postcssCustomProperties();
    const autoprefixerPlugin = autoprefixer({
        overrideBrowserslist: ['last 2 versions'],
        cascade: false
    });
    const postcssImportPlugin = postcssImport({
        resolve(nestImportPath, basedir, importOptions) {
            let findPath = path.isAbsolute(nestImportPath) ? path.join(workPath, nestImportPath) : nestImportPath;
            if (!/\.css$/.test(findPath)) {
                findPath += '.css';
            }
            return findPath;
        }
    });
    const postcssSwanPlugin = postcssSwan({
        type
    });
    const postcssWebPlugin = postcssWeb({
        needMd5ClassFile,
        workPath,
        staticPrefix,
        webEnv
    });
    return [postcssFilterPlugin, postcssCustomPropertiesPlugin, autoprefixerPlugin, postcssImportPlugin, postcssSwanPlugin, postcssWebPlugin];
};