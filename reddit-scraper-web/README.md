# Reddit Scraper · Web

A Reddit **corpus collector** for discourse analysis, with a premium real-time
interface and one-click deployment to Vercel.

> Web version of the original `Reddit-Scrapper.py`, a Python/Tkinter desktop
> tool. The web version rewrites the scraping pipeline in TypeScript and
> serves it behind a streaming API while preserving the original behaviour.

---

## What it does

Given the name of a subreddit (for example `Ticos`, `Costa_Rica`,
`AskReddit`…), the application downloads public **posts** and/or
**comments** through the **PullPush API** and delivers them as a downloadable
file ready to be used in qualitative or quantitative discourse-analysis
tools.

Features:

- **Posts and/or comments:** can be collected separately or together. In
  combined mode, every post is downloaded along with its comments.
- **Comments-only mode:** global subreddit search, no need to pass through
  parent posts (useful when you want the raw comment corpus).
- **Optional time range:** "From" (oldest accepted date) and "To" (newest /
  starting point). Follows natural English/Spanish date-range usage:
  *from X to Y* with X earlier than Y. If left empty, scrapes from the most
  recent available data backwards.
- **Available coverage: Jun 23, 2005 – May 19, 2025.** Data comes from
  pre-built PullPush dumps, so anything past May 2025 is **not** available.
  The UI restricts the calendar to that range and the backend re-clamps any
  out-of-range request.
- **Interactive calendar:** date/time picker with month/year dropdowns and
  quick shortcuts.
- **Configurable hard limits:** maximum number of posts and/or comments;
  the run stops automatically when the limit is reached.
- **Real-time streaming:** logs, counters and rows are pushed to the browser
  as they come in, with a terminal-style console panel.
- **Stop anytime:** the connection cancels cleanly and the data already
  collected stays available for download.
- **Three export formats:**
  - **CSV** — `kind, date, author, title, text, score, link_id, id`.
    UTF-8 with BOM, opens directly in Excel.
  - **XLSX** — Excel workbook with pre-set column widths.
  - **TXT** — only the raw text content of each post/comment, separated by
    blank lines, with no metadata. Designed to feed directly into text
    analysis tools (concordancers, NLP processors, etc.).
- **Removed/deleted content is filtered out.** Posts and comments whose body
  is `[removed]`, `[deleted]` or `[removed by reddit]` are dropped from
  every export. The console reports how many were skipped per batch.
- **Split-file export.** When both *Posts* and *Comments* are selected, you
  can toggle "Split posts and comments into separate files" to download
  two independent files (e.g. `<sub>_posts.csv` and `<sub>_comments.csv`)
  instead of a single merged file.

---

## About the original script (`Reddit-Scrapper.py`)

`Reddit-Scrapper.py` is the desktop version written in Python with Tkinter.
It implements the same scraping logic and exposes a window with:

- Field for the subreddit name.
- Checkboxes to choose between posts and/or comments.
- "Desde" / "Hasta" date fields in `YYYY-MM-DD HH:MM:SS` format.
- **Iniciar descarga** / **Detener** buttons.
- An integrated console with the event log.

The script writes a `<subreddit>_data.csv` file directly to the working
directory, in *append* mode, so no data is lost if you cancel.

This web app reproduces the same flow, but:

1. Replaces Tkinter with a modern UI in Next.js (Tailwind + react-day-picker).
2. Moves the scraping pipeline to a serverless API.
3. Replaces local file writes with browser exports in CSV / XLSX / TXT.
4. Adds configurable limits, format selection, removed-content filtering and
   split-file export.

---

## Purpose

This tool is built with **educational and research purposes** in mind.

It is primarily aimed at **students and faculty of the Universidad Nacional
de Costa Rica (UNA)** working in **corpus analysis** and **discourse
analysis** courses and projects, where Reddit is a rich source of
day-to-day, conversational digital discourse.

That said, the project is **Open Source** and anyone — researcher, student,
journalist, hobbyist — is free to **use, study, modify or adapt** it as they
see fit.

---

## Credits

Created by **Christopher Brenes Fernández**.

If this tool is useful for a paper, thesis or course project, a short
acknowledgement is appreciated. It is not required, but it helps the project
grow and keep improving for the academic community.

---

## Stack

- Next.js 15 (App Router) · TypeScript
- Tailwind CSS · Lucide icons
- react-day-picker · date-fns (date/time picker)
- xlsx (Excel export, lazy-loaded)
- Streaming API (Server-Sent Events) over the Node runtime

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Deploy to Vercel

1. Push this folder to a repository (GitHub / GitLab / Bitbucket).
2. In Vercel: **Add New → Project → Import** that repository.
3. Vercel auto-detects Next.js. **No environment variables required.**
4. Deploy.

> **Execution-time note:** the `/api/scrape` route is configured with
> `maxDuration = 300` (5 min). On Vercel **Hobby** the actual cap is **60 s**;
> if your corpus is large, deploy on **Pro** or shrink the date range / set
> a limit. When the connection closes, the scraper shuts down cleanly.

## How it works

1. The client sends the configuration to `POST /api/scrape`.
2. The route opens a `ReadableStream` (SSE) and runs `runScraper`
   (`lib/scraper.ts`), which paginates against the PullPush API.
3. For each batch it emits events:
   - `log` — console messages
   - `stats` — post/comment counters
   - `rows` — normalised rows (accumulated in the browser)
   - `done` / `error`
4. The client accumulates rows in memory and builds the file when you click
   **Download**. **Nothing is persisted on the server.**

## Data coverage

Available data spans from **June 23, 2005** (Reddit's public launch) to
**May 19, 2025**. These bounds were verified empirically by querying the
minimum and maximum timestamps returned by the PullPush API.

**Why this range?** PullPush serves **consolidated dumps** of Reddit's
public archives (originally compiled by community torrents). These dumps
have a fixed cut-off date and are not refreshed in real time. Until the
provider publishes a new dump, **data past May 2025 cannot be retrieved**
through this tool.

The constraint is enforced both client-side and server-side:

- The calendar disables days before `2005-06-23` and after
  `2025-05-19 23:59`.
- If a timestamp outside the range is sent for any reason, the backend
  clamps it to the nearest bound and logs a warning.

### How "From" and "To" work

Following natural English usage ("from January 1 to January 31"):

- **From** = the **oldest** date you want to include. Items posted before
  this date are dropped.
- **To** = the **newest** date, i.e. the starting point from which the
  scraper queries backwards.

Cases:

| From | To | Behaviour |
| --- | --- | --- |
| (empty) | (empty) | From the most recent available data backwards, no old cutoff |
| (empty) | 2024-12-31 | From Dec 31, 2024 backwards, no old cutoff |
| 2024-01-01 | (empty) | From the most recent data backwards down to Jan 1, 2024 |
| 2024-01-01 | 2024-12-31 | Posts/comments between Jan 1 and Dec 31, 2024 only |

> Note: in the original script (`Reddit-Scrapper.py`) the labels were used
> the opposite way ("Desde" = newest, "Hasta" = oldest). The web version
> normalises this to natural usage; the resulting data is equivalent.

## Exported corpus schema

| Column | Description |
| --- | --- |
| `kind` | `POST` or `COMMENT` |
| `date` | `YYYY-MM-DD HH:MM:SS` (local time) |
| `author` | Reddit username |
| `title` | Post title (empty for comments) |
| `text` | Post body (`selftext`) or comment body (`body`) |
| `score` | Score at capture time |
| `link_id` | Parent-post id (useful to reconstruct threads) |
| `id` | Unique item id |

The **TXT** format drops everything else and exports only the `text` field
(falling back to `title` when the body is empty), separated by blank lines.

### Removed/deleted content

Posts and comments where the body is exactly `[removed]`, `[deleted]` or
`[removed by reddit]` (the markers Reddit/PullPush use when the original
content has been moderated or deleted) are **filtered out before export**
in every format (CSV, XLSX and TXT). The console reports the number of
skipped items per batch so you can audit what was discarded.

### Split-file export

When you collect both posts and comments at once, the resulting corpus is
mixed in a single file by default. Toggle **"Split posts and comments into
separate files"** to instead get two independent downloads in the chosen
format:

- `<sub>_<timestamp>_posts.<ext>`
- `<sub>_<timestamp>_comments.<ext>`

This is useful when you want to feed posts and comments to different
analytical pipelines without having to filter the file yourself.

## License and responsible use

Open Source. Please respect **Reddit's** and **PullPush's** terms of use,
as well as your institution's ethical guidelines for using public data.
This tool **must not** be used to collect sensitive personal data, profile
identifiable individuals without consent, or for any purpose that infringes
on the rights of the people who posted in those communities.

---

*Universidad Nacional de Costa Rica · Corpus Analysis / Discourse Analysis.*
