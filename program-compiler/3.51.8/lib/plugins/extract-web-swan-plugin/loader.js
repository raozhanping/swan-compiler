'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.pitch = pitch;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

var _LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');

var _LibraryTemplatePlugin2 = _interopRequireDefault(_LibraryTemplatePlugin);

var _SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var _SingleEntryPlugin2 = _interopRequireDefault(_SingleEntryPlugin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const NS = _path2.default.dirname(_fs2.default.realpathSync(__filename)); /**
                                                                           * @license
                                                                           * Copyright Baidu Inc. All Rights Reserved.
                                                                           *
                                                                           * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                           * LICENSE file in the root directory of this source tree.
                                                                           *
                                                                           * @file loader的pitch方法， 将内容替换为// removed by extract-web-swan-plugin
                                                                           * @author yangjingjiu
                                                                           */

exports.default = content => content;

function pitch(request) {
    this.addDependency(this.resourcePath);
    let resultSource = '// removed by extract-web-swan-plugin';
    const childFilename = 'extract-web-swan-plugin-filename';
    const outputOptions = {
        filename: childFilename
    };
    const childCompilerName = `extract-web-swan-plugin ${NS} ${request}`;
    const childCompiler = this._compilation.createChildCompiler(childCompilerName, outputOptions);
    childCompiler.apply(new _LibraryTemplatePlugin2.default(null, 'commonjs2'));
    childCompiler.apply(new _SingleEntryPlugin2.default(this.context, `!!${request}`));

    let source;
    childCompiler.plugin('after-compile', (compilation, callback) => {
        source = compilation.assets[childFilename] && compilation.assets[childFilename].source() || '';
        compilation.chunks.forEach(chunk => {
            chunk.files.forEach(file => {
                delete compilation.assets[file];
            });
        });
        callback();
    });
    const callback = this.async();
    childCompiler.runAsChild((err, entries, compilation) => {
        compilation.fileDependencies.forEach(dep => {
            this.addDependency(dep);
        }, this);
        compilation.contextDependencies.forEach(dep => {
            this.addContextDependency(dep);
        }, this);
        try {
            let originalContent = this.exec(source, request);
            if (typeof originalContent === 'object') {
                originalContent = '';
            }
            this[NS](originalContent, this.resourcePath);
            if (resultSource) {
                callback(null, resultSource);
            } else {
                callback();
            }
        } catch (err) {
            return callback(err);
        }
    });
}