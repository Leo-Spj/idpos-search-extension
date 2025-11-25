// Constantes
const STORAGE_ROUTES_KEY = "navigatorRoutes";
const STORAGE_METADATA_KEY = "navigatorMetadata"; // Nuevo: tracking de uso
const CSV_HEADERS = ['domain', 'id', 'module', 'title', 'url', 'tags', 'description', 'status', 'shortcut'];
let cachedRoutes = [];
let cachedMetadata = null; // Caché para metadata de uso
let currentShortcutRecorder = null; // Instancia del grabador de atajos

// ============================================
// FUNCIONES DE ATAJO DE TECLADO
// ============================================

// Serializar shortcut a string para almacenamiento/comparación
function serializeShortcut(shortcut) {
  if (!shortcut || !shortcut.key) return '';
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.alt) parts.push('alt');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.meta) parts.push('meta');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

// Deserializar string a objeto shortcut
function deserializeShortcut(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.toLowerCase().split('+');
  if (parts.length === 0) return null;
  
  return {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta'),
    key: parts[parts.length - 1]
  };
}

// Formatear shortcut para mostrar al usuario
function formatShortcutDisplay(shortcut) {
  if (!shortcut || !shortcut.key) return '';
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts = [];
  
  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');
  
  let keyDisplay = shortcut.key.toUpperCase();
  parts.push(keyDisplay);
  
  return parts.join(isMac ? '' : ' + ');
}

// Teclas reservadas
const RESERVED_SHORTCUTS = new Set([
  'ctrl+t', 'ctrl+w', 'ctrl+n', 'ctrl+shift+n', 'ctrl+tab', 'ctrl+shift+tab',
  'ctrl+l', 'ctrl+d', 'ctrl+h', 'ctrl+j', 'ctrl+p', 'ctrl+s', 'ctrl+o',
  'ctrl+f', 'ctrl+g', 'ctrl+u', 'ctrl+shift+i', 'ctrl+shift+j', 'ctrl+shift+c',
  'alt+f4', 'alt+tab', 'meta+w', 'meta+t', 'meta+n', 'meta+q', 'meta+tab',
  'f1', 'f3', 'f5', 'f6', 'f7', 'f11', 'f12'
]);

function isShortcutReserved(shortcut) {
  return RESERVED_SHORTCUTS.has(serializeShortcut(shortcut));
}

// Verificar conflictos de atajo
function findShortcutConflict(shortcut, currentDomain, excludeRouteId = null) {
  if (!shortcut || !shortcut.key) return null;
  
  const serialized = serializeShortcut(shortcut);
  const normalizedDomain = normalizeDomain(currentDomain);
  
  return cachedRoutes.find(route => {
    if (excludeRouteId && route.id === excludeRouteId) return false;
    if (normalizeDomain(route.domain || '') !== normalizedDomain) return false;
    if (!route.shortcut) return false;
    
    const routeShortcut = typeof route.shortcut === 'string' 
      ? deserializeShortcut(route.shortcut) 
      : route.shortcut;
    
    return serializeShortcut(routeShortcut) === serialized;
  });
}

// Sugerir atajos disponibles
function suggestAvailableShortcuts(domain) {
  const normalizedDomain = normalizeDomain(domain);
  const usedShortcuts = new Set();
  
  cachedRoutes.forEach(route => {
    if (normalizeDomain(route.domain || '') === normalizedDomain && route.shortcut) {
      const shortcut = typeof route.shortcut === 'string' 
        ? deserializeShortcut(route.shortcut) 
        : route.shortcut;
      if (shortcut) {
        usedShortcuts.add(serializeShortcut(shortcut));
      }
    }
  });
  
  const suggestions = [];
  
  // Sugerir Alt+1 a Alt+9
  for (let i = 1; i <= 9; i++) {
    const shortcut = { ctrl: false, alt: true, shift: false, meta: false, key: i.toString() };
    if (!usedShortcuts.has(serializeShortcut(shortcut))) {
      suggestions.push(shortcut);
    }
  }
  
  return suggestions.slice(0, 5);
}

// Renderizar sugerencias de atajos
function renderShortcutSuggestions(domain) {
  const container = document.getElementById('shortcutSuggestions');
  if (!container) return;
  
  const suggestions = suggestAvailableShortcuts(domain);
  container.innerHTML = '';
  
  if (suggestions.length === 0) {
    container.innerHTML = '<span style="font-size: 11px; opacity: 0.6;">Todos los atajos Alt+1 a Alt+9 están en uso</span>';
    return;
  }
  
  suggestions.forEach(shortcut => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shortcut-suggestion';
    btn.textContent = formatShortcutDisplay(shortcut);
    btn.addEventListener('click', () => {
      if (currentShortcutRecorder) {
        currentShortcutRecorder.currentShortcut = shortcut;
        document.getElementById('shortcutDisplay').textContent = formatShortcutDisplay(shortcut);
      }
    });
    container.appendChild(btn);
  });
}

// Inicializar grabador de atajos
function initShortcutRecorder(domain, excludeRouteId = null) {
  const recordButton = document.getElementById('routeShortcut');
  const displayElement = document.getElementById('shortcutDisplay');
  const displayWrapper = document.getElementById('shortcutDisplayWrapper');
  const clearButton = document.getElementById('clearShortcutBtn');
  
  if (!recordButton || !displayElement) return;
  
  // Cleanup previo
  if (currentShortcutRecorder) {
    currentShortcutRecorder.currentShortcut = null;
    currentShortcutRecorder.isRecording = false;
  }
  
  currentShortcutRecorder = {
    currentShortcut: null,
    isRecording: false,
    domain: domain,
    excludeRouteId: excludeRouteId
  };
  
  // Actualizar estado visual inicial
  updateShortcutDisplay();
  
  // Remover listeners previos clonando el botón
  const newRecordButton = recordButton.cloneNode(true);
  recordButton.parentNode.replaceChild(newRecordButton, recordButton);
  
  const newClearButton = clearButton.cloneNode(true);
  clearButton.parentNode.replaceChild(newClearButton, clearButton);
  
  // Click en botón de grabar
  newRecordButton.addEventListener('click', function(e) {
    e.preventDefault();
    
    if (currentShortcutRecorder.isRecording) {
      // Cancelar grabación
      stopRecording();
    } else {
      // Iniciar grabación
      startRecording();
    }
  });
  
  // Click en botón de limpiar
  newClearButton.addEventListener('click', function(e) {
    e.preventDefault();
    currentShortcutRecorder.currentShortcut = null;
    updateShortcutDisplay();
  });
  
  // Renderizar sugerencias
  renderShortcutSuggestions(domain);
}

function startRecording() {
  if (!currentShortcutRecorder) return;
  
  currentShortcutRecorder.isRecording = true;
  
  const recordButton = document.getElementById('routeShortcut');
  const displayElement = document.getElementById('shortcutDisplay');
  
  if (recordButton) {
    recordButton.classList.add('recording');
    recordButton.innerHTML = '<span class="icon">⏹️</span><span>Cancelar</span>';
  }
  
  if (displayElement) {
    displayElement.textContent = '⌨️ Presiona tu combinación de teclas...';
    displayElement.classList.add('recording');
  }
  
  // Listener global para capturar teclas
  document.addEventListener('keydown', handleShortcutKeydown);
}

function stopRecording() {
  if (!currentShortcutRecorder) return;
  
  currentShortcutRecorder.isRecording = false;
  
  const recordButton = document.getElementById('routeShortcut');
  const displayElement = document.getElementById('shortcutDisplay');
  
  if (recordButton) {
    recordButton.classList.remove('recording');
    recordButton.innerHTML = '<span class="icon">⌨️</span><span>Grabar atajo</span>';
  }
  
  if (displayElement) {
    displayElement.classList.remove('recording');
  }
  
  // Remover listener global
  document.removeEventListener('keydown', handleShortcutKeydown);
  
  updateShortcutDisplay();
}

function handleShortcutKeydown(event) {
  if (!currentShortcutRecorder || !currentShortcutRecorder.isRecording) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'];
  if (modifierKeys.includes(event.key)) return;
  
  if (event.key === 'Escape') {
    stopRecording();
    return;
  }
  
  const shortcut = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: event.key.length === 1 ? event.key.toLowerCase() : event.key
  };
  
  // Validaciones
  if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
    showShortcutError('Debe incluir un modificador (Ctrl, Alt, Shift)');
    return;
  }
  
  if (isShortcutReserved(shortcut)) {
    showShortcutError('Atajo reservado por el navegador');
    return;
  }
  
  const conflict = findShortcutConflict(shortcut, currentShortcutRecorder.domain, currentShortcutRecorder.excludeRouteId);
  if (conflict) {
    showShortcutError(`Ya usado por: ${conflict.title}`);
    return;
  }
  
  // Atajo válido
  currentShortcutRecorder.currentShortcut = shortcut;
  stopRecording();
}

function updateShortcutDisplay() {
  const displayElement = document.getElementById('shortcutDisplay');
  const displayWrapper = document.getElementById('shortcutDisplayWrapper');
  
  if (!displayElement) return;
  
  if (currentShortcutRecorder && currentShortcutRecorder.currentShortcut) {
    displayElement.textContent = formatShortcutDisplay(currentShortcutRecorder.currentShortcut);
    if (displayWrapper) displayWrapper.classList.add('has-shortcut');
  } else {
    displayElement.textContent = 'Sin atajo asignado';
    if (displayWrapper) displayWrapper.classList.remove('has-shortcut');
  }
}

function showShortcutError(message) {
  const displayElement = document.getElementById('shortcutDisplay');
  if (!displayElement) return;
  
  displayElement.textContent = `❌ ${message}`;
  displayElement.classList.add('error');
  
  setTimeout(() => {
    displayElement.classList.remove('error');
    updateShortcutDisplay();
  }, 2000);
}

function setShortcutValue(shortcut) {
  if (!currentShortcutRecorder) {
    currentShortcutRecorder = { currentShortcut: null, isRecording: false };
  }
  
  if (typeof shortcut === 'string' && shortcut) {
    shortcut = deserializeShortcut(shortcut);
  }
  
  currentShortcutRecorder.currentShortcut = shortcut || null;
  updateShortcutDisplay();
}

function getShortcutValue() {
  if (!currentShortcutRecorder || !currentShortcutRecorder.currentShortcut) return null;
  return serializeShortcut(currentShortcutRecorder.currentShortcut);
}

// ============================================
// FIN FUNCIONES DE ATAJO
// ============================================

function escapeCsvValue(value) {
  const stringValue = `${value ?? ''}`;
  const escaped = stringValue.replace(/"/g, '""');
  return /[",\n]/.test(stringValue) ? `"${escaped}"` : escaped;
}

function sortRoutesForExport(routes) {
  return [...routes].sort((a, b) => {
    const domainCompare = (a.domain || '').localeCompare(b.domain || '', 'es');
    if (domainCompare !== 0) return domainCompare;
    const moduleCompare = (a.module || '').localeCompare(b.module || '', 'es');
    if (moduleCompare !== 0) return moduleCompare;
    const titleCompare = (a.title || '').localeCompare(b.title || '', 'es');
    if (titleCompare !== 0) return titleCompare;
    return (a.id || '').localeCompare(b.id || '', 'es');
  });
}

function buildCsvContent(routes) {
  const header = CSV_HEADERS.join(',');
  const rows = routes.map(route => CSV_HEADERS.map(key => escapeCsvValue(route[key] ?? '')).join(','));
  return [header, ...rows].join('\n');
}

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'datos';
}

function downloadRoutesCsv(routes, scopeLabel = '') {
  if (!routes.length) {
    alert('No hay rutas para exportar');
    return;
  }

  const sorted = sortRoutesForExport(routes);
  const csvContent = buildCsvContent(sorted);
  const timestamp = new Date().toISOString().split('T')[0];
  const suffix = scopeLabel ? `-${slugify(scopeLabel)}` : '';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `universal-navigator-routes${suffix}-${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Función para normalizar dominios (quita www.)
function normalizeDomain(domain) {
  return domain.replace(/^www\./, '');
}

// Función para normalizar URLs para comparación
function normalizeUrl(url) {
  try {
    // Si es una URL completa, extraer solo el pathname
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return urlObj.pathname.replace(/\/$/, '').toLowerCase();
    }
    // Si es una ruta relativa
    return url.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

// Función para buscar rutas duplicadas
function findDuplicateRoute(domain, url, title, excludeId = null) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedUrl = normalizeUrl(url);
  const normalizedTitle = title.toLowerCase().trim();
  
  return cachedRoutes.find(route => {
    if (excludeId && route.id === excludeId) return false;
    if (normalizeDomain(route.domain) !== normalizedDomain) return false;
    
    const routeUrl = normalizeUrl(route.url);
    const routeTitle = (route.title || '').toLowerCase().trim();
    
    // Duplicado si coincide URL o título
    return routeUrl === normalizedUrl || routeTitle === normalizedTitle;
  });
}

// Función para mostrar alerta de duplicado
function showDuplicateAlert(duplicateRoute) {
  const alertContainer = document.getElementById('duplicateAlert');
  if (!alertContainer) return;
  
  const tags = parseTagsField(duplicateRoute.tags).join(', ') || 'Sin tags';
  
  alertContainer.innerHTML = `
    <div class="duplicate-alert">
      <div class="duplicate-alert-title">
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        ⚠️ Ya existe una ruta similar
      </div>
      <div class="duplicate-route-info">
        <div><strong>Título:</strong> ${duplicateRoute.title}</div>
        <div><strong>URL:</strong> ${duplicateRoute.url}</div>
        <div><strong>Módulo:</strong> ${duplicateRoute.module || 'General'}</div>
        <div><strong>Tags:</strong> ${tags}</div>
      </div>
      <div style="margin-top: 12px; text-align: center;">
        <button type="button" class="modal-btn edit" id="quickEditBtn" style="flex: none; padding: 8px 16px; font-size: 12px;" data-route-id="${duplicateRoute.id}">
          ✏️ Editar Esta Ruta
        </button>
      </div>
    </div>
  `;
  
  alertContainer.style.display = 'block';
  // No mostrar el botón de editar en panel para edición rápida
  const editBtn = document.getElementById('editDuplicateBtn');
  if (editBtn) editBtn.style.display = 'none';
  document.getElementById('saveRouteBtn').textContent = 'Crear de Todos Modos';
  
  // Guardar ID de la ruta duplicada para edición
  document.getElementById('editDuplicateBtn').dataset.duplicateId = duplicateRoute.id;
}

// Función para ocultar alerta de duplicado
function hideDuplicateAlert() {
  const alertContainer = document.getElementById('duplicateAlert');
  if (alertContainer) {
    alertContainer.style.display = 'none';
    alertContainer.innerHTML = '';
  }
  
  const editBtn = document.getElementById('editDuplicateBtn');
  if (editBtn) {
    editBtn.style.display = 'none';
    delete editBtn.dataset.duplicateId;
  }
  
  const saveBtn = document.getElementById('saveRouteBtn');
  if (saveBtn) {
    saveBtn.textContent = 'Guardar Ruta';
  }
}

// Función para editar una ruta existente directamente desde el popup
function editExistingRoute(routeId) {
  const route = cachedRoutes.find(r => r.id === routeId);
  if (!route) return;
  
  // Cambiar a modo edición
  document.getElementById('modalTitle').textContent = '✏️ Editar Ruta';
  document.getElementById('editModeIndicator').classList.add('show');
  document.getElementById('duplicateAlert').style.display = 'none';
  
  // Llenar el formulario con los datos existentes
  document.getElementById('routeTitle').value = route.title || '';
  document.getElementById('routeUrl').value = route.url || '';
  document.getElementById('routeModule').value = route.module || 'General';
  document.getElementById('routeTags').value = parseTagsField(route.tags).join(', ');
  document.getElementById('routeDescription').value = route.description || '';
  
  // Cargar atajo de teclado existente
  setShortcutValue(route.shortcut || null);
  
  // Actualizar sugerencias
  hydrateDomainPresets(route.domain);
  syncTagChipSelection();
  syncModuleChipSelection();
  
  // Cambiar el botón de guardar
  const saveBtn = document.getElementById('saveRouteBtn');
  saveBtn.textContent = '💾 Guardar Cambios';
  saveBtn.dataset.editingId = routeId;
  
  // Ocultar botones de duplicado
  document.getElementById('editDuplicateBtn').style.display = 'none';
  
  // Enfocar el título
  document.getElementById('routeTitle').focus();
}

// Función para salir del modo edición
function exitEditMode() {
  document.getElementById('modalTitle').textContent = '➕ Añadir Ruta Nueva';
  document.getElementById('editModeIndicator').classList.remove('show');
  
  const saveBtn = document.getElementById('saveRouteBtn');
  saveBtn.textContent = 'Guardar Ruta';
  delete saveBtn.dataset.editingId;
  
  // Resetear el formulario completamente
  document.getElementById('addRouteForm').reset();
  
  // Limpiar el campo de atajo de teclado
  if (currentShortcutRecorder) {
    currentShortcutRecorder.currentShortcut = null;
  }
  const shortcutDisplay = document.getElementById('shortcutDisplay');
  if (shortcutDisplay) {
    shortcutDisplay.textContent = 'Sin atajo';
  }
}

// Función para obtener el dominio actual
async function getCurrentDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      // Filtrar URLs especiales del navegador
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        return null;
      }
      const url = new URL(tab.url);
      return normalizeDomain(url.hostname);
    }
  } catch (error) {
    console.error('Error getting current domain:', error);
  }
  return null;
}

// Función para cargar estadísticas
async function loadStats() {
  try {
    const currentDomain = await getCurrentDomain();
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    const routes = stored[STORAGE_ROUTES_KEY] || [];
    cachedRoutes = routes;

    // Total de rutas
    document.getElementById('totalRoutes').textContent = routes.length;

    // Rutas del sitio actual
    if (currentDomain) {
      document.getElementById('currentDomain').textContent = currentDomain;
      const siteRoutes = routes.filter(r => normalizeDomain(r.domain) === currentDomain);
      document.getElementById('currentSiteRoutes').textContent = siteRoutes.length;
    } else {
      document.getElementById('currentDomain').textContent = 'No disponible';
      document.getElementById('currentSiteRoutes').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function parseTagsField(tagsValue) {
  if (!tagsValue) {
    return [];
  }
  if (Array.isArray(tagsValue)) {
    return tagsValue.map(tag => {
      if (typeof tag === 'string') return tag.trim();
      if (tag && tag.name) return tag.name.trim();
      return '';
    }).filter(Boolean);
  }
  if (typeof tagsValue === 'string') {
    return tagsValue.split('|').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

// Convertir tags de string a array con metadata (para nueva estructura)
function serializeTagsForStorage(tagsArray) {
  // Mantener compatibilidad: guardar como pipe-separated string
  return tagsArray.filter(Boolean).join('|');
}

// Obtener o inicializar metadata
async function getMetadata() {
  if (cachedMetadata) return cachedMetadata;
  
  const stored = await chrome.storage.local.get([STORAGE_METADATA_KEY]);
  cachedMetadata = stored[STORAGE_METADATA_KEY] || {
    modulesUsage: {}, // { domain: { moduleName: { count: N, lastUsed: timestamp } } }
    tagsUsage: {},    // { domain: { tagName: { count: N, lastUsed: timestamp, modules: [module1, module2] } } }
    version: 1
  };
  
  return cachedMetadata;
}

// Guardar metadata
async function saveMetadata(metadata) {
  cachedMetadata = metadata;
  await chrome.storage.local.set({ [STORAGE_METADATA_KEY]: metadata });
}

// Incrementar contador de uso de módulo
async function trackModuleUsage(domain, moduleName) {
  if (!domain || !moduleName) return;
  
  const metadata = await getMetadata();
  const normalizedDomain = normalizeDomain(domain);
  
  if (!metadata.modulesUsage[normalizedDomain]) {
    metadata.modulesUsage[normalizedDomain] = {};
  }
  
  if (!metadata.modulesUsage[normalizedDomain][moduleName]) {
    metadata.modulesUsage[normalizedDomain][moduleName] = { count: 0, lastUsed: null };
  }
  
  metadata.modulesUsage[normalizedDomain][moduleName].count++;
  metadata.modulesUsage[normalizedDomain][moduleName].lastUsed = Date.now();
  
  await saveMetadata(metadata);
}

// Incrementar contador de uso de tags
async function trackTagsUsage(domain, tags, moduleName = null) {
  if (!domain || !tags || !tags.length) return;
  
  const metadata = await getMetadata();
  const normalizedDomain = normalizeDomain(domain);
  
  if (!metadata.tagsUsage[normalizedDomain]) {
    metadata.tagsUsage[normalizedDomain] = {};
  }
  
  tags.forEach(tag => {
    if (!tag) return;
    
    if (!metadata.tagsUsage[normalizedDomain][tag]) {
      metadata.tagsUsage[normalizedDomain][tag] = { 
        count: 0, 
        lastUsed: null,
        modules: new Set()
      };
    }
    
    const tagData = metadata.tagsUsage[normalizedDomain][tag];
    tagData.count++;
    tagData.lastUsed = Date.now();
    
    // Asociar tag con módulo
    if (moduleName) {
      if (!(tagData.modules instanceof Set)) {
        tagData.modules = new Set(tagData.modules || []);
      }
      tagData.modules.add(moduleName);
    }
  });
  
  // Convertir Sets a Arrays para almacenamiento
  Object.keys(metadata.tagsUsage[normalizedDomain]).forEach(tag => {
    const tagData = metadata.tagsUsage[normalizedDomain][tag];
    if (tagData.modules instanceof Set) {
      tagData.modules = Array.from(tagData.modules);
    }
  });
  
  await saveMetadata(metadata);
}

// Analizar relaciones módulo→tags desde datos existentes
function analyzeModuleTagRelations(domain) {
  const normalized = normalizeDomain(domain);
  const domainRoutes = cachedRoutes.filter(route => 
    normalizeDomain(route.domain || '') === normalized
  );
  
  const moduleTagMap = {}; // { moduleName: { tagName: count } }
  
  domainRoutes.forEach(route => {
    const module = route.module || 'General';
    const tags = parseTagsField(route.tags);
    
    if (!moduleTagMap[module]) {
      moduleTagMap[module] = {};
    }
    
    tags.forEach(tag => {
      if (!moduleTagMap[module][tag]) {
        moduleTagMap[module][tag] = 0;
      }
      moduleTagMap[module][tag]++;
    });
  });
  
  return moduleTagMap;
}

// Obtener tags filtrados por módulo seleccionado
async function getTagsForModule(domain, moduleName) {
  const normalized = normalizeDomain(domain);
  const metadata = await getMetadata();
  const domainTags = metadata.tagsUsage[normalized] || {};
  
  if (!moduleName || moduleName.toLowerCase() === 'general') {
    // Si no hay módulo específico, devolver todos los tags
    return Object.keys(domainTags);
  }
  
  // Filtrar tags que están asociados con este módulo
  const filteredTags = Object.keys(domainTags).filter(tag => {
    const tagData = domainTags[tag];
    const modules = Array.isArray(tagData.modules) ? tagData.modules : [];
    return modules.includes(moduleName);
  });
  
  // Si no hay tags específicos, analizar desde rutas actuales
  if (filteredTags.length === 0) {
    const relations = analyzeModuleTagRelations(domain);
    return Object.keys(relations[moduleName] || {});
  }
  
  return filteredTags;
}

function getDomainMetadata(domain) {
  const normalized = normalizeDomain(domain);
  const domainRoutes = cachedRoutes.filter(route => normalizeDomain(route.domain || '') === normalized);

  const modules = [...new Set(domainRoutes.map(route => route.module).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

  const domainTags = new Set();
  domainRoutes.forEach(route => {
    parseTagsField(route.tags).forEach(tag => domainTags.add(tag));
  });

  const tags = [...domainTags].sort((a, b) => a.localeCompare(b, 'es'));
  
  // Agregar información de uso si está disponible
  return { modules, tags, domainRoutes };
}

// Obtener módulos con información de uso
async function getModulesWithUsage(domain) {
  const { modules } = getDomainMetadata(domain);
  const metadata = await getMetadata();
  const normalized = normalizeDomain(domain);
  const modulesUsage = metadata.modulesUsage[normalized] || {};
  
  return modules.map(module => ({
    value: module,
    label: module,
    count: modulesUsage[module]?.count || 0,
    lastUsed: modulesUsage[module]?.lastUsed || 0
  })).sort((a, b) => {
    // Ordenar por frecuencia primero, luego alfabéticamente
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value, 'es');
  });
}

// Obtener tags con información de uso, opcionalmente filtrados por módulo
async function getTagsWithUsage(domain, filterByModule = null) {
  const { tags } = getDomainMetadata(domain);
  const metadata = await getMetadata();
  const normalized = normalizeDomain(domain);
  const tagsUsage = metadata.tagsUsage[normalized] || {};
  
  let filteredTags = tags;
  
  // Filtrar por módulo si se especifica
  if (filterByModule && filterByModule.toLowerCase() !== 'general') {
    filteredTags = tags.filter(tag => {
      const tagData = tagsUsage[tag];
      if (!tagData || !tagData.modules) return false;
      const modules = Array.isArray(tagData.modules) ? tagData.modules : [];
      return modules.includes(filterByModule);
    });
    
    // Si no hay tags con metadata, usar análisis en tiempo real
    if (filteredTags.length === 0) {
      const relations = analyzeModuleTagRelations(domain);
      filteredTags = Object.keys(relations[filterByModule] || {});
    }
  }
  
  return filteredTags.map(tag => ({
    value: tag,
    label: tag,
    count: tagsUsage[tag]?.count || 0,
    lastUsed: tagsUsage[tag]?.lastUsed || 0,
    modules: tagsUsage[tag]?.modules || []
  })).sort((a, b) => {
    // Ordenar por frecuencia primero, luego alfabéticamente
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value, 'es');
  });
}

async function renderModuleSuggestions(modules, selectedModule = '') {
  const container = document.getElementById('moduleSuggestions');
  const datalist = document.getElementById('moduleOptions');
  if (!container || !datalist) {
    return;
  }

  container.innerHTML = '';
  datalist.innerHTML = '';

  // Agregar opción de búsqueda si hay muchos módulos
  if (modules.length > 10) {
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'chip-search-wrapper';
    searchWrapper.innerHTML = `
      <input type="text" 
             class="chip-search-input" 
             placeholder="🔍 Buscar módulo..." 
             autocomplete="off"
             id="moduleSearchInput">
    `;
    container.appendChild(searchWrapper);
  }

  // Poblar datalist
  modules.forEach(module => {
    const opt = typeof module === 'string' ? module : module.value;
    const option = document.createElement('option');
    option.value = opt;
    datalist.appendChild(option);
  });

  if (!modules.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'chip-placeholder';
    placeholder.textContent = 'No hay módulos guardados para este dominio.';
    container.appendChild(placeholder);
    return;
  }

  const renderChips = (filteredModules) => {
    // Limpiar chips existentes (mantener búsqueda)
    const searchWrapper = container.querySelector('.chip-search-wrapper');
    container.querySelectorAll('.chip-button').forEach(btn => btn.remove());
    container.querySelectorAll('.chip-placeholder').forEach(p => p.remove());
    
    if (!filteredModules.length) {
      const placeholder = document.createElement('span');
      placeholder.className = 'chip-placeholder';
      placeholder.textContent = 'No se encontraron módulos';
      container.appendChild(placeholder);
      return;
    }

    filteredModules.forEach(module => {
      const value = typeof module === 'string' ? module : module.value;
      const count = (typeof module === 'object' && module.count) ? module.count : null;
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-button';
      button.dataset.module = value;
      
      if (value.toLowerCase() === selectedModule.toLowerCase() && selectedModule) {
        button.classList.add('active');
      }
      
      button.textContent = value;
      
      if (count !== null && count > 0) {
        const badge = document.createElement('span');
        badge.className = 'chip-count';
        badge.textContent = count;
        button.appendChild(badge);
      }
      
      container.appendChild(button);
    });
  };

  renderChips(modules);

  // Event listener para búsqueda
  const searchInput = container.querySelector('#moduleSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = modules.filter(m => {
        const value = typeof m === 'string' ? m : m.value;
        return value.toLowerCase().includes(searchTerm);
      });
      renderChips(filtered);
    });
  }
}

async function renderTagSuggestions(tags, filterByModule = null) {
  const container = document.getElementById('tagSuggestions');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  // Agregar opción de búsqueda si hay muchos tags
  if (tags.length > 15) {
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'chip-search-wrapper';
    searchWrapper.innerHTML = `
      <input type="text" 
             class="chip-search-input" 
             placeholder="🔍 Buscar tag..." 
             autocomplete="off"
             id="tagSearchInput">
    `;
    container.appendChild(searchWrapper);
  }

  // Mostrar mensaje si hay filtro activo
  if (filterByModule && filterByModule.toLowerCase() !== 'general') {
    const filterInfo = document.createElement('div');
    filterInfo.className = 'filter-info';
    filterInfo.innerHTML = `
      <span>📌 Filtrado por módulo: <strong>${filterByModule}</strong></span>
      <button type="button" class="clear-filter-btn" id="clearModuleFilter">✕ Ver todos</button>
    `;
    container.appendChild(filterInfo);
  }

  if (!tags.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'chip-placeholder';
    placeholder.textContent = filterByModule 
      ? `No hay tags asociados al módulo "${filterByModule}".`
      : 'Aún no hay tags asociados a este dominio.';
    container.appendChild(placeholder);
    return;
  }

  const renderChips = (filteredTags) => {
    // Limpiar chips existentes (mantener búsqueda y filtro)
    const searchWrapper = container.querySelector('.chip-search-wrapper');
    const filterInfo = container.querySelector('.filter-info');
    container.querySelectorAll('.chip-button').forEach(btn => btn.remove());
    container.querySelectorAll('.chip-placeholder').forEach(p => p.remove());
    
    if (!filteredTags.length) {
      const placeholder = document.createElement('span');
      placeholder.className = 'chip-placeholder';
      placeholder.textContent = 'No se encontraron tags';
      container.appendChild(placeholder);
      return;
    }

    filteredTags.forEach(tag => {
      const value = typeof tag === 'string' ? tag : tag.value;
      const count = (typeof tag === 'object' && tag.count) ? tag.count : null;
      
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-button';
      button.dataset.tag = value;
      button.textContent = value;
      
      if (count !== null && count > 0) {
        const badge = document.createElement('span');
        badge.className = 'chip-count';
        badge.textContent = count;
        button.appendChild(badge);
      }
      
      container.appendChild(button);
    });

    syncTagChipSelection();
  };

  renderChips(tags);

  // Event listener para búsqueda
  const searchInput = container.querySelector('#tagSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filtered = tags.filter(t => {
        const value = typeof t === 'string' ? t : t.value;
        return value.toLowerCase().includes(searchTerm);
      });
      renderChips(filtered);
    });
  }
}

function getCurrentTagList() {
  const input = document.getElementById('routeTags');
  if (!input) {
    return [];
  }
  return input.value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function syncTagChipSelection() {
  const container = document.getElementById('tagSuggestions');
  if (!container) {
    return;
  }

  const selectedTags = new Set(getCurrentTagList().map(tag => tag.toLowerCase()));
  container.querySelectorAll('.chip-button').forEach(chip => {
    if (!chip.dataset.tag) {
      return;
    }
    chip.classList.toggle('active', selectedTags.has(chip.dataset.tag.toLowerCase()));
  });
}

function syncModuleChipSelection() {
  const container = document.getElementById('moduleSuggestions');
  const moduleInput = document.getElementById('routeModule');
  if (!container || !moduleInput) {
    return;
  }

  const currentModule = moduleInput.value.trim().toLowerCase();
  container.querySelectorAll('.chip-button').forEach(chip => {
    if (!chip.dataset.module) {
      return;
    }
    chip.classList.toggle('active', currentModule && chip.dataset.module.toLowerCase() === currentModule);
  });
}

async function hydrateDomainPresets(domain, currentModule = null) {
  if (!domain) {
    return;
  }

  if (!cachedRoutes.length) {
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    cachedRoutes = stored[STORAGE_ROUTES_KEY] || [];
  }

  const moduleInput = document.getElementById('routeModule');
  const selectedModule = currentModule || (moduleInput ? moduleInput.value : '');
  
  // Obtener módulos con información de uso
  const modulesWithUsage = await getModulesWithUsage(domain);
  await renderModuleSuggestions(modulesWithUsage, selectedModule);
  
  // Obtener tags filtrados por módulo (si hay uno seleccionado)
  const tagsWithUsage = await getTagsWithUsage(domain, selectedModule);
  await renderTagSuggestions(tagsWithUsage, selectedModule);
  
  syncModuleChipSelection();
}

// Actualizar tags cuando cambia el módulo seleccionado
async function updateTagsForModule(domain, moduleName) {
  const tagsWithUsage = await getTagsWithUsage(domain, moduleName);
  await renderTagSuggestions(tagsWithUsage, moduleName);
}

// Abrir navegador en la página actual
document.getElementById('openNavigatorBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      alert('No se puede acceder a la pestaña actual');
      return;
    }

    // Verificar si la URL es válida para content scripts
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      alert('El navegador no funciona en páginas especiales del navegador.\nPor favor, ve a un sitio web normal.');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
    window.close();
  } catch (error) {
    console.error('Error opening navigator:', error);
    alert('No se pudo abrir el navegador. Asegúrate de estar en una página web válida.');
  }
});

// Abrir modal para añadir ruta
document.getElementById('addRouteBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Verificar si la URL es válida
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
      tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    alert('No puedes añadir rutas desde páginas especiales del navegador.\nPor favor, ve a un sitio web normal.');
    return;
  }

  const domain = await getCurrentDomain();
  if (!domain) {
    alert('No se puede detectar el dominio actual');
    return;
  }
  
  // Resetear formulario y estado
  document.getElementById('addRouteForm').reset();
  hideDuplicateAlert();
  exitEditMode(); // Asegurar que salimos del modo edición
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
  document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
  
  document.getElementById('modalDomain').textContent = `Dominio: ${domain}`;
  
  // Auto-rellenar URL con la página actual (sin query parameters)
  let currentUrl = '';
  let currentTitle = '';
  
  try {
    if (tab && tab.url) {
      const url = new URL(tab.url);
      // Solo pathname, sin search (query parameters)
      currentUrl = url.pathname;
      currentTitle = tab.title || '';
      document.getElementById('routeUrl').value = currentUrl;
      document.getElementById('routeTitle').value = currentTitle;
    }
  } catch (error) {
    console.error('Error getting current URL:', error);
  }
  
  // Buscar si ya existe una ruta para esta URL
  const existingRoute = findDuplicateRoute(domain, currentUrl, currentTitle);
  
  if (existingRoute) {
    // MODO EDICIÓN: La ruta ya existe
    document.getElementById('modalTitle').textContent = '✏️ Editar Ruta Existente';
    document.getElementById('editModeIndicator').classList.add('show');
    
    // Pre-llenar con datos existentes
    document.getElementById('routeTitle').value = existingRoute.title || '';
    document.getElementById('routeUrl').value = existingRoute.url || '';
    document.getElementById('routeModule').value = existingRoute.module || 'General';
    document.getElementById('routeTags').value = parseTagsField(existingRoute.tags).join(', ');
    document.getElementById('routeDescription').value = existingRoute.description || '';
    
    // Inicializar grabador de atajos
    initShortcutRecorder(domain, existingRoute.id);
    
    // Cargar atajo de teclado existente
    setShortcutValue(existingRoute.shortcut || null);
    
    // Marcar que estamos editando
    const saveBtn = document.getElementById('saveRouteBtn');
    saveBtn.textContent = '💾 Guardar Cambios';
    saveBtn.dataset.editingId = existingRoute.id;
    
    // Cargar sugerencias y sincronizar
    await hydrateDomainPresets(domain);
    syncTagChipSelection();
    syncModuleChipSelection();
    
  } else {
    // MODO AÑADIR: Nueva ruta
    document.getElementById('modalTitle').textContent = '➕ Añadir Ruta Nueva';
    document.getElementById('editModeIndicator').classList.remove('show');
    
    const saveBtn = document.getElementById('saveRouteBtn');
    saveBtn.textContent = 'Guardar Ruta';
    delete saveBtn.dataset.editingId;
    
    // Inicializar grabador de atajos
    initShortcutRecorder(domain, null);
    
    // Cargar sugerencias
    await hydrateDomainPresets(domain);
    syncTagChipSelection();
  }
  
  // Mostrar modal
  document.getElementById('addRouteModal').classList.add('active');
  document.getElementById('routeTitle').focus();
});

// Cerrar modal
document.getElementById('cancelAddRoute').addEventListener('click', () => {
  document.getElementById('addRouteModal').classList.remove('active');
  document.getElementById('addRouteForm').reset();
  hideDuplicateAlert();
  exitEditMode();
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
  document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
  syncTagChipSelection();
  syncModuleChipSelection();
});

// Guardar nueva ruta o actualizar existente
document.getElementById('addRouteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const domain = await getCurrentDomain();
    if (!domain) {
      alert('No se puede detectar el dominio actual');
      return;
    }

    // Obtener valores del formulario
    const title = document.getElementById('routeTitle').value.trim();
    const url = document.getElementById('routeUrl').value.trim();
    let module = document.getElementById('routeModule').value.trim() || 'General';
    const tagsInput = document.getElementById('routeTags').value.trim();
    const description = document.getElementById('routeDescription').value.trim();

    // Normalizar módulo a Title Case
    module = module.split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Normalizar tags
    const tagsArray = tagsInput 
      ? tagsInput.split(',').map(t => {
          return t.trim().split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }).filter(t => t)
      : [];

    // Validación mejorada
    let hasErrors = false;
    
    if (!title) {
      document.getElementById('routeTitle').classList.add('form-error');
      document.getElementById('titleError').classList.add('show');
      hasErrors = true;
    } else {
      document.getElementById('routeTitle').classList.remove('form-error');
      document.getElementById('titleError').classList.remove('show');
    }
    
    if (!url) {
      document.getElementById('routeUrl').classList.add('form-error');
      document.getElementById('urlError').classList.add('show');
      hasErrors = true;
    } else {
      document.getElementById('routeUrl').classList.remove('form-error');
      document.getElementById('urlError').classList.remove('show');
    }
    
    if (hasErrors) return;

    // Cargar rutas existentes
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    let routes = stored[STORAGE_ROUTES_KEY] || [];

    // Verificar si estamos editando o creando
    const saveBtn = document.getElementById('saveRouteBtn');
    const isEditing = saveBtn.dataset.editingId;
    
    const tagsString = serializeTagsForStorage(tagsArray);
    
    if (isEditing) {
      // Modo edición: actualizar ruta existente
      const routeIndex = routes.findIndex(r => r.id === isEditing);
      if (routeIndex !== -1) {
        routes[routeIndex] = {
          ...routes[routeIndex],
          title: title,
          url: url,
          module: module,
          tags: tagsString,
          description: description,
          shortcut: getShortcutValue()
        };
      }
    } else {
      // Modo creación: verificar duplicados antes de crear
      const duplicate = findDuplicateRoute(domain, url, title);
      if (duplicate && !confirm('Ya existe una ruta similar. ¿Deseas crear una nueva de todos modos?')) {
        return;
      }

      // Generar ID único
      const maxId = routes.reduce((max, r) => {
        const num = parseInt(r.id);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = (maxId + 1).toString();

      // Crear nueva ruta
      const newRoute = {
        domain: domain,
        id: newId,
        module: module,
        title: title,
        url: url,
        tags: tagsString,
        description: description,
        status: 'active',
        shortcut: getShortcutValue()
      };

      routes.push(newRoute);
    }

    // Guardar rutas
    await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes });
    cachedRoutes = routes;
    
    // Trackear uso de módulos y tags
    await trackModuleUsage(domain, module);
    await trackTagsUsage(domain, tagsArray, module);

    // Feedback y cerrar
    const btn = document.getElementById('addRouteBtn');
    const originalText = btn.innerHTML;
    const successMessage = isEditing ? '✏️ Ruta Actualizada!' : '➕ Ruta Guardada!';
    btn.innerHTML = `<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>${successMessage}`;
    btn.classList.add('action-btn');
    btn.style.background = 'rgba(16, 185, 129, 0.95)';
    btn.style.color = 'white';
    btn.style.borderColor = 'rgba(16, 185, 129, 1)';

    document.getElementById('addRouteModal').classList.remove('active');
    document.getElementById('addRouteForm').reset();
    hideDuplicateAlert();
    exitEditMode();
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
    document.querySelectorAll('.error-message').forEach(el => el.classList.remove('show'));
    syncTagChipSelection();
    syncModuleChipSelection();
    
    // Actualizar estadísticas
    loadStats();

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2500);
  } catch (error) {
    console.error('Error saving route:', error);
    alert('Error al guardar la ruta. Por favor, intenta de nuevo.');
  }
});

// Abrir página de gestión
document.getElementById('manageRoutesBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// Exportar rutas
document.getElementById('exportRoutesBtn').addEventListener('click', async () => {
  try {
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    const routes = stored[STORAGE_ROUTES_KEY] || [];

    if (!routes.length) {
      alert('No hay rutas para exportar');
      return;
    }

    let routesToExport = routes;
    let scopeLabel = '';
    const currentDomain = await getCurrentDomain();

    if (currentDomain) {
      const exportCurrentOnly = confirm(`¿Exportar solo las rutas del dominio ${currentDomain}?\nAceptar = solo este dominio / Cancelar = todas las rutas`);
      if (exportCurrentOnly) {
        const domainRoutes = routes.filter(route => normalizeDomain(route.domain || '') === currentDomain);
        if (!domainRoutes.length) {
          alert('No hay rutas guardadas para este dominio todavía.');
          return;
        }
        routesToExport = domainRoutes;
        scopeLabel = currentDomain;
      }
    }

    downloadRoutesCsv(routesToExport, scopeLabel);

    const btn = document.getElementById('exportRoutesBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Exportado!';
    btn.style.background = 'rgba(16, 185, 129, 0.3)';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    console.error('Error exporting routes:', error);
    alert('Error al exportar rutas');
  }
});

// Detectar si estamos en Mac para mostrar el atajo correcto
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
if (isMac) {
  const shortcutKeys = document.querySelector('.shortcut-keys');
  shortcutKeys.innerHTML = '<span class="key">⌘</span><span class="key">Shift</span><span class="key">K</span>';
}

const moduleContainer = document.getElementById('moduleSuggestions');
if (moduleContainer) {
  moduleContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip-button');
    if (!chip || !chip.dataset.module) {
      return;
    }
    const moduleInput = document.getElementById('routeModule');
    moduleInput.value = chip.dataset.module;
    syncModuleChipSelection();
  });
}

const tagContainer = document.getElementById('tagSuggestions');
if (tagContainer) {
  tagContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip-button');
    if (!chip || !chip.dataset.tag) {
      return;
    }
    const currentTags = getCurrentTagList();
    const normalizedTag = chip.dataset.tag.toLowerCase();
    let nextTags;
    if (chip.classList.contains('active')) {
      nextTags = currentTags.filter(tag => tag.toLowerCase() !== normalizedTag);
    } else {
      nextTags = [...currentTags, chip.dataset.tag].filter((tag, index, arr) => arr.findIndex(t => t.toLowerCase() === tag.toLowerCase()) === index);
    }
    document.getElementById('routeTags').value = nextTags.join(', ');
    syncTagChipSelection();
  });
}

const routeTagsInput = document.getElementById('routeTags');
if (routeTagsInput) {
  routeTagsInput.addEventListener('input', () => {
    syncTagChipSelection();
  });
}

const routeModuleInput = document.getElementById('routeModule');
if (routeModuleInput) {
  let moduleChangeTimeout;
  routeModuleInput.addEventListener('input', async () => {
    syncModuleChipSelection();
    
    // Actualizar tags filtrados por módulo con debounce
    clearTimeout(moduleChangeTimeout);
    moduleChangeTimeout = setTimeout(async () => {
      const domain = await getCurrentDomain();
      if (domain) {
        const moduleName = routeModuleInput.value.trim();
        await updateTagsForModule(domain, moduleName);
      }
    }, 300);
  });
  
  // Listener para cuando se pierde el foco (normalizar texto)
  routeModuleInput.addEventListener('blur', () => {
    if (routeModuleInput.value.trim()) {
      // Normalizar a Title Case
      const normalized = routeModuleInput.value.trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      routeModuleInput.value = normalized;
    }
  });
}

// Event listener para limpiar filtro de módulo en tags
document.addEventListener('click', async (e) => {
  if (e.target.id === 'clearModuleFilter' || e.target.closest('#clearModuleFilter')) {
    const domain = await getCurrentDomain();
    if (domain) {
      const tagsWithUsage = await getTagsWithUsage(domain, null);
      await renderTagSuggestions(tagsWithUsage, null);
    }
  }
});

// Editar ruta duplicada existente
document.getElementById('editDuplicateBtn').addEventListener('click', () => {
  const duplicateId = document.getElementById('editDuplicateBtn').dataset.duplicateId;
  if (!duplicateId) return;
  
  // Cerrar el modal del popup
  document.getElementById('addRouteModal').classList.remove('active');
  
  // Abrir la página de gestión con el ID de la ruta para editar
  chrome.runtime.openOptionsPage(() => {
    // Enviar mensaje para editar la ruta específica
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'EDIT_ROUTE',
        routeId: duplicateId
      });
    }, 500);
  });
  
  window.close();
});

// Detectar cambios en título y URL para buscar duplicados en tiempo real
let duplicateCheckTimeout;
const checkDuplicatesOnInput = async () => {
  clearTimeout(duplicateCheckTimeout);
  duplicateCheckTimeout = setTimeout(async () => {
    const title = document.getElementById('routeTitle').value.trim();
    const url = document.getElementById('routeUrl').value.trim();
    
    if (!title && !url) {
      hideDuplicateAlert();
      return;
    }
    
    const domain = await getCurrentDomain();
    if (!domain) return;
    
    const duplicate = findDuplicateRoute(domain, url, title);
    if (duplicate) {
      showDuplicateAlert(duplicate);
    } else {
      hideDuplicateAlert();
    }
  }, 500);
};

document.getElementById('routeTitle').addEventListener('input', checkDuplicatesOnInput);
document.getElementById('routeUrl').addEventListener('input', checkDuplicatesOnInput);

// Event listener para el botón de edición rápida
document.addEventListener('click', (e) => {
  if (e.target.id === 'quickEditBtn' || e.target.closest('#quickEditBtn')) {
    const routeId = e.target.dataset.routeId || e.target.closest('#quickEditBtn')?.dataset.routeId;
    if (routeId) {
      editExistingRoute(routeId);
    }
  }
});

// Event listeners para el campo de atajo de teclado
const shortcutRecordBtn = document.getElementById('routeShortcutRecord');
const shortcutClearBtn = document.getElementById('routeShortcutClear');

if (shortcutRecordBtn) {
  shortcutRecordBtn.addEventListener('click', () => {
    startShortcutCapture();
  });
}

if (shortcutClearBtn) {
  shortcutClearBtn.addEventListener('click', () => {
    clearShortcut();
  });
}

// Cargar datos al abrir el popup
loadStats();

// Actualizar stats cada segundo si el popup sigue abierto
setInterval(loadStats, 1000);
