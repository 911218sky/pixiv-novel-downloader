# Developer Documentation

Documentation for contributors and anyone who wants to understand how this project works internally.

| Document | Description |
|----------|-------------|
| [development.md](./development.md) | Local setup, build, test, and project layout |
| [architecture.md](./architecture.md) | Download flow, API endpoints, concurrency, rate limiting |

## Quick orientation

```
src/cli.ts          → CLI entry point & argument parsing
src/downloader.ts   → Download orchestration (series / single novel)
src/api.ts          → Pixiv AJAX API client
src/http.ts         → fetch wrapper, rate limit & 429 retry
src/progress.ts     → Terminal progress bar
src/pool.ts         → Parallel worker pool
src/constants.ts    → Default intervals & limits
src/utils.ts        → File I/O helpers
```

Start with [architecture.md](./architecture.md) for the end-to-end flow, then [development.md](./development.md) to run and modify the code locally.
