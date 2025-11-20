// Constantes
const STORAGE_ROUTES_KEY = "navigatorRoutes";
const CSV_HEADERS = ['domain', 'id', 'module', 'title', 'url', 'tags', 'description', 'status'];
let cachedRoutes = [];

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
    return tagsValue.map(tag => tag.trim()).filter(Boolean);
  }
  if (typeof tagsValue === 'string') {
    return tagsValue.split('|').map(tag => tag.trim()).filter(Boolean);
  }
  return [];
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
  return { modules, tags };
}

function renderModuleSuggestions(modules, selectedModule = '') {
  const container = document.getElementById('moduleSuggestions');
  const datalist = document.getElementById('moduleOptions');
  if (!container || !datalist) {
    return;
  }

  container.innerHTML = '';
  datalist.innerHTML = '';

  modules.forEach(module => {
    const option = document.createElement('option');
    option.value = module;
    datalist.appendChild(option);
  });

  if (!modules.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'chip-placeholder';
    placeholder.textContent = 'No hay módulos guardados para este dominio.';
    container.appendChild(placeholder);
    return;
  }

  modules.forEach(module => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.dataset.module = module;
    button.textContent = module;
    if (module.toLowerCase() === selectedModule.toLowerCase() && selectedModule) {
      button.classList.add('active');
    }
    container.appendChild(button);
  });
}

function renderTagSuggestions(tags) {
  const container = document.getElementById('tagSuggestions');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!tags.length) {
    const placeholder = document.createElement('span');
    placeholder.className = 'chip-placeholder';
    placeholder.textContent = 'Aún no hay tags asociados a este dominio.';
    container.appendChild(placeholder);
    return;
  }

  tags.forEach(tag => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-button';
    button.dataset.tag = tag;
    button.textContent = tag;
    container.appendChild(button);
  });

  syncTagChipSelection();
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

async function hydrateDomainPresets(domain) {
  if (!domain) {
    return;
  }

  if (!cachedRoutes.length) {
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    cachedRoutes = stored[STORAGE_ROUTES_KEY] || [];
  }

  const moduleInput = document.getElementById('routeModule');
  const { modules, tags } = getDomainMetadata(domain);
  renderModuleSuggestions(modules, moduleInput ? moduleInput.value : '');
  renderTagSuggestions(tags);
  syncModuleChipSelection();
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
  
  document.getElementById('modalDomain').textContent = `Dominio: ${domain}`;
  document.getElementById('addRouteModal').classList.add('active');
  
  // Auto-rellenar URL con la página actual (sin query parameters)
  try {
    if (tab && tab.url) {
      const url = new URL(tab.url);
      // Solo pathname, sin search (query parameters)
      document.getElementById('routeUrl').value = url.pathname;
      document.getElementById('routeTitle').value = tab.title || '';
    }
  } catch (error) {
    console.error('Error getting current URL:', error);
  }
  
  await hydrateDomainPresets(domain);
  syncTagChipSelection();
  document.getElementById('routeTitle').focus();
});

// Cerrar modal
document.getElementById('cancelAddRoute').addEventListener('click', () => {
  document.getElementById('addRouteModal').classList.remove('active');
  document.getElementById('addRouteForm').reset();
  syncTagChipSelection();
  syncModuleChipSelection();
});

// Guardar nueva ruta
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
    const module = document.getElementById('routeModule').value.trim() || 'General';
    const tags = document.getElementById('routeTags').value.trim();
    const description = document.getElementById('routeDescription').value.trim();

    if (!title || !url) {
      alert('Título y URL son obligatorios');
      return;
    }

    // Cargar rutas existentes
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    const routes = stored[STORAGE_ROUTES_KEY] || [];

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
      tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t).join('|') : '',
      description: description,
      status: 'active'
    };

    // Añadir y guardar
    routes.push(newRoute);
    await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes });
    cachedRoutes = routes;

    // Feedback y cerrar
    const btn = document.getElementById('addRouteBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Ruta Añadida!';
    btn.style.background = 'rgba(16, 185, 129, 0.3)';

    document.getElementById('addRouteModal').classList.remove('active');
    document.getElementById('addRouteForm').reset();
    syncTagChipSelection();
    syncModuleChipSelection();
    
    // Actualizar estadísticas
    loadStats();

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    console.error('Error adding route:', error);
    alert('Error al guardar la ruta');
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
  routeModuleInput.addEventListener('input', () => {
    syncModuleChipSelection();
  });
}

// Cargar datos al abrir el popup
loadStats();

// Actualizar stats cada segundo si el popup sigue abierto
setInterval(loadStats, 1000);
