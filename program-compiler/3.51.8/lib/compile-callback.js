'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wrapper;

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _writeCacheFile = require('./write-cache-file');

var _writeCacheFile2 = _interopRequireDefault(_writeCacheFile);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * build callback for compiling
 * @param {Object} compilerData instance of CompilerData
 * @param {Object} compiler webpack compiler
 * @param {Object} entryInstance optional, required while in build-type swan
 * @return {Function} callback function
 */
/**
 * @file do log and notification while compile finish
 */
function wrapper(compilerData, compiler, entryInstance = []) {
    if (!Array.isArray(entryInstance)) {
        entryInstance = [entryInstance];
    }
    let times = 0;
    return (err, stats, isWatch) => {
        if (entryInstance && entryInstance.length > 0) {
            entryInstance.forEach(v => {
                if (v.errors.length) {
                    v.errors.forEach(errorItem => {
                        util.log(errorItem, 'error');
                        if (!isWatch) {
                            errorItem = typeof errorItem === 'string' ? new Error(errorItem) : errorItem;
                            util.noWatchErrorNext(errorItem, 0, 1);
                        }
                    });
                    return;
                }
                if (v.warnings.length) {
                    v.warnings.forEach(errorItem => {
                        util.log(errorItem, 'warn');
                    });
                }
            });
        }
        if (err) {
            util.log(`${err.stack || err}`, 'error');
            if (err.details) {
                util.log(`${err.details}`, 'error');
            }
            return;
        }
        if (stats.hasErrors()) {
            handleStatsError(stats.toJson('normal'), isWatch);
            return;
        }
        times++;
        let compileTime = 0;
        try {
            compileTime = recordCompileCost(compilerData, stats, compiler, times).compileTime;
        } catch (err) {
            util.log(err);
        }
        util.compilationProgress('end', compilerData.normalStatisticsData);
        // 每次编译完统计数据文件大小清零
        compilerData.fileSizeClear();
        util.log(`编译耗时============ ${compileTime / 1000} s`);
        // 返回true代表发出compile.end事件
        return true;
    };
}
/**
 * handle stats error
 * @param {Object} stats webpack compile stats
 * @param {boolean} isWatch true if in watch model
 */
function handleStatsError(info, isWatch) {
    util.log(`${info.errors}`, 'error');
    const infoErrors = info.errors;
    const infoError = Array.isArray(infoErrors) && infoErrors[0];
    const err = new Error('user code Syntax Error');
    err.stack = infoError;
    if (!isWatch) {
        util.noWatchErrorNext(err, 0, 1);
    }
}
/**
 * record compile cost
 * @param {Object} compilerData instance of CompilerData
 * @param {*} stats webpack compile stats
 * @param {*} compiler webpack compiler
 * @param {*} times compile times
 * @return {Object} record
 */
function recordCompileCost(compilerData, stats, compiler, times) {
    let isMultipleStats = stats.stats;
    let compileTime = 0;
    if (isMultipleStats) {
        let multipleStats = stats;
        if (times === 1) {
            compileTime = multipleStats.stats.reduce((r, v) => r += v.endTime - v.startTime, compileTime);
            compilerData.setValue('compileTime.sum', compileTime);
        } else {
            const current = multipleStats.stats[0];
            compileTime = current.endTime - current.startTime;
            compilerData.setValue('compileTime.hot', compileTime);
            compilerData.setValue('compileTime.sum', 0);
            compilerData.setValue('compileMode', 'hot');
        }
        compilerData.setValue('compileTime.total', compileTime);
    } else {
        let { startTime, endTime } = stats;
        const compileTime = endTime - startTime;
        if (times === 1) {
            compilerData.setValue('compileTime.sum', compileTime);
        } else {
            compilerData.setValue('compileTime.hot', compileTime);
            compilerData.setValue('compileTime.sum', 0);
            compilerData.setValue('compileMode', 'hot');
        }
        compilerData.setValue('compileTime.total', compileTime);
    }
    return {
        compileTime
    };
}