'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * @file constants
 * @author liuyuekeng
 */
const TIMEOUT = exports.TIMEOUT = 1000 * 60 * 5;
const TIMEOUT_STATUS = exports.TIMEOUT_STATUS = -2;
// 二维码
const APP_SERVER_HOST_OLD = exports.APP_SERVER_HOST_OLD = process.env.HOST_SMARTAPP || 'https://smartapp.baidu.com';
// 其它B端接口
const APP_SERVER_HOST = exports.APP_SERVER_HOST = process.env.HOST_SMARTPROGRAM || 'https://smartprogram.baidu.com';
// PMS接口
const HOST_MBD_PMS = process.env.HOST_MBD_PMS || 'https://mbd.baidu.com';

const PROJECT_INFO_URL = exports.PROJECT_INFO_URL = `${APP_SERVER_HOST}/mappconsole/api/checkAppid`;
const PROJECT_DETAIL_URL = exports.PROJECT_DETAIL_URL = `${APP_SERVER_HOST}/mappconsole/api/appinfo`;
const USER_INFO_URL = exports.USER_INFO_URL = `${APP_SERVER_HOST}/mappconsole/api/checkUser`;
const PREVIEW_URL = exports.PREVIEW_URL = `${APP_SERVER_HOST}/mappconsole/api/packageReview`;
const CHECK_PREVIEW_URL = exports.CHECK_PREVIEW_URL = `${APP_SERVER_HOST}/mappconsole/api/packagedetail`;
const PUBLISH_URL = exports.PUBLISH_URL = `${APP_SERVER_HOST}/mappconsole/api/packageUpload`;
const PLUGIN_DOC_URL = exports.PLUGIN_DOC_URL = `${APP_SERVER_HOST}/mappconsole/api/plugin/docUpload`;
const WEB_PUBLISH_URL = exports.WEB_PUBLISH_URL = `${APP_SERVER_HOST}/mappconsole/api/websilence`;
const WEB_PREVIEW_URL = exports.WEB_PREVIEW_URL = `${APP_SERVER_HOST}/mappconsole/api/webreview`;
const CHECK_WEB_PREVIEW_URL = exports.CHECK_WEB_PREVIEW_URL = `${APP_SERVER_HOST}/mappconsole/api/webdetail`;
const DYNAMIC_LIB_UPLOAD_URL = exports.DYNAMIC_LIB_UPLOAD_URL = `${APP_SERVER_HOST}/mappconsole/api/dynamicLibUpload`;

// 开发动态库时，把app.json中的动态库版本设为最大
const DYNAMIC_DEV_VERSION = exports.DYNAMIC_DEV_VERSION = '999.999.999';
const SPECIAL_COMPONENT_START = exports.SPECIAL_COMPONENT_START = ['dynamicLib://', 'plugin://', 'plugin-private://'];
const SERVER_INFO = exports.SERVER_INFO = {
    SERVER_HOST: HOST_MBD_PMS,
    CHECK_PLUGINS_HOST: APP_SERVER_HOST,
    DOWNLOAD_INTERFACE: '/pms/getplugin',
    CHECK_PLUGINS: '/mappconsole/api/plugin/getPlugins',
    PUBLIC_PARAM: {
        cuid: new Date().getTime(),
        ua: '750_1334_iphone_10.9.0.1_0',
        host_os: 'Android',
        host_os_ver: '8.0',
        network: 'WIFI',
        host_app: 'baiduboxapp',
        host_app_ver: '11.2.0.0',
        sdk_ver: '2.3.0'
    },
    DOWNLOAD_PARAM: {
        // bundle_id: 'swan-game-sconsonle',
        category: 3,
        plugin_ver: 0
    }
};

// 插件在小程序产出包中的路径，可能会变？
const PLUGIN_PATH_IN_OUTPUT = exports.PLUGIN_PATH_IN_OUTPUT = '__plugin__';