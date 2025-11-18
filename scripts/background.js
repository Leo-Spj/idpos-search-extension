const COMMAND_ID = "toggle-command-bar";
const STORAGE_ROUTES_KEY = "navigatorRoutes";

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
    const csvUrl = chrome.runtime.getURL("data/routes-example-social.csv");
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

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return [];
  
  const routes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 8) continue;
    
    const route = {
      domain: values[0] || "",
      id: values[1] || "",
      module: values[2] || "",
      title: values[3] || "",
      url: values[4] || "",
      tag: values[5] ? values[5].replace(/^"|"$/g, "").split("|").filter(t => t.trim()) : [],
      description: values[6] || "",
      status: values[7] || "active"
    };
    
    if (route.domain && route.id && route.title) {
      routes.push(route);
    }
  }
  
  return routes;
}

function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}
