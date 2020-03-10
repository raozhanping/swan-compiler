'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _customChunkTemplate = require('./custom-chunk-template');

var _customChunkTemplate2 = _interopRequireDefault(_customChunkTemplate);

var _webpackSources = require('webpack-sources');

var _util = require('../../util');

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _swan = require('../../generate-entry/swan');

var _swan2 = _interopRequireDefault(_swan);

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

const mkdirp = require('mkdirp');

class CommonSwanChunkPlugin {

    constructor(options) {
        const {
            workPath,
            moduleType,
            customJs,
            pagesJS,
            compileWorkPath,
            dynamicNameQuote = {},
            interfaceJsAsset,
            publicComponents,
            publicPages,
            appConfig,
            sourceType,
            extraComponent
        } = options;

        this.workPath = workPath;
        this.moduleType = moduleType;
        this.customJs = customJs;
        this.pagesJs = pagesJS;
        this.compileWorkPath = compileWorkPath;
        this.allCssKey = _path2.default.resolve(this.workPath, 'allImportedCssContent.js');
        this.dynamicNameQuote = dynamicNameQuote;
        this.interfaceJsAsset = interfaceJsAsset;
        this.publicComponents = publicComponents;
        this.publicPages = publicPages;
        this.appConfig = appConfig;
        this.sourceType = sourceType || 'swan';
        this.extraComponent = extraComponent;
    }

    addChunk(name) {
        const chunk = this.compilation.addChunk(name);
        chunk.id = name;
        chunk.entryModules = [];
        chunk.customModules = [];
        return chunk;
    }

    cacheAllCss(cssContent) {
        const writePath = (0, _util.cacheKey)(this.allCssKey);
        mkdirp(_path2.default.dirname(writePath), mkdirErr => {
            if (mkdirErr) {
                return;
            }
            _fsExtra2.default.writeFile(writePath, JSON.stringify(cssContent), 'utf-8', () => {});
        });
    }
    writeAllCssForDynamic(compilation, cssObj) {
        let renderContent = _util.TEMPLATE_OBJ.dynamicLibCss.replace('#allDynamicLibImportCss#', JSON.stringify(cssObj));
        renderContent = renderContent.replace('#dynamicLibName#', this.dynamicNameQuote.name);
        compilation.assets['allImportedCssContent.js'] = new _webpackSources.RawSource(renderContent);
        this.cacheAllCss(cssObj);
    }
    writeAllCssForPlugin(compilation, cssObj) {
        let renderContent = _util.TEMPLATE_OBJ.pluginCss.replace('#allPluginImportCss#', JSON.stringify(cssObj));
        renderContent = renderContent.replace('#pluginName#', global.APPID);
        compilation.assets['allImportedCssContent.js'] = new _webpackSources.RawSource(renderContent);
        this.cacheAllCss(cssObj);
    }
    setAllCustomComponentCssChunk(compilation, cb) {
        _fsExtra2.default.readJson((0, _util.cacheKey)(this.allCssKey), (err, jsonInfo) => {
            let cacheJsonInfo = {};
            if (err) {
                cacheJsonInfo = _util.ALL_IMPORTED_CSS[this.sourceType];
            } else {
                cacheJsonInfo = Object.keys(_util.ALL_IMPORTED_CSS[this.sourceType]).reduce((prev, current) => {
                    prev[current] = _util.ALL_IMPORTED_CSS[this.sourceType][current];
                    return prev;
                }, jsonInfo);
            }
            if ('swan' === this.sourceType) {
                this.writeAllCss(compilation, cacheJsonInfo);
            } else if ('plugin' === this.sourceType) {
                this.writeAllCssForPlugin(compilation, cacheJsonInfo);
            } else if ('dynamicLib' === this.sourceType) {
                this.writeAllCssForDynamic(compilation, cacheJsonInfo);
            }
            cb();
        });
    }
    writeAllCss(compilation, cssObj) {
        const renderContent = _util.TEMPLATE_OBJ.css.replace('#allCustomComponentsImportCssMap#', JSON.stringify(cssObj));
        compilation.assets['allImportedCssContent.js'] = new _webpackSources.RawSource(renderContent);
        this.cacheAllCss(cssObj);
    }
    getQuery(module) {
        const resource = (0, _util.formatPath)(module.resource);
        const query = (0, _util.formatPath)(_path2.default.relative(this.workPath, resource)).replace(/\.swan$/, '');
        return query;
    }

    getPrefixPath(filePath) {
        return (0, _util.formatPath)(_path2.default.relative(this.workPath, filePath).replace(/^\//, ''));
    }

    /**
     * 得到swan模板中引用的资源路径
     * @param {string} basePath 文件引用基于swan文件的路径
     * @param {string}userPath 开发者所写的路径格式
     * @return {string} 资源文件的绝对路劲
     */
    getAssetPath(basePath, userPath = '', deep = false) {
        if (!userPath) {
            return '';
        }
        let assetPath = userPath;
        if (_path2.default.isAbsolute(userPath)) {
            if (!~userPath.indexOf(this.workPath)) {
                assetPath = _path2.default.join(this.workPath, userPath);
            }
        } else {
            assetPath = _path2.default.resolve(_path2.default.dirname(basePath), userPath);
            if (deep && !_fsExtra2.default.existsSync(assetPath)) {
                const notExtUserPath = userPath.replace(/\.swan$/, '');
                assetPath = (0, _util.findInNodeModules)(basePath, this.workPath, notExtUserPath, 'swan');
            }
        }
        return (0, _util.formatPath)(assetPath);
    }
    getUsingComponents(resource) {
        const jsonPath = resource.replace(/\.swan$/, '.json');
        const mapObj = {};
        const mapObjForPlugin = {};
        return _fsExtra2.default.readJson(jsonPath).then(config => {
            const usingComponents = config.usingComponents || {};
            Object.keys(usingComponents).forEach(key => {
                const componentPath = usingComponents[key];
                const result = (0, _util.getSpecialUsingComponent)(componentPath);
                let customComponentPath;
                let customComponentPathForPlugin;
                if (result.isSpecial && result.specialType !== 'plugin-private') {
                    try {
                        const appConfig = this.appConfig || {};
                        const re = new RegExp('^' + result.specialType + '://');
                        let specialArr = componentPath.replace(re, '').split('/');
                        // TODO 目前不支持分包里配置
                        const realName = appConfig.config[result.appJsonFlag][specialArr[0]]['provider'];
                        specialArr.splice(0, 1, realName);
                        let realPath = specialArr.join('/');
                        if ('plugin' === result.specialType) {
                            customComponentPathForPlugin = `${result.specialType}://${realPath}`;
                        } else {
                            customComponentPath = `${result.specialType}://${realPath}`;
                        }
                    } catch (err) {
                        const errObj = new Error(`${jsonPath}中配置的${key}没有找到对应的${result.specialType}配置，请检查app.json`);
                        customComponentPath = componentPath;
                        (0, _util.errorNext)(errObj, 0, 1);
                    }
                } else if (result.isSpecial && result.specialType === 'plugin-private') {
                    customComponentPathForPlugin = componentPath + '.swan';
                } else {
                    const absolutePath = this.getAssetPath(resource, componentPath + '.swan', true);
                    customComponentPath = this.getPrefixPath(absolutePath);
                }
                if (customComponentPath) {
                    if (customComponentPath in mapObj) {
                        mapObj[customComponentPath].push(key);
                    } else {
                        mapObj[customComponentPath] = [key];
                    }
                }
                if (customComponentPathForPlugin) {
                    if (customComponentPathForPlugin in mapObjForPlugin) {
                        mapObjForPlugin[customComponentPathForPlugin].push(key);
                    } else {
                        mapObjForPlugin[customComponentPathForPlugin] = [key];
                    }
                }
            });
            return [JSON.stringify(mapObj), JSON.stringify(mapObjForPlugin)];
        }).catch(err => {
            return [JSON.stringify(mapObj), JSON.stringify(mapObjForPlugin)];
        });
    }

    setQueryPath(module) {
        module.__queryPath__ = this.getQuery(module);
    }

    apply(compiler) {
        compiler.plugin('this-compilation', compilation => {
            compilation.chunkTemplate = new _customChunkTemplate2.default({
                outputOptions: compilation.outputOptions,
                moduleType: this.moduleType,
                workPath: this.workPath,
                pageJs: this.pagesJs,
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
                compilation.cache = null;
                const swanEntryChunk = chunks.find(chunk => /\bswan-entry\b/.test(chunk.name));
                let moduleSourcePromises = [];
                if (swanEntryChunk) {
                    const swanModules = swanEntryChunk.getModules();
                    const swanEntryModule = swanEntryChunk.entryModule;
                    const customComponentSwanChunk = this.addChunk('allCusomComponents.swan');
                    swanModules.forEach(module => {
                        moduleSourcePromises.push(this.getUsingComponents(module.resource).then(([usingComponents, usingComponentsForPlugin]) => {
                            if (swanEntryModule !== module) {
                                const moduleSource = module.resource;
                                module._usingComponents = usingComponents;
                                module._usingComponentsForPlugin = usingComponentsForPlugin;
                                const moduleJSSource = (0, _util.formatPath)(moduleSource.replace(/\.swan$/, '.js'));
                                if (moduleJSSource in this.customJs) {
                                    if ('plugin' === this.sourceType || 'dynamicLib' === this.sourceType) {
                                        this.setQueryPath(module);
                                    }
                                    customComponentSwanChunk.addModule(module);
                                    customComponentSwanChunk.entryModules.push(module);
                                }
                                if (moduleJSSource in this.pagesJs) {
                                    const chunkSource = _path2.default.relative(this.workPath, moduleSource);
                                    const chunk = this.addChunk(chunkSource);
                                    chunk.addModule(module);
                                    chunk.entryModules.push(module);
                                }
                            }
                        }));
                    });
                }
                Promise.all(moduleSourcePromises).then(() => {
                    callback();
                });
            });

            compilation.plugin('additional-assets', callback => {
                this.setAllCustomComponentCssChunk(compilation, callback);
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
                            const customKey = _path2.default.join(item, 'allCusomComponents.swan.js');
                            const customCss = _path2.default.join(item, 'allImportedCssContent.js');
                            compilation.assets[customKey] = compilation.assets['allCusomComponents.swan.js'];
                            if (compilation.assets['allImportedCssContent.js']) {
                                compilation.assets[customCss] = compilation.assets['allImportedCssContent.js'];
                            }
                        });
                        callback();
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
            delete compilation.assets['swan-entry.js'];
        });

        /**
         * slave也有需要依赖app.json的情况，比如动态库或者插件修改provider字段，swan文件中引用的资源id就得改
         */
        compiler.plugin('after-emit', (compilation, callback) => {
            if ('swan' === this.sourceType) {
                let appJsonPath = _path2.default.join(this.workPath, 'app.json');
                if (Array.isArray(compilation.fileDependencies)) {
                    compilation.fileDependencies.push(appJsonPath);
                } else {
                    compilation.fileDependencies = [appJsonPath];
                }
            }
            callback();
        });
    }
}
exports.default = CommonSwanChunkPlugin;