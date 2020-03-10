'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.imageminPreview = exports.imageminWithMemoryFs = undefined;

let imageminWithMemoryFs = exports.imageminWithMemoryFs = (() => {
    var _ref = _asyncToGenerator(function* (fs, dir) {
        let imageFiles = getImageFiles(fs, dir);
        let newBuffs = yield imageminWithBuffs(imageFiles.map(function (item) {
            return item.buff;
        }));
        newBuffs.forEach(function (newBuff, index) {
            if (imageFiles[index].buff.length > newBuff.length) {
                fs.writeFileSync(imageFiles[index].file, newBuff);
            }
        });
    });

    return function imageminWithMemoryFs(_x, _x2) {
        return _ref.apply(this, arguments);
    };
})();

let imageminPreview = exports.imageminPreview = (() => {
    var _ref2 = _asyncToGenerator(function* (fs, dir) {
        let imageFiles = getImageFiles(fs, dir);
        let newBuffs = yield imageminWithBuffs(imageFiles.map(function (item) {
            return item.buff;
        }));
        let res = newBuffs.map(function (newBuff, index) {
            let valied = imageFiles[index].buff.length > newBuff.length;
            return {
                file: path.relative(dir, imageFiles[index].file),
                rawSize: imageFiles[index].buff.length,
                minimizedSize: valied ? newBuff.length : imageFiles[index].buff.length,
                diffSize: valied ? imageFiles[index].buff.length - newBuff.length : 0
            };
        });
        return res;
    });

    return function imageminPreview(_x3, _x4) {
        return _ref2.apply(this, arguments);
    };
})();

exports.imageminWithBuffs = imageminWithBuffs;

var _os = require('os');

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const pPipe = require('p-pipe');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const { fsWalker } = require('./util');
const path = require('path');
const os = require('os');
const arch = require('arch');

const plugins = [imageminJpegtran(), imageminPngquant({ quality: [0.5, 0.7], strip: true })];

function imageminWithBuffs(imgs) {
    if (arch() === 'x86' && os.platform === 'win32') {
        return Promise.reject(new Error('32位windows不支持图片压缩功能'));
    }
    imgs = Array.isArray(imgs) ? imgs : [imgs];
    let minifying = imgs.map(img => {
        return pPipe(...plugins)(img);
    });
    return Promise.all(minifying);
}

const IMG_FILE_REGEXP = /\.(jpg|JPG|png|PNG)$/;
function getImageFiles(fs, dir) {
    let files = [];
    let buffs = [];
    fsWalker(fs, dir, (file, stats) => {
        if (stats.isFile() && IMG_FILE_REGEXP.test(file)) {
            files.push(file);
            buffs.push(fs.readFileSync(file));
        }
    });
    let res = files.map((file, index) => ({
        file,
        buff: buffs[index]
    }));
    return res;
}