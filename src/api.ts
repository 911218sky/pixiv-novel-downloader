/**
 * Pixiv AJAX API client.
 *
 * Endpoints used by the web UI; no login required for most public novels.
 * Required query params: lang=zh, last_order, order_by=asc (series list).
 */
import { SERIES_PAGE_SIZE } from './constants';
import { pixivGet } from './http';

const BASE_URL = 'https://www.pixiv.net';

export interface SeriesInfo {
  id: string;
  title: string;
  author: string;
  total: number;
}

export interface SeriesChapter {
  id: string;
  title: string;
  order: number;
}

export interface NovelDetail {
  id: string;
  title: string;
  author: string;
  content: string;
}

interface PixivResponse<T> {
  error: boolean;
  message: string;
  body: T;
}

interface SeriesBody {
  id: string;
  title: string;
  userName: string;
  total: number;
}

interface SeriesContentItem {
  id: string;
  /** Omitted for some R-18 entries in the list; full title comes from fetchNovel(). */
  title?: string;
  series: {
    id: number;
    contentOrder: number;
  };
}

interface SeriesContentBody {
  page: {
    seriesContents: SeriesContentItem[];
  };
}

interface NovelBody {
  id: string;
  title: string;
  userName: string;
  content: string;
}

function assertPixivBody<T>(data: PixivResponse<T>, context: string): T {
  if (data.error) {
    throw new Error(data.message || `Pixiv API error: ${context}`);
  }
  if (data.body === undefined || data.body === null) {
    throw new Error(`Pixiv API returned empty body: ${context}`);
  }
  return data.body;
}

export async function fetchSeriesInfo(seriesId: string): Promise<SeriesInfo> {
  const data = await pixivGet<PixivResponse<SeriesBody>>(
    `/ajax/novel/series/${seriesId}`,
    `${BASE_URL}/novel/series/${seriesId}`,
    { lang: 'zh' },
  );

  const body = assertPixivBody(data, `series ${seriesId}`);

  return {
    id: body.id,
    title: body.title,
    author: body.userName,
    total: body.total,
  };
}

/**
 * Paginate series chapters in ascending order.
 * Uses last_order = max contentOrder from the previous page as the cursor.
 */
export async function fetchSeriesChapters(seriesId: string, expectedTotal?: number): Promise<SeriesChapter[]> {
  const chapters: SeriesChapter[] = [];
  const seenIds = new Set<string>();
  let lastOrder = 0;
  let previousLastOrder = -1;
  const maxPages = expectedTotal ? Math.ceil(expectedTotal / SERIES_PAGE_SIZE) + 2 : 50;

  for (let page = 0; page < maxPages; page++) {
    const data = await pixivGet<PixivResponse<SeriesContentBody>>(
      `/ajax/novel/series_content/${seriesId}`,
      `${BASE_URL}/novel/series/${seriesId}`,
      {
        limit: SERIES_PAGE_SIZE,
        last_order: lastOrder,
        order_by: 'asc',
        lang: 'zh',
      },
    );

    const body = assertPixivBody(data, `series content ${seriesId}`);
    const items = body.page?.seriesContents;
    if (!items) {
      throw new Error(`Unexpected series content response for ${seriesId}`);
    }

    if (items.length === 0) {
      break;
    }

    // Guard against infinite loops if the API keeps returning the same page.
    if (lastOrder === previousLastOrder) {
      throw new Error(`Pagination stuck at last_order=${lastOrder} for series ${seriesId}`);
    }
    previousLastOrder = lastOrder;

    for (const item of items) {
      if (seenIds.has(item.id)) {
        continue;
      }
      seenIds.add(item.id);
      chapters.push({
        id: item.id,
        title: item.title ?? `chapter_${item.series.contentOrder}`,
        order: item.series.contentOrder,
      });
    }

    if (items.length < SERIES_PAGE_SIZE) {
      break;
    }

    lastOrder = Math.max(...items.map((item) => item.series.contentOrder));
  }

  return chapters.sort((a, b) => a.order - b.order);
}

export async function fetchNovel(novelId: string): Promise<NovelDetail> {
  const data = await pixivGet<PixivResponse<NovelBody>>(
    `/ajax/novel/${novelId}`,
    `${BASE_URL}/novel/show.php?id=${novelId}`,
    { lang: 'zh' },
  );

  const body = assertPixivBody(data, `novel ${novelId}`);

  return {
    id: body.id,
    title: body.title,
    author: body.userName,
    content: body.content ?? '',
  };
}
