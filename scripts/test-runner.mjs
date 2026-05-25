import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = path.join(workspaceRoot, "src");

async function collectTestFiles(dirPath) {
  const dirEntries = await readdir(dirPath, { withFileTypes: true });
  const collected = [];

  for (const dirEntry of dirEntries) {
    const absolutePath = path.join(dirPath, dirEntry.name);

    if (dirEntry.isDirectory()) {
      collected.push(...await collectTestFiles(absolutePath));
      continue;
    }

    if (dirEntry.isFile() && dirEntry.name.endsWith(".test.ts")) {
      collected.push(absolutePath);
    }
  }

  return collected;
}

const testFiles = (await collectTestFiles(sourceRoot)).sort();

if (testFiles.length === 0) {
  console.error("No test files found under src.");
  process.exitCode = 1;
} else {
  for (const testFile of testFiles) {
    await import(pathToFileURL(testFile).href);
  }
}
