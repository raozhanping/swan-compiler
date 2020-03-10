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

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @file remote debug middleware
 * @author liuyuekeng
 */

const tmpDir = _path2.default.resolve('/output');
let zipBuffer;

function wrapper(context) {
    let { fs, outputPath, allSlaveValid, getPluginInfo, getProjectInfo } = context;
    function updateAppJson(tmpFs) {
        let pluginInfo = getPluginInfo();
        let projectInfo = getProjectInfo();
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
            appJson.setting.urlCheck = projectInfo.urlCheck !== false;
        }
        if (pluginInfo.length) {
            appJson['remote_debug_plugins'] = pluginInfo;
        }
        util.mfsWriteJson(tmpFs, appJsonPath, appJson);
    }
    return function adbDebugMiddleware(req, res, next) {
        switch (req.path) {
            case '/build':
                {
                    let tmpFs = new _memoryFs2.default();
                    let preloadFileSrc = req.query.adbCloudPath;
                    let cliRoot = process.env.SWAN_IDE_CLI_ROOT || _path2.default.join(_os2.default.homedir(), '.swan-cli');
                    if (preloadFileSrc.indexOf(cliRoot) !== 0) {
                        res.status(500).send('invalid adbCloudPath');
                        return;
                    }
                    let preloadFileTrg = Math.random().toString().slice(-8);
                    allSlaveValid(() => {
                        util.fsWalker(fs, outputPath, (nodePath, stats) => {
                            let relativePath = _path2.default.relative(outputPath, nodePath);
                            if (/^globals\//.test(relativePath)) {
                                return;
                            }
                            if (stats.isFile()) {
                                let trg = _path2.default.join(tmpDir, relativePath);
                                let dir = _path2.default.dirname(trg);
                                util.mfsEnsureDirSync(tmpFs, dir);
                                util.mfsCopy(fs, nodePath, tmpFs, trg);
                            } else if (stats.isDirectory()) {
                                let trg = _path2.default.join(tmpDir, relativePath);
                                util.mfsEnsureDirSync(tmpFs, trg);
                            }
                        });
                        util.copyFromFsToMemoryFs(tmpFs, preloadFileSrc, _path2.default.join(tmpDir, preloadFileTrg));
                        updateAppJson(tmpFs);
                        let archive = new _fsZipper2.default(tmpFs, { zlib: { level: 9 } });
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
                            res.json({
                                url: `http://127.0.0.1:${global.SWAN_CLI_ARGV.PORT}/adb-debug-zip/get`,
                                dirName: preloadFileTrg
                            });
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
                            'Content-Disposition': 'attachment; filename="adb-debug.zip"'
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