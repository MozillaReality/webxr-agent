/* global define, exports, module, process, require */

var WindowPostMessageProxy = require('window-post-message-proxy');

var SCENE_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var ORIGIN = '';
try {
  ORIGIN = new URL(document.currentScript.src).origin;
} catch (e) {
  ORIGIN = SCENE_ORIGIN;
}
var WEBVR_AGENT_ORIGIN = window.location.protocol + '//' + window.location.hostname + ':4040';
var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = process.env.NODE_ENV === 'production';

/* Adapted from source: https://github.com/jonathantneal/document-promises/blob/master/document-promises.es6 */
var doc = {};
doc.loaded = new Promise(function (resolve) {
  var listener = function () {
    if (document.readyState === 'complete') {
      document.removeEventListener('readystatechange', listener);
      resolve();
    }
  };
  document.addEventListener('readystatechange', listener);
  listener();
});
doc.parsed = new Promise(function (resolve) {
  var listener = function () {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      document.removeEventListener('readystatechange', listener);
      resolve();
    }
  };
  document.addEventListener('readystatechange', listener);
  listener();
});
doc.contentLoaded = new Promise(function (resolve) {
  var listener = function () {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      document.removeEventListener('DOMContentLoaded', listener);
      resolve();
    }
  };
  document.addEventListener('DOMContentLoaded', listener);
  listener();
});

// /* Adapted from source: https://gist.github.com/mudge/5830382 */
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
  this._displayListenersSet = false;
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
WebvrAgent.prototype.attemptRequestPresentUponNavigation = function () {
  return new Promise(function (resolve) {
    // Polyfill behaviour of `navigator.vr`'s `navigate` event.
    var xhr = new XMLHttpRequest();
    xhr.open('get', webvrAgent.originHost + '/sessions', 'true');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.addEventListener('load', function () {
      var data = {};
      try {
        // NOTE: Not parsing as JSON using `XMLHttpRequest#responseType` because of incomplete browser support.
        data = JSON.parse(xhr.responseText || '{}');
      } catch (e) {
      }

      if (data.displayIsPresenting && data.displayId) {
        webvrAgent.getConnectedDisplay(data.displayId).then(function (display) {
          resolve(webvrAgent.requestPresent(display));
        });
      } else {
        resolve(null);
      }
    });
    xhr.addEventListener('error', function (err) {
      console.warn(err);
      resolve(null);
    });
    xhr.send();
  });
};
WebvrAgent.prototype.ready = function () {
  return Promise.all([
    // this.getConnectedDisplay(),  // NOTE: Workaround for Firefox Nightly to engage VR mode.
    this.attemptRequestPresentUponNavigation(),
    this.inject(),
    this.addUIAndEventListeners()
  ]);
};
WebvrAgent.prototype.addUIAndEventListeners = function () {
  var self = this;
  window.addEventListener('keypress', function (evt) {
    if (evt.target === document.body && evt.keyCode === 27) {  // Esc key.
      self.exitPresent();
    }
  });
};
WebvrAgent.prototype.inject = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    if (self._injected) {
      resolve(false);
      return;
    }
    self._injected = true;
    console.log('[webvr-agent][client] Injecting `<iframe>` for "%s"', self.uriHost);
    var iframe = self.iframe = document.createElement('iframe');
    iframe.src = self.uriHost + '?url=' + window.location.href;
    iframe.style.cssText = 'border-width: 0; height: 61px; width: 100%; position: absolute; bottom: 0; right: 0; left: 0; z-index: 99999';
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
    return doc.loaded.then(function () {
      var aframeScene = canvas && canvas.matches('a-scene') ? canvas : document.querySelector('a-scene');
      canvas = canvas || document.querySelector('canvas');

      if (aframeScene) {
        if (aframeScene.hasLoaded) {
          // present(aframeScene.canvas);
          return aframeScene.enterVR().then(function () {
            resolve(display);
          });
        } else {
          aframeScene.addEventListener('loaded', function () {
            // present(aframeScene.canvas);
            return aframeScene.enterVR().then(function () {
              resolve(display);
            });
          });
        }
      }

      if (!canvas) {
        throw new Error('Canvas source empty');
      }

      if (display) {
        return display.requestPresent([{source: canvas}]).then(function () {
          resolve(display);
        });
      }

      return self.getConnectedDisplay(display ? display.id : null, display).then(function (display) {
        if (!display) {
          return;
        }
        return display.requestPresent([{source: canvas}]).then(function () {
          resolve(display);
        });
      });
    });
  });
};
WebvrAgent.prototype.exitPresent = function (display, canvas) {
  var self = this;
  return new Promise(function (resolve) {
    display = display || self.connectedDisplay;
    if (self.isDisplayPresenting(self.connectedDisplay)) {
      resolve(new Error('Display not presenting'));
      return;
    }
    return self.connectedDisplay.exitPresent().then(function () {
      resolve(true);
    }, function (err) {
      resolve(new Error('Failed to exit VR presentation' +
        (err && err.message ? ':' + err.message : '')));
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
  if ('connected' in display) {
    return display.connected;
  }
  return false;
};
WebvrAgent.prototype.isDisplayPresenting = function (display) {
  if (!display) {
    return false;
  }
  if ('isPresenting' in display) {
    return display.isPresenting;
  }
  if ('presenting' in display) {
    return display.presenting;
  }
  return false;
};
WebvrAgent.prototype.getConnectedDisplay = function (preferredDisplayId, defaultDisplay) {
  var self = this;

  if (preferredDisplayId) {
    preferredDisplayId = String(preferredDisplayId);
  }

  // Polyfill behaviour of `navigator.vr`'s `navigate` event.
  function persistVRDisplayPresentationState (display) {
    display = display || self.connectedDisplay;
    var displayIsPresenting = webvrAgent.isDisplayPresenting(display);

    // Persist state of VR presentation.
    var xhr = new XMLHttpRequest();
    xhr.open('post', webvrAgent.originHost + '/sessions', 'true');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({
      docURL: window.location.href,
      docTitle: document.title,
      displayIsPresenting: displayIsPresenting,
      displayId: String(display.displayId || display.id),
      displayName: display.displayName || display.displayName
    }));
  }

  if (!self._displayListenersSet) {
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
  }

  self._displayListenersSet = true;

  function handleVREventDisplayConnect (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  }

  function handleVREventDisplayDisconnect (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = null;
    }
  }

  function handleVREventNavigate (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  }

  function handleVREventDisplayActivate (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
    if (evt.reason === 'mount' || evt.reason === 'mounted' ||
        evt.reason === 'requested' ||
        evt.reason === 'navigation' ||
        !evt.reason) {
      if (self.mountedDisplay !== evt.connectedDisplay) {
        self.mountedDisplay = evt.display;
      }
    }
  }

  function handleVREventDisplayDeactivate (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = null;
    }
    if (evt.reason === 'unmount' || evt.reason === 'unmounted' || !evt.reason) {
      if (self.mountedDisplay === evt.connectedDisplay) {
        self.mountedDisplay = null;
      }
    }
  }

  function handleVREventDisplayBlur (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  }

  function handleVREventDisplayFocus (evt) {
    if (evt.display) {
      self.connectedDisplay = evt.display;
    }
  }

  function handleVREventDisplayPresentChange (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.connectedDisplay = evt.display;
      self.readyToPresentDisplay = evt.display;
    }
    persistVRDisplayPresentationState(evt.display || self.connectedDisplay);
  }

  return new Promise(function (resolve, reject) {
    var connectedDisplay = self.connectedDisplay;
    if (connectedDisplay) {
      resolve(connectedDisplay);
      return;
    }

    if (navigator.vr) {
      return navigator.vr.getDisplays().then(findConnectedDisplays).then(resolve);
    } else if (navigator.getVRDisplays) {
      return navigator.getVRDisplays().then(findConnectedDisplays).then(resolve);
    } else {
      resolve(defaultDisplay || null);
      return;
    }

    function findConnectedDisplays (displays) {
      displays = displays || [];
      var connectedDisplay = preferredDisplayId ? displays.filter(function (display) {
        if (display.displayId && String(display.displayId) === preferredDisplayId) {
          return self.isDisplayConnected(display);
        }
      })[0] : null;
      self.connectedDisplay = connectedDisplay || displays.filter(function (display) {
        return self.isDisplayConnected(display);
      })[0] || defaultDisplay || null;
      return self.connectedDisplay;
    }
  });
};

var webvrAgent = new WebvrAgent();

webvrAgent.ready().then(function (result) {
  var presentingDisplay = result[0];
  var proxy = result[1];

  console.log('[webvr-agent][client] Agent ready');
  if (presentingDisplay) {
    console.log('[webvr-agent][client] Presenting to VR display "%s" (id: %s)',
      presentingDisplay.displayName, presentingDisplay.displayId);
  }
  if (proxy) {
    console.log('[webvr-agent][client] Message-proxy (%s) ready', proxy.name);
  }
  console.log('[webvr-agent][client] Using iframe', webvrAgent.iframe);

  window.addEventListener('message', function (evt) {
    var data = evt.data;
    if (data.action === 'iframeresize') {
      webvrAgent.iframe.style.height = evt.data.height;
      console.log('[webvr-agent][client] Resized iframe to %s', evt.data.height);
    }
    if (data.action === 'vrrequestpresent') {
      webvrAgent.requestPresent(connectedDisplay);
    }
  });

  if (!presentingDisplay) {
    webvrAgent.getConnectedDisplay().then(function (connectedDisplay) {
      console.log('[webvr-agent][client] Found connected VR display "%s" (id: %s)',
        connectedDisplay.displayName, connectedDisplay.displayId);
    });
  }

  window.addEventListener('dblclick', function (evt) {
    window.location.reload();
  });

  if (proxy) {
    proxy.postMessage(webvrAgent.iframe.contentWindow, {type: 'ready'}).then(function (res) {
      console.log('[webvr-agent][client] Message-proxy (%s) response:', proxy.name, res);
    });
  }
}).catch(console.error.bind(console));

if (typeof define === 'function' && define.amd) {
  define('webvr-agent', webvrAgent);
} else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
  module.exports = webvrAgent;
} else if (window) {
  window.webvrAgent = webvrAgent;
}
