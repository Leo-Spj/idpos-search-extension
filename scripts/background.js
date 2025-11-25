import { STORAGE_ROUTES_KEY, CSV_PATH, parseCSV } from './utils.js';

const COMMAND_ID = "toggle-command-bar";
const STORAGE_METADATA_KEY = "navigatorMetadata";

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

// Migración automática de metadata
async function migrateMetadataIfNeeded() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY, STORAGE_METADATA_KEY]);
    const routes = stored[STORAGE_ROUTES_KEY] || [];
    const existingMetadata = stored[STORAGE_METADATA_KEY];
    
    // Si ya existe metadata, no hacer nada
    if (existingMetadata && existingMetadata.version) {
      console.log('Navigator: Metadata already exists');
      return;
    }
    
    // Si no hay rutas, no hay nada que migrar
    if (!routes.length) {
      console.log('Navigator: No routes to migrate');
      return;
    }
    
    console.log(`Navigator: Migrating metadata for ${routes.length} routes...`);
    
    // Crear metadata desde rutas existentes
    const metadata = {
      modulesUsage: {},
      tagsUsage: {},
      version: 1
    };
    
    routes.forEach(route => {
      const domain = (route.domain || '').replace(/^www\./, '');
      const module = route.module || 'General';
      const tagsString = route.tags || '';
      const tags = tagsString.split('|').map(t => t.trim()).filter(Boolean);
      
      if (!domain) return;
      
      // Inicializar dominio
      if (!metadata.modulesUsage[domain]) {
        metadata.modulesUsage[domain] = {};
      }
      if (!metadata.tagsUsage[domain]) {
        metadata.tagsUsage[domain] = {};
      }
      
      // Trackear módulo
      if (!metadata.modulesUsage[domain][module]) {
        metadata.modulesUsage[domain][module] = { count: 0, lastUsed: null };
      }
      metadata.modulesUsage[domain][module].count++;
      
      // Trackear tags
      tags.forEach(tag => {
        if (!tag) return;
        
        if (!metadata.tagsUsage[domain][tag]) {
          metadata.tagsUsage[domain][tag] = {
            count: 0,
            lastUsed: null,
            modules: []
          };
        }
        
        const tagData = metadata.tagsUsage[domain][tag];
        tagData.count++;
        
        if (!tagData.modules.includes(module)) {
          tagData.modules.push(module);
        }
      });
    });
    
    // Guardar metadata
    await chrome.storage.local.set({ [STORAGE_METADATA_KEY]: metadata });
    
    const totalDomains = Object.keys(metadata.modulesUsage).length;
    const totalModules = Object.values(metadata.modulesUsage)
      .reduce((sum, domainModules) => sum + Object.keys(domainModules).length, 0);
    const totalTags = Object.values(metadata.tagsUsage)
      .reduce((sum, domainTags) => sum + Object.keys(domainTags).length, 0);
    
    console.log(`Navigator: Metadata migrated - ${totalDomains} domains, ${totalModules} modules, ${totalTags} tags`);
    
  } catch (error) {
    console.error('Navigator: Error migrating metadata', error);
  }
}

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
    
    // Migrar metadata si es necesario
    await migrateMetadataIfNeeded();
    
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

// Manejar mensajes de runtime para edición de rutas
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EDIT_ROUTE' && message.routeId) {
    // Almacenar el ID de la ruta a editar en storage temporal
    chrome.storage.local.set({ pendingEditRouteId: message.routeId });
  }
});

