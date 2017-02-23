/* jshint esversion: 6 */
/* eslint-env es6 */
/* global define, exports, module */

var WindowPostMessageProxy = require('window-post-message-proxy');

var SCENE_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var ORIGIN = new URL(document.currentScript.src).origin;
var WEBVR_AGENT_ORIGIN = `${window.location.protocol}//${window.location.hostname}:4040`;
var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = process.env.NODE_ENV === 'production';

/* Adapted from source: https://gist.github.com/mudge/5830382 */
function EventEmitter () {
  this.events = {};
}
EventEmitter.prototype.on = function (event, listener) {
  if (typeof this.events[event] !== 'object') {
    this.events[event] = [];
  }

  this.events[event].push(listener);
};
EventEmitter.prototype.removeListener = function (event, listener) {
  var idx;

  if (typeof this.events[event] === 'object') {
    idx = this.events[event].indexOf(listener);

    if (idx > -1) {
      this.events[event].splice(idx, 1);
    }
  }
};
EventEmitter.prototype.emit = function (event) {
  var i;
  var listeners;
  var length;
  var args = Array.prototype.slice.call(arguments, 1);

  if (typeof this.events[event] === 'object') {
    listeners = this.events[event].slice();
    length = listeners.length;

    for (i = 0; i < length; i++) {
      listeners[i].apply(this, args);
    }
  }
};
EventEmitter.prototype.once = function (event, listener) {
  this.on(event, function g () {
    this.removeListener(event, g);
    listener.apply(this, arguments);
  });
};

function WebvrAgent (opts) {
  this._inited = false;
  this._injected = false;
  this._listeners = {};
  this.opts = opts || {};
  this.timeout = 'timeout' in this.opts ? this.opts.timeout : 0;
  this.originHost = this.opts.originHost = (this.opts.uriHost || WEBVR_AGENT_ORIGIN || WEBVR_AGENT_ORIGIN_PROD || ORIGIN).replace(/\/+$/g, '');
  this.uriHost = this.opts.uriHost = this.opts.uriHost || (this.originHost + '/index.html');
  this.debug = this.opts.debug = 'debug' in this.opts ? !!this.opts.debug : !IS_PROD;
  this.proxy = this.opts.proxy || new WindowPostMessageProxy.WindowPostMessageProxy({
    name: this.originHost,
    logMessages: false
    // logMessages: this.opts.debug
  });
  this.connectedDisplay = null;
  EventEmitter.call(this);
}
Object.create(WebvrAgent, EventEmitter);
WebvrAgent.prototype.init = function () {
  if (this._inited) {
    return false;
  }
  this._inited = true;
  return this.inject();
};
WebvrAgent.prototype.ready = WebvrAgent.prototype.inject = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    if (self._injected) {
      resolve(false);
      return;
    }
    self._injected = true;
    console.log('[webvr-agent][client] Injecting `<iframe>` for "%s"', self.uriHost);
    var iframe = self.iframe = document.createElement('iframe');
    iframe.src = self.uriHost;
    // iframe.style.cssText = 'border-width: 0; height: 0; width: 0';
    iframe.style.cssText = 'border-width: 0; height: 10vh; width: 100%; position: absolute; bottom: 0; right: 0; left: 0';
    iframe.addEventListener('load', function () {
      resolve(self.proxy);
      console.log('[webvr-agent][client] Injected `<iframe>` for "%s"', self.uriHost);
    });
    iframe.addEventListener('error', function (err) {
      reject(err);
      console.warn('[webvr-agent][client] Could not load:', err);
    });
    // iframe.style.height = '20vh';
    // iframe.style.maxHeight = '20rem';
    window.addEventListener('load', function () {
      document.body.appendChild(iframe);
    });
  });
};
WebvrAgent.prototype.requestPresent = function (display, canvas) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var aframeScene = canvas && canvas.matches('a-scene') ? canvas : document.querySelector('a-scene');
    if (aframeScene) {
      if (aframeScene.hasLoaded) {
        // present(aframeScene.canvas);
        resolve(aframeScene.enterVR());
      } else {
        aframeScene.addEventListener('loaded', function () {
          // present(aframeScene.canvas);
          resolve(aframeScene.enterVR());
        });
      }
    } else if (!canvas) {
      canvas = document.querySelector('canvas');
    }

    if (!canvas) {
      throw new Error('Canvas source empty');
    }

    if (display) {
      return display.requestPresent([{source: canvas}]);
    }

    return self.getConnectedDisplay().then(function (display) {
      if (!display) {
        return;
      }
      return display.requestPresent([{source: canvas}]);
    });
  });
};
WebvrAgent.prototype.isDisplayConnected = function (display) {
  if (!display) {
    return false;
  }
  if ('isConnected' in display) {
    return display.isConnected;
  }
  if ('conneted' in display) {
    return display.connected;
  }
  return false;
};
WebvrAgent.prototype.getConnectedDisplay = function (defaultDisplay) {
  var self = this;
  if (navigator.vr) {
    // For WebVR v1.2 API.
    navigator.vr.addEventListener('displayconnect', handleVREventDisplayConnect);
    navigator.vr.addEventListener('displaydisconnect', handleVREventDisplayDisconnect);
    navigator.vr.addEventListener('navigate', handleVREventNavigate);

    // TODO: For each `VRDisplay` instance, add these event listeners:
    // - `activate`
    // - `deactivate`
    // - `blur`
    // - `blurred`
    // - `focus`
    // - `focused`
    // - `focussed`
    // - `presentchange`

    // TODO: Support WebVR v2.0 API.
  } else if (navigator.getVRDisplays) {
    // For WebVR v1.1 API.
    window.addEventListener('vrdisplayconnected', handleVREventDisplayConnect);
    window.addEventListener('vrdisplayconnect', handleVREventDisplayConnect);
    window.addEventListener('vrdisplaydisconnected', handleVREventDisplayDisconnect);
    window.addEventListener('vrdisplaydisconnect', handleVREventDisplayDisconnect);

    window.addEventListener('vrdisplayactivate', handleVREventDisplayActivate);
    window.addEventListener('vrdisplayactivated', handleVREventDisplayActivate);

    window.addEventListener('vrdisplaydeactivate', handleVREventDisplayDeactivate);
    window.addEventListener('vrdisplaydeactivated', handleVREventDisplayDeactivate);

    window.addEventListener('vrdisplayblur', handleVREventDisplayBlur);
    window.addEventListener('vrdisplayfocus', handleVREventDisplayFocus);

    window.addEventListener('vrdisplaypresentchange', handleVREventDisplayPresentChange);
  }

  var handleVREventDisplayConnect = self._listeners.displayConnect = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };
  var handleVREventDisplayDisconnect = self._listeners.displayDisconnect = function (evt) {
    if (evt.display) {
      self.connectedDisplay = null;
    }
  };
  var handleVREventDisplayNavigate = self._listeners.navigate = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };

  var handleVREventDisplayActivate = self._listeners.displayConnect = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };

  var handleVREventDisplayDeactivate = self._listeners.displayDeactivate = function (evt) {
    if (evt.display) {
      self.connectedDisplay = null;
    }
  };

  var handleVREventDisplayBlur = self._listeners.displayBlur = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };

  var handleVREventDisplayFocus = self._listeners.displayFocus = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };

  var handleVREventDisplayPresentChange = self._listeners.displayPresentChange = function (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  };

  return new Promise(function (resolve, reject) {
    var connectedDisplay = self.connectedDisplay;
    if (connectedDisplay) {
      resolve(connectedDisplay);
      return;
    }
    if (navigator.vr) {
      navigator.vr.getDisplays.then(findConnectedDisplays).then(resolve);
    } else {
      navigator.getVRDisplays.then(findConnectedDisplays).then(resolve);
    } else {
      resolve(defaultDisplay || null);
    }
    function findConnectedDisplays (displays) {
      self.connectedDisplay = (displays || []).filter(function (display) {
        return self.isDisplayConnected(display);
      })[0] || defaultDisplay || null;
    }
  });
};

var webvrAgent = new WebvrAgent();

webvrAgent.ready().then(function (proxy) {
  console.log('[webvr-agent][client] Ready');

  // Send message.
  var message = {
    site: document.title
  };

  console.log('iframe', webvrAgent.iframe);

  // window.proxy = proxy;
  // window.webvrAgent = webvrAgent;

  var handleVREvent = function (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
  };

  window.addEventListener('vrdisplayactivate', handleVREvent);
  window.addEventListener('vrdisplayactivated', handleVREvent);

  window.addEventListener('vrdisplaydeactivate', handleVREvent);
  window.addEventListener('vrdisplaydeactivated', handleVREvent);

  window.addEventListener('vrdisplaypresentchange', function (evt) {
    console.log(evt.type, evt.reason);
    if (evt.reason === 'navigation') {
      webvrAgent.requestPresent();
    }
  });

  window.addEventListener('keypress', function (evt) {
    if (evt.target === document.body && evt.key === 27) {  // Esc key.
      webvrAgent.exitPresent();
    }
  });

  var evt = new CustomEvent('vrdisplaypresentchange', {});
  evt.display = 'VRDisplay';
  evt.reason = 'navigation';
  window.dispatchEvent(evt);

  proxy.postMessage(webvrAgent.iframe.contentWindow, message).then(function (res) {
    console.log('response', res);
  });
}).catch(console.error.bind(console));

if (typeof define === 'function' && define.amd) {
  define('webvr-agent', webvrAgent);
} else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
  module.exports = webvrAgent;
} else if (window) {
  window.webvrAgent = webvrAgent;
}
