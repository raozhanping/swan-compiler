/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 压缩文件
 * @author zhuxin04
 */
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const promisify = require('util').promisify;
const UglifyJS = require('uglify-js');
const mkdirp = require('mkdirp');
const argv = require('minimist')(process.argv.slice(2));
const inputDir = argv['input'];
const outputPath = argv['output'];
const util = require('../lib/util');
util.compilationProgress('start');
if (!fs.existsSync(inputDir)) {
    util.log(`${inputDir} isn't exist! Please assign existed directory!`);
    return;
}
const stats = fs.lstatSync(inputDir);
if (stats.isFile()) {
    util.log(`${inputDir} shoul not be a file, instead of Directory`);
    return;
}
function getAllFiles() {
    return new Promise((resolve, reject) => {
        glob('**/*', {cwd: inputDir}, (err, matches) => {
            err && reject(err);
            resolve(matches);
        });
    });
}



function minifyContent(filePath, key) {
    return promisify(fs.readFile)(filePath, 'utf-8').then(content => {
        let fileContent = content;
        if (!(/^globals\//.test(key))) {
            const result = UglifyJS.minify(content);
            fileContent = result.code;
            if (result.error) {
                util.log(result.error, 'error');
            } else {
                util.log(`Compressing ${key} ...`);
            }
        }
        return {
            key,
            content: fileContent
        };
    }).catch(e => {
        console.log(`${filePath}: `, e);
    });
}
const startTime = Date.now();

getAllFiles().then(files => {
    const filePromiseArr = [];
    files.forEach(fileItem => {
        const filePath = path.resolve(inputDir, fileItem);
        let itemPromise;
        if (fs.statSync(filePath).isFile()) {
            if (path.extname(filePath) === '.js') {
                itemPromise = minifyContent(filePath, fileItem);
            } else {
                itemPromise = new Promise(resolve => {
                    resolve({
                        type: 'copy',
                        key: fileItem
                    });
                });
            }
            filePromiseArr.push(itemPromise);
        }
    });
    Promise.all(filePromiseArr).then(args => {
        const promiseArr = [];
        args.forEach(item => {
            const itemDir = path.dirname(item.key);
            const destDir = path.resolve(outputPath, itemDir);
            const destPath = path.resolve(outputPath, item.key);
            mkdirp.sync(destDir);
            let promiseItem;
            if (item.type) {
                const sourcePath = path.resolve(inputDir, item.key);
                promiseItem = promisify(fs.copy)(sourcePath, destPath)
                    .then(() => true)
                    .catch(e => {
                        console.log(`${destPath}: `, e);
                    });
            } else {
                promiseItem = promisify(fs.writeFile)(destPath, item.content, {})
                    .then(() => true)
                    .catch(e => {
                        console.log(`${destPath}: `, e);
                    });
            }
            promiseArr.push(promiseItem);
        });
        Promise.all(promiseArr).then(() => {
            const constTime = (Date.now() - startTime) / 1000;
            util.log(`Success! Cost Time:  ${constTime} ' seconds!`);
            util.compilationProgress('end');
        });
    }).catch(err => {
        console.log(err);
    });
});