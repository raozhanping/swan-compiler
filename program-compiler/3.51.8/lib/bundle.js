'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getSubPackageMd5 = getSubPackageMd5;

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _crypto = require('crypto');

var _path = require('path');

var _fsZipper = require('fs-zipper');

var _fsZipper2 = _interopRequireDefault(_fsZipper);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _stream = require('stream');

var _errors = require('./errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @file bundle output
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *  zip and subpackage process
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @author liuyuekeng
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */


const pkgFileName = 'pkginfo.json';
const ZIP_EXT = '.zip';
const SUB_PREFIX = 'file_sub_';
const MAIN_PACKAGE_NAME = `file_main${ZIP_EXT}`;
const DYNAMICLIB_PACKAGE_NAME = `file_dynamic${ZIP_EXT}`;
const COMPILE_OUTPUT_PACKAGE_NAME = `file_compile${ZIP_EXT}`;
const PLUGIN_OUTPUT_NAME = `file_plugin${ZIP_EXT}`;
const PLUGIN_DOC_NAME = `file_doc${ZIP_EXT}`;
const pkgContent = (appId, ext) => Object.assign({
    'package_name': appId,
    'version_name': '1.0.0.0',
    'max_frame_ver': '255.255',
    'min_frame_ver': '0.0'
}, ext);

const PLUGIN_ROOT = global.SWAN_CLI_ARGV.PLUGIN_ROOT;

function getSubPackageMd5(str) {
    return util.md5Str(str + Date.now().toString() + Math.random().toString());
}

function workPathMediaAssets() {
    return new Promise((resolve, reject) => {
        (0, _glob2.default)(util.MEDIA_TYPE, {
            cwd: global.SWAN_CLI_ARGV.WORK_PATH
        }, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
}

class Bundle {
    constructor(fs, dir, appId, extra) {
        this.fs = fs;
        this.dir = dir;
        this.appId = appId;
        this.extra = extra;
        this.releasePath = (0, _path.join)(dir, '..', 'release');
        this.appJsonPath = (0, _path.join)(dir, 'app.json');
        this.pkgInfoPath = (0, _path.join)(dir, pkgFileName);
        this.mainPackagePath = (0, _path.join)(this.releasePath, MAIN_PACKAGE_NAME);
        this.dynamicLibPackagePath = (0, _path.join)(this.releasePath, DYNAMICLIB_PACKAGE_NAME);
        if (PLUGIN_ROOT && this.appId) {
            this.pluginPath = (0, _path.join)(dir, '__plugin__', this.appId);
            this.pluginRelease = (0, _path.join)(this.releasePath, PLUGIN_OUTPUT_NAME);
            this.pluginDocPath = (0, _path.join)(dir, '__plugin__', 'doc');
            this.pluginDocRelease = (0, _path.join)(this.releasePath, PLUGIN_DOC_NAME);
        }
    }
    copyMediaAssets() {
        var _this = this;

        return _asyncToGenerator(function* () {
            let self = _this;
            let taskList = [];
            let files = yield workPathMediaAssets();
            files.forEach(function (file) {
                taskList.push(new Promise(function (resolve, reject) {
                    try {
                        let src = (0, _path.join)(global.SWAN_CLI_ARGV.WORK_PATH, file);
                        let trg = (0, _path.join)(self.dir, file);
                        let read = _fsExtra2.default.createReadStream(src);
                        util.mfsEnsureDirSync(_this.fs, (0, _path.dirname)(trg));
                        let write = _this.fs.createWriteStream(trg);
                        write.on('finish', function () {
                            resolve();
                        });
                        read.pipe(write);
                    } catch (e) {
                        reject();
                    }
                }));
            });
            return Promise.all(taskList);
        })();
    }
    pack(pkgInfo, options = {}) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            let appInfo;
            try {
                appInfo = util.mfsReadJson(_this2.fs, _this2.appJsonPath);
            } catch (e) {
                if (e.code === 'ENOENT') {
                    e.message = `未找到文件"app.json": ${e.message}`;
                } else {
                    e.message = `解析文件"app.json"失败: ${e.message}`;
                }
                e.level = 1;
                throw e;
            }
            util.checkSubPackagesConf(appInfo);
            util.mfsWriteJson(_this2.fs, _this2.pkgInfoPath, pkgContent(_this2.appId, pkgInfo));
            let subPackages = appInfo.subPackages || appInfo.subpackages;
            let subSwan = {};
            let subPackageList = [];
            let fileSize = { sub: {} };
            let self = _this2;
            if (Array.isArray(subPackages)) {
                subPackageList = subPackages.map(function (item) {
                    const { root, independent = false } = item;
                    const sign = getSubPackageMd5(root + self.appId);
                    return { root, independent, subPackageName: sign, ext: ZIP_EXT };
                });
                subSwan = {
                    '_sub_swan': subPackageList.reduce(function (pre, cur) {
                        if (cur && cur.root) {
                            pre[cur.root] = cur.subPackageName;
                            return pre;
                        }
                        return pre;
                    }, {})
                };
            }
            let appJson = Object.assign({}, appInfo, subSwan, _this2.extra);
            if (options.pluginPages) {
                appJson.pages = appJson.pages || [];
                appJson.pages = util.unionArray(appJson.pages.concat(options.pluginPages));
            }
            util.mfsWriteJson(_this2.fs, _this2.appJsonPath, appJson);
            // 所有独立分包app.json写入subSwan
            if (Array.isArray(subPackageList)) {
                let appJsonString = JSON.stringify(appJson);
                subPackageList = yield Promise.all(subPackageList.map((() => {
                    var _ref = _asyncToGenerator(function* (item) {
                        const sign = item.subPackageName;
                        const subPackagePath = (0, _path.join)(self.dir, item.root);
                        const fileName = `${SUB_PREFIX}${sign}${ZIP_EXT}`;
                        const output = (0, _path.join)(self.releasePath, fileName);
                        if (item.independent) {
                            let independentAppJsonPath = (0, _path.join)(subPackagePath, 'app.json');
                            _this2.fs.writeFileSync(independentAppJsonPath, appJsonString);
                        }
                        self.checkSubPackageRoot(subPackagePath);
                        const zipInfo = yield self.copyFileAndZip(subPackagePath, output, [self.pkgInfoPath]);
                        fileSize.sub[item.root] = zipInfo.fileSize;
                        // TODO: 分包有问题，不应该在这个地方删除 @yuekeng
                        self.fs.rmdirSync(subPackagePath);
                        Object.assign(zipInfo, item);
                        return zipInfo;
                    });

                    return function (_x) {
                        return _ref.apply(this, arguments);
                    };
                })()));
            }
            let globalsPath = (0, _path.join)(_this2.dir, 'globals');
            _this2.fs.existsSync(globalsPath) && _this2.fs.rmdirSync(globalsPath);
            let mainZipInfo = yield self.copyFileAndZip(_this2.dir, _this2.mainPackagePath);
            fileSize.main = mainZipInfo.fileSize;
            let releasePaths = {
                release: _this2.releasePath,
                main: _this2.mainPackagePath,
                sub: subPackageList
            };
            // 插件包
            if (PLUGIN_ROOT) {
                yield self.copyFileAndZip(_this2.pluginPath, _this2.pluginRelease);
                _this2.fs.rmdirSync(_this2.pluginPath);
                releasePaths.plugin = _this2.pluginRelease;
                if (_this2.fs.existsSync(_this2.pluginDocPath)) {
                    yield self.copyFileAndZip(_this2.pluginDocPath, _this2.pluginDocRelease);
                    _this2.fs.rmdirSync(_this2.pluginDocPath);
                    releasePaths.pluginDoc = _this2.pluginDocRelease;
                }
            }
            return {
                md5: mainZipInfo.md5,
                path: releasePaths,
                info: appJson,
                fileSize
            };
        })();
    }
    checkSubPackageRoot(root) {
        let stats;
        try {
            stats = this.fs.statSync(root);
        } catch (e) {}
        if (!stats || !stats.isDirectory()) {
            throw new _errors.AppJsonIllegal(`subPackages root "${root}" 目录不存在`);
        }
    }
    dynamicLibToDisk(srcPath, diskPath) {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            yield _this3.zipToDisk(srcPath, diskPath, DYNAMICLIB_PACKAGE_NAME);
        })();
    }
    compileOutputToDisk(diskPath) {
        var _this4 = this;

        return _asyncToGenerator(function* () {
            yield _this4.zipToDisk(_this4.dir, diskPath, COMPILE_OUTPUT_PACKAGE_NAME);
        })();
    }
    packPluginDoc() {
        var _this5 = this;

        return _asyncToGenerator(function* () {
            yield _this5.copyFileAndZip(_this5.pluginDocPath, _this5.pluginDocRelease);
            return _this5.pluginDocRelease;
        })();
    }
    zipToDisk(srcPath, diskPath, fileName) {
        var _this6 = this;

        return _asyncToGenerator(function* () {
            let tmpDir = (0, _path.resolve)('/tmp', Math.random().toString().slice(-8));
            yield _this6.zip(srcPath, tmpDir);
            yield _fsExtra2.default.writeFile((0, _path.join)(diskPath, fileName), _this6.fs.readFileSync(tmpDir));
        })();
    }
    copyFileAndZip(source, target, files = []) {
        files.forEach(file => {
            let name = (0, _path.basename)(file);
            util.mfsCopy(this.fs, file, this.fs, (0, _path.join)(source, name));
        });
        return this.zip(source, target);
    }
    zip(source, target) {
        let self = this;
        util.mfsEnsureDirSync(this.fs, (0, _path.dirname)(target));
        let resolve;
        let reject;
        let p = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        let chunks = [];
        let len = 0;
        const output = new _stream.Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                len += chunk.length;
                callback();
            }
        });
        const archive = new _fsZipper2.default(this.fs, { zlib: { level: 9 } });
        const hash = (0, _crypto.createHash)('md5');
        archive.on('data', data => {
            hash.update(data);
        });
        output.on('finish', () => {
            let fileBuffer = Buffer.concat(chunks, len);
            self.fs.writeFileSync(target, fileBuffer);
            resolve({ md5: hash.digest('hex'), path: target, fileSize: len });
        });
        archive.on('warning', err => reject(err));
        archive.on('error', err => reject(err));
        archive.pipe(output);
        archive.directory(source);
        archive.finalize();
        return p;
    }
}
exports.default = Bundle;