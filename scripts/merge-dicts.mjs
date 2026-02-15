import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT = 'public/dicts';

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/merge-dicts.mjs [--out <file>] <inputs...>',
      '',
      'Inputs can be JSON files or directories containing JSON files.',
      `If no inputs are provided, defaults to ${DEFAULT_INPUT}.`,
      '',
      'Examples:',
      '  node scripts/merge-dicts.mjs --out public/dicts/merged.json public/dicts',
      '  node scripts/merge-dicts.mjs public/dicts/*.json > merged.json',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const inputs = [];
  let outPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    }
    if (arg === '-o' || arg === '--out') {
      if (i + 1 >= argv.length) {
        throw new Error('Missing value for --out');
      }
      outPath = argv[i + 1];
      i += 1;
      continue;
    }
    inputs.push(arg);
  }
  return { inputs, outPath };
}

async function collectJsonFiles(inputPaths) {
  const files = [];
  const cwd = process.cwd();
  for (const input of inputPaths) {
    const resolved = resolve(cwd, input);
    let info;
    try {
      info = await stat(resolved);
    }
    catch (error) {
      throw new Error(`Path not found: ${input}`);
    }

    if (info.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      const jsonFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));
      for (const name of jsonFiles) {
        files.push(resolve(resolved, name));
      }
      continue;
    }

    if (info.isFile()) {
      if (extname(resolved) !== '.json') {
        throw new Error(`Not a .json file: ${input}`);
      }
      files.push(resolved);
      continue;
    }

    throw new Error(`Unsupported path: ${input}`);
  }
  return files;
}

function hasPhones(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const usphone = entry.usphone;
  const ukphone = entry.ukphone;
  return (
    typeof usphone === 'string' &&
    usphone.trim().length > 0 &&
    typeof ukphone === 'string' &&
    ukphone.trim().length > 0
  );
}

function transLength(entry) {
  if (!entry || typeof entry !== 'object') {
    return 0;
  }
  const trans = entry.trans;
  if (Array.isArray(trans)) {
    return trans.join('').length;
  }
  if (typeof trans === 'string') {
    return trans.length;
  }
  return 0;
}

function isBetterEntry(nextEntry, currentEntry) {
  const nextHasPhones = hasPhones(nextEntry);
  const currentHasPhones = hasPhones(currentEntry);
  if (nextHasPhones !== currentHasPhones) {
    return nextHasPhones;
  }
  const nextTransLength = transLength(nextEntry);
  const currentTransLength = transLength(currentEntry);
  if (nextTransLength !== currentTransLength) {
    return nextTransLength > currentTransLength;
  }
  return false;
}

async function loadJsonFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(`Expected array JSON in ${filePath}`);
  }
  return data;
}

async function main() {
  const { inputs, outPath } = parseArgs(process.argv.slice(2));
  const inputList = inputs.length > 0 ? inputs : [DEFAULT_INPUT];
  const files = await collectJsonFiles(inputList);

  if (files.length === 0) {
    throw new Error('No JSON files found in the input paths.');
  }

  const resolvedOut = outPath ? resolve(process.cwd(), outPath) : null;
  const filteredFiles = resolvedOut
    ? files.filter(file => resolve(file) !== resolvedOut)
    : files;

  const entriesByName = new Map();
  let totalEntries = 0;
  let duplicateEntries = 0;
  let replacedEntries = 0;

  for (const file of filteredFiles) {
    const entries = await loadJsonFile(file);
    totalEntries += entries.length;
    for (const rawEntry of entries) {
      if (!rawEntry || typeof rawEntry !== 'object') {
        continue;
      }
      const rawName = rawEntry.name;
      if (typeof rawName !== 'string') {
        continue;
      }
      const name = rawName.trim();
      if (!name) {
        continue;
      }

      const entry = rawName === name ? rawEntry : { ...rawEntry, name };
      const current = entriesByName.get(name);
      if (!current) {
        entriesByName.set(name, entry);
        continue;
      }
      duplicateEntries += 1;
      if (isBetterEntry(entry, current)) {
        entriesByName.set(name, entry);
        replacedEntries += 1;
      }
    }
  }

  const merged = Array.from(entriesByName.values());
  const output = JSON.stringify(merged, null, 2);

  if (resolvedOut) {
    await writeFile(resolvedOut, output);
    console.log(
      [
        `Wrote ${merged.length} entries to ${resolvedOut}.`,
        `Processed ${filteredFiles.length} files, ${totalEntries} rows,`,
        `${duplicateEntries} duplicates, ${replacedEntries} replacements.`,
      ].join(' '),
    );
    return;
  }

  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error('Failed to merge dicts:', error);
  process.exitCode = 1;
});
