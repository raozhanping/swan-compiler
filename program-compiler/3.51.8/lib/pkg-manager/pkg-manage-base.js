'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _crypto = require('crypto');

var _os = require('os');

var _unzipper = require('unzipper');

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @license
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * Copyright Baidu Inc. All Rights Reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * This source code is licensed under the Apache License, Version 2.0; found in the
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * LICENSE file in the root directory of this source tree.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @file 插件和动态库管理的基类
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @author jiamiao
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */


let {
    OUTPUT,
    SWAN_CLI_PROCESS
} = global.SWAN_CLI_ARGV;
const outputPath = _path2.default.isAbsolute(OUTPUT) ? OUTPUT : _path2.default.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);

const osTmpDir = (0, _os.tmpdir)();

class PkgManageBase {
    constructor(option = {}) {
        this.fs = option.fs || new _memoryFs2.default();
        this.sourceType = option.sourceType || 'plugin';
    }
    // 下载资源包
    downLoadPkg(url, assetName) {
        let tempPath = _path2.default.resolve(osTmpDir, `__swan-${this.sourceType}-${assetName}-${Date.now()}__.zip`);
        return _fsExtra2.default.remove(tempPath).then(() => {
            return new Promise((resolve, reject) => {
                const stream = (0, _request2.default)(url).on('error', err => reject(err)).pipe(_fsExtra2.default.createWriteStream(tempPath));
                stream.on('finish', _asyncToGenerator(function* () {
                    resolve(tempPath);
                }));
                stream.on('error', reject);
            });
        }).catch(err => {
            return new Promise((resolve, reject) => {
                const stream = (0, _request2.default)(url).on('error', err => reject(err)).pipe(_fsExtra2.default.createWriteStream(tempPath));
                stream.on('finish', _asyncToGenerator(function* () {
                    resolve(tempPath);
                }));
                stream.on('error', reject);
            });
        });
    }

    copyDir(src, dist) {
        const that = this;
        function copy(src, dist) {
            let paths = _fsExtra2.default.readdirSync(src);
            paths.forEach(function (catalogPath) {
                let addSrc = _path2.default.resolve(src, catalogPath);
                let addDist = _path2.default.resolve(dist, catalogPath);
                let stat = _fsExtra2.default.statSync(addSrc);
                // 判断是文件还是目录
                if (stat.isFile()) {
                    that.fs.writeFileSync(addDist, _fsExtra2.default.readFileSync(addSrc));
                } else if (stat.isDirectory()) {
                    that.fs.mkdirpSync(addDist);
                    // 当是目录是，递归复制
                    that.copyDir(addSrc, addDist);
                }
            });
        }
        copy(src, dist);
    }

    copyPkgToOutput(assetPath, assetName, pkgName) {
        let copyToPath = ((outputPath, assetName, pkgName) => {
            if ('main' === pkgName) {
                return _path2.default.resolve(outputPath, `__${this.sourceType}__`, assetName);
            }
            return _path2.default.resolve(outputPath, pkgName, `__${this.sourceType}__`, assetName);
        })(outputPath, assetName, pkgName);
        this.fs.mkdirpSync(copyToPath);
        this.copyDir(assetPath, copyToPath);
        return assetPath;
    }

    md5Str(str) {
        (0, _crypto.createHash)('md5').update(str).digest('hex');
    }

    unzip(src, target) {
        return _fsExtra2.default.createReadStream(src).pipe((0, _unzipper.Extract)({ path: target }));
    }

    unzipPromise(src, tmpTarget) {
        return new Promise((resolve, reject) => {
            const stream = this.unzip(src, tmpTarget);
            stream.on('finish', () => {
                resolve(tmpTarget);
            });
            stream.on('error', reject);
        });
    }

    // 调度编译时必要的函数
    managePkgAsset(appConfig) {}
}
exports.default = PkgManageBase;