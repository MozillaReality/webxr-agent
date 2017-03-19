import ext from './utils/ext';
import storage from './utils/storage';

var popup = document.getElementById('app');

storage.get('color', resp => {
  var color = resp.color;
  if (color) {
    popup.style.backgroundColor = color;
  }
});

var template = data => {
  var json = JSON.stringify(data);
  return (`
  <header class="site-description">
    <h3 class="title">${data.title}</h3>
    <p class="description">${data.description}</p>
    <a href="${data.url}" target="_blank" class="url">${data.url}</a>
  </header>
  <footer class="action-container">
    <button data-bookmark='${json}' id="save-btn" class="btn btn-primary">Save</button>
  </footer>
  `);
};

var renderMessage = message => {
  var displayContainer = document.getElementById('display-container');
  displayContainer.innerHTML = `<p class='message'>${message}</p>`;
};

var renderBookmark = data => {
  if (data) {
    var tmpl = template(data);
    var displayContainer = document.getElementById('display-container');
    displayContainer.innerHTML = tmpl;
  } else {
    // If the extension reloaded (e.g., in local development),
    // but the previously active tab was reloaded but not the currently active tab,
    // reload the tab.
    ext.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      var activeTab = tabs[0];
      if (!activeTab) {
        return;
      }
      ext.tabs.reload(activeTab.id, {}, () => {
        // TODO: Fix so pop-up menu reopens.
        // window.close();
        ext.runtime.postMessage({action: 'open-popup'}, response => {
          console.log('[popup] Response from `open-popup` message:', response);
        })
      });
    });

    renderMessage("Sorry, could not extract this page's title and URL");
  }
};

ext.tabs.query({
  active: true,
  currentWindow: true
}, tabs => {
  var activeTab = tabs[0];
  if (!activeTab) {
    return;
  }
  ext.tabs.sendMessage(activeTab.id, {action: 'process-page'}, renderBookmark);
});

popup.addEventListener('click', evt => {
  if (evt.target && evt.target.matches && evt.target.matches('#save-btn')) {
    evt.preventDefault();
    var data = evt.target.getAttribute('data-bookmark');
    ext.runtime.sendMessage({action: 'perform-save', data: data}, response => {
      console.log('response', response);
      if (response && response.action === 'saved') {
        renderMessage('Your bookmark was saved successfully!');
      } else {
        renderMessage('Sorry, there was an error while saving your bookmark.');
      }
    })
  }
});

var optionsLink = document.querySelector('.js-options');
if (optionsLink) {
  optionsLink.addEventListener('click', evt => {
    evt.preventDefault();
    ext.tabs.create({url: ext.extension.getURL('options.html')});
  });
}
