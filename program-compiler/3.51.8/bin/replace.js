/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file web 白屏检测模式下文件内容替换
 * @author yangjingjiu
 */

const glob = require('glob');
const replaceStream = require('replacestream');
const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const intoStream = require('into-stream');

const ce = require('./caughtException');
const util = require('../lib/util');
const argv = require('minimist')(process.argv.slice(2));
const inputDirPath = argv['input'];
const outputDirPath = argv['output'];
const appKey = argv['app-key'];
const ONLINE_HOST = 'https://b.bdstatic.com/miniapp';
const staticPrefix = `${ONLINE_HOST}/webpackage/${appKey}`;
const masterTplPath = path.resolve(__dirname, '../globals/web/master.tpl');
const indexTplPath = path.resolve(__dirname, '../globals/web/index.tpl');

function checkDir(dir) {
    if (!fs.existsSync(dir)) {
        errorNext(`${dir} isn't exist! Please assign existed directory!`);
    }
    const stats = fs.lstatSync(dir);
    if (!stats.isDirectory()) {
        errorNext(`${dir} shoul be a Directory!`);
    }
}

function getAbsolutePath(dirPath) {
    if (!path.isAbsolute(dirPath)) {
        return path.resolve(process.cwd(), dirPath);
    }
    return dirPath;
}

function getAllFiles(base, cwd) {
    return new Promise((resolve, reject) => {
        glob(base, {cwd: cwd}, (err, matches) => {
            err && reject(err);
            resolve(matches);
        });
    });
}

function checkArg(val, name) {
    if (typeof appKey !== 'string') {
        errorNext(`${val} is error! Please assign ${name}!`);
    }
}

function errorNext(err) {
    console.error(err);
    process.exit(1);
}

try {
    const startTime = Date.now();
    const commands = {
        'app-key': appKey,
        input: inputDirPath,
        output: outputDirPath
    };

    Object.keys(commands).forEach(key => {
        checkArg(commands[key], key);
    });

    const aInputDirPath = getAbsolutePath(inputDirPath);
    const aOutputDirPath = getAbsolutePath(outputDirPath);

    checkDir(aInputDirPath);
    fs.ensureDirSync(aOutputDirPath);
    fs.emptyDirSync(aOutputDirPath);

    getAllFiles('*', aInputDirPath)
        .then(files => {
            const filters = files.filter(file => {
                const fileReg = /developer_.+\.(js|css)/;
                if (fileReg.exec(file) || file === 'manifest.json') {
                    return true;
                }
                return false;
            });
            return filters;
        })
        .then(files => {
            const pArr = [];
            files.forEach(file => {
                pArr.push(new Promise((resolve, reject) => {
                    const filePath = path.resolve(aInputDirPath, file);
                    const outputFilePath = path.resolve(aOutputDirPath, file);
                    const writeStream = fs.createWriteStream(outputFilePath);
                    const readStream = fs.createReadStream(filePath);
                    readStream
                        .pipe(replaceStream(staticPrefix, ''))
                        .pipe(writeStream);
                    writeStream.on('finish', () => {
                        resolve();
                    });
                    writeStream.on('error', err => {
                        reject(err);
                    });
                    readStream.on('error', err => {
                        reject(err);
                    });
                }));
            });
            return Promise.all(pArr);
        })
        .then(async () => {
            fs.copySync(aInputDirPath, aOutputDirPath, {
                overwrite: false
            });
            const masterTplContent = fs.readFileSync(masterTplPath, 'utf8');
            const indexTplContent = fs.readFileSync(indexTplPath, 'utf8');
            const manifestFilePath = path.resolve(aOutputDirPath, 'manifest.json');
            let manifest = fs.readJSONSync(manifestFilePath);
            if (!manifest['master.js'] || !manifest['slave.js'] || !manifest['frame.css']) {
                let webCorePath = path.resolve(__dirname, '../node_modules/@baidu/swan-web');
                const swanWebDistPath = path.resolve(webCorePath, 'package.json');
                let webPackageJson = await fs.readJson(swanWebDistPath);
                let version = `v${webPackageJson.version}`;
                let webDistFiles = await fs.readdir(path.resolve(webCorePath, 'dist/swan-web', version));
                let webCorePaths = webDistFiles.reduce((prev, current) => {
                    if (current.startsWith('master')) {
                        prev['master.js'] = path.resolve(webCorePath, 'dist/swan-web', version, current);
                    }
                    else if (current.startsWith('slave')) {
                        prev['slave.js'] = path.resolve(webCorePath, 'dist/swan-web', version, current);
                    }
                    else if (current.startsWith('frame')) {
                        prev['frame.css'] = path.resolve(webCorePath, 'dist/swan-web', version, current);
                    }
                    return prev;
                }, {});
                const copyWebCoreList = ['master.js', 'slave.js', 'frame.css'];
                copyWebCoreList.forEach(i => {
                    manifest[i] = `/${i}`;
                });
                let copyWebCoreMission = copyWebCoreList.map(webCore => {
                    return fs.copy(webCorePaths[webCore], path.resolve(aOutputDirPath, webCore));
                });
                await Promise.all(copyWebCoreMission);
            }
            const masterPath = path.resolve(aOutputDirPath, 'master.html');
            const indexPath = path.resolve(aOutputDirPath, 'index.html');
            const masterFile = fs.createWriteStream(masterPath);
            const indexFile = fs.createWriteStream(indexPath);
            const htmlInfo = {
                $mapArray: manifest,
                $data: {
                    appKey: appKey
                }
            };
            const masterHtmlContent = ejs.render(masterTplContent, htmlInfo);
            const indexHtmlContent = ejs.render(indexTplContent, htmlInfo);
            const masterStream = intoStream(masterHtmlContent);
            const indexStream = intoStream(indexHtmlContent);
            const streamArr = [];
            const newPromise = function (rStream, wStream) {
                return new Promise((resolve, reject) => {
                    rStream.pipe(wStream);
                    rStream.on('end', () => {
                        resolve();
                    });
                    rStream.on('error', err => {
                        reject(err);
                    });
                });
            };
            streamArr.push(newPromise(masterStream, masterFile));
            streamArr.push(newPromise(indexStream, indexFile));
            return Promise.all(streamArr);
        })
        .then(() => {
            const constTime = (Date.now() - startTime) / 1000;
            console.log(constTime);
            util.log(`Success! Cost Time:  ${constTime} ' seconds!`);
            util.compilationProgress('end');
        })
        .catch(err => {
            errorNext(err);
        });
} catch (err) {
    errorNext(err);
}

