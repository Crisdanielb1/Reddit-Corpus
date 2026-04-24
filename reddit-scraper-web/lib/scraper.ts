import type {
  DataKind,
  NormalizedRow,
  ScrapeRequest,
} from "./types";

const PULLPUSH_BASE = "https://api.pullpush.io/reddit/search";
const POST_BATCH_SIZE = 50;
const COMMENT_BATCH_SIZE = 500;
const GLOBAL_BATCH_SIZE = 100;
const POST_DELAY_MS = 350;
const RETRY_DELAY_MS = 5000;

// PullPush dump coverage (verified empirically against the API):
// from 2005-06-23 (first Reddit post ever) to 2025-05-19. These bounds
// are enforced both in the UI and re-clamped here as a safety net.
const DATA_MIN_UTC = Math.floor(Date.UTC(2005, 5, 23, 0, 0, 0) / 1000);
const DATA_MAX_UTC = Math.floor(Date.UTC(2025, 4, 19, 23, 59, 59) / 1000);

export interface ScrapeCallbacks {
  log: (level: "info" | "warn" | "error" | "success", message: string) => void;
  stats: (delta: { posts?: number; comments?: number }) => void;
  rows: (rows: NormalizedRow[]) => void;
  isAborted: () => boolean;
}

interface PullPushItem {
  id?: string;
  link_id?: string;
  parent_id?: string;
  author?: string;
  title?: string;
  selftext?: string;
  body?: string;
  score?: number;
  created_utc?: number;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * True when the item was removed by a moderator/admin or deleted by its
 * author. PullPush returns the marker text in `body` (comments) or
 * `selftext` (posts); the original content is gone, so we drop these from
 * every export (CSV, XLSX, TXT).
 */
function isRemovedOrDeleted(item: PullPushItem): boolean {
  const raw = (item.body ?? item.selftext ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return (
    lower === "[removed]" ||
    lower === "[deleted]" ||
    lower === "[removed by reddit]" ||
    lower === "[ removed by reddit ]"
  );
}

function dropRemoved(
  items: PullPushItem[],
  cb: ScrapeCallbacks | null,
  label: "post" | "comment"
): PullPushItem[] {
  const kept = items.filter((it) => !isRemovedOrDeleted(it));
  const dropped = items.length - kept.length;
  if (dropped > 0 && cb) {
    const plural = dropped === 1 ? "" : "s";
    cb.log(
      "info",
      `Skipped ${dropped} ${label}${plural} marked [removed]/[deleted].`
    );
  }
  return kept;
}

function normalize(items: PullPushItem[], kind: DataKind): NormalizedRow[] {
  return items.map((item) => {
    const ts = item.created_utc ?? 0;
    return {
      kind,
      date: ts ? fmtDate(ts) : "",
      author: item.author ?? "",
      title: item.title ?? "",
      text: item.body ?? item.selftext ?? "",
      score: typeof item.score === "number" ? item.score : null,
      link_id: item.link_id ?? item.id ?? "",
      id: item.id ?? "",
      parent_id: item.parent_id ?? "",
      timestamp_raw: ts,
    };
  });
}

async function fetchJson(
  url: string,
  params: Record<string, string | number>,
  signal: AbortSignal
): Promise<{ ok: boolean; status: number; data: PullPushItem[] }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${url}?${qs.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { ok: false, status: res.status, data: [] };
  const json = (await res.json()) as { data?: PullPushItem[] };
  return { ok: true, status: res.status, data: json.data ?? [] };
}

function isoToUtcSeconds(s?: string): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return undefined;
  return Math.floor(t / 1000);
}

function normalizeLimit(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export async function runScraper(
  req: ScrapeRequest,
  cb: ScrapeCallbacks,
  signal: AbortSignal
): Promise<void> {
  const subreddit = req.subreddit.replace(/^r\//i, "").trim();
  if (!subreddit) {
    cb.log("error", "Empty subreddit.");
    return;
  }

  // startDate (From) = OLDER bound.
  // endDate   (To)   = NEWER bound, the starting point for backwards paging.
  let oldestTs = isoToUtcSeconds(req.startDate);
  let newestTs = isoToUtcSeconds(req.endDate);
  const maxPosts = normalizeLimit(req.maxPosts);
  const maxComments = normalizeLimit(req.maxComments);

  // Clamp newestTs to the available range. If absent, default to the most
  // recent dump timestamp (NOT Date.now(), since 2026+ has no data).
  if (newestTs == null) {
    newestTs = DATA_MAX_UTC;
  } else {
    if (newestTs > DATA_MAX_UTC) {
      cb.log(
        "warn",
        "'To' is past May 2025. Adjusted to the latest available data."
      );
      newestTs = DATA_MAX_UTC;
    }
    if (newestTs < DATA_MIN_UTC) {
      cb.log("warn", "'To' is before Jun 2005. Adjusted to the earliest data.");
      newestTs = DATA_MIN_UTC;
    }
  }

  if (oldestTs != null) {
    if (oldestTs < DATA_MIN_UTC) {
      cb.log(
        "warn",
        "'From' is before Jun 2005. Adjusted to the earliest data."
      );
      oldestTs = DATA_MIN_UTC;
    }
    if (oldestTs > DATA_MAX_UTC) {
      cb.log(
        "warn",
        "'From' is past May 2025. Adjusted to the latest available data."
      );
      oldestTs = DATA_MAX_UTC;
    }
  }

  // If user inverted the dates, swap automatically.
  if (oldestTs != null && oldestTs > newestTs) {
    cb.log(
      "warn",
      "Dates inverted: 'From' is after 'To'. Swapping automatically."
    );
    const tmp = oldestTs;
    oldestTs = newestTs;
    newestTs = tmp;
  }

  if (maxPosts) cb.log("info", `Post limit: ${maxPosts}`);
  if (maxComments) cb.log("info", `Comment limit: ${maxComments}`);

  if (req.collectPosts) {
    await processSequential(
      subreddit,
      newestTs,
      oldestTs,
      req.collectComments,
      maxPosts,
      maxComments,
      cb,
      signal
    );
  } else if (req.collectComments) {
    await downloadEndpoint(
      "comment",
      subreddit,
      newestTs,
      oldestTs,
      maxComments,
      cb,
      signal
    );
  } else {
    cb.log("warn", "No data type selected.");
  }
}

async function processSequential(
  subreddit: string,
  newestTs: number,
  oldestTs: number | undefined,
  alsoComments: boolean,
  maxPosts: number | undefined,
  maxComments: number | undefined,
  cb: ScrapeCallbacks,
  signal: AbortSignal
) {
  const url = `${PULLPUSH_BASE}/submission`;
  let before = newestTs;
  let totalPosts = 0;
  let totalComments = 0;

  const postsDone = () =>
    typeof maxPosts === "number" && totalPosts >= maxPosts;
  const commentsDone = () =>
    typeof maxComments === "number" && totalComments >= maxComments;

  while (!cb.isAborted()) {
    if (postsDone()) {
      cb.log("info", `Post limit (${maxPosts}) reached.`);
      break;
    }

    cb.log(
      "info",
      `Searching posts before ${fmtDate(before)} in r/${subreddit}…`
    );

    let resp;
    try {
      resp = await fetchJson(
        url,
        {
          subreddit,
          size: POST_BATCH_SIZE,
          before,
          sort: "desc",
          sort_type: "created_utc",
        },
        signal
      );
    } catch (err) {
      if (signal.aborted) return;
      cb.log("warn", `Network error: ${(err as Error).message}. Retrying…`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    if (!resp.ok) {
      cb.log("warn", `API ${resp.status}. Retrying in 5s…`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    let data = resp.data;
    if (data.length === 0) {
      cb.log("info", "No more posts.");
      break;
    }

    if (oldestTs != null) {
      data = data.filter((it) => (it.created_utc ?? 0) >= oldestTs);
      if (data.length === 0) {
        cb.log("info", "'From' date reached (no more posts in range).");
        break;
      }
    }

    // Drop [removed]/[deleted] posts entirely.
    data = dropRemoved(data, cb, "post");

    let limitHit = false;
    for (const post of data) {
      if (cb.isAborted()) return;
      if (postsDone()) {
        limitHit = true;
        break;
      }

      const row = normalize([post], "POST");
      cb.rows(row);
      totalPosts += 1;
      cb.stats({ posts: totalPosts });

      if (alsoComments && post.id && !commentsDone()) {
        const remaining = maxComments
          ? maxComments - totalComments
          : undefined;
        const titleShort = (post.title ?? "Untitled").slice(0, 40);
        cb.log("info", `Post: "${titleShort}…" → fetching comments…`);
        const n = await downloadCommentsForPost(
          post.id,
          remaining,
          cb,
          signal
        );
        totalComments += n;
        cb.stats({ comments: totalComments });
      }

      await sleep(POST_DELAY_MS);

      if (postsDone()) {
        limitHit = true;
        break;
      }
    }

    if (limitHit) {
      cb.log("info", `Post limit (${maxPosts}) reached.`);
      break;
    }

    const lastTs = resp.data[resp.data.length - 1]?.created_utc;
    if (!lastTs) break;
    before = lastTs;

    cb.log(
      "success",
      `Batch done · ${totalPosts} posts · ${totalComments} comments`
    );

    if (oldestTs != null && lastTs <= oldestTs) {
      cb.log("info", "'From' date reached.");
      break;
    }
  }
}

async function downloadCommentsForPost(
  linkId: string,
  remaining: number | undefined,
  cb: ScrapeCallbacks,
  signal: AbortSignal
): Promise<number> {
  if (typeof remaining === "number" && remaining <= 0) return 0;
  const url = `${PULLPUSH_BASE}/comment`;
  try {
    const resp = await fetchJson(
      url,
      {
        link_id: linkId,
        size: COMMENT_BATCH_SIZE,
        sort: "desc",
        sort_type: "created_utc",
      },
      signal
    );
    if (resp.ok && resp.data.length) {
      // Silently drop [removed]/[deleted] for per-post comments to avoid
      // log spam. Batch endpoint logs the count.
      let trimmed = resp.data.filter((it) => !isRemovedOrDeleted(it));
      if (typeof remaining === "number" && trimmed.length > remaining) {
        trimmed = trimmed.slice(0, remaining);
      }
      const rows = normalize(trimmed, "COMMENT");
      if (rows.length === 0) return 0;
      cb.rows(rows);
      return rows.length;
    }
  } catch {
    /* swallow */
  }
  return 0;
}

async function downloadEndpoint(
  endpoint: "submission" | "comment",
  subreddit: string,
  newestTs: number,
  oldestTs: number | undefined,
  maxItems: number | undefined,
  cb: ScrapeCallbacks,
  signal: AbortSignal
) {
  const url = `${PULLPUSH_BASE}/${endpoint}`;
  const label: DataKind = endpoint === "submission" ? "POST" : "COMMENT";
  const labelLower = endpoint === "submission" ? "post" : "comment";
  let before = newestTs;
  let total = 0;

  const limitHit = () => typeof maxItems === "number" && total >= maxItems;

  while (!cb.isAborted()) {
    if (limitHit()) {
      cb.log("info", `Limit (${maxItems}) reached for ${labelLower}s.`);
      break;
    }

    let resp;
    try {
      resp = await fetchJson(
        url,
        {
          subreddit,
          size: GLOBAL_BATCH_SIZE,
          before,
          sort: "desc",
          sort_type: "created_utc",
        },
        signal
      );
    } catch (err) {
      if (signal.aborted) return;
      cb.log("warn", `Network error: ${(err as Error).message}`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    if (!resp.ok) {
      cb.log("warn", `API ${resp.status}. Pausing for 5s…`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    let data = resp.data;
    if (data.length === 0) {
      cb.log("info", `No more ${labelLower}s.`);
      break;
    }

    if (oldestTs != null) {
      data = data.filter((it) => (it.created_utc ?? 0) >= oldestTs);
      if (data.length === 0) {
        cb.log("info", `'From' date reached (${labelLower}s).`);
        break;
      }
    }

    // Drop [removed]/[deleted] entries.
    data = dropRemoved(data, cb, labelLower);

    if (typeof maxItems === "number") {
      const remaining = maxItems - total;
      if (data.length > remaining) data = data.slice(0, remaining);
    }

    const rows = normalize(data, label);
    if (rows.length) cb.rows(rows);
    total += rows.length;
    if (label === "POST") cb.stats({ posts: total });
    else cb.stats({ comments: total });

    const lastTs = resp.data[resp.data.length - 1]?.created_utc;
    if (!lastTs) break;
    before = lastTs;

    cb.log("success", `Buffer ${labelLower}s: ${total} total`);

    if (limitHit()) {
      cb.log("info", `Limit (${maxItems}) reached for ${labelLower}s.`);
      break;
    }

    if (oldestTs != null && lastTs <= oldestTs) {
      cb.log("info", `'From' date reached (${labelLower}s).`);
      break;
    }
    await sleep(900);
  }
}
