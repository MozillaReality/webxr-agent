/* global PouchDB */

(function () {
  window.addEventListener('load', function () {
    var db = new PouchDB('sessions');
    db.info().then(function (info) {
      console.log('Database info: ' + JSON.stringify(info));
    });
  });
})();
