# Awilix Container Navigator

Extensión para Cursor/VSCode que permite navegar directamente desde llamadas al container de Awilix (`container.resolve('nombre')`, `container.cradle.nombre`, etc.) a la definición del módulo registrado, y viceversa.

**✨ Totalmente configurable** - Funciona con cualquier proyecto que use Awilix, independientemente de tu estructura de carpetas o convenciones de nombres.

## 🚀 Características

### Navegación bidireccional completa:

1. **Desde uso → definición**: Haz Cmd+Click (macOS) o Ctrl+Click (Windows/Linux) sobre el string dentro de `container.resolve('nombre')` para ir directamente a la implementación
2. **Desde definición → usos**: Estando en un archivo registrado en el container, presiona Cmd+Shift+F12 (macOS) o Shift+F12 (Windows/Linux) o click derecho → "Find All References" para ver todos los lugares donde se usa
3. **Soporte completo para Awilix**: Funciona con `asFunction`, `asClass`, y `asValue`
4. **Búsqueda inteligente**: Busca automáticamente en los archivos de DI configurados
5. **Totalmente configurable**: Adapta la extensión a tu estructura de proyecto

## 📦 Instalación

### Instalación rápida (recomendado)

```bash
cd /Users/asiera/Proiektuak/barcelo/container-resolver-extension
./reinstall.sh
```

Luego sigue las instrucciones en pantalla para instalar el archivo `.vsix` generado.

### Instalación manual

#### Paso 1: Instalar dependencias

```bash
cd /ruta/a/container-resolver-extension
npm install
```

#### Paso 2: Compilar la extensión

```bash
npm run compile
```

#### Paso 3: Instalar en Cursor/VSCode

**Opción A: Desde VSIX (recomendado)**

```bash
# Empaquetar la extensión
npm run package

# Luego en Cursor:
# 1. Cmd+Shift+P > Extensions: Install from VSIX
# 2. Selecciona el archivo .vsix creado
# 3. Cmd+Shift+P > Developer: Reload Window
```

**Opción B: Modo desarrollo**

1. Abre Cursor/VSCode
2. `Cmd+Shift+P` > `Developer: Install Extension from Location`
3. Selecciona esta carpeta
4. `Cmd+Shift+P` > `Developer: Reload Window`

### ✅ Verificar la instalación

Después de instalar y recargar, deberías ver:
- ✅ Una notificación: **"Awilix Container Navigator activado"**
- ✅ El panel **"Output"** se abrirá automáticamente mostrando logs
- ✅ La extensión en la lista de Extensions (`Cmd+Shift+X`)

Para ver los logs en cualquier momento:
- `Cmd+Shift+U` (macOS) / `Ctrl+Shift+U` (Windows/Linux)
- Selecciona "Awilix Navigator" en el dropdown

**⚠️ Si no ves la notificación**, consulta [INSTALL_CHECK.md](./INSTALL_CHECK.md) para troubleshooting detallado.

## ⚙️ Configuración

La extensión es totalmente configurable para adaptarse a cualquier proyecto que use Awilix. Ve a **Settings** (Cmd+,) y busca "Awilix Navigator" o edita tu `settings.json`:

### `awilixNavigator.diFilePatterns`

**Tipo:** `string[]`  
**Por defecto:**
```json
[
  "**/src/core/**/_di/index.ts",
  "**/src/core/**/_di/registerModules.ts"
]
```

Patrones glob para encontrar los archivos donde se registran los módulos en el container de Awilix.

**Ejemplos:**
```json
// Estructura flat
["**/container.ts", "**/di.ts"]

// Estructura por features
["**/features/**/container.ts"]

// Múltiples ubicaciones
["**/src/di/**/*.ts", "**/app/config/container.ts"]
```

### `awilixNavigator.containerCallPatterns`

**Tipo:** `string[]`  
**Por defecto:**
```json
["container.resolve", "container.cradle"]
```

Patrones para detectar llamadas al container en tu código.

**Ejemplos:**
```json
// Si usas un nombre diferente
["ctx.container.resolve", "app.container.resolve"]

// Si usas propiedades directas
["container.cradle", "ctx.cradle"]

// Múltiples patrones
["container.resolve", "ioc.get", "di.resolve"]
```

### `awilixNavigator.registrationPatterns`

**Tipo:** `Array<{pattern: string, type: string}>`  
**Por defecto:**
```json
[
  {
    "pattern": "{name}:\\s*asFunction\\(({ref})\\)",
    "type": "asFunction"
  },
  {
    "pattern": "{name}:\\s*asClass\\(({ref})\\)",
    "type": "asClass"
  },
  {
    "pattern": "{name}:\\s*asValue\\(({ref})\\)",
    "type": "asValue"
  }
]
```

Patrones regex para detectar cómo se registran los módulos. Use `{name}` como placeholder para el nombre del módulo y `({ref})` para capturar la referencia a la implementación.

**Ejemplos:**
```json
// Si usas sintaxis de función
[
  {
    "pattern": "register\\('{name}',\\s*({ref})\\)",
    "type": "function"
  }
]

// Si usas arrays
[
  {
    "pattern": "\\['{name}',\\s*({ref})\\]",
    "type": "array"
  }
]
```

### `awilixNavigator.fileIncludePatterns`

**Tipo:** `string[]`  
**Por defecto:**
```json
[
  "**/usecases/**",
  "**/infrastructure/**",
  "**/services/**",
  "**/repositories/**"
]
```

Patrones para incluir archivos que pueden estar registrados en el container (para navegación inversa: desde la definición a los usos).

**Ejemplos:**
```json
// Incluir todo
["**/*.ts", "**/*.js"]

// Estructura específica
["**/src/domain/**", "**/src/application/**"]

// Excluir tests
["**/src/**/*.ts", "!**/*.test.ts", "!**/*.spec.ts"]
```

### `awilixNavigator.searchRootPath`

**Tipo:** `string`  
**Por defecto:** `"src"`

Directorio raíz donde buscar usos del container (relativo a la raíz del workspace).

**Ejemplos:**
```json
// Si tu código está en app/
"app"

// Si está en la raíz
"."

// Si está en lib/
"lib"
```

## 📚 Ejemplos de configuración para diferentes estructuras

### Estructura clásica de DDD

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/src/infrastructure/di/**/*.ts"
  ],
  "awilixNavigator.fileIncludePatterns": [
    "**/domain/**",
    "**/application/**",
    "**/infrastructure/**"
  ],
  "awilixNavigator.searchRootPath": "src"
}
```

### Estructura por features (NestJS-like)

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/features/**/container.ts",
    "**/app.container.ts"
  ],
  "awilixNavigator.fileIncludePatterns": [
    "**/features/**/*.service.ts",
    "**/features/**/*.repository.ts"
  ],
  "awilixNavigator.containerCallPatterns": [
    "this.container.resolve",
    "container.cradle"
  ]
}
```

### Estructura flat/simple

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/container.ts",
    "**/di.ts"
  ],
  "awilixNavigator.fileIncludePatterns": [
    "**/*.service.ts",
    "**/*.repository.ts",
    "**/services/**",
    "**/repos/**"
  ],
  "awilixNavigator.searchRootPath": "src"
}
```

### Proyecto monorepo

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/packages/*/src/di/*.ts"
  ],
  "awilixNavigator.fileIncludePatterns": [
    "**/packages/*/src/**"
  ],
  "awilixNavigator.searchRootPath": "."
}
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

1. Detecta cuando haces click en un string dentro de una llamada al container (usando `containerCallPatterns`)
2. Extrae el nombre del módulo
3. Busca en los archivos especificados en `diFilePatterns`
4. Encuentra la definición usando los patrones en `registrationPatterns`
5. Lee el import de la implementación
6. Te lleva directamente al archivo de implementación

### Navegación desde definición → usos (Reference Provider)

1. Detecta cuando estás en un archivo que coincide con `fileIncludePatterns`
2. Busca en los archivos especificados en `diFilePatterns` para encontrar cómo está registrado
3. Extrae el nombre del módulo en el container
4. Busca recursivamente en `searchRootPath` todos los archivos TypeScript/JavaScript
5. Encuentra todas las ocurrencias de llamadas al container con ese nombre
6. Te muestra una lista completa de todas las referencias

## 🐛 Troubleshooting

### La navegación no funciona

- **Verifica la configuración**: Asegúrate de que los patrones coincidan con tu estructura de proyecto
- **Recarga Cursor**: Command Palette > `Developer: Reload Window`
- **Verifica la extensión**: `View > Extensions` y busca "Awilix Container Navigator"

### No encuentra la definición

- **Revisa `diFilePatterns`**: Asegúrate de que los patrones coincidan con tus archivos de DI
- **Revisa `registrationPatterns`**: Verifica que el patrón coincida con cómo registras módulos
- **Revisa los imports**: La extensión necesita que la implementación esté importada en el archivo de DI

### No encuentra referencias

- **Revisa `fileIncludePatterns`**: Asegúrate de incluir los archivos donde se define el módulo
- **Revisa `containerCallPatterns`**: Verifica que coincida con cómo llamas al container
- **Revisa `searchRootPath`**: Asegúrate de que apunta al directorio correcto

## 📄 Licencia

MIT

---

**¿Preguntas o problemas?** Abre un issue en el repositorio.

**¿Mejoras?** Pull requests bienvenidos!
