#!/bin/bash

# Script para empaquetar la extensión para Chrome Web Store
# Uso: ./build-release.sh

set -e

echo "🚀 Empaquetando Universal Navigator para Chrome Web Store..."

# Directorio de salida
OUTPUT_DIR="./dist"
ZIP_NAME="universal-navigator-v0.5.0.zip"

# Limpiar directorio de salida si existe
if [ -d "$OUTPUT_DIR" ]; then
    echo "🧹 Limpiando directorio de salida..."
    rm -rf "$OUTPUT_DIR"
fi

# Crear directorio de salida
mkdir -p "$OUTPUT_DIR"

echo "📦 Creando archivo ZIP..."

# Crear ZIP con solo los archivos necesarios
zip -r "$OUTPUT_DIR/$ZIP_NAME" \
    manifest.json \
    pages/ \
    scripts/ \
    icons/ \
    data/routes-example-social.csv \
    -x "*.DS_Store" \
    -x "*~" \
    -x "*.swp" \
    -x "*.bak" \
    -x "*-old.*" \
    -x "*.test.js" \
    -x "docs/*" \
    -x "data/routes.csv" \
    -x "*.git*" \
    -x ".git/*" \
    > /dev/null

# Verificar que el ZIP se creó correctamente
if [ -f "$OUTPUT_DIR/$ZIP_NAME" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_DIR/$ZIP_NAME" | cut -f1)
    echo "✅ Paquete creado exitosamente: $OUTPUT_DIR/$ZIP_NAME ($FILE_SIZE)"
    
    echo ""
    echo "📋 Contenido del paquete:"
    unzip -l "$OUTPUT_DIR/$ZIP_NAME" | grep -v "Archive:" | head -20
    
    echo ""
    echo "🎉 ¡Listo para publicar en Chrome Web Store!"
    echo "📍 Archivo: $OUTPUT_DIR/$ZIP_NAME"
else
    echo "❌ Error al crear el paquete"
    exit 1
fi
