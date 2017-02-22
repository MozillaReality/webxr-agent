var path = require('path');

var electricity = require('electricity');
var express = require('express');
var expressPouchDB = require('express-pouchdb');
var PouchDB = require('pouchdb');

var app = express();

app.enable('trust proxy');

app.use(electricity.static(path.join(__dirname, 'public'), {
  hashify: false
}));

app.use('/db', expressPouchDB(PouchDB, {
  inMemoryConfig: true,
  overrideMode: {
    exclude: [
      // 'public/client.js',
      // 'public/host.html',
      // 'public/host.js',
    ]
  }
}));

app.get('/', function (req, res, next) {
});

app.listen(process.env.PORT || 7007);
