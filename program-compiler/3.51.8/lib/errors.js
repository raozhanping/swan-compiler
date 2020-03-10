'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
class ConfigIllegal extends Error {
    constructor(msg) {
        super(msg);
        this.name = `ConfigIllegal:${msg}`;
        this.level = 1;
        Error.captureStackTrace(this, ConfigIllegal);
        Object.defineProperty(this, 'message', { enumerable: true });
    }
}

exports.ConfigIllegal = ConfigIllegal;
class AppJsonIllegal extends ConfigIllegal {
    constructor(msg) {
        super(msg);
        this.name = 'AppJsonIllegal: app.json不合法';
        Error.captureStackTrace(this, AppJsonIllegal);
    }
}

exports.AppJsonIllegal = AppJsonIllegal;
class ServerError extends Error {
    constructor({ errno, errMsg }, uploadSpeed) {
        super(`${errno}:${errMsg}`);
        this.name = `ServerError:${errno}`;
        uploadSpeed && (this.uploadSpeed = uploadSpeed);
        Error.captureStackTrace(this, ServerError);
        Object.defineProperty(this, 'message', { enumerable: true });
    }
}

exports.ServerError = ServerError;
class InvalidOperation extends Error {
    constructor(msg) {
        super(msg);
        this.name = `InvalidOperation:${msg}`;
        Error.captureStackTrace(this, InvalidOperation);
        Object.defineProperty(this, 'message', { enumerable: true });
    }
}

exports.InvalidOperation = InvalidOperation;
class OperationLock extends Error {
    constructor(operation) {
        let msg = `操作"${operation}"正在运行中，请稍后再试。`;
        super(msg);
        this.name = `OperationLock:${msg}`;
        this.level = 1;
        Error.captureStackTrace(this, OperationLock);
        Object.defineProperty(this, 'message', { enumerable: true });
    }
}
exports.OperationLock = OperationLock;