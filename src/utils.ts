/**
 * Path helpers and plain-text file writers.
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

/** Expand ~ and resolve to an absolute path. */
export function resolveOutputDir(dir: string): string {
  const trimmed = dir.trim();
  if (!trimmed) {
    throw new Error('Output directory cannot be empty');
  }

  const expanded = trimmed.startsWith('~/') || trimmed === '~'
    ? path.join(os.homedir(), trimmed.slice(1))
    : trimmed;
  return path.resolve(expanded);
}

/** Strip characters that are invalid on common filesystems. */
export function sanitizeFileName(name: string): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim();
  return sanitized || 'untitled';
}

export function buildSeriesDirName(title: string, author: string): string {
  return `${sanitizeFileName(title)}_${sanitizeFileName(author)}`;
}

export function formatNovelHeader(title: string, author: string): string {
  return `${title}\nAuthor: ${author}\n\n`;
}

/** Merged series format: "10: chapter title" followed by body text. */
export function formatChapterSection(order: number, title: string, content: string): string {
  return `\n${order}: ${title}\n\n${content}`;
}

export async function saveChapter(
  outputDir: string,
  order: number,
  title: string,
  author: string,
  content: string,
  novelId: string,
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const orderPrefix = String(order).padStart(4, '0');
  // Include novelId to avoid overwriting when two chapters share a title.
  const fileName = `${orderPrefix}_${sanitizeFileName(title)}_${novelId}.txt`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, formatNovelHeader(title, author) + content, 'utf8');
  return filePath;
}

export async function saveSingleNovel(
  outputDir: string,
  title: string,
  author: string,
  content: string,
  novelId: string,
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `${sanitizeFileName(title)}_${novelId}.txt`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, formatNovelHeader(title, author) + content, 'utf8');
  return filePath;
}

/** Open a merged series file and write the header; caller appends chapters then closes. */
export async function openMergedNovel(
  outputDir: string,
  seriesTitle: string,
  author: string,
): Promise<{ filePath: string; handle: fs.FileHandle }> {
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `${sanitizeFileName(seriesTitle)}_${sanitizeFileName(author)}.txt`;
  const filePath = path.join(outputDir, fileName);
  const handle = await fs.open(filePath, 'w');
  await handle.write(formatNovelHeader(seriesTitle, author));
  return { filePath, handle };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
