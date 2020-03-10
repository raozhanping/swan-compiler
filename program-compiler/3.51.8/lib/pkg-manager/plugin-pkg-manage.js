'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _pkgManageBase = require('./pkg-manage-base');

var _pkgManageBase2 = _interopRequireDefault(_pkgManageBase);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _crypto = require('crypto');

var _os = require('os');

var _util = require('../util');

var _constant = require('../constant');

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _semver = require('semver');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 和webpack编译一起并行的插件资源管理
 * @author jiamiao
 */
const {
    CHECK_PLUGINS
} = _constant.SERVER_INFO;
let {
    OUTPUT,
    SWAN_CLI_PROCESS,
    PLUGIN_DIRECTORY,
    PLUGIN_ROOT
} = global.SWAN_CLI_ARGV;
const outputPath = _path2.default.isAbsolute(OUTPUT) ? OUTPUT : _path2.default.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);

class PluginPkgManage extends _pkgManageBase2.default {
    constructor(option = {}) {
        option.sourceType = 'plugin';
        super(option);
        this.fs = option.fs || new _memoryFs2.default();
        this.lastPluginConfig = [];
        this.pluginPages = [];
        this.lastAppid = '';
        this.lastBduss = '';
        this.appId = option.appId;
        this.bduss = option.bduss;
        this.usedPluginInfoFromServer = {};
        this.errors = [];
    }

    getPluginPages() {
        return this.pluginPages.map(v => v);
    }

    getUsedPluginInfoFromServer() {
        return this.usedPluginInfoFromServer;
    }

    getErrors() {
        return this.errors;
    }

    // 返回下载和拷贝资源的promise
    downLoadAndCopy(downloadUrl, pkgInfo, pkgDir) {
        const {
            provider,
            version,
            pkgName = 'main'
        } = pkgInfo;
        return this.downLoadPkg(downloadUrl, provider)
        // 下载先解压至正确目录同级的一个临时目录下，完成解压后move改名，确保不会出现解压失败，一直都用老的错误的包的问题
        .then(downloadTmpPath => {
            const tmpPluginAssetDir = _path2.default.resolve(PLUGIN_DIRECTORY, 'tempPluginAssets');
            const unzipTmpPath = _path2.default.resolve(tmpPluginAssetDir, `${provider}${version}-${Date.now()}`);
            return _fsExtra2.default.ensureDir(tmpPluginAssetDir).then(() => {
                return this.unzipPromise(downloadTmpPath, unzipTmpPath);
            });
        }).then(tmpTarget => {
            return _fsExtra2.default.move(tmpTarget, pkgDir, { overwrite: true });
        }).then(() => {
            return this.copyPkgToOutput(pkgDir, provider, pkgName);
        }).catch(err => {
            this.errors.push(new Error('插件下载解压失败！'));
        });
    }

    // 返回包括检测、下载和拷贝的promise
    getDownLoadOrCopyArr(pkgInfo) {
        let downLoadAndCopyList = [];
        pkgInfo.forEach(pkg => {
            let pkgDir = _path2.default.resolve(PLUGIN_DIRECTORY, pkg.provider, pkg.version);
            let downloadUrl = pkg.downloadUrl;
            downLoadAndCopyList.push(_fsExtra2.default.readdir(pkgDir).then(dir => {
                // 得区分是否是主分包
                return this.copyPkgToOutput(pkgDir, pkg.provider, 'main');
            }).catch(err => {
                return this.downLoadAndCopy(downloadUrl, pkg, pkgDir);
            }));
        });
        return downLoadAndCopyList;
    }

    collectPluginInfo(appConfig) {
        let collectArr = [];
        let mainPlugin = appConfig.plugins;
        if (mainPlugin) {
            this.getCurrentPluginConfig(collectArr, mainPlugin, 'main');
        }
        return collectArr;
    }

    getCurrentPluginConfig(collectArr, pluginConfig, pkgName) {
        try {
            Object.keys(pluginConfig).forEach(plugin => {
                if (!PLUGIN_ROOT && pluginConfig[plugin].version === 'dev') {
                    this.errors.push(new Error('目前处于小程序模式，' + `plugins.${plugin}.version不能为 dev ，请切换至插件模式开发插件！`));
                }
                if (PLUGIN_ROOT && pluginConfig[plugin].version === 'dev' && pluginConfig[plugin].provider !== this.appId) {
                    this.errors.push(new Error(`plugins.${plugin}.provider 字段需为 ${this.appId}`));
                }
                if (PLUGIN_ROOT && pluginConfig[plugin].version !== 'dev' && pluginConfig[plugin].provider === this.appId) {
                    this.errors.push(new Error(`当前正在开发插件，plugins.${plugin}.version 字段应为 dev`));
                }
                if (pluginConfig[plugin].provider && !isNaN(pluginConfig[plugin].provider) && pluginConfig[plugin].version !== 'dev') {
                    collectArr.push({
                        pkgName,
                        assetName: pluginConfig[plugin].provider,
                        version: pluginConfig[plugin].version
                    });
                } else if (!pluginConfig[plugin].provider || isNaN(pluginConfig[plugin].provider)) {
                    this.errors.push(new Error(`app.json中plugins.${plugin}.provider 字段需为 字符串类型的数字`));
                }
            });
        } catch (err) {
            this.errors.push(new Error('app.json中配置的plugins不符合规范！'));
        }
    }

    removePluginForOutput(currentPluginConfig) {
        try {
            this.lastPluginConfig.forEach(plugin => {
                const beRemovedPath = 'main' === plugin.pkgName ? _path2.default.resolve(outputPath, _constant.PLUGIN_PATH_IN_OUTPUT, plugin.assetName) : _path2.default.resolve(outputPath, plugin.pkgName, _constant.PLUGIN_PATH_IN_OUTPUT, plugin.assetName);
                if (!currentPluginConfig.length) {
                    this.fs.rmdirSync(beRemovedPath);
                } else {
                    for (let i = 0; i < currentPluginConfig.length; i++) {
                        if (plugin.pkgName === currentPluginConfig[i].pkgName && plugin.assetName === currentPluginConfig[i].assetName && plugin.version === currentPluginConfig[i].version) {
                            break;
                        } else if (i === currentPluginConfig.length - 1) {
                            this.fs.rmdirSync(_path2.default.resolve(beRemovedPath));
                        }
                    }
                }
            });
            return true;
        } catch (err) {
            // 名称可能是随便写的，memoryFs里不会有目录，删除就会报错
            return false;
        }
    }

    removeAllPluginForOutput() {
        try {
            this.lastPluginConfig.forEach(plugin => {
                const beRemovedPath = 'main' === plugin.pkgName ? _path2.default.resolve(outputPath, _constant.PLUGIN_PATH_IN_OUTPUT, plugin.assetName) : _path2.default.resolve(outputPath, plugin.pkgName, _constant.PLUGIN_PATH_IN_OUTPUT, plugin.assetName);
                this.fs.rmdirSync(_path2.default.resolve(beRemovedPath));
            });
            return true;
        } catch (err) {
            // 名称可能是随便写的，memoryFs里不会有目录，删除就会报错
            return false;
        }
    }

    getVersionNotExistPlugins(usedPlugins, pluginsInfoFromServer) {
        return usedPlugins.reduce((prev, curr) => {
            if (pluginsInfoFromServer.every(plugin => plugin.pluginId + '' !== curr)) {
                prev.push(curr);
            }
            return prev;
        }, []);
    }

    checkPluginsAuthority(plugsInfo) {
        let body = {
            appId: this.appId,
            plugins: plugsInfo
        };
        let options = {
            method: 'POST',
            uri: `${_constant.SERVER_INFO.CHECK_PLUGINS_HOST}${CHECK_PLUGINS}`,
            body,
            headers: {
                cookie: this.bduss
            },
            json: true
        };
        const pluginList = plugsInfo.map(plugin => plugin.pluginId);
        // 超时逻辑 ？
        return (0, _requestPromise2.default)(options).then(result => {
            if (0 === result.errno) {
                this.usedPluginInfoFromServer = result;
                if (result.data && result.data.noAuthPlugins && result.data.noAuthPlugins.length > 0) {
                    let noAuthPlugins = result.data.noAuthPlugins.map(i => i.pluginId).join(',');
                    this.errors.push(new Error(`插件 ${noAuthPlugins} 无使用权限，请去申请`));
                }
                let authPlugins = result.data.authPlugins || [];
                let versionNotExist = this.getVersionNotExistPlugins(pluginList, authPlugins.concat(result.data.noAuthPlugins || []));
                if (versionNotExist.length) {
                    this.errors.push(new Error(`插件 ${versionNotExist.join(',')} 版本不存在`));
                }
                let info = authPlugins.reduce((prev, curr) => {
                    let userVersion = plugsInfo.find(plugin => curr.pluginId + '' === plugin.pluginId).userVersion || 0;
                    if ((0, _semver.gt)((0, _semver.coerce)(curr['latestUserVersion']), (0, _semver.coerce)(userVersion))) {
                        (0, _util.log)(`插件 ${curr.name} 有更新，当前使用的版本为 ${userVersion}` + `，最新版本为 ${curr['latestUserVersion']}`, 'warn');
                    }
                    prev.push({
                        provider: curr['pluginId'] + '',
                        version: userVersion,
                        downloadUrl: curr['packageAddr']
                    });
                    return prev;
                }, []);
                return info;
            } else {
                let errMsg = new Error(result.errMsg);
                this.errors.push(errMsg);
                return errMsg;
            }
        }).catch(err => {
            this.errors.push(err);
            return err;
        });
    }

    getNeedBeCheckedPlugin(currentPluginConfig) {
        let needBeCheckedPlugin = [];
        if (this.lastPluginConfig.length === 0) {
            return currentPluginConfig;
        }
        currentPluginConfig.forEach(plugin => {
            for (let i = 0; i < this.lastPluginConfig.length; i++) {
                if (this.lastPluginConfig[i].pkgName === plugin.pkgName && this.lastPluginConfig[i].assetName === plugin.assetName && this.lastPluginConfig[i].version === plugin.version) {
                    break;
                } else if (i === this.lastPluginConfig.length - 1) {
                    needBeCheckedPlugin.push(plugin);
                }
            }
        });
        return needBeCheckedPlugin;
    }

    isNeedRestart() {
        return this.appId !== this.lastAppid || this.bduss !== this.lastBduss;
    }

    updateAppIdAndBduss(appId, bduss) {
        this.appId = appId;
        this.bduss = bduss;
    }

    managePkgAsset(appConfig) {
        this.errors = [];
        let currentPluginConfig = this.collectPluginInfo(appConfig);
        let needBeCheckedPlugin = [];
        // 如果appId或者bduss变了，产出中插件全删除，当前appJson中所有的插件重走鉴权校验
        if (this.isNeedRestart()) {
            this.removeAllPluginForOutput();
            needBeCheckedPlugin = currentPluginConfig;
        } else {
            this.removePluginForOutput(currentPluginConfig);
            needBeCheckedPlugin = this.getNeedBeCheckedPlugin(currentPluginConfig);
        }
        if (!this.appId) {
            this.lastAppid = '';
            this.errors.push(new Error('正在使用插件，请确保开发者工具已登录且appId合法不为空！'));
            return Promise.resolve();
        }
        if (!currentPluginConfig.length) {
            return Promise.resolve().then(() => {
                this.lastPluginConfig = [];
            });
        }
        if (!needBeCheckedPlugin.length) {
            return Promise.resolve();
        }
        let toBeCheckedPluginsInfo = needBeCheckedPlugin.reduce((prev, curr) => {
            prev.push({
                'pluginId': curr.assetName,
                'userVersion': `${curr.version}`
            });
            return prev;
        }, []);
        return this.checkPluginsAuthority(toBeCheckedPluginsInfo).then(pluginsInfo => {
            // 有错误信息
            if (pluginsInfo instanceof Error) {
                return [];
            }
            // 准备下载时先把存放压缩插件的临时目录清除
            return _fsExtra2.default.remove(_path2.default.resolve(PLUGIN_DIRECTORY, 'tempPluginAssets')).then(() => {
                return Promise.all(this.getDownLoadOrCopyArr(pluginsInfo));
            });
        }).then(pluginAssetPath => {
            return Promise.all(pluginAssetPath.map(pluginPath => {
                return _fsExtra2.default.readJson(_path2.default.resolve(pluginPath, 'plugin.json')).then(json => json.pagesList);
            }));
        }).then(pagesList => {
            let tmpPages = [];
            pagesList.forEach(pages => {
                tmpPages = tmpPages.concat(pages);
            });
            this.pluginPages = tmpPages;
            this.lastPluginConfig = currentPluginConfig;
            this.lastAppid = this.appId;
            this.lastBduss = this.bduss;
        }).catch(err => {
            this.errors.push(err);
        });
    }
}
exports.default = PluginPkgManage;