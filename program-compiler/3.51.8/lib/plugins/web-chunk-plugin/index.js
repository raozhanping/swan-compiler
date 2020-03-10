'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _webCustomChunkTemplate = require('./web-custom-chunk-template');

var _webCustomChunkTemplate2 = _interopRequireDefault(_webCustomChunkTemplate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class MergeJsModulePlugin {
    constructor(options) {
        this.workPath = options.workPath;
        this.moduleType = options.moduleType;
    }

    getAppJsChunk(chunks) {
        return chunks.filter(chunk => {
            return chunk.name === 'app';
        });
    }

    apply(compiler) {
        compiler.plugin('this-compilation', compilation => {
            compilation.plugin('optimize-tree', (chunks, modules, callback) => {
                compilation.chunkTemplate = new _webCustomChunkTemplate2.default({
                    outputOptions: compilation.outputOptions,
                    workPath: this.workPath,
                    moduleType: this.moduleType
                });
                const appJsChunk = this.getAppJsChunk(chunks);
                appJsChunk.forEach(jsChunk => {
                    jsChunk.__work_chunk__ = true;
                    jsChunk.hasRuntime = () => {
                        return false;
                    };
                });
                callback();
            });
        });
    }
}
exports.default = MergeJsModulePlugin; /**
                                        * @license
                                        * Copyright Baidu Inc. All Rights Reserved.
                                        *
                                        * This source code is licensed under the Apache License, Version 2.0; found in the
                                        * LICENSE file in the root directory of this source tree.
                                        *
                                        * @file 用户 js 合成
                                        * @author yangjingjiu
                                        */