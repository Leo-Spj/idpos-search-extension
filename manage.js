// manage.js - Gestión completa de rutas

let allRoutes = [];
let filteredRoutes = [];
let selectedRoutes = new Set();
let currentPage = 1;
const rowsPerPage = 50;
let isEditMode = false;
let editingRouteId = null;
let pendingImportRoutes = [];
let importMode = 'REPLACE_ALL';

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  loadRoutes();
  setupEventListeners();
});

// Cargar rutas desde el almacenamiento
async function loadRoutes() {
  try {
    const result = await chrome.storage.local.get('navigatorRoutes');
    allRoutes = result.navigatorRoutes || [];
    updateStats();
    applyFilters();
    renderTable();
    populateDomainFilters();
    renderDomainsList();
  } catch (error) {
    showAlert('Error al cargar rutas: ' + error.message, 'error');
  }
}

// Guardar rutas en el almacenamiento
async function saveRoutes() {
  try {
    await chrome.storage.local.set({ navigatorRoutes: allRoutes });
    showAlert('Rutas guardadas correctamente', 'success');
  } catch (error) {
    showAlert('Error al guardar rutas: ' + error.message, 'error');
  }
}

// Actualizar estadísticas
function updateStats() {
  const domains = new Set(allRoutes.map(r => r.domain)).size;
  const activeRoutes = allRoutes.filter(r => r.status === 'active').length;
  const modules = new Set(allRoutes.map(r => r.module)).size;

  document.getElementById('totalRoutes').textContent = allRoutes.length;
  document.getElementById('totalDomains').textContent = domains;
  document.getElementById('activeRoutes').textContent = activeRoutes;
  document.getElementById('totalModules').textContent = modules;
}

// Aplicar filtros
function applyFilters() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const domainFilter = document.getElementById('filterDomain')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';

  filteredRoutes = allRoutes.filter(route => {
    const matchesSearch = 
      route.title.toLowerCase().includes(searchTerm) ||
      route.domain.toLowerCase().includes(searchTerm) ||
      route.module.toLowerCase().includes(searchTerm) ||
      (route.description && route.description.toLowerCase().includes(searchTerm));
    
    const matchesDomain = !domainFilter || route.domain === domainFilter;
    const matchesStatus = !statusFilter || route.status === statusFilter;

    return matchesSearch && matchesDomain && matchesStatus;
  });

  currentPage = 1;
}

// Renderizar tabla
function renderTable() {
  const tbody = document.getElementById('routesTableBody');
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageRoutes = filteredRoutes.slice(start, end);

  if (pageRoutes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div>No se encontraron rutas con los filtros actuales</div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pageRoutes.map(route => {
      const isSelected = selectedRoutes.has(route.id);
      const tagsHtml = route.tags 
        ? route.tags.split('|').map(tag => `<span class="tag">${tag}</span>`).join('') 
        : '';
      
      return `
        <tr data-route-id="${route.id}" ${isSelected ? 'style="background: #f0f9ff;"' : ''}>
          <td>
            <input type="checkbox" class="route-checkbox" data-route-id="${route.id}" ${isSelected ? 'checked' : ''} />
          </td>
          <td><strong>${route.domain}</strong></td>
          <td>
            <div style="font-weight: 600;">${route.title}</div>
            ${route.description ? `<div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${route.description}</div>` : ''}
            ${tagsHtml ? `<div class="tag-list" style="margin-top: 6px;">${tagsHtml}</div>` : ''}
          </td>
          <td><span class="tag">${route.module}</span></td>
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <code style="font-size: 12px;">${route.url}</code>
          </td>
          <td>
            <span class="status-badge status-${route.status}">${route.status === 'active' ? 'Activo' : 'Legacy'}</span>
          </td>
          <td>
            <div class="actions">
              <button class="icon-btn edit-btn" data-route-id="${route.id}" title="Editar">✏️</button>
              <button class="icon-btn delete-btn" data-route-id="${route.id}" title="Eliminar">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  updatePagination();
  updateBulkActions();
}

// Actualizar paginación
function updatePagination() {
  const totalPages = Math.ceil(filteredRoutes.length / rowsPerPage);
  document.getElementById('currentPage').textContent = currentPage;
  document.getElementById('totalPages').textContent = totalPages;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages || totalPages === 0;
}

// Actualizar acciones masivas
function updateBulkActions() {
  const bulkActions = document.getElementById('bulkActions');
  const count = selectedRoutes.size;
  document.getElementById('selectedCount').textContent = count;
  
  if (count > 0) {
    bulkActions.classList.add('show');
  } else {
    bulkActions.classList.remove('show');
  }
}

// Poblar filtros de dominio
function populateDomainFilters() {
  const select = document.getElementById('filterDomain');
  const domains = [...new Set(allRoutes.map(r => r.domain))].sort();
  
  select.innerHTML = '<option value="">Todos</option>' +
    domains.map(d => `<option value="${d}">${d}</option>`).join('');
}

// Renderizar lista de dominios
function renderDomainsList() {
  const container = document.getElementById('domainsList');
  const domainGroups = {};

  allRoutes.forEach(route => {
    if (!domainGroups[route.domain]) {
      domainGroups[route.domain] = [];
    }
    domainGroups[route.domain].push(route);
  });

  const domains = Object.keys(domainGroups).sort();

  if (domains.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        <div class="empty-state-icon">🌐</div>
        <div>No hay dominios configurados</div>
      </div>
    `;
    return;
  }

  container.innerHTML = domains.map(domain => {
    const routes = domainGroups[domain];
    const activeCount = routes.filter(r => r.status === 'active').length;
    const modules = [...new Set(routes.map(r => r.module))];

    return `
      <div class="table-container" style="margin-bottom: 20px;">
        <div style="padding: 20px; border-bottom: 2px solid #f1f3f5;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="font-size: 20px; margin-bottom: 8px;">🌐 ${domain}</h3>
              <div style="color: #7f8c8d; font-size: 14px;">
                ${routes.length} rutas • ${activeCount} activas • ${modules.length} módulos
              </div>
            </div>
            <button class="btn btn-sm btn-secondary export-domain-btn" data-domain="${domain}">
              📤 Exportar
            </button>
          </div>
        </div>
        <div style="padding: 20px;">
          <div style="display: grid; gap: 12px;">
            ${routes.slice(0, 10).map(route => `
              <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600;">${route.title}</div>
                  <div style="font-size: 12px; color: #7f8c8d; margin-top: 2px;">
                    ${route.module} • ${route.url}
                  </div>
                </div>
                <span class="status-badge status-${route.status}">${route.status === 'active' ? 'Activo' : 'Legacy'}</span>
              </div>
            `).join('')}
            ${routes.length > 10 ? `
              <div style="text-align: center; padding: 12px; color: #7f8c8d; font-size: 14px;">
                ... y ${routes.length - 10} rutas más
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Configurar event listeners
function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + '-content').classList.add('active');
    });
  });

  // Búsqueda y filtros
  document.getElementById('searchInput').addEventListener('input', debounce(() => {
    applyFilters();
    renderTable();
  }, 300));

  document.getElementById('filterDomain').addEventListener('change', () => {
    applyFilters();
    renderTable();
  });

  document.getElementById('filterStatus').addEventListener('change', () => {
    applyFilters();
    renderTable();
  });

  // Búsqueda de dominios
  document.getElementById('domainSearchInput').addEventListener('input', debounce((e) => {
    const term = e.target.value.toLowerCase();
    const domainCards = document.querySelectorAll('#domainsList > .table-container');
    
    domainCards.forEach(card => {
      const domain = card.querySelector('h3').textContent.toLowerCase();
      card.style.display = domain.includes(term) ? 'block' : 'none';
    });
  }, 300));

  // Selección
  document.getElementById('selectAll').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.route-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = e.target.checked;
      const routeId = cb.dataset.routeId;
      if (e.target.checked) {
        selectedRoutes.add(routeId);
      } else {
        selectedRoutes.delete(routeId);
      }
    });
    renderTable();
  });

  // Delegación de eventos para la tabla
  document.getElementById('routesTableBody').addEventListener('change', (e) => {
    if (e.target.classList.contains('route-checkbox')) {
      const routeId = e.target.dataset.routeId;
      if (e.target.checked) {
        selectedRoutes.add(routeId);
      } else {
        selectedRoutes.delete(routeId);
      }
      renderTable();
    }
  });

  document.getElementById('routesTableBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const routeId = e.target.dataset.routeId;
      openEditModal(routeId);
    } else if (e.target.classList.contains('delete-btn')) {
      const routeId = e.target.dataset.routeId;
      deleteRoute(routeId);
    }
  });

  // Acciones masivas
  document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDelete);
  document.getElementById('bulkExportBtn').addEventListener('click', bulkExport);
  document.getElementById('deselectAllBtn').addEventListener('click', () => {
    selectedRoutes.clear();
    document.getElementById('selectAll').checked = false;
    renderTable();
  });

  // Paginación
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredRoutes.length / rowsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Nueva ruta
  document.getElementById('addRouteBtn').addEventListener('click', () => {
    openAddModal();
  });

  // Modal
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('routeForm').addEventListener('submit', saveRoute);

  // Preview modal
  document.getElementById('cancelPreviewBtn').addEventListener('click', closePreviewModal);
  document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);

  // Modo de importación
  document.querySelectorAll('input[name="importMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      importMode = e.target.value;
    });
  });

  // Importar/Exportar
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);
  document.getElementById('downloadTemplateBtn').addEventListener('click', downloadTemplate);
  document.getElementById('clearAllBtn').addEventListener('click', clearAll);

  // File upload
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // Exportar por dominio
  document.getElementById('domainsList').addEventListener('click', (e) => {
    if (e.target.classList.contains('export-domain-btn')) {
      const domain = e.target.dataset.domain;
      exportByDomain(domain);
    }
  });
}

// Abrir modal para agregar
function openAddModal() {
  isEditMode = false;
  editingRouteId = null;
  document.getElementById('modalTitle').textContent = 'Nueva Ruta';
  document.getElementById('routeForm').reset();
  document.getElementById('routeModal').classList.add('show');
}

// Abrir modal para editar
function openEditModal(routeId) {
  const route = allRoutes.find(r => r.id === routeId);
  if (!route) return;

  isEditMode = true;
  editingRouteId = routeId;
  document.getElementById('modalTitle').textContent = 'Editar Ruta';
  
  document.getElementById('routeDomain').value = route.domain;
  document.getElementById('routeId').value = route.id;
  document.getElementById('routeTitle').value = route.title;
  document.getElementById('routeModule').value = route.module;
  document.getElementById('routeUrl').value = route.url;
  document.getElementById('routeTags').value = route.tags || '';
  document.getElementById('routeDescription').value = route.description || '';
  document.getElementById('routeStatus').value = route.status;
  
  document.getElementById('routeModal').classList.add('show');
}

// Cerrar modal
function closeModal() {
  document.getElementById('routeModal').classList.remove('show');
}

// Guardar ruta
async function saveRoute(e) {
  e.preventDefault();

  const route = {
    domain: document.getElementById('routeDomain').value.trim(),
    id: document.getElementById('routeId').value.trim(),
    title: document.getElementById('routeTitle').value.trim(),
    module: document.getElementById('routeModule').value.trim(),
    url: document.getElementById('routeUrl').value.trim(),
    tags: document.getElementById('routeTags').value.trim(),
    description: document.getElementById('routeDescription').value.trim(),
    status: document.getElementById('routeStatus').value
  };

  if (isEditMode) {
    const index = allRoutes.findIndex(r => r.id === editingRouteId);
    if (index !== -1) {
      allRoutes[index] = route;
    }
  } else {
    // Verificar si ya existe
    if (allRoutes.some(r => r.id === route.id)) {
      showAlert('Ya existe una ruta con ese ID', 'error');
      return;
    }
    allRoutes.push(route);
  }

  await saveRoutes();
  updateStats();
  applyFilters();
  renderTable();
  populateDomainFilters();
  renderDomainsList();
  closeModal();
}

// Eliminar ruta
async function deleteRoute(routeId) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta ruta?')) return;

  allRoutes = allRoutes.filter(r => r.id !== routeId);
  selectedRoutes.delete(routeId);
  
  await saveRoutes();
  updateStats();
  applyFilters();
  renderTable();
  populateDomainFilters();
  renderDomainsList();
}

// Eliminar masivamente
async function bulkDelete() {
  if (selectedRoutes.size === 0) return;
  if (!confirm(`¿Eliminar ${selectedRoutes.size} rutas seleccionadas?`)) return;

  allRoutes = allRoutes.filter(r => !selectedRoutes.has(r.id));
  selectedRoutes.clear();
  
  await saveRoutes();
  updateStats();
  applyFilters();
  renderTable();
  populateDomainFilters();
  renderDomainsList();
}

// Exportar seleccionadas
function bulkExport() {
  const routes = allRoutes.filter(r => selectedRoutes.has(r.id));
  exportRoutes(routes, 'rutas_seleccionadas.csv');
}

// Exportar todas
function exportAll() {
  exportRoutes(allRoutes, 'todas_las_rutas.csv');
}

// Exportar por dominio
function exportByDomain(domain) {
  const routes = allRoutes.filter(r => r.domain === domain);
  exportRoutes(routes, `rutas_${domain}.csv`);
}

// Exportar rutas a CSV
function exportRoutes(routes, filename) {
  const csv = routesToCSV(routes);
  downloadCSV(csv, filename);
  showAlert(`${routes.length} rutas exportadas correctamente`, 'success');
}

// Convertir rutas a CSV
function routesToCSV(routes) {
  const header = 'domain,id,module,title,url,tags,description,status\n';
  const rows = routes.map(route => {
    return [
      route.domain,
      route.id,
      route.module,
      escapeCSV(route.title),
      route.url,
      escapeCSV(route.tags || ''),
      escapeCSV(route.description || ''),
      route.status
    ].join(',');
  }).join('\n');
  
  return header + rows;
}

// Escapar valores CSV
function escapeCSV(value) {
  if (typeof value !== 'string') return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// Descargar CSV
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Descargar plantilla
function downloadTemplate() {
  const template = `domain,id,module,title,url,tags,description,status
example.com,page:home,General,Página Principal,/home,"General|Inicio",Página de inicio del sitio,active
example.com,page:about,General,Acerca de,/about,"General|Información",Información sobre la empresa,active
example.com,page:contact,General,Contacto,/contact,"General|Soporte",Formulario de contacto,active`;
  
  downloadCSV(template, 'plantilla_rutas.csv');
  showAlert('Plantilla descargada correctamente', 'success');
}

// Manejar carga de archivo
async function handleFileUpload(file) {
  if (!file.name.endsWith('.csv')) {
    showAlert('Por favor selecciona un archivo CSV válido', 'error');
    return;
  }

  try {
    const text = await file.text();
    const routes = parseCSV(text);
    
    if (routes.length === 0) {
      showAlert('El archivo CSV está vacío o tiene un formato incorrecto', 'error');
      return;
    }

    // Guardar rutas pendientes y mostrar preview
    pendingImportRoutes = routes;
    showImportPreview(routes);
    
  } catch (error) {
    showAlert('Error al leer archivo: ' + error.message, 'error');
  }
}

// Mostrar preview de importación
function showImportPreview(newRoutes) {
  const changes = calculateImportChanges(newRoutes);
  
  // Actualizar contadores
  document.getElementById('previewNewCount').textContent = changes.new.length;
  document.getElementById('previewUpdateCount').textContent = changes.updated.length;
  document.getElementById('previewDeleteCount').textContent = changes.deleted.length;
  
  // Actualizar descripción del modo
  const modeDescriptions = {
    'REPLACE_ALL': {
      title: '🔄 Reemplazar Todo',
      description: 'Se eliminarán todas las rutas existentes y se cargarán solo las del CSV'
    },
    'MERGE': {
      title: '🔀 Fusionar',
      description: 'Se actualizarán las rutas existentes por ID y se agregarán las nuevas. Las no presentes en el CSV se mantendrán'
    },
    'ADD_ONLY': {
      title: '➕ Solo Agregar',
      description: 'Solo se agregarán las rutas nuevas. Las existentes no serán modificadas'
    },
    'REPLACE_DOMAIN': {
      title: '🌐 Reemplazar por Dominio',
      description: 'Se reemplazarán solo las rutas de los dominios presentes en el CSV. Otros dominios no se verán afectados'
    }
  };
  
  const modeInfo = modeDescriptions[importMode];
  document.getElementById('previewMode').textContent = modeInfo.title;
  document.getElementById('previewDescription').textContent = modeInfo.description;
  
  // Renderizar tabla de cambios
  const tbody = document.getElementById('previewTableBody');
  tbody.innerHTML = '';
  
  // Nuevas
  changes.new.forEach(route => {
    tbody.innerHTML += `
      <tr>
        <td><span class="change-badge change-new">NUEVA</span></td>
        <td>${route.domain}</td>
        <td>${route.title}</td>
        <td>${route.module}</td>
      </tr>
    `;
  });
  
  // Actualizadas
  changes.updated.forEach(route => {
    tbody.innerHTML += `
      <tr>
        <td><span class="change-badge change-update">ACTUALIZAR</span></td>
        <td>${route.domain}</td>
        <td>${route.title}</td>
        <td>${route.module}</td>
      </tr>
    `;
  });
  
  // Eliminadas
  changes.deleted.forEach(route => {
    tbody.innerHTML += `
      <tr>
        <td><span class="change-badge change-delete">ELIMINAR</span></td>
        <td>${route.domain}</td>
        <td>${route.title}</td>
        <td>${route.module}</td>
      </tr>
    `;
  });
  
  // Mostrar modal
  document.getElementById('previewModal').classList.add('show');
}

// Calcular cambios de importación
function calculateImportChanges(newRoutes) {
  const changes = {
    new: [],
    updated: [],
    deleted: []
  };
  
  const existingById = new Map(allRoutes.map(r => [r.id, r]));
  const newById = new Map(newRoutes.map(r => [r.id, r]));
  
  switch (importMode) {
    case 'REPLACE_ALL':
      // Todo lo del CSV es "nuevo" (técnicamente reemplaza todo)
      changes.new = newRoutes;
      changes.deleted = allRoutes;
      break;
      
    case 'MERGE':
      // Nuevas: las que no existen
      // Actualizadas: las que existen y están en el CSV
      // Ninguna se elimina
      newRoutes.forEach(route => {
        if (existingById.has(route.id)) {
          changes.updated.push(route);
        } else {
          changes.new.push(route);
        }
      });
      break;
      
    case 'ADD_ONLY':
      // Solo nuevas, nada se actualiza ni elimina
      newRoutes.forEach(route => {
        if (!existingById.has(route.id)) {
          changes.new.push(route);
        }
      });
      break;
      
    case 'REPLACE_DOMAIN':
      // Obtener dominios del CSV
      const csvDomains = new Set(newRoutes.map(r => r.domain));
      
      // Nuevas y actualizadas en esos dominios
      newRoutes.forEach(route => {
        if (existingById.has(route.id)) {
          changes.updated.push(route);
        } else {
          changes.new.push(route);
        }
      });
      
      // Eliminadas: rutas existentes de esos dominios que no están en el CSV
      allRoutes.forEach(route => {
        if (csvDomains.has(route.domain) && !newById.has(route.id)) {
          changes.deleted.push(route);
        }
      });
      break;
  }
  
  return changes;
}

// Confirmar importación
async function confirmImport() {
  const newRoutes = pendingImportRoutes;
  let finalRoutes = [];
  
  switch (importMode) {
    case 'REPLACE_ALL':
      finalRoutes = newRoutes;
      break;
      
    case 'MERGE':
      // Crear mapa de existentes
      const existingById = new Map(allRoutes.map(r => [r.id, r]));
      
      // Actualizar o agregar
      newRoutes.forEach(route => {
        existingById.set(route.id, route);
      });
      
      finalRoutes = Array.from(existingById.values());
      break;
      
    case 'ADD_ONLY':
      const existingIds = new Set(allRoutes.map(r => r.id));
      const onlyNew = newRoutes.filter(r => !existingIds.has(r.id));
      finalRoutes = [...allRoutes, ...onlyNew];
      break;
      
    case 'REPLACE_DOMAIN':
      const csvDomains = new Set(newRoutes.map(r => r.domain));
      const csvRoutesById = new Map(newRoutes.map(r => [r.id, r]));
      
      // Mantener rutas de otros dominios
      finalRoutes = allRoutes.filter(r => !csvDomains.has(r.domain));
      
      // Agregar todas las del CSV
      finalRoutes.push(...newRoutes);
      break;
  }
  
  allRoutes = finalRoutes;
  selectedRoutes.clear();
  
  await saveRoutes();
  updateStats();
  applyFilters();
  renderTable();
  populateDomainFilters();
  renderDomainsList();
  
  closePreviewModal();
  showAlert(`Importación completada: ${newRoutes.length} rutas procesadas`, 'success');
}

// Cerrar modal de preview
function closePreviewModal() {
  document.getElementById('previewModal').classList.remove('show');
  pendingImportRoutes = [];
}

// Parsear CSV
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const routes = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 8) {
      routes.push({
        domain: fields[0].trim(),
        id: fields[1].trim(),
        module: fields[2].trim(),
        title: fields[3].trim(),
        url: fields[4].trim(),
        tags: fields[5].trim(),
        description: fields[6].trim(),
        status: fields[7].trim()
      });
    }
  }

  return routes;
}

// Parsear línea CSV (maneja comillas y comas)
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

// Limpiar todas las rutas
async function clearAll() {
  if (!confirm('⚠️ ¿Estás seguro de que deseas eliminar TODAS las rutas? Esta acción no se puede deshacer.')) {
    return;
  }

  if (!confirm('⚠️ ÚLTIMA ADVERTENCIA: Se eliminarán permanentemente ' + allRoutes.length + ' rutas. ¿Continuar?')) {
    return;
  }

  allRoutes = [];
  selectedRoutes.clear();
  
  await saveRoutes();
  updateStats();
  applyFilters();
  renderTable();
  populateDomainFilters();
  renderDomainsList();
  
  showAlert('Todas las rutas han sido eliminadas', 'info');
}

// Mostrar alerta
function showAlert(message, type = 'info') {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} show`;
  alert.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; font-size: 18px;">✕</button>
  `;
  
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 5000);
}

// Utilidad: debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
