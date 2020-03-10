'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wrapper;

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _util = require('../util');

var util = _interopRequireWildcard(_util);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsZipper = require('fs-zipper');

var _fsZipper2 = _interopRequireDefault(_fsZipper);

var _stream = require('stream');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const tmpDir = _path2.default.resolve('/output'); /**
                                                   * @file remote debug middleware
                                                   * @author liuyuekeng
                                                   */

let zipBuffer;

function wrapper(context) {
    let { fs, outputPath, allSlaveValid, getProjectInfo, getPluginInfo } = context;
    function removeProtocolFromUrl(url) {
        return url.replace(/^(https|http|wss):\/\//, '');
    }
    function updateAppJson(tmpFs) {
        let projectInfo = getProjectInfo();
        let pluginInfo = getPluginInfo();
        if (!projectInfo && !pluginInfo.length) {
            return;
        }
        let appJsonPath = _path2.default.resolve(outputPath, 'app.json');
        let appJson;
        try {
            appJson = util.mfsReadJson(tmpFs, appJsonPath);
        } catch (e) {
            return;
        }
        appJson.setting = appJson.setting || {};
        if (projectInfo) {
            appJson.setting['swan_conf'] = appJson.setting['swan_conf'] || {};
            let domains = {};
            for (let key in projectInfo.domains || {}) {
                domains[key] = (projectInfo.domains[key] || []).map(removeProtocolFromUrl);
            }
            let web_view_domains = (projectInfo['web_view_domains'] || []).map(removeProtocolFromUrl); // eslint-disable-line
            Object.assign(appJson.setting['swan_conf'], {
                domains,
                web_action: projectInfo['web_action'], // eslint-disable-line
                web_view_domains // eslint-disable-line
            });
            appJson.setting.urlCheck = projectInfo.urlCheck !== false;
        }
        if (pluginInfo.length) {
            appJson['remote_debug_plugins'] = pluginInfo;
        }
        util.mfsWriteJson(tmpFs, appJsonPath, appJson);
    }
    return function remoteDebugMiddleware(req, res, next) {
        switch (req.path) {
            case '/build':
                {
                    let { level = 9, all = 'true' } = req.query;
                    all = 'true' === all;
                    let tmpFs = new _memoryFs2.default();
                    let types = [];
                    let files = [];
                    !all && req.body && ({ types, files } = req.body);
                    allSlaveValid(() => {
                        util.fsWalker(fs, outputPath, (dir, stats) => {
                            let relativePath = _path2.default.relative(outputPath, dir);
                            if (/^globals\//.test(relativePath)) {
                                return;
                            }
                            if (stats.isFile()) {
                                if (!all && types.indexOf(_path2.default.extname(relativePath).slice(1)) < 0 && files.indexOf(relativePath) < 0) {
                                    return;
                                }
                                let trg = _path2.default.join(tmpDir, relativePath);
                                let dirName = _path2.default.dirname(trg);
                                util.mfsEnsureDirSync(tmpFs, dirName);
                                util.mfsCopy(fs, dir, tmpFs, trg);
                            } else if (stats.isDirectory()) {
                                let trg = _path2.default.join(tmpDir, relativePath);
                                util.mfsEnsureDirSync(tmpFs, trg);
                            }
                        });
                        updateAppJson(tmpFs);
                        let archive = new _fsZipper2.default(tmpFs, { zlib: { level } });
                        let chunks = [];
                        let len = 0;
                        const output = new _stream.Writable({
                            write(chunk, encoding, callback) {
                                chunks.push(chunk);
                                len += chunk.length;
                                callback();
                            }
                        });
                        output.on('finish', () => {
                            zipBuffer = Buffer.concat(chunks, len);
                            res.status(200).send(`http://127.0.0.1:${global.SWAN_CLI_ARGV.PORT}/remote-debug-zip/get`);
                        });
                        archive.pipe(output);
                        archive.directory(tmpDir);
                        archive.finalize();
                    });
                    break;
                }
            case '/get':
                {
                    if (zipBuffer) {
                        res.set({
                            'Content-Type': 'application/zip',
                            'Content-Disposition': 'attachment; filename="remote-debug.zip"'
                        });
                        res.status(200).send(zipBuffer);
                    } else {
                        res.status(404).send('not ready');
                    }
                    break;
                }
            default:
                {
                    res.sendStatus(404);
                }
        }
    };
}