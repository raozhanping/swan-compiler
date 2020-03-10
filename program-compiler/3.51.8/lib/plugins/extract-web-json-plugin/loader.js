'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.pitch = pitch;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');

var _LibraryTemplatePlugin2 = _interopRequireDefault(_LibraryTemplatePlugin);

var _SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

var _SingleEntryPlugin2 = _interopRequireDefault(_SingleEntryPlugin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file loader 的 pitch 方法
 * @author yangjingjiu
 */

const NS = _path2.default.dirname(_fsExtra2.default.realpathSync(__filename));

exports.default = source => source;

function pitch(request) {
    this.addDependency(this.resourcePath);
    const childFileName = 'extract-web-json-filename';
    const outputOptions = {
        filename: childFileName
    };
    const childCompilerName = `extract-web-json-filename ${NS} ${request}`;
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

    const callback = this.async();
    childCompiler.runAsChild(() => {
        try {
            const originalContent = this.exec(source, request);
            this[NS](originalContent, this.resourcePath);
            callback();
        } catch (e) {
            return callback(e);
        }
    });
}