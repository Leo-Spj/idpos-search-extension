export const STORAGE_ROUTES_KEY = "navigatorRoutes";
export const CSV_PATH = "data/routes-example-social.csv";

export function removeAccents(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Normalización de texto para módulos y tags
export function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text.trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Componente reutilizable de selección inteligente con chips
export class SmartSelector {
  constructor(options) {
    this.inputElement = options.inputElement;
    this.chipsContainer = options.chipsContainer;
    this.datalistElement = options.datalistElement;
    this.onSelect = options.onSelect || (() => {});
    this.onChange = options.onChange || (() => {});
    this.getAllOptions = options.getAllOptions || (() => []);
    this.getFilteredOptions = options.getFilteredOptions || (() => this.getAllOptions());
    this.allowMultiple = options.allowMultiple || false;
    this.placeholder = options.placeholder || 'No hay opciones disponibles';
    this.enableSearch = options.enableSearch || false;
    this.normalizeInput = options.normalizeInput !== false;
    
    this.selectedValues = new Set();
    this.searchTerm = '';
    
    this.init();
  }
  
  init() {
    if (this.inputElement) {
      this.inputElement.addEventListener('input', () => this.handleInputChange());
      this.inputElement.addEventListener('blur', () => this.handleInputBlur());
    }
    
    if (this.chipsContainer) {
      this.chipsContainer.addEventListener('click', (e) => this.handleChipClick(e));
      
      if (this.enableSearch) {
        this.createSearchInput();
      }
    }
    
    this.refresh();
  }
  
  createSearchInput() {
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'chip-search-wrapper';
    searchWrapper.innerHTML = `
      <input type="text" 
             class="chip-search-input" 
             placeholder="🔍 Buscar..." 
             autocomplete="off">
    `;
    
    this.chipsContainer.insertBefore(searchWrapper, this.chipsContainer.firstChild);
    
    const searchInput = searchWrapper.querySelector('.chip-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderChips();
    });
  }
  
  handleInputChange() {
    const value = this.inputElement.value;
    
    if (this.normalizeInput) {
      // Normalizar automáticamente mientras se escribe
      const normalized = normalizeText(value);
      if (normalized !== value && this.inputElement === document.activeElement) {
        const start = this.inputElement.selectionStart;
        const end = this.inputElement.selectionEnd;
        this.inputElement.value = normalized;
        this.inputElement.setSelectionRange(start, end);
      }
    }
    
    if (this.allowMultiple) {
      this.syncMultipleSelection();
    } else {
      this.syncSingleSelection();
    }
    
    this.updateDatalist();
    this.onChange(value);
  }
  
  handleInputBlur() {
    if (this.normalizeInput && this.inputElement.value) {
      this.inputElement.value = normalizeText(this.inputElement.value);
    }
  }
  
  handleChipClick(event) {
    const chip = event.target.closest('.chip-button');
    if (!chip || !chip.dataset.value) return;
    
    const value = chip.dataset.value;
    
    if (this.allowMultiple) {
      this.toggleMultipleValue(value);
    } else {
      this.selectSingleValue(value);
    }
    
    this.onSelect(value, chip.classList.contains('active'));
  }
  
  toggleMultipleValue(value) {
    const currentValues = this.getCurrentValues();
    const normalizedValue = value.toLowerCase();
    
    let nextValues;
    if (currentValues.some(v => v.toLowerCase() === normalizedValue)) {
      nextValues = currentValues.filter(v => v.toLowerCase() !== normalizedValue);
    } else {
      nextValues = [...currentValues, value];
    }
    
    this.inputElement.value = nextValues.join(', ');
    this.syncMultipleSelection();
  }
  
  selectSingleValue(value) {
    this.inputElement.value = value;
    this.syncSingleSelection();
    this.inputElement.focus();
  }
  
  getCurrentValues() {
    if (!this.inputElement.value) return [];
    return this.inputElement.value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
  
  syncMultipleSelection() {
    const currentValues = this.getCurrentValues();
    this.selectedValues = new Set(currentValues.map(v => v.toLowerCase()));
    this.renderChips();
  }
  
  syncSingleSelection() {
    const value = this.inputElement.value.trim().toLowerCase();
    this.selectedValues = value ? new Set([value]) : new Set();
    this.renderChips();
  }
  
  updateDatalist() {
    if (!this.datalistElement) return;
    
    const options = this.getFilteredOptions();
    this.datalistElement.innerHTML = '';
    
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = typeof opt === 'string' ? opt : opt.value;
      if (opt.label) option.label = opt.label;
      this.datalistElement.appendChild(option);
    });
  }
  
  renderChips() {
    if (!this.chipsContainer) return;
    
    // Preservar el input de búsqueda si existe
    const searchWrapper = this.chipsContainer.querySelector('.chip-search-wrapper');
    this.chipsContainer.innerHTML = '';
    
    if (searchWrapper) {
      this.chipsContainer.appendChild(searchWrapper);
    }
    
    const options = this.getFilteredOptions();
    
    if (!options.length) {
      const placeholder = document.createElement('span');
      placeholder.className = 'chip-placeholder';
      placeholder.textContent = this.placeholder;
      this.chipsContainer.appendChild(placeholder);
      return;
    }
    
    // Filtrar por término de búsqueda
    const filteredOptions = this.searchTerm 
      ? options.filter(opt => {
          const value = typeof opt === 'string' ? opt : opt.value;
          return value.toLowerCase().includes(this.searchTerm);
        })
      : options;
    
    if (!filteredOptions.length && this.searchTerm) {
      const placeholder = document.createElement('span');
      placeholder.className = 'chip-placeholder';
      placeholder.textContent = `No se encontraron resultados para "${this.searchTerm}"`;
      this.chipsContainer.appendChild(placeholder);
      return;
    }
    
    filteredOptions.forEach(opt => {
      const value = typeof opt === 'string' ? opt : opt.value;
      const label = (typeof opt === 'object' && opt.label) ? opt.label : value;
      const count = (typeof opt === 'object' && opt.count) ? opt.count : null;
      
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-button';
      chip.dataset.value = value;
      
      if (this.selectedValues.has(value.toLowerCase())) {
        chip.classList.add('active');
      }
      
      chip.innerHTML = label;
      
      if (count !== null) {
        const badge = document.createElement('span');
        badge.className = 'chip-count';
        badge.textContent = count;
        chip.appendChild(badge);
      }
      
      this.chipsContainer.appendChild(chip);
    });
  }
  
  refresh() {
    this.updateDatalist();
    this.renderChips();
  }
  
  setValue(value) {
    this.inputElement.value = value;
    if (this.allowMultiple) {
      this.syncMultipleSelection();
    } else {
      this.syncSingleSelection();
    }
  }
  
  destroy() {
    // Cleanup event listeners si es necesario
    this.selectedValues.clear();
  }
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return [];
  
  const routes = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 8) continue;
    
    const route = {
      domain: values[0] || "",
      id: values[1] || "",
      module: values[2] || "",
      title: values[3] || "",
      url: values[4] || "",
      tags: values[5] ? values[5].replace(/^"|"$/g, "") : "",
      description: values[6] || "",
      status: values[7] || "active"
    };
    
    if (route.domain && route.id && route.title) {
      routes.push(route);
    }
  }
  
  return routes;
}

export function parseCSVLine(line) {
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

// ============================================
// SISTEMA DE ATAJOS DE TECLADO PERSONALIZADOS
// ============================================

// Teclas reservadas que no se pueden usar (conflictos con navegador)
const RESERVED_SHORTCUTS = new Set([
  'ctrl+t', 'ctrl+w', 'ctrl+n', 'ctrl+shift+n', 'ctrl+tab', 'ctrl+shift+tab',
  'ctrl+l', 'ctrl+d', 'ctrl+h', 'ctrl+j', 'ctrl+p', 'ctrl+s', 'ctrl+o',
  'ctrl+f', 'ctrl+g', 'ctrl+u', 'ctrl+shift+i', 'ctrl+shift+j', 'ctrl+shift+c',
  'alt+f4', 'alt+tab', 'meta+w', 'meta+t', 'meta+n', 'meta+q', 'meta+tab',
  'f1', 'f3', 'f5', 'f6', 'f7', 'f11', 'f12'
]);

// Serializar shortcut a string para comparación
export function serializeShortcut(shortcut) {
  if (!shortcut || !shortcut.key) return '';
  const parts = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.alt) parts.push('alt');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.meta) parts.push('meta');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

// Deserializar string a objeto shortcut
export function deserializeShortcut(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.toLowerCase().split('+');
  if (parts.length === 0) return null;
  
  const shortcut = {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta'),
    key: parts[parts.length - 1]
  };
  
  // Validar que tenga al menos un modificador
  if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
    return null;
  }
  
  return shortcut;
}

// Formatear shortcut para mostrar al usuario
export function formatShortcutDisplay(shortcut) {
  if (!shortcut || !shortcut.key) return '';
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts = [];
  
  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');
  
  // Formatear tecla especial
  let keyDisplay = shortcut.key.toUpperCase();
  if (keyDisplay === ' ') keyDisplay = 'Space';
  if (keyDisplay === 'ARROWUP') keyDisplay = '↑';
  if (keyDisplay === 'ARROWDOWN') keyDisplay = '↓';
  if (keyDisplay === 'ARROWLEFT') keyDisplay = '←';
  if (keyDisplay === 'ARROWRIGHT') keyDisplay = '→';
  
  parts.push(keyDisplay);
  
  return parts.join(isMac ? '' : ' + ');
}

// Verificar si un atajo está reservado
export function isShortcutReserved(shortcut) {
  const serialized = serializeShortcut(shortcut);
  return RESERVED_SHORTCUTS.has(serialized);
}

// Verificar si un atajo ya existe en las rutas del dominio
export function findShortcutConflict(shortcut, routes, currentDomain, excludeRouteId = null) {
  if (!shortcut || !shortcut.key) return null;
  
  const serialized = serializeShortcut(shortcut);
  const normalizedDomain = currentDomain.replace(/^www\./, '');
  
  return routes.find(route => {
    if (excludeRouteId && route.id === excludeRouteId) return false;
    if (route.domain.replace(/^www\./, '') !== normalizedDomain) return false;
    if (!route.shortcut) return false;
    return serializeShortcut(route.shortcut) === serialized;
  });
}

// Componente de captura de atajos de teclado
export class ShortcutRecorder {
  constructor(options) {
    this.inputElement = options.inputElement;
    this.displayElement = options.displayElement;
    this.clearButton = options.clearButton;
    this.onCapture = options.onCapture || (() => {});
    this.onClear = options.onClear || (() => {});
    this.validateConflict = options.validateConflict || (() => null);
    
    this.currentShortcut = null;
    this.isRecording = false;
    
    this.init();
  }
  
  init() {
    if (this.inputElement) {
      this.inputElement.addEventListener('focus', () => this.startRecording());
      this.inputElement.addEventListener('blur', () => this.stopRecording());
      this.inputElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
      this.inputElement.setAttribute('readonly', true);
      this.inputElement.style.cursor = 'pointer';
    }
    
    if (this.clearButton) {
      this.clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.clear();
      });
    }
  }
  
  startRecording() {
    this.isRecording = true;
    if (this.displayElement) {
      this.displayElement.textContent = '⌨️ Presiona tu atajo...';
      this.displayElement.classList.add('recording');
    }
    if (this.inputElement) {
      this.inputElement.classList.add('recording');
    }
  }
  
  stopRecording() {
    this.isRecording = false;
    if (this.displayElement) {
      this.displayElement.classList.remove('recording');
      if (this.currentShortcut) {
        this.displayElement.textContent = formatShortcutDisplay(this.currentShortcut);
      } else {
        this.displayElement.textContent = 'Sin atajo';
      }
    }
    if (this.inputElement) {
      this.inputElement.classList.remove('recording');
    }
  }
  
  handleKeyDown(event) {
    if (!this.isRecording) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Ignorar solo modificadores
    const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'];
    if (modifierKeys.includes(event.key)) {
      return;
    }
    
    // Escape cancela la grabación
    if (event.key === 'Escape') {
      this.inputElement.blur();
      return;
    }
    
    // Crear objeto shortcut
    const shortcut = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      key: event.key.length === 1 ? event.key.toLowerCase() : event.key
    };
    
    // Validar que tenga al menos un modificador
    if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
      this.showError('Debe incluir al menos un modificador (Ctrl, Alt, Shift)');
      return;
    }
    
    // Validar que no sea reservado
    if (isShortcutReserved(shortcut)) {
      this.showError('Este atajo está reservado por el navegador');
      return;
    }
    
    // Validar conflictos con otras rutas
    const conflict = this.validateConflict(shortcut);
    if (conflict) {
      this.showError(`Atajo ya asignado a: ${conflict.title}`);
      return;
    }
    
    // Atajo válido
    this.currentShortcut = shortcut;
    this.hideError();
    
    if (this.displayElement) {
      this.displayElement.textContent = formatShortcutDisplay(shortcut);
      this.displayElement.classList.add('success');
      setTimeout(() => this.displayElement.classList.remove('success'), 500);
    }
    
    this.onCapture(shortcut);
    this.inputElement.blur();
  }
  
  showError(message) {
    if (this.displayElement) {
      this.displayElement.textContent = `❌ ${message}`;
      this.displayElement.classList.add('error');
      setTimeout(() => {
        this.displayElement.classList.remove('error');
        if (this.currentShortcut) {
          this.displayElement.textContent = formatShortcutDisplay(this.currentShortcut);
        } else {
          this.displayElement.textContent = '⌨️ Presiona tu atajo...';
        }
      }, 2000);
    }
  }
  
  hideError() {
    if (this.displayElement) {
      this.displayElement.classList.remove('error');
    }
  }
  
  setShortcut(shortcut) {
    this.currentShortcut = shortcut;
    if (this.displayElement) {
      this.displayElement.textContent = shortcut ? formatShortcutDisplay(shortcut) : 'Sin atajo';
    }
  }
  
  getShortcut() {
    return this.currentShortcut;
  }
  
  clear() {
    this.currentShortcut = null;
    if (this.displayElement) {
      this.displayElement.textContent = 'Sin atajo';
    }
    this.onClear();
  }
  
  destroy() {
    this.currentShortcut = null;
    this.isRecording = false;
  }
}

// Sugerir atajos disponibles (Alt+1 a Alt+9)
export function suggestAvailableShortcuts(routes, currentDomain) {
  const normalizedDomain = currentDomain.replace(/^www\./, '');
  const usedShortcuts = new Set();
  
  routes.forEach(route => {
    if (route.domain.replace(/^www\./, '') === normalizedDomain && route.shortcut) {
      usedShortcuts.add(serializeShortcut(route.shortcut));
    }
  });
  
  const suggestions = [];
  
  // Sugerir Alt+1 a Alt+9
  for (let i = 1; i <= 9; i++) {
    const shortcut = { ctrl: false, alt: true, shift: false, meta: false, key: i.toString() };
    const serialized = serializeShortcut(shortcut);
    if (!usedShortcuts.has(serialized)) {
      suggestions.push(shortcut);
    }
  }
  
  // Sugerir Alt+letras comunes
  const letters = ['d', 'h', 'o', 's', 'r', 'p', 'c', 'v', 'b', 'n'];
  for (const letter of letters) {
    const shortcut = { ctrl: false, alt: true, shift: false, meta: false, key: letter };
    const serialized = serializeShortcut(shortcut);
    if (!usedShortcuts.has(serialized) && !isShortcutReserved(shortcut)) {
      suggestions.push(shortcut);
    }
  }
  
  return suggestions.slice(0, 5); // Retornar máximo 5 sugerencias
}

