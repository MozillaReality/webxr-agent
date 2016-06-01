/* global define, module */
(function () {
  var webvrAgent = {};

  var datePublished = manifest.datePublished;
  var datePublishedPretty = new Date(datePublished).toLocaleDateString(datePublished, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  var fetchManifest = function (cb) {
    var manifest = document.querySelector('link[rel~="manifest"]');
    if (!manifest && !manifest.href) {
      return;
    }

    var iframe = document.createElement('iframe');
    iframe.style.borderWidth = 0;
    iframe.style.height = '0';
    iframe.style.width = '0';
    // iframe.style.height = '20vh';
    // iframe.style.maxHeight = '20rem';
    document.body.appendChild(iframe);

    var xhr = new XMLHttpRequest();
    xhr.open('get', manifest.href, true);
    xhr.addEventListener('load', function (err) {
      cb(err);
    });
    xhr.addEventListener('error', function () {
      cb(null, manifest.href);
    });
    xhr.send();
  };

  fetchManifest();

  if (typeof define === 'function' && define.amd) {
    define('webvr-agent', webvrAgent);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    module.exports = webvrAgent;
  } else if (window) {
    window.WEBVR_AGENT = webvrAgent;
  }
})();
