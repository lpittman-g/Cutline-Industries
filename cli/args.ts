/** Command-line parsing, kept pure so the whole surface can be tested without a process. */

export type Command = 'chat' | 'models' | 'status' | 'config' | 'help' | 'version';

export interface Parsed {
  command: Command;
  prompt: string;
  /** --plain drops the Ink UI for line output; implied when stdout is not a terminal. */
  plain: boolean;
  /** --no-search turns off the glob/grep retrieval loop for one run. */
  search: boolean;
  model?: string;
  brain?: string;
  tier?: string;
  json: boolean;
  /** `config` only: a key is read from the environment or prompted for, never from argv. */
  setKey: boolean;
  setUrl?: string;
  error?: string;
}

const COMMANDS = new Set<Command>(['chat', 'models', 'status', 'config', 'help', 'version']);
const WITH_VALUE = new Set(['--model', '-m', '--brain', '--tier', '--url']);

export function parseArgs(argv: string[]): Parsed {
  const parsed: Parsed = { command: 'chat', prompt: '', plain: false, search: true, json: false, setKey: false };
  const words: string[] = [];
  let first = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--') {
      words.push(...argv.slice(i + 1));
      break;
    }
    if (WITH_VALUE.has(arg)) {
      const value = argv[++i];
      if (value === undefined) return { ...parsed, error: `${arg} needs a value` };
      if (arg === '--model' || arg === '-m') parsed.model = value;
      else if (arg === '--brain') parsed.brain = value;
      else if (arg === '--tier') parsed.tier = value;
      else parsed.setUrl = value;
      continue;
    }
    // A key on the command line lands in shell history and in `ps`, where any other
    // user on the box can read it. Refuse it rather than quietly accept it.
    if (arg === '--key' || arg === '--api-key') {
      if (argv[i + 1] && !argv[i + 1]?.startsWith('-')) {
        return { ...parsed, error: 'do not pass a key as an argument; run "artemis config --key" and paste it at the prompt' };
      }
      parsed.setKey = true;
      continue;
    }
    if (arg === '--json') { parsed.json = true; continue; }
    if (arg === '--plain') { parsed.plain = true; continue; }
    if (arg === '--no-search') { parsed.search = false; continue; }
    if (arg === '--help' || arg === '-h') return { ...parsed, command: 'help' };
    if (arg === '--version' || arg === '-V') return { ...parsed, command: 'version' };
    if (arg.startsWith('-') && arg !== '-') return { ...parsed, error: `unknown option ${arg}` };

    if (first && COMMANDS.has(arg as Command)) parsed.command = arg as Command;
    else words.push(arg);
    first = false;
  }

  parsed.prompt = words.join(' ').trim();
  return parsed;
}

export const HELP = `artemis — Artemis from the terminal

  artemis                        start an interactive session
  artemis "<prompt>"             ask once and print the answer
  artemis chat "<prompt>"        the same, stated explicitly
  artemis models                 models your plan includes
  artemis status                 whether Artemis is serving
  artemis config                 show the current settings
  artemis config --key           store an API key (prompted, never echoed)
  artemis config --url <url>     point at a different gateway

Options
  -m, --model <id>   answer with this model (default: artemis)
      --plain        line output instead of the full-screen UI
      --no-search    answer without reading any files
      --brain <id>   send straight to one specialist
      --tier <id>    request a tier your plan allows
      --json         machine-readable output, for scripts
  -h, --help         this text
  -V, --version      print the version

Artemis reads your files to answer: it writes globs and greps itself, there is no
index to build and nothing goes stale after an edit. Every search it runs is shown.
Nothing outside the working directory is read, and nothing is written.

Piping works in both directions:
  cat notes.md | artemis "summarise this"
  artemis --json models | jq -r '.models[].id'

Settings live in ~/.artemis/config.json (owner-readable only).
ARTEMIS_BASE_URL, ARTEMIS_API_KEY and ARTEMIS_MODEL override it.`;
