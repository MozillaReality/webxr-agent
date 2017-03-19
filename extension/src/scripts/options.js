import ext from './utils/ext';
import storage from './utils/storage';

// Handle L10n and i18n.
let l10nElMessage = '';
Array.prototype.forEach.call(document.querySelectorAll('[data-l10n-id]'), el => {
  l10nElMessage = chrome.i18n.getMessage(el.getAttribute('data-l10n-id'));
  if (l10nElMessage) {
    el.textContent = l10nElMessage;
  }
});
let l10nTitleMessageName = document.documentElement.getAttribute('data-l10n-id-title');
if (l10nTitleMessageName) {
  let l10nTitleMessage = chrome.i18n.getMessage(l10nTitleMessageName);
  if (l10nTitleMessage) {
    if (document.title.indexOf('•') > -1) {
      document.title = document.title.replace(/([^•]+)•(.*)/, l10nTitleMessage + ' • $2');
    } else {
      document.title = l10nTitleMessage;
    }
  }
}

let colorSelectors = document.querySelectorAll('.js-radio');

let setColor = color => {
  document.body.style.backgroundColor = color;
};

storage.get('color', resp => {
  let color = resp.color;
  let option;
  if (color) {
    option = document.querySelector(`.js-radio.${color}`);
    setColor(color);
  } else {
    option = colorSelectors[0]
  }

  option.setAttribute('checked', '');
});

colorSelectors.forEach(el => {
  el.addEventListener('click', () => {
    let value = el.value;
    storage.set({color: value}, () => {
      setColor(value);
    });
  });
});
