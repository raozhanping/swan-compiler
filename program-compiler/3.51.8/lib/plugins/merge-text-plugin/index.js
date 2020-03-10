'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _webpackSources = require('webpack-sources');

var _uglifyEs = require('uglify-es');

var _uglifyEs2 = _interopRequireDefault(_uglifyEs);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

var _babelCore = require('babel-core');

var _util = require('../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MergeTextPlugin {
    constructor(options) {
        this.emitFileName = options.emitFileName;
        this.isDelete = options.isDelete;
        this.isDev = options.isDev;
        this.custom = options.custom || [];
    }

    apply(compiler) {
        compiler.plugin('emit', (compilation, callback) => {
            const assets = compilation.assets;
            const assetsFiles = Object.keys(assets);
            const mergeFile = ['appConfig.js', 'pagesConfig.js', 'pagesMap.js', 'pagesComponents.js'];
            const isDev = this.isDev;
            let concatContent = '';

            mergeFile.forEach(file => {
                if (assetsFiles.indexOf(file) > -1) {
                    concatContent += assets[file].source();
                    delete assets[file];
                }
            });
            /* eslint-disable max-len */
            this.emitFileName = this.emitFileName.replace(/\[(?:(\w+):)?hash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, (...args) => {
                return _loaderUtils2.default.getHashDigest(concatContent, args[1], args[2], parseInt(args[3], 10));
            });

            if (!isDev) {
                const minifyResult = _uglifyEs2.default.minify(concatContent, {});
                if (!minifyResult.result) {
                    concatContent = minifyResult.code;
                } else {
                    (0, _util.log)(minifyResult.error, 'error');
                }
            }
            assetsFiles.forEach(file => {
                const extraAssets = ['swan-entry', 'json-entry', 'css-entry'];
                extraAssets.forEach(key => {
                    if (new RegExp(key).test(file)) {
                        delete assets[file];
                    }
                });
            });
            compilation.assets[this.emitFileName] = new _webpackSources.RawSource(concatContent);
            callback();
            /* eslint-enable max-len */
        });
    }
}
exports.default = MergeTextPlugin; /**
                                    * @license
                                    * Copyright Baidu Inc. All Rights Reserved.
                                    *
                                    * This source code is licensed under the Apache License, Version 2.0; found in the
                                    * LICENSE file in the root directory of this source tree.
                                    *
                                    * @file 合并文件
                                    * @author yangjingjiu
                                    */