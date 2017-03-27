const apis = [
  'alarms',
  'bookmarks',
  'browserAction',
  'commands',
  'contextMenus',
  'cookies',
  'downloads',
  'events',
  'extension',
  'extensionTypes',
  'history',
  'i18n',
  'idle',
  'notifications',
  'pageAction',
  'runtime',
  'storage',
  'tabs',
  'webNavigation',
  'webRequest',
  'windows',
];

function Extension () {
  const self = this;

  apis.forEach(api => {
    self[api] = null;

    try {
      if (chrome[api]) {
        self[api] = chrome[api];
      }
    } catch (e) {}

    try {
      if (window[api]) {
        self[api] = window[api];
      }
    } catch (e) {}

    try {
      if (browser[api]) {
        self[api] = browser[api];
      }
    } catch (e) {}

    try {
      self.api = browser.extension[api];
    } catch (e) {}
  })

  try {
    if (browser && browser.runtime) {
      this.runtime = browser.runtime;
    }
  } catch (e) {}

  try {
    if (browser && browser.browserAction) {
      this.browserAction = browser.browserAction;
    }
  } catch (e) {}
}

module.exports = new Extension();
