'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _statistics = require('../../statistics');

var _statistics2 = _interopRequireDefault(_statistics);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @file statistics time
 * @author yangjingjiu
 */

const compilerData = _statistics2.default.getInstance();
/* eslint-disable fecs-camelcase */
function getInterval(step, num) {
    const res = [];
    let accumulateNum = 0;
    for (let i = 0; i < num; i++) {
        accumulateNum = i * step;
        if (i === num - 1) {
            res.push(`${accumulateNum}-more`);
        } else {
            res.push(`${accumulateNum}-${accumulateNum + step - 1}`);
        }
    }
    return res;
}

class StatisticsTime {
    constructor(options) {
        this.workPath = options.workPath;
    }

    apply(compiler) {
        const moduleMap = new Map();
        const pathReg = new RegExp(this.workPath);
        // 不统计增量编译
        let buildTypeFlag = true;
        compiler.plugin('compilation', compilation => {
            compilation.plugin('build-module', module => {
                const userRequest = module.userRequest;
                if (pathReg.test(userRequest)) {
                    module.__start_time__ = Date.now();
                }
            });

            compilation.plugin('succeed-module', module => {
                const userRequest = module.userRequest;
                const nowTime = Date.now();
                const startTime = module.__start_time__;
                const isCache = module.__is_cache__;
                if (startTime) {
                    const usingTime = nowTime - startTime;
                    const filePathArr = userRequest.split('!');
                    const filePath = filePathArr[filePathArr.length - 1];
                    const historyTime = moduleMap.get(filePath);
                    if ((historyTime === undefined || historyTime < usingTime) && !isCache) {
                        moduleMap.set(filePath, usingTime);
                    }
                }
            });
        });

        compiler.plugin('after-emit', (compilation, callback) => {
            if (buildTypeFlag) {
                const initFlagObj = {};
                const intervalKeys = getInterval(500, 11);
                moduleMap.forEach((value, key) => {
                    const extname = _path2.default.extname(key);
                    // 区间统计文件compiler时间
                    const spliceKeys = `compilerSliceTime${extname}`;
                    let targetKeys;
                    const valueInt = Math.floor(value / 500);
                    if (!initFlagObj[extname]) {
                        intervalKeys.forEach(key1 => {
                            // 初始化数据
                            targetKeys = `${spliceKeys}.${key1}`;
                            compilerData.setValue(targetKeys, 0);
                        });
                        initFlagObj[extname] = true;
                    }
                    targetKeys = `${spliceKeys}.${intervalKeys[valueInt] || intervalKeys[intervalKeys.length - 1]}`;
                    const nums = compilerData.getValue(targetKeys);
                    compilerData.setValue(targetKeys, nums + 1);
                });
                buildTypeFlag = true;
            }
            console.log(compilerData._statisticsObj);
            callback();
        });
    }
}
exports.default = StatisticsTime; /* eslint-enable fecs-camelcase */