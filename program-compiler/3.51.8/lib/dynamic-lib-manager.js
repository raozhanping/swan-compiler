'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _pkgManager = require('./pkg-manager');

var _pkgManager2 = _interopRequireDefault(_pkgManager);

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
    WORK_PATH,
    DYNAMIC_LIB_ROOT
} = global.SWAN_CLI_ARGV;
const appJsonPath = _path2.default.resolve(WORK_PATH, 'app.json');

class DynamicLibManager {
    constructor(fs, logger) {
        this.fs = fs || new _memoryFs2.default();
        this.logger = logger || (() => {});
        this.downloader = null;
        this.downloadReady = false;
        this.lastAppConfigMtimeMs = null;
        _fsExtra2.default.stat(appJsonPath).then(stats => {
            this.lastAppConfigMtimeMs = stats.mtimeMs;
            this.download();
        });
        /*
        this.compiler = null;
        this.compileError = null;
        this.compileReady = false;
        this.compile();
        */
        this.firstReadyResolve = () => {};
        this.firstReady = new Promise((resolve, reject) => {
            this.firstReadyResolve = resolve;
        });
    }
    isUsingDynamicLib() {
        return this.downloader && this.downloader.currentDynamicConfigArr && this.downloader.currentDynamicConfigArr.length;
    }
    watchAppConfig() {
        _fsExtra2.default.watch(appJsonPath, (eventType, filename) => {
            _fsExtra2.default.stat(appJsonPath).then(stats => {
                let currentMtimeMs = stats.mtimeMs;
                if (currentMtimeMs === this.lastAppConfigMtimeMs) {
                    throw new Error('mtime did not change');
                } else {
                    this.lastAppConfigMtimeMs = currentMtimeMs;
                    return appJsonPath;
                }
            }).then(_fsExtra2.default.readJSON).then(appConfig => {
                this.downloader && this.downloader.managePkgAsset(appConfig).then(() => {
                    this.logger('downloadFinish');
                });
            }).catch(() => {
                // ignore error
            });
        });
    }
    download() {
        _fsExtra2.default.readJson(appJsonPath).catch(() => ({ pages: [] })).then(config => {
            this.downloader = new _pkgManager2.default({ fs: this.fs });
            this.downloader.managePkgAsset(config).then(() => {
                this.logger('downloadFinish');
                this.downloadReady = true;
                this.firstReadyResolve();
                this.watchAppConfig();
            });
        });
    }
    /*
    compile() {
        if (DYNAMIC_LIB_ROOT) {
            let dynamicLibConfig = require('./webpack-config/dynamic');
            dynamicLibConfig.then(result => {
                this.compiler = webpack(result.config);
                this.compiler.outputFileSystem = this.fs;
                this.compiler.watch({poll: true}, (err, stats) => {
                    if (err) {
                        this.compileError = err;
                    } else {
                        this.compileError = null;
                        this.compileReady = true;
                        this.checkReady();
                    }
                    this.compileCallback(err, stats);
                });
            });
        } else {
            this.compileReady = true;
            this.checkReady();
        }
    }
    */
}
exports.default = DynamicLibManager;