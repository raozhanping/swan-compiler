'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 矫正插件、动态库改变的outputPath
 * @author jiamiao
 */
let {
    OUTPUT,
    SWAN_CLI_PROCESS
} = global.SWAN_CLI_ARGV;
const { PLUGIN_PATH_IN_OUTPUT } = require('../../constant');
const outputPath = _path2.default.isAbsolute(OUTPUT) ? OUTPUT : _path2.default.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);

class CorrectOutputPahtPlugin {
    constructor(options) {
        this.compilerType = options.compilerType || 'plugin';
        this.dynamicNameQuote = options.dynamicNameQuote || {};
    }
    apply(compiler) {
        compiler.plugin('emit', (compilation, callback) => {
            compiler.dynamicLibName = this.dynamicNameQuote.name;
            const lastOutputPath = compiler.outputPath;
            let detailedPath;
            if ('plugin' === this.compilerType) {
                detailedPath = `/${PLUGIN_PATH_IN_OUTPUT}/${global.APPID}`;
            } else if ('dynamicLib' === this.compilerType) {
                detailedPath = `/__dynamicLib__/${this.dynamicNameQuote.name}`;
            }
            const currOutputPath = _path2.default.join(outputPath, detailedPath);
            if (lastOutputPath !== currOutputPath) {
                const compilerFs = compiler.outputFileSystem;
                try {
                    if ('MemoryFileSystem' === compilerFs.constructor.name) {
                        compilerFs.rmdirSync(lastOutputPath);
                    } else {
                        _fsExtra2.default.removeSync(lastOutputPath);
                    }
                } catch (err) {
                    // 不需要处理
                }
                compiler.outputPath = currOutputPath;
            }
            callback();
        });
    }
}
exports.default = CorrectOutputPahtPlugin;