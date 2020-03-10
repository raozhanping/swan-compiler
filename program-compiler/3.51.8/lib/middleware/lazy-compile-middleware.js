'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wraper;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _slave = require('../slave');

var _util = require('../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class CallbackQueue {
    constructor(callbacks) {
        if (typeof callbacks === 'function') {
            this.callbacks = [callbacks];
        } else if (Array.isArray(callbacks)) {
            this.callbacks = callbacks;
        } else {
            this.callbacks = [];
        }
    }
    run(...args) {
        // some callback function would invoke rm method
        // so, keep the copy of callbacks first
        let list = this.callbacks.slice(0);
        list.forEach(cb => cb(...args));
    }
    push(cb) {
        this.callbacks.push(cb);
    }
    rm(fun) {
        let i = this.callbacks.findIndex(v => v === fun);
        i > -1 && this.callbacks.splice(i, 1);
    }
} /**
   * @file lazy compile middleware
   * @author liuyuekeng
   */

function wraper(context) {
    let {
        fs,
        outputPath,
        workPath,
        entryInstance,
        logger
    } = context;
    let compileCallbacks = new CallbackQueue();
    function reqToAsset(req) {
        let base = outputPath;
        if (/^[A-Za-z]:/.test(outputPath)) {
            base = outputPath.replace(/^[A-Za-z]:/, '').replace(/\\+/g, '/');
        }
        let asset = _path2.default.relative(base, req.path);
        asset = _path2.default.resolve(workPath, asset).replace(/\.js$/, '');
        return asset;
    }
    function assetToOutputFile(asset) {
        let chunkName = assetToChunk(asset);
        let outputFile = _path2.default.resolve(outputPath, chunkName);
        return outputFile.replace(/\.swan$/, '.swan.js');
    }
    function assetToChunk(asset) {
        return _path2.default.relative(workPath, asset);
    }
    function chunkToAsset(chunk) {
        let res = _path2.default.resolve(workPath, chunk);
        res = (0, _util.formatPath)(res);
        return res;
    }
    function isSwanAsset(asset) {
        asset = (0, _util.formatPath)(asset);
        let hit = entryInstance.pageSwanAssets[asset];
        return !!hit;
    }
    function isSwanAssetLoaded(asset) {
        asset = (0, _util.formatPath)(asset);
        let slaveEntry = (0, _slave.getSlaveEntry)();
        return !!slaveEntry[asset];
    }
    function loadSwan(assets) {
        if (!Array.isArray(assets)) {
            assets = [assets];
        }
        assets = assets.filter(asset => isSwanAsset(asset));
        if (!assets.length) {
            return Promise.resolve({ alreadyDone: true });
        } else {
            let checkList = assets.map(asset => ({
                chunkName: assetToChunk(asset),
                outputFile: assetToOutputFile(asset)
            }));
            let p = loadSwanPromise(checkList);
            let toUpdate = assets.filter(asset => !isSwanAssetLoaded(asset));
            if (toUpdate.length) {
                (0, _slave.updateSlaveEntry)(toUpdate);
            }
            return p;
        }
    }
    let currentIdleCompile = null;
    function loadAllSwan() {
        let notLoaded = getnotLoadedSwan();
        let start = Date.now();
        logger('loadAllSwan', null, { notLoaded });
        let pending;
        if (notLoaded.length === 0 && currentIdleCompile) {
            pending = currentIdleCompile;
        } else {
            finishIdleCompile();
            pending = loadSwan(notLoaded);
        }
        return pending.then(() => {
            logger('loadAllSwanEnd', null, { notLoaded, cost: Date.now() - start });
        });
    }
    function loadSwanPromise(checkList) {
        let preCheck = false;
        try {
            preCheck = checkList.every(v => fs.statSync(v.outputFile));
        } catch (e) {
            preCheck = false;
        }
        if (preCheck) {
            return Promise.resolve({ alreadyDone: true });
        }
        return new Promise((resolve, reject) => {
            let callback = (err, slaveStats) => {
                if (err) {
                    return;
                }
                let check = false;
                try {
                    check = checkList.every(v => slaveStats.assetsByChunkName[v.chunkName]
                    // memory-fs run in ram, sync method do no damage to performance
                    && fs.statSync(v.outputFile));
                } catch (e) {
                    check = false;
                }
                if (check) {
                    resolve();
                    compileCallbacks.rm(callback);
                }
            };
            compileCallbacks.push(callback);
        });
    }
    function getnotLoadedSwan() {
        let slaveEntry = (0, _slave.getSlaveEntry)();
        let allSwanAssets = entryInstance.pageSwanAssets;
        let notLoaded = Object.keys(allSwanAssets).filter(asset => !slaveEntry[asset]);
        // allways do index page first
        if (global.SWAN_CLI_ARGV.INDEX_PAGE) {
            let indexPage = _path2.default.resolve(workPath, global.SWAN_CLI_ARGV.INDEX_PAGE) + '.swan';
            indexPage = (0, _util.formatPath)(indexPage);
            let i = notLoaded.indexOf(indexPage);
            if (i > -1) {
                notLoaded.splice(i, 1);
                notLoaded.unshift(indexPage);
            }
        }
        return notLoaded;
    }
    function middleware(req, res, next) {
        let asset = reqToAsset(req);
        asset = (0, _util.formatPath)(asset);
        if (isSwanAsset(asset)) {
            let start = Date.now();
            logger('swanReq', null, { asset });
            idleTasks[asset] = true;
            loadSwan(asset).then(data => {
                logger('swanReqLoaded', null, {
                    asset,
                    alreadyDone: data && data.alreadyDone,
                    cost: Date.now() - start
                });
                next();
            })
            // ignore error, webpack-dev-middleware would handle this shit
            .catch(next);
            // some version of ide using wrong node,
            // which did not support "promise.finally"
            // .finally(next);
        } else {
            return next();
        }
    }
    let stopFlag = false;
    let firstTask = true;
    let idleTasks = {};
    let idleCompileFinished = false;
    function idleCompile() {
        const chunkSize = 3;
        function runTask() {
            let size = chunkSize;
            if (firstTask) {
                firstTask = false;
                size = 1;
            }
            let task = getnotLoadedSwan().slice(0, size);
            if (task.length > 0 && !stopFlag) {
                task.forEach(v => {
                    idleTasks[v] = true;
                });
                currentIdleCompile = loadSwan(task).then(() => {
                    currentIdleCompile = null;
                    logger('idleCompileChunk', null, task);
                    setTimeout(() => {
                        runTask();
                    }, 0);
                });
            } else {
                idleCompileFinished = true;
                logger('idleCompileFinish');
                return;
            }
        }
        runTask();
    }
    function finishIdleCompile() {
        stopFlag = true;
    }
    function isChunkInIdleCompileList(chunk) {
        return idleTasks[chunkToAsset(chunk)];
    }
    middleware.isChunkInIdleCompileList = isChunkInIdleCompileList;
    function isLoadedChunk(chunk) {
        let loadedAssets = (0, _slave.getSlaveEntry)();
        return loadedAssets[chunkToAsset(chunk)];
    }
    middleware.isLoadedChunk = isLoadedChunk;
    middleware.isIdleCompileFinished = () => idleCompileFinished;
    // let middleware know compile end, and pass new slaveStats
    // TODO: or give middleware the compiler instance ?
    let firstCallback = true;
    middleware.compileCallback = function (err, slaveStats) {
        if (firstCallback) {
            firstCallback = false;
            idleCompile();
        }
        slaveStats && compileCallbacks.run(err, slaveStats);
    };
    middleware.startIdleCompile = idleCompile;
    middleware.loadAllSwan = loadAllSwan;
    return middleware;
}