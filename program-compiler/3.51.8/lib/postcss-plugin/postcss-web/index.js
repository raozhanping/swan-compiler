'use strict';

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file postcss-web 对 fixed 转换 和 url 路径转换
 * @author yangjingjiu
 */

const postcss = require('postcss');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');
const md5File = require('md5-file');
const util = require('../../util');

module.exports = postcss.plugin('postcss-web', opts => {
    return root => {
        const filePath = util.formatPath(root.source.input.file);
        const encludeSelectors = ['body', 'html', '*'];
        const filePathNoExtension = filePath.replace(/\.css$/g, '');
        const { needMd5ClassFile, workPath, staticPrefix, webEnv } = opts;
        let cssRPath = path.relative(workPath, filePath);
        const classMd5Flag = needMd5ClassFile.indexOf(filePath) > -1 ? true : false;
        root.walkRules(rule => {
            let fixedTop = false;
            rule.nodes.forEach(n => {
                if (n.prop === 'top' && n.value.indexOf('0') === 0) {
                    fixedTop = true;
                }
            });
            rule.nodes.forEach(n => {
                if (n.value && n.value.indexOf('fixed') >= 0 && fixedTop) {
                    n.value = n.value.replace(/fixed/g, 'absolute');
                }
            });
            rule.selectors = rule.selectors.map(selector => {
                // 只对page中的html和body做特殊处理
                if (encludeSelectors.indexOf(selector) >= 0 && classMd5Flag) {
                    const scope = 'scope' + crypto.createHash('md5').update(filePathNoExtension).digest('hex').slice(0, 8);
                    if ('html' === selector || 'body' === selector) {
                        return `${selector}.${scope}`;
                    } else {
                        return '*';
                    }
                } else if (classMd5Flag) {
                    const hash = crypto.createHash('md5');
                    hash.update(filePathNoExtension);
                    return `.scope${hash.digest('hex').slice(0, 8)} ${selector}`;
                }
                // 给app.css通用样式增加权重
                else if ('app.css' === cssRPath && !encludeSelectors.includes(selector)) {
                        return `.web-swan-app ${selector}`;
                    } else {
                        return selector;
                    }
            });
        });

        // const vhReg = new RegExp('(-?\\d+(\\.\\d+)?)vh', 'g');
        // root.replaceValues(vhReg, (str, num) => {
        //     return `calc(${num} * (100vh - 44px) / 100)`;
        // });

        root.replaceValues(/url\(('?"?)(.*?)\1\)/g, ($0, $1, $2) => {
            if ($2.match(/^http|^\/\//)) {
                return `url(${$2})`;
            } else if ($2.match(/^data:/)) {
                return `url(${$1}${$2}${$1})`;
            } else {
                try {
                    const pathArr = $2.split('?');
                    const realPath = pathArr[0];
                    const pathQuery = pathArr[1] || '';
                    const sourcePath = util.formatPath(path.resolve(workPath, path.dirname(filePath), realPath));
                    let imgSrcRes;
                    if (fs.existsSync(sourcePath)) {
                        const hash = md5File.sync(sourcePath).slice(0, 10);
                        const extname = path.extname(realPath);
                        const basename = path.basename(realPath, extname);
                        if (webEnv === 'production' || webEnv === 'development') {
                            imgSrcRes = `${basename}_${hash}${extname}`;
                        } else {
                            imgSrcRes = `${basename}${extname}`;
                        }
                        /* eslint-disable max-len */
                        const relativePath = util.formatPath(path.relative(workPath, path.resolve(path.dirname(filePath), path.dirname(realPath))));
                        /* eslint-enable max-len */
                        const lastPath = staticPrefix + util.formatPath(path.join(relativePath, imgSrcRes));
                        return `url(${lastPath}?${pathQuery})`;
                    } else {
                        return `url(${$2})`;
                    }
                } catch (error) {
                    // console.log(error);
                }
            }
        });
    };
});