import ext from './utils/ext';

ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'perform-save') {
    console.log('Extension Type: ', '/* @echo extension */');
    console.log('PERFORM AJAX', request.data);

    sendResponse({action: 'saved'});
  }
  console.log('request', request);
});

// If the extension reloads (e.g., in local development), reload the tab.
ext.tabs.query({
  active: true,
  currentWindow: true
}, tabs => {
  var activeTab = tabs[0];
  if (!activeTab) {
    return;
  }
  ext.tabs.reload(activeTab.id);
});

// ext.tabs.onUpdated.addListener(() => {
// });
