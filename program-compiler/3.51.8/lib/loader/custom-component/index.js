'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.processCustomComponentCss = processCustomComponentCss;

var _util = require('util');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _customImportParse = require('../../postcss-plugin/custom-import-parse');

var _customImportParse2 = _interopRequireDefault(_customImportParse);

var _util2 = require('./../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理自定义组件
 * @author zhuxin04@gmial.com
 */
const autoprefixer = require('autoprefixer');
const {
    WORK_PATH: workPath,
    DYNAMIC_LIB_ROOT: dynamicWorkPath,
    PLUGIN_ROOT: pluginWorkPath,
    IGNORE_PREFIX_CSS
} = global.SWAN_CLI_ARGV;
/**
 * 处理自定义组件中的css文件
 * @param {string} componentName 自定义组件名字
 * @param {string} cssPath 自定义组件css文件路径
 * @param {Object} loaderContext loader的上下文
 * @param {string} sourceType 标识该css来源，'swan' 主线编译  'plugin' 插件编译  'dynamicLib' 动态库编译
 * @return {Promise<T | string>}
 */
function processCustomComponentCss(cssPath, loaderContext, sourceType = 'swan') {
    return (0, _util.promisify)(_fs2.default.readFile)(cssPath, 'utf-8').then(cssConent => {
        const postcssInitial = (0, _postcss2.default)();
        if (!IGNORE_PREFIX_CSS) {
            postcssInitial.use(autoprefixer({ browsers: ['Chrome > 20'] }));
        }
        let workSpacePath;
        if ('swan' === sourceType) {
            workSpacePath = workPath;
        } else if ('plugin' === sourceType) {
            workSpacePath = pluginWorkPath;
        } else if ('dynamicLib' === sourceType) {
            workSpacePath = dynamicWorkPath;
        }
        postcssInitial.use((0, _customImportParse2.default)({
            workPath: workSpacePath,
            isIgnoreAutoPrefix: IGNORE_PREFIX_CSS,
            sourceType
        }));
        return postcssInitial.process(cssConent, {
            from: cssPath
        }).then(result => {
            loaderContext.addDependency(cssPath);
            const { __css__, __dependencies__ } = result;
            __dependencies__.forEach(key => {
                if (_os2.default.platform() === 'win32') {
                    loaderContext.addDependency((0, _util2.formatPath2)(key));
                } else {
                    loaderContext.addDependency(key);
                }
            });
            return __css__;
        }).catch(e => {
            loaderContext.addDependency(cssPath);
            loaderContext._compilation.errors.push(e);
            return e;
        });
    }).then(result => {
        return result;
    }).catch(() => {
        loaderContext.options.__css__ = 1;
        return '[]';
    });
}