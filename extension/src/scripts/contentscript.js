import ext from './utils/ext';

const DISPLAY_DESCRIPTION = false;
const DISPLAY_TITLE = true;

var extractTags = () => {
  var url = document.location.href;

  if (!url || !url.match(/^https?:/)) {
    return;
  }

  var data = {
    title: '',
    description: '',
    url: url
  };

  // TODO: Source information from Web-App Manifest.

  if (DISPLAY_TITLE) {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var twitterTitle = document.querySelector('meta[property="twitter:title"]');
    var title = twitterTitle || ogTitle;
    data.title = title ? title.getAttribute('content') : (document.title || document.origin);
  }

  if (DISPLAY_DESCRIPTION) {
    var ogDescription = document.querySelector('meta[property="og:description"]');
    var twitterDescription = document.querySelector('meta[property="twitter:description"]');
    var description = twitterDescription || ogDescription || document.querySelector('meta[name="description"]');
    if (description) {
      data.description = description.getAttribute('content');
    }
  }

  return data;
};

function onRequest (request, sender, sendResponse) {
  console.log(request, sender, request.action);
  if (request.action === 'process-page') {
    sendResponse(extractTags());
  }
}

ext.runtime.onMessage.addListener(onRequest);
