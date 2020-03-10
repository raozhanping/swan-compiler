'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _webpackSources = require('webpack-sources');

var _util = require('../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 对app.js的拆分处理
 * @author zhuxin04
 */
const Template = require("webpack/lib/Template");
const ChunkTemplate = require("webpack/lib/ChunkTemplate");
let {
    PLUGIN_ROOT
} = global.SWAN_CLI_ARGV;

class CustomChunkTemplate extends Template {
    constructor(obj) {
        let {
            outputOptions,
            moduleType,
            workPath,
            pageJs = {},
            customJs = {},
            dynamicName = '',
            interfaceJsAsset = {},
            sourceType = 'swan',
            publicComponents,
            publicPages,
            appConfig,
            extraComponent
        } = obj;
        super(outputOptions);
        this.chunkTemplate = new ChunkTemplate(outputOptions);
        this.moduleType = moduleType;
        this.workPath = workPath;
        this.pageJs = pageJs;
        this.customJs = customJs;
        // 动态库名字
        this.dynamicName = dynamicName;
        // 动态库接口文件路径
        this.interfaceJsAsset = interfaceJsAsset;
        this.publicComponents = publicComponents;
        this.publicPages = publicPages;
        this.appConfig = appConfig;
        this.sourceType = sourceType;
        this.extraComponent = extraComponent;
    }
    _renderChunk(chunk, dependencyTemplates) {
        let chunkSource;
        if (/\.swan$/.test(chunk.name)) {
            if ('swan' === this.sourceType) {
                chunkSource = this._renderSwan(chunk, dependencyTemplates);
            } else if ('plugin' === this.sourceType) {
                chunkSource = this._pluginRenderSwan(chunk, dependencyTemplates, this.sourceType);
            } else if ('dynamicLib' === this.sourceType) {
                chunkSource = this._dynamicRenderSwan(chunk, dependencyTemplates, this.sourceType);
            }
        } else {
            if ('swan' === this.sourceType) {
                chunkSource = this._renderJs(chunk, dependencyTemplates);
            } else if ('plugin' === this.sourceType) {
                chunkSource = this._pluginRenderJs(chunk, dependencyTemplates);
            } else if ('dynamicLib' === this.sourceType) {
                chunkSource = this._dynamicRenderJs(chunk, dependencyTemplates);
            }
        }
        return chunkSource;
    }
    _renderSwan(chunk, dependencyTemplates) {
        let chunkSource = new _webpackSources.ConcatSource();
        chunk.getModules().forEach(module => {
            if (chunk.name !== 'allCusomComponents.swan') {
                const runtimeContent = _ejs2.default.render(_util.TEMPLATE_OBJ.runtime, {
                    customComponentPath: (0, _util.formatPath)(_path2.default.relative(this.workPath, module.resource))
                });
                chunkSource.add(new _webpackSources.RawSource(runtimeContent));
            }
            let moduleSourceFlag = module.source(dependencyTemplates, this.outputOptions).source();
            let replacedContent = moduleSourceFlag.replace('#componentUsingComponentMap#', module._usingComponents);
            replacedContent = replacedContent.replace('#componentUsingComponentMapInPlugin#', module._usingComponentsForPlugin);
            let moduleSource = new _webpackSources.RawSource(replacedContent, '\n');
            chunkSource.add(moduleSource);
        });
        return chunkSource;
    }
    _dynamicRenderSwan(chunk, dependencyTemplates) {
        let registerDynamicLibObj = {};
        let chunkSource = new _webpackSources.ConcatSource();
        let dynamicFlag = `dynamicLib://${this.dynamicName}`;
        const prefixContent = `window.defineDynamicLib('${dynamicFlag}',` + 'function (extraAssetDefine, require, module, exports) {\n';
        chunkSource.add(new _webpackSources.RawSource(prefixContent));
        chunk.getModules().forEach(module => {
            if (module.__queryPath__) {
                for (let i = 0; i < this.publicComponents.length; i++) {
                    if (module.__queryPath__.endsWith(this.publicComponents[i].path)) {
                        registerDynamicLibObj[`dynamicLib://${this.dynamicName}/${this.publicComponents[i].name}`] = `${module.__queryPath__}.swan`;
                        break;
                    }
                }
            }
            let moduleSourceFlag = module.source(dependencyTemplates, this.outputOptions).source();
            const innerContent = moduleSourceFlag.replace('#componentUsingComponentMap#', module._usingComponents);
            let moduleSource = new _webpackSources.RawSource(innerContent, '\n');
            chunkSource.add(moduleSource);
        });
        chunkSource.add(new _webpackSources.RawSource('}'));
        chunkSource.add(new _webpackSources.RawSource(',' + JSON.stringify(registerDynamicLibObj)));
        chunkSource.add(new _webpackSources.RawSource(');\n'));
        return chunkSource;
    }
    _pluginRenderSwan(chunk, dependencyTemplates) {
        let registerDynamicLibObj = {};
        let chunkSource = new _webpackSources.ConcatSource();
        if ('allCusomComponents.swan' === chunk.name) {
            let pluginFlag = `plugin-private://${global.APPID}`;
            const prefixContent = `window.definePlugin('${pluginFlag}',` + 'function (extraAssetDefine, require, module, exports) {\n';
            chunkSource.add(new _webpackSources.RawSource(prefixContent));
        }
        chunk.getModules().forEach(module => {
            if (module.__queryPath__) {
                for (let i = 0; i < this.publicComponents.length; i++) {
                    if (module.__queryPath__.endsWith(this.publicComponents[i].path)) {
                        registerDynamicLibObj[`plugin://${global.APPID}/${this.publicComponents[i].name}`] = `${module.__queryPath__}.swan`;
                        break;
                    }
                }
            }
            let moduleSourceFlag = module.source(dependencyTemplates, this.outputOptions).source();
            let innerContent = moduleSourceFlag.replace('#componentUsingComponentMap#', module._usingComponents);
            innerContent = innerContent.replace('#componentUsingComponentMapInPlugin#', module._usingComponentsForPlugin);
            innerContent = innerContent.replace('#pluginId#', global.APPID);
            const componentPath = (0, _util.formatPath)(_path2.default.relative(PLUGIN_ROOT, module.resource));
            if ('allCusomComponents.swan' === chunk.name) {
                innerContent = `extraAssetDefine('${componentPath}', function (require, modulesExports) {${innerContent}\n`;
            } else {
                innerContent = `window.define('__plugin__/${global.APPID}/${componentPath}', function (require, modulesExports) {${innerContent}\n`;
            }
            innerContent += '})\n';
            let moduleSource = new _webpackSources.RawSource(innerContent, '\n');
            chunkSource.add(moduleSource);
        });
        if ('allCusomComponents.swan' === chunk.name) {
            chunkSource.add(new _webpackSources.RawSource('}'));
            chunkSource.add(new _webpackSources.RawSource(',' + JSON.stringify(registerDynamicLibObj)));
            chunkSource.add(new _webpackSources.RawSource(');\n'));
        }
        return chunkSource;
    }
    isPageComponent(resourcePath, chunkName) {
        resourcePath = (0, _util.formatPath)(resourcePath);
        return chunkName !== 'common' && resourcePath in this.pageJs && resourcePath in this.customJs;
    }
    _renderJs(chunk, dependencyTemplates) {
        let chunkSource = new _webpackSources.ConcatSource();
        chunk.getModules().forEach(module => {
            let moduleSource = new _webpackSources.ConcatSource();
            let moduleId = '';
            let requireTypeIdentify = '__webpack_require__';
            if (this.moduleType === 'amd') {
                moduleId = module.__queryPath__;
                requireTypeIdentify = 'require';
            } else {
                moduleId = module.id;
            }
            if (!module.noGen) {
                const moduleWarpper = `window.define('${moduleId}', function (${requireTypeIdentify}, ` + 'module, exports, define, swan, getApp, window, document, frames, self, ' + 'location, navigator, localStorage, history, Caches, swaninterface, top) {\n';
                moduleSource.add(new _webpackSources.RawSource(moduleWarpper));
                moduleSource.add(new _webpackSources.ConcatSource(module.source(dependencyTemplates, this.outputOptions), '\n'));
                if (this.isPageComponent(module.resource, chunk.name)) {
                    moduleSource.add(new _webpackSources.RawSource('\nPage({_isCustomComponentPage: true});\n\n'));
                }
                moduleSource.add(new _webpackSources.RawSource('});\n'));
                chunkSource.add(moduleSource);
            }
        });
        chunk.entryModules.forEach(entryModule => {
            let requireContent = '';
            if (this.moduleType === 'amd') {
                if (entryModule.__supplyment__) {
                    requireContent = entryModule.__supplyment__;
                    requireContent += `require('${entryModule.__queryPath__}');\n`;
                }
            } else if (entryModule.__supplyment__) {
                requireContent = entryModule.__supplyment__;
                requireContent += `require('${entryModule.id}');\n`;
            }
            chunkSource.add(new _webpackSources.RawSource(requireContent));
        });
        return chunkSource;
    }
    getInterFace(chunk) {
        let interfaceJsAssets = Object.keys(this.interfaceJsAsset);
        return chunk.getModules().filter(module => {
            return interfaceJsAssets.includes(module.resource);
        });
    }
    // 动态库appjs生成template
    _dynamicRenderJs(chunk, dependencyTemplates) {
        let registerDynamicLibObj = {};
        let chunkSource = new _webpackSources.ConcatSource();
        let dynamicFlag = `dynamicLib://${this.dynamicName}`;
        let requireTypeIdentify = this.moduleType === 'amd' ? 'require' : '__webpack_require__';
        /* eslint-disable max-len */
        chunkSource.add(new _webpackSources.RawSource(`window.defineDynamicLib('${dynamicFlag}', function (define, require, module, exports) {\n`));
        /* eslint-disable max-len */
        chunk.getModules().forEach(module => {
            let moduleSource = new _webpackSources.ConcatSource();
            let moduleId = '';
            if (this.moduleType === 'amd') {
                moduleId = module.__queryPath__;
            } else {
                moduleId = module.id;
            }
            if (!module.noGen) {
                const moduleWarpper = `define('${moduleId}', function (${requireTypeIdentify}, ` + 'module, exports, define, swan, getApp, window, document, frames, self, ' + 'location, navigator, localStorage, history, Caches, swaninterface, top) {\n';
                moduleSource.add(new _webpackSources.RawSource(moduleWarpper));
                moduleSource.add(new _webpackSources.ConcatSource(module.source(dependencyTemplates, this.outputOptions), '\n'));
                moduleSource.add(new _webpackSources.RawSource('});\n'));
                for (let i = 0; i < this.publicComponents.length; i++) {
                    if (module.__queryPath__.endsWith(this.publicComponents[i].path)) {
                        registerDynamicLibObj[`dynamicLib://${this.dynamicName}/${this.publicComponents[i].name}`] = module.__queryPath__;
                        break;
                    }
                }
                chunkSource.add(moduleSource);
            }
        });
        chunk.entryModules.forEach(entryModule => {
            let requireContent = '';
            if (this.moduleType === 'amd') {
                if (entryModule.__supplyment__) {
                    requireContent = entryModule.__supplyment__;
                    requireContent += `require('${entryModule.__queryPath__}');\n`;
                }
            } else if (entryModule.__supplyment__) {
                requireContent = entryModule.__supplyment__;
                requireContent += `require('${entryModule.id}');\n`;
            }
            chunkSource.add(new _webpackSources.RawSource(requireContent));
        });
        let dynamicInterface = this.getInterFace(chunk);
        if (dynamicInterface.length > 0) {
            const requirePath = this.moduleType === 'amd' ? dynamicInterface[0].__queryPath__ : dynamicInterface[0].id;
            chunkSource.add(new _webpackSources.RawSource(`module.exports = function () {return require('${requirePath}')};\n`));
        }
        chunkSource.add(new _webpackSources.RawSource('}'));
        chunkSource.add(new _webpackSources.RawSource(',' + JSON.stringify(registerDynamicLibObj)));
        chunkSource.add(new _webpackSources.RawSource(');\n'));
        chunkSource.add(`window.__swanRoute='${dynamicFlag}';`);
        return chunkSource;
    }
    _pluginRenderJs(chunk, dependencyTemplates) {
        let registerPluginObj = {};
        let chunkSource = new _webpackSources.ConcatSource();
        let dynamicFlag = `plugin-private://${global.APPID}`;
        let requireTypeIdentify = this.moduleType === 'amd' ? 'require' : '__webpack_require__';
        /* eslint-disable max-len */
        chunkSource.add(new _webpackSources.RawSource(`window.definePlugin('${dynamicFlag}', function (define, ${requireTypeIdentify}, module, exports) {\n`));
        /* eslint-disable max-len */
        chunk.getModules().forEach(module => {
            let moduleSource = new _webpackSources.ConcatSource();
            // 插件的app.js不管amd还是cmd，都是queryPath，不是moduleId
            let moduleId = module.__queryPath__;
            if (!module.noGen) {
                /* eslint-disable max-len */
                moduleSource.add(new _webpackSources.RawSource(`define('${moduleId}', function (normalRequire, module, exports, define, swan, getApp, window, document, frames, self, location, navigator, localStorage, history, Caches, swaninterface) {\n`));
                /* eslint-enable max-len */
                moduleSource.add(new _webpackSources.ConcatSource(module.source(dependencyTemplates, this.outputOptions), '\n'));
                if (this.isPageComponent(module.resource, chunk.name)) {
                    moduleSource.add(new _webpackSources.RawSource('\nPage({_isCustomComponentPage: true});\n\n'));
                }
                moduleSource.add(new _webpackSources.RawSource('});\n'));
                for (let i = 0; i < this.publicComponents.length; i++) {
                    if (module.__queryPath__.endsWith(this.publicComponents[i].path)) {
                        registerPluginObj[`plugin://${global.APPID}/${this.publicComponents[i].name}`] = module.__queryPath__;
                        break;
                    }
                }
                for (let i = 0; i < this.publicPages.length; i++) {
                    if (module.__queryPath__.endsWith(this.publicPages[i].path)) {
                        registerPluginObj[`plugin://${global.APPID}/${this.publicPages[i].name}`] = module.__queryPath__;
                        break;
                    }
                }
                chunkSource.add(moduleSource);
            }
        });
        chunk.entryModules.forEach(entryModule => {
            let requireContent = '';
            if (entryModule.__supplyment__) {
                requireContent = entryModule.__supplyment__;
                requireContent += `${requireTypeIdentify}('${entryModule.__queryPath__}');\n`;
            }
            chunkSource.add(new _webpackSources.RawSource(requireContent));
        });
        let pluginInterface = this.getInterFace(chunk);
        if (pluginInterface.length > 0) {
            const requirePath = pluginInterface[0].__queryPath__;
            chunkSource.add(new _webpackSources.RawSource(`module.exports = function () {return ${requireTypeIdentify}('${requirePath}')};\n`));
        }
        chunkSource.add(new _webpackSources.RawSource('}'));
        let num = 1;
        let addExtraComponent = Object.keys(this.extraComponent).reduce((prev, curr) => {
            prev[`__pirvateCustomComponentPage${num}`] = curr;
            num++;
            return prev;
        }, registerPluginObj);
        chunkSource.add(new _webpackSources.RawSource(',' + JSON.stringify(addExtraComponent)));
        chunkSource.add(new _webpackSources.RawSource(');\n'));
        chunkSource.add(`window.__swanRoute='${dynamicFlag}';`);
        return chunkSource;
    }
    render(chunk, moduleTemplate, dependencyTemplates) {
        let source;
        if (chunk.entryModules) {
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
        if (!chunk.entryModules) {
            this.chunkTemplate.updateHashForChunk(hash, chunk);
        }
    }
}
exports.default = CustomChunkTemplate;