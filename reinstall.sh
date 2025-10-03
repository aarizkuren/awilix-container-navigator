#!/bin/bash

echo "🔧 Reinstalando la extensión Awilix Container Navigator..."
echo ""

# Compilar
echo "📦 Paso 1: Compilando..."
npm run compile
if [ $? -ne 0 ]; then
    echo "❌ Error al compilar"
    exit 1
fi
echo "✅ Compilación exitosa"
echo ""

# Verificar que existe el archivo de salida
if [ ! -f "out/extension.js" ]; then
    echo "❌ Error: No se encontró out/extension.js"
    exit 1
fi
echo "✅ Archivo out/extension.js existe"
echo ""

# Empaquetar
echo "📦 Paso 2: Empaquetando extensión..."
npm run package
if [ $? -ne 0 ]; then
    echo "❌ Error al empaquetar"
    exit 1
fi
echo "✅ Empaquetado exitoso"
echo ""

# Encontrar el archivo .vsix
VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)
if [ -z "$VSIX_FILE" ]; then
    echo "❌ Error: No se encontró el archivo .vsix"
    exit 1
fi
echo "✅ Archivo creado: $VSIX_FILE"
echo ""

# Instrucciones finales
echo "🎉 ¡Todo listo!"
echo ""
echo "📋 Pasos finales:"
echo "1. Abre Cursor"
echo "2. Presiona Cmd+Shift+P (Command Palette)"
echo "3. Escribe: 'Extensions: Install from VSIX'"
echo "4. Selecciona el archivo: $PWD/$VSIX_FILE"
echo "5. Recarga la ventana: Cmd+Shift+P > 'Developer: Reload Window'"
echo ""
echo "Deberías ver una notificación: 'Awilix Container Navigator activado'"
echo ""

