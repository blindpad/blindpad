// Karma configuration

module.exports = function (config) {
  config.set({
    basePath: '', // base path that will be used to resolve all patterns (eg. files, exclude)
    reporters: ['spec'], // test results reporter to use
    port: 9876, // web server port
    colors: true, // enable / disable colors in the output (reporters and logs)
    logLevel: config.LOG_INFO, // level of logging, possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    autoWatch: false, // enable / disable watching file and executing tests whenever any file changes
    browsers: ['Chrome'], // start these browsers
    singleRun: true, // Continuous Integration mode, if true, Karma captures browsers, runs the tests and exits
    frameworks: ['jasmine'], // frameworks to use, available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    browserNoActivityTimeout: 100000,
    
    files: [ // list of files / patterns to load in the browser
      { pattern: './spec.bundle.js', watched: false }
    ],
    
    exclude: [], // list of files to exclude

    // preprocess matching files before serving them to the browser, available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'spec.bundle.js': ['webpack', 'sourcemap']
    },

    // webpack config
    webpack: {
      resolve: {
        extensions: ['', '.ts', '.js', '.json']
      },
      devtool: 'inline-source-map',
      module: {
        loaders: [
          { test: /\.ts$/, exclude: /node_modules/, loader: 'ts-loader' },
          { test: /\.(mp3|ogg)$/, loader: 'file?name=assets/[name].[ext]' },
        ]
      },
      stats: { colors: true, reasons: true },
      debug: false
    },
    webpackServer: {
      noInfo: true //please don't spam the console when running in karma!
    }
  });
};
