var path = require('path');

var createMsi = require('msi-packager-extended');

var options = {
  // required
  source: path.join(__dirname, 'firefox'),
  output: path.join(__dirname, 'releases', 'Moonrise.msi'),
  name: 'Moonrise',
  upgradeCode: 'YOUR-GUID-HERE',
  version: '1.0.0',
  manufacturer: 'agent.webvr.rocks',
  iconPath: path.join(__dirname, 'icon.ico'),
  executable: 'Moonrise.exe',

  // optional
  description: "Some description",
  arch: 'x86',
  localInstall: true
};

createMsi(options, function (err) {
  if (err) {
    throw err;
  }

  console.log('Outputed to %s', options.output);
});
