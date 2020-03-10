'use strict';

var _Chunk = require('webpack/lib/Chunk');

var _Chunk2 = _interopRequireDefault(_Chunk);

var _webpackSources = require('webpack-sources');

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const promisify = require('util.promisify'); /**
                                              * @license
                                              * Copyright Baidu Inc. All Rights Reserved.
                                              *
                                              * This source code is licensed under the Apache License, Version 2.0; found in the
                                              * LICENSE file in the root directory of this source tree.
                                              *
                                              * @file 当在低版本时生成html文件
                                              * @author zhuxin04
                                              */


class SwanHtmlPlugin {
    constructor(options) {
        this.htmlReplaceVariables = options.htmlReplaceVariables;
        this.useOldPackHtml = options.useOldPackHtml;
        this.swanCorePath = options.swanCorePath;
        this.compileWorkPath = options.compileWorkPath;
    }

    apply(compiler) {

        const useOldPackHtml = this.useOldPackHtml;
        const swanCorePath = this.swanCorePath;
        const compileWorkPath = this.compileWorkPath;
        compiler.plugin('this-compilation', compilation => {
            let htmlChunks = [];
            compilation.plugin('optimize-tree', (chunks, modules, callback) => {
                if (useOldPackHtml) {
                    htmlChunks = chunks.map(() => new _Chunk2.default());
                    chunks.forEach((chunk, i) => {
                        const htmkChunk = htmlChunks[i];
                        htmkChunk.name = chunk.name;
                    });
                } else {
                    const slaveChunk = new _Chunk2.default('globals/slaves/slaves');
                    slaveChunk.isSlave = true;
                    const masterChunk = new _Chunk2.default('globals/master/master');
                    masterChunk.isMaster = true;
                    htmlChunks.push(slaveChunk, masterChunk);
                }
                callback();
            });

            compilation.plugin('additional-assets', callback => {
                let slaveTemplatePromise;
                let masterTemplatePromise;
                if (useOldPackHtml) {
                    const slaveTemplatePath = _path2.default.resolve(compileWorkPath, 'globals/slaves/pageBaseHtml.html');
                    slaveTemplatePromise = promisify(_fs2.default.readFile)(slaveTemplatePath, 'utf-8');

                    const masteTemplatePath = _path2.default.resolve(compileWorkPath, 'globals/master/app-service.html');
                    masterTemplatePromise = promisify(_fs2.default.readFile)(masteTemplatePath, 'utf-8');
                } else {
                    slaveTemplatePromise = promisify(_fs2.default.readFile)(_path2.default.resolve(swanCorePath, 'slaves/slaves.html'), 'utf-8');
                    masterTemplatePromise = promisify(_fs2.default.readFile)(_path2.default.resolve(swanCorePath, 'master/master.html'), 'utf-8');
                }
                Promise.all([slaveTemplatePromise, masterTemplatePromise]).then(res => {
                    const [slaveTemplate, masterTemplate] = res;
                    htmlChunks.forEach(htmlChunk => {
                        let htmkChunkName = htmlChunk.name;
                        let assetName = htmkChunkName + '.html';
                        let htmlTemplate = '';
                        if (useOldPackHtml) {
                            if (htmkChunkName !== 'app') {
                                htmlTemplate = slaveTemplate;
                            } else {
                                assetName = 'app-service' + '.html';
                                htmlTemplate = masterTemplate;
                            }
                        } else if (htmlChunk.isSlave) {
                            htmlTemplate = slaveTemplate;
                        } else if (htmlChunk.isMaster) {
                            htmlTemplate = masterTemplate;
                        }
                        const htmlResult = this.renderTemplate(compiler, htmlTemplate, htmkChunkName);
                        compilation.assets[assetName] = new _webpackSources.RawSource(htmlResult);
                    });
                    callback();
                });
            });
        });
    }

    renderTemplate(compiler, templateContent, htmkChunkName) {
        const destOutputPath = compiler.options.output.path;
        const htmlReplaceVariables = this.htmlReplaceVariables;
        const runtimeRelativeProjectPath = _path2.default.relative(_path2.default.resolve(destOutputPath, _path2.default.dirname(htmkChunkName)), destOutputPath);
        const runtimeRelativePath = _path2.default.join(runtimeRelativeProjectPath, 'globals');
        const options = {
            moduleName: htmkChunkName ? _path2.default.basename(htmkChunkName) : '',
            runtimeRelativeProjectPath
        };
        const builtinVariable = {
            runtimeRelativePath: runtimeRelativePath
        };
        let result = _ejs2.default.render(templateContent, options);
        if (htmlReplaceVariables) {
            for (let variable in htmlReplaceVariables) {
                let value = builtinVariable[htmlReplaceVariables[variable]] || htmlReplaceVariables[variable];
                result = result.replace(new RegExp(variable, 'g'), value);
            }
        }
        return result;
    }
}

module.exports = SwanHtmlPlugin;