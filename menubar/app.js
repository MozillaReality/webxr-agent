var path = require('path');

var menubar = require('menubar');

var mb = menubar();

function connectToClient(port) {
  return new Promise(function(resolve, reject) {
    remote({
      port: port
    }, function(client) {
      resolve(client);
    }).on('error', function() {
      reject(Error('Unable to connect to client'));
    });
  });
}

mb.on('ready', function () {
  console.log('app is ready');

  connectToClient(9222).then(function (client) {
    console.log(client.Debugger);
  });
});

mb.on('after-create-window', () => {
  mb.window.on('devtools-opened', () => {
    setImmediate(() => {
      mb.window.focus();
    });
  });
  // mb.window.openDevTools();
  mb.window.loadURL('http://0.0.0.0:9222');
  // mb.window.loadURL('file://' + path.join(__dirname, 'index.html'));
});

mb.app.commandLine.appendSwitch('remote-debugging-port', '9222');
mb.app.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1');

// http://127.0.0.1:4444

// mainWindow = new BrowserWindow({ width: 1024, height: 768 });
// mainWindow.loadURL('your url');
