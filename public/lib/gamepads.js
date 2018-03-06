/* global CustomEvent, localStorage, module */

/*

// Sample usage:

window.addEventListener('gamepad.buttonvaluechange', function (e) {
  console.log('[%s]', window.performance.now().toFixed(3), e.type, '• Gamepad', e.gamepad, '• Button', e.button);
});

window.addEventListener('gamepad.buttondown', function (e) {
  console.log('[%s]', window.performance.now().toFixed(3), e.type, '• Gamepad', e.gamepad, '• Button', e.button);
});

window.addEventListener('gamepad.buttonup', function (e) {
  console.log('[%s]', window.performance.now().toFixed(3), e.type, '• Gamepad', e.gamepad, '• Button', e.button);
});

window.addEventListener('gamepad.buttondown.oculusremote.b0', function (e) {
  console.log('[%s]', window.performance.now().toFixed(3), e.type, '• Gamepad', e.gamepad, '• Button', e.button);
});

*/

var SETTINGS = {
  urls: {
    root: 'https://webvrrocks.github.io/webxr-lobby/'
  }
};

var DEFAULTS = {
  autostart: true,
  buttonThreshold: 0.1,
  emitEventsOnWindow: true,
  postMessageEventsOn: null,
  mappings: {
    'Oculus Remote': {
      'b0': 'center',
      'b1': 'back',
      'b2': 'up',
      'b3': 'down',
      'b5': 'right',
      'b4': 'left'
    }
  }
};

function slugify (str) {
  return (str || '').toLowerCase().replace(/[^\w]/g, '').replace(/\(.+\)/, '');
}

function formatEvent (name, detail) {
  var event = new CustomEvent(name, {detail: detail});
  Object.keys(detail).forEach(function (key) {
    event[key] = detail[key];
  });
  return event;
}

function Gamepads (settings) {
  var self = this;
  this.supported = window.requestAnimationFrame && navigator.getGamepads;

  if (typeof settings === 'string') {
    this.settings = {select: settings};
  } else {
    this.settings = settings || {};
  }

  this.start = function () {
    if (navigator.getGamepads()[0]) {
      startLoop();
    } else {
      window.addEventListener('gamepadconnected', startLoop);
    }
  };

  this.stop = function () {
    window.removeEventListener('gamepadconnected', startLoop);
    window.cancelAnimationFrame(this.raf);
  };

  this.DEFAULTS = DEFAULTS;

  if (this.supported) {
    this.settings.mappings = Object.assign({}, DEFAULTS.mappings, this.settings.mappings);
    this.settings = Object.assign({}, DEFAULTS, this.settings);

    this.state = {};
    this.previousState = {};

    // In Firefox Nightly and Chromium builds, you must first query the VR
    // devices for Gamepads to be exposed.
    if (navigator.vr && navigator.vr.getDisplays) {
      navigator.vr.getDisplays()
        .then(function () {})
        .catch(console.error.bind(console));
    }
    if (navigator.getVRDisplays) {
      navigator.getVRDisplays()
        .then(function () {})
        .catch(console.error.bind(console));
    }

    if (this.settings.autostart) {
      this.start();
    }
  }

  function loop () {
    self.poll();
    self.raf = window.requestAnimationFrame(loop);
  }

  function startLoop () {
    self.raf = window.requestAnimationFrame(loop);
    window.removeEventListener('gamepadconnected', startLoop);
  }
}

Gamepads.prototype.poll = function () {
  var self = this;
  if (!this.supported) { return; }
  this.gamepads = navigator.getGamepads();
  var gp;
  var btn;
  var btnState;
  var len;
  var previousBtnState;

  for (var i = 0; i < navigator.getGamepads().length; ++i) {
    gp = navigator.getGamepads()[i];
    if (!gp) { continue; }
    if (this.select && this.select !== gp.id) { continue; }
    this.state[gp.id] = {};
    if (!this.previousState[gp.id]) {
      this.previousState[gp.id] = {};
    }
    if (gp.buttons) {
      len = gp.buttons.length;
      for (var j = 0; j < len; ++j) {
        btn = gp.buttons[j];

        previousBtnState = this.previousState[gp.id]['b' + j] = this.previousState[gp.id]['b' + j] || {
          gamepad: {
            index: i,
            id: gp.id
          },
          button: {
            index: j,
            value: 0,
            pressed: false,
            name: this.buttonName(gp, j),
            count: 0
          }
        };

        btnState = this.state[gp.id]['b' + j] = {
          gamepad: {
            index: gp.index,
            id: gp.id
          },
          button: {
            index: j,
            value: this.buttonValue(btn),
            pressed: this.buttonPressed(btn),
            name: this.buttonName(gp, j),
            count: previousBtnState.button.count
          }
        };

        if (previousBtnState.button.value !== btnState.button.value) {
          emitEvent(['gamepad.buttonvaluechange', btnState]);
        }

        if (previousBtnState.button.pressed && btnState.button.pressed) {
          this.state[gp.id]['b' + j].button.count++;
          if (this.state[gp.id]['b' + j].button.count >= 50) {
            emitEvent(['gamepad.buttonhold', btnState]);
            this.state[gp.id]['b' + j].button.count = 0;
          }
        }

        if (!previousBtnState.button.pressed && btnState.button.pressed) {
          this.state[gp.id]['b' + j].button.count = 0;
          emitEvent(['gamepad.buttondown', btnState]);
        }

        if (previousBtnState.button.pressed && !btnState.button.pressed) {
          emitEvent(['gamepad.buttonup', btnState]);
          this.state[gp.id]['b' + j].button.count = 0;
        }
      }
    }
  }

  function emitEvent (eventToEmit) {
    var name = eventToEmit[0];
    var detail = Object.assign({}, eventToEmit[1]);

    if (detail.button && detail.button.count) {
      // TODO: Actually store timestamps and compare.
      detail.button.seconds = Math.ceil(detail.button.count / 30);
    }

    // Emit `gamepad.buttondown`, for example.
    self.emit(formatEvent(name, detail));

    name += '.' + self.gamepadSlug(detail.gamepad);

    // Emit `gamepad.buttondown.oculusremote`, for example.
    self.emit(formatEvent(name, detail));

    if (detail.button) {
      // Emit `gamepad.buttondown.oculusremote.b1`, for example.
      self.emit(formatEvent(name + '.b' + detail.button.index, detail));

      if (detail.button.name) {
        // Emit `gamepad.buttondown.oculusremote.back`, for example.
        self.emit(formatEvent(name + '.' + detail.button.name, detail));
      }
    }
  }

  this.previousState = Object.assign({}, this.state);
};

Gamepads.prototype.buttonValue = function (btn) {
  if (!this.supported) { return 0; }
  return typeof btn === 'number' ? btn : btn.value;
};

Gamepads.prototype.buttonPressed = function (btn) {
  if (!this.supported) { return false; }
  return (typeof btn === 'number' ? btn : btn.value) > this.settings.buttonThreshold;
};

Gamepads.prototype.buttonName = function (gp, btnIndex) {
  if (!this.supported) { return; }
  return this.settings.mappings[gp.id] && this.settings.mappings[gp.id]['b' + btnIndex];
};

Gamepads.prototype.gamepadSlug = function (gp) {
  if (!this.supported) { return ''; }
  return slugify(gp.id);
};

Gamepads.prototype.emit = function (event) {
  if (!this.supported) { return; }
  if (this.settings.emitEventsOnWindow) {
    console.log('gamepad', event);
    window.dispatchEvent(event);
  }
  if (this.settings.postMessageEventsOn) {
    var el = this.settings.postMessageEventsOn;
    if (typeof el === 'string') {
      el = document.querySelector(this.settings.postMessageEventsOn);
    }
    if (el) {
      el.postMessage({type: 'event', data: {type: event.type, detail: event}}, '*');
    }
  }
};

// if (typeof define === 'function' && define.amd) {
//   define('GAMEPADS', GAMEPADS);
// } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
//   module.exports = GAMEPADS;
// } else if (window) {
//   window.GAMEPADS = GAMEPADS;
// }

// 'use strict';

function toArray (obj) {
  return Array.prototype.slice.apply(obj);
}

function $ (selector, parent) {
  parent = parent || document;
  return parent.querySelector(selector);
}

function $$ (selector, parent) {
  parent = parent || document;
  return toArray(parent.querySelectorAll(selector));
}

window.addEventListener('keypress', function (e) {
  if (e.keyCode === 112) {  // `P`
    sounds.toggle();
  }
});

function Sounds () {
  var self = this;

  self.muted = false;

  self.toggle = function () {
    if (self.muted) {
      self.play();
    } else {
      self.stop();
    }
  };

  self.playEl = function (el) {
    el.components.sound.sound.autoplay = el.components.sound.sound._autoplay;
    el.components.sound.sound.src = el.components.sound.sound._src;
    el.components.sound.play();
  };

  self.stopEl = function (el) {
    el.components.sound.pause();
    el.components.sound.sound._autoplay = el.components.sound.sound._autoplay;
    el.components.sound.sound.autoplay = false;
    el.components.sound.sound._src = el.components.sound.sound.src;
    el.components.sound.sound.src = '';
  };

  self.play = function () {
    self.muted = false;
    self.remember();
    $$('a-scene [sound]').forEach(self.playEl);
  };

  self.stop = function () {
    self.muted = true;
    self.remember();
    $$('a-scene [sound]').forEach(self.stopEl);
  };

  self.remember = function () {
    try {
      localStorage.audioMuted = self.muted ? 'true' : 'false';
    } catch (e) {
    }
  };

  self.muteOnLoad = function () {
    try {
      return localStorage.audioMuted === 'true';
    } catch (e) {
      return null;
    }
  };

  if (self.muteOnLoad()) {
    self.stop();
  }
}

var sounds = new Sounds();

window.addEventListener('gamepad.buttonhold.oculusremote.center', function () {
  window.location.reload();
});

window.addEventListener('gamepad.buttonhold.oculusremote.back', function () {
  window.location.href = SETTINGS.urls.root;
});

window.addEventListener('gamepad.buttonhold.oculusremote.left', function () {
  window.history.back();
});

window.addEventListener('gamepad.buttonhold.oculusremote.right', function () {
  window.history.forward();
});

window.addEventListener('gamepad.buttondown.oculustouchleft', function (evt) {
  console.log('gamepad oculus touch (left)', evt);
});

window.addEventListener('gamepad.buttondown.oculustouchright', function (evt) {
  console.log('gamepad oculus touch (right)', evt);
});

window.addEventListener('gamepad.buttondown.oculusremote.center', fire('mousedown'));
window.addEventListener('gamepad.buttonup.oculusremote.center', fire('mouseup'));
window.addEventListener('gamepad.buttonup.oculusremote.center', fire('click'));

window.addEventListener('gamepad.buttondown.oculusremote.center', fire('cursor-mousedown'));
window.addEventListener('gamepad.buttonup.oculusremote.center', fire('cursor-mouseup'));
window.addEventListener('gamepad.buttonup.oculusremote.center', fire('cursor-click'));

window.addEventListener('gamepad.buttondown.oculusremote.up', fireKey('down', 'w'));
window.addEventListener('gamepad.buttonup.oculusremote.up', fireKey('up', 'w'));

window.addEventListener('gamepad.buttondown.oculusremote.left', fireKey('down', 'a'));
window.addEventListener('gamepad.buttonup.oculusremote.left', fireKey('up', 'a'));

window.addEventListener('gamepad.buttondown.oculusremote.right', fireKey('down', 'd'));
window.addEventListener('gamepad.buttonup.oculusremote.right', fireKey('up', 'd'));

window.addEventListener('gamepad.buttondown.oculusremote.down', fireKey('down', 's'));
window.addEventListener('gamepad.buttonup.oculusremote.down', fireKey('up', 's'));

function fireKey (keyEventNameSuffix, key) {
  var keyUpper = key.toUpperCase();
  return function () {
    var e = new CustomEvent('key' + keyEventNameSuffix, {bubbles: true});
    e.keyCode = e.key = keyUpper.charCodeAt(0);
    document.body.dispatchEvent(e);
  };
}

function fire (eventName) {
  return function () {
    var e = new CustomEvent(eventName, {bubbles: true});
    var target = $('a-scene canvas') || document.body;
    target.dispatchEvent(e);
  };
}

var GAMEPADS = new Gamepads(window.GAMEPADS_SETTINGS);

module.exports = GAMEPADS;
