var webpack = require('webpack');

// Pretty good guide, here: https://angular.io/docs/ts/latest/guide/webpack.html
// good example of a super bloated one here https://github.com/preboot/angular2-webpack/blob/master/webpack.config.js

var path = require('path');
var fs = require('fs');
var PROD = JSON.parse(process.env.PROD_ENV || '0');

var plugins = PROD ? [
    new webpack.optimize.UglifyJsPlugin({
      beautify: false,
      mangle: { screw_ie8 : true, keep_fnames: true }, // need to keep fnames due to https://github.com/angular/angular/issues/10618
      compress: { screw_ie8: true },
      comments: false
    }),
    new webpack.optimize.DedupePlugin()
] : [];

var tslint = {
    emitErrors: true,
    failOnHint: true
};

var resolve = { extensions: ['', '.ts', '.js'] };

module.exports = [
    {
        debug: !PROD,
        name: 'bundle for blindpad frontend',
        entry: PROD ? './src/app/main.prod.ts' : './src/app/main.dev.ts',
        output: {
            path: __dirname + '/dist',
            filename: 'bundle.js',
            sourceMapFilename: 'bundle.map'
        },
        module: {
            preLoaders: [{ test: /\.ts$/, loader: 'tslint' }],
            loaders: [
                { test: /\.ts$/, exclude: /\.spec.ts$/, loaders: ['ts', 'angular2-template-loader'] },
                { test: /\.component.html$/, loader: 'raw' },
                { test: /\.component.scss$/, loaders: ['raw', 'sass'] },
                { test: /\.css$/, loaders: ['style-loader', 'css-loader'] },
                { test: /\.scss$/, loaders: ['file?name=[name].css', 'sass'], exclude: /\.component.scss$/ },
                { test: /\.(png|jpe?g|gif|svg|woff|woff2|ttf|eot|ico)$/, loader: 'file?name=assets/[name].[ext]' },
                { test: /\.ico$/, loader: 'file?name=[name].[ext]' },
            ]
        },
        sassLoader: {
            includePaths: [
                __dirname + '/src/scss/'
            ]
        },
        tslint: tslint,
        devServer: {
            historyApiFallback: true // this is necessary for fancy angular routing to work (probably won't on the average webserver)
        },
        plugins: plugins,
        resolve: resolve
    },
    {
        name: 'signaling server for node',
        target: 'node',
        entry: './src/signaler/Signaler.ts',
        output: {
            path: __dirname + '/dist',
            filename: 'server.js'
        },
        module: {
            preLoaders: [{ test: /\.ts$/, loader: 'tslint' }],
            loaders: [
                { test: /\.ts$/, exclude: /\.spec.ts$/, loaders: ['ts'] },
            ]
        },
        tslint: tslint,
        externals: (function () {
            var result = {};
            fs.readdirSync('node_modules')
                .filter(function (x) {
                    return ['.bin'].indexOf(x) === -1;
                })
                .forEach(function (mod) {
                    result[mod] = 'commonjs ' + mod;
                });
            return result;
        })(),
        plugins: plugins,
        resolve: resolve
    }
];
