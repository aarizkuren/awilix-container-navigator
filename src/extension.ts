import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface ContainerModule {
  name: string;
  filePath: string;
}

export const activate = (context: vscode.ExtensionContext) => {
  console.log("Container Resolver Navigator is now active");

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

  context.subscriptions.push(definitionProvider);
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

export const deactivate = () => {};

