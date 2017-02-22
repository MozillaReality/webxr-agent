/* jshint esversion: 6 */
/* eslint-env es6 */
/* global Primus */

var ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var WEBVR_AGENT_ORIGIN = 'http://10.0.1.59:4040';
var WEBVR_AGENT_ORIGIN_PROD = 'https://agent.webvr.rocks';
var IS_PROD = WEBVR_AGENT_ORIGIN === WEBVR_AGENT_ORIGIN_PROD;

import WindowPostMessageProxy from 'window-post-message-proxy';

import feathersClient from 'feathers-client';
import Primus from 'primus';

var URI_ORIGIN = window.location.origin || (window.location.protocol + '//' + window.location.host);
var URI_REALTIME_API = URI_ORIGIN;

var $ = document.querySelector.bind(document);  // eslint-disable-line id-length

if (IS_PROD && 'serviceWorker' in navigator) {
  // Check if the application is installed by checking the controller.
  // If there is a Service Worker controlling this page, then let's
  // assume the application is installed.
  navigator.serviceWorker.getRegistration().then(registration => {
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

// function resizeIframe () {
//   if (window.parent !== window) {
//     window.parent.postMessage({
//       type: 'response',
//       data: {
//         action: 'iframeresize',
//         height: document.documentElement.getClientRects()[0].height
//       }
//     });
//   }
// }

function executeScript (src) {
  return new Promise(function (resolve, reject) {
    var script = document.createElement('script');
    script.src = src;
    script.async = script.defer = true;
    script.addEventListener('load', function () {
      resolve(script);
    });
    script.addEventListener('load', function (err) {
      reject(err);
    });
    document.head.appendChild(script);
    // document.head.removeChild(script);
  });
}

window.addEventListener('load', function () {
  var proxy = new WindowPostMessageProxy.WindowPostMessageProxy({
    name: ORIGIN,
    // logMessages: !IS_PROD
    logMessages: false
  });

  var store = {};

  proxy.postMessage(window.top, {type: 'xxx'}).then(res => {
    console.log('response', res);
  });

  // var socket = new Primus(URI_REALTIME_API);
  // var app = feathers()
  //   .configure(feathers.hooks())
  //   .configure(feathers.primus(socket));

  // socket.on('unauthorized', function (error) {
  //   console.error('Socket authentication request failed:', err);
  // });

  // socket.on('close', function (err) {
  //   console.error('Socket disconnected:', err);
  // });

  // socket.on('open', function () {
  //   console.log('Socket connected');
  // });

  // // After successful authentication, find restricted messages.
  // socket.send('messages::find', function (err, result) {
  //   if (err) {
  //     console.log('Error finding messages:', err);
  //     return;
  //   }
  //   console.log('Messages:', result);
  // });

  // socket.send('authenticate', {example: 'Hey, there!'});

  // var messageService = app.service('messages');

  // messageService.find().then(function (result) {
  //   console.log('Messages', result);
  // }).catch(function (err) {
  //   console.log('Error finding messages', err);
  // });

  // messageService.create({
  //   text: 'Message from client'
  // });
});
