/* global define, exports, location, module, require, URL, XMLHttpRequest */

var WEBVR_AGENT_HOSTNAME = location.hostname || '';

var IS_PROD = !location.port ||
  (WEBVR_AGENT_HOSTNAME.split('.').length !== 4 && WEBVR_AGENT_HOSTNAME !== 'localhost' &&
   WEBVR_AGENT_HOSTNAME.substr(WEBVR_AGENT_HOSTNAME.length - 4) !== '.dev');

var SCENE_ORIGIN = location.origin || (location.protocol + '//' + location.host);
var ORIGIN = SCENE_ORIGIN;
try {
  ORIGIN = new URL(document.currentScript.src).origin;
} catch (e) {
}
var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var WEBVR_AGENT_ORIGIN_DEV = `${ORIGIN}:4040`;
var WEBVR_AGENT_ORIGIN = IS_PROD ? WEBVR_AGENT_ORIGIN_PROD : WEBVR_AGENT_ORIGIN_DEV;
var QS_SAY = (location.search.match(/[?&]say=(.+)/i) || [])[1];
var QS_URL = (location.search.match(/[?&]url=(.+)/) || [])[1];
var SCRIPT_SITE_URL = '';
try {
  SCRIPT_SITE_URL = (document.currentScript.src.match(/[?&]url=(.+)/) || [])[1];
} catch (err) {
}
var SITE_URL = QS_URL || SCRIPT_SITE_URL || location.href;

(function (win, doc) {
  var webvrAgentScript = doc.querySelector('script[src*="agent"][src*="/client.js"]');
  var webvrAgentScriptSrcLocal = `${ORIGIN}:4040/client.js`;
  var webvrAgentScriptSrcProd = `${WEBVR_AGENT_ORIGIN}/client.js`;
  var webvrAgentScriptSrc = IS_PROD ? webvrAgentScriptSrcProd : webvrAgentScriptSrcLocal;

  function injectProdScriptIfMissing () {
    if (!webvrAgentScript) {
      webvrAgentScript = doc.createElement('script');
      webvrAgentScript.src = webvrAgentScriptSrc;
      webvrAgentScript.async = webvrAgentScript.defer = true;
      doc.head.appendChild(webvrAgentScript);
    }
  }

  if (IS_PROD) {
    injectProdScriptIfMissing();
    return;
  }

  var req = new Image();

  req.addEventListener('load', function () {
    if (!webvrAgentScript) {
      injectProdScriptIfMissing();
      return;
    }

    if (!IS_PROD) {
      webvrAgentScript.abort = true;
      webvrAgentScript.src = webvrAgentScriptSrc;
    }
  });

  req.addEventListener('error', function () {
    // Regardless of whether we're in a production or development environment,
    // if the WebVR Agent is not running locally on port `4040`, inject the
    // `https://agent.webvr.rocks/client.js` script.
    injectProdScriptIfMissing();
  });

  // Test favicon to see if this origin is valid.
  req.src = `${ORIGIN}/favicon.ico`;
})(window, document);

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
      } catch (err) {
      }
      resolve(data);
    });
    xhr.addEventListener('error', reject);
    xhr.send(opts.data);
  });
}

function setCSSHotspotEl (hotspotEl, opts) {
  hotspotEl.style.cssText = `height: 61px; width: ${opts.width}; position: absolute; bottom: 0; left: ${opts.left}; right: ${opts.right}; z-index: 999999; cursor: pointer;`;
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
  this.originHost = this.opts.originHost = (this.opts.originHost || ORIGIN || WEBVR_AGENT_ORIGIN).replace(/\/+$/g, '');
  this.uriHost = this.opts.uriHost = this.opts.uriHost || (this.originHost + '/index.html');
  this.debug = this.opts.debug = 'debug' in this.opts ? !!this.opts.debug : !IS_PROD;
  this.iframeTimeout = 'optsTimeout' in this.opts ? this.opts.iframeTimeout : 30000;  // Timeout for loading `<iframe>` (time in milliseconds [default: 30 seconds]).

  // TODO: Keep track of multiple displays for the following:
  // - `connectedDisplay`,
  // - `disconnectedDisplay`,
  // - `presentingDisplays`, and
  // - `notPresentingDisplay`.
  this.connectedDisplay = null;
  this.disconnectedDisplay = null;
  this.presentingDisplay = null;
  this.notPresentingDisplay = null;

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

  this.gamepads = require('./lib/gamepads.js');

  console.log('gamepads', this.gamepads);

  this.keys = {
    esc: 27,
    i: 73,
    c: 67,
    f: 70,
    v: 86,
    t: 84
  };

  this.iframeLoaded = new Promise(function (resolve, reject) {
    var listener = function (evt) {
      if (evt.source === window) {
        return;
      }
      var data = evt.data;
      if (data.src !== 'webxr-agent') {
        return;
      }
      if (data.action === 'loaded') {
        console.log('[webxr-agent][client] Successfully finished loading iframe: %s', evt.data.url);
        self.hasLoadedIframe = true;
        self.postMessage({action: 'loaded'});
        window.removeEventListener('message', listener);
        resolve(self.iframe);
      }
    };
    window.addEventListener('message', listener);
    setTimeout(function () {
      window.removeEventListener('message', listener);
      reject(new Error('Message-proxy iframe could not be load'));
    }, self.iframeTimeout);
  });

  EventEmitter.call(this);
}
Object.create(WebvrAgent, EventEmitter);
WebvrAgent.prototype.init = function () {
  if (this._inited) {
    this._inited = true;
    return this.inject();
  }
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
  if (navigator.doNotTrack === '1' || navigator.doNotTrack === 1) {
    return Promise.resolve(false);
  }

  var self = this;
  return new Promise(function (resolve) {
    // Polyfill behaviour of `navigator.vr`'s `navigate` event.
    xhrJSON({
      method: 'get',
      url: self.url('sessions')
    }).then(function (displayId) {
      if (displayId) {
        return self.getConnectedDisplay(displayId).then(function (display) {
          console.log('[webxr-agent][client] Automatically presenting to VR display "%s" (id: %s)',
            self.getDisplayName(display), self.getDisplayId(display));
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
WebvrAgent.prototype.postMessage = function (msg) {
  var self = this;
  if (typeof msg !== 'object') {
    throw new Error('`msg` must be an object for calls to `WebvrAgent#postMessage`');
  }
  return self.iframeLoaded.then(function () {
    if (!self.iframe) {
      return Promise.reject(new Error('Message-proxy iframe not found'));
    }
    Object.assign(msg, {src: 'webxr-agent'});
    self.iframe.contentWindow.postMessage(msg, self.originHost);
    return Promise.resolve(true);
  });
};
WebvrAgent.prototype.addUIAndEventListeners = function () {
  var self = this;
  var toggleVRButtonDimensions = {};

  var hotspotEl = document.querySelector('#webxr-agent-hotspot');

  if (!hotspotEl) {
    hotspotEl = document.createElement('div');
    hotspotEl.setAttribute('id', 'webxr-agent-hotspot');

    setCSSHotspotEl(hotspotEl, {width: 0, left: 0, right: 0});

    doc.tryUntilFound(function () {
      if (!document.body) {
        return;
      }
      document.body.appendChild(hotspotEl);
    });
  }

  window.addEventListener('message', function (evt) {
    var data = evt.data;
    var action = data.action;
    var src = data.src;
    if (src !== 'webxr-agent') {
      return;
    }
    if (action === 'resize-iframe') {
      webvrAgent.iframe.style.height = data.height;
      console.log('[webxr-agent][client] Resized iframe to %s', data.height);
    } else if (action === 'display-request-present') {
      webvrAgent.requestPresent(data.displayId);
    } else if (action === 'display-exit-present') {
      webvrAgent.exitPresent(data.displayId);
    } else if (action === 'resize-toggle-vr-button') {
      toggleVRButtonDimensions = data.dimensions || {};
      setCSSHotspotEl(hotspotEl, toggleVRButtonDimensions);
    }
  });

  window.addEventListener('mouseover', function (evt) {
    // Send a message to the `host`, which synthesises a `:hover`-like event.
    if (evt.target === document.querySelector('#webxr-agent-hotspot') ||
        (evt.target.closest && evt.target.closest('#webxr-agent-hotspot'))) {
      self.postMessage({action: 'mouseenter-toggle-vr-button'});
      return;
    }
  });

  window.addEventListener('mouseout', function (evt) {
    // Send a message to the `host`, which removes the `:hover`-like event.
    if (evt.target === document.querySelector('#webxr-agent-hotspot') ||
        (evt.target.closest && evt.target.closest('#webxr-agent-hotspot'))) {
      self.postMessage({action: 'mouseleave-toggle-vr-button'});
      return;
    }
  });

  window.addEventListener('click', function (evt) {
    // Workaround for user-gesture requirement to enter VR.
    if (evt.target === document.querySelector('#webxr-agent-hotspot') ||
        (evt.target.closest && evt.target.closest('#webxr-agent-hotspot'))) {
      webvrAgent.requestPresent();
      return;
    }

    if (self.isDisplayPresenting(self.connectedDisplay)) {
      return;
    }
    self.postMessage({action: 'close-info'});
  });

  // TODO: Add button for toggling `speech`.
  window.addEventListener('dblclick', function (evt) {
    console.log('[webxr-agent][client] `dblclick` detected (target: %s)', evt.target);
    self.speech.toggle();
  });

  window.addEventListener('keyup', function (evt) {
    if (evt.target !== document.body || (evt.shiftKey || evt.metaKey || evt.altKey || evt.ctrlKey)) {
      return;
    }
    if (evt.keyCode === self.keys.esc) {
      console.log('[webxr-agent][client] `Esc` key pressed');
      if (self.isDisplayPresenting(self.connectedDisplay)) {
        self.postMessage({action: 'display-exit-present'});
      } else {
        self.postMessage({action: 'close-info'});
      }
    } else if (evt.keyCode === self.keys.i) {
      evt.preventDefault();
      console.log('[webxr-agent][client] `i` key pressed');
      if (!self.isDisplayPresenting(self.connectedDisplay)) {
        self.postMessage({action: 'toggle-info'});
      }
    } else if (evt.keyCode === self.keys.c) {
      evt.preventDefault();
      console.log('[webxr-agent][client] `c` key pressed');
      if (self.isDisplayPresenting(self.connectedDisplay)) {
        self.postMessage({action: 'display-exit-present'});
      } else {
        self.postMessage({action: 'close-info'});
      }
    } else if (evt.keyCode === self.keys.v) {
      evt.preventDefault();
      console.log('[webxr-agent][client] `v` key pressed');
      if (self.isDisplayPresenting(self.connectedDisplay)) {
        self.exitPresent();
      } else {
        self.requestPresent();
      }
    } else if (evt.keyCode === self.keys.f) {
      evt.preventDefault();
      console.log('[webxr-agent][client] `f` key pressed');
      if (self.isDisplayPresenting(self.connectedDisplay)) {
        self.exitPresent();
      } else {
        self.requestPresent();
      }
    } else if (evt.keyCode === self.keys.t) {
      evt.preventDefault();
      console.log('[webxr-agent][client] `t` key pressed');
      self.speech.toggle();
    }
  });

  // TODO: Handle three.js scenes with `THREE.VREffect`.
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
    console.log('[webxr-agent][client] Injecting `<iframe>` for "%s"', self.uriHost);
    var iframe = self.iframe = document.createElement('iframe');
    iframe.src = self.uriHost + '?url=' + SITE_URL || self.originHost;
    iframe.style.cssText = 'border-width: 0; height: 61px; width: 100%; position: absolute; bottom: 0; right: 0; left: 0; z-index: 99999';
    iframe.addEventListener('load', function () {
      // if (self._injected) {
      //   reject(new Error('Already loaded iframe'));
      //   return;
      // }
      resolve(true);
      console.log('[webxr-agent][client] Injected `<iframe>` for "%s"', self.uriHost);
    });
    iframe.addEventListener('error', function (err) {
      reject(err);
      console.warn('[webxr-agent][client] Could not load:', err);
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
  return doc.loaded.then(function () {
    return self.getConnectedDisplay(display ? display.id : null, display).then(function (display) {
      if (!display) {
        throw new Error('No VR headset detected');
      }

      // TODO: Handle three.js scenes with `THREE.VREffect`.
      var aframeScene = canvas && canvas.matches && canvas.matches('a-scene') ? canvas : document.querySelector('a-scene');
      canvas = canvas || document.querySelector('canvas');

      if (!canvas) {
        throw new Error('Canvas source empty');
      }

      if (self.isDisplayPresenting(display)) {
        throw new Error('VR headset is presenting');
      }

      if (aframeScene) {
        if (aframeScene.hasLoaded) {
          return aframeScene.enterVR().then(function (x) {
            return display;
          });
        } else {
          aframeScene.addEventListener('loaded', function () {
            return aframeScene.enterVR().then(function () {
              return display;
            });
          });
        }
      }

      return display.requestPresent([{source: canvas}]).then(function () {
        return display;
      });
    }).then(function (display) {
      var isConnected = self.isDisplayConnected(display);
      var isDisconnected = !isConnected;
      var isPresenting = self.isDisplayPresenting(display);
      return self.postMessage({
        action: 'display-present-start',
        displayId: self.getDisplayId(display),
        displayName: self.getDisplayName(display),
        displaySlug: self.getDisplaySlug(display),
        isConnected: isConnected,
        isDisconnected: isDisconnected,
        isPresenting: isPresenting
      });
    }).catch(function (err) {
      console.error('[webxr-agent][client] Failed to enter VR presentation' +
        (err && err.message ? ': ' + err.message : ''),
        err.stack);
    });
  });
};
WebvrAgent.prototype.exitPresent = function (display, canvas) {
  var self = this;
  return doc.loaded.then(function () {
    return self.getConnectedDisplay(display ? display.id : null, display).then(function (display) {
      if (!display) {
        throw new Error('No VR headset detected');
      }

      if (!self.isDisplayPresenting(display)) {
        throw new Error('VR headset is not presenting');
      }

      // TODO: Handle three.js scenes with `THREE.VREffect`.
      var aframeScene = canvas && canvas.matches && canvas.matches('a-scene') ? canvas : document.querySelector('a-scene');
      canvas = canvas || document.querySelector('canvas');

      // TODO: For non-A-Frame scenes, find the VR display being presented which contains a layer for `canvas`.

      if (aframeScene) {
        if (aframeScene.hasLoaded) {
          return aframeScene.exitVR().then(function (x) {
            return display;
          });
        } else {
          aframeScene.addEventListener('loaded', function () {
            return aframeScene.exitVR().then(function () {
              return display;
            });
          });
        }
      }

      return display.exitPresent().then(function () {
        return display;
      }, function (err) {
        return new Error('Failed to exit VR presentation' +
          (err && err.message ? ': ' + err.message : ''));
      });
    }).then(function (display) {
      var isConnected = self.isDisplayConnected(display);
      var isDisconnected = !isConnected;
      var isPresenting = false;
      return self.postMessage({
        action: 'display-present-end',
        displayId: self.getDisplayId(display),
        displayName: self.getDisplayName(display),
        displaySlug: self.getDisplaySlug(display),
        isConnected: isConnected,
        isDisconnected: isDisconnected,
        isPresenting: isPresenting
      });
    }).catch(function (err) {
      console.error('[webxr-agent][client] Failed to exit VR presentation' +
        (err && err.message ? ': ' + err.message : ''));
      throw err;
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
    } else if (displayName.indexOf('openvr') > -1 || displayName.indexOf('vive') > -1) {
      return this.headsets.htc_vive.slug;
    } else if (displayName.indexOf('gear') > -1) {
      return this.headsets.samsung_gear_vr.slug;
    } else if (displayName.indexOf('daydream') > -1) {
      return this.headsets.google_daydream.slug;
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
WebvrAgent.prototype.setDisconnectedDisplay = function (display) {
  var self = this;

  if (self.areDisplaysSame(display, self.disconnectedDisplay)) {
    return;
  }

  var displayName = self.getDisplayName(display);
  var displayId = self.getDisplayId(display);
  var displaySlug = self.getDisplaySlug(display);

  self.iframeLoaded.then(function () {
    console.log('[webxr-agent][client] Display disconnected: %s (ID: %s; slug: %s)',
      displayName,
      displayId,
      displaySlug);

    self.connectedDisplay = display;

    // TODO: Keep track of multiple `disconnectedDisplay`s.
    self.disconnectedDisplay = display;

    return Promise.all([
      self.postMessage({
        action: 'display-disconnected',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug,
        isConnected: false,
        isDisconnected: true,
        isPresenting: self.isDisplayPresenting(display)
      })
    ]);
  });
};
WebvrAgent.prototype.setPresentingDisplay = function (display) {
  var self = this;

  if (self.areDisplaysSame(display, self.presentingDisplay)) {
    return;
  }

  var displayName = self.getDisplayName(display);
  var displayId = self.getDisplayId(display);
  var displaySlug = self.getDisplaySlug(display);

  self.iframeLoaded.then(function () {
    console.log('[webxr-agent][client] Display presenting: %s (ID: %s; slug: %s)',
      displayName,
      displayId,
      displaySlug);

    self.connectedDisplay = display;

    // TODO: Keep track of multiple `presentingDisplay`s.
    self.presentingDisplay = display;

    var isConnected = self.isDisplayConnected(display);
    var isDisconnected = !isConnected;
    var isPresenting = true;

    return Promise.all([
      self.postMessage({
        action: 'display-presenting',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug,
        isConnected: isConnected,
        isDisconnected: isDisconnected,
        isPresenting: isPresenting
      }),
      self.postMessage({
        action: 'display-present-start',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug,
        isConnected: isConnected,
        isDisconnected: isDisconnected,
        isPresenting: isPresenting
      }),
      self.persistVRDisplayPresentationState(display)
    ]);
  });
};
WebvrAgent.prototype.setNotPresentingDisplay = function (display) {
  var self = this;

  if (self.areDisplaysSame(display, self.notPresentingDisplay)) {
    return;
  }

  var displayName = self.getDisplayName(display);
  var displayId = self.getDisplayId(display);
  var displaySlug = self.getDisplaySlug(display);

  self.iframeLoaded.then(function () {
    console.log('[webxr-agent][client] Display stopped presenting: %s (ID: %s; slug: %s)',
      displayName,
      displayId,
      displaySlug);

    // self.connectedDisplay = display;

    self.presentingDisplay = null;

    // TODO: Keep track of multiple `notPresentingDisplay`s.
    self.notPresentingDisplay = display;

    return Promise.all([
      self.postMessage({
        action: 'display-present-end',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug,
        isConnected: self.isDisplayConnected(display),
        isDisconnected: !self.isDisplayConnected(display),
        isPresenting: false
      }),
      self.persistVRDisplayPresentationState(display)
    ]);
  });
};
WebvrAgent.prototype.setConnectedDisplay = function (display) {
  var self = this;

  if (self.areDisplaysSame(display, self.connectedDisplay)) {
    return;
  }

  var displayName = self.getDisplayName(display);
  var displayId = self.getDisplayId(display);
  var displaySlug = self.getDisplaySlug(display);

  self.iframeLoaded.then(function () {
    console.log('[webxr-agent][client] Display connected: %s (ID: %s; slug: %s)',
      displayName,
      displayId,
      displaySlug);

    self.disconnectedDisplay = null;

    // TODO: Keep track of multiple `connectedDisplay`s.
    self.connectedDisplay = display;

    return Promise.all([
      self.postMessage({
        action: 'display-connected',
        displayId: displayId,
        displayName: displayName,
        displaySlug: displaySlug,
        isConnected: true,
        isDisconnected: false,
        isPresenting: self.isDisplayPresenting(display)
      })
    ]);
  });

  return display;
};
WebvrAgent.prototype.persistVRDisplayPresentationState = function (display) {
  if (navigator.doNotTrack === '1' || navigator.doNotTrack === 1) {
    return Promise.resolve(false);
  }

  // Polyfill behaviour of `navigator.vr`'s `navigate` event.
  display = display || this.connectedDisplay;

  // Persist state of VR presentation (for `navigator.vr`'s `navigate` event).
  return xhrJSON({
    method: 'post',
    url: this.url('sessions'),
    data: {
      docURL: location.href,
      docTitle: document.title,
      displayId: this.getDisplayId(display),
      displayName: this.getDisplayName(display),
      displaySlug: this.getDisplaySlug(display),
      isConnected: this.isDisplayConnected(display),
      isDisconnected: !this.isDisplayConnected(display),
      isPresenting: this.isDisplayPresenting(display)
    }
  }).then(function (data) {
    console.log('[webxr-agent][client] Persisted state of presenting VR display');
  }).catch(function (err) {
    if (err) {
      console.warn(err);
    }
  });
};
WebvrAgent.prototype.getConnectedDisplay = function (preferredDisplayId, defaultDisplay) {
  var self = this;

  if (preferredDisplayId) {
    preferredDisplayId = String(preferredDisplayId);
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
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayDisconnect (evt) {
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setDisonnectedDisplay(evt.display);
    }
  }

  function handleVREventNavigate (evt) {
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayActivate (evt) {
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
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
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
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
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayFocus (evt) {
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (evt.display) {
      self.setConnectedDisplay(evt.display);
    }
  }

  function handleVREventDisplayPresentChange (evt) {
    console.log('[webxr-agent][client] Event "%s" received:', evt.type, evt);
    if (!evt.display) {
      return;
    }
    if (self.isDisplayPresenting(evt.display)) {
      self.setPresentingDisplay(evt.display);
    } else {
      self.setNotPresentingDisplay(evt.display);
    }
  }

  return new Promise(function (resolve, reject) {
    var connectedDisplay = self.connectedDisplay;
    if (connectedDisplay && self.isDisplayConnected(connectedDisplay)) {
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
        displayId = self.getDisplayId(display);
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
WebvrAgent.prototype.speech = {
  enabled: false,
  listening: false,
  inited: false
};
WebvrAgent.prototype.speech.toggle = function () {
  console.log('[webxr-agent][client][speech] Toggling speech');
  var speech = this;
  speech.enabled = !speech.enabled;
  if (speech.listening) {
    speech.stop();
  } else {
    speech.start();
  }
};
WebvrAgent.prototype.speech.start = function () {
  console.log('[webxr-agent][client][speech] Starting speech');
  var speech = this;
  if (speech.inited && !speech.annyang.isListening()) {
    speech.annyang.resume();
    speech.listening = true;
    return true;
  }
  return speech.init();
};
WebvrAgent.prototype.speech.stop = function () {
  console.log('[webxr-agent][client][speech] Stopping speech');
  var speech = this;
  if (!speech.inited) {
    return false;
  }
  if (speech.annyang && speech.annyang.isListening()) {
    // speech.annyang.pause();
    speech.annyang.abort();
    speech.listening = false;
    return true;
  }
  return true;
};
WebvrAgent.prototype.speech.init = function (phrase, voiceName) {
  console.log('[webxr-agent][client][speech] Setting up speech');

  var speech = this;

  if (speech.inited || !speech.enabled) {
    return false;
  }

  speech.inited = true;

  if (!speech.annyang) {
    speech.annyang = require('annyang');
    if (!speech.annyang) {
      return false;
    }
  }

  speech.annyang.debug();

  if (QS_SAY) {
    speech.say(QS_SAY);
  }

  var gotoLobby = function () {
    return speech.say('Loading lobby').then(function () {
      console.log('[webxr-agent][client][speech] Navigating to the Lobby');
      if (location.port === '8000') {
        location.href = location.origin + '/?say=Welcome+back!';
      } else {
        location.href = 'https://webvrrocks.github.io/webxr-lobby/?say=Welcome+back!';
      }
    });
  };

  var gotoBack = function () {
    return speech.say('Going back').then(function () {
      console.log('[webxr-agent][client][speech] Navigating back');
      window.history.go(-1);
    });
  };

  var gotoForward = function () {
    return speech.say('Going forward').then(function () {
      console.log('[webxr-agent][client][speech] Navigating forward');
      window.history.go(1);
    });
  };

  var gotoURL = function (url) {
    return function () {
      return speech.say('Loading world').then(function () {
        console.log('[webxr-agent][client][speech] Navigating to URL "%s"', url);
        location.href = url;
      });
    };
  };

  var commands = {
    'lobby': gotoLobby,
    'back': gotoBack,
    'forward': gotoForward,
    'shadows (and fog)': gotoURL('/fog.html'),
    '(shadows and) fog': gotoURL('/fog.html'),
    'puzzle (rain)': gotoURL('https://mozvr.com/puzzle-rain/?mode=normal&src=moonrise'),
    '(a) painter': gotoURL('https://aframe.io/a-painter/'),
    '(a) paint': gotoURL('https://aframe.io/a-painter/'),
    '(a) blast': gotoURL('https://aframe.io/a-blast/'),
    '(a) blaster': gotoURL('https://aframe.io/a-blast/'),
    '(a) shooter': gotoURL('https://aframe.io/a-blast/'),
    'sketchfab': gotoURL('https://sketchfab.com/vr'),
    'sketch fab': gotoURL('https://sketchfab.com/vr'),
    '(finding) love': gotoURL('https://findinglove.activetheory.net/')
  };

  var annyangCommands = {};
  Object.keys(commands).forEach(function (cmd) {
    annyangCommands[`(computer) (go) (play) (load) (to) (the) (*word) ${cmd}`] = commands[cmd];
  });

  speech.annyang.addCallback('result', function (phrases) {
    if (phrases.length) {
      console.log('[webxr-agent][client][speech] I think the user said:', phrases[0]);
      console.log('[webxr-agent][client][speech] But then again, it could be any of the following:', phrases);
    }
  });

  speech.annyang.addCallback('resultMatch', function (userSaid, commandText, phrases) {
    if (phrases.length) {
      console.log('[webxr-agent][client][speech] User said:', userSaid);  // sample output: 'hello'
      console.log('[webxr-agent][client][speech] Command text:', commandText);  // sample output: 'hello (there)'
      console.log('[webxr-agent][client][speech] Phrases:', phrases);  // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
      for (var i = 0; i < phrases.length; i++) {
        if (phrases[i] in commands) {
          commands[phrases[i]]();
          break;
        }
      }
    }
  });

  speech.annyang.addCallback('resultNoMatch', function (phrases) {
    console.log('[webxr-agent][client][speech] I think the user said:', phrases[0]);
    console.log('[webxr-agent][client][speech] But then again, it could be any of the following:', phrases);
  });

  // Add our commands to `annyang`.
  speech.annyang.addCommands(annyangCommands);

  // Start listening. You can call this here, or attach this call to an event, button, etc.
  speech.annyang.start();

  speech.listening = true;

  console.log('[webxr-agent][client][speech] Successfully set up speech');

  return speech.annyang;
};
WebvrAgent.prototype.speech.say = function (phrase, voiceName) {
  return new Promise(function (resolve, reject) {
    voiceName = (voiceName || 'daniel');

    if (voiceName.length > 1) {
      voiceName = voiceName[0].toUpperCase() + voiceName.substr(1).toLowerCase();
    }

    if (!phrase || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return Promise.resolve(false);
    }

    console.log('[webxr-agent][client][speech] %s, say, "%s"', voiceName, phrase);

    var voices = window.speechSynthesis.getVoices();

    console.log('[webxr-agent][client][speech] Detected %d voices', voices.length);

    if (voices.length) {
      utter(phrase, voiceName);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', utterWhenVoiceAppears);
      var utterWhenVoiceAppears = function () {
        utter(phrase, voiceName);
        window.speechSynthesis.removeEventListener('voiceschanged', utterWhenVoiceAppears);
      };
    }

    function utter (phrase, voiceName) {
      var msg = new window.SpeechSynthesisUtterance();

      voiceName = voiceName.toLowerCase();

      var voice = voices.filter(function (voice) {
        return voice.name && voice.name.toLowerCase() === voiceName;
      })[0];

      if (!voice) {
        return Promise.resolve(false);
      }

      msg.voice = voice;
      msg.voiceURI = 'native';
      msg.volume = 1;  // 0 to 1.
      msg.rate = 1;  // 0.1 to 10.
      msg.pitch = 2;  // 0 to 2.
      msg.text = phrase;
      msg.lang = navigator.language;

      msg.addEventListener('end', evt => {
        console.log(`[webxr-agent][client][speech]   Finished in ${evt.elapsedTime} sec.`);
        resolve({utterance: msg, event: evt});
      });

      msg.addEventListener('error', evt => {
        reject(evt);
      });

      console.log('[webxr-agent][client][speech] %s says, "%s"', voice.name, phrase);

      window.speechSynthesis.speak(msg);
    }
  });
};

var webvrAgent = new WebvrAgent();

webvrAgent.ready().then(function (result) {
  var presentingDisplay = result[0];
  var proxy = result[1];

  console.log('[webxr-agent][client] Agent ready');
  if (presentingDisplay) {
    console.log('[webxr-agent][client] Presenting to VR display "%s" (id: %s)',
      webvrAgent.getDisplayName(presentingDisplay),
      webvrAgent.getDisplayId(presentingDisplay));
  }
  if (proxy) {
    console.log('[webxr-agent][client] Message-proxy (%s) ready', proxy.name);
  }
  console.log('[webxr-agent][client] Using iframe', webvrAgent.iframe);

  if (!presentingDisplay) {
    webvrAgent.getConnectedDisplay().then(function (connectedDisplay) {
      console.log('[webxr-agent][client] Found connected VR display: %s (ID: %s; slug: %s)',
        webvrAgent.getDisplayName(connectedDisplay),
        webvrAgent.getDisplayId(connectedDisplay),
        webvrAgent.getDisplaySlug(connectedDisplay));
    });
  }
}).catch(function (err) {
  console.error('[webxr-agent][client] Error' +
    (err && err.message ? ': ' + err.message : ''));
});

if (typeof window.define === 'function' && define.amd) {
  define('webxr-agent', webvrAgent);
} else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
  module.exports = webvrAgent;
}

window.webvrAgent = webvrAgent;
