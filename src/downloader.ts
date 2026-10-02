/**
 * Download orchestration: single novel or full series.
 *
 * Series flow:
 * 1. Fetch metadata + chapter list (serial)
 * 2. Download chapter bodies in parallel (HTTP layer throttles request starts)
 * 3. Write merged/split files in chapter order (serial)
 */
import * as path from 'path';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_REQUEST_INTERVAL_MS,
  SLOW_CHAPTER_COOLDOWN_MS,
  SLOW_CONCURRENCY,
  SLOW_REQUEST_INTERVAL_MS,
} from './constants';
import { fetchNovel, fetchSeriesChapters, fetchSeriesInfo } from './api';
import type { SeriesChapter } from './api';
import { setRequestInterval } from './http';
import { mapConcurrent } from './pool';
import { finishProgress, showProgress } from './progress';
import {
  buildSeriesDirName,
  delay,
  formatChapterSection,
  openMergedNovel,
  resolveOutputDir,
  saveChapter,
  saveSingleNovel,
} from './utils';

export interface DownloadOptions {
  outputDir?: string;
  split?: boolean;
  delayMs?: number;
  slow?: boolean;
  concurrency?: number;
}

export interface SeriesDownloadResult {
  savedFiles: string[];
  failedCount: number;
}

interface ChapterDownloadResult {
  chapter: SeriesChapter;
  title: string;
  author: string;
  content: string;
  novelId: string;
}

interface ChapterDownloadFailure {
  chapter: SeriesChapter;
  error: string;
}

export async function downloadSingleNovel(
  novelId: string,
  options: DownloadOptions = {},
): Promise<string> {
  const outputDir = resolveOutputDir(options.outputDir ?? './downloads');
  const requestInterval = resolveRequestInterval(options);

  setRequestInterval(requestInterval);

  console.log(`Downloading novel ID: ${novelId}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Request interval: ~${requestInterval}ms (+ jitter)\n`);
  showProgress(0, 1, 'Fetching content...');

  const novel = await fetchNovel(novelId);
  if (!novel.content) {
    throw new Error(`Novel ${novelId} has empty content`);
  }

  showProgress(1, 1, novel.title);

  const filePath = await saveSingleNovel(outputDir, novel.title, novel.author, novel.content, novel.id);
  finishProgress(`Done: ${novel.title}\nSaved to: ${filePath}`);
  return filePath;
}

export async function downloadSeries(
  seriesId: string,
  options: DownloadOptions = {},
): Promise<SeriesDownloadResult> {
  const outputDir = resolveOutputDir(options.outputDir ?? './downloads');
  const split = options.split ?? false;
  const slow = options.slow ?? false;
  const requestInterval = resolveRequestInterval(options);
  const concurrency = resolveConcurrency(options);
  const chapterCooldownMs = slow ? SLOW_CHAPTER_COOLDOWN_MS : 0;

  setRequestInterval(requestInterval);

  console.log(`Fetching series ID: ${seriesId}`);
  console.log(`Output directory: ${outputDir}`);
  const series = await fetchSeriesInfo(seriesId);
  const chapters = await fetchSeriesChapters(seriesId, series.total);

  console.log(`Series: ${series.title} / ${series.author}`);
  console.log(`Chapters: ${chapters.length} (API total: ${series.total})`);

  if (chapters.length !== series.total) {
    console.warn(`Warning: expected ${series.total} chapters but found ${chapters.length}`);
  }

  console.log(split ? 'Mode: merged + split files' : 'Mode: merged file only');
  console.log(`Request interval: ~${requestInterval}ms (+ jitter)`);
  console.log(`Concurrency: ${concurrency}${slow ? ' (slow mode)' : ''}\n`);

  const seriesDir = path.join(outputDir, buildSeriesDirName(series.title, series.author));
  const savedFiles: string[] = [];
  let completed = 0;

  const { filePath: mergedPath, handle: mergedHandle } = await openMergedNovel(
    outputDir,
    series.title,
    series.author,
  );
  savedFiles.push(mergedPath);

  // Phase 1: parallel fetch (order not preserved in completion time).
  const downloadResults = await mapConcurrent(
    chapters,
    concurrency,
    async (chapter) => downloadChapter(chapter, chapterCooldownMs),
  );

  const successes: ChapterDownloadResult[] = [];
  const failed: ChapterDownloadFailure[] = [];

  for (const result of downloadResults) {
    completed++;
    if (result.ok) {
      successes.push(result.value);
      showProgress(completed, chapters.length, result.value.title);
    } else {
      failed.push(result.failure);
      showProgress(completed, chapters.length, `Failed: ${result.failure.chapter.title}`);
    }
  }

  // Phase 2: write files in chapter order.
  try {
    for (const item of successes.sort((a, b) => a.chapter.order - b.chapter.order)) {
      if (split) {
        const filePath = await saveChapter(
          seriesDir,
          item.chapter.order,
          item.title,
          item.author,
          item.content,
          item.novelId,
        );
        savedFiles.push(filePath);
      }

      await mergedHandle.write(
        formatChapterSection(item.chapter.order, item.title, item.content),
      );
    }
  } finally {
    await mergedHandle.close();
  }

  finishProgress(`Merged file: ${mergedPath}`);
  console.log(`\nDone: ${successes.length}/${chapters.length} chapters saved, ${savedFiles.length} file(s) written`);

  if (failed.length > 0) {
    console.log('\nFailed chapters:');
    for (const item of failed.sort((a, b) => a.chapter.order - b.chapter.order)) {
      console.log(`  ${item.chapter.order}: ${item.chapter.title} (${item.chapter.id}): ${item.error}`);
    }
    throw new Error(`Failed to download ${failed.length} chapter(s)`);
  }

  return { savedFiles, failedCount: failed.length };
}

type DownloadChapterResult =
  | { ok: true; value: ChapterDownloadResult }
  | { ok: false; failure: ChapterDownloadFailure };

async function downloadChapter(
  chapter: SeriesChapter,
  cooldownMs: number,
): Promise<DownloadChapterResult> {
  try {
    const novel = await fetchNovel(chapter.id);
    if (!novel.content) {
      throw new Error('Empty content');
    }

    // Extra pause only in slow/serial mode; normal mode relies on HTTP throttling.
    if (cooldownMs > 0) {
      await delay(cooldownMs);
    }

    return {
      ok: true,
      value: {
        chapter,
        title: novel.title,
        author: novel.author,
        content: novel.content,
        novelId: novel.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      failure: {
        chapter,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function resolveRequestInterval(options: DownloadOptions): number {
  if (options.slow) {
    return SLOW_REQUEST_INTERVAL_MS;
  }

  return options.delayMs ?? DEFAULT_REQUEST_INTERVAL_MS;
}

function resolveConcurrency(options: DownloadOptions): number {
  if (options.slow) {
    return SLOW_CONCURRENCY;
  }

  return options.concurrency ?? DEFAULT_CONCURRENCY;
}
