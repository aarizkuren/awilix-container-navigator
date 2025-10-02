#!/bin/bash

echo "🚀 Instalando Container Resolver Navigator Extension..."
echo ""

# Verificar si existe node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

echo "🔨 Compilando extensión..."
npm run compile

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Compilación exitosa!"
    echo ""
    echo "📝 Ahora sigue estos pasos en Cursor/VSCode:"
    echo ""
    echo "1. Abre Command Palette (Cmd+Shift+P)"
    echo "2. Escribe: 'Developer: Install Extension from Location'"
    echo "3. Selecciona la carpeta: $(pwd)"
    echo ""
    echo "Después, recarga la ventana:"
    echo "Command Palette > 'Developer: Reload Window'"
    echo ""
    echo "🎉 ¡Listo! Ahora podrás hacer Cmd+Click en container.resolve('nombre')"
else
    echo ""
    echo "❌ Error en la compilación"
    exit 1
fi


