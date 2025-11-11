const STORAGE_KEY = "customShortcut";
const DEFAULT_SHORTCUT = { meta: false, ctrl: true, shift: true, alt: false, key: "k" };

const shortcutInput = document.getElementById("shortcutInput");
const statusLabel = document.getElementById("statusLabel");
const resetButton = document.getElementById("resetButton");

let currentShortcut = null;
let statusTimer = null;

init();

function init() {
  loadShortcut();
  shortcutInput.addEventListener("focus", () => shortcutInput.select());
  shortcutInput.addEventListener("keydown", handleShortcutKeydown);
  resetButton.addEventListener("click", () => {
    saveShortcut(DEFAULT_SHORTCUT).then(() => {
      updateShortcut(DEFAULT_SHORTCUT);
      showStatus("Atajo restablecido.");
    });
  });
}

function loadShortcut() {
  chrome.storage.local.get(STORAGE_KEY, data => {
    const raw = data[STORAGE_KEY] || DEFAULT_SHORTCUT;
    updateShortcut(raw);
  });
}

function handleShortcutKeydown(event) {
  event.preventDefault();
  if (event.key === "Tab") return;
  if (event.key === "Escape") {
    shortcutInput.blur();
    return;
  }

  const shortcut = createShortcutFromEvent(event);
  if (!shortcut) {
    showStatus("Selecciona al menos un modificador (Ctrl, Alt, Shift o Command).");
    return;
  }

  saveShortcut(shortcut).then(() => {
    updateShortcut(shortcut);
    showStatus("Atajo guardado.");
  });
}

function createShortcutFromEvent(event) {
  const key = normalizeKey(event.key);
  const modifiers = {
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey
  };

  const hasModifier = modifiers.meta || modifiers.ctrl || modifiers.shift || modifiers.alt;
  if (!hasModifier) return null;
  if (!key) return null;

  return {
    meta: modifiers.meta,
    ctrl: modifiers.ctrl,
    shift: modifiers.shift,
    alt: modifiers.alt,
    key
  };
}

function normalizeKey(key) {
  if (!key) return "";
  if (key.length === 1) return key.toLowerCase();
  const map = {
    "ArrowUp": "arrowup",
    "ArrowDown": "arrowdown",
    "ArrowLeft": "arrowleft",
    "ArrowRight": "arrowright",
    " ": "space",
    "Spacebar": "space",
    "Escape": "escape",
    "Enter": "enter"
  };
  return map[key] || key.toLowerCase();
}

function formatShortcut(shortcut) {
  if (!shortcut) return "";
  const parts = [];
  if (shortcut.meta) parts.push(navigator.platform.includes("Mac") ? "Command" : "Meta");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  parts.push(formatKeyName(shortcut.key));
  return parts.join(" + ").toUpperCase();
}

function formatKeyName(key) {
  const map = {
    arrowup: "Arrow Up",
    arrowdown: "Arrow Down",
    arrowleft: "Arrow Left",
    arrowright: "Arrow Right",
    space: "Space",
    enter: "Enter"
  };
  return (map[key] || key).toUpperCase();
}

function updateShortcut(shortcut) {
  currentShortcut = {
    meta: !!shortcut.meta,
    ctrl: !!shortcut.ctrl,
    shift: !!shortcut.shift,
    alt: !!shortcut.alt,
    key: typeof shortcut.key === "string" ? shortcut.key.toLowerCase() : DEFAULT_SHORTCUT.key
  };
  shortcutInput.value = formatShortcut(currentShortcut);
  resetButton.disabled = isSameShortcut(currentShortcut, DEFAULT_SHORTCUT);
}

function saveShortcut(shortcut) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: shortcut }, resolve);
  });
}

function showStatus(message) {
  window.clearTimeout(statusTimer);
  statusLabel.textContent = message;
  statusTimer = window.setTimeout(() => {
    statusLabel.textContent = "Selecciona el campo y presiona un atajo.";
  }, 4000);
}

function isSameShortcut(a, b) {
  return a.meta === b.meta && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.key === b.key;
}
