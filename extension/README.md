# WebVR Agent Extension

Helper for presenting and navigating WebVR experiences.


## Installation

1. Clone this parent repository: `mkdir -p webvrrocks && cd webvrrocks && git clone https://github.com/webvrrocks/webvr-agent && cd webvr-agent/extension`
2. Run `npm install` to install the Node dependencies.
3. Run `npm run build` to build the extension.

Alternately, if you want to try out a built version of the extension, the download links are below. After you download it, unzip the file and load it in your browser using the steps mentioned below.

- [**Download Firefox Extension**](https://github.com/webvrrocks/webvr-agent/releases/download/v1.0/webvr-agent-extension-firefox.zip)
- [**Download Chrome Extension**](https://github.com/webvrrocks/webvr-agent/releases/download/v1.0/webvr-agent-extension-chrome.zip)
- [**Download Opera Extension**](https://github.com/webvrrocks/webvr-agent/releases/download/v1.0/webvr-agent-extension-opera.zip)


#### Load the extension in Firefox

1. Open Firefox, and type `about://debugging` in the address bar.
2. Click the "Load Temporary Add-on" button.
3. From the file browser, open `webvr-agent/extension/build/firefox`, and **select the `manifest.json` file**.


### Load the extension in Chrome and Opera

1. Open Chrome/Opera, and type `chrome://extensions` in the address bar.
2. Check the "Developer Mode" checkbox.
3. Click on the "Load unpacked extension…" button that appears.
4. From the file browser, select as the directory `webvr-agent/extension/build/chrome` or (`webvr-agent/extension/build/opera`)


## Developing

The following tasks can be used when you want to start developing the extension and enable live reload:

- `npm run firefox-watch`
- `npm run chrome-watch`
- `npm run opera-watch`


## Packaging

Run `npm run dist` to create a ZIP'd, production-ready extension for each browser. You can then upload that to their respective extension/app stores.
