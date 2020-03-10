'use strict';

var _index = require('../plugins/common-chunk-plugin/index');

var _index2 = _interopRequireDefault(_index);

var _swan = require('../plugins/common-chunk-plugin/swan');

var _swan2 = _interopRequireDefault(_swan);

var _index3 = require('../plugins/correct-output-path-plugin/index');

var _index4 = _interopRequireDefault(_index3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const path = require('path'); /**
                               * @license
                               * Copyright Baidu Inc. All Rights Reserved.
                               *
                               * This source code is licensed under the Apache License, Version 2.0; found in the
                               * LICENSE file in the root directory of this source tree.
                               *
                               * @file base config
                               * @author zhuxin
                               */

const util = require('../util');
let {
    OUTPUT,
    SWAN_CORE_PATH,
    SOURCEMAP,
    UGLIFY,
    SWAN_CLI_PROCESS,
    APP_VERSION,
    COMPILE_WORK_PATH,
    MODULE,
    DYNAMIC_ENTRY_DIR_PATH,
    USE_OLD_COMPONENT,
    IS_WATCH,
    DYNAMIC_LIB_ROOT,
    WORK_PATH
} = global.SWAN_CLI_ARGV;
const GenerateEntry = require('../generate-entry/dynamic').default;
const ExtractTextPlugin = require('../plugins/extract-text-plugin/src/index').default;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const fileSizeLoaderPath = path.resolve(__dirname, '../loader/file-size-loader.js');
const entryInstance = new GenerateEntry({
    workPath: WORK_PATH,
    swanCorePath: SWAN_CORE_PATH,
    module: MODULE,
    entryDirPath: DYNAMIC_ENTRY_DIR_PATH,
    dynamicRoot: DYNAMIC_LIB_ROOT
});
const outputPath = path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);
module.exports = entryInstance.getEntry().then(entry => {
    const {
        jsClass = {},
        customComponentJS,
        jsonAssets,
        allJS,
        pagesJS = {},
        utilJS,
        dynamicNameQuote,
        interfaceJsAsset,
        publicComponents
    } = entryInstance;
    const CACHE_DISK_COMMON_OPTION = util.getCacheDiskCommonOption('dynamicLib');
    const CACHE_DISK_OPTION = util.getCacheDiskOption('dynamicLib');
    const webpackConfig = {
        name: 'dynamicLib',
        entry: entry,
        output: {
            filename: '[name].js',
            path: path.join(outputPath, `/__dynamicLib__/${dynamicNameQuote.name}`)
        },
        module: {
            noParse(content) {
                let isParse = false;
                if (MODULE === 'amd') {
                    const rawRequestArr = content.split('!');
                    let rawRequest = rawRequestArr[rawRequestArr.length - 1];
                    rawRequest = util.formatPath(rawRequest);
                    isParse = allJS[rawRequest];
                }
                return isParse;
            },
            rules: [{
                test: /\.js$/,
                use: [{
                    loader: 'cache-loader',
                    options: CACHE_DISK_COMMON_OPTION
                }, {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        presets: [require('babel-preset-env')],
                        plugins: [require('babel-plugin-transform-export-extensions'), require('babel-plugin-transform-class-properties'), [require('babel-plugin-transform-object-rest-spread'), {
                            useBuiltIns: true
                        }]]
                    }
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: DYNAMIC_LIB_ROOT,
                        type: 'js'
                    }
                }]
            }, {
                test: /\.swan$/,
                use: [{
                    loader: 'cache-loader',
                    options: CACHE_DISK_OPTION
                }, {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        presets: [require('babel-preset-env')],
                        plugins: [require('babel-plugin-transform-export-extensions'), require('babel-plugin-transform-class-properties'), [require('babel-plugin-transform-object-rest-spread'), {
                            useBuiltIns: true
                        }]]
                    }
                }, {
                    loader: path.resolve(__dirname, '../loader/dynamic-swan-loader.js'),
                    options: {
                        workPath: DYNAMIC_LIB_ROOT,
                        swanCorePath: SWAN_CORE_PATH,
                        useOldComponent: USE_OLD_COMPONENT,
                        customComponentJS,
                        pagesJS,
                        dynamicNameQuote,
                        publicComponents
                    }
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: DYNAMIC_LIB_ROOT,
                        type: 'swan'
                    }
                }]
            }]
        },
        plugins: [new ExtractTextPlugin({
            allChunks: false,
            filename: '[name].css',
            workPath: DYNAMIC_LIB_ROOT
        }), new _index4.default({
            dynamicNameQuote,
            compilerType: 'dynamicLib'
        }), new _index2.default({
            workPath: DYNAMIC_LIB_ROOT,
            moduleType: MODULE,
            entryContext: DYNAMIC_ENTRY_DIR_PATH,
            jsClass: jsClass,
            customJs: customComponentJS,
            output: OUTPUT,
            pagesJS,
            utilJS,
            dynamicNameQuote,
            interfaceJsAsset,
            publicComponents,
            compileWorkPath: COMPILE_WORK_PATH,
            sourceType: 'dynamicLib'
        }), new _swan2.default({
            workPath: DYNAMIC_LIB_ROOT,
            moduleType: MODULE,
            customJs: customComponentJS,
            pagesJS,
            dynamicNameQuote,
            interfaceJsAsset,
            publicComponents,
            compileWorkPath: COMPILE_WORK_PATH,
            sourceType: 'dynamicLib'
        })]
    };
    const copyTakArray = [{
        from: path.resolve(COMPILE_WORK_PATH, 'pkginfo.json')
    }, {
        from: util.MEDIA_TYPE,
        context: path.resolve(DYNAMIC_LIB_ROOT),
        to: '[path][name].[ext]'
    }, {
        from: '**/*.+(json)',
        context: path.resolve(DYNAMIC_LIB_ROOT),
        to: '[path][name].[ext]',
        ignore: ['node_modules/**/*.json', '__dynamicLib__/**/*.json'],
        transform: (content, path) => {
            path = util.formatPath(path);
            if (path in jsonAssets) {
                const appReg = /app\.json$/;
                try {
                    let jsonConfig = JSON.parse(content.toString());
                    if (appReg.test(path)) {
                        const { window = {}, tabBar = {} } = jsonConfig;
                        if (APP_VERSION) {
                            jsonConfig.version = APP_VERSION;
                        }
                        if (!(jsonConfig.subPackages && jsonConfig.subPackages.length)) {
                            jsonConfig.splitAppJs = true;
                        }
                        transformColorValue(window);
                        transformColorValue(tabBar);
                    } else {
                        transformColorValue(jsonConfig);
                    }
                    return JSON.stringify(jsonConfig);
                } catch (e) {
                    const err = `${path}: ${e}`;
                    if (IS_WATCH) {
                        util.log(err, 'error');
                        return '';
                    } else {
                        util.errorNext(new Error(err), 0, 1);
                    }
                }
            } else {
                return content;
            }
        }
    }];
    function transformColorValue(obj) {
        Object.keys(obj).forEach(key => {
            let val = obj[key] || '';
            if (typeof val === 'string' && val.startsWith('#') && val.length === 4) {
                let colorVal = val.split('#')[1];
                let doubleColor = colorVal.split('').reduce(function (accumulator, val) {
                    let double = val + val;
                    return accumulator + double;
                }, '');
                doubleColor = '#' + doubleColor;
                obj[key] = doubleColor;
            }
        });
        return obj;
    }
    if (copyTakArray.length) {
        webpackConfig.plugins.push(new CopyWebpackPlugin(copyTakArray, { copyUnmodified: true }));
    }
    if (UGLIFY && UGLIFY !== 'false') {
        webpackConfig.plugins.push(new UglifyJsPlugin({
            test: /\.js$/,
            cache: true
        }));
    }
    if (SOURCEMAP === 'inline') {
        webpackConfig.devtool = 'inline-cheap-source-map';
    }
    return {
        config: webpackConfig,
        entryInstance
    };
});