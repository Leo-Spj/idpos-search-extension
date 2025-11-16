# 🚀 Guía de Instalación Rápida

## Para Usuarios Finales

### Paso 1: Descargar la Extensión
1. Descarga el archivo ZIP del proyecto
2. Extrae el contenido en una carpeta de tu elección

### Paso 2: Instalar en Chrome
1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta donde extrajiste el proyecto
5. ¡Listo! La extensión está instalada

### Paso 3: Primer Uso
1. Navega a `https://pos.idbi.pe` (o cualquier dominio configurado)
2. Presiona `Ctrl+Shift+K` (Windows/Linux) o `Cmd+Shift+K` (Mac)
3. La barra de comandos aparecerá
4. Escribe para buscar o navega con las flechas

---

## Para Configurar Nuevos Sitios

### Opción 1: Interfaz Gráfica (Recomendado)

1. **Haz clic en el icono** de la extensión en la barra de Chrome
2. Se abrirá el **Panel de Gestión**
3. Haz clic en **"Descargar Plantilla CSV"** para ver un ejemplo
4. Edita el archivo CSV con tus rutas:
   ```csv
   domain,id,module,title,url,tags,description,status
   tudominio.com,page:home,General,Inicio,/home,"General|Inicio",Página principal,active
   ```
5. Guarda el archivo
6. Haz clic en **"Importar CSV"** y selecciona tu archivo
7. Confirma la importación

### Opción 2: Edición Manual del CSV

1. Abre el archivo `data/routes.csv` en un editor de texto
2. Agrega tus rutas siguiendo el formato:
   ```csv
   domain,id,module,title,url,tags,description,status
   ```
3. Guarda el archivo
4. Recarga la extensión en `chrome://extensions/`

---

## Formato del CSV

### Estructura

```csv
domain,id,module,title,url,tags,description,status
```

### Ejemplo Completo

```csv
domain,id,module,title,url,tags,description,status
github.com,repo:main,Repos,Repositorios,/repositories,"Code|Repositorios",Lista de repos,active
github.com,issues:list,Issues,Mis Issues,/issues,"Code|Issues",Mis issues abiertas,active
stackoverflow.com,profile:me,Perfil,Mi Perfil,/users/12345,"Profile|Personal",Ver perfil,active
pos.idbi.pe,route:orders,Ventas,Órdenes,/orders,"Ventas|Órdenes",Gestión de órdenes,active
```

### Descripción de Columnas

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `domain` | Dominio del sitio web | `github.com` |
| `id` | ID único de la ruta | `repo:main` |
| `module` | Categoría o módulo | `Repositorios` |
| `title` | Título visible | `Mis Repositorios` |
| `url` | Ruta URL (absoluta o relativa) | `/repositories` |
| `tags` | Jerarquía separada por `\|` | `"Code\|Repos"` |
| `description` | Descripción opcional | `Lista de repositorios` |
| `status` | `active` o `legacy` | `active` |

---

## Personalizar Atajos

1. Haz clic derecho en el icono de la extensión
2. Selecciona **"Opciones"**
3. Haz clic en el campo de atajo
4. Presiona tu combinación deseada (ej: `Alt+K`)
5. Se guarda automáticamente

---

## Solución de Problemas

### La extensión no aparece
- Verifica que el "Modo de desarrollador" esté activado
- Recarga la extensión desde `chrome://extensions/`

### No aparecen rutas al abrir la barra
- Verifica que el dominio actual esté en tu CSV
- Abre el Panel de Gestión para ver estadísticas
- Revisa que el dominio coincida exactamente (ej: `example.com` ≠ `www.example.com`)

### Las rutas no se actualizan
- Abre `chrome://extensions/`
- Haz clic en el botón de recarga de la extensión
- Vuelve a intentar

### Error al importar CSV
- Verifica que el archivo tenga extensión `.csv`
- Asegúrate de que todas las líneas tengan 8 columnas
- Las tags deben estar entre comillas: `"Tag1|Tag2"`
- No debe haber comas dentro de los valores (excepto tags entre comillas)

---

## Consejos de Uso

### 🎯 Búsqueda Efectiva
- Escribe solo palabras clave, no frases completas
- Usa el filtro de módulo: `ventas:` o `reportes:`
- El sistema aprende de tus búsquedas frecuentes

### ⌨️ Atajos de Teclado
- `↑` / `↓` - Navegar resultados
- `Enter` - Ir a la ruta
- `Shift+Enter` - Abrir en nueva pestaña
- `Esc` - Cerrar

### 📊 Gestión de Rutas
- Exporta tu configuración periódicamente
- Comparte el CSV con tu equipo
- Marca rutas antiguas como `legacy` en lugar de borrarlas

---

## Siguientes Pasos

1. ✅ Instalar la extensión
2. ✅ Probar con los datos por defecto
3. ✅ Configurar tus propios sitios
4. 📚 Leer el [README.md](README.md) completo
5. 🧪 Revisar [TESTING.md](TESTING.md) para pruebas avanzadas

---

## Soporte

¿Necesitas ayuda?
- 📖 Lee el README completo
- 🐛 Reporta bugs en GitHub Issues
- 💡 Sugiere mejoras en el repositorio

---

**¡Listo para navegar más rápido! 🚀**
