(() => {
  const OVERLAY_ID = "idpos-command-root";
  const MAX_RESULTS = 40;
  const MUTATION_THROTTLE = 2000;
  const STORAGE_USAGE_PREFIX = "usage:";
  const STORAGE_SHORTCUT_KEY = "customShortcut";
  const STORAGE_ROUTES_KEY = "navigatorRoutes";
  const CSV_DATA_URL = chrome.runtime.getURL("data/routes-example-social.csv");
  const DEFAULT_SHORTCUT = { meta: false, ctrl: true, shift: true, alt: false, key: "k" };
  const currentDomain = window.location.hostname;
  const RANKING_MODULE_URL = chrome.runtime.getURL("scripts/ranking.js");
  const USAGE_FLUSH_INTERVAL = 5000;
  const STATIC_CACHE_CATEGORY = "all";
  const CACHE_ELIGIBLE_SOURCES = new Set(["static"]);

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
    rankingEngine: null,
    staticVersion: 0,
    pendingUsageUpdates: new Map(),
    usageFlushTimer: null
  };

  let rankResults = () => [];
  let getDefaultResults = () => [];
  let mapNodeToResult = defaultMapNodeToResult;
  let buildCacheKey = defaultBuildCacheKey;
  let removeAccents = defaultRemoveAccents;

  function defaultMapNodeToResult(node) {
    const source = node || {};
    const hierarchy = source.tag && source.tag.length ? source.tag.join(" · ") : source.title;
    return {
      id: source.id,
      title: source.title,
      description: source.description || "",
      url: source.url,
      action: source.action,
      nodeRef: source.ref,
      pathLabel: source.pathLabel || hierarchy,
      tag: source.tag || [],
      module: source.module || "",
      usage: source.usage || 0
    };
  }

  function defaultRemoveAccents(text) {
    if (typeof text !== "string") return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function defaultBuildCacheKey(query, category = STATIC_CACHE_CATEGORY) {
    const normalizedQuery = defaultRemoveAccents(String(query || "").toLowerCase()).trim();
    const normalizedCategory = defaultRemoveAccents(String(category || STATIC_CACHE_CATEGORY).toLowerCase()).trim() || STATIC_CACHE_CATEGORY;
    return `${normalizedCategory}::${normalizedQuery}`;
  }

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
        transition: padding 180ms ease;
        position: relative;
      }
      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      .input-overlay {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        font-size: 15px;
        line-height: 1.4;
        color: transparent;
        white-space: pre;
      }
      .input-overlay .filter-prefix {
        color: rgba(34, 197, 94, 1);
        text-shadow: 0 0 8px rgba(34, 197, 94, 0.8),
                     0 0 12px rgba(34, 197, 94, 0.6),
                     0 0 16px rgba(34, 197, 94, 0.4);
        font-weight: 600;
      }
      .command-input.has-category-filter {
        padding-left: 110px;
      }
      .command-input.has-shift-indicator {
        padding-right: 160px;
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
      /* Colores dinámicos basados en hash - Se aplican automáticamente a todos los módulos */
      .module-badge.dynamic-0 {
        background: rgba(59, 130, 246, 0.25);
        color: #93c5fd;
        border: 1px solid rgba(59, 130, 246, 0.4);
      }
      .module-badge.dynamic-1 {
        background: rgba(168, 85, 247, 0.25);
        color: #d8b4fe;
        border: 1px solid rgba(168, 85, 247, 0.4);
      }
      .module-badge.dynamic-2 {
        background: rgba(34, 197, 94, 0.25);
        color: #86efac;
        border: 1px solid rgba(34, 197, 94, 0.4);
      }
      .module-badge.dynamic-3 {
        background: rgba(251, 146, 60, 0.25);
        color: #fdba74;
        border: 1px solid rgba(251, 146, 60, 0.4);
      }
      .module-badge.dynamic-4 {
        background: rgba(236, 72, 153, 0.25);
        color: #f9a8d4;
        border: 1px solid rgba(236, 72, 153, 0.4);
      }
      .module-badge.dynamic-5 {
        background: rgba(14, 165, 233, 0.25);
        color: #7dd3fc;
        border: 1px solid rgba(14, 165, 233, 0.4);
      }
      .module-badge.dynamic-6 {
        background: rgba(234, 179, 8, 0.25);
        color: #fde047;
        border: 1px solid rgba(234, 179, 8, 0.4);
      }
      .module-badge.dynamic-7 {
        background: rgba(20, 184, 166, 0.25);
        color: #5eead4;
        border: 1px solid rgba(20, 184, 166, 0.4);
      }
      .module-badge.dynamic-8 {
        background: rgba(239, 68, 68, 0.25);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }
      .module-badge.dynamic-9 {
        background: rgba(124, 58, 237, 0.25);
        color: #c4b5fd;
        border: 1px solid rgba(124, 58, 237, 0.4);
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
        top: 50%;
        right: 14px;
        transform: translateY(-50%);
        background: rgba(59, 130, 246, 0.9);
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
        animation: slideIn 0.2s ease;
        pointer-events: none;
        z-index: 1;
      }
      .shift-indicator.active {
        display: flex;
      }
      .category-filter {
        position: absolute;
        top: 50%;
        left: 14px;
        transform: translateY(-50%);
        background: rgba(34, 197, 94, 0.9);
        color: #ffffff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        display: none;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(34, 197, 94, 0.4);
        animation: slideIn 0.2s ease;
        pointer-events: none;
        z-index: 1;
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
        pointer-events: all;
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
          transform: translateY(-50%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) scale(1);
        }
      }
    </style>
    <div class="overlay" role="dialog" aria-modal="true" aria-label="ID POS command bar">
      <div style="position: relative;">
        <div class="category-filter" id="category-filter">
          <span id="category-name">Filtrando</span>
          <span class="close-btn" id="clear-category">×</span>
        </div>
        <div class="shift-indicator" id="shift-indicator">
          <span>⇧</span>
          <span>Abrir en nueva pestaña</span>
        </div>
        <div class="input-wrapper">
          <div class="input-overlay" id="input-overlay"></div>
          <input class="command-input" type="text" placeholder="Buscar módulos, rutas o acciones" autocomplete="off" spellcheck="false" aria-label="Buscar" />
        </div>
      </div>
      <ul class="results" role="listbox"></ul>
      <div class="empty-state" hidden>No se encontraron coincidencias.</div>
      <div class="footer">
        <span id="usage-hint">Flechas para navegar - Enter para ir - Esc para cerrar<span class="help-hint">| Usa "módulo:" para filtrar</span></span>
        <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd></span>
      </div>
    </div>
  `;

  document.addEventListener("keydown", handleGlobalShortcut, true);

  // Bloquea la propagación de eventos de teclado a la página cuando el overlay está abierto.
  document.addEventListener("keydown", (e) => {
    if (state.open) {
      e.stopImmediatePropagation();
    }
  }, true);

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

  window.addEventListener("beforeunload", () => {
    flushUsageUpdates();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushUsageUpdates();
    }
  });

  init();

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    await Promise.all([
      ensureRankingEngine(),
      loadShortcutPreference(),
      loadStaticNavigation(),
      loadUsageCounts()
    ]);
    ensureOverlay();
    scheduleScan(250);
    installObservers();
  }

  async function ensureRankingEngine() {
    if (state.rankingEngine) return state.rankingEngine;
    try {
      const rankingModule = await import(RANKING_MODULE_URL);
      state.rankingEngine = rankingModule.createRankingEngine({
        maxResults: MAX_RESULTS,
        frequencyData: state.frequencyData,
        cache: {
          ttl: 2 * 60 * 1000,
          cleanupInterval: 10 * 60 * 1000
        },
        nowProvider: () => new Date()
      });

      rankResults = state.rankingEngine.rankResults;
      getDefaultResults = (nodes, context) => state.rankingEngine.getDefaultResults(nodes, context);
      mapNodeToResult = state.rankingEngine.mapNodeToResult;
      buildCacheKey = state.rankingEngine.buildCacheKey;
      removeAccents = state.rankingEngine.removeAccents;

      return state.rankingEngine;
    } catch (error) {
      console.warn("IDPOS Navigator: ranking engine unavailable", error);
      return null;
    }
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
    const inputOverlay = shadow.querySelector("#input-overlay");

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
    state.inputOverlay = inputOverlay;

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
    // No abrir si no hay rutas configuradas para este dominio
    if (state.staticNodes.length === 0) {
      console.log('Navigator: No hay rutas configuradas para este dominio. Configura rutas en la página de opciones.');
      return;
    }
    
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
  renderResults(getDefaultResults(state.nodes));
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
    const query = event.target.value;
    const trimmedQuery = query.trim();
    
    // Actualizar overlay con efecto neón
    updateInputOverlay(query);
    
    if (!trimmedQuery) {
      clearCategoryIndicator();
      renderResults(getDefaultResults(state.nodes));
      return;
    }
    
    // Detectar búsqueda por categoría con formato "módulo: query"
    const categoryMatch = trimmedQuery.match(/^([a-záéíóúñ]+):\s*(.*)$/i);
    let filtered = state.nodes;
    let searchQuery = trimmedQuery;
    
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
    
    const ranked = searchQuery
      ? rankResults(searchQuery, filtered, buildRankingContext(searchQuery, filtered))
      : filtered.slice(0, MAX_RESULTS).map(mapNodeToResult).filter(Boolean);
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

  function buildRankingContext(query, nodes) {
    if (!query || !nodes || !nodes.length) return {};
  const cacheEligible = nodes.length > 0 && nodes.every(node => node && CACHE_ELIGIBLE_SOURCES.has(node.source));
    if (!cacheEligible) return {};
    const categoryKey = state.activeCategory || STATIC_CACHE_CATEGORY;
    return {
      cacheEligible: true,
      cacheKey: buildCacheKey(query, categoryKey),
      cacheVersion: state.staticVersion
    };
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
    if (!state.shiftIndicator || !state.input) return;
    if (state.shiftPressed) {
      state.shiftIndicator.classList.add("active");
      state.input.classList.add("has-shift-indicator");
    } else {
      state.shiftIndicator.classList.remove("active");
      state.input.classList.remove("has-shift-indicator");
    }
  }

  function updateCategoryIndicator(category) {
    if (!state.categoryFilter || !state.input) return;
    state.categoryFilter.classList.add("active");
    state.input.classList.add("has-category-filter");
  }

  function clearCategoryIndicator() {
    if (!state.categoryFilter || !state.input) return;
    state.categoryFilter.classList.remove("active");
    state.input.classList.remove("has-category-filter");
    state.activeCategory = null;
    if (state.inputOverlay) {
      state.inputOverlay.innerHTML = "";
    }
  }

  function updateInputOverlay(query) {
    if (!state.inputOverlay) return;
    state.inputOverlay.innerHTML = "";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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
      
      // Siempre mostrar solo el título, sin duplicación
      titleSpan.textContent = item.title;
      
      titleWrapper.appendChild(titleSpan);

      // Agregar etiquetas de path en el lado derecho
      if (item.tag && item.tag.length > 1) {
        const pathTags = document.createElement("div");
        pathTags.className = "result-path-tags";
        
        // Verificar si el último elemento del tag es igual al título
        const normalizedTitle = (item.title || "").trim().toLowerCase();
        const lastTag = item.tag[item.tag.length - 1];
        const normalizedLastTag = (lastTag || "").trim().toLowerCase();
        
        // Si el último tag es igual al título, excluirlo del pathLabel
        const pathToShow = normalizedLastTag === normalizedTitle 
          ? item.tag.slice(0, -1) 
          : item.tag.slice();
        
        pathToShow.forEach((pathPart, idx) => {
          if (idx > 0) {
            const separator = document.createElement("span");
            separator.className = "path-separator";
            separator.textContent = "·";
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


  async function loadStaticNavigation() {
    state.loadingStatic = true;
    try {
      const currentDomain = normalizeDomain(window.location.hostname);
      const STORAGE_ROUTES_KEY = "navigatorRoutes";
      const CSV_DATA_URL = chrome.runtime.getURL("data/routes-example-social.csv");
      
      // Intentar cargar desde storage primero
      const stored = await chrome.storage.local.get(STORAGE_ROUTES_KEY).catch(err => {
        if (err.message && err.message.includes('Extension context invalidated')) return {};
        throw err;
      });
      let routes = stored[STORAGE_ROUTES_KEY] || [];
      
      // Si no hay rutas en storage, cargar desde CSV por defecto
      if (routes.length === 0) {
        const response = await fetch(CSV_DATA_URL);
        const csvText = await response.text();
        routes = parseRoutesCSV(csvText);
        await chrome.storage.local.set({ [STORAGE_ROUTES_KEY]: routes }).catch(err => {
          if (err.message && err.message.includes('Extension context invalidated')) return;
          throw err;
        });
      }
      
      // Filtrar por dominio actual (normalizando ambos para comparación)
      const domainRoutes = routes.filter(route => normalizeDomain(route.domain) === currentDomain);
      
      // Si no hay rutas para este dominio, no inicializar nada
      if (domainRoutes.length === 0) {
        console.log(`Navigator: No hay rutas configuradas para ${currentDomain}`);
        state.staticNodes = [];
        state.loadingStatic = false;
        return;
      }
      
      // Convertir a formato de nodos
      state.staticNodes = domainRoutes.map(route => {
        const tags = extractRouteTags(route);
        const pathLabel = tags.length
          ? tags.join(" · ")
          : String(route.pathLabel || "").replace(/\|/g, " · ");
        return {
          id: route.id,
          title: route.title,
          titleLower: removeAccents(String(route.title || "").toLowerCase()),
          module: route.module,
          description: route.description || "",
          tag: tags,
          tagLower: tags.length ? removeAccents(tags.join(" ").toLowerCase()) : "",
          pathLabel,
          url: absoluteUrl(route.url),
          action: "navigate",
          source: "static",
          usage: state.usageMap.get(route.id) || 0,
          depth: tags.length ? tags.length - 1 : 0,
          status: route.status || "active"
        };
      });
      
      state.staticVersion += 1;
      if (state.rankingEngine && typeof state.rankingEngine.invalidateCache === "function") {
        state.rankingEngine.invalidateCache();
      }
      mergeNodes([]);
    } catch (error) {
      console.warn("Navigator: static navigation not available", error);
    } finally {
      state.loadingStatic = false;
    }
  }
  
  function parseRoutesCSV(csvText) {
    const lines = csvText.trim().split("\\n");
    if (lines.length <= 1) return [];
    
    const routes = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const values = parseCSVLineValues(line);
      if (values.length < 8) continue;
      
      const tagList = normalizeTagList(values[5]);
      const route = {
        domain: values[0] || "",
        id: values[1] || "",
        module: values[2] || "",
        title: values[3] || "",
        url: values[4] || "",
        tag: tagList,
        tags: tagList.join("|"),
        description: values[6] || "",
        status: values[7] || "active"
      };
      
      if (route.domain && route.id && route.title) {
        routes.push(route);
      }
    }
    
    return routes;
  }
  
  function parseCSVLineValues(line) {
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

  function normalizeTagList(value) {
    if (!value) return [];
    const sourceArray = Array.isArray(value)
      ? value
      : String(value)
          .replace(/^"|"$/g, "")
          .replace(/·/g, "|")
          .replace(/>/g, "|")
          .replace(/,/g, "|")
          .split("|");

    return sourceArray
      .map(part => String(part).trim())
      .filter(Boolean);
  }

  function extractRouteTags(route) {
    if (!route) return [];
    const candidates = [route.tag, route.tags, route.pathLabel];
    for (const candidate of candidates) {
      const normalized = normalizeTagList(candidate);
      if (normalized.length) return normalized;
    }
    return [];
  }

  function normalizeNode(raw, source) {
    const id = raw.id || `${source}:${raw.url || raw.title}`;
    const tag = extractRouteTags(raw);
    const depth = tag.length ? tag.length - 1 : 0;
    const title = raw.title || (tag.length ? tag[tag.length - 1] : "");
    return {
      id,
      title,
      titleLower: removeAccents(title.toLowerCase()),
      tag,
      tagLower: removeAccents(tag.join(" ").toLowerCase()),
      pathLabel: raw.pathLabel || tag.join(" · "),
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
    if (!module) return "dynamic-0";
    
    const normalized = module.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    // Todos los módulos usan colores dinámicos basados en hash
    // Esto asegura que el mismo módulo siempre tenga el mismo color
    // sin importar el dominio
    return "dynamic-" + simpleHash(normalized);
  }
  
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 10); // 10 variantes de color
  }

  function absoluteUrl(url) {
    if (!url) return "";
    if (/^https?:/i.test(url)) return url;
    if (url.startsWith("/")) return `${location.origin}${url}`;
    return `${location.origin}/${url}`;
  }

  function normalizeDomain(domain) {
    if (!domain) return "";
    // Eliminar www. al principio para comparación
    return domain.toLowerCase().replace(/^www\./, "");
  }

  function scheduleScan(delay) {
    // NUNCA escanear si hay rutas estáticas configuradas
    // Solo escanear DOM cuando NO hay rutas estáticas
    if (state.staticNodes.length > 0) return;
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
    const tag = deriveHierarchy(element, text);
    const idBase = url || tag.join("::") || text;
    const module = tag.length > 0 ? tag[0] : "";

    return {
      id: `dom:${idBase}`,
      title: text,
      titleLower: removeAccents(text.toLowerCase()),
      tag,
      tagLower: removeAccents(tag.join(" ").toLowerCase()),
      pathLabel: tag.join(" · "),
      url,
      description,
      module,
      depth: tag.length ? tag.length - 1 : 0,
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
    
    // Si hay rutas estáticas, SOLO usar esas (ignorar DOM completamente)
    const nodesToUse = state.staticNodes.length > 0 ? state.staticNodes : domNodes;

    for (const node of nodesToUse) {
      const existingUsage = usage.get(node.id) || 0;
      node.usage = existingUsage;
      byId.set(node.id, node);
    }

    state.nodes = Array.from(byId.values()).filter(node => node.url || node.action === "click");

    if (state.footerBadge) {
      const total = state.nodes.length;
      state.footerBadge.textContent = `Flechas para navegar - Enter para ir - Esc para cerrar - ${total} rutas indexadas`;
    }

    if (state.open) {
      const query = state.input ? state.input.value.trim() : "";
      if (query) {
        const context = buildRankingContext(query, state.nodes);
        renderResults(rankResults(query, state.nodes, context));
      } else {
        renderResults(getDefaultResults(state.nodes));
      }
    }
  }

  function incrementUsage(selection) {
    if (!selection || !selection.id) return;
    const id = selection.id;
    const now = Date.now();
    const current = new Date(now);
    const hour = current.getHours();
    const day = current.getDay();
    
    const nextValue = (state.usageMap.get(id) || 0) + 1;
    state.usageMap.set(id, nextValue);
    
    const freq = state.frequencyData;
    freq.lastAccess.set(id, now);
    freq.accessCount.set(id, nextValue);
    
    const timeKey = `${id}:${hour}`;
    freq.timeOfDay.set(timeKey, (freq.timeOfDay.get(timeKey) || 0) + 1);
    
    const dayKey = `${id}:${day}`;
    freq.weekday.set(dayKey, (freq.weekday.get(dayKey) || 0) + 1);

    queueUsagePersistence(id, nextValue, { lastAccess: now, count: nextValue, timeOfDay: hour, weekday: day });
  }

  function queueUsagePersistence(id, usageValue, frequencySnapshot) {
    state.pendingUsageUpdates.set(id, {
      usage: usageValue,
      frequency: frequencySnapshot
    });
    scheduleUsageFlush();
  }

  function scheduleUsageFlush() {
    if (state.usageFlushTimer) return;
    state.usageFlushTimer = window.setTimeout(() => {
      state.usageFlushTimer = null;
      flushUsageUpdates();
    }, USAGE_FLUSH_INTERVAL);
  }

  async function flushUsageUpdates() {
    if (!state.pendingUsageUpdates.size) {
      if (state.usageFlushTimer) {
        window.clearTimeout(state.usageFlushTimer);
        state.usageFlushTimer = null;
      }
      return;
    }

    const payload = {};
    for (const [id, data] of state.pendingUsageUpdates.entries()) {
      payload[STORAGE_USAGE_PREFIX + id] = data.usage;
      payload[`freq:${id}`] = data.frequency;
    }

    state.pendingUsageUpdates.clear();
    if (state.usageFlushTimer) {
      window.clearTimeout(state.usageFlushTimer);
      state.usageFlushTimer = null;
    }

    try {
      await chrome.storage.local.set(payload);
    } catch (error) {
      // Ignorar silenciosamente errores de contexto inválido cuando la extensión se recarga
      if (error.message && error.message.includes('Extension context invalidated')) {
        return;
      }
      // Solo registrar otros tipos de errores
      console.warn("Navigator: failed to persist usage batch", error);
    }
  }

  async function loadUsageCounts() {
    try {
      const keys = await chrome.storage.local.get(null).catch(err => {
        if (err.message && err.message.includes('Extension context invalidated')) return {};
        throw err;
      });
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

      if (state.rankingEngine && typeof state.rankingEngine.invalidateCache === "function") {
        state.rankingEngine.invalidateCache();
      }
    } catch (error) {
      console.warn("IDPOS Navigator: usage stats unavailable", error);
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
      const store = await chrome.storage.local.get(STORAGE_SHORTCUT_KEY).catch(err => {
        if (err.message && err.message.includes('Extension context invalidated')) return {};
        throw err;
      });
      state.shortcut = normalizeShortcut(store[STORAGE_SHORTCUT_KEY] || DEFAULT_SHORTCUT);
    } catch (error) {
      console.warn("IDPOS Navigator: shortcut preference unavailable", error);
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


})();
