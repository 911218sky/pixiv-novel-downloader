# Architecture

This tool does **not** scrape HTML pages. It calls the same Pixiv **AJAX JSON APIs** that the website uses in your browser, then writes the `content` field to plain-text files.

No browser or login is required for most public novels.

## Overall download flow

```mermaid
flowchart TD
    A["User runs: pixiv-novel-dl series 16474639"] --> B[CLI parses args<br/>ID / output dir / concurrency]
    B --> C["Fetch series info<br/>GET /ajax/novel/series/{id}?lang=zh"]
    C --> D["Fetch chapter list (paginated)<br/>GET /ajax/novel/series_content/{id}"]
    D --> E{More pages?}
    E -->|last_order cursor| D
    E -->|All chapters collected| F["Download chapter bodies in parallel<br/>default: 3 workers"]
    F --> G["HTTP rate limiter<br/>~2s between request starts + jitter"]
    G --> H["GET /ajax/novel/{chapterId}?lang=zh"]
    H --> I{429 / 5xx / network error?}
    I -->|Yes| J[Wait + retry + slow down]
    J --> H
    I -->|No| K[Parse JSON → title + content]
    K --> L["Write merged file in chapter order<br/>format: 10: chapter title"]
    L --> M["Output: downloads/SeriesTitle_Author.txt"]

    style A fill:#e3f2fd
    style M fill:#c8e6c9
    style G fill:#fff8e1
```

## Single novel vs series

```mermaid
flowchart LR
    subgraph novel ["novel 28400628"]
        N1[1 API call] --> N2[1 txt file]
    end

    subgraph series ["series 16474639"]
        S1[Series info] --> S2[Chapter list pages]
        S2 --> S3[Parallel chapter fetches]
        S3 --> S4[1 merged txt]
    end
```

## Series download phases

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant API as Pixiv AJAX API
    participant FS as File system

    User->>CLI: pixiv-novel-dl series 16474639
    CLI->>API: GET /ajax/novel/series/16474639
    API-->>CLI: title, author, total chapters

    loop Pagination (30 chapters per page)
        CLI->>API: GET /ajax/novel/series_content/...?last_order=N
        API-->>CLI: chapter IDs + orders
    end

    par Parallel workers (default 3)
        CLI->>API: GET /ajax/novel/{chapterId}
        API-->>CLI: JSON content
    end

    CLI->>FS: Write chapters in order to merged txt
    FS-->>User: downloads/世界分支—异形_Ruins.txt
```

## API endpoints

| Step | Endpoint | Returns |
|------|----------|---------|
| Series metadata | `/ajax/novel/series/{seriesId}?lang=zh` | Title, author, chapter count |
| Chapter list | `/ajax/novel/series_content/{seriesId}?limit=30&last_order=0&order_by=asc&lang=zh` | Chapter IDs (paginated) |
| Chapter body | `/ajax/novel/{novelId}?lang=zh` | Title, author, full text |

Required headers (same as a browser):

- `Referer`: matching Pixiv page URL
- `Accept`: `application/json`
- `User-Agent`: standard browser string

Implementation lives in `src/api.ts` and `src/http.ts`.

## Parallel downloads and rate limiting

```mermaid
flowchart TB
    subgraph workers [3 parallel workers]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end

    subgraph http [HTTP layer]
        Q[Request slot queue<br/>min ~2s between starts + jitter]
        R[429 retry with backoff]
    end

    W1 --> Q
    W2 --> Q
    W3 --> Q
    Q --> R
    R --> Pixiv[(Pixiv API)]

    Pixiv --> Write["Write to txt in chapter order"]
```

- **Fast part (parallel):** chapter body downloads run concurrently via `pool.ts` (default 3 workers).
- **Slow part (serial):** merged file is written in chapter order after all fetches complete.
- **HTTP pacing:** `http.ts` enforces a minimum interval between request starts, with random jitter.
- **429 handling:** exponential backoff retry (up to 5 attempts); interval increases after rate-limit hits.
- **`--slow` mode:** 1 worker only, longer delays — use when hitting 429.

Default values are defined in `src/constants.ts`.

## Merged file format

```
世界分支—异形
Author: Ruins

1: 前言

(chapter 1 body...)

2: 序章

(chapter 2 body...)
```

Each chapter section is `{order}: {title}` followed by the body text. Formatting logic is in `src/downloader.ts` and `src/utils.ts`.
