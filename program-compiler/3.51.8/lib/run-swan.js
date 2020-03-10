'use strict';

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _writeCacheFile = require('./write-cache-file');

var _writeCacheFile2 = _interopRequireDefault(_writeCacheFile);

var _statistics = require('./statistics');

var _statistics2 = _interopRequireDefault(_statistics);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _compilerManager = require('./compiler-manager');

var _compilerManager2 = _interopRequireDefault(_compilerManager);

var _compileCallback = require('./compile-callback');

var _compileCallback2 = _interopRequireDefault(_compileCallback);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { updateSlaveEntry } = require('./slave/index'); /**
                                                        * @license
                                                        * Copyright Baidu Inc. All Rights Reserved.
                                                        *
                                                        * This source code is licensed under the Apache License, Version 2.0; found in the
                                                        * LICENSE file in the root directory of this source tree.
                                                        *
                                                        * @file 更新swan-entry文件，按需编译swan文件
                                                        * @author zhuxin04
                                                        */

const {
    COMMAND,
    OUTPUT,
    WORK_PATH,
    IGNORE_CONFIG,
    IS_WATCH,
    PORT,
    DYNAMIC_LIB_ROOT,
    PLUGIN_ROOT
} = global.SWAN_CLI_ARGV;
const webpackConfig = require('./webpack-config/swan');
const compilerData = _statistics2.default.getInstance();
const entryStart = Date.now();

let configTasks = [];
let pluginEntryInstance;
let dynamicLibEntryInstance;
let entryInstance;
configTasks.push(webpackConfig);
if (DYNAMIC_LIB_ROOT) {
    const dynamicLibConfig = require('./webpack-config/dynamic');
    configTasks.push(dynamicLibConfig);
}
if (PLUGIN_ROOT) {
    const pluginConfig = require('./webpack-config/plugin');
    configTasks.push(pluginConfig);
}
Promise.all(configTasks).then(results => {
    let entryInstanceArr = [];
    let webpackConfig = [];
    const [master, slave, swanEntry] = results[0];
    entryInstance = swanEntry;
    webpackConfig.push(master);
    webpackConfig.push(slave);
    entryInstanceArr.push(entryInstance);
    if (DYNAMIC_LIB_ROOT) {
        const dynamicLibRs = results.find(rs => rs.config || {}.name === 'dynamicLib');
        dynamicLibEntryInstance = dynamicLibRs.entryInstance;
        webpackConfig.push(dynamicLibRs.config);
        entryInstanceArr.push(dynamicLibEntryInstance);
    }
    if (PLUGIN_ROOT) {
        const pluginRs = results.find(rs => rs.config || {}.name === 'plugin');
        pluginEntryInstance = pluginRs.entryInstance;
        webpackConfig.push(pluginRs.config);
        entryInstanceArr.push(pluginEntryInstance);
    }
    const compiler = (0, _webpack2.default)(webpackConfig);
    compiler.compilers.forEach(compiler => {
        if ('plugin' === compiler.name) {
            compiler.updateEntry = pluginUpdateEntry;
        }
    });
    const entryDuration = Date.now() - entryStart;
    compilerData.setValue('compileTime.entry', entryDuration);
    console.log('----生成entry目录共耗时-----', entryDuration / 1000, '秒');
    let doneCallback = (0, _compileCallback2.default)(compilerData, compiler, entryInstanceArr);
    if (!COMMAND.length) {
        util.compilationProgress('start');
        util.removeDir(OUTPUT);
        compiler.run(function (err, stats) {
            doneCallback(err, stats, false);
        });
    } else if (IS_WATCH) {
        util.compilationProgress('start');
        const watchOptions = {
            poll: 1000, // 当值为true时，值为5007，轮询时间较长
            ignored: ['node_modules']
        };
        if (IGNORE_CONFIG) {
            watchOptions.ignored.push(_path2.default.resolve(WORK_PATH, 'project.swan.json'));
        }
        if (PORT) {
            let compilerManager = new _compilerManager2.default(compiler, {
                port: PORT,
                workPath: WORK_PATH,
                watchOptions,
                compileCallback: doneCallback,
                entryInfo: { master, slave, entryInstance }
            });
            monitorWrokPath(compilerManager.fs, compilerManager.wdm.context.compiler.outputPath);
        } else {
            util.removeDir(OUTPUT);
            compiler.watch(watchOptions, function (err, status) {
                (0, _writeCacheFile2.default)();
                doneCallback(err, status, true);
            });
            monitorWrokPath();
        }
    } else {
        util.log('Unknown Command, Please try again!', 'error');
    }
});

function monitorWrokPath(myFs, myOutput) {
    let fs = myFs || _fs2.default;
    let output = myOutput || OUTPUT;
    const watchPatterns = ['**/*.js', '**/*.json', util.MEDIA_TYPE];
    _chokidar2.default.watch(watchPatterns, {
        cwd: WORK_PATH,
        ignoreInitial: true,
        interval: 1000,
        ignored: /node_modules/
    }).on('all', (event, filepath) => {
        triggerUpdate(event, filepath, fs, output, updateEntry);
    }).on('error', err => {
        console.log(err);
    });
    if (DYNAMIC_LIB_ROOT) {
        const watchPatterns = ['**/*.js', '**/*.json', util.MEDIA_TYPE];
        _chokidar2.default.watch(watchPatterns, {
            cwd: DYNAMIC_LIB_ROOT,
            ignoreInitial: true,
            interval: 1000,
            ignored: /node_modules/
        }).on('all', (event, filepath) => {
            triggerUpdate(event, filepath, fs, output, dynamicUpdateEntry);
        }).on('error', err => {
            console.log(err);
        });
    }
    if (PLUGIN_ROOT) {
        const watchPatterns = ['**/*.js', '**/*.json', util.MEDIA_TYPE];
        _chokidar2.default.watch(watchPatterns, {
            cwd: PLUGIN_ROOT,
            ignoreInitial: true,
            interval: 1000,
            ignored: /node_modules/
        }).on('all', (event, filepath) => {
            triggerUpdate(event, filepath, fs, output, pluginUpdateEntry);
        }).on('error', err => {
            console.log(err);
        });
    }
}

function triggerUpdate(event, filepath, fs, output, cb) {
    let addEvents = ['addDir', 'add'];
    let rmEvents = ['unlinkDir', 'unlink'];
    if (/\.json$/.test(filepath) && event === 'change' && filepath !== 'project.swan.json') {
        cb({ type: 'jsonChange', path: filepath });
    } else if (/\.(json|js)$/.test(filepath) && addEvents.concat(rmEvents).indexOf(event) > -1) {
        cb();
    } else if (addEvents.indexOf(event) > -1) {
        cb();
    } else if (rmEvents.indexOf(event) > -1) {
        // remove media files from output
        let targetPath = _path2.default.join(output, filepath);
        fs.stat(targetPath, (err, stats) => {
            if (!err && stats.isFile()) {
                fs.unlink(targetPath, () => {});
            }
        });
        cb();
    }
}

function updateEntry(changeInfo) {
    if (changeInfo && changeInfo.type === 'jsonChange') {
        // 当更改json文件时，写swan-entry文件
        try {
            updateSlaveEntry(_path2.default.join(WORK_PATH, changeInfo.path));
        } catch (e) {}
    }
    entryInstance.errors = [];
    entryInstance.warnings = [];
    entryInstance.getEntry().then();
}

function dynamicUpdateEntry() {
    dynamicLibEntryInstance.errors = [];
    dynamicLibEntryInstance.warnings = [];
    dynamicLibEntryInstance.getEntry().then();
}

function pluginUpdateEntry() {
    pluginEntryInstance.errors = [];
    pluginEntryInstance.warnings = [];
    pluginEntryInstance.getEntry().then();
}