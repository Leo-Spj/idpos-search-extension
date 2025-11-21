// Módulo auxiliar para carga de rutas desde CSV
import { STORAGE_ROUTES_KEY, CSV_PATH, parseCSV, removeAccents } from './utils.js';

const CSV_DATA_URL = chrome.runtime.getURL(CSV_PATH);

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
      tag: Array.isArray(route.tags) ? route.tags : (route.tags ? String(route.tags).split("|").filter(t => t.trim()) : []),
      tagLower: removeAccents((Array.isArray(route.tags) ? route.tags.join(" ") : String(route.tags || "").replace(/\|/g, " ")).toLowerCase()),
      pathLabel: Array.isArray(route.tags) ? route.tags.join(" · ") : String(route.tags || "").replace(/\|/g, " · "),
      url: route.url.startsWith("http") ? route.url : `${window.location.protocol}//${domain}${route.url}`,
      action: "navigate",
      source: "static",
      usage: usageMap.get(route.id) || 0,
      depth: Array.isArray(route.tags) ? route.tags.length - 1 : (route.tags ? String(route.tags).split("|").length - 1 : 0),
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

