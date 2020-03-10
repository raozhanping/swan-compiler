'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _webpackSources = require('webpack-sources');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _util = require('../../util');

var util = _interopRequireWildcard(_util);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const NS = _path2.default.dirname(_fsExtra2.default.realpathSync(__filename)); /**
                                                                                * @license
                                                                                * Copyright Baidu Inc. All Rights Reserved.
                                                                                *
                                                                                * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                                * LICENSE file in the root directory of this source tree.
                                                                                *
                                                                                * @file 抽取用户 custom components css 文件
                                                                                * @author yangjingjiu
                                                                                */
class ExtractWebCustomCssPlugin {
    constructor(options) {
        this.workPath = options.workPath;
        this.custom = options.custom;
        this.emitFileName = options.emitFileName;
        this.pageComponentsCssAssets = options.pageComponentsCss;
        this.customCssSourceAssets = {};
        this.pageComponentsCssModules = [];
    }

    apply(compiler) {
        compiler.plugin('this-compilation', compilation => {
            compilation.plugin('normal-module-loader', loaderContext => {
                loaderContext[NS] = (content, aPath) => {
                    this.customCssSourceAssets[aPath] = content;
                };
            });

            compilation.plugin('additional-assets', callback => {
                Object.keys(this.customCssSourceAssets).forEach(filePath => {
                    const cssSource = this.customCssSourceAssets[filePath]['0'][1].replace(/\n|\r/g, '');
                    const rPath = util.formatPath(_path2.default.relative(this.workPath, filePath));
                    compilation.assets[rPath] = new _webpackSources.RawSource(cssSource);
                });
                callback();
            });

            compilation.plugin('optimize-tree', (chunks, modules, callback) => {
                this.pageComponentsCssModules = modules.filter(module => this.pageComponentsCssAssets.includes(module.resource));
                callback();
            });

            compilation.plugin('optimize-assets', (assets, callback) => {
                let pageComponentsCssContent = '';
                let developerCssName = Object.keys(assets).find(asset => asset.startsWith('developer'));
                // 把自定义组件page化的css也处理打进developer.css中
                this.pageComponentsCssModules.forEach((module, index) => {
                    // 这里不知道线上生成的hash值，从资源中读key，developer.js是在emit时生成，所以此时只有developer.css资源
                    if (developerCssName) {
                        assets[developerCssName].add(module._pageComponentCss);
                    } else {
                        pageComponentsCssContent += module._pageComponentCss;
                    }
                    if (index === this.pageComponentsCssModules.length - 1 && !developerCssName) {
                        const emitFileName = this.emitFileName.replace(/\[(?:(\w+):)?hash(?::([a-z]+\d*))?(?::(\d+))?\]/ig, (...args) => {
                            return _loaderUtils2.default.getHashDigest(pageComponentsCssContent, args[1], args[2], parseInt(args[3], 10));
                        });
                        assets[emitFileName] = new _webpackSources.RawSource(pageComponentsCssContent);
                    }
                });
                const assetsKeys = Object.keys(assets);
                const customAssets = {};
                this.custom.forEach(key => {
                    const swanFile = `${key}.swan`;
                    const cssFile = `${key}.css`;
                    const fileArr = key.split('/');
                    const fileArrLen = fileArr.length;
                    const prefix = `${fileArr[fileArrLen - 2]}-${fileArr[fileArrLen - 1]}`.replace(/_/g, '-');
                    if (!customAssets[key]) {
                        customAssets[key] = {
                            tpl: assetsKeys.indexOf(swanFile) > -1 ? assets[swanFile].source() : '',
                            css: assetsKeys.indexOf(cssFile) > -1 ? assets[cssFile].source() : '',
                            prefix
                        };
                    }
                });
                const customComponentsContent = `
                    void function (localScope) {
                        localScope.pageCustomComponents = ${JSON.stringify(customAssets)};
                    }(window.ENV === 'master' ? window : window.page.swanbox);
                `;
                assets['pagesComponents.js'] = new _webpackSources.RawSource(customComponentsContent);
                callback();
            });
        });
    }
}
exports.default = ExtractWebCustomCssPlugin;