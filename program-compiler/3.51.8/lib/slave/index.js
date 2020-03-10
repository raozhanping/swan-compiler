'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 更新swan-entry文件，按需编译swan文件
 * @author zhuxin04
 */
const path = require('path');
const fs = require('fs-extra');
const util = require('./../util');
const async = require('async');
const { ENTRY_DIR_PATH, WORK_PATH } = global.SWAN_CLI_ARGV;
const slavePath = path.resolve(ENTRY_DIR_PATH, 'slave/swan-entry.js');
const { SPECIAL_COMPONENT_START } = require('../constant');
const SWAN_FILE = {};
const CACHED_JSON = {};

function getAssetPath(basePath, rawPath = '', deep) {
    let assetPath = '';
    if (path.isAbsolute(rawPath)) {
        assetPath = path.join(WORK_PATH, rawPath);
    } else {
        assetPath = path.join(path.dirname(basePath), rawPath);
        const isSpecialComponents = SPECIAL_COMPONENT_START.findIndex(i => rawPath.startsWith(i)) > -1;
        if (deep && !fs.existsSync(assetPath) && !isSpecialComponents) {
            const notExtUserPath = rawPath.replace(/\.swan$/, '');
            assetPath = util.findInNodeModules(basePath, WORK_PATH, notExtUserPath, 'swan');
        }
    }
    return assetPath;
}

function analyseEntryItem(item = '', cb) {
    if (SWAN_FILE[item]) {
        return cb();
    }
    const jsonPath = item.replace(/\.swan$/, '.json');
    if (/\.swan$/.test(item)) {
        SWAN_FILE[item] = true;
    }
    function walk(jsonPath) {
        return fs.readJson(jsonPath, 'utf-8').then(config => {
            const usingComponents = config.usingComponents || {};
            return new Promise(re => {
                async.each(usingComponents, (item, cb) => {
                    const itemPath = getAssetPath(jsonPath, item + '.swan', true);
                    const itemJSONPath = itemPath.replace(/\.swan$/, '.json');
                    fs.pathExists(itemPath).then(isExist => {
                        if (isExist) {
                            SWAN_FILE[itemPath] = true;
                            if (!CACHED_JSON[itemJSONPath]) {
                                CACHED_JSON[itemJSONPath] = true;
                                walk(itemJSONPath).then(() => cb());
                            } else {
                                cb();
                            }
                        } else {
                            cb();
                        }
                    });
                }, err => {
                    if (err) {
                        console.log(err);
                    }
                    re();
                });
            });
        }).catch(() => {});
    }
    walk(jsonPath).then(() => cb()).catch(() => cb());
}

const updateSlaveEntry = exports.updateSlaveEntry = function (files) {
    let fileArr = [];
    if (util.isString(files)) {
        fileArr = [files];
    } else if (util.isArray(files)) {
        fileArr = files;
    } else {
        return;
    }
    async.each(fileArr, analyseEntryItem, err => {
        if (err) {
            console.log(err);
        }
        const contentArr = [];
        Object.keys(SWAN_FILE).forEach(item => {
            item = util.formatPath(item);
            contentArr.push(`require('${item}');`);
        });
        fs.writeFileSync(slavePath, contentArr.join('\n'));
    });
};

const getSlaveEntry = exports.getSlaveEntry = function () {
    return Object.assign({}, SWAN_FILE);
};