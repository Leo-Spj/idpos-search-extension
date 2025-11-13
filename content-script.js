(() => {
  const OVERLAY_ID = "idpos-command-root";
  const MAX_RESULTS = 40;
  const MUTATION_THROTTLE = 2000;
  const STORAGE_USAGE_PREFIX = "usage:";
  const STORAGE_SHORTCUT_KEY = "customShortcut";
  const STATIC_DATA_URL = chrome.runtime.getURL("data/navigation_tree.json");
  const DEPRECATED_CATEGORY_KEY = "deprecado";
  const DEFAULT_SHORTCUT = { meta: false, ctrl: true, shift: true, alt: false, key: "k" };

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
    results: [],
    nodes: [],
    staticNodes: [],
    usageMap: new Map(),
    selectedIndex: 0,
    lastScan: 0,
    mutationTimer: null,
    initialized: false,
    shortcut: null,
    loadingStatic: false,
    scanning: false,
    shiftPressed: false
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
      .module-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        white-space: nowrap;
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
      <div class="shift-indicator" id="shift-indicator">
        <span>⇧</span>
        <span>Abrir en nueva pestaña</span>
      </div>
      <input class="command-input" type="text" placeholder="Buscar módulos, rutas o acciones" autocomplete="off" spellcheck="false" aria-label="Buscar" />
      <ul class="results" role="listbox"></ul>
      <div class="empty-state" hidden>No se encontraron coincidencias.</div>
      <div class="footer">
        <span id="usage-hint">Flechas para navegar - Enter para ir - Esc para cerrar</span>
  <span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd></span>
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
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = templateHtml;
    document.documentElement.appendChild(host);

    const overlay = shadow.querySelector(".overlay");
    const input = shadow.querySelector(".command-input");
    const list = shadow.querySelector(".results");
    const empty = shadow.querySelector(".empty-state");
    const footerHint = shadow.querySelector("#usage-hint");
    const shiftIndicator = shadow.querySelector("#shift-indicator");

    state.host = host;
    state.shadow = shadow;
    state.container = overlay;
    state.input = input;
    state.list = list;
    state.emptyState = empty;
    state.footerBadge = footerHint;
    state.shiftIndicator = shiftIndicator;

    input.addEventListener("input", handleQueryInput);
    input.addEventListener("keydown", handleInputKeys);
    list.addEventListener("click", onResultClick);
    
    // Listeners para detectar Shift
    overlay.addEventListener("keydown", handleShiftDown);
    overlay.addEventListener("keyup", handleShiftUp);
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
    renderResults(getDefaultResults());
  }

  function closeOverlay() {
    if (!state.container || !state.open) return;
    state.open = false;
    state.shiftPressed = false;
    state.container.classList.remove("open");
    if (state.input) state.input.blur();
    updateShiftIndicator();
  }

  function handleQueryInput(event) {
    const query = event.target.value.trim();
    if (!query) {
      renderResults(getDefaultResults());
      return;
    }
    const ranked = rankResults(query, state.nodes);
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
      
      header.appendChild(titleSpan);

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
    const nodes = state.nodes.slice().sort(compareByCategoryAndPath);
    return nodes.slice(0, MAX_RESULTS).map(mapNodeToResult);
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
      module: node.module || "",
      usage: node.usage || 0
    };
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
    scored.sort((a, b) => b.score - a.score);
    const limited = scored.slice(0, MAX_RESULTS).map(item => mapNodeToResult(item.node));
    return limited.sort(compareByCategoryAndPath);
  }

  function scoreNode(tokens, node) {
    const title = node.titleLower;
    const path = node.pathLower;
    let score = 0;

    for (const token of tokens) {
      if (!token) continue;
      if (title === token) score += 120;
      else if (title.startsWith(token)) score += 90;
      else if (title.includes(token)) score += 60;
      else if (path.includes(token)) score += 40;
      else if (fuzzyIncludes(title, token)) score += 25;
      else return 0;
    }

    score += (node.usage || 0) * 30;
    score += node.source === "static" ? 8 : 0;
    score -= node.depth * 2;
    return score;
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
    const key = STORAGE_USAGE_PREFIX + id;
    const nextValue = (state.usageMap.get(id) || 0) + 1;
    state.usageMap.set(id, nextValue);
    chrome.storage.local.set({ [key]: nextValue }).catch(() => {});
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

})();
