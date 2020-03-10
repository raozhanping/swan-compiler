'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (source) {
    const {
        pagesJsonMap,
        cJsAssets,
        workPath,
        hasRouteJs
    } = (0, _loaderUtils.getOptions)(this);
    const resourcePath = (0, _util.formatPath)(this.resourcePath);
    const rPath = (0, _util.formatPath)(_path2.default.relative(workPath, resourcePath));
    const noExtRPath = rPath.replace(/\.js$/, '');
    const pageJsonMap = pagesJsonMap[noExtRPath] || {};
    let {
        usingComponents = [],
        isComponents = false
    } = pageJsonMap;
    if (isComponents) {
        if (usingComponents.indexOf(noExtRPath) === -1) {
            usingComponents.push(noExtRPath);
        }
        this._module.__addpage__ = true;
    }
    const extraContent = (rp, cArr) => {
        return `window.__swanRoute='${rp}';window.usingComponents=${JSON.stringify(cArr)};`;
    };
    if (MODULE === 'amd') {
        this._module.__queryPath__ = noExtRPath;
    }
    this._module.__supplyment__ = extraContent(noExtRPath, usingComponents);
    if (new RegExp((0, _util.formatPath)(WEB_ENTRY_DIR_PATH)).test(resourcePath)) {
        this._module.__no_work__ = true;
    }
    const cFlag = cJsAssets.indexOf(resourcePath) > -1;
    if (cFlag) {
        this._module.__is_component__ = true;
    }
    if (hasRouteJs.indexOf(resourcePath) > -1 || cFlag) {
        this._module.__isRoute__ = true;
    }
    return source;
};

var _loaderUtils = require('loader-utils');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
    WEB_ENTRY_DIR_PATH,
    MODULE
} = global.SWAN_CLI_ARGV; /**
                           * @license
                           * Copyright Baidu Inc. All Rights Reserved.
                           *
                           * This source code is licensed under the Apache License, Version 2.0; found in the
                           * LICENSE file in the root directory of this source tree.
                           *
                           * @file 处理用户js
                           * @author yangjingjiu
                          */