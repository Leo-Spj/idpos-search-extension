const COMMAND_ID = "toggle-command-bar";

chrome.commands.onCommand.addListener(async command => {
  if (command !== COMMAND_ID) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ customShortcut: null }).then(store => {
    if (store.customShortcut) return;
    return chrome.storage.local.set({ customShortcut: { meta: false, ctrl: true, shift: true, alt: false, key: "k" } });
  }).catch(error => {
    console.warn("IDPOS Navigator: unable to seed default shortcut", error);
  });
});
