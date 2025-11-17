// Constantes
const STORAGE_ROUTES_KEY = "navigatorRoutes";

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
  
  // Auto-rellenar URL con la página actual
  try {
    if (tab && tab.url) {
      const url = new URL(tab.url);
      document.getElementById('routeUrl').value = url.pathname + url.search;
      document.getElementById('routeTitle').value = tab.title || '';
    }
  } catch (error) {
    console.error('Error getting current URL:', error);
  }
  
  document.getElementById('routeTitle').focus();
});

// Cerrar modal
document.getElementById('cancelAddRoute').addEventListener('click', () => {
  document.getElementById('addRouteModal').classList.remove('active');
  document.getElementById('addRouteForm').reset();
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
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      description: description,
      status: 'active'
    };

    // Añadir y guardar
    routes.push(newRoute);
    await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes });

    // Feedback y cerrar
    const btn = document.getElementById('addRouteBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Ruta Añadida!';
    btn.style.background = 'rgba(16, 185, 129, 0.3)';

    document.getElementById('addRouteModal').classList.remove('active');
    document.getElementById('addRouteForm').reset();
    
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

    if (routes.length === 0) {
      alert('No hay rutas para exportar');
      return;
    }

    // Crear CSV
    const headers = ['domain', 'id', 'module', 'title', 'url', 'tags', 'description', 'status'];
    const csvContent = [
      headers.join(','),
      ...routes.map(route => {
        const tags = Array.isArray(route.tags) ? route.tags.join('|') : route.tags || '';
        return [
          route.domain || '',
          route.id || '',
          route.module || '',
          `"${(route.title || '').replace(/"/g, '""')}"`,
          route.url || '',
          `"${tags.replace(/"/g, '""')}"`,
          `"${(route.description || '').replace(/"/g, '""')}"`,
          route.status || 'active'
        ].join(',');
      })
    ].join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `universal-navigator-routes-${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    // Feedback visual
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

// Cargar datos al abrir el popup
loadStats();

// Actualizar stats cada segundo si el popup sigue abierto
setInterval(loadStats, 1000);
