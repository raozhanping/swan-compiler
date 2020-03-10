'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _webpackSources = require('webpack-sources');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _util = require('../../util');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const NS = _path2.default.dirname(_fsExtra2.default.realpathSync(__filename)); /**
                                                                                * @license
                                                                                * Copyright Baidu Inc. All Rights Reserved.
                                                                                *
                                                                                * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                                * LICENSE file in the root directory of this source tree.
                                                                                *
                                                                                * @file 抽取用户swan文件
                                                                                * @author yangjingjiu
                                                                                */
class ExtractWebSwanPlugin {
    constructor(options) {
        this.filename = options.filename;
        this.emitFileName = options.emitFileName;
        this.options = Object.assign({}, options);
        this.custom = options.custom;
        this.workPath = options.workPath;
        this.pagesJsonMap = options.pagesJsonMap;
        this.swanSourceAssets = {};
    }

    static loadder(options) {
        return { loader: require.resolve('./loader.js'), options };
    }

    extract(options) {
        let loader = options.use;
        options = Object.assign({ remove: true }, options);
        delete options.use;
        delete options.fallback;
        const ternimalLoader = [this.loadder(options)].concat(loader);
        return ternimalLoader;
    }

    apply(compiler) {
        compiler.plugin('this-compilation', compilation => {
            compilation.plugin('normal-module-loader', loaderContext => {
                loaderContext[NS] = (content, aPath) => {
                    this.swanSourceAssets[aPath] = content;
                };
            });

            compilation.plugin('additional-assets', callback => {
                let pagesMap = '';
                const pagesFilterModulesMap = [];
                const pagesFilterMap = {};
                let pagesTplMap = '';
                let stylesScopeMap = {};
                Object.keys(this.swanSourceAssets).forEach(filePath => {
                    const swanSource = this.swanSourceAssets[filePath];
                    const resourcePath = util.formatPath(filePath);
                    const sourceObj = JSON.parse(swanSource);
                    const rPath = util.formatPath(_path2.default.relative(this.workPath, filePath));
                    const rPathKey = rPath.replace(/\.swan$/, '');
                    const pageJsonMap = this.pagesJsonMap[rPathKey];
                    let transformContent = (pageContent => {
                        if (pageContent) {
                            let transformContent = pageContent.replace(/\$\{/g, '&#36;{');
                            transformContent = transformContent.replace(/\`/g, '&#96;');
                            return transformContent;
                        }
                        return '';
                    })(sourceObj.pagesMap);
                    // 自定义组件 page 化
                    if (pageJsonMap && pageJsonMap.isComponents) {
                        pagesMap += '"' + rPathKey + '":`' + transformContent + '`,';
                    }
                    if (this.custom.indexOf(rPathKey) === -1) {
                        pagesMap += '"' + rPathKey + '":`' + transformContent + '`,';
                    } else {
                        compilation.assets[`${rPathKey}.swan`] = new _webpackSources.RawSource(sourceObj.customComponentToPages);
                    }
                    pagesTplMap += '"' + rPathKey + '":{' + sourceObj.pagesTplMap + '},';
                    pagesFilterModulesMap.push(`
                        '${rPathKey}': ${sourceObj.pagesFilterModulesMap}
                    `);
                    pagesFilterMap[rPathKey] = sourceObj.pagesFilterMap;
                    // 每个路由和scope的映射关系，方便web运行时获取当前要在模板body和html
                    // 上加的scope标识，限制用户在page的css中给body、html、*设置样式会在全局生效
                    stylesScopeMap[rPathKey] = 'scope' + _crypto2.default.createHash('md5').update(resourcePath.replace(/\.swan$/g, '')).digest('hex').slice(0, 8);
                });
                const pagesMapContent = `
                    void function (localScope) {
                        localScope.pagesMap = {${pagesMap}};
                        localScope.pagesTplMap = {${pagesTplMap}};
                        localScope.pagesFilterMap = ${JSON.stringify(pagesFilterMap)};
                        localScope.stylesScopeMap = ${JSON.stringify(stylesScopeMap)};
                        localScope.pagesFilterModulesMap = {${pagesFilterModulesMap.join(',')}};
                    }(window.ENV === 'master' ? window : window.page.swanbox);
                `;
                compilation.assets[this.emitFileName] = new _webpackSources.RawSource(pagesMapContent);
                callback();
            });
        });
    }
}
exports.default = ExtractWebSwanPlugin;
ExtractWebSwanPlugin.extract = ExtractWebSwanPlugin.prototype.extract.bind(ExtractWebSwanPlugin);