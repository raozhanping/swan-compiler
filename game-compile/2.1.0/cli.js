/**
 * @file cli
 * @author yupeng07
 */

const version = require('./package').version;
const commander = require('commander');
const process = require('process');
const fs = require('fs');
const resolve = require('path').resolve;
const {log, copyFiles} = require('./src');
const sgb = require('@baidu/swan-game-build');
const sgbContant = sgb.constant;

commander
    .version(version)
    .option('--work-path [value]', 'Path of project wan\'t to pack.')
    .option('--output-dir [value]', 'Output directory. Default to be dist folder under work path')
    .option('--temp-dir-name [value]', 'Temporary directory name.')
    .option('--port [value]', 'The port of the server for downloading zip or preview, 8000 by default.')
    .option('--swan-path [value]', 'Swan (game) library path, only works on dev build of bbox.')
    .option('--weapp', 'If compatitable with weapp game')
    .option('--watch', 'If turn on watch mode')
    .option('--debug', 'development mode, no uglify, have source map')
    // args for swan-game-compilation
    .option('--simulator', 'simulator environment')
    .option('--app-id [value]', 'project appId')
    .parse(process.argv);
// 用于模拟器环境的数据
let {simulator, watch, debug, appId, swanPath, outputDir, tempDirName, workPath, weapp} = commander;

outputDir = outputDir || resolve(__dirname, './dist');

global.SWAN_CLI_CONFIG = {
    // SWAN_PATH: sdkPath, // 编译产出不应该有 swan-game, 应该端内置
    WORK_PATH: workPath || resolve(__dirname, './'),
    OUTPUT_DIR: outputDir,
    TEMP_DIR_NAME: tempDirName || './',
    IS_TEST: false,
    PLATFORM: 'swan',
    WEAPP: weapp,
    DEBUG: debug,
    WATCH: watch
};
const builder = sgb.createBuilder({
    appDir: SWAN_CLI_CONFIG.WORK_PATH,
    entryFile: '',
    outputDir: SWAN_CLI_CONFIG.OUTPUT_DIR,
    appOutputDir: './',
    targetPlatform: SWAN_CLI_CONFIG.PLATFORM,
    sourcePlatform: SWAN_CLI_CONFIG.WEAPP ? sgbContant.SourcePlatform.WEAPP : sgbContant.SourcePlatform.SWAN,
    watch: SWAN_CLI_CONFIG.WATCH,
    debug: SWAN_CLI_CONFIG.DEBUG,
    zip: false
});
builder.build();

const startTime = Date.now();

process.on('compileComplete', async function () {
    log({method: 'log', value: `代码编译完成,耗时:${Date.now() - startTime}ms`});
    if (simulator && !fs.existsSync(`${outputDir}/index.html`)) {
        // 复制 .html 文件到 outputDir
        copyFiles(resolve(__dirname, './template'), outputDir);
        log({method: 'compilation', progress: 'end'});
    }
    else {
        log({method: 'compilation', progress: 'end'});
    }
});

/** 静态资源监听 */
process.on('resourceCompileComplete', async () => {
    log({method: 'completeRefesh', progress: 'restart'});
})

// 打印编译log信息
process.on('compileLog', function (value) {
    log({method: 'log', value: value});
});
// 打印编译error信息
process.on('compileError', function (value) {
    log({method: 'log', level: 'error', value: value});
});

log({method: 'compilation', progress: 'start'});
