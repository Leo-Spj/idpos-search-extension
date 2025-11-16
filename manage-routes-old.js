const STORAGE_KEY = "navigatorRoutes";
const CSV_TEMPLATE_URL = chrome.runtime.getURL("data/routes.csv");

let currentRoutes = [];
let currentStats = { total: 0, domains: 0, active: 0 };

init();

function init() {
  loadRoutes();
  attachEventListeners();
}

function attachEventListeners() {
  document.getElementById("downloadTemplateBtn").addEventListener("click", downloadTemplate);
  document.getElementById("exportBtn").addEventListener("click", exportCurrentRoutes);
  document.getElementById("importInput").addEventListener("change", handleImport);
  document.getElementById("clearAllBtn").addEventListener("click", clearAllRoutes);
}

async function loadRoutes() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    currentRoutes = data[STORAGE_KEY] || [];
    
    if (currentRoutes.length === 0) {
      await loadDefaultRoutes();
    } else {
      updateUI();
    }
  } catch (error) {
    showAlert("Error al cargar las rutas: " + error.message, "error");
  }
}

async function loadDefaultRoutes() {
  try {
    const response = await fetch(CSV_TEMPLATE_URL);
    const csvText = await response.text();
    const routes = parseCSV(csvText);
    
    await chrome.storage.local.set({ [STORAGE_KEY]: routes });
    currentRoutes = routes;
    updateUI();
    showAlert("Rutas predeterminadas cargadas correctamente", "success");
  } catch (error) {
    showAlert("Error al cargar rutas predeterminadas: " + error.message, "error");
  }
}

function updateUI() {
  updateStats();
  updateDomainList();
}

function updateStats() {
  const domains = new Set(currentRoutes.map(r => r.domain));
  const active = currentRoutes.filter(r => r.status !== "legacy").length;
  
  currentStats = {
    total: currentRoutes.length,
    domains: domains.size,
    active
  };
  
  document.getElementById("totalRoutes").textContent = currentStats.total;
  document.getElementById("totalDomains").textContent = currentStats.domains;
  document.getElementById("activeRoutes").textContent = currentStats.active;
}

function updateDomainList() {
  const domainList = document.getElementById("domainList");
  const domainGroups = {};
  
  currentRoutes.forEach(route => {
    if (!domainGroups[route.domain]) {
      domainGroups[route.domain] = 0;
    }
    domainGroups[route.domain]++;
  });
  
  const domains = Object.keys(domainGroups).sort();
  
  if (domains.length === 0) {
    domainList.innerHTML = '<p style="color: #9ca3af; text-align: center;">No hay dominios configurados</p>';
    return;
  }
  
  domainList.innerHTML = domains.map(domain => `
    <div class="domain-item">
      <span class="domain-name">${escapeHtml(domain)}</span>
      <span class="domain-count">${domainGroups[domain]} rutas</span>
    </div>
  `).join("");
}

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");
  const routes = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;
    
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

function routesToCSV(routes) {
  const headers = "domain,id,module,title,url,tags,description,status";
  const rows = routes.map(route => {
    const tags = route.tag.join("|");
    return [
      route.domain,
      route.id,
      route.module,
      route.title,
      route.url,
      `"${tags}"`,
      route.description,
      route.status || "active"
    ].join(",");
  });
  
  return [headers, ...rows].join("\n");
}

async function downloadTemplate() {
  try {
    const response = await fetch(CSV_TEMPLATE_URL);
    const csvText = await response.text();
    downloadFile(csvText, "routes-template.csv", "text/csv");
    showAlert("Plantilla descargada correctamente", "success");
  } catch (error) {
    showAlert("Error al descargar plantilla: " + error.message, "error");
  }
}

async function exportCurrentRoutes() {
  if (currentRoutes.length === 0) {
    showAlert("No hay rutas para exportar", "info");
    return;
  }
  
  try {
    const csvText = routesToCSV(currentRoutes);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(csvText, `routes-export-${timestamp}.csv`, "text/csv");
    showAlert(`${currentRoutes.length} rutas exportadas correctamente`, "success");
  } catch (error) {
    showAlert("Error al exportar rutas: " + error.message, "error");
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.endsWith(".csv")) {
    showAlert("Por favor selecciona un archivo CSV válido", "error");
    event.target.value = "";
    return;
  }
  
  try {
    const text = await file.text();
    const routes = parseCSV(text);
    
    if (routes.length === 0) {
      showAlert("El archivo CSV no contiene rutas válidas", "error");
      event.target.value = "";
      return;
    }
    
    const domains = new Set(routes.map(r => r.domain));
    const confirmMsg = `¿Confirmar importación de ${routes.length} rutas para ${domains.size} dominio(s)?\n\nEsto reemplazará todas las rutas actuales.`;
    
    if (!confirm(confirmMsg)) {
      event.target.value = "";
      return;
    }
    
    await chrome.storage.local.set({ [STORAGE_KEY]: routes });
    currentRoutes = routes;
    updateUI();
    showAlert(`${routes.length} rutas importadas correctamente`, "success");
    event.target.value = "";
  } catch (error) {
    showAlert("Error al importar CSV: " + error.message, "error");
    event.target.value = "";
  }
}

async function clearAllRoutes() {
  if (!confirm("⚠️ ¿Estás seguro de eliminar TODAS las rutas?\n\nEsta acción no se puede deshacer.")) {
    return;
  }
  
  if (!confirm("🚨 ÚLTIMA CONFIRMACIÓN: Se eliminarán todas las rutas configuradas.")) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    currentRoutes = [];
    updateUI();
    showAlert("Todas las rutas han sido eliminadas", "success");
  } catch (error) {
    showAlert("Error al eliminar rutas: " + error.message, "error");
  }
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showAlert(message, type = "info") {
  const container = document.getElementById("alertContainer");
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} show`;
  
  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️"
  };
  
  alert.innerHTML = `
    <span style="font-size: 20px;">${icons[type] || icons.info}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;
  
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.classList.remove("show");
    setTimeout(() => {
      container.removeChild(alert);
    }, 300);
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
