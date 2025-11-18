// Módulo auxiliar para carga de rutas desde CSV
const STORAGE_ROUTES_KEY = "navigatorRoutes";
const CSV_DATA_URL = chrome.runtime.getURL("data/routes.csv");

export async function loadRoutesForDomain(domain, usageMap = new Map()) {
  try {
    // Intentar cargar desde storage primero
    const stored = await chrome.storage.local.get(STORAGE_ROUTES_KEY);
    let routes = stored[STORAGE_ROUTES_KEY] || [];
    
    // Si no hay rutas en storage, cargar desde CSV por defecto
    if (routes.length === 0) {
      routes = await loadDefaultCSV();
      await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes });
    }
    
    // Filtrar por dominio actual
    const domainRoutes = routes.filter(route => route.domain === domain);
    
    // Convertir a formato de nodos
    const nodes = domainRoutes.map(route => ({
      id: route.id,
      title: route.title,
      titleLower: removeAccents(String(route.title || "").toLowerCase()),
      module: route.module,
      description: route.description || "",
      tag: Array.isArray(route.tag) ? route.tag : (route.tag ? String(route.tag).split("|").filter(t => t.trim()) : []),
      tagLower: removeAccents((Array.isArray(route.tag) ? route.tag.join(" ") : String(route.tag || "").replace(/\|/g, " ")).toLowerCase()),
      pathLabel: Array.isArray(route.tag) ? route.tag.join(" · ") : String(route.tag || "").replace(/\|/g, " · "),
      url: route.url.startsWith("http") ? route.url : `${window.location.protocol}//${domain}${route.url}`,
      action: "navigate",
      source: "static",
      usage: usageMap.get(route.id) || 0,
      depth: Array.isArray(route.tag) ? route.tag.length - 1 : (route.tag ? String(route.tag).split("|").length - 1 : 0),
      status: route.status || "active"
    }));
    
    return nodes;
  } catch (error) {
    console.warn("Navigator: failed to load routes", error);
    return [];
  }
}

async function loadDefaultCSV() {
  try {
    const response = await fetch(CSV_DATA_URL);
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.warn("Navigator: failed to load default CSV", error);
    return [];
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

function removeAccents(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
