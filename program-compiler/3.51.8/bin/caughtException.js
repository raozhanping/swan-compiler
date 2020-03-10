/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 未知错误捕获
 * @author yangjingjiu
 */

function caughtException() {
    process.on('uncaughtException', function (err) {
        console.error(handleErrMsg(err, 0));
        process.exit(1);
    });

    process.on('unhandledRejection', function (err) {
        console.error(err);
    });
}

function handleErrMsg(err, type, level) {
    // level 表示错误级别，0 表示编译自身错误，1 表示用户代码导致错误
    const errObj = {
        method: 'err',
        errMsg: err.message,
        errStack: err.stack && err.stack.substring(0, 1000),
        type: type,
        level: level || 0
    };
    const strErrObj = JSON.stringify(errObj);
    return 'crash-' + strErrObj;
}

module.exports = {
    caughtException,
    handleErrMsg
};