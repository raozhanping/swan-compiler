'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable max-len */

// import si from 'systeminformation';
const {
    WORK_PATH,
    MODULE,
    USE_OLD_HTML,
    BUILD_TYPE,
    USE_CUSTOM_NODE,
    COMMAND = [],
    DYNAMIC_LIB_ROOT,
    PLUGIN_ROOT
} = global.SWAN_CLI_ARGV; /**
                           * @file 数据统计
                           * @author zhuxin04
                           */


function dealMem(mem) {
    const ratio = 1024 * 1024 * 1024;
    return (mem / ratio).toFixed(2);
}
class CompilerData {
    constructor() {
        this.compilationJson = _path2.default.join(__dirname, '../package.json');
        this.userCodeJson = DYNAMIC_LIB_ROOT || PLUGIN_ROOT ? _path2.default.join(WORK_PATH, '../project.swan.json') : _path2.default.join(WORK_PATH, 'project.swan.json');
        this._endSignal = false;
        this.init();
        this.appKey;
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new CompilerData();
        }
        return this.instance;
    }

    init() {
        const cpus = _os2.default.cpus();
        const osInfo = {
            totalMen: dealMem(_os2.default.totalmem()), // 内存大小
            freeMen: dealMem(_os2.default.freemem()), // 空闲内存
            arch: _os2.default.arch(), // cpu 架构
            kernel: _os2.default.type(), // 操作系统内核
            platform: _os2.default.platform(), // 操作系统平台
            cpuModel: cpus[0].model, // cpu 型号
            cpuSpeed: cpus[0].speed, // cpu 频率
            diskType: ''
        };

        this._commonStatisticsData = {
            compileOld: USE_OLD_HTML || '', // 是否编译老包
            buildType: BUILD_TYPE, // 编译类型 swan-core/web化
            module: MODULE, // 编译模式， 普通模式/依赖分析模式
            useCustomNode: USE_CUSTOM_NODE,
            file: {
                sum: 0, // 文件总数
                js: 0, // js文件总数
                swan: 0, // swan文件总数
                image: 0, // 图片文件总数
                json: 0, // json文件总数
                css: 0 // css文件总数
            },
            os: osInfo,
            compileMode: 'normal',
            size: {
                js: 0,
                css: 0,
                swan: 0,
                json: 0
            }
        };
        // 获取硬盘类型
        // si.diskLayout(data => {
        //     this._commonStatisticsData['diskType'] = data[0].type;
        // });
        // 获取当前编译版本
        try {
            const packageObj = _fsExtra2.default.readJsonSync(this.compilationJson);
            this._commonStatisticsData.compilationVersion = packageObj['version'];
        } catch (err) {
            util.log(`${err.message}\n${err.stack}`);
        }
        // 获取用户代码中 appId
        try {
            const userCodePackageObj = _fsExtra2.default.readJsonSync(this.userCodeJson);
            this._commonStatisticsData.appid = userCodePackageObj.appid;
        } catch (err) {
            util.log(`${err.message}\n${err.stack}`);
        }

        try {
            const allJsFilesLen = _glob2.default.sync('{,!(node_modules)/**/}*.js', { cwd: WORK_PATH }).length;
            const allSwanFilesLen = _glob2.default.sync('{,!(node_modules)/**/}*.swan', { cwd: WORK_PATH }).length;
            const allJsonFilesLen = _glob2.default.sync('{,!(node_modules)/**/}*.json', { cwd: WORK_PATH }).length;
            const allCssFilesLen = _glob2.default.sync('{,!(node_modules)/**/}*.css', { cwd: WORK_PATH }).length;
            const allImageFilesLen = _glob2.default.sync('{,!(node_modules)/**/}*.+(png|PNG|jpg|JPG|jpeg|JPEG|gif|GIF|bmp|BMP|svg|SVG)', { cwd: WORK_PATH }).length;
            const sum = allJsFilesLen + allSwanFilesLen + allCssFilesLen + allJsonFilesLen + allImageFilesLen;
            this._commonStatisticsData.file = {
                js: allJsFilesLen,
                swan: allSwanFilesLen,
                css: allCssFilesLen,
                json: allCssFilesLen,
                image: allImageFilesLen,
                sum
            };
        } catch (e) {}

        this._normalStatisticsData = Object.assign({}, this._commonStatisticsData, {
            compileTime: {
                entry: 0, // 生成中间目录的时间
                sum: 0, // 编译总时长
                hot: 0, // 增量编译时间
                total: 0
            }

        });

        this._errStatisticsData = Object.assign({}, this._commonStatisticsData, {
            errInfo: {
                value: ''
            }
        });
    }

    get normalStatisticsData() {
        return this._normalStatisticsData;
    }

    get errStatisticsData() {
        return this._errStatisticsData;
    }

    fileSizeClear() {
        this.setValue('size', {
            js: 0,
            css: 0,
            swan: 0,
            json: 0
        });
    }

    getValue(keys, type = 'normal') {
        let statisticsData = this._normalStatisticsData;
        if (type === 'err') {
            statisticsData = this._errStatisticsData;
        }
        if (typeof keys === 'string') {
            const keysArr = keys.split('.');
            return keysArr.reduce((pre, next) => {
                return pre[next];
            }, statisticsData);
        }
    }

    setValue(keys, val, type = 'normal') {
        try {
            let statisticsData = this._normalStatisticsData;
            if (type === 'err') {
                statisticsData = this._errStatisticsData;
            }
            if (typeof keys === 'string') {
                const keysArr = keys.split('.');
                const len = keysArr.length;
                let record = 0;
                keysArr.reduce((pre, next) => {
                    const keyVal = pre[next];
                    record++;
                    if (typeof keyVal !== 'object') {
                        if (typeof val === 'string') {
                            const limitVal = val.slice(0, 800);
                            pre[next] = limitVal;
                            return limitVal;
                        } else {
                            pre[next] = val;
                            return val;
                        }
                    } else {
                        if (len === record) {
                            pre[next] = val;
                            return val;
                        }
                        return keyVal;
                    }
                }, statisticsData);
            }
        } catch (err) {
            // console.log(err);
        }
    }
}
exports.default = CompilerData; /* eslint-enable max-len */