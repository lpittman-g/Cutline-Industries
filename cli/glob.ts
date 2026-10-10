/**
 * Glob matching, written out rather than taken from a dependency.
 *
 * Artemis retrieves context with plain globs and greps driven by the model, so this
 * is load-bearing: a pattern the model writes has to mean what the model expects, and
 * a silent mismatch reads to the user as "Artemis cannot find the file".
 */

/** Translates one glob to an anchored regular expression over a POSIX-style path. */
export function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i] as string;
    if (c === '*') {
      const doubled = pattern[i + 1] === '*';
      if (doubled) {
        // `**/` crosses directories and also matches zero of them, so that
        // `**/*.ts` finds `index.ts` at the root, which is what everyone expects.
        if (pattern[i + 2] === '/') { out += '(?:[^/]*\\/)*'; i += 2; }
        else { out += '.*'; i += 1; }
      } else out += '[^/]*';
      continue;
    }
    if (c === '?') { out += '[^/]'; continue; }
    if (c === '{') {
      const close = pattern.indexOf('}', i);
      if (close > i) {
        const options = pattern.slice(i + 1, close).split(',');
        out += '(?:' + options.map(escape).join('|') + ')';
        i = close;
        continue;
      }
    }
    if (c === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close > i + 1) { out += pattern.slice(i, close + 1); i = close; continue; }
    }
    out += escape(c);
  }
  return new RegExp('^' + out + '$');
}

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

export function matchesGlob(path: string, pattern: string): boolean {
  return globToRegExp(pattern).test(path);
}
