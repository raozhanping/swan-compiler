/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 正式环境下的入口
 * @author zhuxin
 */

require('./base.setting');
const util = require('../lib/util');
const CompilerData = require('../lib/statistics').default;
const compilerData = CompilerData.getInstance();
const ce = require('./caughtException');
const handleErrMsg = ce.handleErrMsg;
const caughtException = ce.caughtException;

// 捕获未知错误
caughtException();

try {
    require('../lib/run');
} catch (err) {
    compilerData.setValue('errInfo.value', `${err.message}\n${err.stack}`, 'err');
    util.compilationProgress('err', compilerData.errStatisticsData);
    // 兼容新版打点方案
    const errMsg = handleErrMsg(err);
    console.error(errMsg);
    process.exit(1);
}
