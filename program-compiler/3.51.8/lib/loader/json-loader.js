'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (originContent) {
    try {
        JSON.parse(originContent);
        return originContent;
    } catch (err) {
        return '{}';
    }
};