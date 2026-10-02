# pixiv-novel-downloader

> Command-line tool to download Pixiv novels and series as plain-text files.

Download an entire series into one merged `.txt`, or grab a single chapter by ID.  
No browser required. Zero runtime dependencies — uses Node.js built-in `fetch`.

**Example:** [ペンは剣より強し](https://www.pixiv.net/novel/series/16015437) → `pixiv-novel-dl series 16015437`

## Features

- Download a single novel or an entire series by Pixiv ID
- Merge all chapters into one file by default (`--split` for separate files)
- Rate limiting with jitter, 429 auto-retry, and `--slow` mode
- Progress bar for series downloads
- Install globally via npm or directly from GitHub

## Requirements

- Node.js >= 18

## Install

### Global install (recommended)

Install from the project directory:

```bash
git clone https://github.com/911218sky/pixiv-novel-downloader.git
cd pixiv-novel-downloader
npm install -g .
```

After installation, use the `pixiv-novel-dl` command anywhere:

```bash
pixiv-novel-dl --help
```

### Install from GitHub

Install directly from the repository (no clone needed):

```bash
npm install -g git+https://github.com/911218sky/pixiv-novel-downloader.git
```

Install a specific branch or tag:

```bash
npm install -g git+https://github.com/911218sky/pixiv-novel-downloader.git#main
npm install -g git+https://github.com/911218sky/pixiv-novel-downloader.git#v1.1.0
```

Shorthand syntax:

```bash
npm install -g github:911218sky/pixiv-novel-downloader
```

## Usage

### Find IDs from Pixiv URLs

| URL | ID to use |
|-----|-----------|
| `https://www.pixiv.net/novel/series/16015437` | series ID: `16015437` |
| `https://www.pixiv.net/novel/show.php?id=12345678` | novel ID: `12345678` |

### Download a series (merged into one file)

Example series: [**ペンは剣より強し**](https://www.pixiv.net/novel/series/16015437) by ぼっち

```bash
pixiv-novel-dl series 16015437
```

Output:

```
downloads/ペンは剣より強し_ぼっち.txt
```

### Download a single chapter

Open any chapter in the series, copy the novel ID from the URL, then:

```bash
pixiv-novel-dl novel <novel-id>
```

### Save each chapter as a separate file

```bash
pixiv-novel-dl series 16015437 --split
```

### Custom output directory

Use `-o` or `--output` to choose where files are saved. Supports absolute paths, relative paths, and `~`:

```bash
# After the ID
pixiv-novel-dl series 16015437 -o ~/Downloads/novels
pixiv-novel-dl novel 12345678 --output /tmp/my-novels

# Before the ID also works
pixiv-novel-dl series -o ./output 16015437
```

Files are written to the directory you specify (created automatically if it does not exist).

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./downloads` |
| `--split` | Also save each chapter as its own file | off |
| `--delay <ms>` | Base interval between API requests | `2000` |
| `--concurrency <n>` | Parallel chapter downloads (1–10) | `3` |
| `--slow` | Serial mode (1 worker, longer delays) | off |

If you hit Pixiv rate limits (HTTP 429), use `--slow` or increase `--delay`:

```bash
pixiv-novel-dl series 16015437 --slow
pixiv-novel-dl series 16015437 --delay 3000
pixiv-novel-dl series 16015437 --concurrency 2
```

## Output layout

### Default (merged only)

```
downloads/
└── ペンは剣より強し_ぼっち.txt
```

### With `--split`

```
downloads/
├── ペンは剣より強し_ぼっち.txt
└── ペンは剣より強し_ぼっち/
    ├── 001_Chapter title.txt
    ├── 002_Chapter title.txt
    └── ...
```

## Developer documentation

See [docs/](./docs/) for architecture diagrams, API details, and local development setup.

## Disclaimer

For personal and educational use only. Respect authors' copyrights. Do not use for commercial purposes or large-scale scraping. All downloaded content belongs to its original creators.

## License

Licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).  
See [LICENSE](LICENSE) for the full license text.
