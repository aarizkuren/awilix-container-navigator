import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface ContainerModule {
  name: string;
  filePath: string;
}

export const activate = (context: vscode.ExtensionContext) => {
  // Provider para navegar desde container.resolve() a la definición
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    ["typescript", "typescriptreact"],
    {
      provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(
          position,
          /['"`][\w]+['"`]/
        );

        if (!wordRange) {
          return null;
        }

        const line = document.lineAt(position.line).text;

        // Verificar si estamos en una llamada a container.resolve
        if (!line.includes("container.resolve")) {
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

        // Buscar en los archivos _di
        const modules = findModuleDefinition(workspaceRoot, moduleName);

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
    ["typescript", "typescriptreact"],
    {
      provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Location[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          return null;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const currentFilePath = document.uri.fsPath;

        // Verificar si estamos en un archivo de caso de uso
        if (
          !currentFilePath.includes("/usecases/") &&
          !currentFilePath.includes("/infrastructure/")
        ) {
          return null;
        }

        // Encontrar el nombre con el que está registrado en el container
        const containerNames = findContainerNameForFile(
          workspaceRoot,
          currentFilePath
        );

        if (containerNames.length === 0) {
          return null;
        }

        // Buscar todas las referencias a container.resolve con estos nombres
        const references: vscode.Location[] = [];

        for (const containerName of containerNames) {
          const refs = findReferencesToContainerResolve(
            workspaceRoot,
            containerName
          );
          references.push(...refs);
        }

        return references.length > 0 ? references : null;
      },
    }
  );

  context.subscriptions.push(definitionProvider, referenceProvider);
};

const findModuleDefinition = (
  workspaceRoot: string,
  moduleName: string
): ContainerModule[] => {
  const results: ContainerModule[] = [];

  // Buscar en el archivo de registro principal
  const registerModulesPath = path.join(
    workspaceRoot,
    "src",
    "core",
    "Shared",
    "_di",
    "registerModules.ts"
  );

  // Buscar en todos los archivos _di/index.ts
  const coreDir = path.join(workspaceRoot, "src", "core");

  if (fs.existsSync(coreDir)) {
    const domains = fs
      .readdirSync(coreDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const domain of domains) {
      const diPath = path.join(coreDir, domain, "_di", "index.ts");

      if (fs.existsSync(diPath)) {
        const content = fs.readFileSync(diPath, "utf-8");

        // Buscar el patrón: moduleName: asFunction(something)
        const pattern = new RegExp(
          `${moduleName}:\\s*asFunction\\(([^)]+)\\)`,
          "g"
        );
        const match = pattern.exec(content);

        if (match) {
          const functionName = match[1].trim();

          // Buscar el import de esta función
          const importPattern = new RegExp(
            `import\\s*{[^}]*${functionName}[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
            "g"
          );
          const importMatch = importPattern.exec(content);

          if (importMatch) {
            let importPath = importMatch[1];

            // Convertir path relativo a absoluto
            if (importPath.startsWith("../") || importPath.startsWith("./")) {
              const diDir = path.dirname(diPath);
              importPath = path.resolve(diDir, importPath);
            } else if (importPath.startsWith("src/")) {
              importPath = path.join(workspaceRoot, importPath);
            }

            // Añadir extensión .ts si no existe
            if (!importPath.endsWith(".ts") && !importPath.endsWith(".tsx")) {
              importPath += ".ts";
            }

            if (fs.existsSync(importPath)) {
              results.push({
                name: moduleName,
                filePath: importPath,
              });
            }
          }
        }
      }
    }
  }

  // También buscar en registerModules.ts
  if (fs.existsSync(registerModulesPath)) {
    const content = fs.readFileSync(registerModulesPath, "utf-8");
    const pattern = new RegExp(
      `${moduleName}:\\s*asFunction\\(([^)]+)\\)`,
      "g"
    );
    const match = pattern.exec(content);

    if (match) {
      const functionName = match[1].trim();
      const importPattern = new RegExp(
        `import\\s*{[^}]*${functionName}[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
        "g"
      );
      const importMatch = importPattern.exec(content);

      if (importMatch) {
        let importPath = importMatch[1];

        if (importPath.startsWith("../") || importPath.startsWith("./")) {
          const registerDir = path.dirname(registerModulesPath);
          importPath = path.resolve(registerDir, importPath);
        } else if (importPath.startsWith("src/")) {
          importPath = path.join(workspaceRoot, importPath);
        }

        if (!importPath.endsWith(".ts") && !importPath.endsWith(".tsx")) {
          importPath += ".ts";
        }

        if (fs.existsSync(importPath)) {
          results.push({
            name: moduleName,
            filePath: importPath,
          });
        }
      }
    }
  }

  return results;
};

const findContainerNameForFile = (
  workspaceRoot: string,
  filePath: string
): string[] => {
  const containerNames: string[] = [];

  // Normalizar el path del archivo
  const normalizedFilePath = path.normalize(filePath);

  // Buscar en todos los archivos _di/index.ts
  const coreDir = path.join(workspaceRoot, "src", "core");
  const registerModulesPath = path.join(
    workspaceRoot,
    "src",
    "core",
    "Shared",
    "_di",
    "registerModules.ts"
  );

  const diFiles: string[] = [];

  if (fs.existsSync(coreDir)) {
    const domains = fs
      .readdirSync(coreDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const domain of domains) {
      const diPath = path.join(coreDir, domain, "_di", "index.ts");
      if (fs.existsSync(diPath)) {
        diFiles.push(diPath);
      }
    }
  }

  if (fs.existsSync(registerModulesPath)) {
    diFiles.push(registerModulesPath);
  }

  // Buscar en cada archivo _di
  for (const diFile of diFiles) {
    const content = fs.readFileSync(diFile, "utf-8");

    // Extraer el nombre del archivo base sin extensión
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

    // Buscar imports que coincidan con este archivo
    const importPattern = new RegExp(
      `import\\s*{[^}]*\\b(\\w+)\\b[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
      "g"
    );

    let importMatch;
    const importedFunctions: string[] = [];

    while ((importMatch = importPattern.exec(content)) !== null) {
      let importPath = importMatch[2];
      const functionName = importMatch[1];

      // Convertir path relativo a absoluto
      if (importPath.startsWith("../") || importPath.startsWith("./")) {
        const diDir = path.dirname(diFile);
        importPath = path.resolve(diDir, importPath);
      } else if (importPath.startsWith("src/")) {
        importPath = path.join(workspaceRoot, importPath);
      }

      // Añadir extensión .ts si no existe
      if (!importPath.endsWith(".ts") && !importPath.endsWith(".tsx")) {
        importPath += ".ts";
      }

      importPath = path.normalize(importPath);

      // Si el import coincide con nuestro archivo, guardar el nombre de la función
      if (importPath === normalizedFilePath) {
        importedFunctions.push(functionName);
      }
    }

    // Ahora buscar las definiciones en el módulo que usan estas funciones
    for (const funcName of importedFunctions) {
      const modulePattern = new RegExp(
        `(\\w+):\\s*asFunction\\(${funcName}\\)`,
        "g"
      );
      let moduleMatch;

      while ((moduleMatch = modulePattern.exec(content)) !== null) {
        const containerName = moduleMatch[1];
        if (!containerNames.includes(containerName)) {
          containerNames.push(containerName);
        }
      }
    }
  }

  return containerNames;
};

const findReferencesToContainerResolve = (
  workspaceRoot: string,
  containerName: string
): vscode.Location[] => {
  const locations: vscode.Location[] = [];
  const srcDir = path.join(workspaceRoot, "src");

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

          // Buscar container.resolve('containerName') o container.resolve("containerName")
          const pattern = new RegExp(
            `container\\.resolve\\s*\\(\\s*['"\`]${containerName}['"\`]\\s*\\)`,
            "g"
          );

          lines.forEach((line, lineIndex) => {
            let match;
            while ((match = pattern.exec(line)) !== null) {
              const startPos = match.index + line.indexOf("container.resolve");
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
        } catch (error) {
          // Ignorar errores de lectura de archivos
        }
      }
    }
  };

  searchInDirectory(srcDir);

  return locations;
};

export const deactivate = () => {};
