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
    COMPILE_WORK_PATH,
    MODULE,
    PLUGIN_ENTRY_DIR_PATH,
    USE_OLD_COMPONENT,
    IS_WATCH,
    PLUGIN_ROOT,
    WORK_PATH,
    IGNORE_PREFIX_CSS
} = global.SWAN_CLI_ARGV;
const { PLUGIN_PATH_IN_OUTPUT } = require('../constant');
const GenerateEntry = require('../generate-entry/plugin').default;
const ExtractTextPlugin = require('../plugins/extract-text-plugin/src/index').default;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const fileSizeLoaderPath = path.resolve(__dirname, '../loader/file-size-loader.js');
const entryInstance = new GenerateEntry({
    workPath: WORK_PATH,
    swanCorePath: SWAN_CORE_PATH,
    module: MODULE,
    entryDirPath: PLUGIN_ENTRY_DIR_PATH,
    pluginRoot: PLUGIN_ROOT
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
        interfaceJsAsset,
        publicComponents,
        publicPages,
        pageList,
        extraComponent
    } = entryInstance;
    let outputPagePathList = pageList.map(page => `${PLUGIN_PATH_IN_OUTPUT}/${global.APPID}/${page}`);
    const CACHE_DISK_COMMON_OPTION = util.getCacheDiskCommonOption('plugin');
    const CACHE_DISK_OPTION = util.getCacheDiskOption('plugin');
    const webpackConfig = {
        name: 'plugin',
        entry: entry,
        output: {
            filename: '[name].js',
            path: path.join(outputPath, `/${PLUGIN_PATH_IN_OUTPUT}/${global.APPID}`)
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
                        workPath: PLUGIN_ROOT,
                        type: 'js'
                    }
                }]
            }, {
                test: /\.css$/,
                exclude: /node_modules/,
                use: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: [{
                        loader: 'cache-loader',
                        options: CACHE_DISK_OPTION
                    }, {
                        loader: 'css-loader',
                        options: {
                            url: false
                        }
                    }, {
                        loader: 'postcss-loader',
                        options: {
                            sourceMap: true,
                            config: {
                                path: path.resolve(__dirname, '../postcss-config/postcss.config.js'),
                                ctx: {
                                    workPath: PLUGIN_ROOT,
                                    ignoreAutoPrefix: IGNORE_PREFIX_CSS
                                }
                            }
                        }
                    }, {
                        loader: fileSizeLoaderPath,
                        options: {
                            workPath: PLUGIN_ROOT,
                            type: 'css'
                        }
                    }]
                })
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
                    loader: path.resolve(__dirname, '../loader/plugin-swan-loader.js'),
                    options: {
                        workPath: PLUGIN_ROOT,
                        swanCorePath: SWAN_CORE_PATH,
                        useOldComponent: USE_OLD_COMPONENT,
                        customComponentJS,
                        pagesJS,
                        publicComponents
                    }
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: PLUGIN_ROOT,
                        type: 'swan'
                    }
                }]
            }]
        },
        plugins: [new ExtractTextPlugin({
            allChunks: false,
            filename: '[name].css',
            workPath: PLUGIN_ROOT
        }), new _index4.default({
            compilerType: 'plugin'
        }), new _index2.default({
            workPath: PLUGIN_ROOT,
            moduleType: MODULE,
            entryContext: PLUGIN_ENTRY_DIR_PATH,
            jsClass: jsClass,
            customJs: customComponentJS,
            output: OUTPUT,
            pagesJS,
            utilJS,
            interfaceJsAsset,
            publicComponents,
            publicPages,
            compileWorkPath: COMPILE_WORK_PATH,
            sourceType: 'plugin',
            pluginPageList: outputPagePathList,
            extraComponent
        }), new _swan2.default({
            workPath: PLUGIN_ROOT,
            moduleType: MODULE,
            customJs: customComponentJS,
            pagesJS,
            interfaceJsAsset,
            publicComponents,
            publicPages,
            compileWorkPath: COMPILE_WORK_PATH,
            sourceType: 'plugin',
            extraComponent
        })]
    };
    const copyTakArray = [{
        from: path.resolve(COMPILE_WORK_PATH, 'pkginfo.json')
    }, {
        from: util.MEDIA_TYPE,
        context: path.resolve(PLUGIN_ROOT),
        to: '[path][name].[ext]'
    }, {
        from: '**/*.+(json)',
        context: path.resolve(PLUGIN_ROOT),
        to: '[path][name].[ext]',
        ignore: ['node_modules/**/*.json'],
        transform: (content, jsonPath) => {
            jsonPath = util.formatPath(jsonPath);
            let jsonConfig = JSON.parse(content.toString());
            if ('plugin.json' === path.relative(PLUGIN_ROOT, jsonPath)) {
                const sameKeys = util.getSameKeysInTwoObjects(jsonConfig.publicComponents || {}, jsonConfig.pages || {});
                if (sameKeys.length > 0) {
                    util.errorNext(`plugin.json中 pages 与 publicComponents不能存在相同的key: ${sameKeys.join(',')}`, 0, 1);
                }
                jsonConfig.pagesList = outputPagePathList;
                return JSON.stringify(jsonConfig);
            }
            if (jsonPath in jsonAssets) {
                try {
                    transformColorValue(jsonConfig);
                    return JSON.stringify(jsonConfig);
                } catch (e) {
                    const err = `${jsonPath}: ${e}`;
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
    },
    // 收集文档内容，层级可能会变？可能踩坑
    {
        from: util.PLUGIN_DOC_TYPE,
        context: path.join(WORK_PATH, '../doc'),
        to: '../doc/[path][name].[ext]'
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