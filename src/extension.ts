import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { globSync } from "glob";

// Canal de salida para logs
let outputChannel: vscode.OutputChannel;

const log = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  outputChannel.appendLine(logMessage);
  console.log(`[Awilix Navigator] ${message}`);
};

interface ContainerModule {
  name: string;
  filePath: string;
}

interface RegistrationPattern {
  pattern: string;
  type: string;
}

interface ExtensionConfig {
  diFilePatterns: string[];
  containerCallPatterns: string[];
  registrationPatterns: RegistrationPattern[];
  fileIncludePatterns: string[];
  searchRootPath: string;
}

const getConfig = (): ExtensionConfig => {
  const config = vscode.workspace.getConfiguration("awilixNavigator");

  return {
    diFilePatterns:
      config.get<string[]>("diFilePatterns") || [
        "**/src/core/**/_di/index.ts",
        "**/src/core/**/_di/registerModules.ts",
      ],
    containerCallPatterns:
      config.get<string[]>("containerCallPatterns") || [
        "container.resolve",
        "container.cradle",
      ],
    registrationPatterns:
      config.get<RegistrationPattern[]>("registrationPatterns") || [
        { pattern: "{name}:\\s*asFunction\\(({ref})\\)", type: "asFunction" },
        { pattern: "{name}:\\s*asClass\\(({ref})\\)", type: "asClass" },
        { pattern: "{name}:\\s*asValue\\(({ref})\\)", type: "asValue" },
      ],
    fileIncludePatterns:
      config.get<string[]>("fileIncludePatterns") || [
        "**/usecases/**",
        "**/infrastructure/**",
        "**/services/**",
        "**/repositories/**",
      ],
    searchRootPath: config.get<string>("searchRootPath") || "src",
  };
};

export const activate = (context: vscode.ExtensionContext) => {
  // Crear canal de salida para logs
  outputChannel = vscode.window.createOutputChannel("Awilix Navigator");
  context.subscriptions.push(outputChannel);

  log("✅ Extension activated!");

  // Mostrar el panel de output automáticamente
  outputChannel.show(true); // true = preserveFocus (no quitar el foco del editor)

  // Provider para navegar desde container.resolve() a la definición
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    {
      provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        log("🔍 provideDefinition called");

        const config = getConfig();
        const wordRange = document.getWordRangeAtPosition(
          position,
          /['"`][\w]+['"`]/
        );

        if (!wordRange) {
          log("❌ No word range found at position");
          return null;
        }

        const line = document.lineAt(position.line).text;
        log(`📄 Line content: ${line}`);

        // Verificar si estamos en una llamada al container usando patrones configurables
        const isContainerCall = config.containerCallPatterns.some((pattern) =>
          line.includes(pattern)
        );

        if (!isContainerCall) {
          return null;
        }

        // Extraer el nombre del módulo del string
        const word = document.getText(wordRange);
        const moduleName = word.replace(/['"`]/g, "");

        // Buscar la definición del módulo
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          return null;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Buscar en los archivos de DI usando patrones configurables
        const modules = findModuleDefinition(workspaceRoot, moduleName, config);

        if (modules.length > 0) {
          // Si encontramos múltiples definiciones, mostrar todas
          return modules.map((module) => {
            return new vscode.Location(
              vscode.Uri.file(module.filePath),
              new vscode.Position(0, 0)
            );
          });
        }

        return null;
      },
    }
  );

  // Provider para encontrar referencias desde el caso de uso hacia container.resolve()
  const referenceProvider = vscode.languages.registerReferenceProvider(
    ["typescript", "typescriptreact", "javascript", "javascriptreact"],
    {
      provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Location[]> {
        const config = getConfig();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          return null;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const currentFilePath = document.uri.fsPath;

        // Verificar si estamos en un archivo que puede estar registrado en el container
        const isIncludedFile = config.fileIncludePatterns.some((pattern) => {
          const fullPattern = pattern.startsWith("**/")
            ? pattern
            : `**/${pattern}`;
          return minimatch(currentFilePath, fullPattern);
        });

        if (!isIncludedFile) {
          return null;
        }

        // Encontrar el nombre con el que está registrado en el container
        const containerNames = findContainerNameForFile(
          workspaceRoot,
          currentFilePath,
          config
        );

        if (containerNames.length === 0) {
          return null;
        }

        // Buscar todas las referencias a container.resolve/cradle con estos nombres
        const references: vscode.Location[] = [];

        for (const containerName of containerNames) {
          const refs = findReferencesToContainerResolve(
            workspaceRoot,
            containerName,
            config
          );
          references.push(...refs);
        }

        return references.length > 0 ? references : null;
      },
    }
  );

  context.subscriptions.push(definitionProvider, referenceProvider);
};

// Función simplificada de minimatch (solo para patrones básicos)
const minimatch = (filePath: string, pattern: string): boolean => {
  const normalizedPath = path.normalize(filePath).replace(/\\/g, "/");
  const normalizedPattern = pattern.replace(/\\/g, "/");

  // Convertir patrón glob a regex
  const regexPattern = normalizedPattern
    .replace(/\*\*/g, "§§§") // placeholder temporal
    .replace(/\*/g, "[^/]*") // * = cualquier cosa excepto /
    .replace(/§§§/g, ".*") // ** = cualquier cosa incluyendo /
    .replace(/\?/g, "."); // ? = un carácter

  const regex = new RegExp(regexPattern);
  return regex.test(normalizedPath);
};

// Función auxiliar para buscar archivos DI
const findDIFiles = (
  workspaceRoot: string,
  config: ExtensionConfig
): string[] => {
  let diFiles: string[] = [];

  for (const pattern of config.diFilePatterns) {
    try {
      const files = globSync(pattern, {
        cwd: workspaceRoot,
        absolute: true,
        nodir: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/build/**"]
      });

      log(`Pattern: ${pattern}, Found files: ${files.length}`);
      if (files.length > 0) {
        log(`Files found: ${files.join(', ')}`);
      }

      diFiles.push(...files);
    } catch (error) {
      log(`❌ Error searching for pattern ${pattern}: ${error}`);
    }
  }

  // Eliminar duplicados
  return Array.from(new Set(diFiles));
};

const findModuleDefinition = (
  workspaceRoot: string,
  moduleName: string,
  config: ExtensionConfig
): ContainerModule[] => {
  const results: ContainerModule[] = [];

  log(`Finding definition for module: ${moduleName}`);

  // Buscar archivos DI usando los patrones configurables
  const diFiles = findDIFiles(workspaceRoot, config);

  // Buscar en cada archivo DI
  for (const diFilePath of diFiles) {
    if (!fs.existsSync(diFilePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(diFilePath, "utf-8");

      // Probar cada patrón de registro configurado
      for (const regPattern of config.registrationPatterns) {
        // Reemplazar {name} con el nombre del módulo y ({ref}) con un grupo de captura
        const patternWithName = regPattern.pattern
          .replace("{name}", escapeRegExp(moduleName))
          .replace("({ref})", "([^)]+)"); // Capturar cualquier cosa excepto )

        log(`Trying pattern: ${patternWithName} in ${path.basename(diFilePath)}`);
        const regex = new RegExp(patternWithName, "gm"); // Agregado 'm' para multiline
        let match;

        // Buscar todas las coincidencias (puede haber múltiples)
        while ((match = regex.exec(content)) !== null) {
          if (match[1]) {
            const reference = match[1].trim();
            log(`Found match in ${path.basename(diFilePath)}: ${moduleName} -> ${reference}`);

            // Buscar el import de esta referencia
            const importedFilePath = findImportedFile(
              content,
              reference,
              diFilePath,
              workspaceRoot
            );

            if (importedFilePath && fs.existsSync(importedFilePath)) {
              log(`✅ Resolved to: ${importedFilePath}`);
              results.push({
                name: moduleName,
                filePath: importedFilePath,
              });
              break; // Salir después de encontrar el primero
            } else {
              log(`❌ Could not resolve import for: ${reference}`);
            }
          }
        }
      }
    } catch (error) {
      log(`❌ Error reading DI file ${diFilePath}: ${error}`);
    }
  }

  return results;
};

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const findImportedFile = (
  content: string,
  reference: string,
  diFilePath: string,
  workspaceRoot: string
): string | null => {
  // Buscar el import de esta referencia
  const importPattern = new RegExp(
    `import\\s*{[^}]*\\b${escapeRegExp(reference)}\\b[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
    "g"
  );
  const importMatch = importPattern.exec(content);

  if (importMatch && importMatch[1]) {
    let importPath = importMatch[1];
    log(`Found import: ${reference} from "${importPath}"`);

    // Convertir path relativo a absoluto
    if (importPath.startsWith("../") || importPath.startsWith("./")) {
      const diDir = path.dirname(diFilePath);
      importPath = path.resolve(diDir, importPath);
      log(`Resolved relative path to: ${importPath}`);
    } else if (importPath.startsWith("src/") || importPath.startsWith("src\\")) {
      // Path desde src/ (común en proyectos con tsconfig paths)
      importPath = path.join(workspaceRoot, importPath);
      log(`Resolved src/ path to: ${importPath}`);
    } else if (!path.isAbsolute(importPath)) {
      // Si no es absoluto y no empieza con ./ o ../, asumir que es desde workspace
      importPath = path.join(workspaceRoot, importPath);
      log(`Resolved workspace relative path to: ${importPath}`);
    } else {
      log(`Using absolute path: ${importPath}`);
    }

    // Añadir extensiones posibles si no existe
    if (!fs.existsSync(importPath)) {
      log(`Path doesn't exist, trying extensions...`);
      for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
        const pathWithExt = importPath + ext;
        if (fs.existsSync(pathWithExt)) {
          log(`Found with extension: ${pathWithExt}`);
          return pathWithExt;
        }
      }
      // Probar con index
      const indexPath = path.join(importPath, "index.ts");
      if (fs.existsSync(indexPath)) {
        log(`Found index: ${indexPath}`);
        return indexPath;
      }
      log(`Could not find file for import: ${importMatch[1]}`);
    } else {
      log(`Path exists: ${importPath}`);
      return importPath;
    }
  } else {
    log(`No import found for reference: ${reference}`);
  }

  return null;
};

const findContainerNameForFile = (
  workspaceRoot: string,
  filePath: string,
  config: ExtensionConfig
): string[] => {
  const containerNames: string[] = [];
  const normalizedFilePath = path.normalize(filePath);

  // Buscar archivos DI usando los patrones configurables
  const diFiles = findDIFiles(workspaceRoot, config);

  // Buscar en cada archivo DI
  for (const diFile of diFiles) {
    if (!fs.existsSync(diFile)) {
      continue;
    }

    try {
      const content = fs.readFileSync(diFile, "utf-8");

      // Buscar imports que coincidan con este archivo
      const importPattern = new RegExp(
        `import\\s*{[^}]*\\b(\\w+)\\b[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
        "g"
      );

      let importMatch;
      const importedFunctions: string[] = [];

      while ((importMatch = importPattern.exec(content)) !== null) {
        const functionName = importMatch[1];
        let importPath = importMatch[2];

        // Convertir path relativo a absoluto
        if (importPath.startsWith("../") || importPath.startsWith("./")) {
          const diDir = path.dirname(diFile);
          importPath = path.resolve(diDir, importPath);
        } else if (importPath.startsWith("src/")) {
          importPath = path.join(workspaceRoot, importPath);
        } else {
          importPath = path.join(workspaceRoot, importPath);
        }

        // Probar con diferentes extensiones
        let resolvedPath = importPath;
        if (!fs.existsSync(importPath)) {
          let found = false;
          for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
            const pathWithExt = importPath + ext;
            if (fs.existsSync(pathWithExt)) {
              resolvedPath = pathWithExt;
              found = true;
              break;
            }
          }
          if (!found) {
            const indexPath = path.join(importPath, "index.ts");
            if (fs.existsSync(indexPath)) {
              resolvedPath = indexPath;
            }
          }
        }

        resolvedPath = path.normalize(resolvedPath);

        // Si el import coincide con nuestro archivo, guardar el nombre de la función
        if (resolvedPath === normalizedFilePath) {
          importedFunctions.push(functionName);
        }
      }

      // Ahora buscar las definiciones en el módulo que usan estas funciones
      for (const funcName of importedFunctions) {
        // Probar todos los patrones de registro
        for (const regPattern of config.registrationPatterns) {
          // Crear patrón que capture el nombre del módulo
          const patternForSearch = regPattern.pattern
            .replace("{name}", "(\\w+)")
            .replace("({ref})", escapeRegExp(funcName));
          const regex = new RegExp(patternForSearch, "g");
          let moduleMatch;

          while ((moduleMatch = regex.exec(content)) !== null) {
            const containerName = moduleMatch[1];
            if (!containerNames.includes(containerName)) {
              containerNames.push(containerName);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading DI file ${diFile}:`, error);
    }
  }

  return containerNames;
};

const findReferencesToContainerResolve = (
  workspaceRoot: string,
  containerName: string,
  config: ExtensionConfig
): vscode.Location[] => {
  const locations: vscode.Location[] = [];
  const searchDir = path.join(workspaceRoot, config.searchRootPath);

  if (!fs.existsSync(searchDir)) {
    return locations;
  }

  // Función recursiva para buscar en todos los archivos
  const searchInDirectory = (dir: string) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Ignorar node_modules y otras carpetas
        if (
          entry.name !== "node_modules" &&
          entry.name !== ".git" &&
          entry.name !== "dist" &&
          entry.name !== "out" &&
          entry.name !== "build"
        ) {
          searchInDirectory(fullPath);
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".jsx"))
      ) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");

          // Crear patrones de búsqueda para cada patrón de llamada configurado
          for (const callPattern of config.containerCallPatterns) {
            // Escapar puntos en el patrón
            const escapedPattern = callPattern.replace(/\./g, "\\.");
            const pattern = new RegExp(
              `${escapedPattern}\\s*\\(\\s*['"\`]${escapeRegExp(
                containerName
              )}['"\`]\\s*\\)`,
              "g"
            );

            lines.forEach((line, lineIndex) => {
              let match;
              while ((match = pattern.exec(line)) !== null) {
                const startPos = match.index;
                locations.push(
                  new vscode.Location(
                    vscode.Uri.file(fullPath),
                    new vscode.Range(
                      new vscode.Position(lineIndex, startPos),
                      new vscode.Position(lineIndex, startPos + match[0].length)
                    )
                  )
                );
              }
              // Reset regex
              pattern.lastIndex = 0;
            });
          }
        } catch (error) {
          // Ignorar errores de lectura de archivos
        }
      }
    }
  };

  searchInDirectory(searchDir);

  return locations;
};

export const deactivate = () => { };
