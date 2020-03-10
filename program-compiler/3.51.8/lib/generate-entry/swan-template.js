"use strict";

/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 内置的模板
 * @author zhuxin04
 */
module.exports = {
    css: `
        /**
         * @file 自定义组件中所有被 import 的 css
         * @author yangyang55(yangyang55@baidu.com)
         */
        (function (global) {
            var componentFactory = global.componentFactory;
            componentFactory.allCustomComponentsImportCss = #allCustomComponentsImportCssMap#;
            if (!componentFactory.translateAllCustomImportCss) {
                componentFactory.translateAllCustomImportCss = function (customComponentCss, prefix) {
                    var tranlatededCss = Object.create(null);
                    var doTranslateAllCustomImportCss = function (componentCss) {
                        if (componentCss.length === 0) {
                            return '';
                        }
                        var result = '';
                        // 分四种情况：正常 css,'swan-'前缀，'xx__'前缀,import 引用的 css，[2]一组 rules结束
                        componentCss.forEach(function (cssItem) {
                            if (Array.isArray(cssItem)) {
                                var item = cssItem[0];
                                if (item === 0) {
                                    result += (prefix + '__');
                                } else if (item === 1) {
                                    result += ('swan-' + prefix + ' ');
                                }
                            } else if (typeof cssItem === 'string') {
                                result += cssItem;
                            } else if (cssItem.constructor === Object) {
                                var customAbsolutePath = cssItem.path;
                                if (!tranlatededCss[customAbsolutePath]) {
                                    tranlatededCss[customAbsolutePath] = true;
                                    result += doTranslateAllCustomImportCss(
                                        componentFactory.allCustomComponentsImportCss[customAbsolutePath] || []);
                                }
                            }
                        });
                        return result;
                    };
                    var cssResult = doTranslateAllCustomImportCss(customComponentCss);
                    // 处理 css 多余前缀
                    var rulePrefixReg = new RegExp('.' + prefix + '__' + prefix + '__', 'ig');
                    cssResult = cssResult.replace(rulePrefixReg, '.' + prefix + '__');
                    // 替换 url 路径
                    var appPath = window.pageInfo.appPath;
                    cssResult = cssResult.replace(/__custom_prefix_path__/ig, appPath);
                    return cssResult;
                };
            }
        }(window));
    `,
    custom: `
        /**
         * @file swan组件的模板
         * @author yangyang55(yangyang55@baidu.com)
         */
        window.define('<%-customComponentPath%>', function (require, modulesExports) {
            let componentUsingComponentMap = JSON.parse(\`#componentUsingComponentMap#\`);
            let componentUsingComponentMapInPlugin = JSON.parse(\`#componentUsingComponentMapInPlugin#\`);
            function processTemplateModule(filterTemplateArrs, filterModule) {
                eval(filterModule);
                let modules = {};
                let templateFiltersObj = {};
                filterTemplateArrs && filterTemplateArrs.forEach(element => {
                    let {
                        filterName,
                        func,
                        module
                    } = element;
                    modules[module] = eval(module);
                    templateFiltersObj[filterName] = (...args) => modules[module][func](...args);
                });
                return templateFiltersObj;
            }
            // template创建
            let createTemplateComponent = function(components) {
                let templateComponents = Object.create(null);
                let customComponents = Object.create(null);
                "#swanCustomComponentTemplates#";
                // 传入 template 的组件包括该自定义组件使用的自定义组件和模板
                Object.assign(customComponents, components, templateComponents);
                return templateComponents;
            }
            // filter 模块名以及对应的方法名集合
            let filterCustomArr = JSON.parse('<%-filters%>');
            // 闭包封装filter模块
            <%-modules-%>
        
            let modules = {};
            let filtersObj = {};
            filterCustomArr && filterCustomArr.forEach(element => {
                modules[element.module] = eval(element.module);
                let func = element.func;
                let module = element.module;
                filtersObj[element.filterName] = (...args) => {
                    return modules[module][func](...args);
                };
            });
            modulesExports.exports = {
                <% if (isPlugin) { %>isPlugin: true,<% } %>
                componentUsingComponentMap: componentUsingComponentMap,
                componentUsingComponentMapInPlugin: componentUsingComponentMapInPlugin,
                template: \`<%-customComponentTemplate%>\`,
                isComponent: "#isComponent#",
                size: "#size#",
                componentPath: '<%-customComponentPath%>',
                customComponentCss: <%-customComponentCssArray%>,
                createTemplateComponent: createTemplateComponent,
                filters: Object.assign({}, filtersObj),
                initialFilters: filterCustomArr,
                pageModules: modules
            };
        })
    `,
    runtime: `
        /**
         * @file swan's newslave '.swan' for old swancore.
         * @author yangyang55(yangyang55@baidu.com)
         */
        
        (function () {
            var swanVersion = window.swanVersion || 0;
            window.errorMsg = window.errorMsg || [];
            function supportRequire() {
                if (!window.require || !window.define) {
                    var MODULE_PRE_DEFINED = 1;
                    var MODULE_DEFINED = 2;
                    var modModules = {};
                    window.require = function (id) {
                        if (typeof id !== 'string') {
                            throw new Error('require args must be a string');
                        }
                        var mod = modModules[id];
                        if (!mod) {
                            throw new Error('module "' + id + '" is not defined');
                        }
                        if (mod.status === MODULE_PRE_DEFINED) {
                            var factory = mod.factory;
        
                            var localModule = {
                                exports: {}
                            };
                            var factoryReturn = factory(
                                require,
                                localModule,
                                localModule.exports,
                                define
                            );
                            mod.exports = localModule.exports || factoryReturn;
                            mod.status = MODULE_DEFINED;
                        }
                        return mod.exports;
                    };
                    window.define = function (id, dependents, factory) {
                        if (typeof id !== 'string') {
                            throw new Error('define args 0 must be a string');
                        }
                        var deps = dependents instanceof Array ? dependents : [];
                        var realFactory = typeof dependents === 'function' ? dependents : factory;
        
                        // 本地缓存中已经存在
                        if (modModules[id]) {
                            return;
                        }
        
                        modModules[id] = {
                            status: MODULE_PRE_DEFINED,
                            dependents: deps,
                            factory: realFactory
                        };
                    };
                }
            }
            supportRequire();
            function compareVersion(v1, v2) {
                // 当环境没有swanVersion时(某些低版本，例如1.9.x)默认值为0，则直接返回1
                if (v2 === 0) {
                    return 1;
                }
                v1 = v1.split('.');
                v2 = v2.split('.');
                var len = Math.max(v1.length, v2.length);
                while (v1.length < len) {
                    v1.push('0');
                }
                while (v2.length < len) {
                    v2.push('0');
                }
                for (var i = 0; i < len; i++) {
                    var num1 = parseInt(v1[i], 10);
                    var num2 = parseInt(v2[i], 10);
                    if (num1 > num2) {
                        return 1;
                    } else if (num1 < num2) {
                        return -1;
                    }
                }
                return 0;
            }
            // 最后一个不支持新编译的版本
            var lastNoSupportVersion = '3.30.0';
            if (compareVersion(lastNoSupportVersion, swanVersion) >= 0) {
                var loadRuntimeJs = new Promise(function (resolve, reject) {
                    var appPath = window.pageInfo.appPath;
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = appPath + '/swan-execute.js';
                    script.onload = function () {
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
                loadRuntimeJs.then(function () {
                    if (typeof window.renderPage === 'function') {
                        window.renderPage('<%-customComponentPath%>');
                    }
                }).catch(function (e) {
                    window.errorMsg['execError'] = e;
                });
            }
        })();
    `,
    dynamicLibCustom: `
        /**
         * @file swan组件的模板
         * @author yangyang55(yangyang55@baidu.com)
         */
        extraAssetDefine('<%-customComponentPath%>', function (require, module) {
            let componentUsingComponentMap = JSON.parse(\`#componentUsingComponentMap#\`);
            function processTemplateModule(filterTemplateArrs, filterModule) {
                eval(filterModule);
                let modules = {};
                let templateFiltersObj = {};
                filterTemplateArrs && filterTemplateArrs.forEach(element => {
                    let {
                        filterName,
                        func,
                        module
                    } = element;
                    modules[module] = eval(module);
                    templateFiltersObj[filterName] = (...args) => modules[module][func](...args);
                });
                return templateFiltersObj;
            }
            // template创建
            let createTemplateComponent = function(components) {
                let templateComponents = Object.create({});
                let customComponents = Object.create({});
                "#swanCustomComponentTemplates#";
                // 传入 template 的组件包括该自定义组件使用的自定义组件和模板
                Object.assign(customComponents, components, templateComponents);
                return templateComponents;
            }
            // filter 模块名以及对应的方法名集合
            let filterCustomArr = JSON.parse('<%-filters%>');
            // 闭包封装filter模块
            <%-modules-%>
        
            let modules = {};
            let filtersObj = {};
            filterCustomArr && filterCustomArr.forEach(element => {
                modules[element.module] = eval(element.module);
                let func = element.func;
                let module = element.module;
                filtersObj[element.filterName] = (...args) => {
                    return modules[module][func](...args);
                };
            });
            module.exports = {
                componentUsingComponentMap: componentUsingComponentMap,
                template: \`<%-customComponentTemplate%>\`,
                isComponent: "#isComponent#",
                size: "#size#",
                componentPath: '<%-customComponentPath%>',
                customComponentCss: <%-customComponentCssArray%>,
                createTemplateComponent: createTemplateComponent,
                filters: Object.assign({}, filtersObj),
                initialFilters: filterCustomArr,
                pageModules: modules
            };
        })
    `,
    dynamicLibCss: `
        /**
         * @file 自定义组件中所有被 import 的 css
         * @author yangyang55(yangyang55@baidu.com)
         */
        (function (global) {
            var componentFactory = global.componentFactory;
            if (!componentFactory.allDynamicLibImportCss) {
                componentFactory.allDynamicLibImportCss = {};
            }
            componentFactory.allDynamicLibImportCss['#dynamicLibName#'] = #allDynamicLibImportCss#;
        }(window));
    `,
    pluginCss: `
        /**
         * @file 自定义组件中所有被 import 的 css
         * @author yangyang55(yangyang55@baidu.com)
         */
        (function (global) {
            var componentFactory = global.componentFactory;
            if (!componentFactory.allPluginImportCss) {
                componentFactory.allPluginImportCss = {};
            }
            componentFactory.allPluginImportCss['#pluginName#'] = #allPluginImportCss#;
        }(window));
    `,
    pluginSwan: `
        let componentUsingComponentMap = JSON.parse(\`#componentUsingComponentMap#\`);
        let componentUsingComponentMapInPlugin = JSON.parse(\`#componentUsingComponentMapInPlugin#\`);
        function processTemplateModule(filterTemplateArrs, filterModule) {
            eval(filterModule);
            let modules = {};
            let templateFiltersObj = {};
            filterTemplateArrs && filterTemplateArrs.forEach(element => {
                let {
                    filterName,
                    func,
                    module
                } = element;
                modules[module] = eval(module);
                templateFiltersObj[filterName] = (...args) => modules[module][func](...args);
            });
            return templateFiltersObj;
        }
        // template创建
        let createTemplateComponent = function(components) {
            let templateComponents = Object.create(null);
            let customComponents = Object.create(null);
            "#swanCustomComponentTemplates#";
            // 传入 template 的组件包括该自定义组件使用的自定义组件和模板
            Object.assign(customComponents, components, templateComponents);
            return templateComponents;
        }
        // filter 模块名以及对应的方法名集合
        let filterCustomArr = JSON.parse('<%-filters%>');
        // 闭包封装filter模块
        <%-modules-%>
    
        let modules = {};
        let filtersObj = {};
        filterCustomArr && filterCustomArr.forEach(element => {
            modules[element.module] = eval(element.module);
            let func = element.func;
            let module = element.module;
            filtersObj[element.filterName] = (...args) => {
                return modules[module][func](...args);
            };
        });
        modulesExports.exports = {
            isPlugin: true,
            componentUsingComponentMap: componentUsingComponentMap,
            componentUsingComponentMapInPlugin: componentUsingComponentMapInPlugin,
            template: \`<%-customComponentTemplate%>\`,
            isComponent: "#isComponent#",
            size: "#size#",
            componentPath: '<%-customComponentPath%>',
            customComponentCss: <%-customComponentCssArray%>,
            createTemplateComponent: createTemplateComponent,
            filters: Object.assign({}, filtersObj),
            initialFilters: filterCustomArr,
            pageModules: modules
        };
    `
};