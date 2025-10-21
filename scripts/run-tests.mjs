import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const testsDir = join(rootDir, "tests");

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

let testFiles;
try {
  testFiles = await collectTestFiles(testsDir);
} catch (error) {
  if (error && error.code === "ENOENT") {
    testFiles = [];
  } else {
    console.error("テストファイルの探索に失敗しました。", error);
    process.exit(1);
  }
}

if (testFiles.length === 0) {
  console.error(".test.tsファイルが見つかりませんでした。");
  process.exit(1);
}

const loaderPath = fileURLToPath(new URL("../loader.mjs", import.meta.url));

const child = spawn(
  process.execPath,
  ["--loader", loaderPath, "--test", ...testFiles],
  {
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
