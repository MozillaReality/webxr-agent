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

var webvrAgent = new WebvrAgent();

webvrAgent.ready().then(function (proxy) {
  console.log('[webvr-agent][client] Ready');

  // Send message
  var message = {
    site: document.title
  };

  console.log('iframe', webvrAgent.iframe);
  window.proxy = proxy;
  window.webvrAgent = webvrAgent;

  proxy.postMessage(webvrAgent.iframe.contentWindow, message).then(res => {
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
