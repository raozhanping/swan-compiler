'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file swan css config
 * @file yangjingjiu
 */

const path = require('path');
const postcssFilter = require('../postcss-plugin/postcss-filter');
const postcssImport = require('../postcss-plugin/postcss-import');
const postcssSwan = require('../postcss-plugin/postcss-swan');
const postcssUrl = require('postcss-url');
const autoprefixer = require('autoprefixer');

module.exports = function swanPluginsAssets(context) {
    const {
        workPath,
        type = 'swan',
        ignoreAutoPrefix
    } = context.options;
    const postcssImportPlugin = postcssImport({
        resolve(nestImportPath, basedir, importOptions) {
            let findPath = path.isAbsolute(nestImportPath) ? path.join(workPath, nestImportPath) : nestImportPath;
            if (!/\.css$/.test(findPath)) {
                findPath += '.css';
            }
            return findPath;
        }
    });
    const postcssUrlPlugin = postcssUrl({
        url: 'rebase'
    });
    const postcssFilterPlugin = postcssFilter({
        from: 'page'
    });
    const postcssSwanPlugin = postcssSwan({
        type
    });
    const usingPlugins = [postcssFilterPlugin, postcssImportPlugin, postcssUrlPlugin, postcssSwanPlugin];
    if (!ignoreAutoPrefix) {
        usingPlugins.push(autoprefixer({ browsers: ['Chrome > 20'] }));
    }
    return usingPlugins;
};