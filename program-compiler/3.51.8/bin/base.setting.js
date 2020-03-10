/**
 * @license
 * Copyright Baidu Inc. All Rights Reserved.
 *
 * This source code is licensed under the Apache License, Version 2.0; found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @file 脚本的命令参数配置
 * @author zhuxin04
 */
const pkg = require('../package.json');
const pkginfo = require('../pkginfo.json');
const path = require('path');
const os = require('os');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2), {
    string: ['output', 'swan-core-path', 'work-path', 'sourcemap', 'uglify']
});

if (argv.v || argv.version) {
    console.info(pkg.version);
    process.exit(0);
}

if (argv.h || argv.help) {
    const help = `
    Options:
        -v, --version                   output the version number
        -h, --help                      output usage information
        --output                        File name where to store the resulting output
        --swan-core-path                swan-core lib path
        --work-path                     setting up your work-path
        --compiled-core-path            compiled core path，default null
        --sourcemap [boolean]           default true
        --compile-subpackage [boolean]  default false
        --compile-old-html [boolean]    default false
        --uglify [boolean]              default false
        --san-dev-hook [boolean]        default false
        --app-version                   define User's code version
        --no-color                      will force to not display colors even when color support is detected
        --use-old-component             use old custom component template to compile custom component swan file
        watch                           gulp watch
        watchremote                     gulp watchremote
        compilefull                     gulp compilefull
        --module                        difine load module's style, default is cmd
        --build-type                     distinguish compilation type
        --app-key                        the key value required for web compilation
        --ignore-config                 ignore watch specific file
        --port                          compile output server port, use memory compile mode
        --compiler-version              compiler version, required while --port is specifid
        --lib-version                   swan-core version, required while --port is specifid
        --index-page                    index page would be compile first, optional,
                                        only work while --port is specifid
        --ignore-prefix-css             auto prefix css styles true or false
        --ignore-trans-js               support transform es6 to es5 true or false
        --write-to-disk                 optional, write output to disk in memory compile mode
        --app-id                        the key value required for plugin
        --dynamic-lib-root              setting up your dynamicLib root path
        --plugin-root                   setting up your plugin root path
        --test                          setting test environment
    `;
    console.info(help);
    process.exit(0);
}

function generateRandomNUmber() {
    const arr = [];
    for (let i = 0; i < 5; i++) {
        arr.push(Math.floor(Math.random() * 10));
    }
    return arr.join('');
}
const tmpDir = os.tmpdir();
let swanCorePath = argv['swan-core-path'] || '';
const tempSwanCorePath = path.join(swanCorePath, 'dist/box');
if (fs.existsSync(tempSwanCorePath)) {
    swanCorePath = tempSwanCorePath;
}
global.__CACHE_CONTENT__  = {};
let cliRoot = process.env.SWAN_IDE_CLI_ROOT || path.join(os.homedir(), '.swan-cli');
const CACHE_DIRECTORY = global.__DEV__ ? path.resolve('.cache-loader')
    : path.resolve(cliRoot, 'vendor/program-compiler/.cache-loader');
const DYNAMIC_DIRECTORY = global.__DEV__ ? path.resolve('.dynamic-assets')
    : path.resolve(cliRoot, 'vendor/program-compiler/.dynamic-assets');
const PLUGIN_DIRECTORY = global.__DEV__ ? path.resolve('.plugin-assets')
    : path.resolve(cliRoot, 'vendor/program-compiler/.plugin-assets');
global.SWAN_CLI_ARGV = {
    OUTPUT: argv.output,
    WORK_PATH: argv['work-path'] || process.cwd(),
    SWAN_CORE_PATH: swanCorePath,
    SOURCEMAP: argv['sourcemap'] || 'inline',
    UGLIFY: argv['uglify'],
    SAN_DEV_HOOK: argv['san-dev-hook'],
    COMPILED_CORE_PATH: argv['compiled-core-path'],
    COMPILE_SUBPACKAGE: argv['compile-subpackage'],
    USE_OLD_HTML: argv['compile-old-html'],
    APP_VERSION: argv['app-version'] || '',
    SWAN_CLI_PROCESS: process,
    COMMAND: argv._,
    COMPILE_WORK_PATH: path.resolve(__dirname, '../'),
    MODULE: argv['module'] || 'cmd',
    // ENTRY_DIR_PATH: path.resolve(__dirname, '../temp_swan_compilation'),
    ENTRY_DIR_PATH: path.resolve(tmpDir, '.temp_swan_compilation', Date.now() + '' + generateRandomNUmber()),
    DYNAMIC_ENTRY_DIR_PATH: path.resolve(tmpDir, '.temp_dynamic_compilation', Date.now() + '' + generateRandomNUmber()),
    PLUGIN_ENTRY_DIR_PATH: path.resolve(tmpDir, '.temp_plugin_compilation', Date.now() + '' + generateRandomNUmber()),
    WEB_ENTRY_DIR_PATH: path.resolve(tmpDir, '.temp_web_compilation', Date.now() + '' + generateRandomNUmber()),
    BUILD_TYPE: argv['build-type'] || 'swan',
    DEV: argv['dev'],
    APPKEY: argv['app-key'],
    APPID: argv['app-id'],
    WEB_STATIC_PATH: argv['web-static-path'],
    STATIC_PREFIX: argv['static-prefix'] || '/',
    WEB_ENV: argv['web-env'],
    USE_OLD_COMPONENT: argv['use-old-component'],
    IGNORE_CONFIG: argv['ignore-config'],
    USE_CUSTOM_NODE: argv['use-custom-node'] || false,
    IS_WATCH: argv._.indexOf('watch') > -1 ? true : false,
    PORT: argv.port || false,
    COMPILER_VERSION: argv['compiler-version'] || '',
    LIB_VERSION: argv['lib-version'] || '',
    LOADER_VERSION: pkginfo.loader_version,
    CACHE_DIRECTORY: CACHE_DIRECTORY,
    INDEX_PAGE: argv['index-page'] || '',
    IGNORE_PREFIX_CSS: true,
    IGNORE_TRANS_JS: argv['ignore-trans-js'] || false,
    DYNAMIC_LIB_ROOT: argv['dynamic-lib-root'] || '',
    DYNAMIC_DIRECTORY,
    WRITE_TO_DISK: argv['write-to-disk'] || false,
    PLUGIN_ROOT: argv['plugin-root'] || '',
    PLUGIN_DIRECTORY,
    TEST: argv['test']
};
global.APPID = argv['app-id'] + '' || '';
