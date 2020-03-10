/**
 * @file utils/log
 * @author yupeng07
 */

module.exports = function log(value) {
    if (process.send) {
        process.send(value);
    }
    else {
        console.log(value);
    }
};
