import { STORAGE_ROUTES_KEY, CSV_PATH, parseCSV } from './utils.js';

const COMMAND_ID = "toggle-command-bar";

// Manejar comandos de teclado
chrome.commands.onCommand.addListener(async command => {
  if (command !== COMMAND_ID) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
});

// Manejar click en el icono de la extensión
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
});

// Inicializar configuración por defecto
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY, "customShortcut"]);
    
    // Establecer atajo predeterminado si no existe
    if (!stored.customShortcut) {
      await chrome.storage.local.set({ 
        customShortcut: { meta: false, ctrl: true, shift: true, alt: false, key: "k" } 
      });
    }
    
    // Si no hay rutas, cargar las predeterminadas desde el CSV
    if (!stored[STORAGE_ROUTES_KEY] || stored[STORAGE_ROUTES_KEY].length === 0) {
      await loadDefaultRoutes();
    }
  } catch (error) {
    console.warn("Navigator: unable to seed default configuration", error);
  }
});

async function loadDefaultRoutes() {
  try {
    const csvUrl = chrome.runtime.getURL(CSV_PATH);
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    const routes = parseCSV(csvText);
    
    if (routes.length > 0) {
      await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes });
      console.log(`Navigator: Loaded ${routes.length} default routes`);
    }
  } catch (error) {
    console.warn("Navigator: unable to load default routes", error);
  }
}

