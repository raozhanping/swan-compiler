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

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _os = require('os');

var _util = require('../util');

var _constant = require('../constant');

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 和webpack编译一起并行的动态库资源管理
 * @author jiamiao
 */
const {
    SERVER_HOST,
    DOWNLOAD_INTERFACE,
    PUBLIC_PARAM,
    DOWNLOAD_PARAM
} = _constant.SERVER_INFO;
let {
    OUTPUT,
    SWAN_CLI_PROCESS,
    DYNAMIC_LIB_ROOT
} = global.SWAN_CLI_ARGV;
const outputPath = _path2.default.isAbsolute(OUTPUT) ? OUTPUT : _path2.default.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);
const DYNAMIC_DIRECTORY = global.SWAN_CLI_ARGV.DYNAMIC_DIRECTORY;

class DynamicLibPkgManage extends _pkgManageBase2.default {
    constructor(option = {}) {
        option.sourceType = 'dynamicLib';
        super(option);
        this.lastDynamicConfig = [];
    }

    fetchPkgInfo(pkgList) {
        return pkgList.reduce((prev, curr) => {
            const passParam = `${SERVER_HOST}${DOWNLOAD_INTERFACE}?${_querystring2.default.stringify(PUBLIC_PARAM)}` + `&${_querystring2.default.stringify(DOWNLOAD_PARAM)}&bundle_id=${curr.assetName}`;
            prev.push((0, _requestPromise2.default)(passParam).then(config => {
                let pkgInfo = JSON.parse(config);
                if (0 === pkgInfo.errno) {
                    return {
                        pkgInfo,
                        assetName: curr.assetName,
                        pkgName: curr.pkgName
                    };
                } else {
                    return {
                        errMsg: `动态库 ${curr.assetName}: ${pkgInfo.errmsg}`,
                        assetName: curr.assetName,
                        pkgName: curr.pkgName
                    };
                }
            }).catch(err => {
                (0, _util.log)(`处于离线状态或动态库接口异常, 动态库 ${curr.assetName} 会使用本地离线下载的，不保证版本为最新。`, 'warn');
                return {
                    assetName: curr.assetName,
                    pkgName: curr.pkgName
                };
            }));
            return prev;
        }, []);
    }

    // 返回下载和拷贝资源的promise
    downLoadAndCopy(downloadUrl, pkgInfo, pkgDir, localVersion) {
        const {
            assetName,
            pkgName
        } = pkgInfo;
        const pkgVersion = pkgInfo.pkgInfo.data['version_name'];
        const assetPath = _path2.default.resolve(pkgDir, pkgVersion);
        return this.downLoadPkg(downloadUrl, assetName)
        // 下载先解压至正确目录同级的一个临时目录下，完成解压后move改名，确保不会出现解压失败，一直都用老的错误的包的问题
        .then(downloadTmpPath => {
            const unzipTmpPath = _path2.default.resolve(pkgDir, `${pkgInfo.assetName}${pkgVersion}-${Date.now()}`);
            if (localVersion) {
                const currentLocalPath = _path2.default.resolve(pkgDir, localVersion);
                return _fsExtra2.default.remove(currentLocalPath).then(() => {
                    return this.unzipPromise(downloadTmpPath, unzipTmpPath);
                });
            }
            return this.unzipPromise(downloadTmpPath, unzipTmpPath);
        }).then(tmpTarget => {
            return _fsExtra2.default.move(tmpTarget, assetPath, { overwrite: true });
        }).then(() => {
            return this.copyPkgToOutput(assetPath, assetName, pkgName);
        }).catch(err => {
            const errObj = new Error(`动态库 ${pkgInfo.assetName} 解压出错，请检查系统内存是否足够。`);
            (0, _util.errorNext)(errObj, 0, 1);
        });
    }

    // 返回包括检测、下载和拷贝的promise
    getDownLoadOrCopyArr(pkgInfo) {
        let downLoadAndCopyList = [];
        pkgInfo.forEach(pkg => {
            let pkgDir = _path2.default.resolve(DYNAMIC_DIRECTORY, pkg.assetName);
            if (pkg.pkgInfo) {
                let downloadUrl = pkg.pkgInfo.data['download_url'];
                downLoadAndCopyList.push(_fsExtra2.default.readdir(pkgDir).then(dir => {
                    const localVersion = dir.find(i => i.split('.').length > 2);
                    // 本地版本低于server中存储的最高版本，重新下载
                    if (localVersion < pkg.pkgInfo.data['version_name']) {
                        return this.downLoadAndCopy(downloadUrl, pkg, pkgDir, localVersion);
                    } else {
                        let pkgLocalAssetPath = _path2.default.resolve(pkgDir, localVersion);
                        return this.copyPkgToOutput(pkgLocalAssetPath, pkg.assetName, pkg.pkgName);
                    }
                }).catch(err => {
                    return this.downLoadAndCopy(downloadUrl, pkg, pkgDir);
                }));
            } else if (pkg.errMsg) {
                const errObj = new Error(pkg.errMsg);
                (0, _util.errorNext)(errObj, 0, 1);
            }
            // 离线状态或动态库接口异常
            else {
                    downLoadAndCopyList.push(_fsExtra2.default.readdir(pkgDir).then(dir => {
                        const localVersion = dir.find(i => i.split('.').length > 2);
                        let pkgLocalAssetPath = _path2.default.resolve(pkgDir, localVersion);
                        return this.copyPkgToOutput(pkgLocalAssetPath, pkg.assetName, pkg.pkgName);
                    }).catch(err => {
                        (0, _util.log)(`处于离线状态, 且动态库 ${pkg.assetName} 在本地没有下载缓存。`, 'error');
                    }));
                }
        });
        return downLoadAndCopyList;
    }
    // [
    //     {
    //         type: 'dynamic / plugin',
    //         pkgName: 'main / subpageName',
    //         assetName: 'dynamicnName'
    //     }
    // ]
    collectDynamicInfo(appConfig) {
        let collectArr = [];
        let mainDynamic = appConfig.dynamicLib;
        if (mainDynamic) {
            this.getCurrentDynamicConfig(collectArr, mainDynamic, 'main');
        }
        // TODO 暂不支持分包配置动态库
        // if (appConfig.subPackages) {
        //     appConfig.subPackages.forEach(subPackage => {
        //         if (subPackage.dynamicLib) {
        //             this.getCurrentDynamicConfig(collectArr, subPackage.dynamicLib, subPackage.root);
        //         }
        //     });
        // }
        return collectArr;
    }

    getCurrentDynamicConfig(collectArr, dynamicConfig, pkgName) {
        let devDynamicName = '';
        if (DYNAMIC_LIB_ROOT) {
            const devDynamicLibConfig = _fsExtra2.default.readJsonSync(_path2.default.resolve(DYNAMIC_LIB_ROOT, 'dynamicLib.json'));
            devDynamicName = devDynamicLibConfig.name;
        }
        Object.keys(dynamicConfig).forEach(dynamic => {
            if (dynamicConfig[dynamic].provider && dynamicConfig[dynamic].provider !== devDynamicName) {
                collectArr.push({
                    pkgName,
                    assetName: dynamicConfig[dynamic].provider
                });
            } else if (!dynamicConfig[dynamic].provider) {
                const errObj = new Error(`app.json中dynamicLib.${dynamic}.provider 字段需为 string`);
                (0, _util.errorNext)(errObj, 0, 1);
            }
        });
    }

    removeDynamicLib(currentDynamicConfig) {
        try {
            this.lastDynamicConfig.forEach(dynamic => {
                const beRemovedPath = 'main' === dynamic.pkgName ? _path2.default.resolve(outputPath, '__dynamicLib__', dynamic.assetName) : _path2.default.resolve(outputPath, dynamic.pkgName, '__dynamicLib__', dynamic.assetName);
                if (!currentDynamicConfig.length) {
                    this.fs.rmdirSync(beRemovedPath);
                } else {
                    for (let i = 0; i < currentDynamicConfig.length; i++) {
                        if (dynamic.pkgName === currentDynamicConfig[i].pkgName && dynamic.assetName === currentDynamicConfig[i].assetName) {
                            break;
                        } else if (i === currentDynamicConfig.length - 1) {
                            this.fs.rmdirSync(_path2.default.resolve(beRemovedPath));
                        }
                    }
                }
            });
        } catch (err) {
            // 动态库名称可能是随便写的，memoryFs里不会有目录，删除就会报错
        }
    }

    managePkgAsset(appConfig) {
        let currentDynamicConfig = this.collectDynamicInfo(appConfig);
        this.removeDynamicLib(currentDynamicConfig);
        const downLoadPkgList = currentDynamicConfig.reduce((prev, curr) => {
            prev.push({
                assetName: curr.assetName,
                pkgName: curr.pkgName
            });
            return prev;
        }, []);
        if (!downLoadPkgList.length) {
            return Promise.resolve().then(() => {
                this.lastDynamicConfig = currentDynamicConfig;
            });
        }
        return Promise.all(this.fetchPkgInfo(downLoadPkgList)).then(pkgInfo => {
            return Promise.all(this.getDownLoadOrCopyArr(pkgInfo));
        }).then(() => {
            // 完事后收集的配置信息变成上一次的动态库配置，用来比较那些资源是该删除的
            this.lastDynamicConfig = currentDynamicConfig;
        }).catch(err => {
            (0, _util.errorNext)(err, 0, 1);
        });
    }
}
exports.default = DynamicLibPkgManage;