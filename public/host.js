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
    displayName: opts.displayName
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
    displayName: opts.displayName
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
  var webvrAgent = document.querySelector('#webvr-agent');

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
      height: height + 'px'
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

    webvrAgent.classList.remove('loading');

    var image = webvrAgent.querySelector('.webvr-agent-image[data-setAttribute-href]');
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

    var name = webvrAgent.querySelector('.webvr-agent-name[data-textContent]');
    var nameTextContentKey = name.getAttribute('data-textContent');
    var nameValue = manifest[nameTextContentKey];
    if (nameValue) {
      name.textContent = nameValue;
    }

    var description = webvrAgent.querySelector('.webvr-agent-description[data-textContent]');
    var descriptionTextContentKey = description.getAttribute('data-textContent');
    var descriptionValue = manifest[descriptionTextContentKey];
    if (descriptionValue) {
      description.insertAdjacentText('afterbegin', descriptionValue);
    } else {
      webvrAgent.querySelector('[aria-expands="webvr-agent-description"]').removeAttribute('aria-expands');
    }

    proxy.postMessage(window.top, {
      action: 'loaded',
      url: window.location.href
    }).then(function (res) {
      console.log('[webvr-agent][host] Message-proxy (%s) response:', proxy.name, res);
    });
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

  var headsetsControlsEl = webvrAgent.querySelector('#webvr-agent-headsets-controls');
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

  var fs = require('fs');
  // fs.readFile()

  window.addEventListener('keydown', function (evt) {
    if (evt.altKey || evt.ctrlKey || evt.shiftKey || (evt.target.closest && evt.target.closest('#webvr-agent-headsets'))) {
      return;
    }
    if (evt.keyCode === keys.enter || evt.keyCode === keys.space) {
      var el = evt.target;
      if (!el) {
        return;
      }
      var regionEl = webvrAgent.querySelector('#' + el.getAttribute('aria-controls'));
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
    var ariaExpandsEls = webvrAgent.querySelectorAll('[aria-expands]');
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
        displayConnected: el.getAttribute('data-headset-connected'),
        displayPresenting: el.getAttribute('data-headset-presenting')
      };
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

  var headsetsEl = webvrAgent.querySelector('#webvr-agent-headsets');
  var headsetsPresentEl = webvrAgent.querySelector('#webvr-agent-headsets-present');

  setInterval(function () {
    // headsetsEl.setAttribute('aria-hidden', webvrAgent.connectedDisplay ? false : true);
    if (webvrAgent.connectedDisplay) {
      headsetsPresentEl.innerHTML = 'Detecting VR headset&hellip;';
    } else {
      headsetsPresentEl.textContent = 'No VR headset detected';
    }
  }, 15000);

  function showConnectedDisplay (opts) {
    var displaySlug = opts.displaySlug;
    var displayId = opts.displayId;
    var displayName = opts.displayName;

    if (!displaySlug) {
      var headsetEl = webvrAgent.querySelector('[data-headset-slug][aria-hidden="false"]');
      if (headsetEl) {
        headsetEl.setAttribute('aria-hidden', 'true');
        headsetsPresentEl.textContent = 'Present';
      }
      headsetEl.setAttribute('data-headset-connected', 'false');
      html.removeAttribute('data-connected-display');
      return;
    }

    var headsetEls = webvrAgent.querySelectorAll('[data-headset-slug]');
    Array.prototype.forEach.call(headsetEls, function (el) {
      if (el.getAttribute('data-headset-slug') === displaySlug) {
        el.setAttribute('data-headset-connected', 'true');
        el.setAttribute('data-headset-id', displayId);
        el.setAttribute('data-headset-name', displayName);
        el.setAttribute('title', displayName);
        el.setAttribute('aria-hidden', 'false');
        headsetsPresentEl.textContent = 'Ready to present';
        return;
      }
      el.setAttribute('data-headset-connected', 'false');
      el.setAttribute('aria-hidden', 'true');
    });

    html.setAttribute('data-connected-display', displaySlug);
  }

  function showPresentingDisplay (opts) {
    var displaySlug = opts.displaySlug;
    var displayId = opts.displayId;
    var displayName = opts.displayName;

    if (!displaySlug) {
      var headsetEl = webvrAgent.querySelector('[data-headset-slug][aria-hidden="false"]');
      if (headsetEl) {
        headsetEl.setAttribute('aria-hidden', 'true');
        headsetsPresentEl.textContent = 'Present';
      }
      headsetEl.setAttribute('data-headset-presenting', 'false');
      html.removeAttribute('data-presenting-display');
      return;
    }

    var headsetEls = webvrAgent.querySelectorAll('[data-headset-slug]');
    Array.prototype.forEach.call(headsetEls, function (el) {
      if (el.getAttribute('data-headset-slug') === displaySlug) {
        el.setAttribute('data-headset-presenting', 'true');
        el.setAttribute('data-headset-id', displayId);
        el.setAttribute('data-headset-name', displayName);
        el.setAttribute('title', displayName);
        el.setAttribute('aria-hidden', 'false');
        headsetsPresentEl.textContent = 'Ready to present';
        return;
      }
      el.setAttribute('data-headset-presenting', 'false');
      el.setAttribute('aria-hidden', 'true');
    });

    html.setAttribute('data-presenting-display', displaySlug);
  }

  window.addEventListener('message', function (evt) {
    var data = evt.data;
    var action = data.action;
    if (action === 'close-info') {
      closeInfo();
    } else if (action === 'open-info') {
      openInfo();
    } else if (action === 'toggle-info') {
      toggleInfo();
    } else if (action === 'display-connected') {
      showConnectedDisplay(data);
    } else if (action === 'display-presenting') {
      showPresentingDisplay(data);
    }
  });
});
