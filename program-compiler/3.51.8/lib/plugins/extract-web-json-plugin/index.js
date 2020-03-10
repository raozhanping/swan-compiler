'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _webpackSources = require('webpack-sources');

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _util = require('../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const NS = _path2.default.dirname(_fsExtra2.default.realpathSync(__filename)); /**
                                                                                * @license
                                                                                * Copyright Baidu Inc. All Rights Reserved.
                                                                                *
                                                                                * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                                * LICENSE file in the root directory of this source tree.
                                                                                *
                                                                                * @file 抽取 json 文件
                                                                                * @author yangjingjiu
                                                                                */

class ExtractWebJsonPlugin {
    constructor(options) {
        this.filename = options.filename;
        this.emitFileName1 = options.emitFileName1;
        this.emitFileName2 = options.emitFileName2;
        this.ejsTemplatePath = options.ejsTemplatePath;
        this.workPath = options.workPath;
        this.cycleCustomComponents = options.cycleCustomComponents;
        this.jsonSourceAssets = {};
        this.sourcePlus = {};
    }

    apply(compiler) {
        compiler.plugin('this-compilation', compilation => {
            compilation.plugin('normal-module-loader', loaderContext => {
                loaderContext[NS] = (content, aPath) => {
                    this.jsonSourceAssets[aPath] = content;
                };
            });

            compilation.plugin('additional-assets', callback => {
                let appConfigContent = '';
                Object.keys(this.jsonSourceAssets).forEach(filePath => {
                    const jsonSource = this.jsonSourceAssets[filePath];
                    const rPath = (0, _util.formatPath)(_path2.default.relative(this.workPath, filePath));
                    const rPathKey = rPath.replace(/\.json$/, '');
                    if (rPathKey === 'app') {
                        const appConfigTpl = _fsExtra2.default.readFileSync(this.ejsTemplatePath, 'utf8');
                        appConfigContent = _ejs2.default.render(appConfigTpl, {
                            appConfig: JSON.stringify(jsonSource)
                        });
                    } else {
                        const resSource = Object.assign({}, jsonSource);
                        if (jsonSource.usingComponents) {
                            resSource.usingComponents = {};
                            Object.keys(jsonSource.usingComponents).forEach(key1 => {
                                const file = jsonSource.usingComponents[key1];
                                let lastFile = file;
                                if (_path2.default.isAbsolute(file)) {
                                    lastFile = file.substring(1);
                                } else {
                                    const cPath = _path2.default.resolve(_path2.default.dirname(filePath), file);
                                    let crPath = _path2.default.relative(this.workPath, cPath);
                                    if (!_fsExtra2.default.existsSync(`${cPath}.json`)) {
                                        const nodeModuleJson = (0, _util.findInNodeModules)(filePath, this.workPath, file);
                                        if (nodeModuleJson) {
                                            crPath = _path2.default.relative(this.workPath, nodeModuleJson);
                                        }
                                    }
                                    lastFile = (0, _util.formatPath)(crPath);
                                }
                                if (rPathKey !== lastFile) {
                                    resSource.usingComponents[key1] = lastFile;
                                }
                            });
                        }
                        this.sourcePlus[rPathKey] = resSource;
                    }
                });
                const syntheticFile = `
                    void function (localScope) {
                        localScope.pagesConfig = ${JSON.stringify(this.sourcePlus)};
                    }(window.ENV === 'master' ? window : window.page.swanbox);
                `;
                compilation.assets[this.emitFileName1] = new _webpackSources.RawSource(syntheticFile);
                compilation.assets[this.emitFileName2] = new _webpackSources.RawSource(appConfigContent);
                callback();
            });
        });
    }
}
exports.default = ExtractWebJsonPlugin;