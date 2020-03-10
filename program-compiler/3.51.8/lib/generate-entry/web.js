'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _util = require('../util');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable max-len */
/**
 * @file entry
 * @author yangjingjiu
 */

const {
    WEB_ENTRY_DIR_PATH,
    WORK_PATH,
    MODULE
} = global.SWAN_CLI_ARGV;

class GengrateEntry {
    constructor(workPath) {
        this.workPath = workPath;
        this.init();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new GengrateEntry(WORK_PATH);
        }
        return this.instance;
    }

    get jsonAssets() {
        return this._jsonAssets;
    }

    get jsAssets() {
        return this._jsAssets;
    }

    get swanAssets() {
        return this._swanAssets;
    }

    get pagesJsAssets() {
        return this._pagesJsAssets;
    }

    get pagesCssAssets() {
        return this._pagesCssAssets;
    }

    get pagesSwanAssets() {
        return this._pagesSwanAssets;
    }

    get pagesJsonAssets() {
        return this._pagesJsonAssets;
    }

    get cJsAssets() {
        return this._cJsAssets;
    }

    get cCssAssets() {
        return this._cCssAssets;
    }

    get cSwanAssets() {
        return this._cSwanAssets;
    }

    get cJsonAssets() {
        return this._cJsonAssets;
    }

    get entry() {
        return this._entry;
    }

    get pagesJsonMap() {
        return this._pagesJsonMap;
    }

    get cAssets() {
        return this._cAssets;
    }

    get appJs() {
        return this._appJs;
    }

    get workJs() {
        return this._workJs;
    }

    get appCss() {
        return this._appCss;
    }

    get appJson() {
        return this._appJson;
    }

    get cycleCustomComponents() {
        return this._cycleCustomComponents;
    }

    get subJsonAssets() {
        return this._subJsonAssets;
    }

    get subJsAssets() {
        return this._subJsAssets;
    }

    get subCssAssets() {
        return this._subCssAssets;
    }

    get subSwanAssets() {
        return this._subSwanAssets;
    }

    get pagesComponent() {
        return this._pagesComponent.map(fileItem => {
            return fileItem.replace(/\.js$/, '');
        });
    }

    init() {
        this._jsonAssets = [];
        this._jsAssets = [];
        this._cssAssets = [];
        this._swanAssets = [];
        this._pagesJsAssets = [];
        this._pagesCssAssets = [];
        this._pagesSwanAssets = [];
        this._pagesJsonAssets = [];
        this._cJsAssets = [];
        this._cCssAssets = [];
        this._cSwanAssets = [];
        this._cJsonAssets = [];
        this._entry = {};
        this._pagesJsonMap = {};
        this._cAssets = [];
        this._appJs = [];
        this._workJs = [];
        this._appCss = [];
        this._appJson = [];
        this._subJsonAssets = [];
        this._subJsAssets = [];
        this._subCssAssets = [];
        this._subSwanAssets = [];
        this._cycleCustomComponents = [];
        this._pagesComponent = [];

        const workPath = this.workPath;
        this._jsAssets = this.getFiles(workPath, 'js');
        this._jsonAssets = this.getFiles(workPath, 'json');
        this._swanAssets = this.getFiles(workPath, 'swan');
        this._cssAssets = this.getFiles(workPath, 'css');
        this.checkWork(workPath);
        const workAppJsonPath = (0, _util.formatPath)(_path2.default.join(workPath, 'app.json'));
        const workAppJsPath = (0, _util.formatPath)(_path2.default.join(workPath, 'app.js'));
        const workAppCssPath = (0, _util.formatPath)(_path2.default.join(workPath, 'app.css'));
        this._appJs.push(workAppJsPath);
        this._appCss.push(workAppCssPath);
        this._appJson.push(workAppJsonPath);

        let pages = [];
        let subPackages = [];
        try {
            const appPackageObj = _fsExtra2.default.readJSONSync(workAppJsonPath);
            pages = appPackageObj.pages || pages;
            subPackages = appPackageObj.subPackages || subPackages;
        } catch (err) {
            (0, _util.errorNext)(err, 0, 1);
        }
        const pushComponents = (js, css, json, swan) => {
            this.pushFiles(js, this._cJsAssets);
            this.pushFiles(css, this._cCssAssets);
            this.pushFiles(swan, this._cSwanAssets);
            this.pushFiles(json, this._cJsonAssets);
        };
        const pushAssets = (file, jsAssets, cssAssets, swanAssets, jsonAssets) => {
            const joinFileFn = (file, ext) => {
                const rPath = (0, _util.formatPath)(_path2.default.join(workPath, file));
                return ext ? `${rPath}.${ext}` : rPath;
            };
            const jsFile = joinFileFn(file, 'js');
            const cssFile = joinFileFn(file, 'css');
            const swanFile = joinFileFn(file, 'swan');
            const jsonFile = joinFileFn(file, 'json');
            this.pushFiles(jsFile, jsAssets);
            this.pushFiles(cssFile, cssAssets);
            this.pushFiles(swanFile, swanAssets);
            if (_fsExtra2.default.existsSync(jsonFile)) {
                jsonAssets.push(jsonFile);
                try {
                    const fileContent = _fsExtra2.default.readFileSync(jsonFile, 'utf8');
                    if (fileContent.trim()) {
                        const packageObj = JSON.parse(fileContent);
                        if (packageObj.component) {
                            const noExtFile = joinFileFn(file);
                            const rPath = (0, _util.formatPath)(_path2.default.relative(workPath, noExtFile));
                            this._cAssets.push(rPath);
                            pushComponents(jsFile, cssFile, jsonFile, swanFile);
                            this.pushFiles(jsFile, this._pagesComponent);
                        }
                    }
                } catch (err) {
                    err.message = `${jsonFile}, ${err.message}`;
                    (0, _util.errorNext)(err, 0, 1);
                }
            }
        };
        pages.forEach(file => {
            pushAssets(file, this._pagesJsAssets, this._pagesCssAssets, this._pagesSwanAssets, this._pagesJsonAssets);
        });

        subPackages.forEach(subPackage => {
            const { root, pages } = subPackage;
            pages.forEach(file => {
                const rFile = _path2.default.join(root, file);
                pushAssets(rFile, this._subJsAssets, this._subCssAssets, this._subSwanAssets, this._subJsonAssets);
            });
        });
        const getComponentsPath = this.getComponentsFiles(workPath, this._pagesJsonMap, this._cAssets, this._cycleCustomComponents, this._pagesJsonAssets);
        const componentsPath = getComponentsPath(this._pagesJsonAssets.concat(this._subJsonAssets));
        componentsPath.forEach(file => {
            const jsFile = `${file}.js`;
            const cssFile = `${file}.css`;
            const swanFile = `${file}.swan`;
            const jsonFile = `${file}.json`;
            pushComponents(jsFile, cssFile, jsonFile, swanFile);
            if (/node_modules/.test(jsonFile)) {
                this._jsonAssets.push(jsonFile);
            }
        });
        let allJsAssets;
        if (MODULE === 'cmd') {
            allJsAssets = [...this._appJs, ...this._pagesJsAssets, ...this._cJsAssets, ...this._subJsAssets];
        } else {
            allJsAssets = this._jsAssets;
        }
        const allJsonAssets = this._jsonAssets;
        const allCssAssets = [...this._appCss, ...this._pagesCssAssets, ...this._cCssAssets, ...this._subCssAssets];
        const allSwanAssets = [...this._pagesSwanAssets, ...this._cSwanAssets, ...this._subSwanAssets];
        const jsEntryContent = this.concatContent(allJsAssets);
        const cssEntryContent = this.concatContent(allCssAssets);
        const swanEntryContent = this.concatContent(allSwanAssets);
        const jsonEntryContent = this.concatContent(allJsonAssets);
        const writeFileObj = {
            'app': jsEntryContent,
            'css-entry': cssEntryContent,
            'swan-entry': swanEntryContent,
            'json-entry': jsonEntryContent
        };

        _fsExtra2.default.ensureDirSync(WEB_ENTRY_DIR_PATH);
        Object.keys(writeFileObj).forEach(key => {
            const filePath = _path2.default.join(WEB_ENTRY_DIR_PATH, `${key}.js`);
            this._entry[key] = filePath;
            _fsExtra2.default.writeFileSync(filePath, writeFileObj[key]);
        });
        this._workJs = allJsAssets;
    }

    pushFiles(files, dest) {
        const pushFile = file => {
            if (_fsExtra2.default.existsSync(file) && dest.indexOf(file) === -1) {
                dest.push(file);
            }
        };
        if (typeof files === 'string') {
            pushFile(files);
        } else if (Array.isArray(files)) {
            files.forEach(fileItem => {
                pushFile(fileItem);
            });
        }
    }

    getFiles(path, type) {
        try {
            let files = _glob2.default.sync(`${path}/{,!(node_modules)/**/}*.${type}`);
            files.map(file => {
                return (0, _util.formatPath)(file);
            });
            return files;
        } catch (e) {
            if (e && e.code === 'EACCES') {
                const errMsg = `请确认 ${e.path} 有可读、可执行权限!否则会影响程序的正确运行!`;
                (0, _util.errorNext)(errMsg, 0, 1);
            }
            return [];
        }
    }

    getComponentsFiles(workPath, pagesJsonMap = {}, cAssets = [], cycleCustomComponents = [], pagesJsonAssets = []) {
        const componentsPath = [];
        const _this = this;
        return function getComponentsPath(_jsonAssets = []) {
            _jsonAssets.forEach(file => {
                try {
                    const fileContent = _fsExtra2.default.readFileSync(file, 'utf8');
                    if (fileContent.trim()) {
                        const jsonObj = JSON.parse(fileContent);
                        const usingComponents = jsonObj.usingComponents || {};
                        const pageKey = _this.getPageKey(workPath, file);
                        const pageUsingComponent = {
                            isComponents: false,
                            usingComponents: []
                        };
                        if (pagesJsonAssets.indexOf(file) > -1) {
                            pageUsingComponent.isComponents = jsonObj.component || false;
                        }
                        Object.keys(usingComponents).forEach(key => {
                            const val = usingComponents[key];
                            const aPath = _this.getCustomComponentsAbsolutePath(val, workPath, file);
                            if (aPath) {
                                const rPath = (0, _util.formatPath)(_path2.default.relative(workPath, aPath));
                                const aPathJson = `${aPath}.json`;
                                if (file !== aPathJson && _fsExtra2.default.existsSync(aPathJson)) {
                                    pageUsingComponent.usingComponents.push(rPath);
                                    const jsonPath = (0, _util.formatPath)(`${aPath}.json`);
                                    if (file.indexOf(rPath) > -1 && cycleCustomComponents.indexOf(rPath) === -1) {
                                        cycleCustomComponents.push(rPath);
                                    }
                                    if (cAssets.indexOf(rPath) > -1) {
                                        cAssets.splice(cAssets.indexOf(rPath), 1);
                                        cAssets.unshift(rPath);
                                    } else {
                                        cAssets.unshift(rPath);
                                        componentsPath.push(aPath);
                                        getComponentsPath([jsonPath]);
                                    }
                                }
                            }
                        });
                        if (!pagesJsonMap[pageKey]) {
                            pagesJsonMap[pageKey] = pageUsingComponent;
                        }
                    }
                } catch (err) {
                    err.message = `${file}, ${err.message}`;
                    (0, _util.errorNext)(err, 0, 1);
                }
            });
            return componentsPath;
        };
    }

    getPageKey(workPath, filePath) {
        const rPath = (0, _util.formatPath)(_path2.default.relative(workPath, filePath));
        const extname = _path2.default.extname(rPath);
        return rPath.replace(extname, '');
    }

    getCustomComponentsAbsolutePath(name, base, fileBase) {
        let aPath = '';
        if (_path2.default.isAbsolute(name)) {
            aPath = _path2.default.join(base, name);
        } else {
            const rDir = _path2.default.dirname(fileBase);
            aPath = _path2.default.resolve(rDir, name);
            if (!_fsExtra2.default.existsSync(`${aPath}.js`)) {
                aPath = (0, _util.findInNodeModules)(fileBase, base, name);
            }
        }
        if (!aPath) {
            const errMsg = `${fileBase} use ${name} error, The component was not found`;
            const err = new Error(errMsg);
            (0, _util.errorNext)(err, 0, 1);
        }
        return (0, _util.formatPath)(aPath);
    }

    checkWork(workPath) {
        const necessaryFiles = ['app.json', 'app.js'];
        necessaryFiles.forEach(file => {
            const lFile = _path2.default.join(workPath, file);
            if (!_fsExtra2.default.existsSync(lFile)) {
                const errMsg = `${workPath} 编译失败，缺少 ${file} 文件`;
                const errObj = new Error(errMsg);
                (0, _util.log)(errMsg, 'error');
                (0, _util.errorNext)(errObj, 0, 1);
            }
        });
    }

    concatContent(filesPath) {
        const fileArr = [];
        let res = '';
        if (typeof filesPath === 'string') {
            fileArr.push(filesPath);
        } else if (Array.isArray(filesPath)) {
            fileArr.push(...filesPath);
        }
        fileArr.forEach(path => {
            if (_fsExtra2.default.existsSync(path)) {
                res += (0, _util.formatPath)(`require('${path}');\n`);
            }
        });
        return res;
    }
}
exports.default = GengrateEntry; /* eslint-enable max-len */