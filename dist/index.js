'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _chunk = require('./chunk');

var _chunk2 = _interopRequireDefault(_chunk);

var _SourceMapSource = require('webpack/lib/SourceMapSource');

var _SourceMapSource2 = _interopRequireDefault(_SourceMapSource);

var _RawSource = require('webpack/lib/RawSource');

var _RawSource2 = _interopRequireDefault(_RawSource);

var _loaderUtils = require('loader-utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Detect if a file should be considered for CSS splitting.
 * @param {String} name Name of the file.
 * @returns {Boolean} True if to consider the file, false otherwise.
 */
var isCSS = function isCSS(name) {
  return (/\.css$/.test(name)
  );
};

/**
 * Remove the trailing `/` from URLs.
 * @param {String} str The url to strip the trailing slash from.
 * @returns {String} The stripped url.
 */
var strip = function strip(str) {
  return str.replace(/\/$/, '');
};

/**
 * Create a function that generates names based on some input. This uses
 * webpack's name interpolator under the hood, but since webpack's argument
 * list is all funny this exists just to simplify things.
 * @param {String} input Name to be interpolated.
 * @returns {Function} Function to do the interpolating.
 */
var nameInterpolator = function nameInterpolator(input) {
  return function (_ref) {
    var file = _ref.file;
    var content = _ref.content;
    var index = _ref.index;

    var res = (0, _loaderUtils.interpolateName)({
      context: '/',
      resourcePath: '/' + file
    }, input, {
      content: content
    }).replace(/\[part\]/g, index + 1);
    return res;
  };
};

/**
 * Normalize the `imports` argument to a function.
 * @param {Boolean|String} input The name of the imports file, or a boolean
 * to use the default name.
 * @param {Boolean} preserve True if the default name should not clash.
 * @returns {Function} Name interpolator.
 */
var normalizeImports = function normalizeImports(input, preserve) {
  switch (typeof input === 'undefined' ? 'undefined' : _typeof(input)) {
    case 'string':
      return nameInterpolator(input);
    case 'boolean':
      if (input) {
        if (preserve) {
          return nameInterpolator('[name]-split.[ext]');
        }
        return function (_ref2) {
          var file = _ref2.file;
          return file;
        };
      }
      return function () {
        return false;
      };
    default:
      throw new TypeError();
  }
};

/**
 * Webpack plugin to split CSS assets into multiple files. This is primarily
 * used for dealing with IE <= 9 which cannot handle more than ~4000 rules
 * in a single stylesheet.
 */

var CSSSplitWebpackPlugin = function () {
  /**
   * Create new instance of CSSSplitWebpackPlugin.
   * @param {Number} size Maximum number of rules for a single file.
   * @param {Boolean|String} imports Truish to generate an additional import
   * asset. When a boolean use the default name for the asset.
   * @param {String} filename Control the generated split file name.
   * @param {Boolean} preserve True to keep the original unsplit file.
   */

  function CSSSplitWebpackPlugin(_ref3) {
    var _ref3$size = _ref3.size;
    var size = _ref3$size === undefined ? 4000 : _ref3$size;
    var _ref3$imports = _ref3.imports;
    var imports = _ref3$imports === undefined ? false : _ref3$imports;
    var _ref3$filename = _ref3.filename;
    var filename = _ref3$filename === undefined ? '[name]-[part].[ext]' : _ref3$filename;
    var preserve = _ref3.preserve;

    _classCallCheck(this, CSSSplitWebpackPlugin);

    this.options = {
      size: size,
      imports: normalizeImports(imports, preserve),
      filename: nameInterpolator(filename),
      preserve: preserve
    };
  }

  /**
   * Generate the split chunks for a given CSS file.
   * @param {String} key Name of the file.
   * @param {Object} asset Valid webpack Source object.
   * @returns {Promise} Promise generating array of new files.
   */


  _createClass(CSSSplitWebpackPlugin, [{
    key: 'file',
    value: function file(key, asset) {
      var _this = this;

      // Use source-maps when possible.
      var input = asset.sourceAndMap ? asset.sourceAndMap() : {
        source: asset.source()
      };
      var name = function name(i) {
        return _this.options.filename(_extends({}, asset, {
          content: input.source,
          file: key,
          index: i
        }));
      };
      return (0, _postcss2.default)([(0, _chunk2.default)(this.options)]).process(input.source, {
        map: {
          prev: input.map
        }
      }).then(function (result) {
        return Promise.resolve({
          file: key,
          chunks: result.chunks.map(function (_ref4, i) {
            var css = _ref4.css;
            var map = _ref4.map;

            return new _SourceMapSource2.default(css, name(i), map.toString());
          })
        });
      });
    }

    /**
     * Run the plugin against a webpack compiler instance. Roughly it walks all
     * the chunks searching for CSS files and when it finds one that needs to be
     * split it does so and replaces the original file in the chunk with the split
     * ones. If the `imports` option is specified the original file is replaced
     * with an empty CSS file importing the split files, otherwise the original
     * file is removed entirely.
     * @param {Object} compiler Compiler instance
     * @returns {void}
     */

  }, {
    key: 'apply',
    value: function apply(compiler) {
      var _this2 = this;

      // Only run on `this-compilation` to avoid injecting the plugin into
      // sub-compilers as happens when using the `extract-text-webpack-plugin`.
      compiler.plugin('this-compilation', function (compilation) {
        var assets = compilation.assets;
        var publicPath = strip(compilation.options.output.publicPath || './');
        compilation.plugin('optimize-chunk-assets', function (chunks, done) {
          var promises = chunks.map(function (chunk) {
            var input = chunk.files.filter(isCSS);
            var items = input.map(function (name) {
              return _this2.file(name, assets[name]);
            });
            return Promise.all(items).then(function (entries) {
              entries.forEach(function (entry) {
                // Skip the splitting operation for files that result in no
                // split occuring.
                if (entry.chunks.length === 1) {
                  return;
                }
                // Inject the new files into the chunk.
                entry.chunks.forEach(function (file) {
                  assets[file._name] = file;
                  chunk.files.push(file._name);
                });
                var content = entry.chunks.map(function (file) {
                  return '@import "' + publicPath + '/' + file._name + '";';
                }).join('\n');
                var imports = _this2.options.imports(_extends({}, entry, {
                  content: content
                }));
                if (!_this2.options.preserve) {
                  chunk.files.splice(chunk.files.indexOf(entry.file), 1);
                  delete assets[entry.file];
                }
                if (imports) {
                  assets[imports] = new _RawSource2.default(content);
                  chunk.files.push(imports);
                }
              });
              return Promise.resolve();
            });
          });
          Promise.all(promises).then(function () {
            done();
          }, done);
        });
      });
    }
  }]);

  return CSSSplitWebpackPlugin;
}();

exports.default = CSSSplitWebpackPlugin;
//# sourceMappingURL=index.js.map