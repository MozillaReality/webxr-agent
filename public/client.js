/* global define, exports, module */
(function () {
  function WebvrAgent () {
    this._init = false;
  }
  WebvrAgent.prototype.init = function () {
    if (this._init) {
      return false;
    }
    window.addEventListener('message', function (evt) {
      var msg = evt.data;
      var origin = evt.origin;
      var type = msg.type;
      var data = msg.data;
      console.log('[webvr-agent][client] Message received:', msg);
    });
  };
  WebvrAgent.prototype.inject = function (callback) {
    var iframe = document.createElement('iframe');
    iframe.src = 'webvr-agent.html';
    iframe.style.borderWidth = '0';
    iframe.style.height = '0';
    iframe.style.width = '0';
    iframe.addEventListener('load', function () {
      if (callback) {
        callback(null, null);
        return;
      }
    });
    iframe.addEventListener('error', function (err) {
      if (callback) {
        callback(err, null);
        return;
      }
      console.warn('[webvr-agent][client] Could not load:', err);
    });
    // iframe.style.height = '20vh';
    // iframe.style.maxHeight = '20rem';
    document.body.appendChild(iframe);
  };

  var webvrAgent = new WebvrAgent();

  window.addEventListener('load', function () {
    if (!webvrAgent._init) {
      setTimeout(function () {
        webvrAgent.init();
      }, 3000);
    }
  });

  if (typeof define === 'function' && define.amd) {
    define('webvr-agent', webvrAgent);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    module.exports = webvrAgent;
  } else if (window) {
    window.webvrAgent = webvrAgent;
  }
})();
