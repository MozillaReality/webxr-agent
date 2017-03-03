var nexe = require('nexe');

nexe.compile({
  input: 'input.js', // where the input file is
  output: 'moonrise/', // where to output the compiled binary
  nodeVersion: '5.5.0', // node version
  nodeTempDir: 'tmp', // where to store node source.
  nodeConfigureArgs: ['opt', 'val'], // for all your configure arg needs.
  nodeMakeArgs: ['-j', '4'], // when you want to control the make process.
  resourceFiles: ['public/'], // array of files to embed.
  resourceRoot: ['public/'], // where to embed the resourceFiles.
  flags: true, // use this for applications that need command line flags.
  jsFlags: '--use_strict', // v8 flags
  framework: 'node' // node, nodejs, or iojs
}, function (err) {
  if (err) {
    return console.log(err);
  }
});
