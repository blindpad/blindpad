import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule }              from './app.module';
import { enableProdMode } from '@angular/core';

require('./README.prod.md');
require('../../LICENSE');

function main() {
    enableProdMode();
    platformBrowserDynamic().bootstrapModule(AppModule);
}

if (document.readyState === 'complete') {
    main();
} else {
    document.addEventListener('DOMContentLoaded', main);
}
