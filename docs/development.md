# Development Guide

Use this guide if you cloned the repo and want to run or modify the code locally.

## 1. Clone and install dependencies

```bash
git clone https://github.com/911218sky/pixiv-novel-downloader.git
cd pixiv-novel-downloader
npm install
```

`npm install` also runs `prepare`, which compiles TypeScript into `dist/`.

## 2. Build

Compile `src/` to `dist/`:

```bash
npm run build
```

Run this again after every code change.

## 3. Run directly with Node

After building, invoke the compiled CLI entry point:

```bash
# Show help
node dist/cli.js --help

# Download a series
node dist/cli.js series 16015437

# Download a single novel
node dist/cli.js novel <novel-id>

# With options
node dist/cli.js series 16015437 -o ./downloads --slow
node dist/cli.js series 16015437 --split --delay 3000
```

Shortcut via npm scripts (builds automatically):

```bash
npm run novel -- <novel-id>
npm run series -- 16015437
npm run series -- 16015437 --slow -o ./downloads
```

Or use `npm start` (pass CLI args after `--`):

```bash
npm start -- series 16015437
npm start -- --help
```

## 4. Test as a global command (optional)

Link the local project so `pixiv-novel-dl` works system-wide without reinstalling:

```bash
npm link
pixiv-novel-dl series 16015437
```

To remove the link later:

```bash
npm unlink -g pixiv-novel-downloader
```

## 5. Project layout

```
pixiv-novel-downloader/
├── src/
│   ├── cli.ts          # CLI entry point & argument parsing
│   ├── downloader.ts   # Download orchestration
│   ├── api.ts          # Pixiv AJAX API client
│   ├── http.ts         # fetch wrapper, rate limit & 429 retry
│   ├── progress.ts     # Terminal progress bar
│   ├── pool.ts         # Parallel worker pool
│   ├── constants.ts    # Default intervals & limits
│   └── utils.ts        # File I/O helpers
├── dist/               # Compiled output (generated, not committed)
├── docs/               # Developer documentation
├── downloads/          # Default output directory (gitignored)
├── package.json
├── tsconfig.json
└── LICENSE
```

## 6. Run tests

```bash
npm test
```

## 7. Typical dev workflow

```bash
# Edit files under src/
vim src/downloader.ts

# Rebuild and test
npm test

# Run and verify
node dist/cli.js series 16015437 -o /tmp/test-download

# Commit when ready
git add .
git commit -m "your message"
git push
```

## Module responsibilities

| Module | Role |
|--------|------|
| `cli.ts` | Parses `novel` / `series` subcommands and flags; dispatches to downloader |
| `downloader.ts` | Orchestrates series pagination, parallel chapter fetches, and file output |
| `api.ts` | Builds Pixiv AJAX URLs and parses JSON responses |
| `http.ts` | Shared `fetch` with request pacing, jitter, and 429/5xx retry |
| `pool.ts` | `mapConcurrent()` — limits how many chapter downloads run at once |
| `progress.ts` | Terminal progress bar |
| `constants.ts` | Default delay, concurrency, retry limits |
| `utils.ts` | Output path resolution, filename sanitization, file writes |

See [architecture.md](./architecture.md) for how these pieces connect during a download.
