// Script de migración para inicializar metadata desde rutas existentes
// Este script se puede ejecutar una vez para generar el tracking inicial

const STORAGE_ROUTES_KEY = "navigatorRoutes";
const STORAGE_METADATA_KEY = "navigatorMetadata";

async function migrateExistingRoutes() {
  console.log('🔄 Iniciando migración de metadata...');
  
  try {
    // Cargar rutas existentes
    const stored = await chrome.storage.local.get([STORAGE_ROUTES_KEY]);
    const routes = stored[STORAGE_ROUTES_KEY] || [];
    
    if (!routes.length) {
      console.log('⚠️  No hay rutas para migrar');
      return;
    }
    
    console.log(`📊 Procesando ${routes.length} rutas...`);
    
    // Inicializar metadata
    const metadata = {
      modulesUsage: {},
      tagsUsage: {},
      version: 1
    };
    
    // Procesar cada ruta
    routes.forEach(route => {
      const domain = (route.domain || '').replace(/^www\./, '');
      const module = route.module || 'General';
      const tagsString = route.tags || '';
      const tags = tagsString.split('|').map(t => t.trim()).filter(Boolean);
      
      if (!domain) return;
      
      // Inicializar dominio si no existe
      if (!metadata.modulesUsage[domain]) {
        metadata.modulesUsage[domain] = {};
      }
      if (!metadata.tagsUsage[domain]) {
        metadata.tagsUsage[domain] = {};
      }
      
      // Trackear módulo
      if (!metadata.modulesUsage[domain][module]) {
        metadata.modulesUsage[domain][module] = { count: 0, lastUsed: null };
      }
      metadata.modulesUsage[domain][module].count++;
      
      // Trackear tags
      tags.forEach(tag => {
        if (!tag) return;
        
        if (!metadata.tagsUsage[domain][tag]) {
          metadata.tagsUsage[domain][tag] = {
            count: 0,
            lastUsed: null,
            modules: []
          };
        }
        
        const tagData = metadata.tagsUsage[domain][tag];
        tagData.count++;
        
        // Asociar tag con módulo
        if (!tagData.modules.includes(module)) {
          tagData.modules.push(module);
        }
      });
    });
    
    // Guardar metadata
    await chrome.storage.local.set({ [STORAGE_METADATA_KEY]: metadata });
    
    // Estadísticas de migración
    const totalDomains = Object.keys(metadata.modulesUsage).length;
    const totalModules = Object.values(metadata.modulesUsage)
      .reduce((sum, domainModules) => sum + Object.keys(domainModules).length, 0);
    const totalTags = Object.values(metadata.tagsUsage)
      .reduce((sum, domainTags) => sum + Object.keys(domainTags).length, 0);
    
    console.log('✅ Migración completada:');
    console.log(`   - Dominios procesados: ${totalDomains}`);
    console.log(`   - Módulos únicos: ${totalModules}`);
    console.log(`   - Tags únicos: ${totalTags}`);
    console.log('   - Metadata guardada en storage');
    
    return metadata;
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  }
}

// Función para mostrar estadísticas de metadata
async function showMetadataStats() {
  const stored = await chrome.storage.local.get([STORAGE_METADATA_KEY]);
  const metadata = stored[STORAGE_METADATA_KEY];
  
  if (!metadata) {
    console.log('⚠️  No hay metadata almacenada');
    return;
  }
  
  console.log('📊 Estadísticas de Metadata:');
  console.log('─────────────────────────────');
  
  Object.keys(metadata.modulesUsage).forEach(domain => {
    console.log(`\n🌐 ${domain}`);
    
    // Módulos
    const modules = metadata.modulesUsage[domain];
    const sortedModules = Object.entries(modules)
      .sort((a, b) => b[1].count - a[1].count);
    
    console.log('  📁 Módulos:');
    sortedModules.forEach(([name, data]) => {
      console.log(`     ${name}: ${data.count} usos`);
    });
    
    // Tags
    const tags = metadata.tagsUsage[domain];
    const sortedTags = Object.entries(tags)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10); // Top 10
    
    console.log('  🏷️  Top 10 Tags:');
    sortedTags.forEach(([name, data]) => {
      const modulesStr = data.modules.join(', ');
      console.log(`     ${name}: ${data.count} usos (módulos: ${modulesStr})`);
    });
  });
}

// Función para limpiar metadata (útil para debugging)
async function clearMetadata() {
  await chrome.storage.local.remove(STORAGE_METADATA_KEY);
  console.log('🗑️  Metadata eliminada');
}

// Exportar funciones para uso en consola DevTools
if (typeof window !== 'undefined') {
  window.migrateMetadata = migrateExistingRoutes;
  window.showMetadataStats = showMetadataStats;
  window.clearMetadata = clearMetadata;
  
  console.log('🛠️  Utilidades de migración cargadas:');
  console.log('   - migrateMetadata(): Generar metadata desde rutas');
  console.log('   - showMetadataStats(): Mostrar estadísticas');
  console.log('   - clearMetadata(): Limpiar metadata');
}

// Auto-ejecutar migración si se carga como script
if (typeof chrome !== 'undefined' && chrome.storage) {
  // Verificar si ya existe metadata
  chrome.storage.local.get([STORAGE_METADATA_KEY], (result) => {
    if (!result[STORAGE_METADATA_KEY]) {
      console.log('🔍 No se encontró metadata, ejecutando migración automática...');
      migrateExistingRoutes();
    } else {
      console.log('✅ Metadata ya existe');
      console.log('💡 Ejecuta showMetadataStats() para ver estadísticas');
    }
  });
}
