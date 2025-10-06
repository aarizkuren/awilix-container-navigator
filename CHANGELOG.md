# Change Log

All notable changes to the "Awilix Container Navigator" extension will be documented in this file.

## [1.0.2] - 2025-10-06

### Changed
- Improved builds

## [1.0.1] - 2025-10-06

### Fixed
- **Bundling issue**: Configured webpack to properly bundle all dependencies (glob)
- Resolved "Cannot find module 'glob'" error when installing extension from marketplace
- Optimized package size from 311 KB to 42 KB

### Changed
- Migrated from pure TypeScript compilation to webpack bundling
- Updated build process to include all dependencies in the bundle
- Improved `.vscodeignore` file to exclude unnecessary files

## [1.0.0] - 2025-10-03

### Initial Release

#### Added
- **Go to Definition** support for `container.resolve()` calls
- **Go to Definition** support for `container.cradle` property access
- **Find All References** from implementation files back to container usages
- Configurable patterns for DI file locations (`diFilePatterns`)
- Configurable patterns for container method calls (`containerCallPatterns`)
- Configurable registration patterns supporting `asFunction`, `asClass`, and `asValue`
- Configurable file patterns for reverse navigation (`fileIncludePatterns`)
- Optional debug mode with detailed logging in Output panel
- Support for multiple Awilix project structures (DDD, feature-based, monorepo)
- Real-time configuration updates (no reload required)

#### Features
- Smart import resolution supporting:
  - Relative paths (`../`, `./`)
  - Absolute paths from workspace root
  - `src/` prefixed paths
  - TypeScript path aliases
- Automatic file extension detection (`.ts`, `.tsx`, `.js`, `.jsx`)
- Recursive directory search for container usages
- Multi-file DI configuration support

#### Supported Patterns
- Standard Awilix registrations: `moduleName: asFunction(implementation)`
- Nested object registrations: `{ moduleName: asFunction(implementation) }`
- Multiple registration types: `asFunction`, `asClass`, `asValue`