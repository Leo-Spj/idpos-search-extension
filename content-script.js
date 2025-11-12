(() => {
  const OVERLAY_ID = "idpos-command-root";
  const MAX_RESULTS = 40;
  const MUTATION_THROTTLE = 2000;
  const STORAGE_USAGE_PREFIX = "usage:";
  const STORAGE_SHORTCUT_KEY = "customShortcut";
  const STORAGE_FAVORITES_KEY = "favorites";
  const STORAGE_RECENT_KEY = "recentHistory";
  const STATIC_DATA_URL = chrome.runtime.getURL("data/navigation_tree.json");
  const DEFAULT_SHORTCUT = { meta: false, ctrl: true, shift: true, alt: false, key: "k" };
  const STRIP_DIACRITICS_REGEX = /[\u0300-\u036f]/g;
  const MAX_RECENT_ITEMS = 12;
  const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta"]);
  const RAW_SYNONYM_MAP = {
    ventas: ["facturacion", "comercial"],
    facturacion: ["ventas", "cobranza"],
    cobranzas: ["facturacion", "pagos"],
    cliente: ["usuario", "socio", "consumidor"],
    clientes: ["usuarios", "socios"],
    soporte: ["ayuda", "asistencia"],
    pedido: ["orden", "venta"],
    pedidos: ["ordenes", "ventas"],
    inventario: ["stock", "existencias"],
    reporte: ["informe", "reporte"],
    reportes: ["informes", "estadisticas"],
    configuracion: ["ajustes", "settings"],
    ajustes: ["configuracion"],
    caja: ["cajero", "cobranzas"],
    producto: ["articulo", "item"],
    productos: ["articulos", "items"],
    dashboard: ["inicio", "panel"],
    inicio: ["dashboard", "home"],
    usuario: ["perfil", "colaborador"],
    usuarios: ["colaboradores", "empleados"]
  };

  function stripDiacritics(value) {
    return value ? value.normalize("NFD").replace(STRIP_DIACRITICS_REGEX, "") : "";
  }

  function buildSearchTokens(query) {
    return stripDiacritics(query.toLowerCase()).split(/\s+/).filter(Boolean);
  }

  const SYNONYM_MAP = normalizeSynonymMap(RAW_SYNONYM_MAP);

  function normalizeSynonymMap(raw) {
    const map = {};
    if (!raw) return map;
    for (const [key, values] of Object.entries(raw)) {
      const normalizedKey = stripDiacritics(String(key).toLowerCase());
      const normalizedValues = Array.isArray(values)
        ? values.map(value => stripDiacritics(String(value).toLowerCase())).filter(Boolean)
        : [];
      const unique = new Set(normalizedValues.concat(normalizedKey));
      unique.delete(normalizedKey);
      map[normalizedKey] = Array.from(unique);
    }
    return map;
  }

  const state = {
    open: false,
    shadow: null,
    host: null,
    input: null,
    list: null,
    container: null,
    footerBadge: null,
  footerDefaultMessage: "",
    shortcutLabel: null,
    suggestionHint: null,
    filterButtons: [],
    emptyState: null,
    previewPanel: null,
    previewTitle: null,
    previewPath: null,
    previewDescription: null,
    previewMeta: null,
    shortcutButton: null,
    results: [],
    nodes: [],
    staticNodes: [],
    nodeById: new Map(),
    usageMap: new Map(),
    favorites: new Set(),
    recentEntries: [],
    recentMap: new Map(),
    activeFilter: "all",
    suggestion: "",
    selectedIndex: 0,
    lastScan: 0,
    mutationTimer: null,
    initialized: false,
    shortcut: null,
    capturingShortcut: false,
    loadingStatic: false,
    scanning: false
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
        padding: 14px 14px 12px 14px;
        transition: opacity 140ms ease, transform 160ms ease;
        z-index: 2147480000;
      }
      .overlay.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
      }
      .overlay.shortcut-capture {
        outline: 2px dashed rgba(91, 134, 229, 0.6);
      }
      .input-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;
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
      }
      .command-input::placeholder {
        color: rgba(255, 255, 255, 0.45);
      }
      .suggestion-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.56);
        padding-left: 2px;
      }
      .filter-bar {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      button {
        font: inherit;
      }
      .filter-chip {
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.75);
        font-size: 12px;
        padding: 4px 12px;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      }
      .filter-chip.active {
        background: rgba(91, 134, 229, 0.45);
        border-color: rgba(91, 134, 229, 0.9);
        color: #ffffff;
      }
      .filter-chip:focus {
        outline: none;
        border-color: rgba(91, 134, 229, 0.9);
      }
      .results {
        margin: 12px 0 0 0;
        padding: 0;
        list-style: none;
        max-height: min(52vh, 460px);
        overflow-y: auto;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.04);
      }
      .result-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
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
      .result-path {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .result-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .result-title {
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
      }
      .result-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 11px;
      }
      .badge {
        background: rgba(255, 255, 255, 0.14);
        padding: 2px 6px;
        border-radius: 5px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: rgba(255, 255, 255, 0.78);
      }
      .result-description {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .favorite-toggle {
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.85);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11px;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }
      .favorite-toggle.active {
        background: rgba(255, 255, 255, 0.22);
        border-color: rgba(255, 255, 255, 0.35);
        color: #1d1e21;
        font-weight: 600;
      }
      .favorite-toggle:focus {
        outline: none;
        border-color: rgba(91, 134, 229, 0.9);
      }
      .empty-state {
        padding: 18px;
        text-align: center;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.56);
      }
      .preview-panel {
        margin-top: 12px;
        padding: 12px;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .preview-title {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
      }
      .preview-path {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.62);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .preview-description {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.68);
      }
      .preview-meta {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }
      .footer {
        margin-top: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.52);
        padding: 0 4px;
      }
      .footer-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .shortcut-display {
        background: rgba(255, 255, 255, 0.12);
        padding: 4px 10px;
        border-radius: 5px;
        font-weight: 600;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.85);
      }
      .shortcut-button {
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 5px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 11px;
        padding: 4px 10px;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .shortcut-button:hover,
      .shortcut-button:focus {
        background: rgba(255, 255, 255, 0.22);
        border-color: rgba(255, 255, 255, 0.28);
        outline: none;
      }
      .shortcut-button:disabled {
        opacity: 0.6;
        cursor: default;
      }
    </style>
    <div class="overlay" role="dialog" aria-modal="true" aria-label="ID POS command bar">
      <div class="input-wrapper">
        <input class="command-input" type="text" placeholder="Buscar módulos, rutas o acciones" autocomplete="off" spellcheck="false" aria-label="Buscar" />
        <div class="suggestion-hint" hidden></div>
      </div>
      <div class="filter-bar" role="toolbar" aria-label="Filtros rápidos">
        <button class="filter-chip active" type="button" data-filter="all">Todos</button>
        <button class="filter-chip" type="button" data-filter="favorites">Favoritos</button>
        <button class="filter-chip" type="button" data-filter="recent">Recientes</button>
        <button class="filter-chip" type="button" data-filter="dom">Interfaz</button>
        <button class="filter-chip" type="button" data-filter="static">Catálogo</button>
      </div>
      <ul class="results" role="listbox"></ul>
      <div class="empty-state" hidden>No se encontraron coincidencias.</div>
      <div class="preview-panel" hidden>
        <div class="preview-title"></div>
        <div class="preview-path"></div>
        <div class="preview-description"></div>
        <div class="preview-meta"></div>
      </div>
      <div class="footer">
        <span id="usage-hint">Flechas para navegar - Enter para ir - Esc para cerrar</span>
        <div class="footer-right">
          <span class="shortcut-display"></span>
          <button type="button" class="shortcut-button">Editar atajo</button>
        </div>
      </div>
    </div>
  `;

  document.addEventListener("keydown", handleGlobalShortcut, true);
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "TOGGLE_OVERLAY") return;
    toggleOverlay();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[STORAGE_SHORTCUT_KEY]) {
      const next = changes[STORAGE_SHORTCUT_KEY].newValue;
      state.shortcut = normalizeShortcut(next || DEFAULT_SHORTCUT);
      updateFooterStatus();
    }
    if (changes[STORAGE_FAVORITES_KEY]) {
      const nextFavorites = Array.isArray(changes[STORAGE_FAVORITES_KEY].newValue) ? changes[STORAGE_FAVORITES_KEY].newValue : [];
      state.favorites = new Set(nextFavorites);
      syncFavoriteFlags();
      refreshResultsIfOpen();
    }
    if (changes[STORAGE_RECENT_KEY]) {
      const nextRecents = Array.isArray(changes[STORAGE_RECENT_KEY].newValue) ? changes[STORAGE_RECENT_KEY].newValue : [];
      state.recentEntries = normalizeRecentEntries(nextRecents);
      rebuildRecentMap();
      refreshResultsIfOpen();
    }
  });

  init();

  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    await Promise.all([loadShortcutPreference(), loadStaticNavigation(), loadUsageCounts(), loadFavorites(), loadRecentHistory()]);
    ensureOverlay();
    scheduleScan(250);
    installObservers();
  }

  function ensureOverlay() {
    if (state.host) return;
    const host = document.createElement("div");
    host.id = OVERLAY_ID;
    host.setAttribute("role", "presentation");
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = templateHtml;
    document.documentElement.appendChild(host);

    const overlay = shadow.querySelector(".overlay");
    const input = shadow.querySelector(".command-input");
    const list = shadow.querySelector(".results");
    const empty = shadow.querySelector(".empty-state");
    const footerHint = shadow.querySelector("#usage-hint");
    const suggestionHint = shadow.querySelector(".suggestion-hint");
    const filterButtons = Array.from(shadow.querySelectorAll(".filter-chip"));
    const previewPanel = shadow.querySelector(".preview-panel");
    const previewTitle = shadow.querySelector(".preview-title");
    const previewPath = shadow.querySelector(".preview-path");
    const previewDescription = shadow.querySelector(".preview-description");
    const previewMeta = shadow.querySelector(".preview-meta");
    const shortcutLabel = shadow.querySelector(".shortcut-display");
    const shortcutButton = shadow.querySelector(".shortcut-button");

    state.host = host;
    state.shadow = shadow;
    state.container = overlay;
    state.input = input;
    state.list = list;
    state.emptyState = empty;
    state.footerBadge = footerHint;
    state.suggestionHint = suggestionHint;
    state.filterButtons = filterButtons;
    state.previewPanel = previewPanel;
    state.previewTitle = previewTitle;
    state.previewPath = previewPath;
    state.previewDescription = previewDescription;
    state.previewMeta = previewMeta;
    state.shortcutLabel = shortcutLabel;
    state.shortcutButton = shortcutButton;

    input.addEventListener("input", handleQueryInput);
    input.addEventListener("keydown", handleInputKeys);
    list.addEventListener("click", onResultClick);
    list.addEventListener("mouseover", handleResultHover);
    filterButtons.forEach(button => button.addEventListener("click", handleFilterClick));
    if (shortcutButton) shortcutButton.addEventListener("click", startShortcutCapture);

    updateFilterButtons();
    updateFooterStatus();
  }

  function toggleOverlay() {
    state.open ? closeOverlay() : openOverlay();
  }

  function openOverlay() {
    ensureOverlay();
    if (!state.container || state.open) return;
    state.open = true;
    state.container.classList.add("open");
    if (state.input) {
      state.input.value = "";
      state.input.focus({ preventScroll: true });
    }
    state.selectedIndex = 0;
    updateResultsForQuery("", { resetSelection: true });
  }

  function closeOverlay() {
    if (!state.container || !state.open) return;
    if (state.capturingShortcut) finalizeShortcutCapture(null, true);
    state.open = false;
    state.container.classList.remove("open");
    if (state.input) state.input.blur();
  }

  function handleQueryInput(event) {
    if (state.capturingShortcut) {
      event.preventDefault();
      return;
    }
    const query = event.target.value.trim();
    updateResultsForQuery(query, { resetSelection: true });
  }

  function updateResultsForQuery(query, options = {}) {
    const nodes = filterNodesByActiveFilter(state.nodes);
    let mappedResults = [];
    const trimmed = query.trim();
    if (!trimmed) {
      mappedResults = getDefaultResults(nodes);
      updateSuggestion("", mappedResults);
    } else {
      mappedResults = rankResults(trimmed, nodes);
      updateSuggestion(trimmed, mappedResults);
    }

    let selectedId = null;
    if (!options.resetSelection) {
      if (options.preserveSelectedId) selectedId = options.preserveSelectedId;
      else if (options.keepSelection && state.results[state.selectedIndex]) {
        selectedId = state.results[state.selectedIndex].id;
      }
    }
    renderResults(mappedResults, { selectedId });
  }

  function filterNodesByActiveFilter(nodes) {
    if (!Array.isArray(nodes) || !nodes.length) return [];
    switch (state.activeFilter) {
      case "favorites":
        return nodes.filter(node => node.favorite);
      case "recent": {
        const allowed = new Set(nodes.map(node => node.id));
        const ordered = [];
        for (const entry of state.recentEntries) {
          const node = state.nodeById.get(entry.id);
          if (node && allowed.has(node.id)) ordered.push(node);
        }
        return ordered;
      }
      case "dom":
        return nodes.filter(node => node.source === "dom");
      case "static":
        return nodes.filter(node => node.source === "static");
      default:
        return nodes;
    }
  }

  function updateSuggestion(query, results) {
    if (!state.suggestionHint) return;
    if (!query || !results.length) {
      state.suggestion = "";
      state.suggestionHint.hidden = true;
      state.suggestionHint.textContent = "";
      return;
    }
    const first = results[0];
    if (!first) {
      state.suggestion = "";
      state.suggestionHint.hidden = true;
      state.suggestionHint.textContent = "";
      return;
    }
    const normalizedQuery = stripDiacritics(query.toLowerCase());
    const normalizedTitle = stripDiacritics(first.title.toLowerCase());
    if (normalizedTitle === normalizedQuery) {
      state.suggestion = "";
      state.suggestionHint.hidden = true;
      state.suggestionHint.textContent = "";
      return;
    }
    state.suggestion = first.title;
    state.suggestionHint.hidden = false;
    state.suggestionHint.textContent = `Tab para autocompletar: ${first.title}`;
  }

  function applySuggestion() {
    if (!state.input || !state.suggestion) return;
    state.input.value = state.suggestion;
    updateResultsForQuery(state.suggestion, { resetSelection: true });
    const length = state.input.value.length;
    try {
      state.input.setSelectionRange(length, length);
    } catch (error) {
      /* ignore selection errors */
    }
  }

  // Permite reasignar el atajo principal desde la propia superposición.
  function startShortcutCapture() {
    if (!state.container || state.capturingShortcut) return;
    state.capturingShortcut = true;
    state.container.classList.add("shortcut-capture");
    if (state.input) {
      state.input.blur();
      state.input.disabled = true;
    }
    if (state.footerBadge) {
      state.footerBadge.textContent = "Presiona la nueva combinación o Esc para cancelar";
    }
    if (state.shortcutButton) {
      state.shortcutButton.textContent = "Esc para cancelar";
      state.shortcutButton.disabled = true;
    }
    window.addEventListener("keydown", captureShortcutKeydown, true);
  }

  function captureShortcutKeydown(event) {
    event.preventDefault();
    event.stopPropagation();

    const key = normalizeKey(event.key);
    if (key === "escape") {
      finalizeShortcutCapture(null, true);
      return;
    }

    if (MODIFIER_KEYS.has(key)) {
      return;
    }

    const shortcutCandidate = {
      meta: event.metaKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      key
    };

    if (!shortcutCandidate.ctrl && !shortcutCandidate.meta && !shortcutCandidate.alt) {
      if (state.footerBadge) {
        state.footerBadge.textContent = "Añade Ctrl, Alt o Meta junto con la tecla principal";
      }
      return;
    }

    finalizeShortcutCapture(shortcutCandidate, false);
  }

  function finalizeShortcutCapture(candidate, cancelled) {
    window.removeEventListener("keydown", captureShortcutKeydown, true);
    state.capturingShortcut = false;
    if (state.container) state.container.classList.remove("shortcut-capture");
    if (state.input) {
      state.input.disabled = false;
      state.input.focus({ preventScroll: true });
    }

    if (!cancelled && candidate) {
      const normalized = normalizeShortcut(candidate);
      state.shortcut = normalized;
      chrome.storage.local.set({ [STORAGE_SHORTCUT_KEY]: normalized }).catch(() => {});
    }

    if (state.shortcutButton) {
      state.shortcutButton.textContent = "Editar atajo";
      state.shortcutButton.disabled = false;
    }

    updateFooterStatus();
  }

  function updateFooterStatus() {
    if (!state.footerBadge) return;
    const total = state.nodes.length;
    const latency = state.lastScan ? `${Math.round(state.lastScan)} ms` : "-";
    const message = `Flechas para navegar - Enter para ir - Esc para cerrar - ${total} rutas - Escaneo ${latency}`;
    state.footerDefaultMessage = message;
    if (!state.capturingShortcut) {
      state.footerBadge.textContent = message;
    }
    if (state.shortcutLabel) {
      state.shortcutLabel.textContent = formatShortcut(state.shortcut || DEFAULT_SHORTCUT);
    }
  }

  function formatShortcut(shortcut) {
    if (!shortcut) return "Sin atajo";
    const parts = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.meta) parts.push("Meta");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("Shift");
    const keyLabel = formatKeyLabel(shortcut.key);
    if (keyLabel) parts.push(keyLabel);
    return parts.length ? parts.join(" + ") : "Sin atajo";
  }

  function formatKeyLabel(key) {
    if (!key) return "";
    if (key.length === 1) return key.toUpperCase();
    const replacements = {
      arrowup: "ArrowUp",
      arrowdown: "ArrowDown",
      arrowleft: "ArrowLeft",
      arrowright: "ArrowRight",
      escape: "Esc",
      enter: "Enter",
      space: "Space",
      tab: "Tab"
    };
    if (replacements[key]) return replacements[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function normalizeRecentEntries(entries) {
    if (!Array.isArray(entries)) return [];
    const normalized = entries
      .map(entry => {
        if (typeof entry === "string") {
          return { id: entry, timestamp: Date.now() };
        }
        if (!entry || typeof entry.id !== "string") return null;
        return {
          id: entry.id,
          timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now()
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);
    return normalized.slice(0, MAX_RECENT_ITEMS);
  }

  function rebuildRecentMap() {
    const map = new Map();
    for (const entry of state.recentEntries) {
      map.set(entry.id, entry.timestamp);
    }
    state.recentMap = map;
    state.nodes.forEach(node => {
      node.isRecent = map.has(node.id);
      node.recentTimestamp = map.get(node.id) || 0;
    });
  }

  function syncFavoriteFlags() {
    const favorites = state.favorites;
    state.nodes.forEach(node => {
      node.favorite = favorites.has(node.id);
    });
  }

  function refreshResultsIfOpen() {
    if (!state.open) return;
    const query = state.input ? state.input.value.trim() : "";
    const current = state.results[state.selectedIndex];
    updateResultsForQuery(query, { keepSelection: true, preserveSelectedId: current ? current.id : null });
  }

  function toggleFavorite(id) {
    if (!id) return;
    const nextFavorites = new Set(state.favorites);
    if (nextFavorites.has(id)) nextFavorites.delete(id);
    else nextFavorites.add(id);
    state.favorites = nextFavorites;
    syncFavoriteFlags();
    const payload = Array.from(nextFavorites);
    chrome.storage.local.set({ [STORAGE_FAVORITES_KEY]: payload }).catch(() => {});
    const node = state.nodeById.get(id);
    if (node) node.favorite = nextFavorites.has(id);
    if (state.open) {
      const query = state.input ? state.input.value.trim() : "";
      updateResultsForQuery(query, { preserveSelectedId: id });
    }
  }

  function addToRecent(id) {
    if (!id) return;
    const existing = state.recentEntries.filter(entry => entry.id !== id);
    const fresh = { id, timestamp: Date.now() };
    const updated = [fresh, ...existing].slice(0, MAX_RECENT_ITEMS);
    state.recentEntries = updated;
    rebuildRecentMap();
    chrome.storage.local.set({ [STORAGE_RECENT_KEY]: updated }).catch(() => {});
  }

  function handleInputKeys(event) {
    if (state.capturingShortcut) {
      event.preventDefault();
      return;
    }
    if (!state.results.length) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        if (state.suggestion) applySuggestion();
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
        activateSelected();
        break;
      case "Escape":
        event.preventDefault();
        closeOverlay();
        break;
      case "Tab":
        event.preventDefault();
        if (state.suggestion) applySuggestion();
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
    activateSelected();
  }

  function handleResultHover(event) {
    const target = event.target.closest(".result-item");
    if (!target) return;
    const index = Number(target.dataset.index);
    if (Number.isNaN(index) || state.selectedIndex === index) return;
    state.selectedIndex = index;
    updateActiveItem();
  }

  function handleFilterClick(event) {
    const target = event.currentTarget;
    if (!target || !target.dataset) return;
    const filter = target.dataset.filter || "all";
    setActiveFilter(filter);
  }

  function setActiveFilter(nextFilter) {
    if (!nextFilter) return;
    const resolved = nextFilter === state.activeFilter ? "all" : nextFilter;
    if (state.activeFilter === resolved) return;
    state.activeFilter = resolved;
    updateFilterButtons();
    const query = state.input ? state.input.value.trim() : "";
    updateResultsForQuery(query, { resetSelection: true });
  }

  function updateFilterButtons() {
    if (!Array.isArray(state.filterButtons)) return;
    state.filterButtons.forEach(button => {
      const filter = button.dataset.filter || "all";
      button.classList.toggle("active", filter === state.activeFilter);
    });
  }

  function activateSelected() {
    const selection = state.results[state.selectedIndex];
    if (!selection) return;
    incrementUsage(selection);
    closeOverlay();
    if (selection.action === "click" && selection.nodeRef) {
      selection.nodeRef.click();
      return;
    }
    if (!selection.url) return;
    window.location.assign(selection.url);
  }

  function renderResults(results, options = {}) {
    state.results = results;
    if (!state.list || !state.emptyState) return;

    state.list.textContent = "";
    if (!results.length) {
      state.emptyState.hidden = false;
      state.selectedIndex = 0;
      updatePreview();
      return;
    }
    state.emptyState.hidden = true;

    let selectedIndex = 0;
    if (options.selectedId) {
      const matchIndex = results.findIndex(item => item && item.id === options.selectedId);
      if (matchIndex >= 0) selectedIndex = matchIndex;
    } else if (typeof options.selectedIndex === "number" && Number.isFinite(options.selectedIndex)) {
      selectedIndex = Math.max(0, Math.min(results.length - 1, options.selectedIndex));
    }
    const shouldResetScroll = !options.selectedId && typeof options.selectedIndex !== "number";
    state.selectedIndex = selectedIndex;
    if (shouldResetScroll) state.list.scrollTop = 0;

    const fragment = document.createDocumentFragment();
    results.forEach((item, index) => {
      const li = document.createElement("li");
      const isActive = index === state.selectedIndex;
      li.className = "result-item" + (isActive ? " active" : "");
      li.dataset.index = String(index);
      li.dataset.id = item.id;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", isActive ? "true" : "false");

      const pathSpan = document.createElement("div");
      pathSpan.className = "result-path";
      pathSpan.textContent = item.pathLabel || item.title;
      li.appendChild(pathSpan);

      const header = document.createElement("div");
      header.className = "result-header";

      const titleGroup = document.createElement("div");
      titleGroup.className = "result-title-group";
      const titleSpan = document.createElement("div");
      titleSpan.className = "result-title";
      titleSpan.textContent = item.title;
      titleGroup.appendChild(titleSpan);

      const badgesContainer = document.createElement("div");
      badgesContainer.className = "result-badges";
      populateBadges(badgesContainer, item);
      if (badgesContainer.childElementCount) {
        titleGroup.appendChild(badgesContainer);
      }

      header.appendChild(titleGroup);

      const favoriteButton = document.createElement("button");
      favoriteButton.type = "button";
      favoriteButton.className = "favorite-toggle" + (item.favorite ? " active" : "");
      favoriteButton.textContent = item.favorite ? "Quitar" : "Favorito";
      favoriteButton.setAttribute("aria-label", item.favorite ? "Quitar de favoritos" : "Agregar a favoritos");
      favoriteButton.setAttribute("aria-pressed", item.favorite ? "true" : "false");
      favoriteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFavorite(item.id);
      });

      header.appendChild(favoriteButton);
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
    updateActiveItem();
  }

  function populateBadges(container, item) {
    if (!container || !item) return;
    const labels = [];
    if (item.favorite) labels.push("Fav");
    if (item.recent) labels.push("Reciente");
    if (item.source === "dom") labels.push("Interfaz");
    if (item.source === "static") labels.push("Catálogo");
    if (item.action === "click") labels.push("Acción");
    if (typeof item.usage === "number" && item.usage > 0) labels.push(`Uso: ${item.usage}`);
    labels.forEach(label => {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = label;
      container.appendChild(badge);
    });
  }

  function updateActiveItem() {
    if (!state.list) return;
    const children = state.list.querySelectorAll(".result-item");
    if (!children.length) {
      updatePreview();
      return;
    }
    const boundedIndex = Math.max(0, Math.min(children.length - 1, state.selectedIndex));
    state.selectedIndex = boundedIndex;
    children.forEach((child, idx) => {
      if (idx === boundedIndex) {
        child.classList.add("active");
        child.setAttribute("aria-selected", "true");
        child.scrollIntoView({ block: "nearest" });
      } else {
        child.classList.remove("active");
        child.setAttribute("aria-selected", "false");
      }
    });
    updatePreview();
  }

  function updatePreview() {
    if (!state.previewPanel || !state.previewTitle || !state.previewPath || !state.previewDescription || !state.previewMeta) {
      return;
    }
    const item = state.results[state.selectedIndex];
    if (!item) {
      state.previewPanel.hidden = true;
      return;
    }
    state.previewPanel.hidden = false;
    state.previewTitle.textContent = item.title;
    state.previewPath.textContent = item.pathLabel || "Sin jerarquía";
    state.previewDescription.textContent = item.description || "Sin descripción disponible.";
    const origin = item.source === "dom" ? "Interfaz" : "Catálogo";
    const type = item.action === "click" ? "Acción rápida" : "Navegación";
    const metaParts = [origin, type, `Uso: ${item.usage || 0}`];
    if (item.favorite) metaParts.push("Favorito");
    if (item.recent) metaParts.push("Reciente");
    state.previewMeta.textContent = metaParts.join(" - ");
  }

  // Prioriza favoritos y accesos recientes antes de completar con el resto.
  function getDefaultResults(sourceNodes) {
    const nodes = Array.isArray(sourceNodes) && sourceNodes.length ? sourceNodes.slice() : state.nodes.slice();
    if (state.activeFilter === "recent") {
      return nodes.slice(0, MAX_RESULTS).map(mapNodeToResult);
    }
    const included = new Set();
    const ordered = [];
    const allowedIds = new Set(nodes.map(node => node.id));

    const favorites = nodes.filter(node => node.favorite).sort(sortByUsageThenDepth);
    favorites.forEach(node => pushNode(node));

    const recentOrdered = state.recentEntries
      .map(entry => state.nodeById.get(entry.id))
      .filter(node => node && allowedIds.has(node.id));
    recentOrdered.forEach(node => pushNode(node));

    const remaining = nodes.filter(node => !included.has(node.id)).sort(sortByUsageThenDepth);
    remaining.forEach(node => pushNode(node));

    return ordered.slice(0, MAX_RESULTS).map(mapNodeToResult);

    function pushNode(node) {
      if (!node || included.has(node.id)) return;
      included.add(node.id);
      ordered.push(node);
    }
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
      usage: node.usage || 0,
      source: node.source,
      favorite: !!node.favorite,
      recent: !!node.isRecent,
      recentTimestamp: node.recentTimestamp || 0
    };
  }

  function sortByUsageThenDepth(a, b) {
    const usageDiff = (b.usage || 0) - (a.usage || 0);
    if (usageDiff !== 0) return usageDiff;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
  }

  function rankResults(query, nodes) {
    const tokenGroups = buildTokenAlternatives(query);
    if (!tokenGroups.length) return getDefaultResults(nodes);

    const scored = [];
    for (const node of nodes) {
      const score = scoreNode(tokenGroups, node);
      if (score <= 0) continue;
      scored.push({ score, node });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return sortByUsageThenDepth(a.node, b.node);
    });
    return scored.slice(0, MAX_RESULTS).map(item => mapNodeToResult(item.node));
  }

  function buildTokenAlternatives(query) {
    const tokens = buildSearchTokens(query);
    return tokens.map(token => {
      const set = new Set([token]);
      const synonyms = SYNONYM_MAP[token];
      if (Array.isArray(synonyms)) synonyms.forEach(value => set.add(value));
      return Array.from(set);
    });
  }

  function scoreNode(tokenGroups, node) {
    const title = node.titleSearch || node.titleLower || "";
    const path = node.pathSearch || node.pathLower || "";
    let score = 0;

    for (const group of tokenGroups) {
      let bestForToken = 0;
      for (const token of group) {
        const tokenScore = scoreToken(token, title, path);
        if (tokenScore > bestForToken) bestForToken = tokenScore;
      }
      if (bestForToken <= 0) return 0;
      score += bestForToken;
    }

    score += (node.usage || 0) * 30;
    score += node.favorite ? 80 : 0;
    score += node.source === "static" ? 8 : 0;
    if (node.isRecent) score += 15;
    score -= node.depth * 2;
    return score;
  }

  function scoreToken(token, title, path) {
    if (!token) return 0;
    if (title === token) return 120;
    if (title.startsWith(token)) return 90;
    if (title.includes(token)) return 60;
    if (path.includes(token)) return 40;
    if (fuzzyIncludes(title, token)) return 25;
    return 0;
  }

  function fuzzyIncludes(haystack, needle) {
    if (needle.length <= 1) return haystack.includes(needle);
    let index = 0;
    for (const char of haystack) {
      if (char === needle[index]) {
        index += 1;
        if (index === needle.length) return true;
      }
    }
    return false;
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
      console.warn("IDPOS Navigator: static navigation not available", error);
    } finally {
      state.loadingStatic = false;
    }
  }

  function normalizeNode(raw, source) {
    const id = raw.id || `${source}:${raw.url || raw.title}`;
    const path = Array.isArray(raw.path) ? raw.path : buildPath(raw.pathLabel);
    const depth = path.length ? path.length - 1 : 0;
    const title = raw.title || (path.length ? path[path.length - 1] : "");
    const titleLower = title.toLowerCase();
    const pathJoined = path.join(" ");
    const pathLower = pathJoined.toLowerCase();
    const titleSearch = stripDiacritics(titleLower);
    const pathSearch = stripDiacritics(pathLower);
    return {
      id,
      title,
      titleLower,
      titleSearch,
      path,
      pathLower,
  pathLabel: raw.pathLabel || path.join(" > "),
      pathSearch,
      url: absoluteUrl(raw.url),
      description: raw.description || "",
      depth,
      action: raw.action || (raw.url ? "navigate" : null),
      source,
      ref: raw.ref || null,
      usage: 0
    };
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

  const titleLower = text.toLowerCase();
  const titleSearch = stripDiacritics(titleLower);

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
    const pathJoined = path.join(" ");
    const pathLower = pathJoined.toLowerCase();
    const pathSearch = stripDiacritics(pathLower);

    return {
      id: `dom:${idBase}`,
      title: text,
      titleLower,
      titleSearch,
      path,
      pathLower,
  pathLabel: path.join(" > "),
      pathSearch,
      url,
      description,
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
    const combined = [...state.staticNodes, ...domNodes];

    for (const node of combined) {
      const existingUsage = usage.get(node.id) || 0;
      node.usage = existingUsage;
      node.favorite = state.favorites.has(node.id);
      node.isRecent = state.recentMap.has(node.id);
      node.recentTimestamp = state.recentMap.get(node.id) || 0;
      byId.set(node.id, node);
    }

    state.nodeById = byId;
    state.nodes = Array.from(byId.values()).filter(node => node.url || node.action === "click");

    updateFooterStatus();

    if (state.open) {
      const query = state.input ? state.input.value.trim() : "";
      updateResultsForQuery(query, { keepSelection: true });
    }
  }

  function incrementUsage(selection) {
    const id = selection.id;
    const key = STORAGE_USAGE_PREFIX + id;
    const nextValue = (state.usageMap.get(id) || 0) + 1;
    state.usageMap.set(id, nextValue);
    chrome.storage.local.set({ [key]: nextValue }).catch(() => {});
    const node = state.nodeById.get(id);
    if (node) node.usage = nextValue;
    addToRecent(id);
  }

  async function loadUsageCounts() {
    try {
      const keys = await chrome.storage.local.get(null);
      Object.entries(keys).forEach(([key, value]) => {
        if (!key.startsWith(STORAGE_USAGE_PREFIX)) return;
        state.usageMap.set(key.replace(STORAGE_USAGE_PREFIX, ""), Number(value) || 0);
      });
    } catch (error) {
      console.warn("IDPOS Navigator: usage stats unavailable", error);
    }
  }

  async function loadFavorites() {
    try {
      const store = await chrome.storage.local.get(STORAGE_FAVORITES_KEY);
      const saved = Array.isArray(store[STORAGE_FAVORITES_KEY]) ? store[STORAGE_FAVORITES_KEY] : [];
      state.favorites = new Set(saved);
    } catch (error) {
      state.favorites = new Set();
    }
  }

  async function loadRecentHistory() {
    try {
      const store = await chrome.storage.local.get(STORAGE_RECENT_KEY);
      const entries = Array.isArray(store[STORAGE_RECENT_KEY]) ? store[STORAGE_RECENT_KEY] : [];
      state.recentEntries = normalizeRecentEntries(entries);
      rebuildRecentMap();
    } catch (error) {
      state.recentEntries = [];
      state.recentMap = new Map();
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
    if (state.capturingShortcut) return;
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
      const store = await chrome.storage.local.get(STORAGE_SHORTCUT_KEY);
      state.shortcut = normalizeShortcut(store[STORAGE_SHORTCUT_KEY] || DEFAULT_SHORTCUT);
    } catch (error) {
      state.shortcut = normalizeShortcut(DEFAULT_SHORTCUT);
    }
    updateFooterStatus();
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
    if (key === " ") return "space";
    if (key.length === 1) return key.toLowerCase();
    switch (key) {
      case "ArrowUp": return "arrowup";
      case "ArrowDown": return "arrowdown";
      case "ArrowLeft": return "arrowleft";
      case "ArrowRight": return "arrowright";
      case "Spacebar": return "space";
      default: return key.toLowerCase();
    }
  }

})();
