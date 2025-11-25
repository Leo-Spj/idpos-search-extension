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
