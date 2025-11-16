# Guía de Pruebas - Universal Navigator

## 1. Prueba de Carga Inicial

### Objetivo
Verificar que las rutas se cargan correctamente desde el CSV al instalar la extensión.

### Pasos
1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el "Modo de desarrollador"
3. Carga la extensión (o recárgala si ya está instalada)
4. Abre la consola de fondo (Background Service Worker)
5. Verifica que aparezca: `Navigator: Loaded X default routes`

### Resultado Esperado
- La extensión carga todas las rutas del archivo `data/routes.csv`
- Se muestra el número correcto de rutas cargadas en la consola

---

## 2. Prueba de Filtrado por Dominio

### Objetivo
Verificar que solo se muestran rutas del dominio activo.

### Pasos
1. Navega a `https://pos.idbi.pe` (o el dominio configurado)
2. Presiona `Ctrl+Shift+K` (o `Cmd+Shift+K` en Mac)
3. La barra de comandos debe aparecer
4. Sin escribir nada, observa los resultados mostrados
5. Todos los resultados deben tener el dominio actual

### Resultado Esperado
- Solo aparecen rutas con `domain: pos.idbi.pe` en el CSV
- Si navegas a otro dominio configurado, las rutas cambian automáticamente

---

## 3. Prueba del Panel de Gestión

### Objetivo
Verificar que el panel de gestión funciona correctamente.

### Pasos
1. Haz clic en el icono de la extensión
2. Se debe abrir el panel de gestión
3. Verifica las estadísticas mostradas:
   - Rutas Totales: debe coincidir con el CSV
   - Dominios Activos: número de dominios únicos
   - Rutas Activas: rutas con status != "legacy"
4. Revisa la lista de dominios configurados

### Resultado Esperado
- Las estadísticas son correctas
- Se muestran todos los dominios del CSV
- Cada dominio muestra su conteo de rutas

---

## 4. Prueba de Descarga de Plantilla

### Objetivo
Verificar que se puede descargar la plantilla CSV.

### Pasos
1. Abre el panel de gestión
2. Haz clic en "Descargar Plantilla CSV"
3. Se descarga un archivo `routes-template.csv`
4. Abre el archivo en un editor de texto
5. Verifica que tiene el formato correcto

### Resultado Esperado
```csv
domain,id,module,title,url,tags,description,status
pos.idbi.pe,route:orders,Ventas,Órdenes,/orders,"Ventas|Órdenes",Gestión de órdenes,active
...
```

---

## 5. Prueba de Exportación

### Objetivo
Verificar que se pueden exportar las rutas actuales.

### Pasos
1. Abre el panel de gestión
2. Haz clic en "Exportar Rutas Actuales"
3. Se descarga un archivo `routes-export-YYYY-MM-DD.csv`
4. Abre el archivo
5. Verifica que contiene todas las rutas actuales

### Resultado Esperado
- El archivo se descarga correctamente
- Contiene todas las rutas almacenadas
- El formato es idéntico al CSV original

---

## 6. Prueba de Importación

### Objetivo
Verificar que se pueden importar nuevas rutas desde CSV.

### Preparación
Crea un archivo `test-routes.csv`:

```csv
domain,id,module,title,url,tags,description,status
test.example.com,page:home,General,Inicio,/home,"General|Inicio",Página de inicio,active
test.example.com,page:about,General,Acerca de,/about,"General|Acerca de",Información,active
github.com,repo:main,Code,Repositorios,/repositories,"Code|Repos",Mis repositorios,active
```

### Pasos
1. Abre el panel de gestión
2. Haz clic en "Importar CSV"
3. Selecciona el archivo `test-routes.csv`
4. Confirma la importación (2 confirmaciones)
5. Verifica que las estadísticas se actualizan:
   - Rutas Totales: 3
   - Dominios Activos: 2

### Resultado Esperado
- Las rutas se importan correctamente
- Se muestran los nuevos dominios
- Las rutas antiguas se reemplazan

---

## 7. Prueba de Navegación con Nuevas Rutas

### Objetivo
Verificar que las rutas importadas funcionan.

### Pasos
1. Después de importar `test-routes.csv`
2. Navega a `https://test.example.com`
3. Presiona `Ctrl+Shift+K`
4. Deberías ver solo 2 resultados: "Inicio" y "Acerca de"
5. Navega a `https://github.com`
6. Presiona `Ctrl+Shift+K`
7. Deberías ver solo 1 resultado: "Repositorios"

### Resultado Esperado
- En cada dominio solo aparecen sus rutas específicas
- Las rutas de otros dominios no se muestran

---

## 8. Prueba de Búsqueda

### Objetivo
Verificar que la búsqueda funciona correctamente.

### Pasos (en pos.idbi.pe)
1. Presiona `Ctrl+Shift+K`
2. Escribe "ventas"
3. Solo deben aparecer rutas del módulo Ventas
4. Escribe "ordenes"
5. Deben aparecer: "Órdenes", "Órdenes de Compra", etc.
6. Borra y escribe "ventas:ordenes"
7. Solo debe aparecer "Órdenes" del módulo Ventas

### Resultado Esperado
- La búsqueda filtra correctamente
- El sistema de ranking prioriza coincidencias exactas
- El filtro por módulo funciona con ":"

---

## 9. Prueba de Eliminación

### Objetivo
Verificar que se pueden eliminar todas las rutas.

### Pasos
1. Abre el panel de gestión
2. Haz clic en "Eliminar Todas las Rutas"
3. Confirma la primera advertencia
4. Confirma la segunda advertencia
5. Las estadísticas deben mostrar 0 en todos los campos
6. La lista de dominios debe estar vacía

### Resultado Esperado
- Se eliminan todas las rutas
- Las estadísticas se actualizan a 0
- Al recargar la extensión, se cargan las rutas por defecto del CSV

---

## 10. Prueba de Apertura en Nueva Pestaña

### Objetivo
Verificar que Shift+Enter abre en nueva pestaña.

### Pasos
1. Navega a pos.idbi.pe
2. Presiona `Ctrl+Shift+K`
3. Selecciona cualquier resultado con las flechas
4. Presiona `Shift+Enter`
5. Debe abrirse una nueva pestaña con la ruta seleccionada

### Resultado Esperado
- Se abre una nueva pestaña
- La pestaña actual permanece
- La nueva pestaña carga la URL correcta

---

## 11. Prueba de Métricas de Uso

### Objetivo
Verificar que el sistema aprende de los patrones de uso.

### Pasos
1. Presiona `Ctrl+Shift+K`
2. Busca "ordenes" y selecciónala (Enter)
3. Repite 5 veces
4. Presiona `Ctrl+Shift+K` sin escribir nada
5. "Órdenes" debe aparecer en los primeros resultados

### Resultado Esperado
- Las rutas más usadas aparecen primero
- El ranking se actualiza dinámicamente
- Los datos persisten entre sesiones

---

## 12. Prueba Multi-Dominio Completa

### Objetivo
Verificar que el sistema funciona con múltiples dominios simultáneamente.

### Preparación
Importa este CSV:

```csv
domain,id,module,title,url,tags,description,status
pos.idbi.pe,route:orders,Ventas,Órdenes,/orders,"Ventas|Órdenes",Gestión de órdenes,active
github.com,repo:profile,Profile,Mi Perfil,/settings/profile,"Settings|Profile",Configuración,active
stackoverflow.com,questions:mine,Questions,Mis Preguntas,/users/current?tab=questions,"Profile|Questions",Mis preguntas,active
```

### Pasos
1. Navega a `https://pos.idbi.pe`
2. Presiona `Ctrl+Shift+K` → debe mostrar "Órdenes"
3. Navega a `https://github.com`
4. Presiona `Ctrl+Shift+K` → debe mostrar "Mi Perfil"
5. Navega a `https://stackoverflow.com`
6. Presiona `Ctrl+Shift+K` → debe mostrar "Mis Preguntas"

### Resultado Esperado
- En cada sitio solo se muestran sus rutas
- El cambio de dominio actualiza las rutas automáticamente
- No hay mezcla de rutas entre dominios

---

## 🐛 Reporte de Bugs

Si encuentras algún problema durante las pruebas:

1. Anota los pasos exactos para reproducirlo
2. Captura pantalla si es posible
3. Revisa la consola del navegador para errores
4. Verifica la consola del background service worker
5. Incluye el CSV que estabas usando

## ✅ Checklist Final

- [ ] Carga inicial funciona
- [ ] Filtrado por dominio correcto
- [ ] Panel de gestión muestra estadísticas
- [ ] Descarga de plantilla funciona
- [ ] Exportación funciona
- [ ] Importación funciona
- [ ] Navegación con nuevas rutas
- [ ] Búsqueda y filtrado
- [ ] Eliminación de rutas
- [ ] Apertura en nueva pestaña
- [ ] Métricas de uso
- [ ] Funcionamiento multi-dominio

---

**Nota**: Estas pruebas deben realizarse en el orden indicado para verificar la funcionalidad completa del sistema.
