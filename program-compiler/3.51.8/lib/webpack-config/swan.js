'use strict';

var _index = require('../plugins/common-chunk-plugin/index');

var _index2 = _interopRequireDefault(_index);

var _swan = require('../plugins/common-chunk-plugin/swan');

var _swan2 = _interopRequireDefault(_swan);

var _requestPromise = require('request-promise');

var _requestPromise2 = _interopRequireDefault(_requestPromise);

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

const fs = require('fs-extra');
const querystring = require('querystring');
const util = require('../util');
const { SERVER_INFO, DYNAMIC_DEV_VERSION, PLUGIN_PATH_IN_OUTPUT } = require('../constant');
let {
    OUTPUT,
    WORK_PATH,
    SWAN_CORE_PATH,
    SOURCEMAP,
    UGLIFY,
    SWAN_CLI_PROCESS,
    APP_VERSION,
    COMPILE_WORK_PATH,
    MODULE,
    ENTRY_DIR_PATH,
    USE_OLD_COMPONENT,
    IS_WATCH,
    IGNORE_PREFIX_CSS,
    IGNORE_TRANS_JS,
    DYNAMIC_DIRECTORY,
    DYNAMIC_LIB_ROOT,
    PORT
} = global.SWAN_CLI_ARGV;
const {
    SERVER_HOST,
    DOWNLOAD_INTERFACE,
    PUBLIC_PARAM,
    DOWNLOAD_PARAM
} = SERVER_INFO;
const GenerateEntry = require('../generate-entry/swan').default;
const ExtractTextPlugin = require('../plugins/extract-text-plugin/src/index').default;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const fileSizeLoaderPath = path.resolve(__dirname, '../loader/file-size-loader.js');
const entryInstance = new GenerateEntry({
    swanCorePath: SWAN_CORE_PATH,
    workPath: WORK_PATH,
    module: MODULE,
    entryDirPath: ENTRY_DIR_PATH,
    port: PORT
});
module.exports = entryInstance.getEntry().then(entry => {
    const {
        jsClass,
        customComponentJS,
        jsonAssets,
        allJS,
        pagesJS,
        utilJS,
        isSplitAppJs,
        appConfig,
        nodeModulesArray
    } = entryInstance;
    const slaveEntry = entry['swan-entry'];
    delete entry['swan-entry'];
    const CACHE_DISK_COMMON_OPTION = util.getCacheDiskCommonOption('swan');
    const CACHE_DISK_OPTION = util.getCacheDiskOption('swan');
    const jsUseLoaders = [{
        loader: 'cache-loader',
        options: CACHE_DISK_COMMON_OPTION
    }];
    if (!IGNORE_TRANS_JS) {
        jsUseLoaders.push({
            loader: 'babel-loader',
            options: {
                babelrc: false,
                presets: [require('babel-preset-env')],
                plugins: [require('babel-plugin-transform-export-extensions'), require('babel-plugin-transform-class-properties'), [require('babel-plugin-transform-object-rest-spread'), {
                    useBuiltIns: true
                }]]
            }
        });
    }
    jsUseLoaders.push({
        loader: fileSizeLoaderPath,
        options: {
            workPath: WORK_PATH,
            type: 'js'
        }
    });
    const webpackConfig = {
        name: 'master',
        entry: entry,
        output: {
            filename: '[name].js',
            path: path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT)
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
                use: jsUseLoaders
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
                                    workPath: WORK_PATH,
                                    ignoreAutoPrefix: IGNORE_PREFIX_CSS
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
            }]
        },
        plugins: [new ExtractTextPlugin({
            allChunks: false,
            filename: '[name].css',
            workPath: WORK_PATH
        }), new _index2.default({
            workPath: WORK_PATH,
            moduleType: MODULE,
            entryContext: ENTRY_DIR_PATH,
            compileWorkPath: COMPILE_WORK_PATH,
            jsClass: jsClass,
            customJs: customComponentJS,
            output: OUTPUT,
            pagesJS,
            utilJS,
            isSplitAppJs,
            appConfig
        })]
    };
    const slaveConfig = {
        name: 'slave',
        entry: {
            'swan-entry': slaveEntry
        },
        output: {
            filename: '[name].js',
            path: path.isAbsolute(OUTPUT) ? OUTPUT : path.resolve(SWAN_CLI_PROCESS.cwd(), OUTPUT)
        },
        module: {
            rules: [{
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
                    loader: path.resolve(__dirname, '../loader/swan-loader.js'),
                    options: {
                        workPath: WORK_PATH,
                        swanCorePath: SWAN_CORE_PATH,
                        useOldComponent: USE_OLD_COMPONENT,
                        customComponentJS,
                        pagesJS,
                        appConfig
                    }
                }, {
                    loader: fileSizeLoaderPath,
                    options: {
                        workPath: WORK_PATH,
                        type: 'swan'
                    }
                }]
            }]
        },
        plugins: [new _swan2.default({
            workPath: WORK_PATH,
            moduleType: MODULE,
            customJs: customComponentJS,
            pagesJS,
            compileWorkPath: COMPILE_WORK_PATH,
            appConfig
        })]
    };
    const copyTakArray = [{
        from: path.resolve(COMPILE_WORK_PATH, 'swan-execute.js')
    }, {
        from: path.resolve(COMPILE_WORK_PATH, 'pkginfo.json')
    }, {
        from: util.MEDIA_TYPE,
        context: path.resolve(WORK_PATH),
        to: '[path][name].[ext]',
        ignore: ['node_modules/**/*']
    }, {
        from: '**/*.+(json)',
        context: path.resolve(WORK_PATH),
        to: '[path][name].[ext]',
        ignore: ['node_modules/**/*.json'],
        transform: (content, jsonPath) => {
            jsonPath = util.formatPath(jsonPath);
            try {
                // 给app.json中配置的动态库添加version
                if ('app.json' === path.relative(WORK_PATH, jsonPath)) {
                    let jsonConfig = JSON.parse(content.toString());
                    return Promise.all(addDynamicLibVersion(jsonConfig).concat(addPluginInfo(jsonConfig))).then(promiseArr => Promise.all(promiseArr)).then(() => JSON.stringify(jsonConfig));
                }
                if (jsonPath in jsonAssets) {
                    const appReg = /app\.json$/;
                    let jsonConfig = JSON.parse(content.toString());
                    if (appReg.test(jsonPath)) {
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
                } else {
                    return content;
                }
            } catch (e) {
                const err = `${jsonPath}: ${e}`;
                if (IS_WATCH) {
                    util.log(err, 'error');
                    return '';
                } else {
                    util.errorNext(new Error(err), 0, 1);
                }
            }
        }
    }];
    if (nodeModulesArray && nodeModulesArray.length) {
        const nodeModulesImgTasks = nodeModulesArray.map(targetDir => {
            const copyTask = {
                from: util.MEDIA_TYPE,
                context: targetDir,
                to: path.relative(path.resolve(WORK_PATH), targetDir)
            };
            return copyTask;
        });
        copyTakArray.push(...nodeModulesImgTasks);
    }
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
    function addDynamicLibVersion(appConfig) {
        let collectArr = [];
        let devDynamicName;
        let mainDynamic = appConfig.dynamicLib;
        if (DYNAMIC_LIB_ROOT) {
            const devDynamicLibConfig = fs.readJsonSync(path.resolve(DYNAMIC_LIB_ROOT, 'dynamicLib.json'));
            devDynamicName = devDynamicLibConfig.name;
        }
        if (mainDynamic) {
            getVersionPromise({ collectArr, dynamicConfig: mainDynamic, devDynamicName });
        }
        // TODO 暂不支持分包配置动态库
        // if (appConfig.subPackages) {
        //     appConfig.subPackages.forEach(subPackage => {
        //         if (subPackage.dynamicLib) {
        //             getVersionPromise({
        //                 collectArr,
        //                 dynamicConfig: subPackage.dynamicLib,
        //                 subPackageName: subPackage.root
        //             });
        //         }
        //     });
        // }
        return collectArr;
    }
    function addPluginInfo(appConfig) {
        let mainPlugin = appConfig.plugins || {};
        Object.keys(mainPlugin).forEach(pluginName => {
            try {
                let provider = mainPlugin[pluginName].provider;
                mainPlugin[pluginName].path = `${PLUGIN_PATH_IN_OUTPUT}/${provider}`;
                if (!provider) {
                    const errObj = new Error(`app.json中 ${mainPlugin[pluginName]} 缺少provider关键字}`);
                    util.errorNext(errObj, 0, 1);
                }
            } catch (err) {
                const errObj = new Error(`app.json中 ${mainPlugin} 缺少pluginName}`);
                util.errorNext(errObj, 0, 1);
            }
        });
        return appConfig;
    }
    function getVersionPromise(obj) {
        let {
            collectArr,
            dynamicConfig,
            subPackageName = '',
            devDynamicName = ''
        } = obj;
        Object.keys(dynamicConfig).forEach(dynamic => {
            const dynamicName = dynamicConfig[dynamic].provider;
            let dynamicPathRelativePath = subPackageName ? `${subPackageName}/__dynamicLib__/${dynamicName}` : `__dynamicLib__/${dynamicName}`;
            dynamicConfig[dynamic].path = dynamicPathRelativePath;
            if (dynamicName && devDynamicName && devDynamicName === dynamicConfig[dynamic].provider) {
                dynamicConfig[dynamic].version = DYNAMIC_DEV_VERSION;
            } else if (dynamicName) {
                const passParam = `${SERVER_HOST}${DOWNLOAD_INTERFACE}?${querystring.stringify(PUBLIC_PARAM)}` + `&${querystring.stringify(DOWNLOAD_PARAM)}&bundle_id=${dynamicName}`;
                collectArr.push((0, _requestPromise2.default)(passParam).then(config => {
                    let dynamicInfo = JSON.parse(config);
                    if (0 === dynamicInfo.errno) {
                        dynamicConfig[dynamic].version = dynamicInfo.data['version_name'];
                    } else if (dynamicInfo.errmsg) {
                        util.log(dynamicInfo.errmsg, 'error');
                        dynamicConfig[dynamic].version = 0;
                    }
                    return Promise.resolve();
                }).catch(err => {
                    let pkgDir = path.resolve(DYNAMIC_DIRECTORY, dynamicName);
                    return fs.readdir(pkgDir).then(dir => {
                        const localVersion = dir[0];
                        dynamicConfig[dynamic].version = localVersion;
                    }).catch(err => {
                        dynamicConfig[dynamic].version = 0;
                    });
                }));
            }
        });
    }
    const projectSwanJsonPath = path.resolve(WORK_PATH, 'project.swan.json');
    if (fs.existsSync(projectSwanJsonPath)) {
        copyTakArray.push({
            from: projectSwanJsonPath
        });
    }
    if (copyTakArray.length) {
        webpackConfig.plugins.push(new CopyWebpackPlugin(copyTakArray));
    }
    if (UGLIFY && UGLIFY !== 'false') {
        webpackConfig.plugins.push(new UglifyJsPlugin({
            test: /\.js$/,
            cache: true
        }));
    }
    if (SOURCEMAP === 'inline') {
        webpackConfig.devtool = 'inline-source-map';
    }
    return [webpackConfig, slaveConfig, entryInstance];
});