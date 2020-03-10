'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 根据开发环境生成参数
 * @author yangjingjiu
 */

const {
    STATIC_PREFIX,
    WEB_ENV,
    APPKEY,
    WEB_STATIC_PATH
} = global.SWAN_CLI_ARGV;
const ONLINE_HOST = 'https://b.bdstatic.com/miniapp';

const outputOnlineName = {
    developerJs: 'developer_[hash:10].js',
    developerCss: 'developer_[hash:10].css',
    appJs: '[name]_[hash:10].js',
    copyMasterFile: 'master.js',
    copySlaveFile: 'slave.js',
    copyFrameCssFile: 'frame.css',
    copyFile: '[name]_[hash:10].[ext]'
};

const outputTestName = {
    developerJs: 'developer.js',
    developerCss: 'developer.css',
    appJs: '[name].js',
    copyMasterFile: 'master.js',
    copySlaveFile: 'slave.js',
    copyFrameCssFile: 'frame.css',
    copyFile: '[name].[ext]'
};
let staticPrefix = '';
let outputName;
switch (WEB_ENV) {
    case 'test':
    case 'tools':
        staticPrefix = STATIC_PREFIX;
        outputName = outputTestName;
        break;
    case 'development':
        staticPrefix = `${ONLINE_HOST}/webpackage/dev/${APPKEY}/`;
        outputName = outputOnlineName;
        break;
    case 'production':
    default:
        staticPrefix = `${ONLINE_HOST}/webpackage/${APPKEY}/`;
        outputName = outputOnlineName;
}

let webCorePath = _path2.default.resolve(__dirname, '../../node_modules/@baidu/swan-web');
if (WEB_STATIC_PATH) {
    webCorePath = WEB_STATIC_PATH;
}

const swanWebDistPath = _path2.default.resolve(webCorePath, 'package.json');
let version;
module.exports = new Promise((resolve, reject) => {
    if ('tools' === WEB_ENV) {
        _fsExtra2.default.readJson(swanWebDistPath).then(webPackageJson => {
            version = `v${webPackageJson.version}`;
            return _fsExtra2.default.readdir(_path2.default.resolve(webCorePath, 'dist/swan-web', version));
        }).then(webCoreFiles => {
            let webCoreFileupperLev = _path2.default.resolve(webCorePath, `dist/swan-web/${version}`);
            let webCoreFilePathObj = webCoreFiles.reduce((prev, current) => {
                if (current.startsWith('master')) {
                    prev.masterPath = _path2.default.resolve(webCoreFileupperLev, current);
                } else if (current.startsWith('slave')) {
                    prev.slavePath = _path2.default.resolve(webCoreFileupperLev, current);
                } else if (current.startsWith('frame')) {
                    prev.frameStyleCssPath = _path2.default.resolve(webCoreFileupperLev, current);
                }
                return prev;
            }, {});
            resolve({
                staticPrefix,
                outputName,
                webCorePath,
                swanWebDistPath,
                webCoreFilePathObj
            });
        }).catch(err => {
            reject(`收集白屏检测所需框架代码出错，${err}`);
        });
    } else {
        resolve({
            staticPrefix,
            outputName,
            webCorePath,
            swanWebDistPath
        });
    }
});