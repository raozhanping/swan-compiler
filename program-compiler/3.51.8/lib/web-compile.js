'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

let webCompile = (() => {
    var _ref2 = _asyncToGenerator(function* (options, type) {
        let { onProgress, onError, compileArgs = [], compileInfo = {} } = options;
        let appKey = compileInfo.app_key;
        const defaultExt = { isWeb: true };
        let webOnProgress = function (state, ext = {}) {
            onProgress(state, null, Object.assign({}, defaultExt, ext));
        };
        let webOnError = function (state, error, ext = {}) {
            onError(state, error, Object.assign({}, defaultExt, ext));
        };
        /*
        let hit = getCache(appKey, compileArgs);
        if (hit) {
            webOnProgress('hitCache');
            return hit;
        }
        */
        webOnProgress('compile');
        let task = {};
        // let tmp = getProductionTask(compileArgs, type);
        let tmp;
        if (tmp) {
            webOnProgress('taskReuse');
            task = tmp;
        } else {
            task.type = type;
            task.promise = new Promise(function (resolve, reject) {
                task.startTime = Date.now();
                task.output = (0, _path.join)((0, _os.tmpdir)(), (0, _util.md5Str)(global.SWAN_CLI_ARGV.WORK_PATH), (0, _util.random)(), 'web');
                let args = ['--app-key', appKey, '--work-path', global.SWAN_CLI_ARGV.WORK_PATH, '--output', task.output, '--build-type', 'web'];
                args = args.concat(compileArgs);
                if (!args.includes('--module')) {
                    args = args.concat(['--module', global.SWAN_CLI_ARGV.MODULE]);
                }
                let nodePath = process.argv[0];
                let cwd = (0, _path.join)(__dirname, '..');
                let binPath;
                binPath = (0, _path.join)(__dirname, '../bin/index.js');
                task.cp = (0, _child_process.spawn)(nodePath, [binPath].concat(args));
                task.cp.stdout.setEncoding('utf8');
                task.cp.stdout.on('data', function (str) {
                    str.split(/\n|\r\n/).forEach(function (item) {
                        if (!item) {
                            return;
                        }
                        const [action, method, value] = parseStdout(item);
                        if (action === 'PROGRESS' && method.toUpperCase() === 'END') {
                            resolve({ value });
                        }
                    });
                });
                let lastError;
                task.cp.stderr.on('data', function (res) {
                    lastError = stderrHandler(res);
                });
                task.cp.on('exit', function (code) {
                    // 异常情况：code不为0或者null；code为0但没有调用end
                    reject(lastError || new ChildError(`unknown compile error, exit code: ${code}`));
                });
                /*
                process.nextTick(() => {
                    task.cp = cp;
                });
                */
            });
            task.promise.then(function () {
                clearProductionTask(compileArgs);
            });
            task.promise.catch(function () {
                clearProductionTask(compileArgs);
            });
            // some version of ide using wrong node,
            // which did not support "promise.finally"
            // task.promise.finally(() => {
            //     clearProductionTask(compileArgs);
            // });
        }
        markProductionTask(compileArgs, task);
        try {
            const data = yield task.promise;
            webOnProgress('compileEnd', data);
        } catch (error) {
            process.nextTick(function () {
                webOnError('compile', error);
            });
            return Promise.reject(error);
        }
        const releasePath = (0, _path.join)(task.output, '..', 'release', 'file_web.zip');
        let releaseInfo;
        webOnProgress('bundle');
        try {
            releaseInfo = yield zip(releasePath, task.output);
        } catch (e) {
            webOnError('bundle', e);
            return Promise.reject(e);
        }
        let webCompileRes = {
            output: task.output,
            release: releasePath,
            md5: releaseInfo.md5
        };
        updateCache(appKey, compileArgs, task.startTime, webCompileRes);
        return webCompileRes;
    });

    return function webCompile(_x3, _x4) {
        return _ref2.apply(this, arguments);
    };
})();

exports.clearCache = clearCache;
exports.invalidProductionTask = invalidProductionTask;
exports.devWebCompile = devWebCompile;
exports.preWebCompile = preWebCompile;
exports.proWebCompile = proWebCompile;

var _os = require('os');

var _path = require('path');

var _util = require('./util');

var _child_process = require('child_process');

var _fsExtra = require('fs-extra');

var _fs = require('fs');

var _archiver = require('archiver');

var _archiver2 = _interopRequireDefault(_archiver);

var _crypto = require('crypto');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const SEPARATOR = '__';

let cache = null;
let changeTime = Date.now();
/**
 * update web compile cache
 * @param {string} appKey appKey
 * @param {Array} compileArgs arguments
 * @param {number} startTime timestemp when compile started
 * @param {Object} data compile result
 */
function updateCache(appKey, compileArgs, startTime, data) {
    if (startTime > changeTime && (cache && startTime > cache.startTime || !cache)
    // only cache production output
    && compileArgs.indexOf('production') > -1) {
        cache = {
            appKey,
            compileArgs,
            startTime,
            data
        };
    }
}

function clearCache(time) {
    changeTime = Math.max(time, changeTime);
    if (cache && cache.startTime < changeTime) {
        cache = null;
        return true;
    }
    return false;
}

function getCache(appKey, compileArgs = []) {
    if (cache && appKey === cache.appKey && compileArgs.length === cache.compileArgs.length && compileArgs.every(arg => cache.compileArgs.indexOf(arg) > -1)) {
        return cache.data;
    } else {
        return false;
    }
}

let productionTask = null;
function invalidProductionTask() {
    if (productionTask && productionTask.type === 'pre') {
        productionTask.cp.kill();
        productionTask = null;
        return true;
    }
    return false;
}

function markProductionTask(compileArgs, task) {
    if (compileArgs.indexOf('production') > -1) {
        productionTask = task;
    }
}

function getProductionTask(compileArgs, type) {
    if (productionTask && compileArgs.indexOf('production') > -1) {
        if (type === 'pro') {
            productionTask.type = 'pro';
        }
        return productionTask;
    }
}

function clearProductionTask(compileArgs) {
    if (compileArgs.indexOf('production') > -1) {
        productionTask = null;
    }
}

function parseStdout(origin, length = 2) {
    const str = origin.trim();
    const indexArr = [];
    let current = 1;
    let start = 0;
    while (current < str.length) {
        if (str[current - 1] + str[current] === SEPARATOR) {
            indexArr.push([start, current - 1]);
            start = current + 1;
            current += 2;
            if (indexArr.length === length) {
                break;
            }
        } else {
            current += 1;
        }
    }
    indexArr.push([start]);
    return indexArr.reduce((pre, cur) => {
        const [start, end] = cur;
        // 编译信息中可能含有换行符，输出的时候，统一会 encode 一次
        pre.push(decodeURIComponent(str.slice(start, end)));
        return pre;
    }, []);
}

class ChildError extends Error {
    constructor(message, logFile) {
        super(message);
        this.logFile = logFile;
        this.name = 'ChildError';
        Error.captureStackTrace(this, ChildError);
    }
}

function stderrHandler(res) {
    let resStr = res;
    if (Buffer.isBuffer(res)) {
        resStr = res.toString('utf8');
    }
    let error = new ChildError(resStr);
    if (resStr.indexOf('crash-') === 0) {
        try {
            const data = JSON.parse(resStr.replace('crash-', ''));
            if (data.method === 'err') {
                error = new ChildError(data.errMsg);
                error.stack = data.errStack;
                error.level = data.level || 0;
            }
        } catch (e) {
            // noop
        }
    }
    return error;
}

const zip = (() => {
    var _ref = _asyncToGenerator(function* (target, source) {
        yield (0, _fsExtra.ensureFile)(target);
        let resolve;
        let reject;
        const p = new Promise(function (res, rej) {
            process.nextTick(function () {
                resolve = res;
                reject = rej;
            });
        });
        const output = (0, _fs.createWriteStream)(target);
        const archive = (0, _archiver2.default)('zip', { zlib: { level: 9 } });
        const hash = (0, _crypto.createHash)('md5');
        archive.on('data', function (data) {
            hash.update(data);
        });
        output.on('close', function () {
            resolve({ md5: hash.digest('hex'), path: target });
        });
        archive.on('warning', function (err) {
            return reject(err);
        });
        archive.on('error', function (err) {
            return reject(err);
        });
        archive.pipe(output);
        archive.directory(source, false);
        archive.finalize();
        return p;
    });

    return function zip(_x, _x2) {
        return _ref.apply(this, arguments);
    };
})();

function devWebCompile(options) {
    let compileArgs = options.compileArgs.indexOf('production') < 0 ? ['--web-env', 'development'].concat(options.compileArgs) : options.compileArgs.slice(0);
    return webCompile(Object.assign({}, options, { compileArgs }), 'dev');
}

function preWebCompile(options) {
    let compileArgs = options.compileArgs.indexOf('production') < 0 ? ['--web-env', 'production'].concat(options.compileArgs) : options.compileArgs.slice(0);
    return webCompile(Object.assign({}, options, { compileArgs }), 'pre');
}

function proWebCompile(options) {
    let compileArgs = options.compileArgs.indexOf('production') < 0 ? ['--web-env', 'production'].concat(options.compileArgs) : options.compileArgs.slice(0);
    return webCompile(Object.assign({}, options, { compileArgs }), 'pro');
}