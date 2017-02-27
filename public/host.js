/* jshint esversion: 6 */
/* eslint-env es6 */
/* global Primus */

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

function xhrJSON (url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('get', url, 'true');
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
    xhr.send();
  });
}

function removeHash () {
  window.history.replaceState({}, document.title, window.location.pathname +
    window.location.search);
}

function sendResizeIframeMsg (height) {
  if (window.parent === window) {
    return;
  }
  if (typeof height === 'undefined') {
    height = document.documentElement.getClientRects()[0].height;
  }
  window.top.postMessage({
    action: 'iframeresize',
    height: height + 'px'
  }, '*');
}

doc.loaded.then(function () {
  // var proxy = new WindowPostMessageProxy.WindowPostMessageProxy({
  //   name: ORIGIN,
  //   // logMessages: !IS_PROD
  //   logMessages: true
  // });

  sendResizeIframeMsg();

  var html = document.documentElement;
  var defaultHeight = html.getClientRects()[0].height;
  var supportsTouch = 'ontouchstart' in window;
  var hash = window.location.hash;
  var hashId = hash.substr(1);
  var hashKey = 'data-aria-expanded__' + hashId;
  var toggleClose;
  var toggleInfo;

  html.dataset.supportsTouch = supportsTouch;

  function handleExpanders (evt, hash) {
    hash = hash || window.location.hash;
    if (!hash) {
      return;
    }
    hashId = hash.substr(1);
    hashKey = 'data-aria-expanded__' + hashId;
    var el;
    var ariaExpandedState = html.getAttribute(hashKey) || null;
    el = document.querySelector(hash);
    if (el) {
      ariaExpandedState = (el.getAttribute('aria-expanded') || '').trim().toLowerCase();
      ariaExpandedState = ariaExpandedState === 'true' ? true : false;
    }
    console.log('ariaExpandedState', ariaExpandedState);
    if (ariaExpandedState !== null) {
      if (evt) {
        evt.preventDefault();
      }
      console.log(ariaExpandedState);
      ariaExpandedState = !ariaExpandedState;
      html.setAttribute(hashKey, ariaExpandedState);
      el.setAttribute('aria-expanded', ariaExpandedState);
      toggleClose = document.querySelector('#webvr-agent-details-toggle-close');
      toggleInfo = document.querySelector('#webvr-agent-details-toggle-info');
      if (ariaExpandedState) {
        toggleClose.setAttribute('aria-expanded', true);
        toggleInfo.setAttribute('aria-expanded', false);
        sendResizeIframeMsg(150);
      } else {
        toggleClose.setAttribute('aria-expanded', false);
        toggleInfo.setAttribute('aria-expanded', true);
        sendResizeIframeMsg(defaultHeight);
      }
      setTimeout(function () {
        sendResizeIframeMsg();
      }, 500);
      removeHash();
    }
  }

  window.addEventListener('hashchange', handleExpanders);
  handleExpanders();

  var ariaExpands = document.querySelectorAll('[aria-expands]');
  Array.prototype.forEach.call(ariaExpands, function (el) {
    el.addEventListener('click', function (evt) {
      handleExpanders(evt, '#' + el.getAttribute('aria-expands'));
    });
  });

  xhrJSON(url('manifest', {url: SITE_URL})).then(function (manifest) {
    var webvrAgent = document.querySelector('#webvr-agent');
    var attributes;

    var image = webvrAgent.querySelector('.webvr-agent-image[data-setAttribute-href]');
    var imageStyleBackgroundImage = image.getAttribute('data-style-backgroundImage');
    console.log(manifest);
    image.style.backgroundImage = `url(${manifest[imageStyleBackgroundImage].src})`;
    var imageHref = image.getAttribute('data-setAttribute-href');
    image.setAttribute('href', imageHref);

    var name = webvrAgent.querySelector('.webvr-agent-name[data-textContent]');
    var nameTextContent = name.getAttribute('data-textContent');
    name.textContent = manifest[nameTextContent];

    var description = webvrAgent.querySelector('.webvr-agent-description[data-textContent]');
    var descriptionTextContent = description.getAttribute('data-textContent');
    description.insertAdjacentText('afterbegin', manifest[descriptionTextContent]);
  });
});
