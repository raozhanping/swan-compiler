'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.processCustomComponentCss = processCustomComponentCss;

var _util = require('util');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssCustomProperties = require('postcss-custom-properties');

var _postcssCustomProperties2 = _interopRequireDefault(_postcssCustomProperties);

var _autoprefixer = require('autoprefixer');

var _autoprefixer2 = _interopRequireDefault(_autoprefixer);

var _postcssFilter = require('../../postcss-plugin/postcss-filter');

var _postcssFilter2 = _interopRequireDefault(_postcssFilter);

var _postcssImport = require('../../postcss-plugin/postcss-import');

var _postcssImport2 = _interopRequireDefault(_postcssImport);

var _postcssSwan = require('../../postcss-plugin/postcss-swan');

var _postcssSwan2 = _interopRequireDefault(_postcssSwan);

var _postcssWeb = require('../../postcss-plugin/postcss-web');

var _postcssWeb2 = _interopRequireDefault(_postcssWeb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理web化自定义组件page化，产出一份developer.css中需要的css
 * @author jiamiao@baidu.com
 */
const workPath = global.SWAN_CLI_ARGV.WORK_PATH;
const webEnv = global.SWAN_CLI_ARGV.WEB_ENV;

// 处理web化自定义组件page化，产出一份developer.css中需要的css
function processCustomComponentCss(cssPath, loaderContext, needMd5ClassFile) {
    return (0, _util.promisify)(_fs2.default.readFile)(cssPath, 'utf-8').then(cssConent => {
        return (0, _postcss2.default)().use((0, _postcssFilter2.default)()).use((0, _postcssCustomProperties2.default)()).use((0, _autoprefixer2.default)({
            overrideBrowserslist: ['last 2 versions'],
            cascade: false
        })).use((0, _postcssImport2.default)({
            resolve(nestImportPath, basedir, importOptions) {
                let findPath = _path2.default.isAbsolute(nestImportPath) ? _path2.default.join(workPath, nestImportPath) : nestImportPath;
                if (!/\.css$/.test(findPath)) {
                    findPath += '.css';
                }
                return findPath;
            }
        })).use((0, _postcssSwan2.default)({
            type: 'webUser'
        })).use((0, _postcssWeb2.default)({
            needMd5ClassFile,
            workPath,
            staticPrefix: '',
            webEnv
        })).process(cssConent, {
            from: cssPath
        });
    }).then(result => {
        loaderContext.addDependency(cssPath);
        return result.css || '';
    });
}