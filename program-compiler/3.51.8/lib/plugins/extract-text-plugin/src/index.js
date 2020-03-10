'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _Chunk = require('webpack/lib/Chunk');

var _Chunk2 = _interopRequireDefault(_Chunk);

var _webpackSources = require('webpack-sources');

var _neoAsync = require('neo-async');

var _neoAsync2 = _interopRequireDefault(_neoAsync);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

var _schemaUtils = require('schema-utils');

var _schemaUtils2 = _interopRequireDefault(_schemaUtils);

var _ExtractTextPluginCompilation = require('./lib/ExtractTextPluginCompilation');

var _ExtractTextPluginCompilation2 = _interopRequireDefault(_ExtractTextPluginCompilation);

var _OrderUndefinedError = require('./lib/OrderUndefinedError');

var _OrderUndefinedError2 = _interopRequireDefault(_OrderUndefinedError);

var _helpers = require('./lib/helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable */
const NS = _path2.default.dirname(_fs2.default.realpathSync(__filename));

let nextId = 0;

class ExtractTextPlugin {
  constructor(options) {
    if ((0, _helpers.isString)(options)) {
      options = { filename: options };
    } else {
      (0, _schemaUtils2.default)(_path2.default.resolve(__dirname, '../schema/plugin.json'), options, 'Extract Text Plugin');
    }
    this.filename = options.filename;
    this.id = options.id != null ? options.id : ++nextId;
    this.workPath = options.workPath;
    this.options = {};
    (0, _helpers.mergeOptions)(this.options, options);
    delete this.options.filename;
    delete this.options.id;
  }

  static loader(options) {
    return { loader: require.resolve('./loader'), options };
  }

  applyAdditionalInformation(source, info) {
    if (info) {
      return new _webpackSources.ConcatSource(`@media ${info[0]} {`, source, '}');
    }
    return source;
  }

  loader(options) {
    return ExtractTextPlugin.loader((0, _helpers.mergeOptions)({ id: this.id }, options));
  }

  mergeNonInitialChunks(chunk, intoChunk, checkedChunks) {
    if (!intoChunk) {
      checkedChunks = [];
      chunk.chunks.forEach(c => {
        if ((0, _helpers.isInitialOrHasNoParents)(c)) return;
        this.mergeNonInitialChunks(c, chunk, checkedChunks);
      }, this);
    } else if (checkedChunks.indexOf(chunk) < 0) {
      checkedChunks.push(chunk);
      chunk.forEachModule(module => {
        intoChunk.addModule(module);
        module.addChunk(intoChunk);
      });
      chunk.chunks.forEach(c => {
        if ((0, _helpers.isInitialOrHasNoParents)(c)) return;
        this.mergeNonInitialChunks(c, intoChunk, checkedChunks);
      }, this);
    }
  }

  renderExtractedChunk(chunk, compilation) {
    const source = new _webpackSources.ConcatSource();
    let isExistAppCss = false;
    chunk.forEachModule(module => {
      const moduleName = _path2.default.relative(this.workPath, module._originalModule.resource);
      if (moduleName === 'app.css') {
        isExistAppCss = true;
      }
      const moduleSource = module.source();
      compilation.assets[moduleName] = moduleSource;
    }, this);
    if (!isExistAppCss) {
      compilation.assets['app.css'] = new _webpackSources.RawSource('');
    }
    return source;
  }

  extract(options) {
    if (Array.isArray(options) || (0, _helpers.isString)(options) || typeof options.options === 'object' || typeof options.query === 'object') {
      options = { use: options };
    } else {
      (0, _schemaUtils2.default)(_path2.default.resolve(__dirname, '../schema/loader.json'), options, 'Extract Text Plugin (Loader)');
    }
    let loader = options.use;
    let before = options.fallback || [];
    if ((0, _helpers.isString)(loader)) {
      loader = loader.split('!');
    }
    if ((0, _helpers.isString)(before)) {
      before = before.split('!');
    } else if (!Array.isArray(before)) {
      before = [before];
    }
    options = (0, _helpers.mergeOptions)({ omit: before.length, remove: true }, options);
    delete options.use;
    delete options.fallback;
    return [this.loader(options)].concat(before, loader).map(_helpers.getLoaderObject);
  }

  apply(compiler) {
    const options = this.options;
    compiler.plugin('this-compilation', compilation => {
      const extractCompilation = new _ExtractTextPluginCompilation2.default();
      compilation.plugin('normal-module-loader', (loaderContext, module) => {
        loaderContext[NS] = (content, opt) => {
          if (options.disable) {
            return false;
          }
          if (!Array.isArray(content) && content != null) {
            throw new Error(`Exported value was not extracted as an array: ${JSON.stringify(content)}`);
          }
          module[NS] = {
            content,
            options: opt || {}
          };
          return options.allChunks || module[`${NS}/extract`]; // eslint-disable-line no-path-concat
        };
      });
      const filename = this.filename;
      const id = this.id;
      let extractedChunks;
      compilation.plugin('optimize-tree', (chunks, modules, callback) => {
        extractedChunks = chunks.map(() => new _Chunk2.default());
        chunks.forEach((chunk, i) => {
          const extractedChunk = extractedChunks[i];
          extractedChunk.index = i;
          extractedChunk.originalChunk = chunk;
          extractedChunk.name = chunk.name;
          extractedChunk.entrypoints = chunk.entrypoints;
          chunk.chunks.forEach(c => {
            extractedChunk.addChunk(extractedChunks[chunks.indexOf(c)]);
          });
          chunk.parents.forEach(c => {
            extractedChunk.addParent(extractedChunks[chunks.indexOf(c)]);
          });
        });
        _neoAsync2.default.forEach(chunks, (chunk, callback) => {
          // eslint-disable-line no-shadow
          const extractedChunk = extractedChunks[chunks.indexOf(chunk)];
          const shouldExtract = !!options.allChunks;
          chunk.sortModules();
          _neoAsync2.default.forEach(chunk.mapModules(c => c), (module, callback) => {
            // eslint-disable-line no-shadow
            let meta = module[NS];
            if (meta && (!meta.options.id || meta.options.id === id)) {
              const wasExtracted = Array.isArray(meta.content);
              // A stricter `shouldExtract !== wasExtracted` check to guard against cases where a previously extracted
              // module would be extracted twice. Happens when a module is a dependency of an initial and a non-initial
              // chunk. See issue #604

              // check every module's chunks.parents() to decide extract or not
              for (let i = 0; i < module.chunks.length; i++) {
                if (!(0, _helpers.isInitialOrHasNoParents)(module.chunks[i]) && !module.extracted) {
                  module.extracted = true;
                  break;
                }
              }
              if (shouldExtract || !module.extracted && !wasExtracted) {
                module[`${NS}/extract`] = true; // eslint-disable-line no-path-concat
                compilation.rebuildModule(module, err => {
                  if (err) {
                    compilation.errors.push(err);
                    return callback();
                  }
                  meta = module[NS];
                  // Error out if content is not an array and is not null
                  if (!Array.isArray(meta.content) && meta.content != null) {
                    err = new Error(`${module.identifier()} doesn't export content`);
                    compilation.errors.push(err);
                    return callback();
                  }
                  if (meta.content) {
                    extractCompilation.addResultToChunk(module.identifier(), meta.content, module, extractedChunk);
                  }
                  callback();
                });
              } else {
                if (meta.content) {
                  extractCompilation.addResultToChunk(module.identifier(), meta.content, module, extractedChunk);
                }
                callback();
              }
            } else callback();
          }, err => {
            if (err) return callback(err);
            callback();
          });
        }, err => {
          if (err) return callback(err);
          extractedChunks.forEach(extractedChunk => {
            if ((0, _helpers.isInitialOrHasNoParents)(extractedChunk)) {
              this.mergeNonInitialChunks(extractedChunk);
            }
          }, this);
          extractedChunks.forEach(extractedChunk => {
            if (!(0, _helpers.isInitialOrHasNoParents)(extractedChunk)) {
              extractedChunk.forEachModule(module => {
                extractedChunk.removeModule(module);
              });
            }
          });
          compilation.applyPlugins('optimize-extracted-chunks', extractedChunks);
          callback();
        });
      });
      compilation.plugin('additional-assets', callback => {
        extractedChunks.forEach(extractedChunk => {
          if (extractedChunk.getNumberOfModules()) {
            extractedChunk.sortModules((a, b) => {
              if (!options.ignoreOrder && (0, _helpers.isInvalidOrder)(a, b)) {
                compilation.errors.push(new _OrderUndefinedError2.default(a.getOriginalModule()));
                compilation.errors.push(new _OrderUndefinedError2.default(b.getOriginalModule()));
              }
              return (0, _helpers.getOrder)(a, b);
            });
            this.renderExtractedChunk(extractedChunk, compilation);
          }
        }, this);
        callback();
      });
    });
  }
}

ExtractTextPlugin.extract = ExtractTextPlugin.prototype.extract.bind(ExtractTextPlugin);

exports.default = ExtractTextPlugin;