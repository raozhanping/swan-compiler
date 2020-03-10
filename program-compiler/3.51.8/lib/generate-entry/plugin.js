'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 根据插件目录下的plugin.json生成webpack的entry
 * @author jiamiao
 */
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const promisify = require('util.promisify');
const util = require('../util');
const formatPath = util.formatPath;
const NEST_TEMPLATE = require('./swan-template');
class GenerateEntry {
    constructor(options) {
        const { workPath, module, entryDirPath, pluginRoot } = options;
        this.workPath = workPath;
        this.pluginWorkPath = pluginRoot;
        this.module = module;
        this.entryDirPath = entryDirPath;
        // 自定义组件对应的js
        this.customComponentJS = {};
        // page级别的js
        this.pagesJS = {};
        // 工作目录下所有的js文件
        this.allJS = {};
        // 插件目录下所有swan文件
        this.allSwan = {};
        // 插件目录下所有未publish的自定义组件资源
        this.extraComponent = {};
        this.interfaceJsAsset = {};
        this.swanAssets = {};
        this.cssAssets = {};
        // page级别的json和自定义组件级别的json
        this.jsonAssets = {};
        // 非page、自定义组件级别的js
        this.utilJS = {};
        this.publicComponents = [];
        this.publicPages = [];
        this.warnings = [];
        this.errors = [];
        this.cssEntryContent = '';
        this.cssEntryPath = path.resolve(this.entryDirPath, 'css-entry.js');
        this.swanEntryContent = '';
        this.swanEntryPath = path.resolve(this.entryDirPath, 'swan-entry.js');
        this.jsEntryContent = '';
        this.jsEntryPath = path.resolve(this.entryDirPath, 'app.js');
        // 收集插件所有的swan文件的相对地址打进产出的plugin.json中，方便使用插件的时候取出写入app.json的pageLis中
        this.pageList = [];
    }
    getPluginConfig() {
        const pluginJsonPath = path.resolve(this.pluginWorkPath, 'plugin.json');
        return fs.readJson(pluginJsonPath).then(config => config).catch(() => {
            const errorMsg = `${util.relativePath(this.pluginWorkPath, pluginJsonPath)} 文件不存在或语法错误!`;
            this.pushError(errorMsg);
            return {};
        });
    }
    getNodeModulePathPromise(filepath, rawpath) {
        const that = this;
        return fs.pathExists(filepath).then(isExist => {
            if (isExist) {
                return filepath;
            } else {
                const nodeModulesPath = path.resolve(this.pluginWorkPath, 'node_modules', rawpath);
                const packageJsonPath = path.resolve(nodeModulesPath, 'package.json');
                return fs.readJson(packageJsonPath).then(jsonObj => {
                    const main = jsonObj.main;
                    return path.resolve(nodeModulesPath, main).replace(/\.js$/, '.json');
                }).catch(e => {
                    that.pushError(e);
                    return packageJsonPath;
                });
            }
        });
    }
    getAllJsAssets() {
        return new Promise(resolve => {
            glob(`${this.pluginWorkPath}/{,!(node_modules)/**/}*.js`, {}, (err, files) => {
                resolve(files);
            });
        });
    }
    getAllSwanAssets() {
        return new Promise(resolve => {
            glob(`${this.pluginWorkPath}/{,!(node_modules)/**/}*.swan`, {}, (err, files) => {
                resolve(files);
            });
        });
    }
    pushError(err) {
        this.errors.push(err);
    }
    pushWarning(warning) {
        this.warnings.push(warning);
    }
    getAssetPath(basePath, rawPath = '') {
        let assetPath = '';
        if (path.isAbsolute(rawPath)) {
            assetPath = path.join(this.pluginWorkPath, rawPath);
        } else {
            assetPath = path.join(path.dirname(basePath), rawPath);
        }
        return assetPath;
    }
    // 插件的自定义组件都是page化，所以也要收集css资源
    initCustomComponentAssets(jsonPath, publicComponents) {
        const workPath = this.pluginWorkPath;
        const that = this;
        const finishedObj = {};
        function walk(jsonPath) {
            return promisify(fs.readJson)(jsonPath).then(config => {
                that.jsonAssets[jsonPath] = true;
                const promiseArr = [];
                if (config.usingComponents) {
                    const usingComponents = config.usingComponents;
                    Object.keys(usingComponents).forEach(key => {
                        const item = usingComponents[key];
                        if (!item.startsWith('plugin-private://')) {
                            const errorMsg = `当前开发插件中 ${jsonPath} 配置的 ${item} 不合法，请尝试替换成 plugin-private://${global.APPID}${item}`;
                            that.pushError(errorMsg);
                        }
                        let usingComponetpath = item.replace(/^plugin-private:\/\/[a-zA-Z\d]+/, '');
                        const assetJsonPath = that.getAssetPath(jsonPath, usingComponetpath) + '.json';
                        const itemPromise = that.getNodeModulePathPromise(assetJsonPath, item).then(actualJsonPath => {
                            const assetSwanPath = formatPath(actualJsonPath.replace(/\.json$/, '.swan'));
                            const assetJsPath = formatPath(actualJsonPath.replace(/\.json$/, '.js'));
                            const assetCssPath = formatPath(actualJsonPath.replace(/\.json$/, '.css'));
                            return Promise.all([fs.pathExists(actualJsonPath), fs.pathExists(assetSwanPath), fs.pathExists(assetJsPath), fs.pathExists(assetCssPath)]).then(args => {
                                const [isSwanExist, isJsonExist, isJsExist, isCssExist] = args;
                                if (isJsExist) {
                                    that.customComponentJS[assetJsPath] = true;
                                    // 插件中的自定义组件都是page化
                                    that.pagesJS[assetJsPath] = true;
                                } else {
                                    const errorMsg = '自定义组件对应的js文件: ' + util.relativePath(workPath, assetJsPath) + '不存在!';
                                    that.pushError(errorMsg);
                                }
                                if (isSwanExist) {
                                    that.swanAssets[assetSwanPath] = true;
                                    if (!publicComponents.includes(assetSwanPath)) {
                                        let relativeSwanPath = path.relative(that.pluginWorkPath, assetSwanPath).replace(/.swan$/, '');
                                        that.extraComponent[relativeSwanPath] = true;
                                    }
                                } else {
                                    const errorMsg = '自定义组件对应的swan文件: ' + util.relativePath(workPath, assetSwanPath) + '不存在!';
                                    that.pushError(errorMsg);
                                }
                                if (isCssExist) {
                                    that.cssAssets[assetCssPath] = true;
                                }
                                if (isJsonExist) {
                                    if (!(actualJsonPath in finishedObj)) {
                                        finishedObj[actualJsonPath] = true;
                                        return walk(actualJsonPath);
                                    } else {
                                        return assetJsonPath;
                                    }
                                } else {
                                    const errorMsg = '自定义组件对应的json文件: ' + util.relativePath(workPath, actualJsonPath) + '不存在!';
                                    that.pushError(errorMsg);
                                }
                            });
                        });
                        promiseArr.push(itemPromise);
                    });
                    return Promise.all(promiseArr);
                } else {
                    return jsonPath;
                }
            }).catch(() => {
                const errorMsg = `${util.relativePath(workPath, jsonPath)} 文件语法错误!`;
                that.pushError(errorMsg);
            });
        }
        return walk(jsonPath);
    }
    initTemplateSource() {
        const { runtime, pluginCss, pluginSwan } = NEST_TEMPLATE;
        util.TEMPLATE_OBJ.pluginSwan = pluginSwan;
        util.TEMPLATE_OBJ.runtime = runtime;
        util.TEMPLATE_OBJ.pluginCss = pluginCss;
    }
    initAssetsSetting() {
        const workPath = this.pluginWorkPath;
        const allpluginSetting = Promise.all([this.getPluginConfig(), this.getAllSwanAssets()]).then(([pluginConfig, allSwan]) => {
            this.allSwan = allSwan;
            let assetsPromiseArr = [];
            let publicComponentsConfig = pluginConfig.publicComponents || {};
            let publicComponentsList = Object.keys(publicComponentsConfig).map(component => {
                return path.join(this.pluginWorkPath, publicComponentsConfig[component]) + '.swan';
            });
            Object.keys(pluginConfig.pages || {}).forEach(page => {
                let publicPage = pluginConfig.pages[page];
                this.publicPages.push({ name: page, path: publicPage });
                const pagePathPrefix = path.join(this.pluginWorkPath, publicPage);
                const jsFilePath = formatPath(pagePathPrefix + '.js');
                const cssFilePath = formatPath(pagePathPrefix + '.css');
                const swanFilePath = formatPath(pagePathPrefix + '.swan');
                const jsonFilePath = formatPath(pagePathPrefix + '.json');
                const jsPromise = fs.pathExists(jsFilePath).then(isExist => {
                    if (isExist) {
                        this.pagesJS[jsFilePath] = true;
                    } else {
                        const warningMsg = '不存在的资源:  ' + util.relativePath(workPath, jsFilePath).replace(/\\.js$/, '');
                        this.pushWarning(warningMsg);
                    }
                });
                const cssPromise = fs.pathExists(cssFilePath).then(isExist => isExist && (this.cssAssets[cssFilePath] = true));
                const swanPromise = fs.pathExists(swanFilePath).then(isExist => isExist && (this.swanAssets[swanFilePath] = true));
                const jsonPromise = fs.pathExists(jsonFilePath).then(isExist => {
                    if (isExist) {
                        this.jsonAssets[jsonFilePath] = true;
                        return this.initCustomComponentAssets(jsonFilePath, publicComponentsList);
                    }
                });
                assetsPromiseArr.push(jsPromise, cssPromise, swanPromise, jsonPromise);
            });
            Object.keys(pluginConfig.publicComponents || []).forEach(component => {
                let publicComponents = pluginConfig.publicComponents[component];
                this.publicComponents.push({ name: component, path: publicComponents });
                const pagePathPrefix = path.join(this.pluginWorkPath, publicComponents);
                const jsFilePath = formatPath(pagePathPrefix + '.js');
                const cssFilePath = formatPath(pagePathPrefix + '.css');
                const swanFilePath = formatPath(pagePathPrefix + '.swan');
                const jsonFilePath = formatPath(pagePathPrefix + '.json');
                const swanPromise = fs.pathExists(swanFilePath).then(isExist => isExist && (this.swanAssets[swanFilePath] = true));
                // 插件中的自定义组件都是page化
                const cssPromise = fs.pathExists(cssFilePath).then(isExist => isExist && (this.cssAssets[cssFilePath] = true));
                const customPagePromise = fs.pathExists(jsFilePath).then(isExist => {
                    if (isExist) {
                        this.customComponentJS[jsFilePath] = true;
                        this.pagesJS[jsFilePath] = true;
                    } else {
                        const warningMsg = '不存在的资源:  ' + util.relativePath(workPath, jsFilePath).replace(/\\.js$/, '');
                        this.pushWarning(warningMsg);
                    }
                });
                const jsonPromise = fs.pathExists(jsonFilePath).then(isExist => {
                    if (isExist) {
                        this.jsonAssets[jsonFilePath] = true;
                        return this.initCustomComponentAssets(jsonFilePath, publicComponentsList);
                    }
                });
                assetsPromiseArr.push(swanPromise, cssPromise, jsonPromise, customPagePromise);
            });
            if (pluginConfig.main) {
                const interfaceJspath = path.join(this.pluginWorkPath, pluginConfig.main);
                assetsPromiseArr.push(fs.pathExists(interfaceJspath).then(isExist => {
                    if (isExist) {
                        this.interfaceJsAsset[interfaceJspath] = true;
                    } else {
                        const warningMsg = 'plugin.json文件中配置了不存在的资源:  ' + pluginConfig.main;
                        this.pushWarning(warningMsg);
                    }
                }));
            }
            return Promise.all(assetsPromiseArr);
        });
        const allJsSetting = new Promise(re => {
            if (this.module === 'cmd') {
                re();
            } else {
                this.getAllJsAssets().then(files => {
                    files.forEach(file => {
                        this.allJS[formatPath(file)] = true;
                    });
                    re();
                });
            }
        });
        return Promise.all([allpluginSetting, allJsSetting, this.initTemplateSource()]).then(() => {
            Object.keys(this.allJS).forEach(key => {
                if (!(key in this.pagesJS || key in this.customComponentJS || key in this.interfaceJsAsset)) {
                    this.utilJS[key] = true;
                }
            });
        });
    }
    writeEntry(filePath, content) {
        const entryDirPath = this.entryDirPath;
        return fs.mkdirp(entryDirPath).then(() => promisify(fs.writeFile)(filePath, content));
    }
    getEntry() {
        // 每次更新入口，把接口数组清空，不然之前的接口数据会一直在。不能直接赋值，要不plugin里的引用就丢失了
        Object.keys(this.interfaceJsAsset).forEach(i => {
            delete this.interfaceJsAsset[i];
        });
        return this.initAssetsSetting().then(() => {
            // 私有未publish的自定义组件资源也需要收集
            // 因为要看allSwan的资源在之前有没有收集，所以不能并行，有先后顺序
            let collectPrivateCustomComponentsAsset = [];
            this.allSwan.forEach(swan => {
                if (!this.swanAssets[swan]) {
                    const jsFilePath = swan.replace(/.swan$/, '.js');
                    const cssFilePath = swan.replace(/.swan$/, '.css');
                    const jsonFilePath = swan.replace(/.swan$/, '.json');
                    let checkIsComponentPromise = fs.readJson(jsonFilePath).then(config => {
                        if (config.component) {
                            return fs.pathExists(jsFilePath).then(isExist => {
                                if (isExist) {
                                    let relativeSwanPath = path.relative(this.pluginWorkPath, swan).replace(/.swan$/, '');
                                    this.extraComponent[relativeSwanPath] = true;
                                    this.pagesJS[jsFilePath] = true;
                                    this.customComponentJS[jsFilePath] = true;
                                } else {
                                    const warningMsg = '不存在的资源:  ' + util.relativePath(this.pluginWorkPath, jsFilePath).replace(/\\.js$/, '');
                                    this.pushWarning(warningMsg);
                                }
                            });
                        }
                        return fs.pathExists(jsFilePath).then(isExist => {
                            if (isExist) {
                                this.pagesJS[jsFilePath] = true;
                            }
                        });
                    }).catch(err => {
                        return fs.pathExists(jsFilePath).then(isExist => {
                            if (isExist) {
                                this.pagesJS[jsFilePath] = true;
                            }
                        });
                    });
                    const cssPromise = fs.pathExists(cssFilePath).then(isExist => isExist && (this.cssAssets[cssFilePath] = true));
                    const swanPromise = fs.pathExists(swan).then(isExist => isExist && (this.swanAssets[swan] = true));
                    const jsonPromise = fs.pathExists(jsonFilePath).then(isExist => {
                        if (isExist) {
                            this.jsonAssets[jsonFilePath] = true;
                        }
                    });
                    collectPrivateCustomComponentsAsset.push(checkIsComponentPromise, cssPromise, swanPromise, jsonPromise);
                }
            });
            return Promise.all(collectPrivateCustomComponentsAsset);
        }).then(() => {
            const cssEntryContent = [];
            const swanEntryContent = [];
            const jsEntryContent = [];
            const { swanAssets, utilJS, customComponentJS, interfaceJsAsset, pagesJS, cssAssets } = this;
            Object.keys(cssAssets).forEach(key => {
                cssEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(swanAssets).forEach(key => {
                const rPath = key.replace(/\.swan$/, '');
                this.pageList.push(formatPath(path.relative(this.pluginWorkPath, rPath)));
                swanEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(utilJS).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(pagesJS).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(interfaceJsAsset).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            const cssEntry = cssEntryContent.join('\n');
            const swanEntry = swanEntryContent.join('\n');
            const jsEntry = jsEntryContent.join('\n');
            const cssPromise = this.writeEntry(this.cssEntryPath, cssEntry);
            const swanPromise = this.writeEntry(this.swanEntryPath, swanEntry);
            const jsPromise = this.writeEntry(this.jsEntryPath, jsEntry);
            return Promise.all([swanPromise, jsPromise, cssPromise]);
        }).then(() => {
            return {
                'css-entry': this.cssEntryPath,
                'swan-entry': this.swanEntryPath,
                'app': this.jsEntryPath
            };
        });
    }
}
exports.default = GenerateEntry;