'use strict';

var _gaze = require('gaze');

var _gaze2 = _interopRequireDefault(_gaze);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _compileCallback = require('./compile-callback');

var _compileCallback2 = _interopRequireDefault(_compileCallback);

var _fs2 = require('fs');

var _fs3 = _interopRequireDefault(_fs2);

var _compilerManager = require('./compiler-manager');

var _compilerManager2 = _interopRequireDefault(_compilerManager);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _statistics = require('./statistics');

var _statistics2 = _interopRequireDefault(_statistics);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const compilerData = _statistics2.default.getInstance(); /**
                                                          * @license
                                                          * Copyright Baidu Inc. All Rights Reserved.
                                                          *
                                                          * This source code is licensed under the Apache License, Version 2.0; found in the
                                                          * LICENSE file in the root directory of this source tree.
                                                          *
                                                          * @file webpack编译启动文件
                                                          * @author zhuxin04
                                                          */

const {
    COMMAND,
    OUTPUT,
    WORK_PATH,
    IGNORE_CONFIG,
    PORT,
    BUILD_TYPE
} = global.SWAN_CLI_ARGV;

let entryInstanceArr = [];
let webpackConfig;
// web entry
let gengrateWebEntryInstance;
const entryStart = Date.now();
if (BUILD_TYPE === 'swan') {
    require('./run-swan');
} else if (BUILD_TYPE === 'web') {
    webpackConfig = require('./webpack-config/web');
    const GengrateEntry = require('./generate-entry/web').default;
    gengrateWebEntryInstance = GengrateEntry.getInstance();
    webpackConfig.then(({ config }) => {
        let compiler = (0, _webpack2.default)(config);
        startRun(compiler);
    });
}

function startRun(compiler, entryInstanceArr) {
    const callback = (0, _compileCallback2.default)(compilerData, compiler, entryInstanceArr);

    if (!COMMAND.length) {
        // 单次执行
        util.compilationProgress('start');
        util.removeDir(OUTPUT);
        compiler.run(function (err, status) {
            callback(err, status, false);
        });
    } else if (COMMAND.indexOf('watch') !== -1) {
        // watch 模式
        util.compilationProgress('start');
        const watchOptions = {
            poll: true
        };
        if (IGNORE_CONFIG) {
            watchOptions.ignored = [_path2.default.resolve(WORK_PATH, 'project.swan.json')];
        }
        util.removeDir(OUTPUT);
        compiler.watch(watchOptions, function (err, status) {
            callback(err, status, true);
        });
        watchJsNotInDependencyTree();
    } else {
        util.log('Unknown Command, Please try again!', 'error');
    }
}

function watchJsNotInDependencyTree(_fs = _fs3.default, _output = OUTPUT) {
    let fs = _fs || _fsExtra2.default;
    let output = _output || OUTPUT;
    const watchPatterns = ['**/*.js', '**/*.json', util.MEDIA_TYPE];
    const gazeInstance = new _gaze2.default(watchPatterns, {
        cwd: WORK_PATH,
        debounceDelay: 1000,
        interval: 1000
    }, function (error) {
        error && util.log(error, 'error');
    });
    gazeInstance.on('all', function (event, filepath) {
        const relativePath = _path2.default.relative(WORK_PATH, filepath);
        if (/\.json$/.test(filepath) && event === 'changed' && relativePath !== 'project.swan.json') {
            // 监听app.json变动，重新生成入口
            updateEntry();
        } else if (/\.(json|js)$/.test(_path2.default.extname(filepath)) && (event === 'added' || event === 'deleted')) {
            // 监听其他json，js增删，重新生成入口
            updateEntry();
        } else if (event === 'added') {
            // 媒体文件增
            updateEntry();
        } else if (event === 'deleted') {
            // 媒体文件删
            let targetPath = _path2.default.join(output, relativePath);
            fs.stat(targetPath, (err, stats) => {
                if (!err && stats.isFile()) {
                    fs.unlink(targetPath, () => {});
                }
            });
            updateEntry();
        }

        triggerUpdate(event, relativePath, filepath, fs, output, updateEntry);
    });
}

function triggerUpdate(event, relativePath, filepath, fs, output, cb) {
    if (/\.json$/.test(filepath) && event === 'changed' && relativePath !== 'project.swan.json') {
        // 监听app.json变动，重新生成入口
        cb();
    } else if (/\.(json|js)$/.test(_path2.default.extname(filepath)) && (event === 'added' || event === 'deleted')) {
        // 监听其他json，js增删，重新生成入口
        cb();
    } else if (event === 'added') {
        // 媒体文件增
        cb();
    } else if (event === 'deleted') {
        // 媒体文件删
        let targetPath = _path2.default.join(output, relativePath);
        fs.stat(targetPath, (err, stats) => {
            if (!err && stats.isFile()) {
                fs.unlink(targetPath, () => {});
            }
        });
        // generateEntriseInit();
        cb();
    }
}

function updateEntry() {
    if (BUILD_TYPE === 'web') {
        gengrateWebEntryInstance.init();
    }
}