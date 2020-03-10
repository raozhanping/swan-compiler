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

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @file remote debug middleware
 * @author liuyuekeng
 */

const tmpDir = _path2.default.resolve('/output');

let filePath = _path2.default.join(__dirname, '.ignore-web-compile');
try {
    let data = _fs2.default.readFileSync(filePath, { encoding: 'utf8' });
    global.TEST_IGNORE_WEB_COMPILE = data === 'on';
} catch (e) {
    global.TEST_IGNORE_WEB_COMPILE = false;
}

function wrapper(context) {
    let { fs, outputPath, allSlaveValid } = context;
    return function outputTestMiddleware(req, res, next) {
        let tmpFs = new _memoryFs2.default();
        switch (req.path) {
            case '/output':
                {
                    allSlaveValid(() => {
                        util.fsWalker(fs, outputPath, (dir, stats) => {
                            if (stats.isFile()) {
                                let relativePath = _path2.default.relative(outputPath, dir);
                                if (/^globals\//.test(relativePath)) {
                                    return;
                                }
                                let trg = _path2.default.join(tmpDir, relativePath);
                                let dirName = _path2.default.dirname(trg);
                                util.mfsEnsureDirSync(tmpFs, dirName);
                                util.mfsCopy(fs, dir, tmpFs, trg);
                            }
                        });
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
                            let zipBuffer = Buffer.concat(chunks, len);
                            res.set({
                                'Content-Type': 'application/zip',
                                'Content-Disposition': 'attachment; filename="output-test.zip"'
                            });
                            res.status(200).send(zipBuffer);
                        });
                        archive.pipe(output);
                        archive.directory(tmpDir);
                        archive.finalize();
                    });
                    break;
                }
            case '/ignore-web-compile':
                {
                    let { flag = 'off' } = req.query;
                    global.TEST_IGNORE_WEB_COMPILE = flag === 'on';
                    _fs2.default.writeFileSync(filePath, flag, { encoding: 'utf8' });
                    res.status(200).send('OK');
                    break;
                }
        }
    };
}