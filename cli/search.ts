/**
 * Agentic search: how Artemis gets context.
 *
 * No vector store, no embedding index, no RAG. The model writes a glob or a regular
 * expression and reads what comes back, the way a person would. That means no index to
 * build or invalidate, nothing stale after an edit, and a retrieval step the user can
 * read and check — a vector hit is unfalsifiable, a grep result is a line number.
 *
 * The three bounds below exist because this runs on someone's real checkout:
 *   - every path is confined to the working directory, symlinks resolved first;
 *   - noisy directories are skipped unless the pattern explicitly names them;
 *   - every result is capped, because an unbounded grep silently eats the context
 *     window and the model then answers from a truncated middle without knowing.
 */
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

import { matchesGlob } from './glob.ts';

export const SKIP_DIRECTORIES = new Set([
  '.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build',
  '.next', '.cache', 'target', '.mypy_cache', '.pytest_cache', 'coverage',
]);

export const LIMITS = {
  files: 200,
  matches: 100,
  lineLength: 400,
  fileBytes: 2_000_000,
  readLines: 400,
  walkEntries: 20_000,
};

export interface GrepHit { path: string; line: number; text: string }

/** Resolves a path inside the root, or throws. Guards `..`, absolute paths and symlinks. */
export async function confine(root: string, candidate: string): Promise<string> {
  const base = await realpath(resolve(root));
  const target = resolve(base, candidate);
  let real = target;
  try {
    real = await realpath(target);        // a symlink out of the tree is still an escape
  } catch {
    // the file may not exist yet; the lexical check below still applies
  }
  if (real !== base && !real.startsWith(base + sep)) {
    throw new Error(`path is outside the working directory: ${candidate}`);
  }
  return real;
}

function skipped(name: string, pattern: string): boolean {
  // Honour an explicit mention: "node_modules/**" means the user wants node_modules.
  return SKIP_DIRECTORIES.has(name) && !pattern.includes(name);
}

/** Every file under root matching the glob, relative paths, POSIX separators, sorted. */
export async function globFiles(root: string, pattern: string, limit = LIMITS.files): Promise<string[]> {
  const base = await realpath(resolve(root));
  const found: string[] = [];
  let visited = 0;

  async function walk(dir: string): Promise<void> {
    if (found.length >= limit || visited >= LIMITS.walkEntries) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;   // unreadable directory: skip it rather than fail the whole search
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (found.length >= limit || ++visited >= LIMITS.walkEntries) return;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipped(entry.name, pattern)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const rel = relative(base, full).split(sep).join('/');
        if (matchesGlob(rel, pattern)) found.push(rel);
      }
    }
  }

  await walk(base);
  return found;
}

/** Lines matching a regular expression, across the files a glob selects. */
export async function grepFiles(
  root: string,
  expression: string,
  pattern = '**/*',
  options: { ignoreCase?: boolean; limit?: number } = {},
): Promise<GrepHit[]> {
  let regexp: RegExp;
  try {
    regexp = new RegExp(expression, options.ignoreCase ? 'i' : '');
  } catch (cause) {
    // Hand the engine's own complaint back: the model can usually repair its pattern.
    const reason = cause instanceof Error ? `: ${cause.message}` : '';
    throw new Error(`not a valid regular expression ${JSON.stringify(expression)}${reason}`);
  }
  const limit = options.limit ?? LIMITS.matches;
  const base = await realpath(resolve(root));
  const hits: GrepHit[] = [];

  for (const rel of await globFiles(root, pattern, LIMITS.files)) {
    if (hits.length >= limit) break;
    const full = join(base, rel);
    let info;
    try {
      info = await stat(full);
    } catch {
      continue;
    }
    if (info.size > LIMITS.fileBytes) continue;
    let text: string;
    try {
      text = await readFile(full, 'utf8');
    } catch {
      continue;
    }
    if (text.includes('\u0000')) continue;    // a binary file; grep -I does the same
    const lines = text.split('\n');
    for (let i = 0; i < lines.length && hits.length < limit; i++) {
      const line = lines[i] as string;
      if (regexp.test(line)) {
        hits.push({ path: rel, line: i + 1, text: clip(line.trim(), LIMITS.lineLength) });
      }
    }
  }
  return hits;
}

/** A slice of one file, with line numbers, so the model can cite what it read. */
export async function readFileSlice(
  root: string,
  path: string,
  offset = 1,
  limit = LIMITS.readLines,
): Promise<{ path: string; from: number; to: number; total: number; text: string }> {
  const full = await confine(root, path);
  const info = await stat(full);
  if (info.size > LIMITS.fileBytes) throw new Error(`${path} is too large to read in full (${info.size} bytes)`);
  const lines = (await readFile(full, 'utf8')).split('\n');
  const from = Math.max(1, Math.trunc(offset));
  const to = Math.min(lines.length, from + Math.max(1, Math.trunc(limit)) - 1);
  const slice = lines.slice(from - 1, to).map((line, i) => `${from + i}\t${clip(line, LIMITS.lineLength)}`);
  return { path, from, to, total: lines.length, text: slice.join('\n') };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + ' …';
}
