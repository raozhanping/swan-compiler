'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _Template = require('webpack/lib/Template');

var _Template2 = _interopRequireDefault(_Template);

var _ChunkTemplate = require('webpack/lib/ChunkTemplate');

var _ChunkTemplate2 = _interopRequireDefault(_ChunkTemplate);

var _webpackSources = require('webpack-sources');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('../../util');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class WebCustomChunkTemplate extends _Template2.default {
    constructor(options) {
        const {
            outputOptions,
            workPath,
            moduleType
        } = options;
        super(outputOptions);
        this.chunkTemplate = new _ChunkTemplate2.default(outputOptions);
        this.workPath = workPath;
        this.moduleType = moduleType;
    }

    _renderJs(chunk, dependencyTemplates) {
        let newChunkSource = new _webpackSources.ConcatSource();
        newChunkSource.add(new _webpackSources.RawSource('try{'));
        let appIndex;
        let appModule;
        const jsChunkModules = chunk.getModules();
        const appPath = util.formatPath(_path2.default.join(this.workPath, 'app.js'));
        jsChunkModules.forEach((module, index) => {
            const newModuleSource = new _webpackSources.ConcatSource();
            const rawRequest = module.rawRequest || '';
            let moduleId = module.id;
            let requireTypeIdentify = '__webpack_require__';
            if (this.moduleType === 'amd') {
                moduleId = module.__queryPath__;
                requireTypeIdentify = 'require';
            }
            if (!module.__no_work__) {
                /* eslint-disable max-len */
                newModuleSource.add(new _webpackSources.RawSource(`window.define('${moduleId}', function (${requireTypeIdentify}, module, exports, define, swan, getApp, window, document, frames, self, location, navigator, localStorage, history, Caches, swaninterface) {\n`));
                /* eslint-enable max-len */
                newModuleSource.add(new _webpackSources.ConcatSource(module.source(dependencyTemplates, this.outputOptions), '\n'));
                if (module.__addpage__) {
                    newModuleSource.add(new _webpackSources.RawSource('\nPage({});'));
                }
                newModuleSource.add(new _webpackSources.RawSource('});\n'));
                newChunkSource.add(newModuleSource);
            }
            if (util.formatPath(rawRequest) === appPath) {
                appIndex = index;
                appModule = module;
            }
        });

        // app.js 前置
        if (appModule) {
            let appModuleId = appModule.id;
            if (this.moduleType === 'amd') {
                appModuleId = appModule.__queryPath__;
            }
            newChunkSource.add(new _webpackSources.RawSource(`${appModule.__supplyment__}require('${appModuleId}');\n`));
        }

        jsChunkModules.forEach((module, index) => {
            if (!module.__no_work__ && index !== appIndex && module.__isRoute__) {
                let requireContent = '';
                let moduleId = module.id;
                if (module.__supplyment__) {
                    requireContent = module.__supplyment__;
                }
                if (this.moduleType === 'amd') {
                    moduleId = module.__queryPath__;
                }
                requireContent += `require('${moduleId}');\n`;
                newChunkSource.add(new _webpackSources.RawSource(requireContent));
            }
        });
        newChunkSource.add(new _webpackSources.RawSource('}catch(e){window.webswanMonitor&&window.webswanMonitor(e);throw e;};'));
        return newChunkSource;
    }

    _renderChunk(chunk, dependencyTemplates) {
        let newChunkSource;
        if (chunk.name === 'app') {
            newChunkSource = this._renderJs(chunk, dependencyTemplates);
        }
        return newChunkSource;
    }

    render(chunk, moduleTemplate, dependencyTemplates) {
        let source;
        if (chunk.__work_chunk__) {
            source = this._renderChunk(chunk, dependencyTemplates);
        } else {
            source = this.chunkTemplate.render(chunk, moduleTemplate, dependencyTemplates);
        }
        return source;
    }

    updateHash(hash) {
        this.chunkTemplate.updateHash(hash);
    }

    updateHashForChunk(hash, chunk) {
        if (!chunk.__work_chunk__) {
            this.chunkTemplate.updateHashForChunk(hash, chunk);
        }
    }
}
exports.default = WebCustomChunkTemplate; /**
                                           * @license
                                           * Copyright Baidu Inc. All Rights Reserved.
                                           *
                                           * This source code is licensed under the Apache License, Version 2.0; found in the
                                           * LICENSE file in the root directory of this source tree.
                                           *
                                           * @file 自定义模板
                                           * @author yangjingjiu
                                           */