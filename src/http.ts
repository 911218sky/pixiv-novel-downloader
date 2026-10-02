/**
 * HTTP transport for Pixiv AJAX requests.
 *
 * - Throttles request *starts* (not full round-trip) so parallel workers can pipeline.
 * - Retries 429 / 5xx / network errors with backoff.
 * - Module-level state is intentional for CLI use (single process).
 */
import {
  DEFAULT_REQUEST_INTERVAL_MS,
  JITTER_MAX_MS,
  JITTER_MIN_MS,
  MAX_RETRIES,
  MIN_REQUEST_INTERVAL_MS,
  REQUEST_TIMEOUT_MS,
} from './constants';
import { delay } from './utils';

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'zh-CN,zh;q=0.9',
};

export interface HttpConfig {
  maxRetries: number;
}

let lastRequestAt = 0;
/** User-configured floor; adaptive slowdown never drops below this after 429. */
let baseIntervalMs = DEFAULT_REQUEST_INTERVAL_MS;
let intervalMs = DEFAULT_REQUEST_INTERVAL_MS;

function randomJitter(): number {
  return JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS + 1));
}

export function setRequestInterval(ms: number): void {
  baseIntervalMs = Math.max(MIN_REQUEST_INTERVAL_MS, ms);
  intervalMs = baseIntervalMs;
}

export function getRequestInterval(): number {
  return intervalMs;
}

/** Wait until the next request slot based on interval + jitter. */
async function waitForSlot(): Promise<void> {
  const targetInterval = intervalMs + randomJitter();
  const elapsed = Date.now() - lastRequestAt;
  const wait = targetInterval - elapsed;

  if (wait > 0) {
    await delay(wait);
  }

  lastRequestAt = Date.now();
}

function buildUrl(path: string, params?: Record<string, string | number>): string {
  const url = new URL(path, 'https://www.pixiv.net');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function parseJsonResponse<T>(response: Response, path: string): Promise<T> {
  const bodyText = await response.text();
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    const preview = bodyText.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`Invalid JSON from ${path} (HTTP ${response.status}): ${preview}`);
  }
}

export async function pixivGet<T>(
  path: string,
  referer: string,
  params?: Record<string, string | number>,
  config: Partial<HttpConfig> = {},
): Promise<T> {
  const maxRetries = config.maxRetries ?? MAX_RETRIES;
  const url = buildUrl(path, params);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await waitForSlot();

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...BASE_HEADERS, Referer: referer },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < maxRetries) {
        const backoffMs = Math.min(5000 * 2 ** attempt, 30_000);
        process.stderr.write(`\nNetwork error, retrying in ${Math.round(backoffMs / 1000)}s...\n`);
        await delay(backoffMs);
        continue;
      }
      throw error;
    }

    if (isRetryableStatus(response.status)) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
      const backoffMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : Math.min(8000 * 2 ** attempt, 90_000);

      // Slow down subsequent requests but never below the user's configured base interval.
      intervalMs = Math.max(baseIntervalMs, intervalMs + 600);

      if (attempt < maxRetries) {
        process.stderr.write(
          `\nHTTP ${response.status}, waiting ${Math.round(backoffMs / 1000)}s before retry (${attempt + 1}/${maxRetries})...\n`,
        );
        await delay(backoffMs);
        continue;
      }

      throw new Error(`HTTP ${response.status} after ${maxRetries} retries: ${path}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${path}`);
    }

    return parseJsonResponse<T>(response, path);
  }

  throw new Error(`Request failed: ${path}`);
}
