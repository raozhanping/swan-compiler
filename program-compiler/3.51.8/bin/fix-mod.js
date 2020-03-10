const fs = require('fs');
const path = require('path');
const os = require('os');

if ('darwin' === os.platform()) {
    fs.chmodSync(path.resolve(__dirname, '../node_modules/jpegtran-bin/vendor/jpegtran'), 0o755);
    fs.chmodSync(path.resolve(__dirname, '../node_modules/pngquant-bin/vendor/pngquant'), 0o755);
}