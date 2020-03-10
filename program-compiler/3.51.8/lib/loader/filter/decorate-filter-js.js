'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (content) {
    const ast = parser.parse(content, {
        sourceType: 'module'
    });
    const fnNames = [];
    try {
        (0, _traverse2.default)(ast, {
            enter(path) {
                const { type, declaration } = path.node;
                if (type === 'ExportDefaultDeclaration') {
                    if (declaration.type === 'FunctionDeclaration') {
                        declaration.params.unshift(types.identifier('val'));
                        const defaultFnName = types.identifier('default');
                        const defaultMethod = types.objectMethod('method', defaultFnName, declaration.params, declaration.body);
                        const objExpression = types.objectExpression([defaultMethod]);
                        const returnStatement = types.returnStatement(objExpression);
                        path.replaceWith(returnStatement);
                        fnNames.push('default');
                    } else if (declaration.type === 'ObjectExpression') {
                        declaration.properties.forEach(property => {
                            if (property.type === 'ObjectMethod') {
                                property.params.unshift(types.identifier('val'));
                            }
                            if (property.type === 'ObjectProperty' && (property.value.type === 'FunctionExpression' || property.value.type === 'ArrowFunctionExpression')) {
                                property.value.params.unshift(types.identifier('val'));
                            }
                            fnNames.push(property.key.name);
                        });
                        const objExpression = types.objectExpression(declaration.properties);
                        const returnStatement = types.returnStatement(objExpression);
                        path.replaceWith(returnStatement);
                    } else {
                        util.log('It\'s not Support Export\'s Type: 【VariableDeclaration】', 'error');
                    }
                    path.stop();
                }
            }
        });
        const code = (0, _generator2.default)(ast, {}).code;
        return {
            code,
            fnNames
        };
    } catch (err) {
        util.log(err, 'error');
    }
};

var _parser = require('@babel/parser');

var parser = _interopRequireWildcard(_parser);

var _traverse = require('@babel/traverse');

var _traverse2 = _interopRequireDefault(_traverse);

var _generator = require('@babel/generator');

var _generator2 = _interopRequireDefault(_generator);

var _types = require('@babel/types');

var types = _interopRequireWildcard(_types);

var _util = require('../../util');

var util = _interopRequireWildcard(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }