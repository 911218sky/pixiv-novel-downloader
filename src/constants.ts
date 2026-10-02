/** Default tuning knobs for HTTP rate limiting and series download concurrency. */

/** Minimum gap between request starts in normal mode (plus random jitter). */
export const DEFAULT_REQUEST_INTERVAL_MS = 2000;
/** Request interval when `--slow` is enabled. */
export const SLOW_REQUEST_INTERVAL_MS = 4000;
/** Lower bound for `--delay`; prevents overly aggressive requests. */
export const MIN_REQUEST_INTERVAL_MS = 800;

/** Extra pause after each chapter in slow/serial mode only. */
export const SLOW_CHAPTER_COOLDOWN_MS = 2500;

/** Parallel chapter workers in normal mode. HTTP layer still throttles request starts. */
export const DEFAULT_CONCURRENCY = 3;
/** Serial downloads when `--slow` is enabled. */
export const SLOW_CONCURRENCY = 1;

/** Random delay added on top of the base interval to avoid uniform traffic patterns. */
export const JITTER_MIN_MS = 300;
export const JITTER_MAX_MS = 900;

/** Retries for 429 / 5xx / network failures. */
export const MAX_RETRIES = 5;
export const REQUEST_TIMEOUT_MS = 60_000;

/** Pixiv series list API returns up to 30 chapters per page. */
export const SERIES_PAGE_SIZE = 30;
