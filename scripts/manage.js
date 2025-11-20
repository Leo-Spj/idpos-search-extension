// manage.js - Navigator Studio Logic

let allRoutes = [];
let currentView = 'dashboard';
let searchTerm = '';

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
    return r.title.toLowerCase().includes(term) || 
           r.domain.toLowerCase().includes(term) ||
           r.module.toLowerCase().includes(term);
  });

  // Render Grid (Dashboard)
  renderGrid(filtered);

  // Render List
  renderList(filtered);
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
    
    return `
    <div class="route-row" data-id="${r.id}">
      <div class="route-main">
        <div class="route-header">
          <h4 class="route-title">${r.title}</h4>
          <span class="badge" style="background: ${r.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${r.status === 'active' ? '#4ade80' : '#f87171'}; border: 1px solid ${r.status === 'active' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}; padding: 2px 8px; font-size: 10px;">
            ${r.status === 'active' ? 'ACTIVO' : 'LEGACY'}
          </span>
        </div>
        
        ${description ? `<div class="route-desc">${description}</div>` : ''}
        
        <div class="route-meta-row">
          <div class="meta-item" title="Dominio">
            <span style="opacity: 0.5;">🌐</span> ${r.domain}
          </div>
          <div class="meta-item" title="Módulo">
            <span style="opacity: 0.5;">📁</span> ${r.module}
          </div>
          <div class="meta-item">
            <span class="url-badge">${r.url}</span>
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
  if (!confirm(`¿Eliminar TODAS las rutas de ${domain}?`)) return;
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

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    const csv = 'domain,id,module,title,url,tags,description,status\n' + 
      allRoutes.map(r => Object.values(r).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'navigator_routes.csv';
    a.click();
  });
  
  // Download Template
  document.getElementById('templateBtn').addEventListener('click', () => {
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
  
  // CSV Import Button
  document.getElementById('selectCsvBtn').addEventListener('click', () => {
    document.getElementById('csvInput').click();
  });

  // CSV Import
  document.getElementById('csvInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    let count = 0;
    lines.forEach(line => {
      if (!line.trim()) return;
      const [domain, id, module, title, url, tags, description, status] = line.split(',');
      
      // Simple merge logic
      const existingIndex = allRoutes.findIndex(r => r.id === id);
      const route = { domain, id, module, title, url, tags, description, status };
      
      if (existingIndex >= 0) allRoutes[existingIndex] = route;
      else allRoutes.push(route);
      count++;
    });
    
    await saveRoutes();
    alert(`Importadas ${count} rutas correctamente`);
    e.target.value = ''; // Reset input
  });

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
