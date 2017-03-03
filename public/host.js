/* global process */

var SCENE_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var ORIGIN = '';
try {
  ORIGIN = new URL(window.location.href).origin;
} catch (e) {
  ORIGIN = SCENE_ORIGIN;
}
// var WEBVR_AGENT_ORIGIN = window.location.protocol + '//' + window.location.hostname + ':4040';
// var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = process.env.NODE_ENV === 'production';
var SITE_URL = (window.location.search.match(/[?&]url=(.+)/) || [])[1];

var ariaListbox = require('aria-listbox');
// var feathers = require('feathers-client');
var WindowPostMessageProxy = require('window-post-message-proxy');

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

var url = function (key, params) {
  params = params || {};
  if (key === 'manifest') {
    if (params.url) {
      return ORIGIN + '/manifest?url=' + params.url;
    }
  }
  return ORIGIN;
};

if (IS_PROD && 'serviceWorker' in navigator) {
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
  navigator.serviceWorker.register('service-worker.js');
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
  window.top.postMessage({
    action: 'display-request-present',
    displaySlug: opts.displaySlug,
    displayId: opts.displayId,
    displayName: opts.displayName,
    src: 'webvr-agent'
  }, '*');
}

function sendDisplayExitPresentMsg (opts) {
  if (window.parent === window) {
    return;
  }
  opts = opts || {};
  window.top.postMessage({
    action: 'display-exit-present',
    displaySlug: opts.displaySlug,
    displayId: opts.displayId,
    displayName: opts.displayName,
    src: 'webvr-agent'
  }, '*');
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

doc.loaded.then(function () {
  var proxy = new WindowPostMessageProxy.WindowPostMessageProxy({
    name: ORIGIN,
    // logMessages: !IS_PROD
    logMessages: false
  });

  var html = document.documentElement;
  var getHeight = function () {
    return html.getClientRects()[0].height;
  };
  var defaultHeight = getHeight() + 10;
  var expandedHeight = 160;
  var lastSentHeight = null;
  var supportsTouch = 'ontouchstart' in window;
  var hash = window.location.hash;
  var hashId = hash.substr(1);
  var hashKey = 'data-aria-expanded__' + hashId;
  var toggleCloseEl;
  var toggleInfoEl;
  var webvrAgentEl = document.querySelector('#webvr-agent');
  var state = {
    connectedDisplays: {},
    disconnectedDisplays: {},
    presentingDisplays: {}
  };

  html.dataset.supportsTouch = supportsTouch;

  sendResizeIframeMsg(defaultHeight);
  window.addEventListener('resize', function () {
    sendResizeIframeMsg();
  });

  function sendResizeIframeMsg (height) {
    if (window.parent === window) {
      return;
    }
    if (typeof height === 'undefined') {
      height = getHeight();
    }
    if (height === lastSentHeight) {
      return;
    }
    window.top.postMessage({
      action: 'iframe-resize',
      height: height + 'px',
      src: 'webvr-agent'
    }, '*');
    lastSentHeight = height;
    return height;
  }

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
    ariaExpandedState = ariaExpandedState === 'true' ? true : false;
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

    if (proxy) {
      proxy.postMessage(window.top, {
        action: 'loaded',
        url: window.location.href,
        src: 'webvr-agent'
      }).then(function (res) {
        console.log('[webvr-agent][host] Message-proxy (%s) response:', proxy.name, res);
      });
    }
  });

  var keys = {
    esc: 27,
    enter: 13,
    space: 32,
    i: 73,
    c: 67
  };

  window.addEventListener('keyup', function (evt) {
    if (evt.target !== document.body) {
      return;
    }
    if (evt.keyCode === keys.esc) {  // `Esc` key.
      console.log('[webvr-agent][client] `Esc` key pressed');
      sendDisplayExitPresentMsg();
      closeInfo();
    } else if (evt.keyCode === keys.i) {  // `i` key.
      console.log('[webvr-agent][client] `i` key pressed');
      toggleInfo();
    } else if (evt.keyCode === keys.c) {  // `c` key.
      console.log('[webvr-agent][client] `c` key pressed');
      closeInfo();
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

  window.addEventListener('keydown', function (evt) {
    if (evt.altKey || evt.ctrlKey || evt.shiftKey || (evt.target.closest && evt.target.closest('#webvr-agent-headsets'))) {
      return;
    }
    if (evt.keyCode === keys.enter || evt.keyCode === keys.space) {
      if (state.presentingDisplays.length) {
        return;
      }
      var el = evt.target;
      if (!el) {
        return;
      }
      var regionEl = webvrAgentEl.querySelector('#' + el.getAttribute('aria-controls'));
      var actionLabelEl;

      if (el.getAttribute('aria-expanded') === 'true') {
        el.getAttribute('aria-expanded', 'false');
        regionEl.setAttribute('aria-hidden', 'true');
        actionLabelEl = el.querySelector('[data-aria-controls-action]');
        if (actionLabelEl) {
          actionLabelEl.textContent = 'Show';
        }
      } else {
        el.getAttribute('aria-expanded', 'true');
        regionEl.setAttribute('aria-hidden', 'false');

        getSiblings(el, '[aria-expanded]').forEach(function (siblingEl) {
          siblingEl.setAttribute('aria-expanded', 'false');
        });

        getSiblings(regionEl, '[aria-hidden]').forEach(function (siblingEl) {
          siblingEl.setAttribute('aria-hidden', 'true');
        });

        getSiblings(el).forEach(function (siblingEl) {
          var siblingActionLabelEl = siblingEl.querySelector('[data-aria-controls-action]');
          if (siblingActionLabelEl) {
            siblingActionLabelEl.textContent = 'Show';
          }
        });

        actionLabelEl = el.querySelector('[data-aria-controls-action]');
        if (actionLabelEl) {
          actionLabelEl.textContent = 'Hide';
        }
      }

      evt.preventDefault();
      evt.stopPropagation();
    }

    return true;
  });

  document.body.addEventListener('click', function (evt) {
    if (state.presentingDisplays.length) {
      return;
    }

    var ariaExpandsEls = webvrAgentEl.querySelectorAll('[aria-expands]');
    Array.prototype.forEach.call(ariaExpandsEls, function (el) {
      handleExpanders(evt, '#' + el.getAttribute('aria-expands'));
    });

    var el = evt.target;
    if (el.closest('#webvr-agent-details') ||
        el.closest('#webvr-agent-description')) {
      return;
    }

    if (!el) {
      return;
    }

    closeInfo();

    if (el.closest && el.closest('[data-headset-slug]')) {
      var displayOpts = {
        displaySlug: el.getAttribute('data-headset-slug'),
        displayName: el.getAttribute('data-headset-name'),
        displayId: el.getAttribute('data-headset-id'),
        displayConnected: Boolean(el.getAttribute('data-headset-connected')),
        displayPresenting: Boolean(el.getAttribute('data-headset-presenting'))
      };
      console.error('displayOpts', displayOpts);
      if (displayOpts.displayPresenting) {
        sendDisplayExitPresentMsg(displayOpts);
      } else if (displayOpts.displayConnected) {
        sendDisplayRequestPresentMsg(displayOpts);
      }
    }

    if (!el.getAttribute('aria-controls')) {
      return;
    }

    var regionEl = document.getElementById(el.getAttribute('aria-controls'));
    var actionLabelEl;

    if (el.getAttribute('aria-expanded') == 'true') {
        el.getAttribute('aria-expanded', 'false');
      regionEl.setAttribute('aria-hidden', 'true');
      actionLabelEl = el.querySelector('[data-aria-controls-action]');
      if (actionLabelEl) {
        actionLabelEl.textContent = 'Show';
      }
    } else {
      el.setAttribute('aria-expanded', 'true');
      regionEl.setAttribute('aria-hidden', 'false');

      getSiblings(el, '[aria-expanded]').forEach(function (siblingEl) {
        var siblingControlEl = siblingEl.querySelector('[aria-expanded]');
        if (siblingControlEl) {
          siblingControlEl.textContent = 'Show';
        }
      });

      actionLabelEl = el.querySelector('[data-aria-controls-action]');
      if (actionLabelEl) {
        actionLabelEl.textContent = 'Hide';
      }
    }
    evt.preventDefault();
    evt.stopPropagation();
  });

  function closeInfo () {
    console.log('[webvr-agent][client] Hiding description');
    var closeEl = document.querySelector('#webvr-agent-details-toggle-close[aria-expanded="true"]');
    if (closeEl) {
      closeEl.click();
      return true;
    }
    return false;
  }

  function openInfo () {
    console.log('[webvr-agent][client] Opening description');
    var openEl = document.querySelector('#webvr-agent-details-toggle-info[aria-expanded="true"]');
    if (openEl) {
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

  var headsetsEl = webvrAgentEl.querySelector('#webvr-agent-headsets');
  var headsetsPresentEl = webvrAgentEl.querySelector('#webvr-agent-headsets-present');
  var headsetsPresentTimeout = 15000;  // Timeout for showing VR status `<iframe>` (time in milliseconds [default: 30 seconds]).

  function updateHeadsets (connectedDisplayIfAvailable) {
    console.error('state', state, connectedDisplayIfAvailable);

    var headsetEls = webvrAgentEl.querySelectorAll('[data-headset-slug]');
    Array.prototype.forEach.call(headsetEls, function (el) {
      var headsetSlug = el.getAttribute('data-headset-slug');
      var headsetIsConnected = headsetSlug in state.connectedDisplays;
      var headsetIsPresenting = headsetSlug in state.presentingDisplays;
      if (headsetIsConnected && connectedDisplayIfAvailable) {
        el.setAttribute('data-headset-id', connectedDisplayIfAvailable.displayId);
        el.setAttribute('data-headset-name', connectedDisplayIfAvailable.displayName);
        el.setAttribute('title', connectedDisplayIfAvailable.displayName);
      }
      el.setAttribute('data-headset-connected', headsetIsConnected);
      el.setAttribute('data-headset-presenting', headsetIsPresenting);
      el.setAttribute('data-headset-ready', headsetIsConnected && !headsetIsPresenting);
      el.setAttribute('data-headset-timeout', headsetIsConnected);
      el.setAttribute('aria-hidden', !headsetIsConnected && !headsetIsPresenting ? 'true' : 'false');
    });

    var anyConnectedDisplays = Object.values(state.connectedDisplays).length > 0;
    var anyPresentingDisplays = Object.values(state.presentingDisplays).length > 0;

    var jsonConnectedDisplays = JSON.stringify(state.connectedDisplays);

    if (anyConnectedDisplays) {
      html.setAttribute('data-connected-displays', jsonConnectedDisplays);
      html.setAttribute('data-missing-displays', 'false');
      html.setAttribute('data-timeout-displays', 'false');
    } else {
      html.removeAttribute('data-connected-displays');
      headsetsPresentEl.innerHTML = 'Detecting VR headset&hellip;';
    }

    if (anyPresentingDisplays) {
      var jsonPresentingDisplays = JSON.stringify(state.presentingDisplays);
      html.setAttribute('data-presenting-displays', jsonPresentingDisplays);
      html.removeAttribute('data-ready-displays');
      html.setAttribute('data-missing-displays', 'false');
      headsetsPresentEl.innerHTML = 'Presenting';
    }

    if (!anyPresentingDisplays) {
      html.removeAttribute('data-presenting-displays');
      if (anyConnectedDisplays) {
        html.setAttribute('data-ready-displays', jsonConnectedDisplays);
        headsetsPresentEl.innerHTML = 'Ready to present';
      } else {
        html.setAttribute('data-missing-displays', 'true');
        html.removeAttribute('data-ready-displays');
        headsetsPresentEl.innerHTML = 'No VR headset detected';
      }
    }

    setTimeout(function () {
      if (!anyConnectedDisplays) {
        html.setAttribute('data-timeout-displays', 'true');
        headsetsPresentEl.textContent = 'No VR headset detected';
      }
    }, headsetsPresentTimeout);
  }

  function updateDisplayConnected (opts) {
    if (state.disconnectedDisplays[opts.displaySlug]) {
      var disconnectedDisplayIdx = state.disconnectedDisplays[opts.displaySlug].filter(function (display) {
        return display.displaySlug === opts.displaySlug &&
               display.displayId === opts.displayId &&
               display.displayName === opts.displayName;
      });
      if (disconnectedDisplayIdx > -1) {
        state.disconnectedDisplays.splice(disconnectedDisplayIdx, 1);
      }
    }

    if (state.connectedDisplays[opts.displaySlug]) {
      state.connectedDisplays[opts.displaySlug].push(opts);
    } else {
      state.connectedDisplays[opts.displaySlug] = [opts];
    }

    updateHeadsets(opts);
  }

  function updateDisplayDisconnected (opts) {
    if (state.connectedDisplays[opts.displaySlug]) {
      var disconnectedDisplayIdx = state.connectedDisplays[opts.displaySlug].filter(function (display) {
        return display.displaySlug === opts.displaySlug &&
               display.displayId === opts.displayId &&
               display.displayName === opts.displayName;
      });
      if (disconnectedDisplayIdx > -1) {
        state.connectedDisplays.splice(disconnectedDisplayIdx, 1);
      }
    }

    if (state.disconnectedDisplays[opts.displaySlug]) {
      state.disconnectedDisplays[opts.displaySlug].push(opts);
    } else {
      state.disconnectedDisplays[opts.displaySlug] = [opts];
    }

    updateHeadsets();
  }

  function updateDisplayPresenting (opts) {
    updateDisplayConnected(opts);

    if (state.presentingDisplays[opts.displaySlug]) {
      state.presentingDisplays[opts.displaySlug].push(opts);
    } else {
      state.presentingDisplays[opts.displaySlug] = [opts];
    }

    updateHeadsets();
  }

  function updateDisplayPresentStart (opts) {
    updateDisplayConnected(opts);

    updateHeadsets();
  }

  function updateDisplayPresentEnd (opts) {
    updateDisplayConnected(opts);

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
    } else if (action === 'display-presenting') {
      updateDisplayPresenting(data);
    } else if (action === 'display-present-start') {
      updateDisplayPresentStart(data);
    } else if (action === 'display-present-end') {
      updateDisplayPresentEnd(data);
    }
  });
});
