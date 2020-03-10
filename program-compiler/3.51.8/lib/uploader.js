'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _constant = require('./constant');

var _errors = require('./errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @file upload file
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * @author liuyuekeng
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */


class Uploader {
    constructor(fs, user, projectInfo, globalSetting, extInfo, option) {
        this.fs = fs;
        this.user = user;
        this.projectInfo = projectInfo;
        this.globalSetting = globalSetting;
        this.extInfo = extInfo;
        this.option = option;
    }
    /*
    test(file) {
        let target = path.join(__dirname, '../test.zip');
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
        }
        let input = this.fs.createReadStream(file);
        let output = fs.createWriteStream(target);
        input.on('end', () => {
            console.log('input end');
        });
        output.on('finish', () => {
            console.log('output finish');
        });
        input.pipe(output);
    }
    */
    request(reqOptions) {
        var _this = this;

        return _asyncToGenerator(function* () {
            let cookie = _this.user.cookie;
            if (!cookie) {
                return Promise.reject(new _errors.ServerError({ errno: -1, errMsg: 'get request cookie fail' }));
            }
            let dispatched = 0;
            let uploadSpeed = [];
            let timer;
            try {
                let parmas = {
                    resolveWithFullResponse: true,
                    method: 'POST',
                    timeout: _constant.TIMEOUT,
                    json: true,
                    headers: { cookie }
                };
                Object.assign(parmas, reqOptions);
                if (_this.globalSetting && _this.globalSetting.proxy) {
                    Object.assign(parmas, {
                        proxy: _this.globalSetting.proxy,
                        rejectUnauthorized: false });
                }
                let task = (0, _requestPromise2.default)(parmas);
                timer = setInterval(function () {
                    let newDispatched;
                    try {
                        newDispatched = task.req.connection._bytesDispatched;
                    } catch (e) {}
                    if (newDispatched) {
                        uploadSpeed.push(newDispatched - dispatched);
                        dispatched = newDispatched;
                    } else {
                        uploadSpeed.push(null);
                    }
                }, 1000 * 1);
                let res = yield task;
                clearInterval(timer);
                if (res.statusCode === 200) {
                    if (res.body.errno === 0) {
                        return res.body.data;
                    }
                    return Promise.reject(new _errors.ServerError(res.body, uploadSpeed));
                }
                return Promise.reject(new _errors.ServerError({ errno: res.statusCode, errMsg: '' }, uploadSpeed));
            } catch (e) {
                clearInterval(timer);
                return Promise.reject(new _errors.ServerError({ errno: -1, errMsg: e.message }, uploadSpeed));
            }
        })();
    }
    previewUpload(md5Info, bundleInfo, option) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            let detail = yield _this2.upload(_constant.PREVIEW_URL, md5Info, bundleInfo);
            let { path, extData } = option;
            // TP 的 appKey 是通过上传接口发布会的
            let url = `${_constant.APP_SERVER_HOST_OLD}/mappconsole/api/packagescheme` + `?appKey=${detail['app_key']}&packageId=${detail['package_id']}`;
            path && (url += `&path=${encodeURIComponent(path)}`);
            extData && (url += `&ext=${extData}`);
            let res = { detail, url };
            return res;
        })();
    }
    webPreviewUpload(md5Info, extFormData) {
        return this.upload(_constant.WEB_PREVIEW_URL, md5Info, null, extFormData);
    }
    publishUpload(md5Info, bundleInfo, extFormData) {
        return this.upload(_constant.PUBLISH_URL, md5Info, bundleInfo, extFormData);
    }
    upload(url, md5Info, bundleInfo, extFormData = {}) {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            // copy file from menory to disk for debu
            // this.test(bundleInfo.path.main);
            let description = _this3.getDescription(md5Info, bundleInfo);
            let formData = {
                'appId': _this3.projectInfo.appId,
                'ext_appid': _this3.projectInfo.isTp ? _this3.extInfo.extAppid || '' : ''
            };
            Object.assign(formData, description);
            if (bundleInfo) {
                let fileMain = _this3.fs.createReadStream(bundleInfo.path.main);
                fileMain.path = bundleInfo.path.main;
                formData['file_main'] = fileMain;
                let subPackages = bundleInfo.path.sub.reduce(function (pre, cur) {
                    const key = _path2.default.basename(cur.path, cur.ext);
                    pre[key] = _this3.fs.createReadStream(cur.path);
                    pre[key].path = cur.path;
                    return pre;
                }, {});
                Object.assign(formData, subPackages);
                if (bundleInfo.path.plugin) {
                    formData['file_plugin'] = _this3.fs.createReadStream(bundleInfo.path.plugin);
                    formData['file_plugin'].path = bundleInfo.path.plugin;
                }
                if (bundleInfo.path.pluginDoc) {
                    formData['file_plugin_doc'] = _this3.fs.createReadStream(bundleInfo.path.pluginDoc);
                    formData['file_plugin_doc'].path = bundleInfo.path.pluginDoc;
                }
            }
            Object.assign(formData, extFormData);
            _this3.option && _this3.option.uploadPostData && Object.assign(formData, _this3.option.uploadPostData);
            if (_this3.option && _this3.option.uploadUrlQuery) {
                url += '?' + Object.keys(_this3.option.uploadUrlQuery).reduce(function (r, v) {
                    r.push(`${encodeURIComponent(v)}=${encodeURIComponent(_this3.option.uploadUrlQuery[v])}`);
                    return r;
                }, []).join('&');
            }
            let res = yield _this3.request({
                url: url,
                method: 'POST',
                timeout: 1000 * 60 * 10,
                formData
            });
            if (!res) {
                throw new _errors.ServerError({ errno: -3, errMsg: `response data is undefined(${url}).` });
            }
            return res;
        })();
    }
    dynamicLibUpload(filePath, dynamicLibName) {
        let file = this.fs.createReadStream(filePath);
        file.path = filePath;
        return this.request({
            url: _constant.DYNAMIC_LIB_UPLOAD_URL,
            method: 'POST',
            formData: {
                file_dynamic_lib: file, // eslint-disable-line
                app_id: this.projectInfo.appId, // eslint-disable-line
                dynamic_lib: dynamicLibName // eslint-disable-line
            }
        });
    }

    pluginDocUpload(docPkgPath) {
        var _this4 = this;

        return _asyncToGenerator(function* () {
            let formData = {};
            formData.pluginId = _this4.projectInfo.appId;
            formData['file_plugin_doc'] = _this4.fs.createReadStream(docPkgPath);
            formData['file_plugin_doc'].path = docPkgPath;
            let res = yield _this4.request({
                url: _constant.PLUGIN_DOC_URL,
                method: 'POST',
                formData
            });
            return res;
        })();
    }
    getDescription(md5Info, bundleInfo) {
        let res = {};
        res['swan_version'] = global.SWAN_CLI_ARGV.LIB_VERSION;
        res['tool_version'] = this.option.guiVersion || '';
        res['build_version'] = global.SWAN_CLI_ARGV.COMPILER_VERSION;
        res['package_md5'] = JSON.stringify(md5Info);
        bundleInfo && (res['package_struct'] = JSON.stringify(bundleInfo.path.sub.map(({ root, subPackageName }) => ({
            root,
            subPackageName
        }))));
        return res;
    }
    writeToDisk(diskPath, md5Info, bundleInfo, fileWeb) {
        let toDiskFileList = [];
        toDiskFileList.push({
            stream: this.fs.createReadStream(bundleInfo.path.main),
            name: 'file_main.zip'
        });
        if (fileWeb) {
            toDiskFileList.push({
                stream: fileWeb,
                name: 'file_web.zip'
            });
        }
        bundleInfo.path.sub.forEach(v => {
            toDiskFileList.push({
                stream: this.fs.createReadStream(v.path),
                name: _path2.default.basename(v.path)
            });
        });
        return Promise.all(toDiskFileList.map(v => {
            return new Promise((resolve, reject) => {
                let write = _fsExtra2.default.createWriteStream(_path2.default.resolve(diskPath, v.name));
                write.on('finish', resolve);
                v.stream.pipe(write);
            });
        }).concat(new Promise((resolve, reject) => {
            _fsExtra2.default.writeJSON(_path2.default.resolve(diskPath, 'description.json'), this.getDescription(md5Info, bundleInfo), err => {
                if (err) {
                    throw err;
                } else {
                    resolve();
                }
            });
        })));
    }
    webPreviewSign(res, option) {
        return this.sign(_constant.CHECK_WEB_PREVIEW_URL, res, option, 3000, 60, 3);
    }
    sign(host, res, option, timeout, run, signStatus) {
        var _this5 = this;

        return _asyncToGenerator(function* () {
            let detail;
            let webUrl;
            for (let i = 0; i < run; i += 1) {
                try {
                    webUrl = yield new Promise((() => {
                        var _ref = _asyncToGenerator(function* (resolve, reject) {
                            let error = new _errors.ServerError({ errno: -2, errMsg: 'TIMEOUT' });
                            const t = setTimeout(function () {
                                return reject(error);
                            }, timeout);
                            try {
                                detail = yield _this5.request({
                                    url: host,
                                    method: 'POST',
                                    form: {
                                        appId: _this5.projectInfo.appId,
                                        'ext_appid': _this5.projectInfo.isTp ? _this5.extInfo.extAppid || '' : '',
                                        packageId: res.package_id
                                    }
                                });
                                if (!detail) {
                                    throw new _errors.ServerError({ errno: -3, errMsg: `response data is undefined(${host}).` });
                                }
                            } catch (e) {
                                error = e;
                                return;
                            }
                            if (detail['sign_status'] === signStatus) {
                                clearTimeout(t);
                                resolve(detail.web_url);
                            } else {
                                error = new _errors.ServerError({ errno: +detail['sign_status'], errMsg: detail.message });
                            }
                        });

                        return function (_x, _x2) {
                            return _ref.apply(this, arguments);
                        };
                    })());
                } catch (e) {
                    if (i < run - 1) {
                        continue;
                    } else {
                        throw e;
                    }
                }
                break;
            }
            return {
                detail,
                url: webUrl
            };
        })();
    }
}
exports.default = Uploader;