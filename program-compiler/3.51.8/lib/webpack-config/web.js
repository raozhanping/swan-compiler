'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _uglifyjsWebpackPlugin = require('uglifyjs-webpack-plugin');

var _uglifyjsWebpackPlugin2 = _interopRequireDefault(_uglifyjsWebpackPlugin);

var _extractTextWebpackPlugin = require('extract-text-webpack-plugin');

var _extractTextWebpackPlugin2 = _interopRequireDefault(_extractTextWebpackPlugin);

var _copyWebpackPlugin = require('copy-webpack-plugin');

var _copyWebpackPlugin2 = _interopRequireDefault(_copyWebpackPlugin);

var _web = require('../generate-entry/web');

var _web2 = _interopRequireDefault(_web);

var _index = require('../plugins/web-chunk-plugin/index');

var _index2 = _interopRequireDefault(_index);

var _extractWebSwanPlugin = require('../plugins/extract-web-swan-plugin');

var _extractWebSwanPlugin2 = _interopRequireDefault(_extractWebSwanPlugin);

var _extractWebJsonPlugin = require('../plugins/extract-web-json-plugin');

var _extractWebJsonPlugin2 = _interopRequireDefault(_extractWebJsonPlugin);

var _mergeTextPlugin = require('../plugins/merge-text-plugin');

var _mergeTextPlugin2 = _interopRequireDefault(_mergeTextPlugin);

var _generateWebManifestPlugin = require('../plugins/generate-web-manifest-plugin');

var _generateWebManifestPlugin2 = _interopRequireDefault(_generateWebManifestPlugin);

var _extractWebCustomComponentsPlugin = require('../plugins/extract-web-custom-components-plugin');

var _extractWebCustomComponentsPlugin2 = _interopRequireDefault(_extractWebCustomComponentsPlugin);

var _util = require('../util');

var util = _interopRequireWildcard(_util);

var _web3 = require('../env-config/web');

var _web4 = _interopRequireDefault(_web3);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
    OUTPUT,
    WORK_PATH,
    SWAN_CLI_PROCESS,
    DEV,
    WEB_ENV,
    APPKEY,
    MODULE
} = global.SWAN_CLI_ARGV; /**
                           * @license
                           * Copyright Baidu Inc. All Rights Reserved.
                           *
                           * This source code is licensed under the Apache License, Version 2.0; found in the
                           * LICENSE file in the root directory of this source tree.
                           *
                           * @file web 配置文件
                           * @author yangjingjiu
                           */

module.exports = _web4.default.then(data => {
    let {
        staticPrefix,
        outputName,
        swanWebDistPath,
        webCoreFilePathObj = {}
    } = data;
    const {
        frameStyleCssPath,
        masterPath,
        slavePath
    } = webCoreFilePathObj;
    const appConfigTplPath = _path2.default.resolve(__dirname, '../../globals/web/appconfig.js.tpl');
    const extractWebJsonLoaderPath = _path2.default.resolve(__dirname, '../plugins/extract-web-json-plugin/loader.js');
    const extractWebCustomCssLoaderPath = _path2.default.resolve(__dirname, '../plugins/extract-web-custom-components-plugin/loader.js');
    const swanWebLoaderPath = _path2.default.resolve(__dirname, '../loader/web-swan-loader.js');
    const webCustomJsLoaderPath = _path2.default.resolve(__dirname, '../loader/web-custom-js-loader.js');
    const jsonLoaderPath = _path2.default.resolve(__dirname, '../loader/json-loader.js');
    const postcssConfigPath = _path2.default.resolve(__dirname, '../postcss-config/postcss.config.js');
    const fileSizeLoaderPath = _path2.default.resolve(__dirname, '../loader/file-size-loader.js');
    const {
        entry,
        appJs,
        jsAssets,
        pagesJsonMap,
        pagesJsAssets,
        pagesCssAssets,
        cCssAssets,
        cJsAssets,
        cAssets,
        cycleCustomComponents,
        subJsAssets,
        subCssAssets,
        pagesComponent
    } = _web2.default.getInstance();
    const hasRouteJs = [...appJs, ...pagesJsAssets, ...cJsAssets, ...subJsAssets];
    const output = _path2.default.isAbsolute(OUTPUT) ? OUTPUT : _path2.default.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT);
    const extractUserCss = new _extractTextWebpackPlugin2.default(outputName.developerCss);
    const entryCCssAssets = cCssAssets.map(file => {
        return _path2.default.resolve(file);
    });
    // 自定义组件page化，既要打进组件的css中，又要打进developer.css中
    let pageComponentsCss = cCssAssets.filter(css => {
        let noExtCss = css.replace(/.css$/, '');
        return pagesComponent.includes(noExtCss);
    });
    let {
        copyMasterFile,
        copySlaveFile,
        copyFrameCssFile,
        copyFile
    } = outputName;
    let copyArray = [{
        from: util.MEDIA_TYPE,
        context: _path2.default.resolve(WORK_PATH),
        to: `[path]${copyFile}`
    },
    // TPserver需要ext.json文件中的内容
    {
        from: 'ext.+(json)',
        context: _path2.default.resolve(WORK_PATH),
        to: '[path][name].[ext]'
    }];
    // 兼容白屏检测需要框架代码
    if ('tools' === WEB_ENV) {
        let toolsCopyArray = [{
            from: masterPath,
            to: copyMasterFile
        }, {
            from: slavePath,
            to: copySlaveFile
        }, {
            from: frameStyleCssPath,
            to: copyFrameCssFile
        }];
        copyArray = [...copyArray, ...toolsCopyArray];
    }
    const webpackConfig = {
        entry: entry,
        output: {
            filename: outputName.appJs,
            path: output
        },
        module: {
            noParse: content => {
                if (MODULE === 'amd') {
                    const rawRequestArr = content.split('!');
                    let rawRequest = rawRequestArr[rawRequestArr.length - 1];
                    rawRequest = util.formatPath(rawRequest);
                    if (jsAssets.indexOf(rawRequest) > -1) {
                        return true;
                    }
                }
                return false;
            },
            rules: [{
                test: /\.js$/,
                use: [{
                    loader: webCustomJsLoaderPath,
                    options: {
                        pagesJsonMap,
                        cJsAssets,
                        workPath: WORK_PATH,
                        hasRouteJs
                    }
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
                        workPath: WORK_PATH,
                        type: 'js'
                    }
                }]
            }, {
                test: /\.swan$/,
                use: _extractWebSwanPlugin2.default.extract({
                    use: [{
                        loader: swanWebLoaderPath,
                        options: {
                            workPath: WORK_PATH,
                            staticPrefix,
                            customComponentsSwans: cAssets,
                            webEnv: WEB_ENV,
                            pagesComponent
                        }
                    }, {
                        loader: fileSizeLoaderPath,
                        options: {
                            workPath: WORK_PATH,
                            type: 'swan'
                        }
                    }]
                })
            }, {
                test: /\.css$/,
                exclude: entryCCssAssets,
                use: extractUserCss.extract({
                    fallback: 'style-loader',
                    use: [{
                        loader: 'css-loader',
                        options: {
                            url: false,
                            import: false,
                            minimize: true
                        }
                    }, {
                        loader: 'postcss-loader',
                        options: {
                            config: {
                                path: postcssConfigPath,
                                ctx: {
                                    workPath: WORK_PATH,
                                    type: 'webUser',
                                    needMd5ClassFile: [...pagesCssAssets, ...subCssAssets],
                                    webEnv: WEB_ENV
                                }
                            }
                        }
                    }, {
                        loader: fileSizeLoaderPath,
                        options: {
                            workPath: WORK_PATH,
                            type: 'css'
                        }
                    }]
                })
            }, {
                test: /.css$/,
                include: entryCCssAssets,
                use: [{
                    loader: extractWebCustomCssLoaderPath,
                    options: {
                        pageComponentsCss,
                        needMd5ClassFile: [...pagesCssAssets, ...subCssAssets]
                    }
                }, {
                    loader: 'css-loader',
                    options: {
                        url: false
                    }
                }, {
                    loader: 'postcss-loader',
                    options: {
                        config: {
                            path: postcssConfigPath,
                            ctx: {
                                workPath: WORK_PATH,
                                type: 'webCustom',
                                staticPrefix: staticPrefix,
                                isDev: DEV,
                                webEnv: WEB_ENV
                            }
                        }
                    }
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: WORK_PATH,
                        type: 'css'
                    }
                }]
            }, {
                test: /\.json$/,
                use: [{
                    loader: extractWebJsonLoaderPath
                }, {
                    loader: 'json-loader'
                }, {
                    loader: jsonLoaderPath
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: WORK_PATH,
                        type: 'json'
                    }
                }]
            }]
        },
        plugins: [new _copyWebpackPlugin2.default(copyArray, { copyUnmodified: true }), new _index2.default({
            workPath: WORK_PATH,
            moduleType: MODULE
        }), new _extractWebSwanPlugin2.default({
            workPath: WORK_PATH,
            filename: '[name].swan.js',
            emitFileName: 'pagesMap.js',
            custom: cAssets,
            pagesJsonMap
        }), new _extractWebJsonPlugin2.default({
            workPath: WORK_PATH,
            emitFileName1: 'pagesConfig.js',
            emitFileName2: 'appConfig.js',
            ejsTemplatePath: appConfigTplPath,
            cycleCustomComponents
        }), new _mergeTextPlugin2.default({
            emitFileName: outputName.developerJs,
            isDev: DEV,
            custom: cAssets
        }), new _generateWebManifestPlugin2.default({
            emitFileName: 'manifest.json',
            workPath: WORK_PATH,
            staticPrefix: staticPrefix,
            outputDir: output,
            webJsonPath: swanWebDistPath,
            webEnv: WEB_ENV,
            appKey: APPKEY
        }), new _extractWebCustomComponentsPlugin2.default({
            workPath: WORK_PATH,
            custom: cAssets,
            pageComponentsCss,
            emitFileName: outputName.developerCss
        }), extractUserCss]
    };
    if (!DEV) {
        webpackConfig.plugins.push(new _uglifyjsWebpackPlugin2.default());
    }
    return { config: webpackConfig };
});