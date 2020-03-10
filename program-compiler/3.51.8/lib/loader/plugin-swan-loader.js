'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (originalContent) {
    const loaderContext = this;
    let callback = this.async();
    processAll(loaderContext, originalContent).then(result => {
        callback(null, result);
    });
};

exports.processAll = processAll;
exports.transformSForAttribute = transformSForAttribute;
exports.transformStyleAttribute = transformStyleAttribute;
exports.transformEventAttribute = transformEventAttribute;
exports.getAssetPath = getAssetPath;
exports.getPrefixPath = getPrefixPath;
exports.processSwanNode = processSwanNode;
exports.processTemplateNode = processTemplateNode;
exports.generateSwanTemplate = generateSwanTemplate;
exports.processSwanAsset = processSwanAsset;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _loaderUtils = require('loader-utils');

var _util = require('util');

var _babelCore = require('babel-core');

var babel = _interopRequireWildcard(_babelCore);

var _babelPresetEnv = require('babel-preset-env');

var _babelPresetEnv2 = _interopRequireDefault(_babelPresetEnv);

var _babelPluginTransformRemoveStrictMode = require('babel-plugin-transform-remove-strict-mode');

var _babelPluginTransformRemoveStrictMode2 = _interopRequireDefault(_babelPluginTransformRemoveStrictMode);

var _babelPluginTransformExportExtensions = require('babel-plugin-transform-export-extensions');

var _babelPluginTransformExportExtensions2 = _interopRequireDefault(_babelPluginTransformExportExtensions);

var _babelPluginTransformClassProperties = require('babel-plugin-transform-class-properties');

var _babelPluginTransformClassProperties2 = _interopRequireDefault(_babelPluginTransformClassProperties);

var _babelPluginTransformObjectRestSpread = require('babel-plugin-transform-object-rest-spread');

var _babelPluginTransformObjectRestSpread2 = _interopRequireDefault(_babelPluginTransformObjectRestSpread);

var _ejs = require('ejs');

var _ejs2 = _interopRequireDefault(_ejs);

var _util2 = require('../util');

var _helper = require('./helper');

var _filter = require('./filter');

var _index = require('./custom-component/index');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let workPath = global.SWAN_CLI_ARGV.PLUGIN_ROOT; /**
                                                  * @license
                                                  * Copyright Baidu Inc. All Rights Reserved.
                                                  *
                                                  * This source code is licensed under the Apache License, Version 2.0; found in the
                                                  * LICENSE file in the root directory of this source tree.
                                                  *
                                                  * @file 处理swan模板
                                                  * @author zhuxin04@gmial.com
                                                  */

const EVENT_REG = new RegExp('(capture)?(?:-)?(bind|catch):?(\\w*)');

function decorateRenderContent(renderedContent) {
    renderedContent = renderedContent.replace(/{{(.*)}}/g, function (str, $1) {
        let tmp = $1.replace(/&#36;/g, '$');
        return str.replace($1, tmp);
    });
    renderedContent = renderedContent.replace(/>(\n|\r)*\s*/g, '>');
    return renderedContent;
}

function isCustomComponent(loaderContext) {
    const resource = loaderContext.resource;
    const jsPath = (0, _util2.formatPath)(resource.replace(/\.swan$/, '.js'));
    const customComponentJS = loaderContext.query.customComponentJS;
    return jsPath in customComponentJS;
}

function processAll(loaderContext, originalContent) {
    const isComponent = isCustomComponent(loaderContext);
    const resource = loaderContext.resource;
    const jsonPath = resource.replace(/\.swan$/, '.json');
    loaderContext.addDependency(jsonPath);
    return processSwanAsset(loaderContext, loaderContext.resource, originalContent).then(mainPage => {
        const { content, customParam } = mainPage;
        const pluginSwanTemplate = _util2.TEMPLATE_OBJ.pluginSwan;
        (0, _filter.addFilteJsInDependencies)(loaderContext, customParam);
        return (0, _filter.getFilterModule)(loaderContext.resource, customParam, content).then(args => {
            const { replacedContent, filter, modules } = args;
            return {
                replacedContent,
                filter,
                modules
            };
        }).then(resultObj => {
            const { filter, modules, replacedContent } = resultObj;
            return generateSwanTemplate(customParam).then(resultObj => {
                const templateAllCodes = resultObj.templateAllCodes;
                const cssPath = loaderContext.resource.replace(/\.swan$/, '.css');
                const componentPath = (0, _util2.formatPath)(_path2.default.relative(workPath, loaderContext.resource));
                let cssPromise;
                if (isComponent) {
                    cssPromise = (0, _index.processCustomComponentCss)(cssPath, loaderContext, 'plugin');
                    loaderContext.addDependency(cssPath);
                } else {
                    cssPromise = new Promise(re => re('[]'));
                }
                return Promise.resolve(cssPromise).then(cssResults => {
                    let objData = {
                        customComponentTemplate: replacedContent,
                        customComponentPath: `plugin-private://#pluginId#/${componentPath}`,
                        customComponentCssArray: cssResults,
                        filters: filter,
                        modules: modules,
                        isPlugin: true
                    };
                    let renderedContent = _ejs2.default.render(pluginSwanTemplate, objData);
                    renderedContent = renderedContent.replace('"#swanCustomComponentTemplates#"', templateAllCodes);
                    renderedContent = decorateRenderContent(renderedContent);
                    renderedContent = renderedContent.replace('"#size#"', renderedContent.length);
                    renderedContent = renderedContent.replace('"#isComponent#"', isComponent);
                    return renderedContent;
                });
            });
        });
    });
}

/**
 * 处理swan模板中s-for属性
 * @param {Object} attribs attribute集合
 * @return {string} 转换后的值
 */
function transformSForAttribute(attribs) {
    const sForValue = attribs['s-for'];
    const sForIndexValue = attribs['s-for-index'];
    const sForItemValue = attribs['s-for-item'];
    if (/\bin\b/.test(sForValue)) {
        return sForValue;
    }
    const nakedContent = sForValue.replace(/(^{{|}}$)/g, '');
    let forIndex = sForIndexValue ? sForIndexValue : 'index';
    let forItem = sForItemValue ? sForItemValue : 'item';
    return `${forItem}, ${forIndex} in ${nakedContent}`;
}

/**
 * 处理style属性中rpx的转换
 * @param {string} styleVal style属性的值
 * @return {string} 转换后的值
 */
function transformStyleAttribute(styleVal) {
    styleVal = styleVal.replace(/((\.)?\d+(\.\d+)?)rpx/g, (allValue, valueNumber) => {
        return +valueNumber / 7.5 + 'vw';
    });
    return styleVal;
}

/**
 * 处理事件绑定的转换
 * @param {Object} attribs 属性集合
 * @param {string} eventName 事件名
 */
function transformEventAttribute(attribs, eventName) {
    const eventValue = attribs[eventName];
    if (!/^(eventHappen\()/.test(eventValue)) {
        let handlerName = eventValue;
        delete attribs[eventName];
        const matchArr = EVENT_REG.exec(eventName);
        const capture = matchArr[1] || '';
        const bind = matchArr[2] || '';
        const eventType = matchArr[3] || '';
        const attributeName = `on-${capture}bind${eventType}`;
        const handlerVariable = /{{(.*?)}}/g.exec(eventValue);
        if (handlerVariable) {
            const inputStr = handlerVariable['input'];
            if (inputStr === handlerVariable[0]) {
                handlerName = `${handlerVariable[1]}`;
            } else {
                const variableName = handlerVariable[1];
                const prefixStr = inputStr.split(handlerVariable[0])[0];
                const ternaryReg = /(.*)\?(.*):(.*)/;
                const handlerResult = ternaryReg.exec(handlerVariable[1]);
                if (handlerResult) {
                    // 如果是三元运算符的形式
                    /* eslint-disable max-len */
                    handlerName = `${handlerResult[1]} ? '${prefixStr}' + ${handlerResult[2]} : '${prefixStr}' + ${handlerResult[3]}`;
                    /* eslint-enable max-len */
                } else {
                    handlerName = `'${prefixStr}' + ${variableName}`;
                }
            }
        } else {
            handlerName = `'${handlerName}'`;
        }
        attribs[attributeName] = `eventHappen('${eventType}', $event, ${handlerName}, '${capture}', '${bind}')`;
    }
}

/**
 * 得到swan模板中引用的资源路径
 * @param {string} basePath 文件引用基于swan文件的路径
 * @param {string}userPath 开发者所写的路径格式
 * @return {string} 资源文件的绝对路劲
 */
function getAssetPath(basePath, userPath = '', deep = false) {
    if (!userPath) {
        return '';
    }
    let assetPath = userPath;
    if (_path2.default.isAbsolute(userPath)) {
        if (!~userPath.indexOf(workPath)) {
            assetPath = _path2.default.join(workPath, userPath);
        }
    } else {
        assetPath = _path2.default.resolve(_path2.default.dirname(basePath), userPath);
        if (deep && !_fsExtra2.default.existsSync(assetPath)) {
            const notExtUserPath = userPath.replace(/\.swan$/, '');
            assetPath = (0, _util2.findInNodeModules)(basePath, workPath, notExtUserPath, 'swan');
        }
    }
    return (0, _util2.formatPath)(assetPath);
}

function getPrefixPath(filePath) {
    return (0, _util2.formatPath)(_path2.default.relative(workPath, filePath).replace(/^\//, ''));
}

function getRelativeWorkPath(assertPath = '') {
    return _path2.default.relative(workPath, assertPath);
}

function validateAssertPath(absoluteAssetPath, attribs = {}, resourcePath) {
    if (!attribs['src']) {
        return;
    }
    if (!_fsExtra2.default.existsSync(absoluteAssetPath)) {
        const errorPathSearchError = `
            在'${getRelativeWorkPath(resourcePath)}'文件中未找到'${attribs['src']}',
            当在'src'属性中使用相对路径引用资源文件时，我们修改了查找策略【基于当前文件的路径搜索】，具体文档请查看
            'https://dwz.cn/dkc6gRIt'。
        `;
        (0, _util2.log)(`${errorPathSearchError}`, 'error');
    }
}

/**
 * 对于有name属性的template，加入到definedTemplates对象中，并替换掉import、include标签
 * @param {Object} node ast节点
 * @param {string} resourcePath 资源文件的路劲
 * @param {Object} customParam 模板集合、filter集合
 * @return {Promise<string>} 节点转换为string的promise
 */
function processSwanNode(loaderContext, node, resourcePath, customParam, isTemplate = false) {
    return new Promise((resolve, reject) => {
        let swanPromise;
        let { name, attribs, singleQuoteAttribs, children, selfclose, type, data } = node;
        switch (type) {
            case 'tag':
                {
                    swanPromise = new Promise((resolve, reject) => {
                        Object.keys(attribs).forEach(key => {
                            if (key === 's-for') {
                                attribs['s-for'] = transformSForAttribute(attribs);
                            } else if (key === 'style') {
                                attribs['style'] = transformStyleAttribute(attribs['style']);
                            } else if (EVENT_REG.test(key)) {
                                transformEventAttribute(attribs, key);
                            } else if (key === 'src') {
                                const originSrcValue = attribs['src'].replace(/^\s+|\s+$/g, '');
                                const absoluteAssetPath = getAssetPath(resourcePath, attribs['src']);
                                if (originSrcValue.startsWith('.')) {
                                    validateAssertPath(absoluteAssetPath, attribs, resourcePath);
                                    const userAbsoluteRelativePath = _path2.default.join('/', _path2.default.relative(workPath, absoluteAssetPath));
                                    attribs['src'] = (0, _util2.formatPath)(userAbsoluteRelativePath, resourcePath);
                                } else if (originSrcValue.startsWith('/')) {
                                    validateAssertPath(absoluteAssetPath, attribs, resourcePath);
                                }
                            }
                        });
                        if (name === 'import' || name === 'include') {
                            const src = attribs['src'];
                            const assetPath = getAssetPath(resourcePath, src);
                            (0, _util.promisify)(_fsExtra2.default.readFile)(assetPath, 'utf-8').then(importContent => {
                                loaderContext.addDependency(assetPath);
                                node.data = importContent;
                                let importNodes = (0, _helper.parser)(importContent);
                                Promise.all(importNodes.map(node => {
                                    return processSwanNode(loaderContext, node, assetPath, customParam);
                                })).then(args => {
                                    resolve(args.join(''));
                                }).catch(err => {
                                    reject(err);
                                });
                            }).catch(err => {
                                (0, _util2.log)(`${resourcePath}: ${err}`, 'error');
                                resolve('');
                            });
                        } else {
                            if (name === 'block') {
                                name = 'template';
                            } else if (name === 'filter') {
                                Promise.all(children.map(node => processSwanNode(loaderContext, node, resourcePath, customParam))).then(args => {
                                    const filterItem = {
                                        src: getAssetPath(resourcePath, attribs.src),
                                        module: attribs.module,
                                        isTemplate,
                                        content: args.join('')
                                    };
                                    if (customParam.filterObj[resourcePath]) {
                                        customParam.filterObj[resourcePath].push(filterItem);
                                    } else {
                                        customParam.filterObj[resourcePath] = [filterItem];
                                    }
                                });
                            } else if (name === 'template' && attribs.name) {
                                const templateName = attribs.name;
                                Promise.all(children.map(node => processSwanNode(loaderContext, node, resourcePath, customParam, true))).then(() => {
                                    const tagName = (0, _helper.getTemplateTagName)(templateName);
                                    customParam.definedTemplates[templateName] = {
                                        name: templateName,
                                        tagName: tagName,
                                        variableName: tagName.replace(/-/g, ''),
                                        originName: templateName,
                                        resource: resourcePath
                                    };
                                });
                            }
                            Promise.all(children.map(node => processSwanNode(loaderContext, node, resourcePath, customParam))).then(args => {
                                resolve((0, _helper.nodeToString)(name, (0, _helper.attribsToString)(attribs, singleQuoteAttribs), args.join(''), selfclose));
                            }).catch(err => reject(err));
                        }
                    });
                    break;
                }
            case 'comment':
                {
                    swanPromise = new Promise(resolve => {
                        resolve('<!--' + data + '-->');
                    });
                    break;
                }
            case 'text':
                {
                    swanPromise = new Promise(resolve => {
                        data = data.replace(/\$/g, '&#36;').replace(/`/g, '&#96;');
                        resolve(data);
                    });
                    break;
                }
        }
        swanPromise.then(str => {
            resolve(str);
        }).catch(err => {
            reject(err);
        });
    });
}

/**
 * 对于无name属性的template返回空字符串，对于有is属性的template，标签名转换为template加随机字符串,
 * eg: <template-a121></template-a121>
 *
 * @param {string} content swan模板内容
 * @param {Object} customParam 模板集合及filter集合
 * @return {string} 经过处理的模板内容
 */
function processTemplateNode(content, customParam) {
    const swanNodes = (0, _helper.parser)(content);
    const definedTemplates = customParam.definedTemplates;

    function processTemplate(node) {
        let nodeStr = '';
        let { name, attribs, singleQuoteAttribs, children, selfclose, type, data } = node;
        switch (type) {
            case 'tag':
                {
                    if (name === 'filter') {
                        break;
                    }
                    if (name === 'template') {
                        if (attribs.name) {
                            const content = children.map(node => processTemplate(node)).join('');
                            definedTemplates[attribs.name].content = content;
                            break;
                        }
                        if (attribs.is) {
                            let is = attribs.is;
                            delete attribs.is;
                            const isVariable = /^{{/.exec(is) && /}}$/.exec(is);
                            if (isVariable) {
                                nodeStr = Object.keys(definedTemplates).map(key => {
                                    const customTemplate = definedTemplates[key];
                                    const proccessedIs = is.replace(/(^{{)|(}}$)/g, '');
                                    const sif = `${proccessedIs} == '${customTemplate.originName}'`;
                                    const content = children.map(node => processTemplate(node)).join('');
                                    const attrs = Object.assign({}, attribs, { 'data-origin-name': customTemplate.originName });
                                    const attribsStr = `s-if="${sif}" ${(0, _helper.attribsToString)(attrs, singleQuoteAttribs)}`;
                                    return (0, _helper.nodeToString)(customTemplate.tagName, attribsStr, content, selfclose);
                                }).join('');
                            } else {
                                const content = children.map(node => processTemplate(node)).join('');
                                const attrs = Object.assign({}, attribs, { 'data-origin-name': is });
                                const attribsStr = (0, _helper.attribsToString)(attrs, singleQuoteAttribs);
                                const templateConfig = definedTemplates[is] || {};
                                return (0, _helper.nodeToString)(templateConfig.tagName || (0, _helper.getTemplateTagName)(), attribsStr, content, selfclose);
                            }
                            break;
                        }
                    }
                    const content = children.map(node => processTemplate(node)).join('');
                    nodeStr = (0, _helper.nodeToString)(name, (0, _helper.attribsToString)(attribs, singleQuoteAttribs), content, selfclose);
                    break;
                }
            case 'text':
                {
                    nodeStr = data;
                    break;
                }
        }
        return nodeStr;
    }

    const result = swanNodes.map(node => processTemplate(node)).join('');
    return result;
}

/**
 * 根据模板集合，生成模板的定义
 * @param {Object} customParam 自定义参数对象
 * @param {string} type 页面类型，自定义组件、Page级页面
 * @return {Promise<{templateMapJson: string, templateAllCodes: string}>}
 */
function generateSwanTemplate(customParam) {
    let templateMapJson = [];
    const templatePromiseArr = [];
    Object.keys(customParam.definedTemplates).forEach((key, index) => {
        const template = customParam.definedTemplates[key];
        const { originName, variableName, tagName, content, resource } = template;
        const templatePromise = new Promise(resolve => {
            (0, _filter.getFilterModule)(resource, customParam, content, false).then(result => {
                const { replacedContent, filter, modules } = result;
                templateMapJson.push(`'${tagName}': ${variableName}`);
                let modulesCode = '';
                if (filter) {
                    let transformedFilterModule = babel.transform(modules, {
                        presets: [_babelPresetEnv2.default],
                        plugins: [_babelPluginTransformRemoveStrictMode2.default, _babelPluginTransformExportExtensions2.default, _babelPluginTransformClassProperties2.default, [_babelPluginTransformObjectRestSpread2.default, { useBuiltIns: true }]]
                    });
                    modulesCode = transformedFilterModule.code;
                }
                let code = '';
                code += `
                    const filterTemplateArrs${index} = JSON.parse('${filter}');
                    let templateFiltersObj${index} = {};
                    if (!!filterTemplateArrs${index}.length) {
                        templateFiltersObj${index} = processTemplateModule(filterTemplateArrs${index}, \`${modulesCode}\`);
                    }
                    var ${variableName} = san.defineComponent({
                        components: customComponents,
                        template: \`<swan-template data-origin-name="${originName}">
                            ${replacedContent}</swan-template>\`,
                        filters: {
                            ...templateFiltersObj${index}
                        },
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
                });`;
                code += `templateComponents['${tagName}'] = ${variableName};\n`;
                resolve(code);
            });
        });
        templatePromiseArr.push(templatePromise);
    });
    return Promise.all(templatePromiseArr).then(args => {
        return {
            templateMapJson: `{${templateMapJson.join(',')}}`,
            templateAllCodes: args.join('')
        };
    });
}

/**
 * 处理page级别swan文件、自定义组件swan文件资源
 * @param {Object|string} asset  资源上下文、资源路劲
 * @param {string} type page、自定义组件
 * @param {string} content 当为pageswan时为内容
 * @return {Promise<any>}
 */
function processSwanAsset(loaderContext, resourcePath, content = '') {
    const customParam = {
        definedTemplates: {},
        filterObj: {}
    };
    const logTitle = 'swan文件';
    const nodes = (0, _helper.parser)(content);
    let arr = nodes.map(node => processSwanNode(loaderContext, node, resourcePath, customParam));
    return new Promise((resolve, reject) => {
        Promise.all(arr).then(args => {
            return {
                content: args.join(''),
                customParam
            };
        }).then(result => {
            const { content, customParam } = result;
            const finalResult = processTemplateNode(content, customParam);
            (0, _util2.log)(`${logTitle}: ${getPrefixPath(resourcePath) + '.swan'} 编译通过`);
            resolve({
                content: finalResult,
                customParam
            });
        }).catch(err => reject(err));
    });
}