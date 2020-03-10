'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _dynamicLibPkgManage = require('./dynamic-lib-pkg-manage');

var _dynamicLibPkgManage2 = _interopRequireDefault(_dynamicLibPkgManage);

var _pluginPkgManage = require('./plugin-pkg-manage');

var _pluginPkgManage2 = _interopRequireDefault(_pluginPkgManage);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @license
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * Copyright Baidu Inc. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @file 资源管理的截流入口
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @author jiamiao
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */


const WORK_PATH = global.SWAN_CLI_ARGV.WORK_PATH;
const appJsonPath = _path2.default.resolve(WORK_PATH, 'app.json');
const maxRetryTime = 5;

class PkgManger {
    constructor(option) {
        this.dynamicLibPkgManage = new _dynamicLibPkgManage2.default({ fs: option.fs });
        this.fs = option.fs;
        this.logger = option.logger || (() => {});
        this.running = false;
        this.lastAlter = [];
        this.lastAppConfigMtimeMs = null;
        this.isShouldInit = true;
        this.appConfig = {};
        this.firstReady = new Promise(resolve => {
            this.firstReadyResolve = resolve;
        });
        this.firstCb = true;
        this.cb = err => {
            let pluginErrors = this.getErrors();
            let errors = pluginErrors.concat(err || []);
            if (this.firstCb) {
                this.watchAppConfig();
                this.firstCb = false;
            }
            if (errors.length) {
                this.reportErrors(errors);
            } else {
                this.firstReadyResolve();
            }
        };
    }

    reportErrors(errors) {
        errors = errors && errors.length ? errors : this.getErrors();
        errors.forEach(error => {
            (0, _util.log)(`${error}`, 'error');
        });
    }

    receiveAppIdAndBduss(appId, bduss) {
        if (this.isShouldInit) {
            this.init(appId, bduss);
        } else {
            this.pluginPkgManage.updateAppIdAndBduss(appId, bduss);
            this.receiveAppConfig();
        }
    }

    init(appId, bduss) {
        var _this = this;

        return _asyncToGenerator(function* () {
            _this.isShouldInit = false;
            _this.pluginPkgManage = new _pluginPkgManage2.default({ fs: _this.fs, appId, bduss });
            try {
                let stats = yield _fsExtra2.default.stat(appJsonPath);
                _this.lastAppConfigMtimeMs = stats.mtimeMs;
            } catch (e) {
                // ignore;
            }
            _this.appConfig = yield _fsExtra2.default.readJson(appJsonPath).catch(function () {
                return { pages: [] };
            });
            _this.receiveAppConfig();
        })();
    }

    retryReadJson(path, retryTime) {
        return _fsExtra2.default.readJSON(path).then(appConfig => {
            this.appConfig = appConfig;
            this.receiveAppConfig();
        }).catch(err => {
            retryTime++;
            if (retryTime > maxRetryTime) {
                throw err;
            } else {
                this.retryReadJson(path, retryTime);
            }
        });
    }

    watchAppConfig() {
        _chokidar2.default.watch(appJsonPath, {
            ignoreInitial: true
        }).on('all', (event, filepath) => {
            _fsExtra2.default.stat(appJsonPath).then(stats => {
                let currentMtimeMs = stats.mtimeMs;
                if (currentMtimeMs === this.lastAppConfigMtimeMs) {
                    throw new Error('mtime did not change');
                } else {
                    this.lastAppConfigMtimeMs = currentMtimeMs;
                    return appJsonPath;
                }
            }).then(appJsonPath => this.retryReadJson(appJsonPath, 0)).catch(() => {
                // ignore error
            });
        });
    }
    receiveAppConfig() {
        let eventList = [];
        if (this.appConfig.plugins) {
            eventList.push(this.pluginPkgManager());
        }
        if (this.appConfig.dynamicLib) {
            eventList.push(this.dynamicLibPkgManager());
        }
        if (!this.running) {
            this.running = true;
            return this.run(eventList);
        } else {
            this.lastAlter = eventList;
        }
    }
    run(eventList) {
        return Promise.all(eventList).then(() => {
            if (this.lastAlter.length > 0) {
                return Promise.all(this.lastAlter);
            }
            return Promise.resolve();
        }).then(() => {
            this.running = false;
            this.cb();
        }).catch(err => {
            this.running = false;
            this.cb(err);
        });
    }
    pluginPkgManager() {
        return this.pluginPkgManage.managePkgAsset(this.appConfig);
    }
    dynamicLibPkgManager() {
        return this.dynamicLibPkgManage.managePkgAsset(this.appConfig);
    }
    getPluginPages() {
        if (this.pluginPkgManage) {
            return this.pluginPkgManage.getPluginPages();
        }
        return [];
    }
    getUsedPluginInfoFromServer() {
        if (this.pluginPkgManage) {
            return this.pluginPkgManage.getUsedPluginInfoFromServer();
        }
        return {};
    }
    getErrors() {
        let pluginErrors = this.pluginPkgManage ? this.pluginPkgManage.getErrors() : [];
        let res = [].concat(pluginErrors);
        return res;
    }
}
exports.default = PkgManger;