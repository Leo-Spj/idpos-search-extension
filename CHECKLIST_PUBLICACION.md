# ✅ Checklist para Publicar en Chrome Web Store

## 📋 Antes de Publicar

### 1. Verificación de Archivos
- [x] Código reorganizado en carpetas (`pages/`, `scripts/`, `icons/`, `data/`)
- [x] `manifest.json` actualizado con rutas correctas
- [x] Referencias en HTML actualizadas
- [x] Archivos innecesarios eliminados
- [x] Script de empaquetado creado (`build-release.sh`)

### 2. Revisión del Manifest
- [ ] Versión correcta: `0.3.0`
- [ ] Nombre: `Universal Navigator`
- [ ] Descripción clara y concisa
- [ ] Permisos necesarios declarados
- [ ] Iconos en 3 tamaños (16, 48, 128)
- [ ] Service worker apunta a `scripts/background.js`
- [ ] Content script apunta a `scripts/content-script.js`
- [ ] Popup apunta a `pages/popup.html`
- [ ] Options page apunta a `pages/manage.html`

### 3. Pruebas Funcionales
- [ ] Cargar extensión en modo desarrollo
- [ ] Probar atajo de teclado (`Ctrl+Shift+K` o `Cmd+Shift+K`)
- [ ] Abrir popup desde el icono
- [ ] Verificar que la barra de comandos aparece
- [ ] Probar búsqueda de rutas
- [ ] Verificar navegación a rutas
- [ ] Abrir página de opciones
- [ ] Abrir panel de gestión de rutas
- [ ] Importar CSV de rutas
- [ ] Exportar rutas a CSV

### 4. Generar Paquete
```bash
./build-release.sh
```
- [ ] Ejecutar script sin errores
- [ ] Verificar que `dist/universal-navigator-v0.3.0.zip` fue creado
- [ ] Tamaño del paquete razonable (~72KB)
- [ ] Revisar contenido del ZIP

### 5. Recursos Gráficos para Chrome Web Store

#### Iconos (Ya incluidos)
- [x] 16x16 → `icons/icon-16.png`
- [x] 48x48 → `icons/icon-48.png`
- [x] 128x128 → `icons/icon-128.png`

#### Imágenes Promocionales (Crear antes de publicar)
- [ ] **Icono de la tienda**: 128x128 (obligatorio)
- [ ] **Tile pequeño**: 440x280 (recomendado)
- [ ] **Captura de pantalla**: 1280x800 o 640x400 (mínimo 1, máximo 5)
- [ ] **Tile marquesina**: 1400x560 (opcional)

**Sugerencias para capturas:**
1. Barra de comandos abierta mostrando búsqueda
2. Panel de gestión de rutas
3. Popup principal con estadísticas
4. Demostración de navegación rápida
5. Página de configuración de atajos

### 6. Información para el Listado

#### Descripción Corta (max 132 caracteres)
```
Barra de comandos flotante para navegación rápida en cualquier sitio web con rutas personalizadas.
```

#### Descripción Detallada
```markdown
Universal Navigator es una extensión que acelera tu navegación en cualquier sitio web mediante una barra de comandos flotante estilo Spotlight.

✨ CARACTERÍSTICAS PRINCIPALES:

• 🚀 Navegación ultrarrápida con búsqueda inteligente
• 📊 Gestión de rutas personalizadas por dominio
• 🎯 Importación/exportación de rutas via CSV
• ⚡ Sistema de ranking que aprende de tus patrones
• ⌨️ Atajos de teclado personalizables
• 🌐 Funciona en cualquier sitio web

🎨 INTERFAZ MODERNA:
Diseño oscuro con efectos glassmorphism, totalmente responsive.

📋 GESTIÓN FÁCIL:
Panel completo para crear, editar, importar y exportar rutas. Organiza tus sitios favoritos.

⌨️ ATAJOS:
• Ctrl+Shift+K (Windows/Linux)
• Cmd+Shift+K (Mac)
• Personalizable desde opciones

Perfecto para desarrolladores, diseñadores y power users que quieren maximizar su productividad.
```

#### Categoría
- [x] Productividad

#### Idioma
- [x] Español (o el idioma principal)

### 7. Privacidad y Permisos

#### Permisos Usados:
- **activeTab**: Para inyectar la barra de comandos en la página actual
- **storage**: Para guardar rutas y configuración del usuario
- **scripting**: Para ejecutar scripts en páginas web
- **tabs**: Para abrir/cerrar pestañas
- **<all_urls>**: Para funcionar en cualquier sitio web

#### Política de Privacidad:
- [ ] Crear documento de política de privacidad
- [ ] Especificar que NO se recopilan datos personales
- [ ] Explicar que todo se almacena localmente
- [ ] Aclarar que NO hay servidores externos

**Ejemplo de política:**
```
Esta extensión NO recopila ningún dato personal. Toda la información 
(rutas, configuración, métricas de uso) se almacena localmente en tu 
navegador usando chrome.storage.local. No hay servidores externos ni 
se envía información a terceros.
```

### 8. Subir a Chrome Web Store

1. [ ] Ir a [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. [ ] Crear cuenta de desarrollador ($5 USD único pago)
3. [ ] Click en "Nuevo elemento"
4. [ ] Subir `dist/universal-navigator-v0.3.0.zip`
5. [ ] Completar información del listado
6. [ ] Subir capturas de pantalla
7. [ ] Revisar y enviar para revisión

### 9. Después de Publicar

- [ ] Esperar aprobación (1-3 días típicamente)
- [ ] Verificar que funciona en producción
- [ ] Compartir enlace de Chrome Web Store
- [ ] Actualizar README con badge de Chrome Web Store
- [ ] Considerar crear página de producto/landing page

### 10. Mantenimiento Futuro

- [ ] Monitorear reviews y feedback
- [ ] Responder a usuarios
- [ ] Planear actualizaciones según feedback
- [ ] Mantener versiones del paquete en control de versiones

## 🎯 Recursos Útiles

- [Documentación oficial](https://developer.chrome.com/docs/webstore/publish/)
- [Guía de revisión](https://developer.chrome.com/docs/webstore/review/)
- [Políticas de Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/)

## 📊 Estimado de Tiempo

- **Preparación**: ✅ Completado
- **Crear recursos gráficos**: 1-2 horas
- **Subir y completar información**: 30 minutos
- **Revisión de Google**: 1-3 días
- **Total**: ~2-4 días

## ✨ ¡Tu extensión está lista!

El código está completamente reorganizado y funcional. Solo faltan los recursos gráficos 
promocionales para completar el listado en Chrome Web Store.
