import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import process from 'node:process';

const POS_CANONICAL_MAP = {
  n: 'NOUN',
  noun: 'NOUN',
  v: 'VERB',
  vt: 'VERB',
  vi: 'VERB',
  verb: 'VERB',
  adj: 'ADJ',
  a: 'ADJ',
  adjective: 'ADJ',
  adv: 'ADV',
  adverb: 'ADV',
  prep: 'ADP',
  preposition: 'ADP',
  conj: 'CCONJ',
  conjunction: 'CCONJ',
  sconj: 'SCONJ',
  pron: 'PRON',
  pronoun: 'PRON',
  det: 'DET',
  determiner: 'DET',
  num: 'NUM',
  numeral: 'NUM',
  int: 'INTJ',
  interj: 'INTJ',
  interjection: 'INTJ',
  aux: 'AUX',
  auxiliary: 'AUX',
  part: 'PART',
  particle: 'PART',
  propn: 'PROPN',
  propernoun: 'PROPN',
  sym: 'SYM',
  symbol: 'SYM',
  abbr: 'X',
  abbrev: 'X',
  abbrv: 'X',
  phrase: 'X',
  phr: 'X',
  idiom: 'X',
  modal: 'AUX',
};

const POS_TOKENS = Object.keys(POS_CANONICAL_MAP)
  .sort((a, b) => b.length - a.length)
  .join('|');

const POS_SEGMENT_REGEX = new RegExp(
  String.raw`(?:^|[\n\r]|[，,；;]\s*|-+\s*)(?<pos>(?:${POS_TOKENS})(?:\s*&\s*(?:${POS_TOKENS}))*)\s*[.:：]\s*`,
  'gi',
);

const POS_LIST_TOKEN_REGEX = new RegExp(String.raw`(?:${POS_TOKENS})`, 'gi');
const NON_MEANING_SECTION_REGEX = /(?:时\s*态|过去式|过去分词|现在分词|名\s*词|动\s*词|形\s*容\s*词|副\s*词)\s*[:：]/i;

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/build-trans-by-pos.mjs [--out <file>] [--force] [--unknown-pos <TAG>] <inputs...>',
      '  node scripts/build-trans-by-pos.mjs   # defaults to public/dicts',
      '',
      'Inputs can be JSON files or directories containing JSON files.',
      'If --out is set, only one input JSON file is allowed.',
      '--unknown-pos writes meanings into transByPos.<TAG> when POS cannot be parsed.',
      '',
      'Examples:',
      '  node scripts/build-trans-by-pos.mjs public/dicts/xinghuoqiaoji_4.json',
      '  node scripts/build-trans-by-pos.mjs --force public/dicts/CET4_T.json',
      '  node scripts/build-trans-by-pos.mjs --unknown-pos X public/dicts/CET4_T.json',
      '  node scripts/build-trans-by-pos.mjs --out ./tmp.json public/dicts/xinghuoqiaoji_4.json',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const inputs = [];
  let outPath = null;
  let force = false;
  let unknownPos = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      continue;
    }
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
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--unknown-pos') {
      if (i + 1 >= argv.length) {
        throw new Error('Missing value for --unknown-pos');
      }
      const rawTag = String(argv[i + 1] ?? '').trim();
      if (!rawTag) {
        throw new Error('--unknown-pos requires a non-empty tag.');
      }
      unknownPos = rawTag.toUpperCase();
      i += 1;
      continue;
    }
    inputs.push(arg);
  }

  if (inputs.length === 0) {
    inputs.push('public/dicts');
  }

  if (outPath && inputs.length !== 1) {
    throw new Error('--out only supports exactly one input file.');
  }

  return { inputs, outPath, force, unknownPos };
}

async function collectJsonFiles(inputPaths) {
  const files = [];
  const cwd = process.cwd();
  for (const input of inputPaths) {
    const resolved = resolve(cwd, input);
    let info;
    try {
      info = await stat(resolved);
    } catch {
      throw new Error(`Path not found: ${input}`);
    }

    if (info.isDirectory()) {
      const entries = await readdir(resolved, { withFileTypes: true });
      const jsonFiles = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
        .map(entry => resolve(resolved, entry.name))
        .sort((a, b) => a.localeCompare(b));
      files.push(...jsonFiles);
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

function toCanonicalPosList(raw) {
  const normalized = String(raw ?? '').toLowerCase();
  const matches = normalized.match(POS_LIST_TOKEN_REGEX) ?? [];
  const list = [];
  matches.forEach((token) => {
    const mapped = POS_CANONICAL_MAP[token];
    if (!mapped || list.includes(mapped)) {
      return;
    }
    list.push(mapped);
  });
  return list;
}

function normalizeMeaningText(raw) {
  let text = String(raw ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) {
    return '';
  }

  const sectionMatch = NON_MEANING_SECTION_REGEX.exec(text);
  if (sectionMatch && typeof sectionMatch.index === 'number' && sectionMatch.index > 0) {
    text = text.slice(0, sectionMatch.index).trim();
  }

  return text
    .replace(/^[\-–—\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitByDelimitersRespectParens(text) {
  const parts = [];
  let buffer = '';
  let depthRound = 0;
  let depthSquare = 0;

  const flush = () => {
    const normalized = buffer.trim();
    if (normalized) {
      parts.push(normalized);
    }
    buffer = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '(' || char === '（') {
      depthRound += 1;
      buffer += char;
      continue;
    }
    if (char === ')' || char === '）') {
      depthRound = Math.max(0, depthRound - 1);
      buffer += char;
      continue;
    }
    if (char === '[') {
      depthSquare += 1;
      buffer += char;
      continue;
    }
    if (char === ']') {
      depthSquare = Math.max(0, depthSquare - 1);
      buffer += char;
      continue;
    }

    const canSplit = depthRound === 0 && depthSquare === 0;
    if (canSplit && (char === '；' || char === ';' || char === '，' || char === ',')) {
      flush();
      continue;
    }

    buffer += char;
  }

  flush();
  return parts;
}

function splitMeanings(raw) {
  const normalized = normalizeMeaningText(raw);
  if (!normalized) {
    return [];
  }
  const parts = splitByDelimitersRespectParens(normalized)
    .map(item => item.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

function parseTransByPosFromText(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) {
    return null;
  }

  const matches = [...text.matchAll(POS_SEGMENT_REGEX)];
  if (matches.length === 0) {
    return null;
  }

  const byPos = {};

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const posRaw = current.groups?.pos ?? '';
    const posList = toCanonicalPosList(posRaw);
    if (posList.length === 0) {
      continue;
    }

    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? text.length;
    const content = text.slice(start, end);
    const meanings = splitMeanings(content);
    if (meanings.length === 0) {
      continue;
    }

    posList.forEach((posKey) => {
      if (!byPos[posKey]) {
        byPos[posKey] = [];
      }
      meanings.forEach((meaning) => {
        if (!byPos[posKey].includes(meaning)) {
          byPos[posKey].push(meaning);
        }
      });
    });
  }

  return Object.keys(byPos).length > 0 ? byPos : null;
}

function readTransText(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const trans = entry.trans;
  if (Array.isArray(trans)) {
    return trans.filter(item => typeof item === 'string').join('\n');
  }
  if (typeof trans === 'string') {
    return trans;
  }
  return '';
}

function readTransMeanings(entry) {
  if (!entry || typeof entry !== 'object') {
    return [];
  }
  const trans = entry.trans;
  if (Array.isArray(trans)) {
    const list = [];
    trans
      .filter(item => typeof item === 'string')
      .forEach((item) => {
        splitMeanings(item).forEach((meaning) => {
          if (!list.includes(meaning)) {
            list.push(meaning);
          }
        });
      });
    return list;
  }
  if (typeof trans === 'string') {
    return splitMeanings(trans);
  }
  return [];
}

async function processSingleFile(filePath, options) {
  const text = await readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    return {
      filePath,
      outputPath: filePath,
      scanned: 0,
      converted: 0,
      skippedExisting: 0,
      skippedNonArray: true,
    };
  }

  let scanned = 0;
  let converted = 0;
  let skippedExisting = 0;

  const next = parsed.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }
    scanned += 1;

    if (!options.force && entry.transByPos && typeof entry.transByPos === 'object') {
      skippedExisting += 1;
      return entry;
    }

    const transText = readTransText(entry);
    let transByPos = parseTransByPosFromText(transText);
    if (!transByPos && options.unknownPos) {
      const meanings = readTransMeanings(entry);
      if (meanings.length > 0) {
        transByPos = { [options.unknownPos]: meanings };
      }
    }
    if (!transByPos) {
      return entry;
    }

    converted += 1;
    return {
      ...entry,
      transByPos,
    };
  });

  const outputPath = options.outPath ? resolve(process.cwd(), options.outPath) : filePath;
  await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);

  return {
    filePath,
    outputPath,
    scanned,
    converted,
    skippedExisting,
    skippedNonArray: false,
  };
}

async function main() {
  const { inputs, outPath, force, unknownPos } = parseArgs(process.argv.slice(2));
  const files = await collectJsonFiles(inputs);
  if (files.length === 0) {
    throw new Error('No JSON files found in input paths.');
  }

  if (outPath && files.length !== 1) {
    throw new Error('--out requires exactly one resolved input JSON file.');
  }

  const reports = [];
  for (const filePath of files) {
    const report = await processSingleFile(filePath, { force, outPath, unknownPos });
    reports.push(report);
  }

  reports.forEach((report) => {
    if (report.skippedNonArray) {
      console.log(`Skipped(non-array JSON): ${report.filePath}`);
      return;
    }

    console.log(
      [
        `Processed: ${report.filePath}`,
        `Output: ${report.outputPath}`,
        `Scanned: ${report.scanned}`,
        `Converted: ${report.converted}`,
        `Skipped(existing): ${report.skippedExisting}`,
      ].join(' | '),
    );
  });
}

main().catch((error) => {
  console.error('Failed to build transByPos:', error);
  process.exitCode = 1;
});
