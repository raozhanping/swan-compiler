'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _webpackSources = require('webpack-sources');

var _customChunkTemplate = require('./custom-chunk-template');

var _customChunkTemplate2 = _interopRequireDefault(_customChunkTemplate);

var _swan = require('./../../generate-entry/swan');

var _swan2 = _interopRequireDefault(_swan);

var _parser = require('@babel/parser');

var parser = _interopRequireWildcard(_parser);

var _traverse = require('@babel/traverse');

var _traverse2 = _interopRequireDefault(_traverse);

var _generator = require('@babel/generator');

var _generator2 = _interopRequireDefault(_generator);

var _util = require('../../util');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let dynamicRoot = global.SWAN_CLI_ARGV.DYNAMIC_LIB_ROOT; /**
                                                          * @license
                                                          * Copyright Baidu Inc. All Rights Reserved.
                                                          *
                                                          * This source code is licensed under the Apache License, Version 2.0; found in the
                                                          * LICENSE file in the root directory of this source tree.
                                                          *
                                                          * @file 对app.js的拆分处理
                                                          * @author zhuxin04
                                                          */

let pluginRoot = global.SWAN_CLI_ARGV.PLUGIN_ROOT;
class CommonChunkPlugin {
    constructor(options) {
        const {
            workPath,
            moduleType,
            entryContext,
            jsClass,
            customJs,
            output,
            pagesJS,
            utilJS,
            isSplitAppJs,
            compileWorkPath,
            dynamicNameQuote = {},
            interfaceJsAsset,
            appConfig,
            publicComponents,
            publicPages,
            // 代表来自哪一个compiler['swan'、'plugin'、'dynamicLib']
            sourceType = 'swan',
            // 插件编译的时候才有值，收集插件的所有page
            pluginPageList = [],
            // 没有被publish的自定义组件swan路径
            extraComponent = []
        } = options;
        this.workPath = (sourceType => {
            if ('swan' === sourceType) {
                return workPath;
            } else if ('plugin' === sourceType) {
                return pluginRoot;
            } else if ('dynamicLib' === sourceType) {
                return dynamicRoot;
            }
        })(sourceType);
        this.moduleType = moduleType;
        this.entryContext = entryContext;
        // 是否需要拆分页面级别的js为单独的文件
        this.isSplitToSingleJs = isSplitAppJs;
        this.jsClass = jsClass;
        this.customJs = customJs;
        this.output = output;
        this.pageJs = pagesJS;
        this.utilJS = utilJS;
        this.compileWorkPath = compileWorkPath;
        // 动态库开发模式命名，若有则为动态库开发模式编译
        this.dynamicNameQuote = dynamicNameQuote;
        // 动态库接口文件
        this.interfaceJsAsset = interfaceJsAsset;
        this.allCssKey = _path2.default.resolve(this.workPath, 'allImportedCssContent.js');
        // 小程序目录下app.json内容
        this.appConfig = appConfig || {};
        // 插件和动态库对外公开的自定义组件资源
        this.publicComponents = publicComponents;
        // 插件对外公开的page资源
        this.publicPages = publicPages;
        this.allImportedCssContentCss = (sourceType => {
            if ('swan' === sourceType) {
                return _util.TEMPLATE_OBJ.css;
            } else if ('plugin' === sourceType) {
                return _util.TEMPLATE_OBJ.pluginCss;
            } else if ('dynamicLib' === sourceType) {
                return _util.TEMPLATE_OBJ.dynamicLibCss;
            }
        })(sourceType);
        this.sourceType = sourceType;
        this.pluginPageList = pluginPageList;
        this.extraComponent = extraComponent;
    }
    getEntryChunks(chunks) {
        let entryChunksArr = [];
        chunks.forEach(chunk => {
            if (/app$/.test(chunk.name)) {
                entryChunksArr.push(chunk);
            }
        });
        return entryChunksArr;
    }
    addChunk(name) {
        const chunk = this.compilation.addChunk(name);
        chunk.id = name;
        chunk.entryModules = [];
        return chunk;
    }
    getModulePosition(module) {
        const moduleResource = (0, _util.formatPath)(module.resource);
        const packageKeys = Object.keys(this.jsClass);
        const mainPackage = this.jsClass['__main__'] || {};
        const mainPages = mainPackage.pages || {};
        if (moduleResource in mainPages) {
            return 'app';
        } else {
            for (let i = 0, len = packageKeys.length; i < len; i++) {
                const keyItem = packageKeys[i];
                const packageItem = this.jsClass[keyItem] || {};
                const { pages, independent, root } = packageItem;
                if (keyItem !== '__main__' && !independent && moduleResource in pages) {
                    return root;
                    break;
                }
            }
        }
    }
    isPageJs(module) {
        const moduleResource = (0, _util.formatPath)(module.resource);
        return moduleResource in this.pageJs;
    }
    isCustomJs(module) {
        const moduleResource = (0, _util.formatPath)(module.resource);
        return moduleResource in this.customJs;
    }
    isAppJs(module) {
        return (0, _util.formatPath)(_path2.default.relative(this.workPath, module.resource || '')).replace(/\.js$/, '') === 'app';
    }
    getQuery(module) {
        const resource = (0, _util.formatPath)(module.resource);
        const query = (0, _util.formatPath)(_path2.default.relative(this.workPath, resource)).replace(/\.js$/, '');
        return query;
    }
    setQueryPath(module) {
        module.__queryPath__ = this.getQuery(module);
    }
    setPluginQueryPath(module) {
        module.__pluginQueryPath__ = `plugin-private://${global.APPID}/${this.getQuery(module)}`;
    }
    getUsingComponents(jsonPath, jsonObj = {}) {
        const jsPath = jsonPath.replace(/\.json$/, '.js');
        let isCusComponentPage = false;
        const usingComponents = [];
        const usingComponentsForPlugin = [];
        if (jsPath in this.pageJs && jsonObj.component) {
            isCusComponentPage = true;
        }
        if (jsonObj.usingComponents) {
            for (const component in jsonObj.usingComponents) {
                let relativePath = jsonObj.usingComponents[component];
                const result = (0, _util.getSpecialUsingComponent)(relativePath);
                if (result.isSpecial && result.specialType !== 'plugin-private') {
                    try {
                        const re = new RegExp('^' + result.specialType + '://');
                        let specialArr = relativePath.replace(re, '').split('/');
                        const realName = this.appConfig.config[result.appJsonFlag][specialArr[0]]['provider'];
                        specialArr.splice(0, 1, realName);
                        const realPath = specialArr.join('/');
                        relativePath = `${result.specialType}://${realPath}`;
                        if ('plugin' === result.specialType) {
                            usingComponentsForPlugin.push(relativePath);
                        }
                        // 动态库后续也需要修改，但是目前还是用usingComponents字段
                        else {
                                usingComponents.push(relativePath);
                            }
                    } catch (err) {
                        usingComponents.push(relativePath);
                        const errroMsg = `${jsonPath}中配置的${component}没有找到对应的` + `${result.specialType}配置，请检查app.json`;
                        const errObj = new Error(errroMsg);
                        (0, _util.errorNext)(errObj, 0, 1);
                    }
                } else if (result.isSpecial && result.specialType === 'plugin-private') {
                    usingComponentsForPlugin.push(relativePath);
                } else {
                    let absolutePath = '';
                    if (_path2.default.isAbsolute(relativePath)) {
                        absolutePath = _path2.default.join(this.workPath, relativePath);
                    } else {
                        let filePathDir = _path2.default.dirname(jsPath);
                        absolutePath = _path2.default.join(filePathDir, relativePath);
                        if (!_fsExtra2.default.existsSync(absolutePath + '.js')) {
                            absolutePath = (0, _util.findInNodeModules)(jsonPath, this.workPath, relativePath);
                        }
                    }
                    const customComponentPath = (0, _util.formatPath)(_path2.default.relative(this.workPath, absolutePath));
                    const decorateComponentPath = customComponentPath;
                    usingComponents.push(decorateComponentPath);
                }
            }
        }
        return {
            isCusComponentPage,
            usingComponents,
            usingComponentsForPlugin
        };
    }
    setSupplementAsync(module) {
        return new Promise(resolve => {
            const resource = (0, _util.formatPath)(module.resource);
            const queryPath = this.getQuery(module);
            let supplyment = '';
            if (this.isPageJs(module) || this.isCustomJs(module) || this.isAppJs(module)) {
                const jsonPath = resource.replace(/\.js$/, '.json');
                if ('plugin' === this.sourceType) {
                    supplyment = `window.__swanRoute='plugin-private://${global.APPID}/${queryPath}';`;
                } else if ('dynamicLib' === this.sourceType) {
                    supplyment = `window.__swanRoute='dynamicLib://${this.dynamicNameQuote.name}/${queryPath}';`;
                } else {
                    supplyment = `window.__swanRoute='${queryPath}';`;
                }
                (0, _util.readJSONContent)(jsonPath).then(jsonObj => {
                    const { isCusComponentPage, usingComponents,
                        usingComponentsForPlugin } = this.getUsingComponents(jsonPath, jsonObj);
                    if (isCusComponentPage) {
                        if ('plugin' === this.sourceType) {
                            usingComponentsForPlugin.unshift(`plugin-private://${global.APPID}/${queryPath}`);
                        } else {
                            usingComponents.unshift(queryPath);
                        }
                    }
                    supplyment += `window.usingComponents=${JSON.stringify(usingComponents || [])};`;
                    supplyment += `window.usingPluginComponents=${JSON.stringify(usingComponentsForPlugin || [])};`;
                    module.__supplyment__ = supplyment;
                    resolve();
                }).catch(e => {
                    (0, _util.log)(e);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    setPagesChunk(chunkObj, chunkName, module) {
        let packageChunk;
        if (chunkName in chunkObj) {
            chunkObj[chunkName].addModule(module);
            chunkObj[chunkName].entryModules.push(module);
        } else {
            packageChunk = this.addChunk(chunkName);
            packageChunk.addModule(module);
            packageChunk.entryModules.push(module);
            chunkObj[chunkName] = packageChunk;
        }
    }
    setModulePageChunk(module) {
        const moduleChunkName = _path2.default.relative(this.workPath, module.resource).replace(/\.js$/, '');
        if (moduleChunkName !== 'app') {
            const pageChunk = this.addChunk(moduleChunkName);
            pageChunk.addModule(module);
            pageChunk.entryModules.push(module);
        }
    }
    setChunkModule(chunk, module) {
        const moduleResource = module.resource;
        if (/app\.js/.test(moduleResource)) {
            // app.js加入common.js中
            chunk.entryModules.unshift(module);
        } else {
            chunk.entryModules.push(module);
        }
        chunk.addModule(module);
    }

    apply(compiler) {
        // 插件编译的时候，把plugin的page信息放在compiler的实例上，manager里截住app.json的路由，往原先的pageList里插入插件的page路径
        compiler.pluginPages = this.pluginPageList;
        compiler.plugin('this-compilation', compilation => {
            compilation.chunkTemplate = new _customChunkTemplate2.default({
                outputOptions: compilation.outputOptions,
                moduleType: this.moduleType,
                workPath: this.workPath,
                pageJs: this.pageJs,
                customJs: this.customJs,
                dynamicName: this.dynamicNameQuote.name,
                interfaceJsAsset: this.interfaceJsAsset,
                sourceType: this.sourceType,
                appConfig: this.appConfig,
                publicComponents: this.publicComponents,
                publicPages: this.publicPages,
                extraComponent: this.extraComponent
            });
            this.compilation = compilation;
            compilation.plugin('optimize-tree', (chunks, modules, callback) => {
                // 这里把webpack chunkTemplateSource的缓存清空了，为了让template能重新render，理论上来说会比以前慢一些
                // 这是为了动态库可能需要更改app.json，产出要变，所以要重新renderTemplate
                compilation.cache = null;
                Promise.resolve().then(() => {
                    const entryChunkArr = this.getEntryChunks(chunks);
                    const chunkObj = {};
                    const allPromise = [];
                    // 申明主包chunk
                    let mainPackageChunk;
                    entryChunkArr.forEach(entryChunk => {
                        const allModules = entryChunk.getModules();
                        const entryModule = entryChunk.entryModule;
                        entryChunk.entrypoints = [];
                        entryChunk.id = entryChunk.name;
                        const baseParh = _path2.default.dirname(_path2.default.relative(this.entryContext, entryChunk.entryModule.rawRequest));
                        entryChunk.entryModules = [];
                        entryChunk.entryModule.noGen = true;
                        // 主包、普通分包、独立分包的公用common.js
                        let commonChunk;
                        if (this.isSplitToSingleJs) {
                            commonChunk = this.addChunk('common');
                        }
                        if (entryChunk.name === 'app') {
                            // 主包及普通分包
                            mainPackageChunk = entryChunk;
                            allModules.forEach(module => {
                                if (module !== entryModule) {
                                    this.setQueryPath(module);
                                    if ('plugin' === this.sourceType && 'cmd' === this.moduleType) {
                                        this.setPluginQueryPath(module);
                                    }
                                    allPromise.push(this.setSupplementAsync(module));
                                    const isCustom = this.isCustomJs(module);
                                    const isPage = this.isPageJs(module);
                                    const isAppJs = this.isAppJs(module);
                                    const modulePosition = this.getModulePosition(module) || '';
                                    if (isPage) {
                                        if (modulePosition === 'app') {
                                            if (this.isSplitToSingleJs) {
                                                this.setModulePageChunk(module);
                                                // 主包下的page.js
                                                this.setPagesChunk(chunkObj, 'pages', module);
                                            }
                                            entryChunk.entryModules.push(module);
                                        } else {
                                            entryChunk.removeModule(module);
                                            const appChunkName = _path2.default.join(modulePosition, 'app');
                                            this.setPagesChunk(chunkObj, appChunkName, module);
                                        }
                                    }
                                    if (isAppJs) {
                                        entryChunk.entryModules.unshift(module);
                                    }
                                    if (isCustom && entryChunk.entryModules.indexOf(module) === -1 && (!modulePosition || modulePosition === 'app')) {
                                        entryChunk.entryModules.push(module);
                                    }
                                    if (this.isSplitToSingleJs) {
                                        if (isCustom || !isPage) {
                                            this.setChunkModule(commonChunk, module);
                                        }
                                    }
                                }
                            });
                        } else {
                            // 独立分包
                            const standardCommonJSName = (0, _util.formatPath)(_path2.default.join(baseParh, 'common'));
                            const packageCommonChunk = this.addChunk(standardCommonJSName);
                            allModules.forEach(module => {
                                if (module !== entryModule) {
                                    this.setQueryPath(module);
                                    allPromise.push(this.setSupplementAsync(module));
                                    const isPage = this.isPageJs(module);
                                    if (isPage) {
                                        this.setModulePageChunk(module);
                                        entryChunk.entryModules.push(module);
                                    } else {
                                        // 删除分包中的非page、非自定义组件模块
                                        entryChunk.removeModule(module);
                                        mainPackageChunk.addModule(module);
                                        packageCommonChunk.addModule(module);
                                        packageCommonChunk.entryModules.push(module);
                                    }
                                }
                            });
                        }
                    });
                    Promise.all(allPromise).then(() => {
                        if ('plugin' === this.sourceType && 'amd' === this.moduleType) {
                            let app = chunks.filter(chunk => 'app' === chunk.id)[0];
                            const entryModule = app.entryModule;
                            app.getModules().forEach(module => {
                                if (module !== entryModule) {
                                    let moduleAst = parser.parse(module._source._value);
                                    (0, _traverse2.default)(moduleAst, {
                                        CallExpression: root => {
                                            if (root.node && root.node.callee && root.node.callee.name === 'require') {
                                                var requireInfo = root.node;
                                                var requireParam = requireInfo.arguments[0];
                                                if (requireParam.type === 'StringLiteral') {
                                                    let requireValue = requireParam.value;
                                                    let relativePath;
                                                    if (_path2.default.isAbsolute(requireValue)) {
                                                        relativePath = (0, _util.formatPath)(requireValue).substring(1).replace(/.js$/, '');
                                                    } else {
                                                        relativePath = (0, _util.formatPath)(_path2.default.relative(pluginRoot, _path2.default.resolve(_path2.default.dirname(module.resource), requireValue))).replace(/.js$/, '');
                                                    }
                                                    requireParam.value = `plugin-private://${global.APPID}/${relativePath}`;
                                                } else {
                                                    (0, _util.errorNext)('插件中require引用的模块不能为变量!', 0, 1);
                                                }
                                            }
                                        }
                                    });
                                    module._source._value = (0, _generator2.default)(moduleAst, {}).code;
                                }
                            });
                            callback();
                        } else {
                            callback();
                        }
                    });
                });
            });

            /**
             * 插件的app.js不管amd还是cmd，都不用moduleId，而是路径
             */
            compilation.plugin('optimize-module-ids', modules => {
                if ('plugin' === this.sourceType && 'cmd' === this.moduleType) {
                    modules.forEach(module => {
                        if (module.__pluginQueryPath__) {
                            module.id = module.__pluginQueryPath__;
                        }
                    });
                }
            });

            /**
             * 独立分包中添加app.json资源文件
             */
            compilation.plugin('additional-assets', callback => {
                if ('swan' === this.sourceType) {
                    const entryInstance = new _swan2.default({ workPath: this.workPath });
                    const swanExecuteJsPath = _path2.default.resolve(this.compileWorkPath, 'swan-execute.js');
                    entryInstance.getAllPackages().then(allPackages => {
                        const independentPaths = allPackages.reduce((ac, packageItem) => {
                            if (packageItem.independent) {
                                ac.push(packageItem.root);
                            }
                            return ac;
                        }, []);
                        independentPaths.forEach(item => {
                            // this.setAllCustomComponentCssChunk(compilation, item);
                            const jsonKey = _path2.default.join(item, 'app.json');
                            // console.log('entryInstance.appConfig: ', entryInstance.appConfig.config);
                            compilation.assets[jsonKey] = new _webpackSources.RawSource(JSON.stringify(entryInstance.appConfig.config));
                        });
                        _fsExtra2.default.readFile(swanExecuteJsPath, 'utf-8').then(data => {
                            independentPaths.forEach(item => {
                                compilation.assets[_path2.default.join(item, 'swan-execute.js')] = new _webpackSources.RawSource(data);
                            });
                            callback();
                        }).catch(() => callback());
                    });
                } else {
                    callback();
                }
            });
        });

        /**
         * 删除无用资源
         */
        compiler.plugin('should-emit', compilation => {
            delete compilation.assets['css-entry.js'];
        });
    }
}
exports.default = CommonChunkPlugin;