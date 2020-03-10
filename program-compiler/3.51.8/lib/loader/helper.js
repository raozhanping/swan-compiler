'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.parser = parser;
exports.getTemplateTagName = getTemplateTagName;
exports.attribsToString = attribsToString;
exports.nodeToString = nodeToString;
/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理swan文件的工具类
 * @author zhuxin04@gmial.com
 */

const { Parser, DomHandler: Handler } = require('stricter-htmlparser2');
const Md5 = require('md5.js');
const defaultOptions = {
    xmlMode: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
    lowerCaseTags: false
};
let templateIndex = 1;

// 参考了san生成id前缀的方式
const templateTagNamePrefix = new Date().getTime().toString(16).slice(8);

const join = (...args) => args.filter(arg => !!arg).join(' ');

function parser(swanStr) {
    let handler = new Handler();
    new Parser(handler, defaultOptions).end(swanStr);
    return handler.dom;
}

function getTemplateTagName(templateName = '') {
    const postfix = new Md5().update(templateName).digest('hex').slice(0, 8);
    return `template-${postfix}`;
    // return `template-${templateTagNamePrefix}${templateIndex++}`;
}

function attribsToString(attrs, singleQuoteAttribs) {
    if (!attrs) {
        return '';
    }
    const allAttr = [];
    for (let key in attrs) {
        let value = attrs[key];
        const quote = singleQuoteAttribs[key] ? '\'' : '"';

        if (quote === '"' && value.indexOf('\\"') >= 0) {
            value = value.replace(/\\"/g, '\'');
        }
        // 普通属性直接拼接
        const rawAttrResult = `${key}=${quote}${value}${quote}`;
        let finalAttrResult = rawAttrResult;
        allAttr.push(finalAttrResult);
    }
    return join(...allAttr);
}

function nodeToString(name, attribs, content, selfclose) {
    return selfclose ? `<${name} ${attribs} />` : `<${name} ${attribs}>${content}</${name}>`;
}