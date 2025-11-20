// manage.js - Navigator Studio Logic

let allRoutes = [];
let currentView = 'dashboard';
let searchTerm = '';

const ALL_DOMAINS_VALUE = '__all__';
const CSV_HEADERS = ['domain', 'id', 'module', 'title', 'url', 'tags', 'description', 'status'];

function createRouteId(prefix = 'route') {
  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// DOM Elements
const elements = {
  grid: document.getElementById('domainGrid'),
  list: document.getElementById('routesList'),
  views: {
    dashboard: document.getElementById('dashboardView'),
    list: document.getElementById('listView'),
    import: document.getElementById('importView')
  },
  navItems: document.querySelectorAll('.nav-item'),
  pageTitle: document.getElementById('pageTitle'),
  searchInput: document.getElementById('globalSearch'),
  modal: document.getElementById('routeModal'),
  form: document.getElementById('routeForm'),
  fab: document.getElementById('addRouteFab')
};

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

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'datos';
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(value => value.replace(/\r$/, ''));
}

function parseCsv(content) {
  if (!content) return [];
  const lines = content.split(/\r?\n/).filter(line => line.trim().length);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines.shift()).map(header => header.replace(/^\ufeff/, '').trim().toLowerCase());
  return lines.map(line => {
    const values = parseCsvLine(line);
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = (values[index] ?? '').trim();
    });
    return entry;
  });
}

function normalizeTags(raw) {
  if (!raw) return '';
  return raw
    .split(/[|,]/)
    .map(tag => tag.trim())
    .filter(Boolean)
    .join('|');
}

function getDomainCounts() {
  return allRoutes.reduce((acc, route) => {
    const domain = route.domain || '';
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {});
}

function populateDataDomainSelect() {
  const select = document.getElementById('dataDomainSelect');
  if (!select) return;

  const previousValue = select.value;
  const counts = getDomainCounts();
  const domains = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'es')); // alphabetical for predictability

  let options = `<option value="${ALL_DOMAINS_VALUE}">Todos los dominios (${allRoutes.length})</option>`;
  domains.forEach(domain => {
    const label = domain || '(sin dominio)';
    const valueAttr = domain;
    options += `<option value="${valueAttr}">${label} (${counts[domain]} rutas)</option>`;
  });

  select.innerHTML = options;
  if (previousValue && (previousValue === ALL_DOMAINS_VALUE || counts[previousValue])) {
    select.value = previousValue;
  } else {
    select.value = ALL_DOMAINS_VALUE;
  }

  updateDomainDataControls();
}

function updateDomainDataControls() {
  const select = document.getElementById('dataDomainSelect');
  if (!select) return;

  const hasDomain = select.value !== ALL_DOMAINS_VALUE;
  const exportDomainBtn = document.getElementById('exportDomainBtn');
  const deleteDomainBtn = document.getElementById('deleteDomainDataBtn');

  if (exportDomainBtn) exportDomainBtn.disabled = !hasDomain;
  if (deleteDomainBtn) deleteDomainBtn.disabled = !hasDomain;
}

function getSelectedDomainForDataOps() {
  const select = document.getElementById('dataDomainSelect');
  return select ? select.value : ALL_DOMAINS_VALUE;
}

function exportRoutesToCsv(routes, scopeLabel = 'todos') {
  if (!routes.length) {
    alert('No hay rutas para exportar');
    return;
  }

  const sorted = sortRoutesForExport(routes);
  const csvContent = buildCsvContent(sorted);
  const timestamp = new Date().toISOString().split('T')[0];
  const suffix = scopeLabel && scopeLabel !== ALL_DOMAINS_VALUE ? `-${slugify(scopeLabel)}` : '';
  downloadCsv(csvContent, `universal-navigator-routes${suffix}-${timestamp}.csv`);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadRoutes();
  setupEventListeners();
  
  // Listen for storage changes (e.g., when adding routes from popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.navigatorRoutes) {
      allRoutes = changes.navigatorRoutes.newValue || [];
      render();
    }
  });
});

// Load Data
async function loadRoutes() {
  const result = await chrome.storage.local.get('navigatorRoutes');
  allRoutes = result.navigatorRoutes || [];
  render();
}

// Save Data
async function saveRoutes() {
  await chrome.storage.local.set({ navigatorRoutes: allRoutes });
  render();
}

// Render UI
function render() {
  // Filter routes
  const filtered = allRoutes.filter(r => {
    const term = searchTerm.toLowerCase();
    const title = (r.title || '').toLowerCase();
    const domain = (r.domain || '').toLowerCase();
    const moduleName = (r.module || '').toLowerCase();
    return title.includes(term) || domain.includes(term) || moduleName.includes(term);
  });

  // Render Grid (Dashboard)
  renderGrid(filtered);

  // Render List
  renderList(filtered);

  populateDataDomainSelect();
}

function renderGrid(routes) {
  const domains = {};
  routes.forEach(r => {
    if (!domains[r.domain]) domains[r.domain] = [];
    domains[r.domain].push(r);
  });

  if (Object.keys(domains).length === 0) {
    elements.grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-icon">🌌</div>
        <h3>No hay nada por aquí</h3>
        <p>Agrega tu primera ruta para comenzar</p>
      </div>
    `;
    return;
  }

  elements.grid.innerHTML = Object.keys(domains).map(domain => {
    const domainRoutes = domains[domain];
    const activeCount = domainRoutes.filter(r => r.status === 'active').length;
    const modules = new Set(domainRoutes.map(r => r.module)).size;
    
    return `
      <div class="domain-card" data-domain="${domain}">
        <div class="card-header">
          <div class="domain-icon">${domain.charAt(0).toUpperCase()}</div>
          <button class="action-btn delete-domain-btn" data-domain="${domain}" title="Eliminar dominio" style="opacity: 0.7;">🗑️</button>
        </div>
        
        <h3 class="domain-name" style="margin-top: 12px;">${domain}</h3>
        <div class="domain-stats" style="margin-bottom: 16px;">${domainRoutes.length} rutas • ${modules} módulos</div>
        
        <div class="card-badges">
          <span class="badge" style="background: rgba(34, 197, 94, 0.25); color: #22c55e; border-color: rgba(34, 197, 94, 0.4); font-weight: 600; font-size: 10px;">${activeCount} Activas</span>
          <span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #ef4444; border-color: rgba(239, 68, 68, 0.4); font-weight: 600; font-size: 10px;">${domainRoutes.length - activeCount} Legacy</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderList(routes) {
  if (routes.length === 0) {
    elements.list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No se encontraron rutas</h3>
      </div>
    `;
    return;
  }

  elements.list.innerHTML = routes.map(r => {
    const tags = (r.tags && typeof r.tags === 'string') ? r.tags.split('|').filter(t => t.trim()) : [];
    const description = r.description || '';
    const title = r.title || '(Sin título)';
    const domain = r.domain || 'Sin dominio';
    const moduleName = r.module || 'General';
    const url = r.url || '';
    
    return `
    <div class="route-row" data-id="${r.id}">
      <div class="route-main">
        <div class="route-header">
          <h4 class="route-title">${title}</h4>
          <span class="badge" style="background: ${r.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${r.status === 'active' ? '#4ade80' : '#f87171'}; border: 1px solid ${r.status === 'active' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}; padding: 2px 8px; font-size: 10px;">
            ${r.status === 'active' ? 'ACTIVO' : 'LEGACY'}
          </span>
        </div>
        
        ${description ? `<div class="route-desc">${description}</div>` : ''}
        
        <div class="route-meta-row">
          <div class="meta-item" title="Dominio">
            <span style="opacity: 0.5;">🌐</span> ${domain}
          </div>
          <div class="meta-item" title="Módulo">
            <span style="opacity: 0.5;">📁</span> ${moduleName}
          </div>
          <div class="meta-item">
            <span class="url-badge">${url}</span>
          </div>
        </div>

        ${tags.length > 0 ? `
          <div class="route-tags">
            ${tags.map(tag => `<span class="tag-pill">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      <div class="route-actions">
        <button class="action-btn edit-route-btn" data-id="${r.id}" title="Editar">✏️</button>
        <button class="action-btn delete-route-btn" data-id="${r.id}" style="color: #ef4444;" title="Eliminar">🗑️</button>
      </div>
    </div>
  `;
  }).join('');
}

// Actions
function filterByDomain(domain) {
  searchTerm = domain;
  elements.searchInput.value = domain;
  switchView('list');
  render();
}

async function deleteDomain(domain) {
  const label = domain || '(sin dominio)';
  if (!confirm(`¿Eliminar TODAS las rutas de ${label}?`)) return;
  allRoutes = allRoutes.filter(r => r.domain !== domain);
  await saveRoutes();
}

async function deleteRoute(id) {
  if (!confirm('¿Eliminar esta ruta?')) return;
  allRoutes = allRoutes.filter(r => r.id !== id);
  await saveRoutes();
}

function editRoute(id) {
  const route = allRoutes.find(r => r.id === id);
  if (!route) return;

  document.getElementById('routeId').value = route.id;
  document.getElementById('inputDomain').value = route.domain;
  document.getElementById('inputTitle').value = route.title;
  document.getElementById('inputModule').value = route.module;
  document.getElementById('inputUrl').value = route.url;
  document.getElementById('inputStatus').value = route.status;
  
  // Convert pipes to commas for display (with defensive check)
  const tagsForDisplay = (route.tags && typeof route.tags === 'string') ? route.tags.split('|').join(', ') : '';
  document.getElementById('inputTags').value = tagsForDisplay;
  document.getElementById('inputDescription').value = route.description || '';

  openModal();
}

// View Switching
function switchView(viewName) {
  currentView = viewName;
  
  // Clear search when going back to dashboard
  if (viewName === 'dashboard' && searchTerm) {
    searchTerm = '';
    elements.searchInput.value = '';
    render();
  }
  
  // Update Nav
  elements.navItems.forEach(item => {
    if (item.dataset.view === viewName) item.classList.add('active');
    else item.classList.remove('active');
  });

  // Update Content
  Object.keys(elements.views).forEach(key => {
    if (key === viewName) elements.views[key].classList.remove('hidden');
    else elements.views[key].classList.add('hidden');
  });

  // Update Title
  const titles = {
    dashboard: 'Dashboard',
    list: 'Todas las Rutas',
    import: 'Importar / Exportar'
  };
  elements.pageTitle.textContent = titles[viewName];
}

// Modal Handling
function openModal() {
  populateDomainsList();
  populateModulesList();
  elements.modal.classList.add('active');
  
  // Update modules list when domain changes
  document.getElementById('inputDomain').addEventListener('input', populateModulesList);
}

function populateDomainsList() {
  const domains = new Set(allRoutes.map(r => r.domain).filter(d => d));
  const datalist = document.getElementById('domainsList');
  
  datalist.innerHTML = Array.from(domains).sort().map(domain => 
    `<option value="${domain}">${domain}</option>`
  ).join('');
}

function populateModulesList() {
  const currentDomain = document.getElementById('inputDomain').value.trim();
  
  // Filter routes by current domain
  const domainRoutes = currentDomain 
    ? allRoutes.filter(r => r.domain === currentDomain)
    : allRoutes;
  
  // Get unique modules from filtered routes
  const modules = new Set(domainRoutes.map(r => r.module).filter(m => m));
  const datalist = document.getElementById('modulesList');
  
  datalist.innerHTML = Array.from(modules).sort().map(module => 
    `<option value="${module}">${module}</option>`
  ).join('');
}

function closeModal() {
  elements.modal.classList.remove('active');
  elements.form.reset();
  document.getElementById('routeId').value = '';
  
  // Remove event listener to prevent duplicates
  document.getElementById('inputDomain').removeEventListener('input', populateModulesList);
}

// Event Listeners
function setupEventListeners() {
  // Nav
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });

  // Search
  elements.searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });

  // FAB
  elements.fab.addEventListener('click', () => {
    document.getElementById('routeId').value = '';
    elements.form.reset();
    
    // Pre-fill domain if we're in list view with a domain filter
    if (currentView === 'list' && searchTerm) {
      // Check if searchTerm matches a domain
      const matchingDomain = [...new Set(allRoutes.map(r => r.domain))].find(d => d === searchTerm);
      if (matchingDomain) {
        document.getElementById('inputDomain').value = matchingDomain;
      }
    }
    
    openModal();
  });

  // Modal Actions
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) closeModal();
  });

  // Form Submit
  elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('routeId').value;
    const domain = document.getElementById('inputDomain').value.trim();
    const title = document.getElementById('inputTitle').value.trim();
    const module = document.getElementById('inputModule').value.trim() || 'General';
    const url = document.getElementById('inputUrl').value.trim();
    const status = document.getElementById('inputStatus').value;
    const tagsInput = document.getElementById('inputTags').value.trim();
    const description = document.getElementById('inputDescription').value.trim();

    // Convert commas to pipes for internal storage
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t).join('|') : '';

    const newRoute = {
      id: id || `route:${Date.now()}`,
      domain, title, module, url, status,
      tags: tags,
      description: description || ''
    };

    if (id) {
      const index = allRoutes.findIndex(r => r.id === id);
      if (index !== -1) allRoutes[index] = newRoute;
    } else {
      allRoutes.push(newRoute);
    }

    await saveRoutes();
    closeModal();
  });

  const dataDomainSelect = document.getElementById('dataDomainSelect');
  if (dataDomainSelect) {
    dataDomainSelect.addEventListener('change', updateDomainDataControls);
  }

  // Export
  const exportAllBtn = document.getElementById('exportBtn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      exportRoutesToCsv(allRoutes, ALL_DOMAINS_VALUE);
    });
  }

  const exportDomainBtn = document.getElementById('exportDomainBtn');
  if (exportDomainBtn) {
    exportDomainBtn.addEventListener('click', () => {
      const selectedDomain = getSelectedDomainForDataOps();
      if (selectedDomain === ALL_DOMAINS_VALUE) return;
      const domainRoutes = allRoutes.filter(route => route.domain === selectedDomain);
      if (!domainRoutes.length) {
        alert('Ese dominio no tiene rutas todavía');
        return;
      }
      exportRoutesToCsv(domainRoutes, selectedDomain);
    });
  }

  const deleteDomainDataBtn = document.getElementById('deleteDomainDataBtn');
  if (deleteDomainDataBtn) {
    deleteDomainDataBtn.addEventListener('click', () => {
      const selectedDomain = getSelectedDomainForDataOps();
      if (selectedDomain === ALL_DOMAINS_VALUE) return;
      deleteDomain(selectedDomain);
    });
  }
  
  // Download Template
  const templateBtn = document.getElementById('templateBtn');
  if (templateBtn) {
    templateBtn.addEventListener('click', () => {
      const template = `domain,id,module,title,url,tags,description,status
example.com,page:home,General,Página Principal,/home,inicio|favorito,Página de inicio del sitio,active
example.com,page:dashboard,Admin,Dashboard,/admin/dashboard,admin|importante,Panel de administración,active
example.com,page:settings,Admin,Configuración,/admin/settings,admin,Configuración del sistema,active`;
      
      const blob = new Blob([template], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'navigator_template.csv';
      a.click();
    });
  }
  
  // CSV Import Button
  const selectCsvBtn = document.getElementById('selectCsvBtn');
  if (selectCsvBtn) {
    selectCsvBtn.addEventListener('click', () => {
      document.getElementById('csvInput').click();
    });
  }

  // CSV Import
  const csvInput = document.getElementById('csvInput');
  if (csvInput) {
    csvInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        alert('El archivo no contiene datos válidos');
        e.target.value = '';
        return;
      }

      const selectedDomain = getSelectedDomainForDataOps();
      const forcedDomain = selectedDomain !== ALL_DOMAINS_VALUE ? selectedDomain : null;

      let imported = 0;
      let skipped = 0;

      rows.forEach(row => {
        const domainFromRow = (row.domain || '').trim();
        const domain = forcedDomain || domainFromRow;

        if (!domain) {
          skipped++;
          return;
        }

        const id = (row.id || '').trim() || createRouteId('csv');
        const moduleName = (row.module || '').trim() || 'General';
        const title = (row.title || '').trim() || '(Sin título)';
        const url = (row.url || '').trim() || '/';
        const statusInput = ((row.status || '').trim() || 'active').toLowerCase();
        const status = statusInput === 'legacy' ? 'legacy' : 'active';
        const tags = normalizeTags(row.tags || '');
        const description = (row.description || '').trim();

        const newRoute = { domain, id, module: moduleName, title, url, status, tags, description };
        const existingIndex = allRoutes.findIndex(route => route.id === id);
        if (existingIndex >= 0) allRoutes[existingIndex] = newRoute;
        else allRoutes.push(newRoute);
        imported++;
      });

      await saveRoutes();
      alert(`Importadas ${imported} rutas correctamente${skipped ? ` | Omitidas ${skipped} sin dominio` : ''}`);
      e.target.value = ''; // Reset input
    });
  }

  // Event Delegation for Grid (Dashboard)
  elements.grid.addEventListener('click', (e) => {
    // Handle Delete Domain Button
    if (e.target.classList.contains('delete-domain-btn')) {
      e.stopPropagation();
      const domain = e.target.dataset.domain;
      deleteDomain(domain);
      return;
    }

    // Handle Domain Card Click
    const card = e.target.closest('.domain-card');
    if (card) {
      const domain = card.dataset.domain;
      filterByDomain(domain);
    }
  });

  // Event Delegation for List View
  elements.list.addEventListener('click', (e) => {
    // Handle Edit Button
    if (e.target.classList.contains('edit-route-btn')) {
      e.stopPropagation();
      const id = e.target.dataset.id;
      editRoute(id);
      return;
    }

    // Handle Delete Button
    if (e.target.classList.contains('delete-route-btn')) {
      e.stopPropagation();
      const id = e.target.dataset.id;
      deleteRoute(id);
      return;
    }

    // Handle click on entire route row to edit
    const row = e.target.closest('.route-row');
    if (row) {
      const id = row.dataset.id;
      editRoute(id);
    }
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }

    // Ctrl/Cmd + N: New route
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      document.getElementById('routeId').value = '';
      elements.form.reset();
      openModal();
    }

    // Escape: Close modal or clear search
    if (e.key === 'Escape') {
      if (elements.modal.classList.contains('active')) {
        closeModal();
      } else if (searchTerm) {
        searchTerm = '';
        elements.searchInput.value = '';
        render();
      }
    }
  });
}
