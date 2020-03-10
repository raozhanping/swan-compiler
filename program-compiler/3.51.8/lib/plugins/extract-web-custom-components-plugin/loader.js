'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.pitch = pitch;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('../../util');

var _loaderUtils = require('loader-utils');

var _LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');

var _LibraryTemplatePlugin2 = _interopRequireDefault(_LibraryTemplatePlugin);

var _SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var _SingleEntryPlugin2 = _interopRequireDefault(_SingleEntryPlugin);

var _index = require('../../loader/web-page-component/index.js');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const NS = _path2.default.dirname(_fs2.default.realpathSync(__filename)); /**
                                                                           * @license
                                                                           * Copyright Baidu Inc. All Rights Reserved.
                                                                           *
                                                                           * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                           * LICENSE file in the root directory of this source tree.
                                                                           *
                                                                           * @file 提取web custom components css
                                                                           * @author yangjingjiu
                                                                           */

exports.default = content => content;

function pitch(request) {
    const {
        pageComponentsCss,
        needMd5ClassFile
    } = (0, _loaderUtils.getOptions)(this);
    this.addDependency(this.resourcePath);
    let getExtCss;
    // 获取自定义组件page化，写进developer.css中的处理
    if (pageComponentsCss.includes((0, _util.formatPath)(this.resourcePath))) {
        getExtCss = (0, _index.processCustomComponentCss)(this.resourcePath, this, needMd5ClassFile);
    } else {
        getExtCss = new Promise(resolve => {
            resolve('');
        });
    }
    const callback = this.async();
    getExtCss.then(css => {
        this._module._pageComponentCss = css;
        let resultSource = '// removed by extract-web-custom-css-plugin';
        const childFileName = 'extract-web-custom-css-filename';
        const outputOptions = {
            filename: childFileName
        };
        const childCompilerName = `extract-web-custom-css-filename ${NS} ${request}`;
        const childCompiler = this._compilation.createChildCompiler(childCompilerName, outputOptions);
        childCompiler.apply(new _LibraryTemplatePlugin2.default(null, 'commonjs'));
        childCompiler.apply(new _SingleEntryPlugin2.default(this.context, `!!${request}`));
        let source = '';
        childCompiler.plugin('after-compile', (compilation, callback) => {
            source = compilation.assets[childFileName] && compilation.assets[childFileName].source();
            compilation.chunks.forEach(chunk => {
                chunk.files.forEach(file => {
                    delete compilation.assets[file];
                });
            });
            callback();
        });
        childCompiler.runAsChild(() => {
            try {
                const originalContent = this.exec(source, request);
                this[NS](originalContent, this.resourcePath);
                if (resultSource) {
                    callback(null, resultSource);
                } else {
                    callback();
                }
            } catch (e) {
                return callback(e);
            }
        });
    }).catch(err => {
        (0, _util.noWatchErrorNext)(err, 0, 1);
    });
}