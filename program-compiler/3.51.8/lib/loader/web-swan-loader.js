'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (originalContent) {
    const loaderContext = this;
    const callback = this.async();
    preocessResult(loaderContext, originalContent).then(result => {
        result = `module.exports = ${JSON.stringify(result)}`;
        callback(null, result);
    });
};

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _md5File = require('md5-file');

var _md5File2 = _interopRequireDefault(_md5File);

var _loaderUtils = require('loader-utils');

var _stricterHtmlparser = require('stricter-htmlparser2');

var _helper = require('./helper');

var _util = require('./../util');

var _decorateFilterJs = require('./filter/decorate-filter-js');

var _decorateFilterJs2 = _interopRequireDefault(_decorateFilterJs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable max-len */

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 处理 web swan 文件
 * @author yangjingjiu
 */
const defaultOptions = {
    xmlMode: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
    lowerCaseTags: false
};

let swanFilterNamesReg;

function preocessResult(loaderContext, originalContent) {
    const swanOutputContent = {
        swanCustomTemplates: [],
        swanFilterMap: [],
        swanFilterModulesData: [],
        swanFilterNames: [],
        swanCustomTemplatesMap: {}
    };
    return new Promise((resolve, reject) => {
        try {
            const handledNodes = beforeGenreateSwan(loaderContext, originalContent, swanOutputContent);
            swanFilterNamesReg = swanOutputContent.swanFilterNames.map(moduleName => {
                return new RegExp(`(${moduleName})\\.(\\w+\\(.*?\\))`, 'g');
            });
            const swanContent = handledNodes.map(swanNode => {
                return generateSwan(loaderContext, swanNode, swanOutputContent);
            }).join('');
            const swanCustomContent = generateSwanTemplate(swanOutputContent.swanCustomTemplates);
            const swanFilterContent = generateSwanFilterModulesTemplate(swanOutputContent.swanFilterModulesData);
            const result = afterGenerateSwan({ loaderContext, swanContent, swanCustomContent, swanFilterContent, swanOutputContent });
            resolve(result);
        } catch (err) {
            reject(err);
        }
    });
}

function parser(swanStr) {
    let handler = new _stricterHtmlparser.DomHandler();
    new _stricterHtmlparser.Parser(handler, defaultOptions).end(swanStr);
    return handler.dom;
}

function beforeGenreateSwan(loaderContext, content, swanOutputContent) {
    const swanNodes = parser(content);
    const filePath = loaderContext.resourcePath;
    // 一个swan文件标识是否被找到过，若已经被找到过，则不放进swanFilterModulesData中
    let filterContentObj = {};
    const handledContent = swanNodes.map(swanNode => {
        return customTemplateInsert(loaderContext, swanNode, filePath, swanOutputContent, filterContentObj);
    }).join('');
    const handledNodes = parser(handledContent);
    handledNodes.forEach(node => beforeHandleNodes(loaderContext, node, swanOutputContent));
    return handledNodes;
}

function customTemplateInsert(loaderContext, swanNode, templateSrc, swanOutputContent, filterContentObj) {
    const workPath = (0, _loaderUtils.getOptions)(loaderContext).workPath;
    if (!swanNode) {
        return;
    }
    const { name, attribs, children, selfclose, type, data, singleQuoteAttribs = {} } = swanNode;
    let swan = '';
    let importPath;
    switch (type) {
        case 'tag':
            {
                const src = attribs.src || '';
                if (_path2.default.isAbsolute(src)) {
                    importPath = _path2.default.join(workPath, src);
                } else {
                    importPath = _path2.default.resolve(_path2.default.dirname(templateSrc), src);
                }
                if (name === 'include' || name === 'import') {
                    loaderContext.addDependency(importPath);
                    if (_fs2.default.existsSync(importPath)) {
                        const importContent = _fs2.default.readFileSync(importPath, 'utf8');
                        const importNodes = parser(importContent);
                        swan = importNodes.map(node => {
                            return customTemplateInsert(loaderContext, node, importPath, swanOutputContent, filterContentObj);
                        }).join('');
                    }
                    break;
                }
                if (name === 'filter') {
                    let filterAssetPath = src ? importPath : '';
                    findFilterData(loaderContext, swanNode, swanOutputContent, filterAssetPath, filterContentObj);
                }
                if (name === 'image') {
                    imageSrcChange(attribs, loaderContext, templateSrc);
                }
                const content = children.map(node => customTemplateInsert(loaderContext, node, templateSrc, swanOutputContent, filterContentObj)).join('');
                swan = (0, _helper.nodeToString)(name, (0, _helper.attribsToString)(attribs, singleQuoteAttribs), content, selfclose);
                break;
            }
        case 'text':
            {
                swan = data;
                break;
            }
    }
    return swan;
}

function beforeHandleNodes(loaderContext, swanNode, swanOutputContent) {
    if (!swanNode) {
        return false;
    }
    const children = swanNode.children;
    handleCustomTemplate(swanNode, swanOutputContent);
    if (children && children.length) {
        children.forEach(node => beforeHandleNodes(loaderContext, node, swanOutputContent));
    }
}

function findFilterData(loaderContext, swanNode, swanOutputContent, filePath, filterContentObj) {
    const { attribs, children } = swanNode;
    let filterContent;
    if (attribs.module) {
        if (filterContentObj[attribs.module] && filterContentObj[attribs.module] === filePath) {
            return;
        }
        const { module, src } = attribs;
        if (filePath) {
            if (_fs2.default.existsSync(filePath)) {
                filterContent = _fs2.default.readFileSync(filePath).toString();
                filterContentObj[module] = filePath;
            } else {
                (0, _util.log)(`${filePath}文件中filter引用${src}路径错误，未找到该文件`);
            }
        } else if (children && children.length) {
            filterContent = children.map(child => {
                return customTemplateInsert(loaderContext, child, loaderContext.resourcePath, swanOutputContent, filterContentObj);
            }).join('');
        }
        if (filterContent) {
            const { code, fnNames } = (0, _decorateFilterJs2.default)(filterContent);
            let existsFlag = false;
            swanOutputContent.swanFilterModulesData.forEach(item => {
                if (item.module === module) {
                    existsFlag = true;
                    item.fnContent.push(code);
                }
            });
            if (!existsFlag) {
                swanOutputContent.swanFilterModulesData.push({
                    module,
                    fnContent: [code]
                });
                swanOutputContent.swanFilterNames.push(module);
            }
            fnNames.forEach(item => {
                swanOutputContent.swanFilterMap.push({
                    filterName: `${module}${item}`,
                    module,
                    func: item
                });
            });
        }
    }
}

function handleCustomTemplate(swanNode, swanOutputContent) {
    const { attribs, name } = swanNode;
    if (name === 'template' && attribs.name) {
        const templateName = attribs.name;
        swanOutputContent.swanCustomTemplatesMap[templateName] = {
            name: templateName,
            tagName: (0, _helper.getTemplateTagName)(templateName),
            originName: templateName
        };
    }
}

function afterGenerateSwan(args) {
    let replacedSwanContent;
    let { loaderContext, swanContent, swanCustomContent, swanFilterContent, swanOutputContent } = args;
    const resourcePath = (0, _util.formatPath)(loaderContext.resourcePath);
    const { customComponentsSwans = [], pagesComponent = [] } = (0, _loaderUtils.getOptions)(loaderContext);
    const flag = customComponentsSwans.reduce((prev, cur) => {
        return prev ? true : resourcePath.indexOf(cur) > -1 ? true : false;
    }, false);
    const noExtResourcePath = resourcePath.replace(/\.swan$/, '');
    const pcFlag = pagesComponent.indexOf(noExtResourcePath) > -1;
    if (!flag || pcFlag) {
        const swanReplaces = {
            swanContent: swanContent,
            /* eslint-disable max-len */
            classScope: 'scope' + _crypto2.default.createHash('md5').update(resourcePath.replace(/\.swan$/g, '')).digest('hex').slice(0, 8)
            /* eslint-enable max-len */
        };
        if (pcFlag) {
            swanReplaces.swanContent = '<custom-component></custom-component>';
        }
        replacedSwanContent = _ejs2.default.render(getSwanTemplate(), swanReplaces);
    }
    swanCustomContent = _ejs2.default.render(getTplTemplate(), {
        tplMaps: swanCustomContent
    });
    return JSON.stringify({
        pagesMap: replacedSwanContent,
        pagesTplMap: swanCustomContent,
        pagesFilterMap: swanOutputContent.swanFilterMap,
        pagesFilterModulesMap: swanFilterContent,
        customComponentToPages: swanContent
    });
}

function generateSwan(loaderContext, swanNode, swanOutputContent) {
    if (!swanNode) {
        return;
    }
    let { name, attribs, children, selfclose, type, data, singleQuoteAttribs = {} } = swanNode;
    let swan = '';
    let content;
    switch (type) {
        case 'tag':
            {
                if (name === 'filter') {
                    break;
                }

                if (name === 'block') {
                    name = 'template';
                }

                if (name === 'template' && attribs) {
                    // template自己本身也需要改变属性
                    attribsChange(attribs, loaderContext, { name, singleQuoteAttribs });
                    if (attribs.name) {
                        const templateName = attribs.name;
                        const tagName = swanOutputContent.swanCustomTemplatesMap[templateName].tagName;
                        swanOutputContent.swanCustomTemplates.push({
                            name: templateName,
                            tagName,
                            variableName: tagName.replace(/-/g, ''),
                            content: children.map(node => generateSwan(loaderContext, node, swanOutputContent)).join(''),
                            originName: templateName
                        });
                        break;
                    }
                    if (attribs.is) {
                        const is = attribs.is;
                        delete attribs.is;
                        const isVariable = /^{{/.exec(is) && /}}$/.exec(is);
                        if (isVariable) {
                            swan = Object.keys(swanOutputContent.swanCustomTemplatesMap).map(key => {
                                const customTemplate = swanOutputContent.swanCustomTemplatesMap[key];
                                const proccessedIs = is.replace(/(^{{)|(}}$)/g, '');
                                const sif = `${proccessedIs} == '${customTemplate.originName}'`;
                                content = children.map(node => generateSwan(loaderContext, node, swanOutputContent)).join('');
                                const attrs = Object.assign({}, attribs, { 'data-origin-name': customTemplate.originName });
                                const attribsStr = `s-if="${sif}" ${(0, _helper.attribsToString)(attrs, singleQuoteAttribs)}`;
                                return (0, _helper.nodeToString)(customTemplate.tagName, attribsStr, content, selfclose);
                            }).join('');
                        } else {
                            content = children.map(node => generateSwan(loaderContext, node, swanOutputContent)).join('');
                            const attrs = Object.assign({}, attribs, { 'data-origin-name': is });
                            const attribsStr = (0, _helper.attribsToString)(attrs, singleQuoteAttribs);
                            // 找不到的template先吞掉，不报错
                            const templateConfig = swanOutputContent.swanCustomTemplatesMap[is] || {};
                            /* eslint-disable max-len */
                            return (0, _helper.nodeToString)(templateConfig.tagName || (0, _helper.getTemplateTagName)(), attribsStr, content, selfclose);
                            /* eslint-enable max-len */
                        }
                        break;
                    }
                }
                attribsChange(attribs, loaderContext, { name, singleQuoteAttribs });
                content = children.map(node => generateSwan(loaderContext, node, swanOutputContent)).join('');
                swan = (0, _helper.nodeToString)(name, (0, _helper.attribsToString)(attribs, singleQuoteAttribs), content, selfclose);
                break;
            }
        case 'text':
            {
                if (data) {
                    const replacedData = replaceSwanFiter(data);
                    swan = replacedData.replace(/(\n|\r)+/g, '').replace(/>(\n|\r)*\s*/g, '>');
                }
                break;
            }
    }
    return swan;
}

function attribsChange(attribs, loaderContext, options = {}) {
    const { name, singleQuoteAttribs } = options;
    if (attribs.style) {
        styleChange(attribs);
    }

    // if (name === 'image') {
    //     imageSrcChange(attribs, loaderContext);
    // }

    if (attribs['s-for']) {
        sForChange(attribs);
    }
    eventChange(attribs);
    styleFilterChange(attribs, singleQuoteAttribs);
    classChange(attribs);
}

function eventChange(attribs) {
    const eventReg = new RegExp('(capture)?(?:-)?(bind|catch):?(\\w*)');
    Object.keys(attribs).forEach(key => {
        let eventArgs = attribs[key];
        const handlerEventArgs = /{{(.*?)}}/g.exec(eventArgs);
        if (handlerEventArgs) {
            const inputStr = handlerEventArgs['input'];
            if (inputStr === handlerEventArgs[0]) {
                eventArgs = `${handlerEventArgs[1]}`;
            } else {
                const variableName = handlerEventArgs[1];
                const prefixStr = inputStr.split(handlerEventArgs[0])[0];
                const ternaryReg = /(.*)\?(.*):(.*)/;
                const handlerResult = ternaryReg.exec(handlerEventArgs[1]);
                if (handlerResult) {
                    // 如果是三元运算符的形式
                    /* eslint-disable max-len */
                    eventArgs = `${handlerResult[1]} ? '${prefixStr}' + ${handlerResult[2]} : '${prefixStr}' + ${handlerResult[3]}`;
                    /* eslint-enable max-len */
                } else {
                    eventArgs = `'${prefixStr}' + ${variableName}`;
                }
            }
        } else {
            eventArgs = `'${eventArgs}'`;
        }
        key.replace(eventReg, (eventKey, capture = '', bind, eventName = '') => {
            delete attribs[key];
            attribs[`on-${capture}bind${eventName}`] = `eventHappen('${eventName}', $event, ${eventArgs}, '${capture}', '${bind}')`;
        });
    });
}

function classChange(attribs) {
    let isAddSpiderClass = false;
    const spiderClass = 'swan-spider-tap';
    const eventReg = new RegExp('(capture)?(?:-)?(bind|catch):?([tap|longtap|longpress|touchstart|touchend])');
    // 处理用户事件，有跳转行为的dom标签统一增加 class 名为 swan-spider-tap
    Object.keys(attribs).forEach(key => {
        const isEvent = key.match(eventReg);
        if (isEvent && !isAddSpiderClass) {
            attribs.class = attribs.class ? `${attribs.class} ${spiderClass}` : spiderClass;
            isAddSpiderClass = true;
        }
    });
}

function styleFilterChange(attribs, singleQuoteAttribs) {
    Object.keys(attribs).forEach(key => {
        let styleContent = attribs[key];
        attribs[key] = replaceSwanFiter(styleContent, singleQuoteAttribs[key]);
    });
}

function replaceSwanFiter(data, singleQuoteFlag) {
    let repleacedData = data;
    swanFilterNamesReg.forEach(reg => {
        repleacedData = repleacedData.replace(reg, (originContent, module, params) => {
            return `${singleQuoteFlag ? '""' : '\'\''} | ${module + params}`;
        });
    });
    return repleacedData;
}

function styleChange(attribs) {
    const style = attribs.style;
    const rpxReg = new RegExp('(-?(\\.)?\\d+(\\.\\d+)?)rpx', 'g');
    // const vhReg = new RegExp('(-?\\d+(\\.\\d+)?)vh', 'g');
    attribs.style = style.replace(rpxReg, (str, num) => {
        return `calc(var(--appwidth) / 750 * ${num})`;
    });
    // attribs.style = style.replace(vhReg, (str, num) => {
    //     return `calc(${num} * (100vh - 44px) / 100)`;
    // });
}

function sForChange(attribs) {
    let sForContent = attribs['s-for'];
    try {
        if (!/\sin\s/.exec(sForContent)) {
            const sForIndex = attribs['s-for-index'] || 'index';
            const sForItem = attribs['s-for-item'] || 'item';
            sForContent = sForContent.replace(/(^{{)|}}$/g, '');
            delete attribs['s-for-index'];
            delete attribs['s-for-item'];
            attribs['s-for'] = `${sForItem}, ${sForIndex} in ${sForContent}`;
        }
    } catch (err) {
        (0, _util.log)(err);
    }
}

function imageSrcChange(attribs, loaderContext, templateSrc) {
    if (attribs.src && !attribs.src.match(/\{\{.*?\}\}|^http|^data:/)) {
        const { workPath, staticPrefix, webEnv } = (0, _loaderUtils.getOptions)(loaderContext);
        const filePath = templateSrc || loaderContext.resourcePath;
        const src = attribs.src;
        try {
            let imgSrc;
            let imgSrcRes;
            if (_path2.default.isAbsolute(src)) {
                imgSrc = _path2.default.join(workPath, src);
            } else {
                imgSrc = _path2.default.join(_path2.default.dirname(filePath), src);
            }
            const extname = _path2.default.extname(imgSrc);
            const basename = _path2.default.basename(imgSrc, extname);
            if (webEnv === 'production' || webEnv === 'development') {
                const hash = _md5File2.default.sync(imgSrc).slice(0, 10);
                imgSrcRes = `${basename}_${hash}${extname}`;
            } else {
                imgSrcRes = `${basename}${extname}`;
            }
            const rPath = _path2.default.relative(workPath, imgSrc);
            const rPathDirname = _path2.default.dirname(rPath);
            attribs.src = staticPrefix + (0, _util.formatPath)(_path2.default.join(rPathDirname, imgSrcRes));
        } catch (err) {
            (0, _util.log)(err);
        }
    }
}

function generateSwanTemplate(templates) {
    const customComponentsTpl = {};
    templates.forEach(template => {
        const name = template.tagName;
        customComponentsTpl[name] = `
            {
                template: \`<swan-template>${template.content}</swan-template>\`,
                inited() {
                    const setAll = data => {
                        for (var d in data) {
                            this.data.set(d, data[d]);
                        }
                    };
                    setAll(this.data.get('data'));
                    this.watch('data', setAll);
                },
                eventHappen(...args) {
                    this.owner.eventHappen(...args);
                }
            }
        `;
    });
    return customComponentsTpl;
}

function generateSwanFilterModulesTemplate(templates) {
    let filterModulesArrString = '[';
    templates.forEach((item, index, arr) => {
        item.fnContent.forEach(fnContentItem => {
            filterModulesArrString += `
                {
                    module: '${item.module}',
                    funcs: function (require, module, exports, define, swan, getApp, window, document, frames, self, location, navigator, localStorage, history, Caches) {
                        ${fnContentItem}
                    }()
                },
            `;
        });
    });
    filterModulesArrString += ']';
    return filterModulesArrString;
}

function getSwanTemplate() {
    return '<swan-wrapper class="<%-classScope%>" tabindex="-1"><%-swanContent%></swan-wrapper>';
}

function getTplTemplate() {
    return ['<% var keys= Object.keys(tplMaps); var len = keys.length%>', '<% for (var i = 0; i < len; i++) {%>', '"<%- keys[i] %>": <%- tplMaps[keys[i]] %><% if(i < len -1) { %>,<% } %>', '<% } %>'].join('');
}
/* eslint-enable max-len */