import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const candidateSuffixes = [
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.mjs",
  "/index.cjs",
];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCandidatePath(basePath) {
  if (path.extname(basePath) && await fileExists(basePath)) {
    return basePath;
  }

  for (const suffix of candidateSuffixes) {
    const candidatePath = `${basePath}${suffix}`;
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const candidatePath = await resolveCandidatePath(
      path.join(workspaceRoot, "src", specifier.slice(2))
    );

    if (candidatePath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidatePath).href,
      };
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier) &&
    context.parentURL?.startsWith("file:")
  ) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidatePath = await resolveCandidatePath(
      path.resolve(path.dirname(parentPath), specifier)
    );

    if (candidatePath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidatePath).href,
      };
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx") || url.endsWith(".mts")) {
    return defaultLoad(
      url,
      {
        ...context,
        format: "module-typescript",
      },
      defaultLoad
    );
  }

  return defaultLoad(url, context, defaultLoad);
}
