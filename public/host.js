/* global require, URL, XMLHttpRequest */

var SCENE_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var ORIGIN = '';
try {
  ORIGIN = new URL(window.location.href).origin;
} catch (e) {
  ORIGIN = SCENE_ORIGIN;
}
// var WEBVR_AGENT_ORIGIN = window.location.protocol + '//' + window.location.hostname + ':4040';
// var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = !window.location.port || (window.location.hostname.split('.').length !== 4 && window.location.hostname !== 'localhost');
var QS_SW = (window.location.search.match(/[?&]sw=(.+)/i) || [])[1];
var SERVICE_WORKER_ENABLED = QS_SW === '1' || QS_SW === 'true';
var SITE_URL = (window.location.search.match(/[?&]url=(.+)/) || [])[1];
var SITE_ORIGIN = '*';
try {
  SITE_ORIGIN = new URL(SITE_URL).origin;
} catch (e) {
}
var BOUNDING_CLIENT_RECT_KEYS = ['bottom', 'height', 'left', 'right', 'top', 'width'];

var ariaListbox = require('aria-listbox');
// var feathers = require('feathers-client');
// var Frdialogmodal = require('./lib/fr-dialogmodal');

var toArray = function (items) {
  return Array.prototype.slice.call(items);
};

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

var webvrAgentHost = window.webvrAgentHost = {
  originHost: SITE_ORIGIN,
  siteURL: SITE_URL,
  steam: {
    username: null,
    password: null,
    authenticated: false,
    friends: [],
    matches: []
  },
  state: {
    displays: [],
    displaysById: {},
    displaysConnected: [],
    displaysConnectedBySlug: {},
    displaysPresenting: [],
    displaysPresentingBySlug: {}
  },
  keys: {
    esc: 27,
    i: 73,
    c: 67,
    f: 70,
    v: 86
  },
  headsetsPresentTimeout: 10000  // Timeout for showing VR status `<iframe>` (time in milliseconds [default: 10 seconds]).
};
webvrAgentHost.updateState = function (displayId, displayState) {
  displayId = String(displayId);
  displayState = displayState || {};
  var display = webvrAgentHost.state.displaysById[displayId];
  var newDisplayState = Object.assign({}, display, displayState);
  var otherDisplayState = {};
  if (display) {
    webvrAgentHost.state.displays[display._idx] = newDisplayState;
    webvrAgentHost.state.displaysById[displayId] = newDisplayState;
  } else {
    newDisplayState._idx = webvrAgentHost.state.displays.push(newDisplayState);
    webvrAgentHost.state.displaysById[displayId] = newDisplayState;
  }
  webvrAgentHost.state.displaysConnected = [];
  webvrAgentHost.state.displaysConnectedBySlug = {};
  webvrAgentHost.state.displaysPresenting = [];
  webvrAgentHost.state.displaysPresentingBySlug = {};
  Object.keys(webvrAgentHost.state.displays).forEach(function (otherDisplayId) {
    otherDisplayState = webvrAgentHost.state.displays[otherDisplayId];
    if (otherDisplayState.isConnected) {
      webvrAgentHost.state.displaysConnected.push(otherDisplayState);
      if (webvrAgentHost.state.displaysConnectedBySlug[otherDisplayState.displaySlug]) {
        webvrAgentHost.state.displaysConnectedBySlug[otherDisplayState.displaySlug].push(otherDisplayState);
      } else {
        webvrAgentHost.state.displaysConnectedBySlug[otherDisplayState.displaySlug] = [otherDisplayState];
      }
    }
    if (otherDisplayState.isPresenting) {
      webvrAgentHost.state.displaysPresenting.push(otherDisplayState);
      if (webvrAgentHost.state.displaysPresentingBySlug[otherDisplayState.displaySlug]) {
        webvrAgentHost.state.displaysPresentingBySlug[otherDisplayState.displaySlug].push(otherDisplayState);
      } else {
        webvrAgentHost.state.displaysPresentingBySlug[otherDisplayState.displaySlug] = [otherDisplayState];
      }
    }
  });
  return webvrAgentHost.state;
};
webvrAgentHost.state.displayIsConnected = function (headsetSlug) {
  return !!(webvrAgentHost.state.displaysConnectedBySlug[headsetSlug] &&
            webvrAgentHost.state.displaysConnectedBySlug[headsetSlug].length);
};
webvrAgentHost.state.displayIsPresenting = function (headsetSlug) {
  return !!(webvrAgentHost.state.displaysPresentingBySlug[headsetSlug] &&
            webvrAgentHost.state.displaysPresentingBySlug[headsetSlug].length);
};
webvrAgentHost.getDisplayId = function (display) {
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
webvrAgentHost.getDisplayName = function (display) {
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
webvrAgentHost.postMessage = function (msg, origin) {
  var self = this;
  if (typeof msg !== 'object') {
    throw new Error('`msg` must be an object for calls to `WebvrAgent#postMessage`');
  }
  if (window.parent === window) {
    // Not in an `<iframe>`.
    return Promise.reject(new Error('Message-proxy iframe not found'));
  }
  Object.assign(msg, {src: 'webvr-agent'});
  window.top.postMessage(msg, origin || self.originHost);
};

var url = function (key, params) {
  params = params || {};
  if (key === 'manifest') {
    if (params.url) {
      return ORIGIN + '/manifest?url=' + params.url;
    }
  }
  return ORIGIN;
};

if (SERVICE_WORKER_ENABLED && 'serviceWorker' in navigator) {
  // Check if the application is installed by checking the controller.
  // If there is a Service Worker controlling this page, then let's
  // assume the application is installed.
  navigator.serviceWorker.getRegistration().then(function (registration) {
    if (!registration || !registration.active) {
      return;
    }
    console.log('[webvr-agent][host] Service Worker already active');
    swLoad();
  });

  // During installation, once the Service Worker is active, we show
  // the image dynamic loader.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    this.controller.addEventListener('statechange', function () {
      if (this.state !== 'activated') {
        return;
      }
      swLoad();
    });
    if (!navigator.serviceWorker.controller) {
      return;
    }
    console.log('[webvr-agent][host] Service Worker installed');
    swLoad();
  });

  // Register the Service Worker, if it's not already registered.
  if (!navigator.serviceWorker.controller) {
    navigator.serviceWorker.register('sw.js');
  }
}

function swLoad () {
  console.log('[webvr-agent][host] Service Worker loaded');
}

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

function removeHash () {
  window.history.replaceState({}, document.title, window.location.pathname +
    window.location.search);
}

function sendDisplayRequestPresentMsg (opts) {
  if (window.parent === window) {
    return;
  }
  opts = opts || {};
  webvrAgentHost.postMessage({
    action: 'display-request-present',
    displaySlug: opts.displaySlug,
    displayId: opts.displayId,
    displayName: opts.displayName
  });
}

function sendDisplayExitPresentMsg (opts) {
  if (window.parent === window) {
    return;
  }
  opts = opts || {};
  webvrAgentHost.postMessage({
    action: 'display-exit-present',
    displaySlug: opts.displaySlug,
    displayId: opts.displayId,
    displayName: opts.displayName
  }, ORIGIN);
}

function getSiblings (el, sel) {
  var parentEl = el.parentNode;
  if (!parentEl) {
    return [];
  }
  sel = sel || '*';
  var siblings = toArray(parentEl.querySelectorAll(sel));
  return Array.prototype.filter.call(siblings, function (el) {
    if (el.parentNode !== parentEl) {
      return;
    }
    if (!sel || (el.matches && el.matches(sel))) {
      return el;
    }
  });
}

function getBoundingClientRectObject (el) {
  if (!el) {
    return {};
  }

  var rect;
  try {
    rect = el.getBoundingClientRect();
  } catch (err) {
    return {};
  }

  var obj = {};
  BOUNDING_CLIENT_RECT_KEYS.forEach(function (key) {
    if (typeof rect[key] === 'number') {
      obj[key] = Math.ceil(rect[key]) + 'px';
    } else {
      obj[key] = rect[key];
    }
  });
  return obj;
}

doc.loaded.then(function () {
  var html = document.documentElement;
  var supportsTouch = 'ontouchstart' in window;
  var hash = window.location.hash;
  var hashKey = 'data-aria-expanded__' + hashId;
  // var steamModal = Frdialogmodal();
  var toggleCloseEl;
  var toggleInfoEl;
  var webvrAgentEl = document.querySelector('#webvr-agent');
  var webvrAgentHeadsetsEl = webvrAgentEl.querySelector('#webvr-agent-report-link');
  var webvrAgentReportLinkEl = webvrAgentEl.querySelector('#webvr-agent-report-link');

  if (webvrAgentReportLinkEl) {
    webvrAgentReportLinkEl.setAttribute('href',
      'https://webcompat.com/issues/new?url=' + SITE_URL + '&src=moonrise-webvr');
  }

  var getHeight = function () {
    return html.getClientRects()[0].height;
  };

  var getToggleVRButtonDimensions = function () {
    return getBoundingClientRectObject(toggleVRButtonEl);
  };

  var hashId = hash.substr(1);

  var defaultHeight = getHeight() + 10;
  var expandedHeight = 160;
  var lastSentHeight = null;

  var toggleVRButtonEl = webvrAgentEl.querySelector('#webvr-agent-headsets-controls');
  var defaultToggleVRButtonDimensions = getToggleVRButtonDimensions();
  var lastSentToggleVRButtonDimensions = null;

  html.dataset.supportsTouch = supportsTouch;

  window.addEventListener('resize', function () {
    sendResizeIframeMsg();
    sendResizeToggleVRButtonMsg();
  });

  // steamModal.init();

  window.addEventListener('beforeunload', function () {
    // steamModal.destroy();
  });

  sendResizeIframeMsg(defaultHeight);

  sendResizeToggleVRButtonMsg(defaultToggleVRButtonDimensions);

  function sendResizeIframeMsg (height, origin) {
    if (window.parent === window) {
      return;
    }
    if (typeof height === 'undefined') {
      height = getHeight();
    }
    if (height === lastSentHeight) {
      return;
    }
    webvrAgentHost.postMessage({
      action: 'resize-iframe',
      height: height + 'px'
    }, SITE_ORIGIN);
    lastSentHeight = height;
    return height;
  }

  function sendResizeToggleVRButtonMsg (dimensions, origin) {
    if (window.parent === window) {
      return;
    }
    if (typeof dimensions === 'undefined') {
      dimensions = getToggleVRButtonDimensions();
    }
    if (dimensions === lastSentToggleVRButtonDimensions) {
      return;
    }
    webvrAgentHost.postMessage({
      action: 'resize-toggle-vr-button',
      dimensions: dimensions
    }, origin || SITE_ORIGIN);
    lastSentToggleVRButtonDimensions = dimensions;
    return dimensions;
  }

  sendResizeToggleVRButtonMsg();

  function handleExpanders (evt, hash) {
    hash = hash || window.location.hash;
    if (!hash) {
      return;
    }
    hashId = hash.substr(1);
    hashKey = 'data-aria-expanded__' + hashId;
    toggleCloseEl = toggleInfoEl = null;
    var el = document.querySelector(hash);
    var ariaExpandedState = html.getAttribute(hashKey) || null;
    if (!el ||
        (el.matches && el.matches(':empty')) ||
        !document.querySelector('[aria-expands="' + hashId + '"]')) {
      return;
    }
    ariaExpandedState = (el.getAttribute('aria-expanded') || '').trim().toLowerCase();
    ariaExpandedState = ariaExpandedState === 'true';
    if (ariaExpandedState !== null) {
      if (evt) {
        evt.preventDefault();
      }
      ariaExpandedState = !ariaExpandedState;
      html.setAttribute(hashKey, ariaExpandedState);
      el.setAttribute('aria-expanded', ariaExpandedState);
      toggleCloseEl = getSiblings(el, '[aria-roledescription="close"]')[0];
      toggleInfoEl = getSiblings(el, '[aria-roledescription="info"]')[0];
      if (toggleCloseEl && toggleInfoEl) {
        if (ariaExpandedState) {
          toggleCloseEl.setAttribute('aria-expanded', true);
          toggleInfoEl.setAttribute('aria-expanded', false);
          sendResizeIframeMsg(expandedHeight);
        } else {
          toggleCloseEl.setAttribute('aria-expanded', false);
          toggleInfoEl.setAttribute('aria-expanded', true);
          sendResizeIframeMsg(defaultHeight);
        }
        setTimeout(function () {
          sendResizeIframeMsg();
        }, 500);
      }
      removeHash();
    }
  }

  window.addEventListener('hashchange', handleExpanders);
  handleExpanders();

  xhrJSON(url('manifest', {url: SITE_URL})).then(function (manifest) {
    if (!manifest || !manifest.name) {
      return;
    }

    webvrAgentEl.classList.remove('loading');

    var image = webvrAgentEl.querySelector('.webvr-agent-image[data-setAttribute-href]');
    var imageStyleBackgroundImage = image.getAttribute('data-style-backgroundImage');
    var imageStyleBackgroundImageObject = manifest[imageStyleBackgroundImage];
    if (imageStyleBackgroundImageObject) {
      var imageStyleBackgroundImageValue = manifest[imageStyleBackgroundImage].src;
      image.style.backgroundImage = `url(${imageStyleBackgroundImageValue})`;
    }

    var imageHrefKey = image.getAttribute('data-setAttribute-href');
    var imageHrefValue = manifest[imageHrefKey];
    if (imageHrefValue) {
      image.setAttribute('href', imageHrefValue);
    }

    var name = webvrAgentEl.querySelector('.webvr-agent-name[data-textContent]');
    var nameTextContentKey = name.getAttribute('data-textContent');
    var nameValue = manifest[nameTextContentKey];
    if (nameValue) {
      name.textContent = nameValue;
    }

    var description = webvrAgentEl.querySelector('.webvr-agent-description[data-textContent]');
    var descriptionTextContentKey = description.getAttribute('data-textContent');
    var descriptionValue = manifest[descriptionTextContentKey];
    if (descriptionValue) {
      description.insertAdjacentText('afterbegin', descriptionValue);
    } else {
      webvrAgentEl.querySelector('[aria-expands="webvr-agent-description"]').removeAttribute('aria-expands');
    }

    webvrAgentHost.postMessage({
      action: 'loaded',
      url: window.location.href
    });
  });

  window.addEventListener('keyup', function (evt) {
    if (evt.target !== document.body || evt.shiftKey || evt.metaKey || evt.altKey || evt.ctrlKey) {
      return;
    }
    if (evt.keyCode === webvrAgentHost.keys.esc) {  // `Esc` key.
      console.log('[webvr-agent][client] `Esc` key pressed');
      if (webvrAgentHost.state.displaysConnected) {
        if (webvrAgentHost.state.displaysPresenting.length) {
          sendDisplayExitPresentMsg();
        }
      }
      closeInfo();
    } else if (evt.keyCode === webvrAgentHost.keys.i) {  // `i` key.
      evt.preventDefault();
      console.log('[webvr-agent][client] `i` key pressed');
      toggleInfo();
    } else if (evt.keyCode === webvrAgentHost.keys.c) {  // `c` key.
      evt.preventDefault();
      console.log('[webvr-agent][client] `c` key pressed');
      closeInfo();
    } else if (evt.keyCode === webvrAgentHost.keys.v) {
      evt.preventDefault();
      console.log('[webvr-agent][client] `v` key pressed');
      if (webvrAgentHost.state.displaysConnected) {
        if (webvrAgentHost.state.displaysPresenting.length) {
          sendDisplayExitPresentMsg();
        } else {
          sendDisplayRequestPresentMsg();
        }
      }
    } else if (evt.keyCode === webvrAgentHost.keys.f) {
      evt.preventDefault();
      console.log('[webvr-agent][client] `f` key pressed');
      if (webvrAgentHost.state.displaysConnected) {
        if (webvrAgentHost.state.displaysPresenting.length) {
          sendDisplayExitPresentMsg();
        } else {
          sendDisplayRequestPresentMsg();
        }
      }
    }
  });

  var headsetsControlsEl = webvrAgentEl.querySelector('#webvr-agent-headsets-controls');
  if (headsetsControlsEl) {
    ariaListbox(headsetsControlsEl, {
      nextKeys: [
        's',
        'd',
        37,
        38
      ],
      prevKeys: [
        'a',
        'w',
        39,
        40
      ]
    });
  }

  document.body.addEventListener('click', function (evt) {
    var el = evt.target;

    if (!el || !el.closest) {
      return;
    }

    if (el.closest('#webvr-agent-details') ||
        el.closest('#webvr-agent-description')) {
      var ariaExpandsEls = webvrAgentEl.querySelectorAll('[aria-expands]');
      Array.prototype.forEach.call(ariaExpandsEls, function (el) {
        handleExpanders(evt, '#' + el.getAttribute('aria-expands'));
      });
    } else {
      var closedInfo = closeInfo();
      if (closedInfo) {
        return;
      }
    }

    if (el.closest('[data-headset-slug]')) {
      var displayId = el.closest('[data-headset-slug]').getAttribute('data-headset-id');
      var display = webvrAgentHost.state.displaysById[displayId];
      var displayOpts = {
        displaySlug: el.getAttribute('data-headset-slug'),
        displayName: el.getAttribute('data-headset-name'),
        displayId: displayId,
        isConnected: display && 'isConnected' in display ? display.isConnected : false,
        isPresenting: display && 'isPresenting' in display ? display.isPresenting : false
      };
      if (displayOpts.isPresenting) {
        sendDisplayExitPresentMsg(displayOpts);
      } else if (displayOpts.isConnected) {
        sendDisplayRequestPresentMsg(displayOpts);
      }
      return;
    }

    if (el.closest('#webvr-agent-steam-link')) {
      evt.preventDefault();
      el.blur();
      document.documentElement.focus();
      // TODO: Authenticate against REST API (`/steam/auth`).
    }
  });

  var steamForm = document.querySelector('#webvr-agent-form-steam');
  steamForm.addEventListener('submit', function (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    webvrAgentHost.steam.username = steamForm.querySelector('input[name="steam_username"]').value;
    // webvrAgentHost.steam.password = steamForm.querySelector('input[name="steam_password"]').value;
    document.querySelector('.webvr-agent-steam-label').textContent = 'Signed in as cvanw';
    console.log(webvrAgentHost.steam);
    webvrAgentHost.postMessage({
      action: 'steam-user-authenticated',
      username: webvrAgentHost.steam.username,
      src: 'webvr-agent'
    }, SITE_ORIGIN);
    if (document.activeElement) {
      document.activeElement.blur();
    }
    document.body.focus();
  });

  function closeInfo () {
    var closeEl = document.querySelector('#webvr-agent-details-toggle-close[aria-expanded="true"]');
    if (closeEl) {
      console.log('[webvr-agent][client] Hiding description');
      closeEl.click();
      return true;
    }
    return false;
  }

  function openInfo () {
    var openEl = document.querySelector('#webvr-agent-details-toggle-info[aria-expanded="true"]');
    if (openEl) {
      console.log('[webvr-agent][client] Opening description');
      openEl.click();
      return true;
    }
    return false;
  }

  function toggleInfo () {
    console.log('[webvr-agent][client] Toggling description');
    var toggleEl = document.querySelector('.webvr-agent-details-toggle[aria-expanded="true"]');
    if (toggleEl) {
      toggleEl.click();
      return true;
    }
    return false;
  }

  var headsetsPresentEl = webvrAgentEl.querySelector('#webvr-agent-headsets-present');

  function updateHeadsets (connectedDisplayIfAvailable, retry) {
    if (typeof retry === 'undefined') {
      retry = true;
    }

    var headsetEls = webvrAgentEl.querySelectorAll('[data-headset-slug]');

    Array.prototype.forEach.call(headsetEls, function (el) {
      var headsetSlug = el.getAttribute('data-headset-slug');
      var headsetLabelEnterVREl = el.querySelector('.webvr-agent-headset-label-enter-vr');
      var headsetLabelExitVREl = el.querySelector('.webvr-agent-headset-label-exit-vr');
      var displayIsConnected = webvrAgentHost.state.displayIsConnected(headsetSlug);
      var displayIsPresenting = webvrAgentHost.state.displayIsPresenting(headsetSlug);
      if (connectedDisplayIfAvailable && connectedDisplayIfAvailable.displaySlug === headsetSlug) {
        el.setAttribute('data-headset-id', connectedDisplayIfAvailable.displayId);
        el.setAttribute('data-headset-name', connectedDisplayIfAvailable.displayName);
        el.setAttribute('title', connectedDisplayIfAvailable.displayName);
      }
      el.setAttribute('data-headset-connected', displayIsConnected);
      el.setAttribute('data-headset-presenting', displayIsPresenting);
      el.setAttribute('data-headset-ready', displayIsConnected && !displayIsPresenting);
      el.setAttribute('data-headset-timeout', displayIsConnected);
      el.setAttribute('aria-hidden', displayIsConnected || displayIsPresenting ? 'false' : 'true');
      if (headsetLabelEnterVREl) {
        headsetLabelEnterVREl.setAttribute('aria-hidden', displayIsPresenting ? 'true' : 'false');
      }
      if (headsetLabelExitVREl) {
        headsetLabelExitVREl.setAttribute('aria-hidden', displayIsPresenting ? 'false' : 'true');
      }
    });

    var anyDisplaysConnected = webvrAgentHost.state.displaysConnected.length > 0;
    var anyDisplaysPresenting = webvrAgentHost.state.displaysPresenting.length > 0;

    var jsonDisplaysConnected = JSON.stringify(webvrAgentHost.state.displaysConnected);

    if (anyDisplaysConnected) {
      html.setAttribute('data-connected-displays', jsonDisplaysConnected);
      html.setAttribute('data-missing-displays', 'false');
      html.setAttribute('data-timeout-displays', 'false');
    } else {
      html.removeAttribute('data-connected-displays');
      headsetsPresentEl.innerHTML = 'Detecting VR headset&hellip;';
    }

    if (anyDisplaysPresenting) {
      var jsonDisplaysPresenting = JSON.stringify(webvrAgentHost.state.displaysPresenting);
      html.setAttribute('data-presenting-displays', jsonDisplaysPresenting);
      html.removeAttribute('data-ready-displays');
      html.setAttribute('data-missing-displays', 'false');
      headsetsPresentEl.innerHTML = '';
    } else {
      html.removeAttribute('data-presenting-displays');
      if (anyDisplaysConnected) {
        html.setAttribute('data-ready-displays', jsonDisplaysConnected);
        headsetsPresentEl.innerHTML = '';
      } else if (!retry) {
        html.setAttribute('data-missing-displays', 'true');
        html.removeAttribute('data-ready-displays');
        headsetsPresentEl.innerHTML = 'No VR headset detected';
      }
    }

    if (retry) {
      setTimeout(function () {
        updateHeadsets(connectedDisplayIfAvailable, false);
      }, webvrAgentHost.headsetsPresentTimeout);
    }
  }

  function updateDisplayConnected (displayState) {
    webvrAgentHost.updateState(displayState.displayId, displayState);

    updateHeadsets(displayState);
  }

  function updateDisplayDisconnected (displayState) {
    webvrAgentHost.updateState(displayState.displayId, displayState);

    updateHeadsets();
  }

  function updateDisplayPresentStart (displayState) {
    webvrAgentHost.updateState(displayState.displayId, displayState);

    updateHeadsets(displayState);
  }

  function updateDisplayPresentEnd (displayState) {
    webvrAgentHost.updateState(displayState.displayId, displayState);

    updateHeadsets();
  }

  window.addEventListener('message', function (evt) {
    var data = evt.data;
    var action = data.action;
    var src = data.src;
    if (src !== 'webvr-agent') {
      return;
    }
    if (action === 'loaded') {
      updateHeadsets();
    } else if (action === 'open-info') {
      openInfo();
    } else if (action === 'close-info') {
      closeInfo();
    } else if (action === 'toggle-info') {
      toggleInfo();
    } else if (action === 'display-connected') {
      updateDisplayConnected(data);
    } else if (action === 'display-disconnected') {
      updateDisplayDisconnected(data);
    } else if (action === 'display-present-start') {
      updateDisplayPresentStart(data);
    } else if (action === 'display-present-end') {
      updateDisplayPresentEnd(data);
    } else if (action === 'mouseenter-toggle-vr-button') {
      if (webvrAgentHeadsetsEl) {
        webvrAgentHeadsetsEl.classList.add('hover');
      }
    } else if (action === 'mouseleave-toggle-vr-button') {
      if (webvrAgentHeadsetsEl) {
        webvrAgentHeadsetsEl.classList.remove('hover');
      }
    }
  });
});
