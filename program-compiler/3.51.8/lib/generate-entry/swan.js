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
 * @file 根据工作目录下的app.json生成webpack的entry
 * @author zhuxin04
 */
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const promisify = require('util.promisify');
const parseJson = require('json-parse-better-errors');
const util = require('../util');
const formatPath = util.formatPath;
const os = require('os');
const NEST_TEMPLATE = require('./swan-template');
const { SPECIAL_COMPONENT_START } = require('../constant');
let specialUsingComponents = SPECIAL_COMPONENT_START;
class GenerateEntry {
    constructor(options) {
        const { workPath, module, entryDirPath = '', swanCorePath, port } = options;
        this.swanCorePath = swanCorePath;
        this.workPath = workPath;
        this.module = module;
        this.entryDirPath = entryDirPath;
        this.port = port;
        // app.json文件中pages字段下对应的js文件
        this.pagesJS = {};
        // 独立分包的pageJs
        this.independentPageJS = {};
        // 自定义组件对应的js
        this.customComponentJS = {};
        // 工作目录下所有的js文件
        this.allJS = {};
        // js文件分类，主包js还是分包js
        this.jsClass = {};
        this.cssAssets = {};
        this.swanAssets = {};
        // page级别页面对应的swan文件
        this.pageSwanAssets = {};
        // page级别的json和自定义组件级别的json
        this.jsonAssets = {};
        // 非page、自定义组件级别的js
        this.utilJS = {};
        this.warnings = [];
        this.errors = [];
        this.cssEntryPath = path.resolve(this.entryDirPath, 'css-entry.js');
        this.cssEntryContent = '';
        this.swanEntryContent = '';
        this.swanEntryPath = path.resolve(this.entryDirPath, 'slave/swan-entry.js');
        // this.swanEntryPath = path.resolve(this.entryDirPath, 'swan-entry.js');
        this.jsEntryContent = '';
        this.jsEntryPath = path.resolve(this.entryDirPath, 'app.js');
        // 是否是app.js拆分模式
        this.isSplitAppJs = true;
        this.appJs = '';
        // 独立分包entry
        this.independentEntry = {};
        // 独立分包，name和路径的映射
        this.entryMapping = {};
        // 独立分包自定义组件js
        this.independentCusJS = {};
        // TODO: appConfig的处理
        // 小程序app.json中的内容
        this.appConfig = {};
        // 需要收集node_modules下自定义组件所依赖的图片资源
        this.nodeModulesArray = [];
    }
    getAppConfig() {
        const workPath = this.workPath;
        const appJsonPath = path.resolve(workPath, 'app.json');
        return fs.readFile(appJsonPath, 'utf-8').then(content => {
            return parseJson(content);
        }).then(conf => {
            util.checkSubPackagesConf(conf);
            return conf;
        }).catch(e => {
            if (e.code === 'ENOENT') {
                e.message = '未找到入口 app.json 文件，或者文件读取失败，请检查后重新编译。';
            } else {
                e.message = 'ERROR in app.json \n' + e.message;
            }
            this.pushError(e);
            const config = { pages: [] };
            return config;
        });
    }
    getAllPackages() {
        return this.getAppConfig().then(appConfig => {
            // 这里别动，动态库需要appConfig的引用
            this.appConfig.config = appConfig;
            const pageSettings = [];
            const mainPages = appConfig.pages || [];
            const mainPackage = {
                root: '',
                isMain: true,
                pages: mainPages
            };
            pageSettings.push(mainPackage);
            const subPackages = appConfig.subPackages || [];
            subPackages.length && (this.isSplitAppJs = false);
            subPackages.forEach(subPackage => {
                const { root = '', pages = [], independent } = subPackage;
                const sub = {
                    isMain: false,
                    root: root,
                    pages: pages,
                    independent: independent
                };
                pages.forEach(item => {
                    const entirePath = formatPath(path.join(root, item));
                    if (mainPages.indexOf(entirePath) !== -1) {
                        const warnMessage = `${entirePath} 不应该出现在分包中!`;
                        this.pushWarning(warnMessage);
                    }
                });
                pageSettings.push(sub);
            });
            return pageSettings;
        });
    }
    getAllJsAssets() {
        return new Promise(resolve => {
            glob(`${this.workPath}/{,!(node_modules)/**/}*.js`, {}, (err, files) => {
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
            assetPath = path.join(this.workPath, rawPath);
        } else {
            assetPath = path.join(path.dirname(basePath), rawPath);
        }
        return assetPath;
    }
    getNodeModulePathPromise(filepath, rawpath) {
        const that = this;
        return fs.pathExists(filepath).then(isExist => {
            if (isExist) {
                return filepath;
            } else {
                const nodeModulesPath = path.resolve(that.workPath, 'node_modules', rawpath);
                const packageJsonPath = path.resolve(nodeModulesPath, 'package.json');
                return fs.readJson(packageJsonPath).then(jsonObj => {
                    that.nodeModulesArray.push(nodeModulesPath);
                    const main = jsonObj.main;
                    const targetPath = path.resolve(nodeModulesPath, main);
                    that.allJS[formatPath(targetPath)] = true;
                    return targetPath.replace(/\.js$/, '.json');
                }).catch(() => {
                    const err = '不能找到 【' + rawpath + '】 所对应的json文件';
                    that.pushError(new Error(err));
                    return packageJsonPath;
                });
            }
        });
    }
    initCustomComponentAssets(jsonPath, independentTag) {
        const workPath = this.workPath;
        const that = this;
        const finishedObj = {};
        function walk(jsonPath) {
            return promisify(fs.readJson)(jsonPath).then(config => {
                that.jsonAssets[jsonPath] = true;
                const promiseArr = [];
                if (config.usingComponents) {
                    const usingComponents = config.usingComponents;
                    Object.keys(usingComponents).forEach(key => {
                        // 排除动态库或插件
                        const item = usingComponents[key];
                        const isSpecialComponents = specialUsingComponents.findIndex(i => item.startsWith(i)) > -1;
                        if (!isSpecialComponents) {
                            const assetJsonPath = that.getAssetPath(jsonPath, item) + '.json';
                            const nodePathPromise = that.getNodeModulePathPromise(assetJsonPath, item);
                            const itemPromise = nodePathPromise.then(actualJsonPath => {
                                const assetSwanPath = formatPath(actualJsonPath.replace(/\.json$/, '.swan'));
                                const assetJsPath = formatPath(actualJsonPath.replace(/\.json$/, '.js'));
                                return Promise.all([fs.pathExists(actualJsonPath), fs.pathExists(assetSwanPath), fs.pathExists(assetJsPath)]).then(args => {
                                    const [isSwanExist, isJsonExist, isJsExist] = args;
                                    if (isJsExist) {
                                        that.customComponentJS[assetJsPath] = true;
                                        if (independentTag) {
                                            if (that.independentCusJS[independentTag]) {
                                                that.independentCusJS[independentTag][assetJsPath] = true;
                                            } else {
                                                that.independentCusJS[independentTag] = {};
                                                that.independentCusJS[independentTag][assetJsPath] = true;
                                            }
                                        }
                                        // Mac下不区分大小写的问题兼容
                                        if (assetJsPath in that.allJS) {
                                            that.customComponentJS[assetJsPath] = true;
                                        } else {
                                            const errorMsg = '自定义组件对应的js文件: ' + util.relativePath(workPath, assetJsPath) + ' 不存在!';
                                            that.pushError(errorMsg);
                                        }
                                    } else {
                                        const errorMsg = '自定义组件对应的js文件: ' + util.relativePath(workPath, assetJsPath) + ' 不存在!';
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
                        }
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
    initAppSource() {
        const appJsPath = path.resolve(this.workPath, 'app.js');
        const appCssPath = path.resolve(this.workPath, 'app.css');
        const jsPromise = fs.pathExists(appJsPath).then(isExist => {
            if (isExist) {
                this.appJs = appJsPath;
            }
        });
        const cssPromise = fs.pathExists(appCssPath).then(isExist => {
            if (isExist) {
                this.cssAssets[appCssPath] = true;
            }
        });
        return Promise.all([jsPromise, cssPromise]);
    }
    initTemplateSource() {
        const { runtime, custom, css } = NEST_TEMPLATE;
        util.TEMPLATE_OBJ.custom = custom;
        util.TEMPLATE_OBJ.runtime = runtime;
        util.TEMPLATE_OBJ.css = css;
    }
    initAssetsSetting() {
        const workPath = this.workPath;
        const allPagesSetting = this.getAllPackages().then(allPackages => {
            const pagesPromiseArr = [];
            allPackages.forEach(packageItem => {
                const { root = '', isMain = false, independent = false } = packageItem;
                if (!isMain && !root) {
                    const errorMsg = 'app.json文件中分包的root字段不能为空!';
                    this.pushError(errorMsg);
                }
                if (Object.prototype.toString.call(root) !== '[object String]') {
                    const errorMsg = 'app.json文件中分包的root字段必须为字符串!';
                    this.pushError(errorMsg);
                } else {
                    packageItem.pages.forEach(pageItem => {
                        if (Object.prototype.toString.call(pageItem) !== '[object String]') {
                            const errorMsg = 'app.json文件中配置的 pages 每一项必须为字符串!';
                            this.pushError(errorMsg);
                        } else {
                            const pagePathPrefix = path.join(workPath, root, pageItem);
                            const jsFilePath = formatPath(pagePathPrefix + '.js');
                            const cssFilePath = formatPath(pagePathPrefix + '.css');
                            const swanFilePath = formatPath(pagePathPrefix + '.swan');
                            const jsonFilePath = formatPath(pagePathPrefix + '.json');
                            const jsPromise = fs.pathExists(jsFilePath).then(isExist => {
                                if (isExist) {
                                    this.pagesJS[jsFilePath] = true;
                                    if (isMain) {
                                        if (!this.jsClass['__main__']) {
                                            this.jsClass['__main__'] = {
                                                pages: {},
                                                isMain,
                                                root
                                            };
                                        }
                                        this.jsClass['__main__']['pages'][jsFilePath] = true;
                                    } else {
                                        if (!this.jsClass[root]) {
                                            this.jsClass[root] = {
                                                pages: {},
                                                isMain,
                                                root,
                                                independent
                                            };
                                        }
                                        this.jsClass[root]['pages'][jsFilePath] = true;
                                    }
                                } else {
                                    const warningMsg = 'app.json文件中配置了不存在的资源:  ' + util.relativePath(workPath, jsFilePath).replace(/\\.js$/, '');
                                    this.pushWarning(warningMsg);
                                }
                            });
                            const cssPromise = fs.pathExists(cssFilePath).then(isExist => isExist && (this.cssAssets[cssFilePath] = true));
                            const swanPromise = fs.pathExists(swanFilePath).then(isExist => {
                                if (isExist) {
                                    this.swanAssets[swanFilePath] = true;
                                    this.pageSwanAssets[swanFilePath] = true;
                                }
                            });
                            const jsonPromise = fs.pathExists(jsonFilePath).then(isExist => {
                                if (isExist) {
                                    this.jsonAssets[jsonFilePath] = true;
                                    const independentTag = independent && root;
                                    return this.initCustomComponentAssets(jsonFilePath, independentTag);
                                }
                            });
                            const customPagePromise = fs.readJson(jsonFilePath).then(config => {
                                if (config.component) {
                                    if (jsFilePath in this.allJS) {
                                        this.customComponentJS[jsFilePath] = true;
                                    } else {
                                        const errMsg = `该自定义组件${jsFilePath}对应的js文件不存在`;
                                        this.pushError(errMsg);
                                    }
                                }
                            }).catch(() => {});
                            pagesPromiseArr.push(jsPromise, cssPromise, swanPromise, jsonPromise, customPagePromise);
                        }
                    });
                }
            });
            return Promise.all(pagesPromiseArr);
        });
        return Promise.all([allPagesSetting, this.initAppSource(), this.initTemplateSource()]).then(() => {
            Object.keys(this.allJS).forEach(key => {
                if (!(key in this.pagesJS || key in this.customComponentJS)) {
                    this.utilJS[key] = true;
                }
            });
        });
    }
    writeEntry(filePath, content) {
        const dirPath = path.dirname(filePath);
        return fs.mkdirp(dirPath).then(() => promisify(fs.writeFile)(filePath, content)).catch(err => {
            if (err && err.code === 'EINVAL') {
                const errMsg = `找不到存放在系统临时目录的编译入口文件，请确认系统临时目录 ${os.tmpdir()} 合法。` + 'windows如何修改临时文件？请参考：https://jingyan.baidu.com/article/09ea3ede48e525c0aede3903.html!';
                this.pushError(errMsg);
            }
        });
    }
    getEntry() {
        const allJsSetting = new Promise(re => {
            this.getAllJsAssets().then(files => {
                files.forEach(file => {
                    this.allJS[formatPath(file)] = true;
                });
                re();
            }).catch(() => re);
        });
        return allJsSetting.then(() => {
            return this.initAssetsSetting().then(() => {
                const cssEntryContent = [];
                const swanEntryContent = [];
                const jsEntryContent = [];
                const {
                    cssAssets,
                    swanAssets,
                    utilJS,
                    customComponentJS,
                    jsClass,
                    independentEntry,
                    independentCusJS,
                    module,
                    port
                } = this;
                Object.keys(cssAssets).forEach(key => {
                    cssEntryContent.push(`require('${formatPath(key)}');`);
                });
                if (!port) {
                    Object.keys(swanAssets).forEach(key => {
                        swanEntryContent.push(`require('${formatPath(key)}');`);
                    });
                }
                // amd模式下，需要将util.js的js文件写入entry文件中
                if (module === 'amd') {
                    Object.keys(utilJS).forEach(key => {
                        jsEntryContent.push(`require('${formatPath(key)}');`);
                    });
                }
                Object.keys(customComponentJS).forEach(key => {
                    jsEntryContent.push(`require('${formatPath(key)}');`);
                });
                Object.keys(jsClass).forEach(entryKey => {
                    const packageItem = jsClass[entryKey];
                    const { pages, independent, root } = packageItem;
                    Object.keys(pages).forEach(key => {
                        const inputStr = `require('${formatPath(key)}');`;
                        if (independent) {
                            const cusJs = independentCusJS[root] || {};
                            if (independentEntry[root]) {
                                independentEntry[root].push(inputStr);
                            } else {
                                independentEntry[root] = [inputStr];
                            }
                            Object.keys(cusJs).forEach(key => {
                                const cusItem = `require('${formatPath(key)}');`;
                                independentEntry[root].push(cusItem);
                            });
                            // amd模式下，排除app.js的utilJs资源文件
                            if (module === 'amd') {
                                Object.keys(utilJS).forEach(key => {
                                    if (formatPath(key) !== formatPath(path.resolve(this.workPath, 'app.js'))) {
                                        independentEntry[root].push(`require('${formatPath(key)}');`);
                                    }
                                });
                            }
                        } else {
                            jsEntryContent.push(inputStr);
                        }
                    });
                });
                if (this.appJs) {
                    jsEntryContent.push(`require('${formatPath(this.appJs)}');`);
                }
                this.cssEntryContent = cssEntryContent.join('\n');
                this.swanEntryContent = swanEntryContent.join('\n');
                this.jsEntryContent = jsEntryContent.join('\n');
            }).then(() => {
                const swanPromise = this.port ? fs.ensureFile(this.swanEntryPath) : this.writeEntry(this.swanEntryPath, this.swanEntryContent);
                const cssPromise = this.writeEntry(this.cssEntryPath, this.cssEntryContent);
                const jsPromise = this.writeEntry(this.jsEntryPath, this.jsEntryContent);
                const independentPromises = Object.keys(this.independentEntry).map(entry => {
                    const entryBaseKey = entry + '/' + 'app';
                    const entryPath = path.resolve(this.entryDirPath, entryBaseKey + '.js');
                    const entryContent = this.independentEntry[entry].join('\n');
                    this.entryMapping[entryBaseKey] = entryPath;
                    return this.writeEntry(entryPath, entryContent);
                });
                return Promise.all([cssPromise, swanPromise, jsPromise].concat(independentPromises));
            }).then(() => {
                return Object.assign({
                    'css-entry': this.cssEntryPath,
                    'swan-entry': this.swanEntryPath,
                    'app': this.jsEntryPath
                }, this.entryMapping);
            });
        });
    }
}
exports.default = GenerateEntry;