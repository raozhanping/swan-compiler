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
 * @file 根据动态库目录下的dynamicLib.json生成webpack的entry
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
        const { workPath, module, entryDirPath, dynamicRoot } = options;
        this.workPath = workPath;
        this.dynamicNameQuote = {};
        this.dynamicWorkPath = dynamicRoot;
        this.module = module;
        this.entryDirPath = entryDirPath;
        // 自定义组件对应的js
        this.customComponentJS = {};
        // 工作目录下所有的js文件
        this.allJS = {};
        this.interfaceJsAsset = {};
        this.swanAssets = {};
        // page级别的json和自定义组件级别的json
        this.jsonAssets = {};
        // 非page、自定义组件级别的js
        this.utilJS = {};
        // 动态库暴露出去的组件
        this.publicComponents = [];
        this.warnings = [];
        this.errors = [];
        this.cssEntryPath = path.resolve(this.entryDirPath, 'css-entry.js');
        this.cssEntryContent = '';
        this.swanEntryContent = '';
        this.swanEntryPath = path.resolve(this.entryDirPath, 'swan-entry.js');
        this.jsEntryContent = '';
        this.jsEntryPath = path.resolve(this.entryDirPath, 'app.js');
    }
    getDynamicLibConfig() {
        const dynamicLibJsonPath = path.resolve(this.dynamicWorkPath, 'dynamicLib.json');
        return fs.readJson(dynamicLibJsonPath).then(config => config).catch(() => {
            const errorMsg = `${util.relativePath(this.dynamicWorkPath, dynamicLibJsonPath)} 文件不存在或语法错误!`;
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
                const nodeModulesPath = path.resolve(this.dynamicWorkPath, 'node_modules', rawpath);
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
            glob(`${this.dynamicWorkPath}/{,!(node_modules)/**/}*.js`, {}, (err, files) => {
                if (err && err.code === 'EACCES') {
                    const errMsg = `请确认 ${err.path} 有可读、可执行权限!否则会影响程序的正确运行!`;
                    this.pushError(errMsg);
                }
                resolve(files || []);
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
            assetPath = path.join(this.dynamicWorkPath, rawPath);
        } else {
            assetPath = path.join(path.dirname(basePath), rawPath);
        }
        return assetPath;
    }
    initCustomComponentAssets(jsonPath) {
        const workPath = this.dynamicWorkPath;
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
                        const assetJsonPath = that.getAssetPath(jsonPath, item) + '.json';
                        const itemPromise = that.getNodeModulePathPromise(assetJsonPath, item).then(actualJsonPath => {
                            const assetSwanPath = formatPath(actualJsonPath.replace(/\.json$/, '.swan'));
                            const assetJsPath = formatPath(actualJsonPath.replace(/\.json$/, '.js'));
                            return Promise.all([fs.pathExists(actualJsonPath), fs.pathExists(assetSwanPath), fs.pathExists(assetJsPath)]).then(args => {
                                const [isSwanExist, isJsonExist, isJsExist] = args;
                                if (isJsExist) {
                                    that.customComponentJS[assetJsPath] = true;
                                } else {
                                    const errorMsg = '自定义组件对应的js文件: ' + util.relativePath(workPath, assetJsPath) + '不存在!';
                                    that.pushError(errorMsg);
                                }
                                if (isSwanExist) {
                                    that.swanAssets[assetSwanPath] = true;
                                } else {
                                    const errorMsg = '自定义组件对应的swan文件: ' + util.relativePath(workPath, assetSwanPath) + '不存在!';
                                    that.pushError(errorMsg);
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
        const { runtime, dynamicLibCustom, dynamicLibCss } = NEST_TEMPLATE;
        util.TEMPLATE_OBJ.dynamicLibCustom = dynamicLibCustom;
        util.TEMPLATE_OBJ.runtime = runtime;
        util.TEMPLATE_OBJ.dynamicLibCss = dynamicLibCss;
    }
    initAssetsSetting() {
        const allDynamicLibSetting = this.getDynamicLibConfig().then(dynamicLibConfig => {
            this.dynamicNameQuote.name = dynamicLibConfig.name;
            let assetsPromiseArr = [];
            Object.keys(dynamicLibConfig.publicComponents || {}).forEach(component => {
                let publicComponents = dynamicLibConfig.publicComponents[component];
                this.publicComponents.push({ name: component, path: publicComponents });
                const pagePathPrefix = path.join(this.dynamicWorkPath, publicComponents);
                const jsFilePath = formatPath(pagePathPrefix + '.js');
                const swanFilePath = formatPath(pagePathPrefix + '.swan');
                const jsonFilePath = formatPath(pagePathPrefix + '.json');
                const swanPromise = fs.pathExists(swanFilePath).then(isExist => isExist && (this.swanAssets[swanFilePath] = true));
                const customPagePromise = fs.pathExists(jsFilePath).then(isExist => isExist && (this.customComponentJS[jsFilePath] = true));
                const jsonPromise = fs.pathExists(jsonFilePath).then(isExist => {
                    if (isExist) {
                        this.jsonAssets[jsonFilePath] = true;
                        return this.initCustomComponentAssets(jsonFilePath);
                    }
                });
                assetsPromiseArr.push(swanPromise, jsonPromise, customPagePromise);
            });
            if (dynamicLibConfig.main) {
                const interfaceJspath = path.join(this.dynamicWorkPath, dynamicLibConfig.main);
                assetsPromiseArr.push(fs.pathExists(interfaceJspath).then(isExist => {
                    if (isExist) {
                        this.interfaceJsAsset[interfaceJspath] = true;
                    } else {
                        const warningMsg = 'dynamicLib.json文件中配置了不存在的资源:  ' + dynamicLibConfig.main;
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
        return Promise.all([allDynamicLibSetting, allJsSetting, this.initTemplateSource()]).then(() => {
            Object.keys(this.allJS).forEach(key => {
                if (!(key in this.customComponentJS)) {
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
        return this.initAssetsSetting().then(() => {
            const swanEntryContent = [];
            const jsEntryContent = [];
            const { swanAssets, utilJS, customComponentJS, interfaceJsAsset } = this;
            Object.keys(swanAssets).forEach(key => {
                swanEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(utilJS).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(customComponentJS).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            Object.keys(interfaceJsAsset).forEach(key => {
                jsEntryContent.push(`require('${formatPath(key)}');`);
            });
            this.swanEntryContent = swanEntryContent.join('\n');
            this.jsEntryContent = jsEntryContent.join('\n');
        }).then(() => {
            const swanPromise = this.writeEntry(this.swanEntryPath, this.swanEntryContent);
            const jsPromise = this.writeEntry(this.jsEntryPath, this.jsEntryContent);
            return Promise.all([swanPromise, jsPromise]);
        }).then(() => {
            return {
                'swan-entry': this.swanEntryPath,
                'app': this.jsEntryPath
            };
        });
    }
}
exports.default = GenerateEntry;