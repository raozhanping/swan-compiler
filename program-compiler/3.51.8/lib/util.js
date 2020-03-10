'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.mkdirs = mkdirs;
exports.compilationProgress = compilationProgress;
exports.formatPath = formatPath;
exports.formatPath2 = formatPath2;
exports.log = log;
exports.displayFiles = displayFiles;
exports.removeDir = removeDir;
exports.readJSONContent = readJSONContent;
exports.exist = exist;
exports.writeJson = writeJson;
exports.findInNodeModules = findInNodeModules;
exports.errorNext = errorNext;
exports.noWatchErrorNext = noWatchErrorNext;
exports.relativePath = relativePath;
exports.isArray = isArray;
exports.isString = isString;
exports.chunkArr2Map = chunkArr2Map;
exports.mfsEnsureDirSync = mfsEnsureDirSync;
exports.mfsReadJson = mfsReadJson;
exports.mfsWriteJson = mfsWriteJson;
exports.mfsCopy = mfsCopy;
exports.md5Str = md5Str;
exports.fsWalker = fsWalker;
exports.getAssetPath = getAssetPath;
exports.readFile = readFile;
exports.sizeof = sizeof;
exports.cacheKey = cacheKey;
exports.getCacheDiskCommonOption = getCacheDiskCommonOption;
exports.getCacheDiskOption = getCacheDiskOption;
exports.arrayChunk = arrayChunk;
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 编译工具文件
 * @author zhuxin04
 */
const fs = require('fs-extra');
const path = require('path');
const promisify = require('util.promisify');
const ce = require('../bin/caughtException');
const createHash = require('crypto').createHash;
const StdMsg = require('@liuyuekeng/stdmsg').default;
const swanCliArgv = global.SWAN_CLI_ARGV || {};
const {
    CACHE_DIRECTORY,
    BUILD_TYPE,
    LOADER_VERSION,
    IGNORE_PREFIX_CSS
} = swanCliArgv;
const { SPECIAL_COMPONENT_START } = require('./constant');
const specialUsingComponents = SPECIAL_COMPONENT_START;
const { AppJsonIllegal } = require('./errors');

const pathJoin = exports.pathJoin = path.join;

function mkdirs(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else if (mkdirs(path.dirname(dirname))) {
        fs.mkdirSync(dirname);
        return true;
    }
}

let stdMsg;
function getStdMsg() {
    stdMsg = stdMsg || new StdMsg('swanCompilation', 'swanIdeCli', process.stdin, process.stdout);
    return stdMsg;
}
function compilationProgress(progress, value = {}) {
    const method = 'compilation';
    if (process.send) {
        process.send({ method, progress, value });
    }
    if (swanCliArgv && swanCliArgv.PORT) {
        stdMsg = getStdMsg();
        stdMsg.send({
            type: `compile.${progress}`,
            data: value
        });
        if (global.__DEV__) {
            console.log(progress, JSON.stringify(value));
        }
    } else if (global.__DEV__) {
        console.log(progress, JSON.stringify(value));
    } else {
        console.log(`PROGRESS__${progress}__${JSON.stringify(value)}`);
    }
}

function formatPath(pathStr) {
    if (!pathStr) {
        pathStr = '';
    }
    const arr = pathStr.split(path.sep);
    return arr.join('/');
}

function formatPath2(pathStr) {
    if (!pathStr) {
        pathStr = '';
    }
    const arr = pathStr.split('/');
    return arr.join('\\');
}

function decorateNum(num) {
    return num < 10 ? '0' + num : num;
}

function formatDate(parmaDate = new Date()) {
    const year = parmaDate.getFullYear();
    const month = decorateNum(parmaDate.getMonth() + 1);
    const day = decorateNum(parmaDate.getDate());
    const hours = decorateNum(parmaDate.getHours());
    const minutes = decorateNum(parmaDate.getMinutes());
    const seconds = decorateNum(parmaDate.getSeconds());
    return `[ ${year}-${month}-${day} ${hours}:${minutes}:${seconds} ]`;
}

function log(value, level = 'log') {
    const method = 'log';
    value = '' + formatDate() + ': ' + value;
    if (process.send) {
        process.send({ method, level, value });
    }
    if (swanCliArgv && swanCliArgv.PORT) {
        stdMsg = getStdMsg();
        stdMsg.send({
            type: 'log',
            data: { value, level: level.toLowerCase() }
        });
        if (global.__DEV__) {
            console.log(value);
        }
    } else {
        const encodeMessage = encodeURIComponent(`LOG__${level}__${value}`);
        if (global.__DEV__) {
            console.log(value);
        } else {
            console.log(encodeMessage);
        }
    }
}

function displayFiles(path, reg, ignoreSearchPaths) {
    if (ignoreSearchPaths && ignoreSearchPaths.length) {
        ignoreSearchPaths = ignoreSearchPaths.map(ignorePattern => {
            return pathJoin(path, ignorePattern);
        });
    }
    let files = [];

    function walk(walkPath) {
        let dirList = fs.readdirSync(walkPath);
        dirList.forEach(item => {
            let itemPath = pathJoin(walkPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
                if (!ignoreSearchPaths || ignoreSearchPaths && !~ignoreSearchPaths.indexOf(itemPath)) {
                    walk(itemPath);
                }
            } else if (reg) {
                reg.test(itemPath) && files.push(itemPath);
            } else {
                files.push(itemPath);
            }
        });
    }

    walk(path);
    return files;
}

function removeDir(path) {
    fs.removeSync(path);
}

function readJSONContent(filepath) {
    return new Promise(resolve => {
        promisify(fs.readFile)(filepath, 'utf-8').then(buffer => {
            resolve(JSON.parse(buffer.toString()));
        }).catch(() => {
            resolve({});
        });
    });
}

function exist(filepath) {
    return promisify(fs.access)(filepath, fs.constants.F_OK).then(() => true).catch(() => false);
}

function writeJson(filePath, content, cb) {
    return new Promise(resolve => {
        promisify(fs.writeFile)(filePath, content).then(() => {
            resolve();
        }).catch(() => {
            resolve();
        });
    });
}

function findInNodeModules(usingJsonPath, workPath, name, ext = '') {
    try {
        const jsonPath = path.join(workPath, 'node_modules', name, 'package.json');
        let packageJson;
        let errMsg;
        try {
            packageJson = fs.readJsonSync(jsonPath);
        } catch (err) {
            errMsg = `${usingJsonPath} use ${name} error, The component was not found`;
            log(errMsg, 'error');
        }
        if (packageJson && packageJson.name) {
            const parsedPath = path.parse(packageJson.main);
            const fileName = parsedPath.name;
            const dir = parsedPath.dir;
            const file = ext ? `${fileName}.${ext}` : fileName;
            return path.join(workPath, 'node_modules', name, dir, file);
        }
    } catch (err) {
        log(err);
    }
}

function errorNext(err, type, level) {
    const isWatch = swanCliArgv.IS_WATCH;
    if (isWatch) {
        log(err, 'error');
    } else {
        noWatchErrorNext(err, type, level);
    }
}

function noWatchErrorNext(err, type, level) {
    const errMsg = ce.handleErrMsg(err, type, level);
    console.error(errMsg);
    process.exit(1);
}

function relativePath(basePath = '', filePath = '') {
    return formatPath(path.relative(basePath, filePath));
}

const toString = Object.prototype.toString;

function isArray(obj) {
    return '[object Array]' === toString.call(obj);
}

function isString(obj) {
    return '[object String]' === toString.call(obj);
}

const MEDIA_TYPE_ARRY = exports.MEDIA_TYPE_ARRY = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'gif', 'GIF', 'bmp', 'BMP', 'svg', 'SVG', 'mp4', 'MP4', '3gp', '3GP', 'avi', 'AVI', 'mrk', 'MRK', 'wmv', 'WMV', 'mpg', 'MPG', 'vob', 'VOB', 'flv', 'FLV', 'swf', 'SWF', 'mov', 'MOV', 'xv', 'XV', 'rmvb', 'RMVB', 'mkv', 'MKV', 'f4v', 'F4V', 'qsv', 'QSV', 'ttf', 'TTF', 'woff', 'WOFF', 'wav', 'WAV', 'flac', 'FLAC', 'ape', 'APE', 'alac', 'ALAC', 'WavPack', 'WV', 'wv', 'MP3', 'mp3', 'AAC', 'aac', 'opus', 'Opus', 'BWF', 'bwf', 'AIFF', 'aiff'];

const PLUGIN_DOC_TYPE_ARRY = exports.PLUGIN_DOC_TYPE_ARRY = ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG', 'gif', 'GIF', 'md', 'MD'];

const MEDIA_TYPE = exports.MEDIA_TYPE = `**/*.+(${MEDIA_TYPE_ARRY.join('|')}|)`;

const PLUGIN_DOC_TYPE = exports.PLUGIN_DOC_TYPE = `**/*.+(${PLUGIN_DOC_TYPE_ARRY.join('|')}|)`;

const MEDIA_TYPE_REG_EXP = exports.MEDIA_TYPE_REG_EXP = new RegExp(MEDIA_TYPE_ARRY.join());

// TODO: extend memory-fs
function chunkArr2Map(chunks) {
    let chunkMap = {};
    chunks.forEach(chunk => {
        chunkMap[chunk.id] = chunk;
    });
    return chunkMap;
}

function mfsEnsureDirSync(fs, dir) {
    let exists = fs.existsSync(dir);
    if (!exists) {
        fs.mkdirpSync(dir);
    }
}

function mfsReadJson(fs, file) {
    let data = fs.readFileSync(file);
    let obj = JSON.parse(data);
    return obj;
}

function mfsWriteJson(fs, file, obj) {
    let data = JSON.stringify(obj);
    fs.writeFileSync(file, data);
}

function mfsCopy(sourceFs, sourcePath, targetFs, targetPath) {
    targetFs.writeFileSync(targetPath, sourceFs.readFileSync(sourcePath));
}

const random = exports.random = () => Date.now().toString() + Math.random().toString().slice(2);

function md5Str(str) {
    return createHash('md5').update(str).digest('hex');
}

function fsWalker(fs, dir, callback) {
    let stats = fs.statSync(dir);
    if (stats.isDirectory()) {
        callback(dir, stats);
        let files = fs.readdirSync(dir);
        files.forEach(file => {
            fsWalker(fs, path.join(dir, file), callback);
        });
    } else if (stats.isFile()) {
        callback(dir, stats);
    }
}

const ALL_IMPORTED_CSS = exports.ALL_IMPORTED_CSS = {
    'swan': {},
    'plugin': {},
    'dynamicLib': {}
};

function getAssetPath(basePath, userPath = '', workPath = '') {
    if (!userPath) {
        return '';
    }
    let assetPath = userPath;
    if (path.isAbsolute(userPath)) {
        if (!~userPath.indexOf(workPath)) {
            assetPath = path.join(workPath, userPath);
        }
    } else {
        assetPath = path.resolve(path.dirname(basePath), userPath);
    }
    return formatPath(assetPath);
}

const TEMPLATE_OBJ = exports.TEMPLATE_OBJ = {
    swan: '',
    custom: '',
    runtime: '',
    dynamicLibCss: '',
    dynamicLibCustom: '',
    pluginSwan: ''
};

function readFile(filePath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf-8', function (err, content) {
            if (err) {
                reject(err);
            }
            resolve(content);
        });
    });
}
function sizeof(str) {
    const len = str.length;
    let total = 0;
    let charCode;
    for (let i = 0; i < len; i++) {
        charCode = str.charCodeAt(i);
        if (charCode <= 0x007f) {
            total += 1;
        } else if (charCode <= 0x07ff) {
            total += 2;
        } else if (charCode <= 0xffff) {
            total += 3;
        } else {
            total += 4;
        }
    }
    return total;
}

function digest(str) {
    return createHash('md5').update(str).digest('hex');
}

function cacheKey(request) {
    const loaderVersion = swanCliArgv.LOADER_VERSION;
    const hash = digest(`${loaderVersion}\n${request}`);
    return path.join(swanCliArgv.CACHE_DIRECTORY, `${hash}.json`);
}

function getCacheDiskCommonOption(type) {
    let CACHE_DISK_COMMON_OPTION = {
        cacheDirectory: CACHE_DIRECTORY,
        cacheIdentifier: `cache-loader:{version} {process.env.NODE_ENV} ${LOADER_VERSION}`
    };
    if ('dynamicLib' === type) {
        CACHE_DISK_COMMON_OPTION.cacheType = 'dynamicLib';
    } else if ('plugin' === type) {
        CACHE_DISK_COMMON_OPTION.cacheType = 'plugin';
    }
    return CACHE_DISK_COMMON_OPTION;
};

function getCacheDiskOption(type) {
    let CACHE_DISK_OPTION = {
        cacheDirectory: CACHE_DIRECTORY,
        cacheIdentifier: `cache-loader:{version} {process.env.NODE_ENV} ${BUILD_TYPE} ${LOADER_VERSION} ${IGNORE_PREFIX_CSS}`
    };
    if ('dynamicLib' === type) {
        CACHE_DISK_OPTION.cacheType = 'dynamicLib';
    } else if ('plugin' === type) {
        CACHE_DISK_OPTION.cacheType = 'plugin';
    }
    return CACHE_DISK_OPTION;
};

function arrayChunk(arr, chunkSize = 1) {
    let len = arr.length;
    let chunkCount = Math.ceil(len / chunkSize);
    let res = [];
    for (let i = 0; i < chunkCount; i++) {
        let start = i * chunkSize;
        let end = start + chunkSize;
        res.push(arr.slice(start, end));
    }
    return res;
}

const getSpecialUsingComponent = exports.getSpecialUsingComponent = componentPath => {
    for (let i = 0; i < specialUsingComponents.length; i++) {
        if (componentPath.startsWith(specialUsingComponents[i])) {
            const specialType = specialUsingComponents[i].slice(0, -3);
            return {
                isSpecial: true,
                specialType,
                appJsonFlag: 'dynamicLib' === specialType ? 'dynamicLib' : 'plugins'
            };
        }
    }
    return {
        isSpecial: false
    };
};

const copyFromFsToMemoryFs = exports.copyFromFsToMemoryFs = (mfs, src, dest) => {
    let destParent = path.dirname(dest);
    !mfs.existsSync(destParent) && mfs.mkdirpSync(destParent);
    let stats = fs.statSync(src);
    if (stats.isDirectory()) {
        onDir(mfs, src, dest);
    } else if (stats.isFile()) {
        onFile(mfs, src, dest);
    }
};

function onDir(mfs, src, dest) {
    !mfs.existsSync(dest) && mfs.mkdirpSync(dest);
    fs.readdirSync(src).forEach(item => copyFromFsToMemoryFs(mfs, path.join(src, item), path.join(dest, item)));
}
function onFile(mfs, src, dest) {
    mfs.writeFileSync(dest, fs.readFileSync(src));
}

const checkSubPackagesConf = exports.checkSubPackagesConf = conf => {
    let subPackages = conf.subPackages || conf.subpackages;
    if (!subPackages) {
        return;
    }
    if (!Array.isArray(subPackages)) {
        throw new AppJsonIllegal('subPackages字段值类型不为数组');
    }
    if (!subPackages.length) {
        return;
    }
    let subPackageRoots = subPackages.map(subPackage => subPackage.root);
    // 分包root不应该重复，或者包含关系
    subPackageRoots.reduce((r, v, k) => {
        if ('string' !== typeof v) {
            throw new AppJsonIllegal(`subPackages[${k}]["root"] 必须为字符串类型`);
        } else if (r[v] !== undefined) {
            throw new AppJsonIllegal(`subPackages[${k}]["root"] 与 subPackages[${r[v]}]["root"] 不允许相同`);
        } else {
            Object.keys(r).forEach((vv, kk) => {
                if (pathConflict(v, vv)) {
                    let sub = v.length > vv.length ? k : kk;
                    let par = v.length > vv.length ? kk : k;
                    throw new AppJsonIllegal(`subPackages[${sub}]["root"] 不允许为 subPackages[${par}]["root"] 的子目录`);
                }
            });
        }
        r[v] = k;
        return r;
    }, {});
    // 主包页面不应包含在分包中
    conf.pages.forEach(page => {
        let dir = path.dirname(page);
        let index = subPackageRoots.findIndex(subRoot => dir.startsWith(subRoot));
        if (index > -1) {
            throw new AppJsonIllegal(`page "${page}" 不允许存在于 subPackages[${index}] "${subPackageRoots[index]}" 中`);
        }
    });
    // 判断路径是否重叠
    function pathConflict(a, b) {
        let arrayA = a.split('/');
        let arrayB = b.split('/');
        let short = arrayA.length < arrayB.length ? arrayA : arrayB;
        return short.every((v, k) => arrayA[k] === arrayB[k]);
    }
};

const unionArray = exports.unionArray = function (arr) {
    return Array.from(new Set(arr));
};

const getSameKeysInTwoObjects = exports.getSameKeysInTwoObjects = (obj1, obj2) => {
    return Object.keys(obj1).filter(key => Object.keys(obj2).includes(key));
};