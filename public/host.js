var SCENE_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var ORIGIN = '';
try {
  ORIGIN = new URL(window.location.href).origin;
} catch (e) {
  ORIGIN = SCENE_ORIGIN;
}
var WEBVR_AGENT_ORIGIN = window.location.protocol + '//' + window.location.hostname + ':4040';
var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = process.env.NODE_ENV === 'production';
var SITE_URL = (window.location.search.match(/[?&]url=(.+)/) || [])[1];

// var feathers = require('feathers-client');
// var WindowPostMessageProxy = require('window-post-message-proxy');

var toArray = function (items) {
  return Array.prototype.slice.call(items);
};

var $;
var $$;

function initQuerySelectorFunctions (document) {
  $ = function (sel, el) {
    (el || document).querySelector;
  };
  $$ = function (sel, el) {
    if (Array.isArray(sel)) {
      return toArray(sel);
    }
    return toArray($(sel, el));
  };
}

/* Adapted from source: https://github.com/jonathantneal/document-promises/blob/master/document-promises.es6 */
var doc = {};
doc.loaded = new Promise(function (resolve) {
  var listener = function () {
    if (document.readyState === 'complete') {
      document.removeEventListener('readystatechange', listener);
      initQuerySelectorFunctions(document);
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
      initQuerySelectorFunctions(document);
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
      initQuerySelectorFunctions(document);
      resolve();
    }
  };
  document.addEventListener('DOMContentLoaded', listener);
  listener();
});

var url = function (key, params) {
  if (typeof params === 'undefined') {
    params = key;
    key = null;
  }
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

function sendVRRequestPresentMsg (height) {
  if (window.parent === window) {
    return;
  }
  window.top.postMessage({
    action: 'requestpresent',
    // display: null
  }, '*');
}

function sendVRExitPresentMsg (height) {
  if (window.parent === window) {
    return;
  }
  window.top.postMessage({
    action: 'exitpresent',
    // display: null
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
  // var proxy = new WindowPostMessageProxy.WindowPostMessageProxy({
  //   name: ORIGIN,
  //   // logMessages: !IS_PROD
  //   logMessages: true
  // });

  var html = document.documentElement;
  var defaultHeight = html.getClientRects()[0].height + 10;
  var expandedHeight = 160;
  var lastSentHeight = null;
  var supportsTouch = 'ontouchstart' in window;
  var hash = window.location.hash;
  var hashId = hash.substr(1);
  var hashKey = 'data-aria-expanded__' + hashId;
  var toggleClose;
  var toggleInfo;

  html.dataset.supportsTouch = supportsTouch;

  sendResizeIframeMsg();
  window.addEventListener('resize', function () {
    sendResizeIframeMsg();
  });

  function sendResizeIframeMsg (height) {
    if (window.parent === window) {
      return;
    }
    if (typeof height === 'undefined') {
      height = defaultHeight;
    }
    if (height === lastSentHeight) {
      return;
    }
    window.top.postMessage({
      action: 'iframeresize',
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
    toggleClose = toggleInfo = null;
    var el = document.querySelector(hash);
    var ariaExpandedState = html.getAttribute(hashKey) || null;
    if (!el || (el.matches && el.matches(':empty')) ||
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
      toggleClose = getSiblings(el, '[aria-roledescription="close"]')[0];
      toggleInfo = getSiblings(el, '[aria-roledescription="info"]')[0];
      if (toggleClose && toggleInfo) {
        if (ariaExpandedState) {
          toggleClose.setAttribute('aria-expanded', true);
          toggleInfo.setAttribute('aria-expanded', false);
          sendResizeIframeMsg(expandedHeight);
        } else {
          toggleClose.setAttribute('aria-expanded', false);
          toggleInfo.setAttribute('aria-expanded', true);
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

  var ariaExpands = document.querySelectorAll('[aria-expands]');
  Array.prototype.forEach.call(ariaExpands, function (el) {
    el.addEventListener('click', function (evt) {
      var expandedTargetEl = el.getAttribute('aria-expands');
      handleExpanders(evt, '#' + el.getAttribute('aria-expands'));
    });
  });

  xhrJSON(url('manifest', {url: SITE_URL})).then(function (manifest) {
    if (!manifest || !manifest.name) {
      return;
    }

    var webvrAgent = document.querySelector('#webvr-agent');
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
  });
});
