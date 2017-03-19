'use strict';

import ext from './utils/ext';

var LIVERELOAD_HOST = 'localhost:';
var LIVERELOAD_PORT = 35729;
var connection = new WebSocket('ws://' + LIVERELOAD_HOST + LIVERELOAD_PORT + '/livereload');

connection.onerror = err => {
  console.log('Encountered error with reloading connection:', err);
};

connection.onmessage = evt => {
  if (evt.data) {
    var data = JSON.parse(evt.data);
    if (data && data.command === 'reload') {
      ext.runtime.reload();
    }
  }
};
