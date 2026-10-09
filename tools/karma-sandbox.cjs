// Opt-in local runner for restricted Windows environments; not the default CI launcher.
module.exports = config => config.set({
  frameworks: ['jasmine', '@angular-devkit/build-angular'],
  plugins: [require('karma-jasmine'), require('karma-chrome-launcher'), require('@angular-devkit/build-angular/plugins/karma')],
  customLaunchers: {
    ChromeHeadlessSandbox: {base:'ChromeHeadless', flags:['--no-sandbox','--disable-gpu','--disable-gpu-sandbox','--in-process-gpu']}
  },
  browsers:['ChromeHeadlessSandbox'], reporters:['dots'], singleRun:true
});
