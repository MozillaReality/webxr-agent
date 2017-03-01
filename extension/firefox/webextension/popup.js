browser.storage.local.get().then(results => {
  let panelContent = document.querySelector('#panel-content');
  panelContent.textContent = JSON.stringify(results, null, 2);
});
