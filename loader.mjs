import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TS_EXTENSIONS = [".ts", ".tsx"];

let tsModulePromise;

async function loadTypeScript() {
  if (!tsModulePromise) {
    tsModulePromise = (async () => {
      try {
        const require = createRequire(import.meta.url);
        const resolvedPath = require.resolve("typescript");
        return await import(pathToFileURL(resolvedPath).href);
      } catch {
        const nodePath = process.execPath;
        const binDir = dirname(nodePath);
        const prefix = dirname(binDir);
        const fallbackPath = join(
          prefix,
          "lib",
          "node_modules",
          "typescript",
          "lib",
          "typescript.js",
        );

        await access(fallbackPath);
        return await import(pathToFileURL(fallbackPath).href);
      }
    })();
  }

  return tsModulePromise;
}

function isRelativeSpecifier(specifier) {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  );
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("node:")) {
    return defaultResolve(specifier, context, defaultResolve);
  }

  if (specifier === "next/server") {
    const stubUrl = new URL("./tests/stubs/next-server.ts", import.meta.url);
    return {
      format: "module",
      shortCircuit: true,
      url: stubUrl.href,
    };
  }

  if (specifier.startsWith("@/")) {
    const baseUrl = new URL("./", import.meta.url);
    const absolute = new URL(specifier.slice(2), baseUrl).href;

    try {
      return await defaultResolve(absolute, context, defaultResolve);
    } catch (error) {
      if (error && error.code === "ERR_MODULE_NOT_FOUND") {
        for (const extension of TS_EXTENSIONS) {
          try {
            return await defaultResolve(
              `${absolute}${extension}`,
              context,
              defaultResolve,
            );
          } catch {
            // continue
          }
        }
      }

      throw error;
    }
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !context.parentURL) {
      throw error;
    }

    if (!isRelativeSpecifier(specifier)) {
      throw error;
    }

    for (const extension of TS_EXTENSIONS) {
      const candidate = new URL(
        specifier.endsWith(extension) ? specifier : `${specifier}${extension}`,
        context.parentURL,
      );

      try {
        await access(fileURLToPath(candidate));
        return {
          format: "module",
          shortCircuit: true,
          url: candidate.href,
        };
      } catch {
        // continue searching
      }
    }

    throw error;
  }
}

export async function load(url, context, defaultLoad) {
  const extension = extname(url);
  if (TS_EXTENSIONS.includes(extension)) {
    const source = await readFile(fileURLToPath(url), "utf8");

    const ts = await loadTypeScript();
    const tsModule =
      ts && typeof ts.transpileModule === "function"
        ? ts
        : ts?.default && typeof ts.default.transpileModule === "function"
          ? ts.default
          : null;

    if (!tsModule) {
      throw new Error("TypeScript のトランスパイル機能を読み込めませんでした");
    }

    const { outputText } = tsModule.transpileModule(source, {
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "preserve",
        target: "ES2022",
        esModuleInterop: true,
        importsNotUsedAsValues: "preserve",
      },
      fileName: fileURLToPath(url),
    });

    return {
      format: "module",
      shortCircuit: true,
      source: outputText,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
