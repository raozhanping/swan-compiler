'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wrapper;
const { fsWalker } = require('../util');
const path = require('path');
function wrapper(context) {
    let { fs, outputPath } = context;
    return function fileSizeMiddleware(req, res, next) {
        let result = [];
        fsWalker(fs, outputPath, (file, stats) => {
            if (stats.isFile()) {
                result.push({
                    path: path.relative(outputPath, file),
                    size: fs.meta(file).length
                });
            }
        });
        res.jsonp(result);
    };
}