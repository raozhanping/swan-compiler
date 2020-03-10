'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file web-custom css config
 * @author yangjingjiu
 */

const path = require('path');
const postcssPrefixer = require('postcss-prefixer');
const autoprefixer = require('autoprefixer');
const postcssFilter = require('../postcss-plugin/postcss-filter');
const postcssImport = require('../postcss-plugin/postcss-import');
const postcssSwan = require('../postcss-plugin/postcss-swan');
const postcssWeb = require('../postcss-plugin/postcss-web');
const postcsswebCustom = require('../postcss-plugin/postcss-web-custom-css');
const { formatPath } = require('../util');

module.exports = function webCustomPluginsAssets(context) {
    const {
        workPath,
        type,
        needMd5ClassFile = [],
        staticPrefix = '',
        webEnv
    } = context.options;
    const postcssFilterPlugin = postcssFilter();
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

    const resourcePath = context.webpack.resourcePath;
    const parseRes = path.parse(resourcePath);
    const dir = formatPath(parseRes.dir);
    /* eslint-disable max-len */
    const prefix = `${dir.substring(dir.lastIndexOf('/') + 1)}-${parseRes.name}`.replace(/_/g, '-');
    const postcssPrefixerPlugin = postcssPrefixer({
        prefix: prefix + '__'
    });

    const postcsswebCustomPlugin = postcsswebCustom(prefix);

    return [postcssFilterPlugin, autoprefixerPlugin, postcssImportPlugin, postcssSwanPlugin, postcssWebPlugin, postcssPrefixerPlugin, postcsswebCustomPlugin];
    /* eslint-enable max-len */
};