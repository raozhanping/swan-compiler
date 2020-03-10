'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wrapper;

var _util = require('../util');

var _path = require('path');

/**
 * 输出app.json之前需要添加一些配置项
 * @param {*} context 
 */
function wrapper(context) {
    let { fs, outputPath, getPluginPages } = context;
    return function appJsonMiddleware(req, res, next) {
        let appJsonPath = (0, _path.join)(outputPath, 'app.json');
        let appJson;
        try {
            appJson = (0, _util.mfsReadJson)(fs, appJsonPath);
        } catch (e) {
            res.status(404).send('not ready');
            return;
        }
        appJson.pages = appJson.pages || [];
        let pluginPages = getPluginPages();
        appJson.pages = (0, _util.unionArray)(appJson.pages.concat(pluginPages));
        res.json(appJson);
    };
}