'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = writeToCache;
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file loader结果的磁盘缓存
 * @author zhuxin04
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const directories = new Set();
function writeToCache() {
    Object.keys(global.__CACHE_CONTENT__).forEach(key => {
        const content = global.__CACHE_CONTENT__[key];
        const dirname = path.dirname(key);
        if (directories.has(dirname)) {
            fs.writeFile(key, content, 'utf-8', () => {
                delete global.__CACHE_CONTENT__[key];
            });
        } else {
            mkdirp(dirname, mkdirErr => {
                if (mkdirErr) {
                    return;
                }
                directories.add(dirname);
                fs.writeFile(key, content, 'utf-8', () => {
                    delete global.__CACHE_CONTENT__[key];
                });
            });
        }
    });
}