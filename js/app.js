(function () {
  window.addEventListener('DOMContentLoaded', function () {
    var tv = document.querySelector('#tv');
    tv.addEventListener('error', function () {
    });
    tv.addEventListener('load', function (e) {
    });

    var swap = window.swap = function (url) {
      tv.src = url;

      var i = 0;

      var interval = setInterval(function () {
        while (i >= 50) {
          clearInterval(internval);
          return;
        }
        i++;

        tv.contentWindow.postMessage({type: 'vr', data: 'enter'}, '*');

      }, 100);
    };
  });

  window.addEventListener('keyup', function (e) {
    console.log(e);
  });
})();
