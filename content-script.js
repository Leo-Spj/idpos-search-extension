(() => {
  const OVERLAY_ID = "idpos-command-root";
  const MAX_RESULTS = 40;
  const MUTATION_THROTTLE = 2000;
  const STORAGE_USAGE_PREFIX = "usage:";
  const STORAGE_SHORTCUT_KEY = "customShortcut";
  const STATIC_DATA_URL = chrome.runtime.getURL("data/navigation_tree.json");
  const DEPRECATED_CATEGORY_KEY = "deprecado";
  const DEFAULT_SHORTCUT = { meta: false, ctrl: true, shift: true, alt: false, key: "k" };
  const SEARCH_CACHE_TTL = 1000 * 60 * 5;
  const SEARCH_CACHE_MAX_ENTRIES = 40;
  const STORAGE_FLUSH_DELAY = 800;
  const ERROR_LOG_THROTTLE = 15000;

  const state = {
    open: false,
    shadow: null,
    host: null,
    input: null,
    list: null,
    container: null,
    footerBadge: null,
    emptyState: null,
    shiftIndicator: null,
    categoryFilter: null,
    categoryName: null,
    results: [],
    nodes: [],
    staticNodes: [],
    usageMap: new Map(),
    frequencyData: {
      lastAccess: new Map(),
      accessCount: new Map(),
      timeOfDay: new Map(),
      weekday: new Map()
    },
    selectedIndex: 0,
    lastScan: 0,
    mutationTimer: null,
    initialized: false,
    shortcut: null,
    loadingStatic: false,
    scanning: false,
    shiftPressed: false,
    activeCategory: null,
    nodeVersion: 0,
    searchCache: new Map(),
    pendingStorage: new Map(),
    storageFlushTimer: null,
    lastErrorLog: new Map()
  };

  const templateHtml = `
    <style>
      :host {
        all: initial;
      }
      .overlay {
        position: fixed;
        top: 10vh;
        left: 50%;
        transform: translateX(-50%) translateY(-12px);
        width: min(720px, 92vw);
        background: rgba(29, 30, 33, 0.82);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        color: #f5f5f7;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        padding: 12px 12px 10px 12px;
        transition: opacity 140ms ease, transform 160ms ease;
        z-index: 2147480000;
      }
      .overlay.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
      }
      .command-input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 9px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font-size: 15px;
        line-height: 1.4;
        outline: none;
        box-sizing: border-box;
      }
      .command-input::placeholder {
        color: rgba(255, 255, 255, 0.45);
      }
      .results {
        margin: 12px 0 0 0;
        padding: 0;
        list-style: none;
        max-height: min(56vh, 520px);
        overflow-y: auto;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.04);
      }
      .results::-webkit-scrollbar {
        width: 8px;
      }
      .results::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 9px;
      }
      .results::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .results::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      /* Scrollbar para Firefox */
      .results {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
      }
      .result-item {
        display: flex;
        flex-direction: column;
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }
      .result-item:last-child {
        border-bottom: none;
      }
      .result-item.active {
        background: rgba(91, 134, 229, 0.38);
      }
      .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .result-title-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }
      .module-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .module-badge.ventas {
        background: rgba(59, 130, 246, 0.25);
        color: #93c5fd;
        border: 1px solid rgba(59, 130, 246, 0.4);
      }
      .module-badge.inventarios {
        background: rgba(168, 85, 247, 0.25);
        color: #d8b4fe;
        border: 1px solid rgba(168, 85, 247, 0.4);
      }
      .module-badge.compras {
        background: rgba(34, 197, 94, 0.25);
        color: #86efac;
        border: 1px solid rgba(34, 197, 94, 0.4);
      }
      .module-badge.reportes {
        background: rgba(251, 146, 60, 0.25);
        color: #fdba74;
        border: 1px solid rgba(251, 146, 60, 0.4);
      }
      .module-badge.dashboard {
        background: rgba(236, 72, 153, 0.25);
        color: #f9a8d4;
        border: 1px solid rgba(236, 72, 153, 0.4);
      }
      .module-badge.produccion {
        background: rgba(14, 165, 233, 0.25);
        color: #7dd3fc;
        border: 1px solid rgba(14, 165, 233, 0.4);
      }
      .module-badge.cajas {
        background: rgba(234, 179, 8, 0.25);
        color: #fde047;
        border: 1px solid rgba(234, 179, 8, 0.4);
      }
      .module-badge.servicios {
        background: rgba(20, 184, 166, 0.25);
        color: #5eead4;
        border: 1px solid rgba(20, 184, 166, 0.4);
      }
      .module-badge.kds {
        background: rgba(239, 68, 68, 0.25);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }
      .module-badge.default {
        background: rgba(148, 163, 184, 0.25);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.4);
      }
      .result-title {
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
        flex: 1;
        min-width: 0;
      }
      .result-path-tags {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        margin-left: auto;
      }
      .path-tag {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .path-separator {
        font-size: 9px;
        color: rgba(255, 255, 255, 0.3);
        margin: 0 -2px;
      }
      .result-description {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .footer {
        margin-top: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.52);
        padding: 0 4px;
      }
      .footer kbd {
        background: rgba(255, 255, 255, 0.12);
        padding: 2px 6px;
        border-radius: 5px;
        font-weight: 600;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.85);
      }
      .empty-state {
        padding: 18px;
        text-align: center;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.56);
      }
      .shift-indicator {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(59, 130, 246, 0.9);
        color: #ffffff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        animation: slideIn 0.2s ease;
      }
      .shift-indicator.active {
        display: flex;
      }
      .category-filter {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(34, 197, 94, 0.9);
        color: #ffffff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        animation: slideIn 0.2s ease;
      }
      .category-filter.active {
        display: flex;
      }
      .category-filter .close-btn {
        cursor: pointer;
        padding: 0 4px;
        opacity: 0.8;
        font-size: 16px;
        line-height: 1;
      }
      .category-filter .close-btn:hover {
        opacity: 1;
      }
      .help-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        font-style: italic;
        margin-left: 8px;
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
    <div class="overlay" role="dialog" aria-modal="true" aria-label="ID POS command bar">
      <div class="category-filter" id="category-filter">
        <span id="category-name"></span>
        <span class="close-btn" id="clear-category">×</span>
      </div>
      <div class="shift-indicator" id="shift-indicator">
        <span>⇧</span>
        <span>Abrir en nueva pestaña</span>
      </div>
      <input class="command-input" type="text" placeholder="Buscar módulos, rutas o acciones" autocomplete="off" spellcheck="false" aria-label="Buscar" />
      <ul class="results" role="listbox"></ul>
      <div class="empty-state" hidden>No se encontraron coincidencias.</div>
      <div class="footer">
        <span id="usage-hint">Flechas para navegar - Enter para ir - Esc para cerrar<span class="help-hint">| Usa "módulo:" para filtrar</span></span>
        <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd></span>
      </div>
    </div>
  `;

  document.addEventListener("keydown", handleGlobalShortcut, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", flushPendingStorage);
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "TOGGLE_OVERLAY") return;
    toggleOverlay();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[STORAGE_SHORTCUT_KEY]) return;
    const next = changes[STORAGE_SHORTCUT_KEY].newValue;
    state.shortcut = normalizeShortcut(next || DEFAULT_SHORTCUT);
  });

  init();

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    await Promise.all([loadShortcutPreference(), loadStaticNavigation(), loadUsageCounts()]);
    ensureOverlay();
    scheduleScan(250);
    installObservers();
  }

  function ensureOverlay() {
    if (state.host) return;
    const host = document.createElement("div");
    host.id = OVERLAY_ID;
    host.setAttribute("role", "presentation");
    
    // Estilos para el host para cubrir toda la pantalla
    host.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147480000;
      pointer-events: none;
    `;
    
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = templateHtml;
    document.documentElement.appendChild(host);

    const overlay = shadow.querySelector(".overlay");
    const input = shadow.querySelector(".command-input");
    const list = shadow.querySelector(".results");
    const empty = shadow.querySelector(".empty-state");
    const footerHint = shadow.querySelector("#usage-hint");
    const shiftIndicator = shadow.querySelector("#shift-indicator");
    const categoryFilter = shadow.querySelector("#category-filter");
    const categoryName = shadow.querySelector("#category-name");
    const clearCategory = shadow.querySelector("#clear-category");

    state.host = host;
    state.shadow = shadow;
    state.container = overlay;
    state.input = input;
    state.list = list;
    state.emptyState = empty;
    state.footerBadge = footerHint;
    state.shiftIndicator = shiftIndicator;
    state.categoryFilter = categoryFilter;
    state.categoryName = categoryName;

    input.addEventListener("input", handleQueryInput);
    input.addEventListener("keydown", handleInputKeys);
    list.addEventListener("click", onResultClick);
    
    // Listeners para detectar Shift
    overlay.addEventListener("keydown", handleShiftDown);
    overlay.addEventListener("keyup", handleShiftUp);
    
    // Listener para limpiar el filtro de categoría
    clearCategory.addEventListener("click", () => {
      clearCategoryIndicator();
      if (state.input) {
        state.input.value = "";
        state.input.focus();
        handleQueryInput({ target: state.input });
      }
    });
    
    // Listener para cerrar al hacer clic fuera del overlay
    host.addEventListener("click", handleOutsideClick);
  }

  function toggleOverlay() {
    state.open ? closeOverlay() : openOverlay();
  }

  function openOverlay() {
    ensureOverlay();
    if (!state.container || state.open) return;
    state.open = true;
    state.container.classList.add("open");
    if (state.host) state.host.style.pointerEvents = "auto";
    if (state.input) {
      state.input.value = "";
      state.input.focus({ preventScroll: true });
    }
    state.selectedIndex = 0;
    renderResults(getDefaultResults());
  }

  function closeOverlay() {
    if (!state.container || !state.open) return;
    state.open = false;
    state.shiftPressed = false;
    state.container.classList.remove("open");
    if (state.host) state.host.style.pointerEvents = "none";
    if (state.input) state.input.blur();
    updateShiftIndicator();
  }

  function handleOutsideClick(event) {
    if (!state.open) return;
    // Si el clic fue en el overlay mismo (contenido interno), no cerrar
    if (event.target === state.container || state.container.contains(event.target)) {
      return;
    }
    // Si el clic fue fuera del overlay, cerrar
    closeOverlay();
  }

  function handleQueryInput(event) {
    const query = event.target.value.trim();
    if (!query) {
      clearCategoryIndicator();
      renderResults(getDefaultResults());
      return;
    }
    
    // Detectar búsqueda por categoría con formato "módulo: query"
    const categoryMatch = query.match(/^([a-záéíóúñ]+):\s*(.*)$/i);
    let filtered = state.nodes;
    let searchQuery = query;
    
    if (categoryMatch) {
      const [, category, rest] = categoryMatch;
      const normalizedCategory = removeAccents(category.toLowerCase());
      
      // Filtrar por módulo
      filtered = state.nodes.filter(node => {
        const nodeModule = removeAccents((node.module || "").toLowerCase());
        return nodeModule.includes(normalizedCategory);
      });
      
      searchQuery = rest.trim();
      state.activeCategory = category;
      
      // Mostrar indicador visual
      updateCategoryIndicator(category);
    } else {
      state.activeCategory = null;
      clearCategoryIndicator();
    }
    
    if (!searchQuery) {
      const fallback = filtered.slice(0, MAX_RESULTS).map(mapNodeToResult);
      renderResults(fallback);
      return;
    }

    const cacheKey = buildCacheKey(searchQuery, state.activeCategory);
    const cached = getCachedResults(cacheKey);
    if (cached) {
      renderResults(cached);
      return;
    }

    const ranked = rankResults(searchQuery, filtered);
    setCachedResults(cacheKey, ranked);
    renderResults(ranked);
  }

  function handleInputKeys(event) {
    if (!state.results.length) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
      return;
    }
    const maxIndex = state.results.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        state.selectedIndex = state.selectedIndex >= maxIndex ? 0 : state.selectedIndex + 1;
        updateActiveItem();
        break;
      case "ArrowUp":
        event.preventDefault();
        state.selectedIndex = state.selectedIndex <= 0 ? maxIndex : state.selectedIndex - 1;
        updateActiveItem();
        break;
      case "Enter":
        event.preventDefault();
        activateSelected(event.shiftKey);
        break;
      case "Escape":
        event.preventDefault();
        closeOverlay();
        break;
      case "Tab":
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  function onResultClick(event) {
    const target = event.target.closest(".result-item");
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    state.selectedIndex = index;
    activateSelected(event.shiftKey);
  }

  function activateSelected(openInNewTab = false) {
    const selection = state.results[state.selectedIndex];
    if (!selection) return;
    incrementUsage(selection);
    closeOverlay();
    
    if (selection.action === "click" && selection.nodeRef) {
      selection.nodeRef.click();
      return;
    }
    
    if (!selection.url) return;
    
    // Abrir en nueva pestaña si Shift está presionado
    if (openInNewTab || state.shiftPressed) {
      // Crear un enlace temporal y simular un clic con ctrl para asegurar que se abra en pestaña
      const link = document.createElement("a");
      link.href = selection.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.style.display = "none";
      document.body.appendChild(link);
      
      // Simular clic con Ctrl/Cmd para forzar apertura en nueva pestaña
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
        ctrlKey: true,
        metaKey: navigator.platform.includes("Mac")
      });
      
      link.dispatchEvent(clickEvent);
      document.body.removeChild(link);
    } else {
      window.location.assign(selection.url);
    }
  }

  function handleShiftDown(event) {
    if (event.key === "Shift" && !state.shiftPressed) {
      state.shiftPressed = true;
      updateShiftIndicator();
    }
  }

  function handleShiftUp(event) {
    if (event.key === "Shift" && state.shiftPressed) {
      state.shiftPressed = false;
      updateShiftIndicator();
    }
  }

  function updateShiftIndicator() {
    if (!state.shiftIndicator) return;
    if (state.shiftPressed) {
      state.shiftIndicator.classList.add("active");
    } else {
      state.shiftIndicator.classList.remove("active");
    }
  }

  function updateCategoryIndicator(category) {
    if (!state.categoryFilter || !state.categoryName) return;
    state.categoryName.textContent = `Filtrando: ${category}`;
    state.categoryFilter.classList.add("active");
  }

  function clearCategoryIndicator() {
    if (!state.categoryFilter) return;
    state.categoryFilter.classList.remove("active");
    state.activeCategory = null;
  }

  function renderResults(results) {
    state.results = results;
    state.selectedIndex = 0;
    if (!state.list || !state.emptyState) return;

    state.list.textContent = "";
    if (!results.length) {
      state.emptyState.hidden = false;
      return;
    }
    state.emptyState.hidden = true;

    const fragment = document.createDocumentFragment();
    results.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "result-item" + (index === 0 ? " active" : "");
      li.dataset.index = String(index);
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", index === 0 ? "true" : "false");

      const header = document.createElement("div");
      header.className = "result-header";

      if (item.module) {
        const badge = document.createElement("span");
        badge.className = "module-badge " + getModuleClass(item.module);
        badge.textContent = item.module;
        header.appendChild(badge);
      }

      // Wrapper para título y etiquetas de path
      const titleWrapper = document.createElement("div");
      titleWrapper.className = "result-title-wrapper";

      const titleSpan = document.createElement("div");
      titleSpan.className = "result-title";
      
      // Si el título es igual al módulo, usar el pathLabel completo
      const normalizedTitle = (item.title || "").trim().toLowerCase();
      const normalizedModule = (item.module || "").trim().toLowerCase();
      
      if (normalizedTitle === normalizedModule && item.pathLabel) {
        titleSpan.textContent = item.pathLabel;
      } else {
        titleSpan.textContent = item.title;
      }
      
      titleWrapper.appendChild(titleSpan);

      // Agregar etiquetas de path en el lado derecho
      if (item.path && item.path.length > 1) {
        const pathTags = document.createElement("div");
        pathTags.className = "result-path-tags";
        
        // Mostrar el path completo excepto el último elemento (que suele ser el título)
        const pathToShow = item.path.slice(0, -1);
        
        pathToShow.forEach((pathPart, idx) => {
          if (idx > 0) {
            const separator = document.createElement("span");
            separator.className = "path-separator";
            separator.textContent = "›";
            pathTags.appendChild(separator);
          }
          
          const tag = document.createElement("span");
          tag.className = "path-tag";
          tag.textContent = pathPart;
          pathTags.appendChild(tag);
        });
        
        titleWrapper.appendChild(pathTags);
      }

      header.appendChild(titleWrapper);
      li.appendChild(header);

      if (item.description) {
        const desc = document.createElement("div");
        desc.className = "result-description";
        desc.textContent = item.description;
        li.appendChild(desc);
      }

      fragment.appendChild(li);
    });

    state.list.appendChild(fragment);
  }

  function updateActiveItem() {
    if (!state.list) return;
    const children = state.list.querySelectorAll(".result-item");
    children.forEach((child, idx) => {
      if (idx === state.selectedIndex) {
        child.classList.add("active");
        child.setAttribute("aria-selected", "true");
        child.scrollIntoView({ block: "nearest" });
      } else {
        child.classList.remove("active");
        child.setAttribute("aria-selected", "false");
      }
    });
  }

  function getDefaultResults() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    // Score contextual para cada nodo
    const contextualNodes = state.nodes.map(node => {
      let contextScore = 0;
      
      // Componente de frecuencia (peso principal)
      const usageCount = node.usage || 0;
      contextScore += usageCount * 100;
      
      // Componente de recencia
      const lastAccess = state.frequencyData.lastAccess.get(node.id);
      if (lastAccess) {
        const hoursSince = (Date.now() - lastAccess) / (1000 * 60 * 60);
        contextScore += 500 * Math.exp(-hoursSince / 16);
      }
      
      // Componente temporal
      const timeKey = `${node.id}:${currentHour}`;
      if (state.frequencyData.timeOfDay.has(timeKey)) {
        contextScore += state.frequencyData.timeOfDay.get(timeKey) * 50;
      }
      
      const dayKey = `${node.id}:${currentDay}`;
      if (state.frequencyData.weekday.has(dayKey)) {
        contextScore += state.frequencyData.weekday.get(dayKey) * 30;
      }
      
      // Bonus por fuente estática
      if (node.source === "static") {
        contextScore += 20;
      }
      
      // Penalización por profundidad
      contextScore -= node.depth * 5;
      
      return { node, contextScore };
    });
    
    // Separar deprecados de no deprecados
    const deprecated = contextualNodes.filter(item => isDeprecated(item.node));
    const active = contextualNodes.filter(item => !isDeprecated(item.node));
    
    // Ordenar cada grupo
    const sortByContext = (a, b) => {
      if (Math.abs(b.contextScore - a.contextScore) < 0.1) {
        return compareByCategoryAndPath(a.node, b.node);
      }
      return b.contextScore - a.contextScore;
    };
    
    active.sort(sortByContext);
    deprecated.sort(sortByContext);
    
    // Combinar: primero activos, luego deprecados
    const combined = [...active, ...deprecated];
    
    return combined.slice(0, MAX_RESULTS).map(item => mapNodeToResult(item.node));
  }

  function mapNodeToResult(node) {
    const hierarchy = node.path && node.path.length ? node.path.join(" > ") : node.title;
    return {
      id: node.id,
      title: node.title,
      description: node.description || "",
      url: node.url,
      action: node.action,
      nodeRef: node.ref,
      pathLabel: hierarchy,
      path: node.path || [],
      module: node.module || "",
      usage: node.usage || 0
    };
  }

  function buildCacheKey(query, category) {
    const normalizedQuery = removeAccents(query.toLowerCase());
    const normalizedCategory = removeAccents((category || "__all__").toLowerCase());
    return `${normalizedCategory}::${normalizedQuery}`;
  }

  function getCachedResults(key) {
    const cached = state.searchCache.get(key);
    if (!cached) return null;
    const expired = Date.now() - cached.timestamp > SEARCH_CACHE_TTL;
    if (expired || cached.nodeVersion !== state.nodeVersion) {
      state.searchCache.delete(key);
      return null;
    }
    return cached.results;
  }

  function setCachedResults(key, results) {
    state.searchCache.set(key, {
      results,
      timestamp: Date.now(),
      nodeVersion: state.nodeVersion
    });
    pruneSearchCache();
  }

  function pruneSearchCache() {
    while (state.searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
      const oldest = state.searchCache.keys().next();
      if (oldest.done) break;
      state.searchCache.delete(oldest.value);
    }
  }

  function rankResults(query, nodes) {
    const sanitized = removeAccents(query.toLowerCase());
    const tokens = sanitized.split(/\s+/).filter(Boolean);
    if (!tokens.length) return getDefaultResults();

    const scored = [];
    for (const node of nodes) {
      const score = scoreNode(tokens, node);
      if (score <= 0) continue;
      scored.push({ score, node });
    }
    
    // Separar deprecados de no deprecados
    const deprecated = scored.filter(item => isDeprecated(item.node));
    const active = scored.filter(item => !isDeprecated(item.node));
    
    // Ordenar cada grupo por score
    const sortByScore = (a, b) => {
      if (Math.abs(b.score - a.score) < 0.1) {
        return compareByCategoryAndPath(a.node, b.node);
      }
      return b.score - a.score;
    };
    
    active.sort(sortByScore);
    deprecated.sort(sortByScore);
    
    // Combinar: primero activos, luego deprecados
    const combined = [...active, ...deprecated];
    
    return combined.slice(0, MAX_RESULTS).map(item => mapNodeToResult(item.node));
  }

  function scoreNode(tokens, node) {
    const title = node.titleLower;
    const path = node.pathLower;
    const description = removeAccents((node.description || "").toLowerCase());
    let textScore = 0;
    let matchQuality = 0; // Calidad de la coincidencia (0-1)

    // Scoring por coincidencia de texto con mejor granularidad
    for (const token of tokens) {
      if (!token) continue;
      
      let tokenScore = 0;
      let tokenQuality = 0;
      
      // Coincidencia exacta en título (máxima prioridad)
      if (title === token) {
        tokenScore = 1000;
        tokenQuality = 1.0;
      }
      // Título comienza con el token
      else if (title.startsWith(token)) {
        tokenScore = 800;
        tokenQuality = 0.9;
      }
      // Token es una palabra completa en el título
      else if (new RegExp(`\\b${escapeRegex(token)}\\b`).test(title)) {
        tokenScore = 600;
        tokenQuality = 0.8;
      }
      // Título contiene el token
      else if (title.includes(token)) {
        tokenScore = 400;
        tokenQuality = 0.7;
      }
      // Path contiene el token como palabra completa
      else if (new RegExp(`\\b${escapeRegex(token)}\\b`).test(path)) {
        tokenScore = 300;
        tokenQuality = 0.6;
      }
      // Path contiene el token
      else if (path.includes(token)) {
        tokenScore = 200;
        tokenQuality = 0.5;
      }
      // Descripción contiene el token
      else if (description.includes(token)) {
        tokenScore = 150;
        tokenQuality = 0.4;
      }
      // Coincidencia fuzzy en título
      else if (fuzzyIncludes(title, token)) {
        tokenScore = 100;
        tokenQuality = 0.3;
      }
      // Coincidencia fuzzy en path
      else if (fuzzyIncludes(path, token)) {
        tokenScore = 50;
        tokenQuality = 0.2;
      }
      // No hay coincidencia
      else {
        return 0; // Si falla un token, el nodo no es relevante
      }
      
      textScore += tokenScore;
      matchQuality += tokenQuality;
    }
    
    // Normalizar calidad de coincidencia
    matchQuality = matchQuality / tokens.length;
    
    // Componente de frecuencia (normalizado entre 0-500)
    const usageCount = node.usage || 0;
    const frequencyScore = Math.min(500, usageCount * 50);
    
    // Componente de recencia (0-300)
    let recencyScore = 0;
    const lastAccess = state.frequencyData.lastAccess.get(node.id);
    if (lastAccess) {
      const hoursSince = (Date.now() - lastAccess) / (1000 * 60 * 60);
      // Decay más pronunciado: 100% en hora 0, 50% en 12 horas, ~10% en 48 horas
      recencyScore = 300 * Math.exp(-hoursSince / 16);
    }
    
    // Componente temporal contextual (0-200)
    let temporalScore = 0;
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    const timeKey = `${node.id}:${currentHour}`;
    const dayKey = `${node.id}:${currentDay}`;
    
    // Patrón por hora (más peso si se usa frecuentemente a esta hora)
    if (state.frequencyData.timeOfDay.has(timeKey)) {
      const hourCount = state.frequencyData.timeOfDay.get(timeKey);
      temporalScore += Math.min(100, hourCount * 20);
    }
    
    // Patrón por día (más peso si se usa frecuentemente este día)
    if (state.frequencyData.weekday.has(dayKey)) {
      const dayCount = state.frequencyData.weekday.get(dayKey);
      temporalScore += Math.min(100, dayCount * 15);
    }
    
    // Bonus por fuente estática (más confiable)
    const staticBonus = node.source === "static" ? 50 : 0;
    
    // Penalización por profundidad (nodos más profundos son menos relevantes)
    const depthPenalty = node.depth * 10;
    
    // Score final compuesto con pesos ajustados
    let finalScore = textScore * 1.0 +                    // Coincidencia de texto (peso 100%)
                     frequencyScore * matchQuality * 0.8 + // Frecuencia (peso 80%, modulado por calidad)
                     recencyScore * matchQuality * 0.7 +   // Recencia (peso 70%, modulado por calidad)
                     temporalScore * matchQuality * 0.5 +  // Contexto temporal (peso 50%, modulado por calidad)
                     staticBonus -                         // Bonus estático
                     depthPenalty;                         // Penalización profundidad
    
    // Boost adicional si coinciden TODOS los tokens perfectamente
    if (matchQuality >= 0.9 && tokens.length > 1) {
      finalScore *= 1.2; // 20% de boost
    }
    
    return Math.max(0, finalScore);
  }

  function fuzzyIncludes(haystack, needle) {
    if (needle.length <= 2) return haystack.includes(needle);
    
    let index = 0;
    let lastMatchIndex = -1;
    let gapCount = 0;
    
    for (let i = 0; i < haystack.length; i++) {
      if (haystack[i] === needle[index]) {
        // Penalizar gaps grandes entre caracteres
        if (lastMatchIndex >= 0 && (i - lastMatchIndex) > 2) {
          gapCount++;
        }
        lastMatchIndex = i;
        index++;
        if (index === needle.length) {
          // Solo considerar fuzzy match si no hay demasiados gaps
          return gapCount <= Math.floor(needle.length / 2);
        }
      }
    }
    
    return false;
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function removeAccents(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  async function loadStaticNavigation() {
    state.loadingStatic = true;
    try {
      const response = await fetch(STATIC_DATA_URL);
      if (!response.ok) return;
      const payload = await response.json();
      state.staticNodes = payload.map(item => normalizeNode(item, "static"));
      mergeNodes([]);
    } catch (error) {
      logWarningThrottled("static-data", "IDPOS Navigator: static navigation not available", error);
    } finally {
      state.loadingStatic = false;
    }
  }

  function normalizeNode(raw, source) {
    const id = raw.id || `${source}:${raw.url || raw.title}`;
    const path = Array.isArray(raw.path) ? raw.path : buildPath(raw.pathLabel);
    const depth = path.length ? path.length - 1 : 0;
    const title = raw.title || (path.length ? path[path.length - 1] : "");
    return {
      id,
      title,
      titleLower: removeAccents(title.toLowerCase()),
      path,
      pathLower: removeAccents(path.join(" ").toLowerCase()),
      pathLabel: raw.pathLabel || path.join(" > "),
      url: absoluteUrl(raw.url),
      description: raw.description || "",
      module: raw.module || "",
      depth,
      action: raw.action || (raw.url ? "navigate" : null),
      source,
      ref: raw.ref || null,
      usage: 0
    };
  }

  function getModuleClass(module) {
    const normalized = module.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    const moduleMap = {
      "ventas": "ventas",
      "inventarios": "inventarios",
      "compras": "compras",
      "reportes": "reportes",
      "dashboard": "dashboard",
      "produccion": "produccion",
      "cajas": "cajas",
      "servicios": "servicios",
      "kds": "kds"
    };
    
    return moduleMap[normalized] || "default";
  }

  function buildPath(path) {
    if (!path) return [];
    if (Array.isArray(path)) return path;
    return String(path).split("|").map(piece => piece.trim()).filter(Boolean);
  }

  function absoluteUrl(url) {
    if (!url) return "";
    if (/^https?:/i.test(url)) return url;
    if (url.startsWith("/")) return `${location.origin}${url}`;
    return `${location.origin}/${url}`;
  }

  function scheduleScan(delay) {
    if (state.scanning) return;
    state.scanning = true;
    window.setTimeout(async () => {
      try {
        const domNodes = await scanDom();
        mergeNodes(domNodes);
      } finally {
        state.scanning = false;
      }
    }, delay);
  }

  async function scanDom() {
    const start = performance.now();
    const domNodes = [];
    const selector = [
      "a[href]",
      'button[data-route]','button[role="menuitem"]',
      "[data-menu-item]",
      "[data-testid*='menu'] a[href]",
      "[role='menuitem']",
      "[role='tab']",
      "[data-link]"
    ].join(",");

    const elements = Array.from(document.querySelectorAll(selector));
    const seen = new Set();
    for (const element of elements) {
      const node = elementToNode(element);
      if (!node) continue;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      domNodes.push(node);
    }

    state.lastScan = performance.now() - start;
    return domNodes;
  }

  function elementToNode(element) {
    const text = getNodeText(element);
    if (!text) return null;

    let url = null;
    if (element instanceof HTMLAnchorElement && element.href) {
      url = sanitizeHref(element.href);
    } else if (element instanceof HTMLButtonElement && element.dataset.route) {
      url = absoluteUrl(element.dataset.route);
    } else if (element.dataset.link) {
      url = absoluteUrl(element.dataset.link);
    }

    const description = element.getAttribute("aria-description") || element.getAttribute("aria-label") || element.getAttribute("title") || "";
    const path = deriveHierarchy(element, text);
    const idBase = url || path.join("::") || text;
    const module = path.length > 0 ? path[0] : "";

    return {
      id: `dom:${idBase}`,
      title: text,
      titleLower: removeAccents(text.toLowerCase()),
      path,
      pathLower: removeAccents(path.join(" ").toLowerCase()),
      pathLabel: path.join(" > "),
      url,
      description,
      module,
      depth: path.length ? path.length - 1 : 0,
      action: url ? "navigate" : "click",
      source: "dom",
      ref: element,
      usage: 0
    };
  }

  function deriveHierarchy(element, text) {
    const parts = [];
    let current = element;
    while (current) {
      if (current === document.body) break;
      if (current instanceof HTMLElement) {
        if (current.dataset.section) parts.unshift(current.dataset.section.trim());
        const label = current.getAttribute("aria-label") || current.getAttribute("data-title");
        if (label) parts.unshift(label.trim());
        if (current.classList.contains("menu-label")) {
          const labelText = current.textContent.trim();
          if (labelText) parts.unshift(labelText);
        }
      }
      current = current.parentElement;
      if (parts.length >= 4) break;
    }
    parts.push(text);
    const sanitized = parts.filter(Boolean);
    if (!sanitized.length) sanitized.push(text);
    return dedupePath(sanitized);
  }

  function dedupePath(path) {
    const result = [];
    for (const item of path) {
      if (!item) continue;
      if (result[result.length - 1] === item) continue;
      result.push(item);
    }
    return result;
  }

  function getNodeText(element) {
    const raw = element.textContent || "";
    const trimmed = raw.replace(/\s+/g, " ").trim();
    if (trimmed.length < 2) return null;
    return trimmed;
  }

  function sanitizeHref(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return href;
      return url.href;
    } catch (error) {
      return href;
    }
  }

  function mergeNodes(domNodes) {
    const usage = state.usageMap;
    const byId = new Map();
    const byUrl = new Map();
    const combined = [...state.staticNodes, ...domNodes];

    for (const node of combined) {
      const existingUsage = usage.get(node.id) || 0;
      node.usage = existingUsage;
      
      // Deduplicar por URL si existe
      if (node.url) {
        const normalizedUrl = node.url.toLowerCase().trim();
        const existing = byUrl.get(normalizedUrl);
        
        if (existing) {
          // Si ya existe un nodo con la misma URL, priorizar el estático
          if (existing.source === "static" && node.source === "dom") {
            continue; // Saltar el nodo del DOM
          } else if (node.source === "static" && existing.source === "dom") {
            // Reemplazar el nodo del DOM con el estático
            byId.delete(existing.id);
          }
        }
        
        byUrl.set(normalizedUrl, node);
      }
      
      byId.set(node.id, node);
    }

    state.nodes = Array.from(byId.values()).filter(node => node.url || node.action === "click");
    state.nodeVersion += 1;

    if (state.footerBadge) {
      const total = state.nodes.length;
      state.footerBadge.textContent = `Flechas para navegar - Enter para ir - Esc para cerrar - ${total} rutas indexadas`;
    }

    if (state.open) {
      const query = state.input ? state.input.value.trim() : "";
      if (query) renderResults(rankResults(query, state.nodes));
      else renderResults(getDefaultResults());
    }
  }

  function incrementUsage(selection) {
    const id = selection.id;
    const now = Date.now();
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Actualizar contador básico
    const nextValue = (state.usageMap.get(id) || 0) + 1;
    state.usageMap.set(id, nextValue);
    
    // Análisis de frecuencia
    const freq = state.frequencyData;
    freq.lastAccess.set(id, now);
    freq.accessCount.set(id, nextValue);
    
    // Registrar patrón temporal
    const timeKey = `${id}:${hour}`;
    freq.timeOfDay.set(timeKey, (freq.timeOfDay.get(timeKey) || 0) + 1);
    
    const dayKey = `${id}:${day}`;
    freq.weekday.set(dayKey, (freq.weekday.get(dayKey) || 0) + 1);
    
    queueUsagePersist(id, nextValue, {
      lastAccess: now,
      count: nextValue,
      timeOfDay: hour,
      weekday: day
    });
  }

  function queueUsagePersist(id, usageValue, frequencyPayload) {
    state.pendingStorage.set(STORAGE_USAGE_PREFIX + id, usageValue);
    state.pendingStorage.set(`freq:${id}`, frequencyPayload);
    scheduleStorageFlush();
  }

  function scheduleStorageFlush() {
    if (state.storageFlushTimer) return;
    state.storageFlushTimer = window.setTimeout(() => {
      state.storageFlushTimer = null;
      flushPendingStorage();
    }, STORAGE_FLUSH_DELAY);
  }

  function flushPendingStorage() {
    if (state.storageFlushTimer) {
      clearTimeout(state.storageFlushTimer);
      state.storageFlushTimer = null;
    }
    if (!state.pendingStorage.size) return;

    const payload = {};
    for (const [key, value] of state.pendingStorage.entries()) {
      payload[key] = value;
    }
    state.pendingStorage.clear();

    try {
      const maybePromise = chrome.storage.local.set(payload);
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(error => logWarningThrottled("storage", "IDPOS Navigator: storage persist failed", error));
      }
    } catch (error) {
      logWarningThrottled("storage", "IDPOS Navigator: storage persist failed", error);
    }
  }

  async function loadUsageCounts() {
    try {
      const keys = await chrome.storage.local.get(null);
      Object.entries(keys).forEach(([key, value]) => {
        if (key.startsWith(STORAGE_USAGE_PREFIX)) {
          state.usageMap.set(key.replace(STORAGE_USAGE_PREFIX, ""), Number(value) || 0);
        } else if (key.startsWith("freq:")) {
          const id = key.replace("freq:", "");
          const freqData = value;
          
          if (freqData && typeof freqData === "object") {
            if (freqData.lastAccess) {
              state.frequencyData.lastAccess.set(id, freqData.lastAccess);
            }
            if (freqData.count) {
              state.frequencyData.accessCount.set(id, freqData.count);
            }
            if (typeof freqData.timeOfDay === "number") {
              const timeKey = `${id}:${freqData.timeOfDay}`;
              state.frequencyData.timeOfDay.set(timeKey, (state.frequencyData.timeOfDay.get(timeKey) || 0) + 1);
            }
            if (typeof freqData.weekday === "number") {
              const dayKey = `${id}:${freqData.weekday}`;
              state.frequencyData.weekday.set(dayKey, (state.frequencyData.weekday.get(dayKey) || 0) + 1);
            }
          }
        }
      });
    } catch (error) {
      logWarningThrottled("usage-load", "IDPOS Navigator: usage stats unavailable", error);
    }
  }

  function installObservers() {
    const observer = new MutationObserver(() => {
      if (state.mutationTimer) return;
      state.mutationTimer = window.setTimeout(() => {
        state.mutationTimer = null;
        scheduleScan(50);
      }, MUTATION_THROTTLE);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    const originalPushState = history.pushState;
    history.pushState = function pushStateWrapper(...args) {
      const ret = originalPushState.apply(this, args);
      scheduleScan(200);
      return ret;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function replaceStateWrapper(...args) {
      const ret = originalReplaceState.apply(this, args);
      scheduleScan(200);
      return ret;
    };

    window.addEventListener("popstate", () => scheduleScan(200));
  }

  function handleGlobalShortcut(event) {
    if (event.defaultPrevented) return;
    if (!state.shortcut) return;
    if (state.open && event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (!matchesShortcut(event, state.shortcut)) return;
    if (shouldIgnoreKeyTarget(event.target)) return;
    event.preventDefault();
    toggleOverlay();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      flushPendingStorage();
    }
  }

  function matchesShortcut(event, shortcut) {
    if (!shortcut) return false;
    const key = normalizeKey(event.key);
    return shortcut.key === key && event.altKey === !!shortcut.alt && event.metaKey === !!shortcut.meta && event.ctrlKey === !!shortcut.ctrl && event.shiftKey === !!shortcut.shift;
  }

  function shouldIgnoreKeyTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (!tag) return false;
    const isEditable = target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    return isEditable;
  }

  async function loadShortcutPreference() {
    try {
      const store = await chrome.storage.local.get(STORAGE_SHORTCUT_KEY);
      state.shortcut = normalizeShortcut(store[STORAGE_SHORTCUT_KEY] || DEFAULT_SHORTCUT);
    } catch (error) {
      state.shortcut = normalizeShortcut(DEFAULT_SHORTCUT);
    }
  }

  function normalizeShortcut(data) {
    if (!data) return DEFAULT_SHORTCUT;
    return {
      meta: !!data.meta,
      ctrl: !!data.ctrl,
      shift: !!data.shift,
      alt: !!data.alt,
      key: typeof data.key === "string" ? data.key.toLowerCase() : DEFAULT_SHORTCUT.key
    };
  }

  function normalizeKey(key) {
    if (!key) return "";
    if (key.length === 1) return key.toLowerCase();
    switch (key) {
      case "ArrowUp": return "arrowup";
      case "ArrowDown": return "arrowdown";
      case "ArrowLeft": return "arrowleft";
      case "ArrowRight": return "arrowright";
      default: return key.toLowerCase();
    }
  }

  function logWarningThrottled(channel, ...args) {
    const now = Date.now();
    const last = state.lastErrorLog.get(channel) || 0;
    if (now - last < ERROR_LOG_THROTTLE) return;
    state.lastErrorLog.set(channel, now);
    console.warn(...args);
  }

  function compareByCategoryAndPath(a, b) {
    const categoryA = normalizeCategory(a.module);
    const categoryB = normalizeCategory(b.module);

    const deprecatedA = categoryA === DEPRECATED_CATEGORY_KEY;
    const deprecatedB = categoryB === DEPRECATED_CATEGORY_KEY;
    if (deprecatedA !== deprecatedB) return deprecatedA ? 1 : -1;

    const categoryCompare = categoryA.localeCompare(categoryB, "es", { sensitivity: "base" });
    if (categoryCompare !== 0) return categoryCompare;

    const pathA = String((a.pathLabel || "").trim());
    const pathB = String((b.pathLabel || "").trim());
    const pathCompare = pathA.localeCompare(pathB, "es", { sensitivity: "base" });
    if (pathCompare !== 0) return pathCompare;

    const titleA = String((a.title || "").trim());
    const titleB = String((b.title || "").trim());
    return titleA.localeCompare(titleB, "es", { sensitivity: "base" });
  }

  function normalizeCategory(value) {
    return (value || "").trim().toLowerCase();
  }

  function isDeprecated(node) {
    if (!node) return false;
    const module = normalizeCategory(node.module);
    return module === DEPRECATED_CATEGORY_KEY || node.status === "legacy";
  }

})();
