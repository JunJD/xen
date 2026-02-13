import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const sourceDir = resolve(root, 'node_modules', 'pyodide');
const publicPyodideDir = resolve(root, 'public', 'pyodide');
const sourcePackageJsonPath = resolve(sourceDir, 'package.json');

const FALLBACK_VERSION = '0.0.0';

async function resolvePyodideVersion() {
  try {
    const packageJsonText = await readFile(sourcePackageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonText);
    const version = packageJson.version;
    if (typeof version === 'string' && version.length > 0) {
      return version;
    }
  }
  catch {
    // Keep fallback to avoid blocking local development if JSON import fails.
  }
  return FALLBACK_VERSION;
}

async function main() {
  const version = await resolvePyodideVersion();
  const versionedTargetDir = resolve(publicPyodideDir, version);

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile()).map(entry => entry.name);

  if (files.length === 0) {
    throw new Error(`No files found in ${sourceDir}`);
  }

  await rm(publicPyodideDir, { recursive: true, force: true });
  await mkdir(versionedTargetDir, { recursive: true });
  await Promise.all(
    files.map(file =>
      copyFile(resolve(sourceDir, file), resolve(versionedTargetDir, file)),
    ),
  );

  console.log(`Synced ${files.length} pyodide files to public/pyodide/${version}`);
}

main().catch((error) => {
  console.error('Failed to sync pyodide runtime files:', error);
  process.exitCode = 1;
});
