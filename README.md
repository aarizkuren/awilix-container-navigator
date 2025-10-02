# Container Resolver Navigator

Extensión para Cursor/VSCode que permite navegar directamente desde `container.resolve('nombre')` a la definición del caso de uso o repositorio.

## 🚀 Características

- **Navegación directa**: Haz Cmd+Click (macOS) o Ctrl+Click (Windows/Linux) sobre el string dentro de `container.resolve('nombre')` para ir a la definición
- **Soporte completo**: Funciona con todos los módulos registrados en tu sistema de inyección de dependencias
- **Búsqueda inteligente**: Busca automáticamente en todos los archivos `_di/index.ts` de tu proyecto

## 📦 Instalación

### Paso 1: Instalar dependencias

```bash
cd /Users/asiera/Proiektuak/barcelo/container-resolver-extension
npm install
```

### Paso 2: Compilar la extensión

```bash
npm run compile
```

### Paso 3: Instalar localmente en Cursor/VSCode

Hay dos formas de instalar:

#### Opción A: Modo desarrollo (recomendado para testing)

1. Abre Cursor/VSCode
2. Ve a `View > Command Palette` (Cmd+Shift+P)
3. Escribe: `Developer: Install Extension from Location`
4. Selecciona la carpeta: `/Users/asiera/Proiektuak/barcelo/container-resolver-extension`

#### Opción B: Empaquetar e instalar

```bash
# Instalar vsce si no lo tienes
npm install -g @vscode/vsce

# Empaquetar la extensión
npm run package

# Esto creará un archivo .vsix
# Luego instálalo desde Cursor:
# Command Palette > Extensions: Install from VSIX
```

## 🎯 Uso

Una vez instalada, simplemente haz **Cmd+Click** (o Ctrl+Click) sobre el nombre dentro de cualquier llamada a `container.resolve()`:

```typescript
// Antes: tenías que extraer la constante para navegar
const getCampaign = container.resolve("getMainCampaign");

// Ahora: navega directamente
container.resolve("getMainCampaign"); // ← Cmd+Click aquí te lleva a la definición
```

### Ejemplos

```typescript
// En un hook
const { data } = useQueryService("hotel-campaign", dependencies, () =>
  container.resolve("getCampaignForCoupon")({
    // ← Cmd+Click aquí
    marketprice,
    language,
    hotelId,
  })
);
```

## 🔧 Desarrollo

### Hacer cambios

1. Edita `src/extension.ts`
2. Compila: `npm run compile`
3. Recarga Cursor/VSCode para probar cambios:
   - Command Palette > `Developer: Reload Window`

### Watch mode

Para desarrollo continuo:

```bash
npm run watch
```

## 📝 Cómo funciona

La extensión:

1. Detecta cuando haces click en un string dentro de `container.resolve()`
2. Extrae el nombre del módulo
3. Busca en todos los archivos `_di/index.ts` del proyecto
4. Encuentra la definición usando el patrón: `nombreModulo: asFunction(funcionImplementacion)`
5. Lee el import de la función de implementación
6. Te lleva directamente al archivo de implementación

## 🐛 Troubleshooting

### La navegación no funciona

- Verifica que la extensión esté activa: `View > Extensions` y busca "Container Resolver Navigator"
- Recarga Cursor: Command Palette > `Developer: Reload Window`
- Verifica que estés en un archivo TypeScript/TSX

### No encuentra la definición

- Asegúrate de que el módulo esté registrado en algún archivo `_di/index.ts`
- Verifica que uses el patrón estándar: `asFunction(nombreFuncion)`

## 📄 Licencia

MIT

