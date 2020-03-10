'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _webpackDevMiddleware = require('webpack-dev-middleware');

var _webpackDevMiddleware2 = _interopRequireDefault(_webpackDevMiddleware);

var _uglifyJs = require('uglify-js');

var _uglifyJs2 = _interopRequireDefault(_uglifyJs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _bundle = require('./bundle');

var _bundle2 = _interopRequireDefault(_bundle);

var _uploader = require('./uploader');

var _uploader2 = _interopRequireDefault(_uploader);

var _writeCacheFile = require('./write-cache-file');

var _writeCacheFile2 = _interopRequireDefault(_writeCacheFile);

var _stdmsg = require('@liuyuekeng/stdmsg');

var _stdmsg2 = _interopRequireDefault(_stdmsg);

var _webCompile = require('./web-compile');

var _fs = require('fs');

var _remoteDebugMiddleware = require('./middleware/remote-debug-middleware');

var _remoteDebugMiddleware2 = _interopRequireDefault(_remoteDebugMiddleware);

var _adbDebugMiddleware = require('./middleware/adb-debug-middleware');

var _adbDebugMiddleware2 = _interopRequireDefault(_adbDebugMiddleware);

var _testMiddleware = require('./middleware/test-middleware');

var _testMiddleware2 = _interopRequireDefault(_testMiddleware);

var _imageminPreviewMiddleware = require('./middleware/imagemin-preview-middleware');

var _imageminPreviewMiddleware2 = _interopRequireDefault(_imageminPreviewMiddleware);

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _lazyCompileMiddleware = require('./middleware/lazy-compile-middleware');

var _lazyCompileMiddleware2 = _interopRequireDefault(_lazyCompileMiddleware);

var _appJsonMiddleware = require('./middleware/app-json-middleware');

var _appJsonMiddleware2 = _interopRequireDefault(_appJsonMiddleware);

var _pkgManager = require('./pkg-manager');

var _pkgManager2 = _interopRequireDefault(_pkgManager);

var _fileSizeMiddleware = require('./middleware/file-size-middleware');

var _fileSizeMiddleware2 = _interopRequireDefault(_fileSizeMiddleware);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _errors = require('./errors');

var _imagemin = require('./imagemin');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @file do compile in memory
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @author liuyuekeng
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */

// import mediaAssetsMiddleware from './middleware/media-assets-middleware';


const uglifyOutputDir = _path2.default.resolve('/output');

class compilerManager {
    constructor(compiler, {
        port,
        output,
        workPath,
        watchOptions,
        compileCallback,
        entryInfo
    }) {
        let app = (0, _express2.default)();
        this.app = app;
        this.lastWebpackStats = null;
        this.webpackStats = null;
        this.uglifyCache = {};
        this.firstCompileEnd = false;
        this.entryInfo = entryInfo;
        this.workPath = workPath;
        this.pkgManagerReady = false;
        // operation lock
        this.busy = {
            preview: false,
            webPreview: false,
            publish: false,
            dynamicLibPublish: false,
            pluginPublish: false,
            pluginDocPublish: false
        };
        // web化包合并
        this.webPackageId = null;
        this.supportWebOptimize = null;
        this.listen();
        this.defaultProgressHook = (action, data) => {
            this.send('progress', null, { action, data });
        };
        this.defaultErrorHook = (action, err, data) => {
            this.send('error', { action, message: err.message }, data);
        };
        this.compileErrors = null;
        let instance = this;
        let compilers = compiler.compilers || [compiler];
        compilers.forEach(v => {
            v.plugin('watch-run', (watcher, callback) => {
                (0, _webCompile.clearCache)(Date.now()) && this.send('clearWebCompileCache');
                (0, _webCompile.invalidProductionTask)() && this.send('invalidWebCompileTask');
                callback();
            });
        });
        let wdm = (0, _webpackDevMiddleware2.default)(compiler, {
            logLevel: 'warn',
            watchOptions,
            stats: 'errors-only',
            publicPath: compiler.outputPath,
            swanCompileCallback(err, multipleStats) {
                (0, _writeCacheFile2.default)();
                let jsonStats = multipleStats.toJson();
                if (multipleStats.hasErrors()) {
                    instance.compileErrors = jsonStats.errors;
                } else {
                    instance.compileErrors = null;
                    if (!instance.firstCompileEnd) {
                        instance.firstCompileEnd = true;
                        instance.pkgManager.firstReady.then(() => {
                            instance.pkgManagerReady = true;
                            instance.send('compile.staticResourceReady', null, {
                                hash: jsonStats.hash
                            });
                        });
                    }
                }
                instance.webPackageId = null;
                let stats = {};
                let chunkMap = {};
                jsonStats.children.forEach(v => {
                    stats[v.name] = v;
                    chunkMap[v.name] = util.chunkArr2Map(v.chunks);
                });
                instance.lastWebpackStats = instance.webpackStats;
                instance.webpackStats = stats;
                try {
                    let mergeChunkMap = {};
                    Object.keys(chunkMap).forEach(v => {
                        mergeChunkMap[v] = Object.assign({}, instance.lastWebpackStats && instance.lastWebpackStats.chunkMap[v] ? instance.lastWebpackStats.chunkMap[v] : {}, chunkMap[v]);
                    });
                    if (instance.lastWebpackStats) {
                        Object.keys(instance.lastWebpackStats.chunkMap).forEach(v => {
                            if (!mergeChunkMap[v]) {
                                mergeChunkMap[v] = Object.assign({}, instance.lastWebpackStats.chunkMap[v]);
                            }
                        });
                    }
                    instance.webpackStats.chunkMap = mergeChunkMap;
                } catch (e) {
                    console.log(e);
                }
                let shouldTriggerEnd = false;
                if (jsonStats.children.filter(v => !['slave'].includes(v.name)).length > 0) {
                    shouldTriggerEnd = true;
                } else if (instance.lastWebpackStats) {
                    shouldTriggerEnd = !Object.keys(chunkMap).every(name => {
                        return Object.keys(chunkMap[name]).every(chunk => {
                            if (['slave'].includes(name)) {
                                if (chunk === '0' || chunk === 'allCusomComponents.swan') {
                                    return true;
                                }
                                if (!instance.lazymiddleware.isLoadedChunk(chunk)) {
                                    return false;
                                } else {
                                    let cur = instance.webpackStats.chunkMap[name][chunk].hash;
                                    let old = instance.lastWebpackStats.chunkMap[name] && instance.lastWebpackStats.chunkMap[name][chunk] && instance.lastWebpackStats.chunkMap[name][chunk].hash;
                                    return old ? old === cur : true;
                                }
                            } else {
                                return true;
                            }
                        });
                    });
                } else {
                    // first compile
                    shouldTriggerEnd = true;
                }
                if (shouldTriggerEnd) {
                    if (compileCallback(err, multipleStats, true) && instance.firstCompileEnd && instance.pkgManagerReady === true) {
                        instance.send('compile.staticResourceReady', null, {
                            compileMode: 'hot',
                            hash: jsonStats.hash
                        });
                    }
                }
                instance.lazymiddleware.compileCallback(err, stats.slave);
            }
        });
        this.wdm = wdm;
        // - wdm <middleware>
        //     - close <function> to stop watching
        //     - invalidate <function> to invalidate current compile
        //     - waitUntilValid <function> wait for compiling, invoked after watching callback
        //     - fileSystem <fs> memory fs which store compile output
        //     - context <object>
        //         - state <boolean> not compiling while true
        //         - webpackStats <object> chunk info and so on
        //         - watching <object> webpack watching instance
        //         - compiler <object> webpack compiler instance
        //         - rebuuild <function> compiler.run while not busy / or untile not busy
        this.fs = wdm.fileSystem;
        this.lazymiddleware = (0, _lazyCompileMiddleware2.default)({
            fs: this.fs,
            outputPath: compiler.outputPath,
            workPath: this.workPath,
            entryInstance: this.entryInfo.entryInstance,
            logger: this.getHookFun('lazyCompile', 'log')
        });
        this.allSlaveValid = fun => {
            this.lazymiddleware.loadAllSwan().then(() => {
                instance.wdm.waitUntilValid(fun);
            });
        };
        app.use(this.lazymiddleware);
        this.pkgManager = new _pkgManager2.default({ fs: this.fs, logger: this.getHookFun('pkgManager', 'log') });
        app.use('/remote-debug-zip', _bodyParser2.default.json(), (0, _remoteDebugMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath,
            allSlaveValid: this.allSlaveValid,
            getProjectInfo: () => this.projectInfo,
            getPluginInfo: this.getPluginInfo.bind(this)
        }));
        app.use('/adb-debug-zip', (0, _adbDebugMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath,
            allSlaveValid: this.allSlaveValid,
            getPluginInfo: this.getPluginInfo.bind(this),
            getProjectInfo: () => this.projectInfo
        }));
        app.use('/test-backdoor', (0, _testMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath,
            allSlaveValid: this.allSlaveValid
        }));
        app.use('/output/app.json', (0, _appJsonMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath,
            getPluginPages: this.getPluginPages.bind(this)
        }));
        app.use('/imagemin-preview', (0, _imageminPreviewMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath
        }));
        app.use('/file-size', (0, _fileSizeMiddleware2.default)({
            fs: this.fs,
            outputPath: this.wdm.context.compiler.outputPath
        }));
        app.use(wdm);
        try {
            app.listen(port);
        } catch (e) {
            util.log('server port conflict', 'error');
        }
    }
    getHookFun(type, hook) {
        let self = this;
        return function (state, err, extData) {
            let data = { state };
            extData && (data.extData = extData);
            let e = err || undefined;
            self.send(`${type}.${hook}`, e, data);
        };
    }

    /**
     * listen operation from stdin
     */
    listen() {
        var _this = this;

        let self = this;
        let stdMsg = new _stdmsg2.default('swanCompilation', 'swanIdeCli', process.stdin, process.stdout);
        this.stdMsg = stdMsg;
        // these operations need extra info to run (user info & project info)
        let preCheckList = ['preview', 'publish', 'webPreview', 'pluginPublish', 'pluginDocPublish'];
        // these operations would not be execute with compile error
        let compileErrorCheckList = ['preview', 'publish', 'compile'];
        let firstCompileEndCheckList = ['preview', 'publish', 'compile'];
        stdMsg.listen((() => {
            var _ref = _asyncToGenerator(function* (err, data) {
                if (!err && data.content) {
                    let type = data.content.type;
                    let missing = self.infoMissing();
                    if (preCheckList.indexOf(type) > -1 && missing) {
                        if (!(type === 'preview' || type === 'publish') || !data.content.data.options || !data.content.data.options.diskPath) {
                            self.send(`${type}.res`, { message: `${missing}， 无法执行该 "${type}" 操作` });
                            return;
                        }
                    }
                    if (compileErrorCheckList.indexOf(type) > -1 && self.compileErrors) {
                        if (type === 'compile') {
                            // compile operation need extra message to load simulator
                            util.log(`${self.compileErrors}`, 'error');
                            self.send('compile.end', null, {
                                compileMode: 'hot',
                                compileTime: { total: 0 },
                                // to trigger simulator refresh
                                fakeCompile: true
                            });
                        }
                        self.send(`${type}.res`, {
                            message: `请先修复编译 error，再执行 "${type}" 操作`,
                            stack: Array.isArray(self.compileErrors) && self.compileErrors[0],
                            level: 1
                        });
                        return;
                    }
                    if (firstCompileEndCheckList.indexOf(type) > -1 && !self.firstCompileEnd) {
                        self.send(`${type}.res`, {
                            message: '编译未完成，稍后再试',
                            level: 1
                        });
                        return;
                    }
                    switch (type) {
                        case 'updateInfo':
                            {
                                let { projectInfo, userInfo, globalSetting } = data.content.data;
                                self.updateInfo(projectInfo, userInfo, globalSetting);
                                break;
                            }
                        case 'preview':
                            {
                                if (self.busy.preview) {
                                    self.send('preview.res', new _errors.OperationLock('APP预览'));
                                    return;
                                }
                                let previewOptions = data.content.data.options;
                                try {
                                    self.busy.preview = self.preview(previewOptions).then(function (res) {
                                        self.send('preview.res', null, res);
                                        self.busy.preview = false;
                                    }).catch(function (e) {
                                        self.busy.preview = false;
                                        self.send('preview.res', e);
                                    });
                                } catch (e) {
                                    self.busy.preview = false;
                                    self.send('preview.res', e);
                                }
                                break;
                            }
                        case 'publish':
                            {
                                if (self.busy.publish) {
                                    self.send('publish.res', new _errors.OperationLock('发布'));
                                    return;
                                }
                                let publishOptions = data.content.data.options;
                                let version = data.content.data.version;
                                self.busy.publish = true;
                                try {
                                    self.publish(version, publishOptions).then(function (res) {
                                        self.send('publish.res', null, res);
                                        self.busy.publish = false;
                                    }).catch(function (e) {
                                        self.busy.publish = false;
                                        self.send('publish.res', e);
                                    });
                                } catch (e) {
                                    self.busy.publish = false;
                                    self.send('publish.res', e);
                                }
                                break;
                            }
                        case 'webPreview':
                            {
                                if (self.busy.webPreview) {
                                    self.send('webPreview.res', new _errors.OperationLock('WEB预览'));
                                    return;
                                }
                                let webPreviewOption = data.content.data.options;
                                self.busy.webPreview = true;
                                // 需要等待preview操作，确认server是否支持
                                // 保证进入webPreview流程时self.supportWebOptimize已经确认
                                if (self.supportWebOptimize === null) {
                                    if (self.busy.preview) {
                                        // 已经在preview了，还未返回
                                        yield self.busy.preview;
                                        // 预览失败的情况
                                        if (self.supportWebOptimize === null) {
                                            self.send('webPreview.res', { message: '请先进行APP预览，成功后再尝试WEB化预览', level: 1 });
                                            self.busy.webPreview = false;
                                            return;
                                        }
                                    } else {
                                        // 尚未preview，直接阻止
                                        self.send('webPreview.res', { message: '请先进行APP预览，成功后再尝试WEB化预览', level: 1 });
                                        self.busy.webPreview = false;
                                        return;
                                    }
                                }
                                try {
                                    self.webPreview(webPreviewOption).then(function (res) {
                                        self.send('webPreview.res', null, res);
                                        self.busy.webPreview = false;
                                    }).catch(function (e) {
                                        self.busy.webPreview = false;
                                        self.send('webPreview.res', e);
                                    });
                                } catch (e) {
                                    self.busy.webPreview = false;
                                    self.send('webPreview.res', e);
                                }
                                break;
                            }
                        case 'compile':
                            {
                                let sha256 = _crypto2.default.createHash('sha256');
                                sha256.update(Math.random().toString());
                                let hash = sha256.digest('hex').slice(0, 20);
                                if (self.wdm.context.state) {
                                    self.send('compile.end', null, {
                                        compileMode: 'hot',
                                        compileTime: { total: 0 },
                                        // to trigger simulator refresh
                                        fakeCompile: true,
                                        hash
                                    });
                                    if (_this.pkgManager.getErrors().length) {
                                        _this.pkgManager.reportErrors();
                                    } else {
                                        self.send('compile.staticResourceReady', null, {
                                            compileMode: 'hot',
                                            hash
                                        });
                                    }
                                }
                                break;
                            }
                        case 'dynamicLibPublish':
                            {
                                if (self.busy.dynamicLibPublish) {
                                    self.send('dynamicLibPublish.res', new _errors.OperationLock('动态库发布'));
                                    return;
                                }
                                self.busy.dynamicLibPublish = true;
                                try {
                                    self.dynamicLibPublish(data.content.data.options).then(function (res) {
                                        self.busy.dynamicLibPublish = false;
                                        self.send('dynamicLibPublish.res', null, res);
                                    }).catch(function (e) {
                                        self.busy.dynamicLibPublish = false;
                                        self.send('dynamicLibPublish.end', e);
                                    });
                                } catch (e) {
                                    self.busy.dynamicLibPublish = false;
                                    self.send('dynamicLibPublish.end', e);
                                }
                                break;
                            }
                        case 'pluginPublish':
                            {
                                if (!global.SWAN_CLI_ARGV.PLUGIN_ROOT) {
                                    self.send('pluginPublish.res', { message: '非插件开发模式，不允许调用插件发布' });
                                    return;
                                }
                                if (self.busy.pluginPublish) {
                                    self.send('pluginPublish.res', new _errors.OperationLock('插件发布'));
                                    return;
                                }
                                self.busy.pluginPublish = true;
                                try {
                                    self.pluginPublish(data.content.data.version, data.content.data.options).then(function (res) {
                                        self.busy.pluginPublish = false;
                                        self.send('pluginPublish.res', null, res);
                                    }).catch(function (e) {
                                        self.busy.pluginPublish = false;
                                        self.send('pluginPublish.end', e);
                                    });
                                } catch (e) {
                                    self.busy.pluginPublish = false;
                                    self.send('pluginPublish.end', e);
                                }
                                break;
                            }
                        case 'pluginDocPublish':
                            {
                                if (!global.SWAN_CLI_ARGV.PLUGIN_ROOT) {
                                    self.send('pluginPublish.res', { message: '非插件开发模式，不允许调用插件文档发布' });
                                    return;
                                }
                                if (self.busy.pluginDocPublish) {
                                    self.send('pluginDocPublish.res', new _errors.OperationLock('插件文档'));
                                    return;
                                }
                                self.busy.pluginDocPublish = true;
                                try {
                                    self.pluginDocPublish(data.content.data.version, data.content.data.options).then(function (res) {
                                        self.busy.pluginDocPublish = false;
                                        self.send('pluginDocPublish.res', null, res);
                                    }).catch(function (e) {
                                        self.busy.pluginDocPublish = false;
                                        self.send('pluginDocPublish.end', e);
                                    });
                                } catch (e) {
                                    self.busy.pluginDocPublish = false;
                                    self.send('pluginDocPublish.end', e);
                                }
                                break;
                            }
                        case 'compileOutputToDisk':
                            {
                                try {
                                    self.compileOutputToDisk(data.content.data.options).then(function (res) {
                                        self.send('compileOutputToDisk.end', null, res);
                                    }).catch(function (e) {
                                        self.send('compileOutputToDisk.end', e);
                                    });
                                } catch (e) {
                                    self.send('compileOutputToDisk.end', e);
                                }
                                break;
                            }
                        default:
                            {
                                let e = new _errors.InvalidOperation(type);
                                self.send('invalidOperation', e);
                                break;
                            }
                    }
                }
            });

            return function (_x, _x2) {
                return _ref.apply(this, arguments);
            };
        })());
        stdMsg.send({ type: 'listening' });
    }

    /**
     * send message to main process by stdout
     * @param {string} type type
     * @param {Object} err error
     * @param {any} data data
     */
    send(type, err, data) {
        if (this.stdMsg) {
            let msg = { type, data };
            if (err) {
                let errObj = {};
                Object.getOwnPropertyNames(err).forEach(v => {
                    errObj[v] = err[v];
                });
                msg.err = errObj;
            }
            this.stdMsg.send(msg);
        }
    }

    /**
     * update project info & user info
     * @param {Object} projectInfo project info
     * @param {Object} userInfo user info
     */
    updateInfo(projectInfo, userInfo, globalSetting) {
        if (projectInfo && global.APPID !== projectInfo.appId) {
            global.APPID = projectInfo.appId;
            let pluginCompiler = this.wdm.context.compiler.compilers.find(v => v.name === 'plugin');
            pluginCompiler && pluginCompiler.updateEntry();
        }
        this.pkgManager.receiveAppIdAndBduss(projectInfo.appId, userInfo.cookie);
        projectInfo && (this.projectInfo = projectInfo);
        userInfo && (this.userInfo = userInfo);
        globalSetting && (this.globalSetting = globalSetting);
    }

    /**
     * get ext info in file ext.json
     * @return {Object|string} json content or ''
     */
    getExtInfo() {
        let res;
        try {
            let file = _path2.default.join(this.wdm.context.compiler.outputPath, 'ext.json');
            res = util.mfsReadJson(this.fs, file);
        } catch (e) {
            return '';
        }
        if (res.extAppid !== undefined && !/^\d*$/.test(res.extAppid)) {
            throw new _errors.ConfigIllegal(`extAppid只包含数字, 配置的是: ${res.extAppid}`);
        }
        return res;
    }

    /**
     * preview operation
     * @param {Object} option for preview
     *      guiVersion {string} version of ide
     *      path {string} optional, tp related
     *      extData {string} optional, tp realted
     *      extra {Object} optional, would be append to app.json while bundle
     * @return {Object} promise
     */
    preview(option = {}) {
        let self = this;
        let tmpFs = new _memoryFs2.default();
        let extInfo = this.getExtInfo() || {};
        let extra = option.extra || {};
        if (this.projectInfo) {
            extra.setting = extra.setting || {};
            extra.setting.urlCheck = this.projectInfo.urlCheck !== false;
        }
        let onProgress = this.getHookFun('preview', 'progress');
        let onError = this.getHookFun('preview', 'error');
        let resolve;
        let reject;
        let p = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        onProgress('compile');
        this.allSlaveValid((() => {
            var _ref2 = _asyncToGenerator(function* (stats) {
                try {
                    self.uglify(tmpFs, uglifyOutputDir, option);
                    option.imgCompress && (yield (0, _imagemin.imageminWithMemoryFs)(tmpFs, uglifyOutputDir));
                } catch (e) {
                    console.log(e);
                }
                onProgress('compileEnd', null, {});
                onProgress('bundle');
                let bundle = new _bundle2.default(tmpFs, uglifyOutputDir, self.projectInfo.appId, extra);
                let bundleInfo;
                try {
                    bundleInfo = yield bundle.pack(option.pkgInfoData || {}, { pluginPages: self.getPluginPages() });
                } catch (e) {
                    onError('bundle', e);
                    return reject(e);
                }
                let md5Info = { 'file_main': bundleInfo.md5 };
                bundleInfo.path.sub.reduce(function (pre, cur) {
                    const key = _path2.default.basename(cur.path, cur.ext);
                    pre[key] = cur.md5;
                    return pre;
                }, md5Info);
                onProgress('upload', null, { fileSize: bundleInfo.fileSize });
                try {
                    self.sizeLimit(bundleInfo.fileSize);
                } catch (e) {
                    onError('upload', e);
                    return reject(e);
                }
                let uploader = new _uploader2.default(tmpFs, self.userInfo, self.projectInfo, self.globalSetting, extInfo, option);
                let res;
                if (option.diskPath) {
                    try {
                        res = yield uploader.writeToDisk(option.diskPath, md5Info, bundleInfo);
                    } catch (e) {
                        onError('upload', e);
                    }
                    resolve(res);
                    return;
                }
                try {
                    res = yield uploader.previewUpload(md5Info, bundleInfo, option);
                } catch (e) {
                    onError('upload', e);
                    return reject(e);
                }
                // swan upload and sign merge inot one api, keep this progress but do nothing
                onProgress('sign');
                let previewRes = Object.assign({}, res, {
                    path: bundleInfo.path,
                    md5: md5Info,
                    fileSize: bundleInfo.fileSize
                });
                if (previewRes.detail && previewRes.detail['web_package_id']) {
                    self.webPackageId = previewRes.detail['web_package_id'];
                    self.supportWebOptimize = true;
                } else {
                    self.supportWebOptimize = false;
                }
                resolve(previewRes);
            });

            return function (_x3) {
                return _ref2.apply(this, arguments);
            };
        })());
        return p;
    }

    /**
     * publish operation
     * @param {*} version publish version
     * @param {*} option publish option
     *      guiVersion {string} version of ide
     *      path {string} optional, tp related
     *      extData {string} optional, tp realted
     *      extra {Object} optional, would be append to app.json while bundle
     *      compileArgs {Array} optional, web compile arguments
     *      content {string} optional, would be append to upload request
     * @return {Object} res
     */
    publish(version, option = {}, isPlugin) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            const { content = '', compileArgs = [], extra } = option;
            let onProgress = _this2.getHookFun('publish', 'progress');
            let onError = _this2.getHookFun('publish', 'error');
            let self = _this2;
            const generateWebBundlePromise = (() => {
                var _ref3 = _asyncToGenerator(function* () {
                    return false;
                });

                return function generateWebBundlePromise() {
                    return _ref3.apply(this, arguments);
                };
            })();
            let tmpFs = new _memoryFs2.default();
            let extInfo = _this2.getExtInfo() || {};
            const generateSwanBundlePromise = function () {
                let resolve;
                let reject;
                let p = new Promise(function (res, rej) {
                    resolve = res;
                    reject = rej;
                });
                _this2.allSlaveValid((() => {
                    var _ref4 = _asyncToGenerator(function* (stats) {
                        self.uglify(tmpFs, uglifyOutputDir, option);
                        try {
                            option.imgCompress && (yield (0, _imagemin.imageminWithMemoryFs)(tmpFs, uglifyOutputDir));
                        } catch (e) {
                            util.log(e.message, 'warn');
                        }
                        onProgress('compileEnd', null, {});
                        onProgress('bundle');
                        let bundle = new _bundle2.default(tmpFs, uglifyOutputDir, self.projectInfo.appId, extra);
                        let bundleInfo;
                        try {
                            bundleInfo = yield bundle.pack(option.pkgInfoData || {}, { pluginPages: _this2.getPluginPages() });
                        } catch (e) {
                            onError('bundle', e);
                            return reject(e);
                        }
                        return resolve(bundleInfo);
                    });

                    return function (_x4) {
                        return _ref4.apply(this, arguments);
                    };
                })());
                return p;
            };
            onProgress('compile');
            let output = {};
            let webBundleMsg = '';
            let md5Info = {};
            let bundleInfo;
            try {
                const [appBundleInfo, webBundleInfo] = yield Promise.all([generateSwanBundlePromise(), generateWebBundlePromise()]);
                bundleInfo = appBundleInfo;
                output.release = bundleInfo.path.release;
                if (!webBundleInfo) {
                    // do nothing
                } else if (webBundleInfo.errMsg) {
                    webBundleMsg = webBundleInfo.errMsg;
                } else {
                    bundleInfo.path.web = webBundleInfo.release;
                    output.web = webBundleInfo.output;
                    md5Info = {
                        'file_web': webBundleInfo.md5
                    };
                }
                md5Info['file_main'] = bundleInfo.md5;
                bundleInfo.path.sub.reduce(function (pre, cur) {
                    const key = _path2.default.basename(cur.path, cur.ext);
                    pre[key] = cur.md5;
                    return pre;
                }, md5Info);
            } catch (e) {
                return Promise.reject(e);
            }
            onProgress('upload', null, { fileSize: bundleInfo.fileSize });
            try {
                self.sizeLimit(bundleInfo.fileSize);
            } catch (e) {
                onError('upload', e);
                return Promise.reject(e);
            }
            let uploader = new _uploader2.default(tmpFs, self.userInfo, self.projectInfo, self.globalSetting, extInfo, option);
            let extformData = {
                version,
                content,
                'web_package_sign_msg': webBundleMsg
            };
            if (isPlugin) {
                extformData.minSwanVersion = option.minSwanVersion || '';
            }
            if (bundleInfo.path.web) {
                extformData['file_web'] = (0, _fs.createReadStream)(bundleInfo.path.web);
                extformData['file_web'].path = bundleInfo.path.web;
            }
            let res;
            if (option.diskPath) {
                try {
                    res = yield uploader.writeToDisk(option.diskPath, md5Info, bundleInfo, extformData['file_web']);
                } catch (e) {
                    onError('upload', e);
                }
                return res;
            }
            try {
                res = yield uploader.publishUpload(md5Info, bundleInfo, extformData);
            } catch (e) {
                onError('upload', e);
                return Promise.reject(e);
            }
            return {
                output,
                path: bundleInfo.path,
                detail: res,
                md5: md5Info,
                fileSize: bundleInfo.fileSize
            };
        })();
    }

    /**
     * web preview operation
     * @param {Object} option web preview option
     *      guiVersion {string} version of ide
     *      path {string} optional, tp related
     *      extra {Object} optional, would be append to app.json while bundle
     *      compileArgs {Array} optional, web compile arguments
     * @return {Object} res
     */
    webPreview(option = {}) {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            const { compileArgs = [] } = option;
            let onProgress = _this3.getHookFun('webPreview', 'progress');
            let onError = _this3.getHookFun('webPreview', 'error');
            let extInfo = _this3.getExtInfo() || {};
            let res;
            let uploader = new _uploader2.default(null, _this3.userInfo, _this3.projectInfo, _this3.globalSetting, extInfo, option);
            let release;
            let md5;
            if (_this3.supportWebOptimize) {
                if (_this3.webPackageId) {
                    res = {};
                    res['package_id'] = _this3.webPackageId;
                } else {
                    try {
                        if (_this3.busy.preview) {
                            yield _this3.busy.preview;
                        } else {
                            yield _this3.preview(option);
                        }
                    } catch (e) {
                        onError(e);
                        throw e;
                    }
                    if (!_this3.webPackageId) {
                        let e = new Error('获取WEB预览id失败, 请先进行APP预览，成功后再尝试WEB化预览');
                        onError(e);
                        throw e;
                    }
                    res = {};
                    res['package_id'] = _this3.webPackageId;
                }
            } else {
                let webCompileRes;
                try {
                    webCompileRes = yield (0, _webCompile.devWebCompile)({
                        compileArgs: compileArgs,
                        compileInfo: { 'app_key': _this3.projectInfo['app_key'] },
                        onProgress,
                        onError
                    });
                } catch (e) {
                    throw e;
                }
                release = webCompileRes.release;
                md5 = webCompileRes.md5;
                onProgress('upload');
                try {
                    res = yield uploader.webPreviewUpload({ 'file_web': md5 }, { 'file_web': (0, _fs.createReadStream)(release) });
                } catch (e) {
                    onError('upload', e);
                    throw e;
                }
            }
            onProgress('sign');
            let signRes;
            try {
                signRes = yield uploader.webPreviewSign(res, option);
            } catch (e) {
                onError('sign', e);
                throw e;
            }
            let previewRes = Object.assign({}, signRes, { release, md5 });
            return previewRes;
        })();
    }

    dynamicLibPublish(options = {}) {
        var _this4 = this;

        return _asyncToGenerator(function* () {
            let { diskPath } = options;
            let p = new Promise(function (resolve, reject) {
                if (!global.SWAN_CLI_ARGV.DYNAMIC_LIB_ROOT) {
                    return reject(new Error('options error'));
                }
                _this4.wdm.waitUntilValid((() => {
                    var _ref5 = _asyncToGenerator(function* (stats) {
                        let dynamicLibCompiler = _this4.wdm.context.compiler.compilers.find(function (v) {
                            return v.name === 'dynamicLib';
                        });
                        if (dynamicLibCompiler) {
                            let mfsPath = dynamicLibCompiler.outputPath;
                            let bundle = new _bundle2.default(_this4.fs, uglifyOutputDir, _this4.projectInfo.appId);
                            if (diskPath) {
                                bundle.dynamicLibToDisk(mfsPath, diskPath).then(function (res) {
                                    resolve(res);
                                }).catch(function (e) {
                                    reject(e);
                                });
                            } else {
                                let zipPath = _path2.default.resolve('/tmp', Math.random().toString().slice(-8));
                                yield bundle.copyFileAndZip(mfsPath, zipPath);
                                let uploader = new _uploader2.default(_this4.fs, _this4.userInfo, _this4.projectInfo, _this4.globalSetting, {}, options);
                                uploader.dynamicLibUpload(zipPath, dynamicLibCompiler.dynamicLibName).then(function (res) {
                                    resolve(res);
                                }).catch(function (e) {
                                    reject(e);
                                });
                            }
                        } else {
                            reject(new Error('no dynamic lib to publish'));
                        }
                    });

                    return function (_x5) {
                        return _ref5.apply(this, arguments);
                    };
                })());
            });
            return p;
        })();
    }

    compileOutputToDisk(options = {}) {
        var _this5 = this;

        let { diskPath } = options;
        let tmpFs = new _memoryFs2.default();
        let p = new Promise((resolve, reject) => {
            this.allSlaveValid((() => {
                var _ref6 = _asyncToGenerator(function* (status) {
                    _this5.uglify(tmpFs, uglifyOutputDir, { ignoreUglify: options.ignoreUglify });
                    let bundle = new _bundle2.default(tmpFs, uglifyOutputDir);
                    bundle.compileOutputToDisk(diskPath).then(resolve).catch(reject);
                });

                return function (_x6) {
                    return _ref6.apply(this, arguments);
                };
            })());
        });
        return p;
    }

    pluginPublish(version, options = {}) {
        var _this6 = this;

        return _asyncToGenerator(function* () {
            let res = yield _this6.publish(version, options, true);
            return res;
        })();
    }

    pluginDocPublish(options) {
        var _this7 = this;

        return _asyncToGenerator(function* () {
            let tmpFs = new _memoryFs2.default();
            _this7.uglify(tmpFs, uglifyOutputDir, options);
            let bundle = new _bundle2.default(tmpFs, uglifyOutputDir, _this7.projectInfo.appId);
            let releasePath = yield bundle.packPluginDoc();
            let uploader = new _uploader2.default(tmpFs, _this7.userInfo, _this7.projectInfo, _this7.globalSetting, _this7.getExtInfo() || {}, options);
            let result = yield uploader.pluginDocUpload(releasePath);
            return result;
        })();
    }

    /**
     * do uglify with cache
     * @param {Object} outputFs uglified files & files to be pack store into this fs
     * @param {string} outputPath target root path of these files
     * @param {Object} option uglify option
     */
    uglify(outputFs, outputPath, option = {}) {
        let self = this;
        let newUglifyCache = {};
        let webpackOutput = self.wdm.context.compiler.outputPath;
        this.matcher(self.wdm.context.compiler.outputPath, (file, stats) => {
            let assetName = _path2.default.relative(webpackOutput, file);
            // exclude files of swan-js
            if (/^globals\//.test(assetName)) {
                return;
            }
            let src = _path2.default.resolve(webpackOutput, assetName);
            let trg = _path2.default.resolve(outputPath, assetName);
            try {
                util.mfsEnsureDirSync(outputFs, _path2.default.dirname(trg));
            } catch (e) {
                console.log(e);
            }
            let extName = _path2.default.extname(src);
            if (extName === '.js' && !option.ignoreUglify) {
                // uglify js files
                let chunk;
                let chunkName = assetName.replace(/\.js$/, '');
                if (_path2.default.extname(chunkName) === '.swan') {
                    chunk = self.webpackStats.chunkMap.slave[chunkName];
                } else {
                    chunk = self.webpackStats.chunkMap.master[chunkName];
                }
                // uglify
                let cache = chunk && self.uglifyCache[chunk.hash];
                let content;
                if (cache) {
                    // hit cache
                    content = cache;
                } else {
                    // miss cache
                    let res = _uglifyJs2.default.minify(self.fs.readFileSync(src, 'utf8'));
                    res.error ? util.log(res.error, 'error') : util.log(`Compressing ${src} ...`);
                    content = res.code;
                }
                chunk && (newUglifyCache[chunk.hash] = content);
                outputFs.writeFileSync(trg, content, { encoding: 'utf8' });
            } else {
                // copy other filesk
                outputFs.writeFileSync(trg, self.fs.readFileSync(src));
            }
        });
        self.uglifyCache = newUglifyCache;
    }

    /**
     * walk throw fs of manager instance
     * @param {string} dir root path
     * @param {Function} callback cb function
     */
    matcher(dir, callback) {
        let fs = this.fs;
        let stats = fs.statSync(dir);
        let self = this;
        if (stats.isDirectory()) {
            let files = fs.readdirSync(dir);
            files.forEach(file => {
                self.matcher(_path2.default.resolve(dir, file), callback);
            });
        } else if (stats.isFile()) {
            callback(dir, stats);
        }
    }

    infoMissing() {
        if (!this.userInfo || !this.userInfo.cookie) {
            return '缺少用户信息';
        }
        if (!this.projectInfo || !this.projectInfo.appId || !this.projectInfo['app_key']) {
            return '缺少项目信息';
        }
    }

    /**
     * check pkg size befor upload
     */
    sizeLimit(fileSize) {
        class PackageSizeOverrun extends Error {
            constructor({ name, size, limit }) {
                let sizeInM = (size / 1024 / 1024).toFixed(2);
                let limitInM = (limit / 1024 / 1024).toFixed(2);
                super(`${name}大小${sizeInM}M, 超过限制${limitInM}M`);
                this.name = `PackageSizeOverrun`;
                Error.captureStackTrace(this, PackageSizeOverrun);
                Object.defineProperty(this, 'message', { enumerable: true });
                this.level = 1;
            }
        }
        if (!this.projectInfo || !this.projectInfo.fullPackageMaxSize || !fileSize || !fileSize.main) {
            return;
        }
        if (fileSize.main > this.projectInfo.mainPackageMaxSize) {
            throw new PackageSizeOverrun({
                name: '主包',
                size: fileSize.main,
                limit: this.projectInfo.mainPackageMaxSize
            });
        }
        Object.keys(fileSize.sub).forEach(v => {
            if (fileSize.sub[v] > this.projectInfo.subPackageMaxSize) {
                throw new PackageSizeOverrun({
                    name: `子包"${v}"`,
                    size: fileSize.sub[v],
                    limit: this.projectInfo.subPackageMaxSize
                });
            }
        });
        let sum = Object.keys(fileSize.sub).reduce((s, v) => s += fileSize.sub[v], 0);
        sum += fileSize.main;
        if (sum > this.projectInfo.fullPackageMaxSize) {
            throw new PackageSizeOverrun({
                name: '总包',
                size: sum,
                limit: this.projectInfo.fullPackageMaxSize
            });
        }
    }
    getPluginPages() {
        let pagesFromPkg = this.pkgManager.getPluginPages();
        let pluginCompiler = this.wdm.context.compiler.compilers.find(v => v.name === 'plugin');
        let pagesFromSrc = pluginCompiler ? pluginCompiler.pluginPages : [];
        let result = util.unionArray(pagesFromPkg.concat(pagesFromSrc));
        return result;
    }
    getPluginInfo() {
        let pluginInfo = this.pkgManager.getUsedPluginInfoFromServer();
        let authPlugins = pluginInfo && pluginInfo.data && pluginInfo.data.authPlugins || [];
        let devPlugin = pluginInfo && pluginInfo.data && pluginInfo.data.devPlugin;
        let res = authPlugins.concat(devPlugin || []);
        res = res.map(plugin => ({
            plugin_id: plugin.pluginId, // eslint-disable-line
            domains: Object.keys(plugin.domain).reduce((res, type) => {
                res[type] = plugin.domain[type].map(v => v.replace(/^(https|http|wss):\/\//, ''));
                return res;
            }, {}),
            token: plugin.token
        }));
        return res;
    }
}
exports.default = compilerManager;