/**
 * Where the CLI keeps its settings: ~/.artemis/config.json, owner-readable only.
 *
 * The API key lives here and nowhere else. It is never printed, never passed as a
 * command-line argument (which would put it in shell history and in `ps`), and the
 * environment wins over the file so CI can supply one without writing it to disk.
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Config {
  baseUrl: string;
  apiKey?: string;
  model?: string;
}

export const DEFAULT_BASE_URL = 'https://api.cutline-industries.studio';

export function configPath(home = homedir()): string {
  return join(home, '.artemis', 'config.json');
}

export function readConfig(path = configPath(), env: NodeJS.ProcessEnv = process.env): Config {
  let stored: Partial<Config> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed && typeof parsed === 'object') stored = parsed as Partial<Config>;
  } catch {
    // no config yet, or an unreadable one: fall back to defaults and the environment
  }
  return {
    baseUrl: env.ARTEMIS_BASE_URL || stored.baseUrl || DEFAULT_BASE_URL,
    apiKey: env.ARTEMIS_API_KEY || stored.apiKey,
    model: env.ARTEMIS_MODEL || stored.model,
  };
}

export function writeConfig(update: Partial<Config>, path = configPath()): Config {
  const current = readConfig(path, {});   // ignore the environment: never persist a CI secret
  const next: Config = { ...current, ...update };
  for (const key of Object.keys(next) as (keyof Config)[]) if (next[key] === undefined) delete next[key];
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  chmodSync(path, 0o600);               // in case the file already existed, more widely readable
  return next;
}

/** What a key may look like in output. Enough to tell two keys apart, not enough to use. */
export function maskKey(key: string | undefined): string {
  if (!key) return 'not set';
  return key.length <= 8 ? '*'.repeat(key.length) : key.slice(0, 4) + '…' + key.slice(-4);
}
