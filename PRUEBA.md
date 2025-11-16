# Cómo Probar la Extensión

## 1. Limpiar Rutas Actuales

### Opción A: Desde la Consola del Navegador
1. Abre la página de gestión: clic derecho en el ícono de la extensión → **Opciones**
2. Abre las DevTools (F12)
3. Ve a la pestaña **Console**
4. Ejecuta este comando:
```javascript
chrome.storage.local.set({ navigatorRoutes: [] }, () => {
  console.log('Rutas eliminadas');
  location.reload();
});
```

### Opción B: Desde la Página de Gestión
1. Abre la página de gestión
2. Ve al tab **"Importar/Exportar"**
3. Haz clic en **"⚠️ Eliminar Todas las Rutas"**
4. Confirma dos veces

## 2. Importar Rutas de Prueba para Google

Ya tienes el archivo `plantilla_rutas (1).csv` con 3 rutas para `www.google.com`:
- www.google.com,page:home,General,Página Principal,/home
- www.google.com,page:about,General,Acerca de,/about
- www.google.com,page:contact,General,Contacto,/contact

**Nota importante**: El sistema normaliza dominios automáticamente, así que:
- `www.google.com` y `google.com` se tratan como iguales ✅
- `github.com` y `www.github.com` se tratan como iguales ✅

### Para importar:
1. En el tab **"Importar/Exportar"**
2. **Arrastra** el archivo `plantilla_rutas (1).csv` al área de carga
   - O haz clic en **"Seleccionar Archivo"** y elige el CSV
3. Confirma la importación cuando aparezca el diálogo
4. Verás el mensaje: **"3 rutas importadas correctamente"**

## 3. Probar en Google.com

1. **Navega a** `https://www.google.com`
2. **Recarga la extensión** en `chrome://extensions/`
3. **Presiona** `Cmd+Shift+K` (Mac) o `Ctrl+Shift+K` (Windows/Linux)
4. Deberías ver el panel con las 3 rutas configuradas
5. Puedes buscar: "home", "about", "contact"

## 4. Probar en Otros Dominios (Sin Rutas)

1. **Navega a** cualquier otra web, por ejemplo: `https://github.com`
2. **Presiona** `Cmd+Shift+K`
3. **NO debería aparecer nada** ni capturar texto de la página
4. En la consola (F12) verás: `"Navigator: No hay rutas configuradas para github.com"`

## 5. Agregar Más Dominios

Puedes crear rutas manualmente desde la página de gestión:

1. Tab **"Todas las Rutas"** → **"➕ Nueva Ruta"**
2. Completa el formulario:
   - **Dominio**: github.com (sin http:// ni www.)
   - **ID**: page:repos
   - **Título**: Mis Repositorios
   - **Módulo**: Desarrollo
   - **URL**: /Leo-Spj?tab=repositories
   - **Tags**: Desarrollo|Repos|Code
   - **Descripción**: Lista de repositorios
   - **Estado**: Activo
3. Haz clic en **"Guardar"**
4. Navega a GitHub y prueba el atajo

## 6. Exportar Rutas

Para hacer respaldo o compartir:
- Tab **"Importar/Exportar"** → **"💾 Exportar Todas"**
- O exporta por dominio en el tab **"Por Dominio"**

## Verificación de Correcciones

✅ **Problema resuelto**: Ya NO aparecerá texto aleatorio de la página cuando:
- No hay rutas configuradas para el dominio actual
- Has eliminado todas las rutas
- Navegas a un dominio nuevo sin configuración

✅ **Nuevo comportamiento**:
- Solo se activa el comando en dominios con rutas configuradas
- No escanea el DOM si no hay rutas estáticas
- Mensaje de log en consola cuando no hay rutas: `"Navigator: No hay rutas configuradas para [dominio]"`
- El atajo de teclado simplemente no hace nada (no abre el panel)

## Solución de Problemas

### La extensión no funciona después de importar
- **Recarga la extensión** en `chrome://extensions/` (botón circular de recarga)
- **Recarga la página web** donde quieres usar el navegador

### El atajo de teclado no funciona
- Verifica que el dominio en la URL coincide con el dominio en el CSV
- **El sistema normaliza dominios**: `www.google.com` = `google.com`
- Abre la consola (F12) y busca mensajes del Navigator
- Verifica que has **recargado la extensión** después de importar rutas

### No se importa el CSV
- Verifica que el formato sea correcto: `domain,id,module,title,url,tags,description,status`
- Asegúrate de que el archivo tenga extensión `.csv`
- Comprueba que no haya líneas vacías al final del archivo

### Ver estado actual de las rutas
Ejecuta en la consola:
```javascript
chrome.storage.local.get('navigatorRoutes', (result) => {
  console.log('Rutas actuales:', result.navigatorRoutes);
});
```
