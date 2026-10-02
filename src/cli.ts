#!/usr/bin/env node

/** CLI entry point: argument parsing and command dispatch. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_REQUEST_INTERVAL_MS,
  MIN_REQUEST_INTERVAL_MS,
  SLOW_REQUEST_INTERVAL_MS,
} from './constants';
import { downloadSeries, downloadSingleNovel } from './downloader';
import { resolveOutputDir } from './utils';

const { version: VERSION } = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf8'),
) as { version: string };

const ID_PATTERN = /^\d+$/;

function printHelp(): void {
  console.log(`pixiv-novel-dl v${VERSION} — Pixiv novel downloader

Usage:
  pixiv-novel-dl novel <id>  [options]   Download a single novel
  pixiv-novel-dl series <id> [options]   Download a full series

Options:
  -o, --output <dir>   Output directory (default: ./downloads)
  --split              Save each chapter as a separate file (merged file is always created)
  --delay <ms>         Base request interval in ms (default: ${DEFAULT_REQUEST_INTERVAL_MS})
  --concurrency <n>    Parallel chapter downloads (default: ${DEFAULT_CONCURRENCY}, slow mode: 1)
  --slow               Serial mode (1 worker, longer delays)
  -h, --help           Show help
  -v, --version        Show version

Examples:
  pixiv-novel-dl series 16015437
  pixiv-novel-dl series 16015437 -o ~/Downloads/novels
  pixiv-novel-dl series -o /tmp/novels 16015437
  pixiv-novel-dl novel 12345678 --output ./my-novels
`);
}

interface ParsedArgs {
  command: 'novel' | 'series' | 'help' | 'version';
  id: string;
  output: string;
  split: boolean;
  delay: number;
  slow: boolean;
  concurrency: number;
}

function nextValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function validateId(id: string, command: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`Invalid ${command} ID "${id}". IDs must be numeric.`);
  }
}

/** Parse argv; flags may appear before or after the numeric ID. */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const result: ParsedArgs = {
    command: 'help',
    id: '',
    output: './downloads',
    split: false,
    delay: DEFAULT_REQUEST_INTERVAL_MS,
    slow: false,
    concurrency: DEFAULT_CONCURRENCY,
  };

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    return result;
  }

  if (args.includes('-v') || args.includes('--version')) {
    result.command = 'version';
    return result;
  }

  const positional: string[] = [];
  let delayProvided = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    if (arg === '-o' || arg === '--output') {
      result.output = nextValue(args, i, arg);
      i++;
      continue;
    }

    if (arg === '--split') {
      result.split = true;
      continue;
    }

    if (arg === '--slow') {
      result.slow = true;
      continue;
    }

    if (arg === '--delay') {
      const raw = nextValue(args, i, arg);
      if (!/^\d+$/.test(raw)) {
        throw new Error('--delay requires a positive integer');
      }
      const value = parseInt(raw, 10);
      if (value < MIN_REQUEST_INTERVAL_MS) {
        throw new Error(`--delay requires an integer >= ${MIN_REQUEST_INTERVAL_MS}`);
      }
      result.delay = value;
      delayProvided = true;
      i++;
      continue;
    }

    if (arg === '--concurrency') {
      const raw = nextValue(args, i, arg);
      if (!/^\d+$/.test(raw)) {
        throw new Error('--concurrency requires a positive integer');
      }
      const value = parseInt(raw, 10);
      if (value < 1 || value > 10) {
        throw new Error('--concurrency must be between 1 and 10');
      }
      result.concurrency = value;
      i++;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (result.slow && delayProvided) {
    console.warn('Warning: --slow is active, --delay will be ignored.');
  }

  if (result.slow && result.concurrency !== DEFAULT_CONCURRENCY) {
    console.warn('Warning: --slow is active, --concurrency will be ignored.');
    result.concurrency = 1;
  }

  const command = positional[0];
  if (command !== 'novel' && command !== 'series') {
    throw new Error(`Unknown command: ${command ?? '(missing)'}`);
  }

  const id = positional[1];
  if (!id) {
    throw new Error(`Missing ${command} ID`);
  }

  if (positional.length > 2) {
    throw new Error(`Unexpected extra arguments: ${positional.slice(2).join(' ')}`);
  }

  validateId(id, command);

  result.command = command;
  result.id = id;
  result.output = resolveOutputDir(result.output);
  return result;
}

async function main(): Promise<void> {
  try {
    const opts = parseArgs(process.argv);

    if (opts.command === 'help') {
      printHelp();
      return;
    }

    if (opts.command === 'version') {
      console.log(VERSION);
      return;
    }

    const downloadOptions = {
      outputDir: opts.output,
      delayMs: opts.delay,
      slow: opts.slow,
      concurrency: opts.concurrency,
    };

    if (opts.command === 'novel') {
      await downloadSingleNovel(opts.id, downloadOptions);
      return;
    }

    await downloadSeries(opts.id, {
      ...downloadOptions,
      split: opts.split,
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Allow parseArgs to be imported by tests without running the CLI.
if (require.main === module) {
  main();
}
