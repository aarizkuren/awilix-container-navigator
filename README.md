# Awilix Container Navigator

Navigate seamlessly between Awilix container registrations and their implementations in VS Code and Cursor.

[![Version](https://img.shields.io/badge/version-1.0.3-blue.svg)](https://marketplace.visualstudio.com/items?itemName=aarizkuren.awilix-container-navigator)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Features

- **🔍 Go to Definition**: Cmd/Ctrl+Click on `container.resolve('moduleName')` to jump directly to the implementation
- **🔙 Find All References**: From any registered module, find all places where it's resolved from the container
- **⚙️ Fully Configurable**: Adapts to any Awilix project structure through customizable patterns
- **🎯 Smart Detection**: Supports `asFunction`, `asClass`, and `asValue` registrations
- **🐛 Debug Mode**: Optional detailed logging for troubleshooting

> Perfect for projects using [Awilix](https://github.com/jeffijoe/awilix) dependency injection with TypeScript or JavaScript

## 🚀 Quick Start

1. Install the extension from the VS Code Marketplace
2. Open a file containing `container.resolve('moduleName')`
3. **Cmd/Ctrl+Click** on the module name to navigate to its implementation

That's it! Works out of the box with standard Awilix patterns.

## 📖 Usage

### Navigate from Usage to Definition

```typescript
// Cmd/Ctrl+Click on 'userService' to jump to the implementation
const userService = container.resolve('userService');
```

### Find All References

Position your cursor in a registered module file and:
- Press **Cmd+Shift+F12** (macOS) or **Shift+F12** (Windows/Linux)
- Or right-click → **"Find All References"**

See everywhere your module is resolved in the codebase.

## ⚙️ Configuration

The extension works with default patterns for common Awilix setups. Customize to match your project:

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/src/core/**/_di/index.ts",
    "**/src/container.ts"
  ],
  "awilixNavigator.containerCallPatterns": [
    "container.resolve",
    "container.cradle"
  ],
  "awilixNavigator.debugMode": false
}
```

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `diFilePatterns` | `string[]` | `["**/src/core/**/_di/index.ts"]` | Glob patterns to find DI registration files |
| `containerCallPatterns` | `string[]` | `["container.resolve", "container.cradle"]` | Patterns to detect container method calls |
| `registrationPatterns` | `object[]` | Standard Awilix patterns | Regex patterns for module registrations |
| `fileIncludePatterns` | `string[]` | `["**/usecases/**", "**/services/**"]` | Patterns for reverse navigation |
| `searchRootPath` | `string` | `"src"` | Root directory to search for container usages |
| `debugMode` | `boolean` | `false` | Enable detailed logging in Output panel |

## 📚 Configuration Examples

<details>
<summary>Domain-Driven Design Structure</summary>

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/infrastructure/di/**/*.ts"
  ],
  "awilixNavigator.fileIncludePatterns": [
    "**/domain/**",
    "**/application/**",
    "**/infrastructure/**"
  ]
}
```
</details>

<details>
<summary>Feature-based Structure (NestJS-like)</summary>

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/features/**/container.ts"
  ],
  "awilixNavigator.containerCallPatterns": [
    "this.container.resolve"
  ]
}
```
</details>

<details>
<summary>Monorepo Setup</summary>

```json
{
  "awilixNavigator.diFilePatterns": [
    "**/packages/*/src/di/*.ts"
  ],
  "awilixNavigator.searchRootPath": "."
}
```
</details>

## 🐛 Troubleshooting

### Navigation not working?

1. **Enable debug mode**:
   - Open Settings (`Cmd/Ctrl+,`)
   - Search for "Awilix Navigator"
   - Enable "Debug Mode"

2. **Check the logs**:
   - Open Output panel: `Cmd/Ctrl+Shift+U`
   - Select "Awilix Navigator" from the dropdown
   - Try navigating again and review detailed logs

### Common Issues

<details>
<summary><strong>Module not found</strong></summary>

- Verify `diFilePatterns` matches your DI file locations
- Ensure the module is imported in your DI configuration file
- Check that registration uses standard Awilix patterns (`asFunction`, `asClass`, etc.)
</details>

<details>
<summary><strong>Container calls not detected</strong></summary>

- Update `containerCallPatterns` to match your usage
- Example: if you use `ctx.container.resolve`, add it to the patterns
</details>

<details>
<summary><strong>Can't find references</strong></summary>

- Adjust `fileIncludePatterns` to include your implementation files
- Verify `searchRootPath` points to the correct directory
</details>

## 🎯 Requirements

- VS Code or Cursor **1.80.0** or higher
- Project using [Awilix](https://github.com/jeffijoe/awilix) for dependency injection
- TypeScript or JavaScript files

## 🔧 How It Works

### Definition Provider
1. Detects clicks on strings inside container method calls
2. Searches configured DI files for module registrations
3. Traces imports to find the actual implementation file
4. Navigates directly to the source

### Reference Provider
1. Identifies when you're in a registered module file
2. Finds the module's registration name in DI configuration
3. Searches your codebase for all `container.resolve()` calls with that name
4. Shows all usage locations

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs or request features via [GitHub Issues](https://github.com/aarizkuren/awilix-container-navigator/issues)
- Submit Pull Requests
- Suggest improvements

## 📝 Release Notes

### 1.0.0
- Initial release
- Go to Definition support for `container.resolve()` and `container.cradle`
- Find All References from implementation to usages
- Configurable patterns for different project structures
- Optional debug mode for troubleshooting
- Support for `asFunction`, `asClass`, and `asValue` registrations

## 📄 License

MIT © 2024

## 🔗 Related

- [Awilix](https://github.com/jeffijoe/awilix) - Powerful dependency injection container for JavaScript
- [VS Code Extension API](https://code.visualstudio.com/api)

---

**Enjoying this extension?** ⭐ [Star the repo](https://github.com/aarizkuren/awilix-container-navigator) and share it with your team!
