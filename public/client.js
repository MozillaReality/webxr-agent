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
doc.tryUntilFound = function (functionToCall) {
  return doc.parsed.then(function () {
    var done = functionToCall();
    if (!done) {
      return doc.contentLoaded.then(functionToCall);
    }
  }).then(function (done) {
    if (!done) {
      return doc.loaded.then(functionToCall);
    }
  });
};

function xhrJSON (opts) {
  if (typeof opts === 'string') {
    opts = {url: opts};
  }
  opts = opts || {};
  opts.method = opts.method || 'get';
  if (typeof opts.data === 'object') {
    opts.data = JSON.stringify(opts.data);
  }
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url, 'true');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.addEventListener('load', function () {
      var data = {};
      try {
        // NOTE: Not parsing as JSON using `XMLHttpRequest#responseType` because of incomplete browser support.
        data = JSON.parse(xhr.responseText || '{}');
      } catch (e) {
      }
      resolve(data);
    });
    xhr.addEventListener('error', reject);
    xhr.send(opts.data);
  });
}

// Adapted from source: https://gist.github.com/mudge/5830382
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
  var self = this;
  this._inited = false;
  this._injected = false;
  this._displayListenersSet = false;
  this.opts = opts || {};
  this.timeout = 'timeout' in this.opts ? this.opts.timeout : 0;
  this.originHost = this.opts.originHost = (this.opts.uriHost || ORIGIN || WEBVR_AGENT_ORIGIN || WEBVR_AGENT_ORIGIN_PROD).replace(/\/+$/g, '');
  this.uriHost = this.opts.uriHost = this.opts.uriHost || (this.originHost + '/index.html');
  this.debug = this.opts.debug = 'debug' in this.opts ? !!this.opts.debug : !IS_PROD;
  this.proxy = this.opts.proxy || new WindowPostMessageProxy.WindowPostMessageProxy({
    name: this.originHost,
    logMessages: false
    // logMessages: this.opts.debug
  });
  this.iframeTimeout = 'optsTimeout' in this.opts ? this.opts.iframeTimeout : 30000;  // Timeout for loading `<iframe>` (time in milliseconds [default: 30 seconds]).
  this.connectedDisplay = null;
  this.headsets = {
    htc_vive: {
      name: 'HTC Vive',
      slug: 'htc_vive'
    },
    oculus_rift: {
      name: 'Oculus Rift',
      slug: 'oculus_rift'
    },
    google_daydream: {
      name: 'Google Daydream',
      slug: 'google_daydream'
    },
    samsung_gear_vr: {
      name: 'Samsung Gear VR',
      slug: 'samsung_gear_vr'
    },
    google_cardboard: {
      name: 'Google Cardboard',
      slug: 'google_cardboard'
    },
    osvr_hdk2: {
      name: 'OSVR HDK2',
      slug: 'osvr_hdk2'
    }
  };
  this.iframeLoaded = new Promise(function (resolve, reject) {
    var listener = function (evt) {
      if (evt.source === window) {
        return;
      }
      var data = evt.data;
      if (data.action === 'loaded') {
        console.log('[webvr-agent][client] Successfully finished loading iframe: %s', evt.data.url);
        self.hasLoadedIframe = true;
        window.removeEventListener('message', listener);
        resolve(self.iframe);
      }
    };
    window.addEventListener('message', listener);
    setTimeout(function () {
      window.removeEventListener('message', listener);
      reject(new Error('Could not load iframe'));
    }, self.iframeTimeout);
  });
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
WebvrAgent.prototype.url = function (key, params) {
  // TODO: Construct query-string from the `params` object.
  var url = this.originHost + '/' + (key || '').replace(/^\/*/g, '');
  params = params || {};
  if (key === 'manifest') {
    if (params.url) {
      return url + '/manifest?url=' + params.url;
    }
  }
  return url;
};
WebvrAgent.prototype.attemptRequestPresentUponNavigation = function () {
  var self = this;
  return new Promise(function (resolve) {
    // Polyfill behaviour of `navigator.vr`'s `navigate` event.
    var xhr = xhrJSON({
      method: 'get',
      url: self.url('sessions')
    }).then(function (data) {
      if (data.displayIsPresenting && data.displayId) {
        return self.getConnectedDisplay(data.displayId).then(function (display) {
          resolve(self.requestPresent(display));
        });
      } else {
        return resolve(null);
      }
    }).catch(function (err) {
      if (err) {
        console.warn(err);
      }
      return resolve(null);
    });
  });
};
WebvrAgent.prototype.ready = function () {
  return Promise.all([
    // this.getConnectedDisplay(),  // NOTE: Workaround for Firefox Nightly to engage VR mode.
    this.attemptRequestPresentUponNavigation(),
    this.addUIAndEventListeners(),
    this.inject()
  ]);
};
WebvrAgent.prototype.addUIAndEventListeners = function () {
  var self = this;
  window.addEventListener('click', function (evt) {
    if (evt.target === self.iframe) {
      return;
    }
    self.proxy.postMessage(self.iframe.contentWindow, {action: 'close-info'}).then(function (res) {
      console.log('[webvr-agent][client] Message-proxy (%s) response:', self.proxy.name, res);
    }).catch(console.error.bind(console));
  });
  window.addEventListener('keyup', function (evt) {
    if (evt.target !== document.body) {
      return;
    }
    if (evt.keyCode === 27) {  // `Esc` key.
      console.log('[webvr-agent][client] `Esc` key pressed');
      if (self.proxy) {
        if (self.isDisplayPresenting(self.connectedDisplay)) {
          self.proxy.postMessage(self.iframe.contentWindow, {action: 'display-exit-present'}).then(function (res) {
            console.log('[webvr-agent][client] Message-proxy (%s) response:', self.proxy.name, res);
          }).catch(console.error.bind(console));
        }
        self.proxy.postMessage(self.iframe.contentWindow, {action: 'close-info'}).then(function (res) {
          console.log('[webvr-agent][client] Message-proxy (%s) response:', self.proxy.name, res);
        }).catch(console.error.bind(console));
      }
    } else if (evt.keyCode === 73) {  // `i` key.
      console.log('[webvr-agent][client] `i` key pressed');
      self.proxy.postMessage(self.iframe.contentWindow, {action: 'toggle-info'}).then(function (res) {
        console.log('[webvr-agent][client] Message-proxy (%s) response:', self.proxy.name, res);
      }).catch(console.error.bind(console));
    } else if (evt.keyCode === 67) {  // `c` key.
      console.log('[webvr-agent][client] `c` key pressed');
      self.proxy.postMessage(self.iframe.contentWindow, {action: 'close-info'}).then(function (res) {
        console.log('[webvr-agent][client] Message-proxy (%s) response:', self.proxy.name, res);
      }).catch(console.error.bind(console));
    }
  });
  var setupFunctions = [
    aframeSceneSetup
  ];
  setupFunctions.forEach(doc.tryUntilFound);
  function aframeSceneSetup () {
    var aframeScene = document.querySelector('a-scene');
    if (!aframeScene) {
      return;
    }
    if (aframeScene.hasLoaded) {
      aframeHideVRModeUI();
    } else {
      aframeScene.addEventListener('loaded', aframeHideVRModeUI);
    }
    function aframeHideVRModeUI () {
      aframeScene.setAttribute('vr-mode-ui', 'enabled: false');
    }
    return aframeScene;
  }
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
    doc.tryUntilFound(function () {
      if (!document.body) {
        return;
      }
      document.body.appendChild(iframe);
    });
  });
};
WebvrAgent.prototype.requestPresent = function (display, canvas) {
  var self = this;
  return new Promise(function (resolve, reject) {
    return doc.loaded.then(function () {
      return self.getConnectedDisplay(display ? display.id : null, display).then(function (display) {
        if (!display) {
          return;
        }

        var aframeScene = canvas && canvas.matches('a-scene') ? canvas : document.querySelector('a-scene');
        canvas = canvas || document.querySelector('canvas');

        if (!canvas) {
          throw new Error('Canvas source empty');
        }

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
  if (display) {
    if ('isPresenting' in display) {
      return display.isPresenting;
    }
    if ('presenting' in display) {
      return display.presenting;
    }
  }
  return false;
};
WebvrAgent.prototype.getDisplayId = function (display) {
  if (display) {
    if ('displayId' in display) {
      return String(display.displayId);
    }
    if ('id' in display) {
      return String(display.id);
    }
  }
  return null;
};
WebvrAgent.prototype.getDisplayName = function (display) {
  if (display) {
    if ('displayName' in display) {
      return display.displayName;
    }
    if ('name' in display) {
      return display.name;
    }
  }
  return null;
};
WebvrAgent.prototype.getDisplaySlug = function (display) {
  if (display) {
    var displayName = (this.getDisplayName(display) || '').toLowerCase();
    if (displayName.indexOf('oculus') > -1) {
      return this.headsets.oculus_rift.slug;
    } else if (displayName.indexOf('vive') > -1) {
      return this.headsets.htc_vive.slug;
    } else if (displayName.indexOf('gear') > -1) {
      return this.headsets.samsung_gear_vr.slug;
    } else if (displayName.indexOf('daydream') > -1) {
      return this.headsets.daydream.slug;
    } else if (displayName.indexOf('osvr') > -1) {
      return this.headsets.osvr_hdk2.slug;
    }
  }
  return this.headsets.google_cardboard.slug;
};
WebvrAgent.prototype.areDisplaysSame = function (displayA, displayB) {
  return this.getDisplayId(displayA) === this.getDisplayId(displayB) &&
         this.getDisplayName(displayA) === this.getDisplayName(displayB);
};
WebvrAgent.prototype.setConnectedDisplay = function (display) {
  var self = this;

  if (self.areDisplaysSame(display, self.connectedDisplay)) {
    return;
  }

  var displayName = self.getDisplayName(display);
  var displayId = self.getDisplayId(display);
  var displaySlug = self.getDisplaySlug(display);

  console.log('[webvr-agent][client] Display connected: %s (ID: %s; slug: %s)',
    displayName,
    displayId,
    displaySlug);

  self.connectedDisplay = display;

  self.iframeLoaded.then(function () {
    if (self.proxy) {
      self.proxy.postMessage(self.iframe.contentWindow, {
        action: 'display-connected',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug
      }).then(function (res) {
        console.log('[webvr-agent][client] Message-proxy (%s) response:', proxy.name, res);
      }).catch(console.error.bind(console));
    }
  });

  return display;
};
WebvrAgent.prototype.getConnectedDisplay = function (preferredDisplayId, defaultDisplay) {
  var self = this;

  if (preferredDisplayId) {
    preferredDisplayId = String(preferredDisplayId);
  }

  // Polyfill behaviour of `navigator.vr`'s `navigate` event.
  function persistVRDisplayPresentationState (display) {
    display = display || self.connectedDisplay;

    // Persist state of VR presentation (for `navigator.vr`'s `navigate` event).
    return xhrJSON({
      method: 'post',
      url: self.url('sessions'),
      data: {
        docURL: window.location.href,
        docTitle: document.title,
        displayIsPresenting: webvrAgent.isDisplayPresenting(display),
        displayId: webvrAgent.getDisplayId(display),
        displayName: webvrAgent.getDisplayName(display)
      }
    }).then(function (data) {
      console.log('[webvr-agent][client] Persisted state of presenting VR display');
    }).catch(function (err) {
      if (err) {
        console.warn(err);
      }
      return resolve(null);
    });
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
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayDisconnect (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(null);
    }
  }

  function handleVREventNavigate (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayActivate (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
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
      self.setConnectedDisplay(null);
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
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayFocus (evt) {
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayPresentChange (evt) {
    console.log('[webvr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
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
      var displayId;
      var connectedDisplay = preferredDisplayId ? displays.filter(function (display) {
        displayId = self.getDisplayId(display)
        if (displayId && displayId === preferredDisplayId) {
          return self.isDisplayConnected(display);
        }
      })[0] : null;
      connectedDisplay = connectedDisplay || displays.filter(function (display) {
        return self.isDisplayConnected(display);
      })[0] || defaultDisplay || null;
      self.setConnectedDisplay(connectedDisplay);
      return connectedDisplay;
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
    var action = data.action;
    if (action === 'iframe-resize') {
      webvrAgent.iframe.style.height = evt.data.height;
      console.log('[webvr-agent][client] Resized iframe to %s', evt.data.height);
    } else if (action === 'display-request-present') {
      webvrAgent.requestPresent(data);
    } else if (action === 'display-exit-present') {
      webvrAgent.exitPresent();
    }
  });

  if (!presentingDisplay) {
    webvrAgent.getConnectedDisplay().then(function (connectedDisplay) {
      console.log('[webvr-agent][client] Found connected VR display: %s (ID: %s; slug: %s)',
        webvrAgent.getDisplayName(connectedDisplay),
        webvrAgent.getDisplayId(connectedDisplay),
        webvrAgent.getDisplaySlug(connectedDisplay));
    });
  }

  if (proxy) {
    proxy.postMessage(webvrAgent.iframe.contentWindow, {type: 'ready'}).then(function (res) {
      console.log('[webvr-agent][client] Message-proxy (%s) response:', proxy.name, res);
    }).catch(console.error.bind(console));
  }
}).catch(console.error.bind(console));

if (typeof define === 'function' && define.amd) {
  define('webvr-agent', webvrAgent);
} else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
  module.exports = webvrAgent;
} else if (window) {
  window.webvrAgent = webvrAgent;
}
