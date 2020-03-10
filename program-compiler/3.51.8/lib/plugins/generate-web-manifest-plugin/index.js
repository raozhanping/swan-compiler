'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _webpackSources = require('webpack-sources');

var _util = require('../../util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const webPath = '../../../globals/web'; /**
                                         * @license
                                         * Copyright Baidu Inc. All Rights Reserved.
                                         *
                                         * This source code is licensed under the Apache License, Version 2.0; found in the
                                         * LICENSE file in the root directory of this source tree.
                                         *
                                         * @file web 生成 manifest 文件
                                         * @author yangjingjiu
                                         */

const masterTplPath = _path2.default.resolve(__dirname, webPath, 'master.tpl');
const indexTplPath = _path2.default.resolve(__dirname, webPath, 'index.tpl');

class GenerateManifest {
    constructor(options) {
        this.emitFileName = options.emitFileName;
        this.workPath = options.workPath;
        this.staticPrefix = options.staticPrefix;
        this.outputDir = options.outputDir;
        this.webJsonPath = options.webJsonPath;
        this.webEnv = options.webEnv;
        this.appKey = options.appKey;
    }

    apply(compiler) {
        compiler.plugin('emit', (compilation, callback) => {
            Promise.resolve().then(() => {
                const assets = compilation.assets;
                const assetsKeys = Object.keys(assets);
                const manifest = {
                    prefixPath: this.staticPrefix,
                    pagesList: [],
                    description: '',
                    keyword: '',
                    'url-mapping': {},
                    navigationBarTitleText: '世界很复杂，百度更懂你',
                    swanInfo: ''
                };
                assetsKeys.forEach(key => {
                    const filename = _path2.default.basename(key);
                    const dir = _path2.default.dirname(key);
                    let outKey = key;
                    if (this.webEnv !== 'tools' && this.webEnv !== 'test') {
                        outKey = (0, _util.formatPath)(key.replace(/(_[a-z0-9]*)(\.[a-z0-9]*)$/, ($0, $1, $2) => {
                            return $2;
                        }));
                    }
                    manifest[outKey] = this.staticPrefix + (0, _util.formatPath)(_path2.default.join(dir, filename));
                });
                this.handleAppJson(manifest);
                this.handleWebJson(manifest);
                compilation.assets['manifest.json'] = new _webpackSources.RawSource(JSON.stringify(manifest));
                if (this.webEnv === 'tools') {
                    const htmlInfo = {
                        $mapArray: manifest,
                        $data: {
                            appKey: this.appKey
                        }
                    };
                    return Promise.all([_fsExtra2.default.readFile(masterTplPath, 'utf8'), _fsExtra2.default.readFile(indexTplPath, 'utf8')]).then(([masterTplContent, indexTplContent]) => {
                        const masterHtmlContent = _ejs2.default.render(masterTplContent, htmlInfo);
                        const indexHtmlContent = _ejs2.default.render(indexTplContent, htmlInfo);
                        compilation.assets['index.html'] = new _webpackSources.RawSource(indexHtmlContent);
                        compilation.assets['master.html'] = new _webpackSources.RawSource(masterHtmlContent);
                    });
                }
            }).then(() => {
                callback();
            });
        });
    }

    handleAppJson(json) {
        try {
            const jsonPath = _path2.default.join(this.workPath, 'app.json');
            const appConfig = _fsExtra2.default.readJsonSync(jsonPath);
            const subPackages = appConfig.subPackages;
            json.pagesList = appConfig.pages;
            if (subPackages) {
                subPackages.forEach(pkg => {
                    pkg.pages.forEach(page => {
                        json.pagesList.push((0, _util.formatPath)(_path2.default.join(pkg.root, page)));
                    });
                });
            }
            json.description = appConfig.description;
            json.keyword = appConfig.keyword;
            json['url-mapping'] = appConfig['url-mapping'];
            if (appConfig.window) {
                json.navigationBarTitleText = appConfig.window.navigationBarTitleText;
            }
        } catch (err) {
            (0, _util.errorNext)(err, 0, 1);
        }
    }

    handleWebJson(json) {
        try {
            const jsonPath = this.webJsonPath;
            const webJson = _fsExtra2.default.readJsonSync(jsonPath);
            const version = webJson.version;
            if (version) {
                json.swanInfo = JSON.stringify({ version });
                const vArr = version.split('.');
                json.swanWebMajorVersion = `v${vArr[0]}` || '';
            }
        } catch (err) {
            (0, _util.errorNext)(err, 0, 1);
        }
    }
}

module.exports = GenerateManifest;