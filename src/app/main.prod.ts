import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule }              from './app.module';
import { enableProdMode } from '@angular/core';

require('file?name=[name].[ext]!./404.html');
require('file?name=[name]!../../LICENSE');
require('file?name=README.md!./README.prod.md');

function main() {
    enableProdMode();
    platformBrowserDynamic().bootstrapModule(AppModule);
}

if (document.readyState === 'complete') {
    main();
} else {
    document.addEventListener('DOMContentLoaded', main);
}
