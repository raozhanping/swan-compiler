'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = wrapper;

var _imagemin = require('../imagemin');

function wrapper(context) {
    let { fs, outputPath } = context;
    return function imageminPreviewMiddleware(req, res, next) {
        (0, _imagemin.imageminPreview)(fs, outputPath).then(previewData => {
            res.jsonp(previewData);
        }).catch(e => {
            res.status(500).send(e.message);
        });
    };
}