# Container Resolver Navigator

Extensión para Cursor/VSCode que permite navegar directamente desde `container.resolve('nombre')` a la definición del caso de uso o repositorio.

## 🚀 Características

### Navegación bidireccional completa:

1. **Desde uso → definición**: Haz Cmd+Click (macOS) o Ctrl+Click (Windows/Linux) sobre el string dentro de `container.resolve('nombre')` para ir directamente al caso de uso
2. **Desde definición → usos**: Estando en un archivo de caso de uso, presiona Cmd+Shift+F12 (macOS) o Shift+F12 (Windows/Linux) o click derecho → "Find All References" para ver todos los lugares donde se usa a través del container
3. **Soporte completo**: Funciona con todos los módulos registrados en tu sistema de inyección de dependencias
4. **Búsqueda inteligente**: Busca automáticamente en todos los archivos `_di/index.ts` de tu proyecto

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

### 1️⃣ Navegar desde el uso a la definición

Haz **Cmd+Click** (o Ctrl+Click) sobre el nombre dentro de cualquier llamada a `container.resolve()`:

```typescript
// Antes: tenías que extraer la constante para navegar
const getCampaign = container.resolve("getMainCampaign");

// Ahora: navega directamente
container.resolve("getMainCampaign"); // ← Cmd+Click aquí te lleva a src/core/Hotel/usecases/getCampaign.ts
```

**Ejemplo en un hook:**

```typescript
const { data } = useQueryService("hotel-campaign", dependencies, () =>
  container.resolve("getCampaignForCoupon")({
    // ← Cmd+Click aquí para ir al caso de uso
    marketprice,
    language,
    hotelId,
  })
);
```

### 2️⃣ Navegar desde la definición a los usos

Estando en un archivo de caso de uso (por ejemplo: `src/core/Hotel/usecases/getCampaign.ts`):

**Opción A:** Presiona **Cmd+Shift+F12** (macOS) o **Shift+F12** (Windows/Linux)

**Opción B:** Click derecho sobre el nombre de la función → **"Find All References"**

**Opción C:** Click derecho → **"Go to References"**

La extensión te mostrará todos los lugares donde se usa este caso de uso a través de `container.resolve()`:

```
Referencias encontradas:
  📄 src/ui/hooks/queries/useCampaign.ts (línea 50)
      container.resolve("getMainCampaign")

  📄 src/ui/pages/hotel/HotelDetail.tsx (línea 23)
      container.resolve("getMainCampaign")
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

### Navegación desde uso → definición (Definition Provider)

1. Detecta cuando haces click en un string dentro de `container.resolve()`
2. Extrae el nombre del módulo
3. Busca en todos los archivos `_di/index.ts` del proyecto
4. Encuentra la definición usando el patrón: `nombreModulo: asFunction(funcionImplementacion)`
5. Lee el import de la función de implementación
6. Te lleva directamente al archivo de implementación

### Navegación desde definición → usos (Reference Provider)

1. Detecta cuando estás en un archivo de caso de uso o repositorio (`/usecases/` o `/infrastructure/`)
2. Busca en los archivos `_di/index.ts` para encontrar cómo está registrado ese archivo
3. Extrae el nombre del módulo en el container
4. Busca recursivamente en todo el directorio `src/` todos los archivos TypeScript/JavaScript
5. Encuentra todas las ocurrencias de `container.resolve('nombreDelModulo')`
6. Te muestra una lista completa de todas las referencias

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
