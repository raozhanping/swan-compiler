/**
 * @file utils/mvHtmlTpl 移动模拟器加载模板
 * @author Zhangxiaosong<zhangxiaosong01@baidu.com>
 */

const fs = require('fs');
const path = require('path');
const log = require('./log');

/**
 * 拷贝文件夹
 *
 * @param {string} source - 需要 copy 的源文件地址<type: dir | file>
 * @param {string} target - copy 文件的存放地址<type: dir>
 *
 * @return {null} null
 */
module.exports = function copyFiles(source, target) {
    return new Promise((resolve, reject) => {
        let stats = fs.statSync(source);
        let files = stats.isDirectory() ? fs.readdirSync(source) : [source];
        files.forEach((file, idx) => {
            fs.copyFile(path.join(source, file), path.join(target, file), err => {
                if (err) {
                    log({method: 'log', level: 'warn', value: `${err}`});
                    reject(`执行出错: ${err}`);
                    return;
                }
                if (idx === files.length - 1) {
                    resolve();
                }
            });
        });
    });
};
