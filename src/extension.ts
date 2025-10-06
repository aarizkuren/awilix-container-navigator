import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { globSync } from "glob";

// Canal de salida para logs
let outputChannel: vscode.OutputChannel;
let isDebugMode = false;

const log = (message: string) => {
  if (!isDebugMode) return;

  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  outputChannel.appendLine(logMessage);
  console.log(`[Awilix Navigator] ${message}`);
};

interface ContainerModule {
  name: string;
  filePath: string;
  line?: number;
  column?: number;
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
  debugMode: boolean;
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
    debugMode: config.get<boolean>("debugMode") || false,
  };
};

export const activate = (context: vscode.ExtensionContext) => {
  // Crear canal de salida para logs
  outputChannel = vscode.window.createOutputChannel("Awilix Navigator");
  context.subscriptions.push(outputChannel);

  // Obtener configuración inicial
  const config = getConfig();
  isDebugMode = config.debugMode;

  log("✅ Extension activated!");

  // Mostrar el panel de output automáticamente solo en modo debug
  if (isDebugMode) {
    outputChannel.show(true); // true = preserveFocus (no quitar el foco del editor)
    vscode.window.showInformationMessage("Awilix Navigator: Modo debug activado");
  }

  // Listener para cambios en la configuración
  const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("awilixNavigator.debugMode")) {
      const newConfig = getConfig();
      const wasDebugMode = isDebugMode;
      isDebugMode = newConfig.debugMode;

      if (isDebugMode && !wasDebugMode) {
        outputChannel.show(true);
        vscode.window.showInformationMessage("Awilix Navigator: Modo debug activado");
        log("✅ Debug mode enabled");
      } else if (!isDebugMode && wasDebugMode) {
        vscode.window.showInformationMessage("Awilix Navigator: Modo debug desactivado");
      }
    }
  });

  context.subscriptions.push(configChangeListener);

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
        // Primero verificar la línea actual
        let isContainerCall = config.containerCallPatterns.some((pattern) =>
          line.includes(pattern)
        );

        // Si no se encuentra en la línea actual, buscar en líneas anteriores
        // para detectar casos multilínea como:
        // container
        //   .resolve('moduleName')
        if (!isContainerCall) {
          const maxLookBack = 5; // Máximo de líneas hacia atrás a revisar
          const startLine = Math.max(0, position.line - maxLookBack);

          // Construir el texto multilínea desde startLine hasta la línea actual
          let multilineText = "";
          for (let i = startLine; i <= position.line; i++) {
            multilineText += document.lineAt(i).text + " ";
          }

          log(`📄 Multiline content: ${multilineText.trim()}`);

          // Verificar si el texto multilínea contiene algún patrón
          // Convertir el patrón en regex para permitir espacios/saltos de línea
          isContainerCall = config.containerCallPatterns.some((pattern) => {
            // Escapar caracteres especiales y permitir espacios entre partes
            const escapedPattern = pattern
              .split('.')
              .map(part => escapeRegExp(part))
              .join('\\s*\\.\\s*'); // Permitir espacios alrededor del punto

            const regex = new RegExp(escapedPattern);
            const matches = regex.test(multilineText);

            if (matches) {
              log(`✅ Pattern matched: ${pattern} -> ${escapedPattern}`);
            }

            return matches;
          });
        }

        if (!isContainerCall) {
          log("❌ Not a container call");
          return null;
        }

        log("✅ Container call detected!");

        // Extraer el nombre del módulo del string
        const word = document.getText(wordRange);
        const moduleName = word.replace(/['"`]/g, "");
        log(`📦 Module name extracted: ${moduleName}`);

        // Buscar la definición del módulo
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          log("❌ No workspace folders found");
          return null;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        log(`📁 Workspace root: ${workspaceRoot}`);

        // Buscar en los archivos de DI usando patrones configurables
        log(`🔎 Searching for module definition...`);
        const modules = findModuleDefinition(workspaceRoot, moduleName, config);

        if (modules.length > 0) {
          log(`✅ Found ${modules.length} module(s)!`);
          // Si encontramos múltiples definiciones, mostrar todas
          return modules.map((module) => {
            log(`  - ${module.filePath}:${module.line || 0}:${module.column || 0}`);
            return new vscode.Location(
              vscode.Uri.file(module.filePath),
              new vscode.Position(module.line || 0, module.column || 0)
            );
          });
        }

        log(`❌ No modules found for: ${moduleName}`);
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

              // Buscar la línea de exportación en el archivo
              const exportLocation = findExportLineInFile(importedFilePath, reference);

              results.push({
                name: moduleName,
                filePath: importedFilePath,
                line: exportLocation?.line,
                column: exportLocation?.column,
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

const findExportLineInFile = (
  filePath: string,
  reference: string
): { line: number; column: number } | null => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Patrones de exportación a buscar
    const exportPatterns = [
      // export const functionName
      new RegExp(`^\\s*export\\s+const\\s+${escapeRegExp(reference)}\\s*[=:]`, ""),
      // export function functionName
      new RegExp(`^\\s*export\\s+function\\s+${escapeRegExp(reference)}\\s*[\\(]`, ""),
      // export class ClassName
      new RegExp(`^\\s*export\\s+class\\s+${escapeRegExp(reference)}\\s*[{]`, ""),
      // export default functionName
      new RegExp(`^\\s*export\\s+default\\s+${escapeRegExp(reference)}\\s*[;]?`, ""),
      // const functionName = ... seguido de export
      new RegExp(`^\\s*const\\s+${escapeRegExp(reference)}\\s*[=:]`, ""),
      // function functionName
      new RegExp(`^\\s*function\\s+${escapeRegExp(reference)}\\s*[\\(]`, ""),
      // class ClassName
      new RegExp(`^\\s*class\\s+${escapeRegExp(reference)}\\s*[{]`, ""),
      // export { functionName }
      new RegExp(`^\\s*export\\s*\\{[^}]*\\b${escapeRegExp(reference)}\\b[^}]*\\}`, ""),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of exportPatterns) {
        if (pattern.test(line)) {
          const column = line.indexOf(reference);
          log(`📍 Found export at line ${i + 1}, column ${column}: ${line.trim()}`);
          return { line: i, column: Math.max(0, column) };
        }
      }
    }

    log(`⚠️ Export not found for ${reference} in ${filePath}, using line 0`);
  } catch (error) {
    log(`❌ Error reading file for export search: ${error}`);
  }

  return null;
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
  log(`🔎 Finding references to container: ${containerName}`);
  const locations: vscode.Location[] = [];
  const searchDir = path.join(workspaceRoot, config.searchRootPath);

  if (!fs.existsSync(searchDir)) {
    log(`❌ Search directory not found: ${searchDir}`);
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
            // Crear patrón flexible que permita espacios/saltos de línea entre partes
            // Ejemplo: "container.resolve" -> "container\s*\.\s*resolve"
            const flexiblePattern = callPattern
              .split('.')
              .map(part => escapeRegExp(part))
              .join('\\s*\\.\\s*');

            const fullPattern = `${flexiblePattern}\\s*\\(\\s*['"\`]${escapeRegExp(
              containerName
            )}['"\`]\\s*\\)`;

            log(`🔍 Searching with pattern: ${fullPattern} in ${path.basename(fullPath)}`);

            // Buscar en líneas individuales (caso de una sola línea)
            const pattern = new RegExp(fullPattern, "g");

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

            // Buscar en modo multilínea para casos como:
            // container
            //   .resolve('moduleName')
            const multilinePattern = new RegExp(
              fullPattern,
              "gms" // m = multiline, s = dotall (. coincide con saltos de línea)
            );

            let multilineMatch;
            while ((multilineMatch = multilinePattern.exec(content)) !== null) {
              const matchStart = multilineMatch.index;
              const matchEnd = matchStart + multilineMatch[0].length;

              // Calcular línea y columna de inicio
              const beforeMatch = content.substring(0, matchStart);
              const linesBefore = beforeMatch.split("\n");
              const startLineIndex = linesBefore.length - 1;
              const startColumn = linesBefore[linesBefore.length - 1].length;

              // Calcular línea y columna de fin
              const beforeEnd = content.substring(0, matchEnd);
              const linesBeforeEnd = beforeEnd.split("\n");
              const endLineIndex = linesBeforeEnd.length - 1;
              const endColumn = linesBeforeEnd[linesBeforeEnd.length - 1].length;

              // Verificar si ya hemos agregado esta ubicación (evitar duplicados)
              const isDuplicate = locations.some(
                (loc) =>
                  loc.uri.fsPath === fullPath &&
                  loc.range.start.line === startLineIndex &&
                  loc.range.start.character === startColumn
              );

              if (!isDuplicate) {
                log(`📍 Found reference at ${fullPath}:${startLineIndex + 1}:${startColumn}`);
                locations.push(
                  new vscode.Location(
                    vscode.Uri.file(fullPath),
                    new vscode.Range(
                      new vscode.Position(startLineIndex, startColumn),
                      new vscode.Position(endLineIndex, endColumn)
                    )
                  )
                );
              }
            }
          }
        } catch (error) {
          // Ignorar errores de lectura de archivos
        }
      }
    }
  };

  searchInDirectory(searchDir);

  log(`✅ Found ${locations.length} reference(s) to ${containerName}`);
  return locations;
};

export const deactivate = () => { };
