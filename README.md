# Universal Navigator - Chrome Extension

Una extensión de Chrome genérica que proporciona una barra de comandos flotante para acelerar la navegación en cualquier sitio web mediante rutas personalizadas configuradas por CSV.

## 🌟 Características Principales

- ✨ **Navegación Universal**: Funciona en cualquier sitio web con rutas configuradas
- 📊 **Gestión por CSV**: Importa y exporta rutas mediante archivos CSV
- 🎯 **Filtrado por Dominio**: Muestra solo las rutas del sitio web activo
- ⚡ **Búsqueda Inteligente**: Sistema de ranking avanzado con caché
- 🔥 **Métricas de Uso**: Aprende de tus patrones de navegación
- ⌨️ **Atajos Personalizables**: Define tus propias combinaciones de teclas
- 🎨 **Interfaz Moderna**: Diseño oscuro con efectos glassmorphism

## 📦 Instalación

1. Clona este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa el "Modo de desarrollador"
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta del proyecto

## 🚀 Uso Rápido

### Activar la Barra de Comandos

- **Atajo por defecto**: `Ctrl + Shift + K` (Windows/Linux) o `Cmd + Shift + K` (Mac)
- **Desde el icono**: Clic en el icono de la extensión en la barra de herramientas

### Navegación

- `↑` / `↓` - Navegar por los resultados
- `Enter` - Ir a la ruta seleccionada
- `Shift + Enter` - Abrir en nueva pestaña
- `Esc` - Cerrar la barra

### Filtrado por Módulo

Escribe `módulo:` seguido del nombre del módulo para filtrar:
- `ventas:` - Solo resultados del módulo Ventas
- `reportes:` - Solo resultados del módulo Reportes

## 📋 Gestión de Rutas

### Panel de Gestión

Accede al panel haciendo clic en el icono de la extensión. Desde aquí puedes:

1. **Ver estadísticas**: Rutas totales, dominios activos, rutas activas
2. **Descargar plantilla CSV**: Obtén una plantilla de ejemplo
3. **Exportar rutas actuales**: Descarga tus rutas configuradas
4. **Importar CSV**: Sube un archivo CSV con nuevas rutas
5. **Eliminar todas las rutas**: Limpia toda la configuración

### Formato CSV

El archivo CSV debe tener las siguientes columnas:

```csv
domain,id,module,title,url,tags,description,status
pos.idbi.pe,route:orders,Ventas,Órdenes,/orders,"Ventas|Órdenes",Gestión de órdenes,active
example.com,page:home,General,Inicio,/home,"General|Inicio",Página principal,active
```

#### Descripción de Columnas

- **domain**: Dominio del sitio web (ej: `pos.idbi.pe`, `example.com`)
- **id**: Identificador único de la ruta
- **module**: Módulo o categoría principal
- **title**: Título visible de la ruta
- **url**: Ruta URL (absoluta o relativa)
- **tags**: Jerarquía de navegación separada por `|`
- **description**: Descripción opcional
- **status**: `active` o `legacy` (las legacy aparecen al final)

### Ejemplo de CSV con Múltiples Dominios

```csv
domain,id,module,title,url,tags,description,status
github.com,repo:main,Repositorios,Mi Repositorio,/myuser/myrepo,"Repositorios|Principal",Repositorio principal,active
github.com,issues:open,Issues,Issues Abiertas,/myuser/myrepo/issues,"Issues|Abiertas",Lista de issues,active
stackoverflow.com,profile:me,Perfil,Mi Perfil,/users/12345,"Perfil|Personal",Mi perfil en SO,active
pos.idbi.pe,route:orders,Ventas,Órdenes,/orders,"Ventas|Órdenes",Gestión de órdenes,active
```

## ⚙️ Configuración

### Personalizar Atajo de Teclado

1. Haz clic derecho en el icono de la extensión
2. Selecciona "Opciones"
3. Haz clic en el campo de entrada
4. Presiona tu combinación de teclas deseada
5. El atajo se guarda automáticamente

### Configurar Rutas para un Nuevo Sitio

1. Crea un archivo CSV con las rutas del sitio
2. Incluye el dominio correcto en la columna `domain`
3. Abre el panel de gestión
4. Importa tu archivo CSV
5. Navega al sitio web y activa la barra de comandos


## 🔧 Desarrollo

### Ejecutar Tests

```bash
npm test
```

### Estructura de Estado

El sistema mantiene:
- **Rutas estáticas**: Cargadas desde CSV, filtradas por dominio
- **Rutas dinámicas**: Escaneadas del DOM del sitio
- **Métricas de uso**: Frecuencia, recencia, patrones temporales
- **Caché de resultados**: Para búsquedas repetidas

### Sistema de Ranking

El motor de ranking considera:
- Coincidencia textual (título, tags, descripción)
- Frecuencia de uso
- Recencia de acceso
- Patrones temporales (hora del día, día de la semana)
- Fuente de datos (estático vs dinámico)
- Profundidad en la jerarquía

## 🎯 Casos de Uso

### Para Empresas

- Configura rutas para tu sistema web interno
- Distribuye el CSV a tu equipo
- Mejora la productividad con navegación rápida

### Para Desarrolladores

- Navega rápidamente entre repositorios
- Accede a herramientas de desarrollo
- Personaliza para tus sitios frecuentes

### Para Power Users

- Crea atajos para sitios que usas diariamente
- Combina múltiples sitios en un solo sistema
- Exporta y comparte configuraciones

## 📊 Métricas y Analytics

La extensión rastrea localmente:
- Conteo de accesos por ruta
- Última vez que accediste a cada ruta
- Patrones por hora del día
- Patrones por día de la semana

Estos datos mejoran el ranking sin enviar información a servidores externos.

## 🔒 Privacidad

- **Todos los datos se almacenan localmente** en `chrome.storage.local`
- **No se envía información a servidores externos**
- **El escaneo del DOM es opcional** y solo lee elementos visibles
- **Los archivos CSV permanecen en tu máquina**

## 🤝 Contribuir

Las contribuciones son bienvenidas:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Changelog

### v0.2.0 - Sistema Universal con CSV

- ✨ Soporte para múltiples dominios
- 📊 Gestión por archivos CSV
- 🎯 Filtrado automático por dominio activo
- 🖥️ Panel de gestión visual
- 📤 Importación/exportación de rutas
- 🔄 Retrocompatibilidad con datos legacy

### v0.1.0 - Versión Inicial

- 🎯 Navegación específica para pos.idbi.pe
- ⚡ Sistema de ranking inteligente
- 📊 Métricas de uso
- ⌨️ Atajos personalizables

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🙋 Soporte

Si encuentras problemas o tienes sugerencias:
- Abre un issue en GitHub
- Describe el problema detalladamente
- Incluye pasos para reproducir

## 🎓 Aprendizaje

Este proyecto demuestra:
- Desarrollo de Chrome Extensions (Manifest V3)
- Gestión de estado en JavaScript
- Algoritmos de ranking y búsqueda
- Shadow DOM para aislamiento de estilos
- Parseo de CSV en el navegador
- Chrome Storage API
- Content Scripts y Service Workers

---

Hecho con ❤️ para mejorar la productividad web
