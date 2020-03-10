'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (originContent) {
    const callback = this.async();
    try {
        const {
            workPath,
            type
        } = (0, _loaderUtils.getOptions)(this);
        const resourcePath = (0, _util.formatPath)(this.resourcePath);
        if (new RegExp((0, _util.formatPath)(workPath)).test(resourcePath)) {
            _fs2.default.stat(resourcePath, function (err, stats) {
                if (!err) {
                    const total = stats.size;
                    const key = `size.${type}`;
                    const size = compilerData.getValue(key);
                    compilerData.setValue(key, size + total);
                }
                callback(null, originContent);
            });
        } else {
            callback(null, originContent);
        }
    } catch (err) {
        callback(null, originContent);
    }
};

var _util = require('../util');

var _loaderUtils = require('loader-utils');

var _statistics = require('../statistics');

var _statistics2 = _interopRequireDefault(_statistics);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 统计文件大小
 * @author yangjingjiu
 */

const compilerData = _statistics2.default.getInstance();