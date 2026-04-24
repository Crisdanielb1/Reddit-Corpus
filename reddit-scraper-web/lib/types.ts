export type DataKind = "POST" | "COMMENT";

export type ExportFormat = "csv" | "xlsx" | "txt";

export interface ScrapeRequest {
  subreddit: string;
  collectPosts: boolean;
  collectComments: boolean;
  /**
   * From (oldest). ISO `YYYY-MM-DDTHH:mm` or empty.
   * Items with `created_utc` strictly before this date are dropped.
   */
  startDate?: string;
  /**
   * To (newest). ISO `YYYY-MM-DDTHH:mm` or empty.
   * Starting point: the scraper queries backwards from here.
   */
  endDate?: string;
  /** Stop after this many posts. 0 / undefined = unlimited. */
  maxPosts?: number;
  /** Stop after this many comments. 0 / undefined = unlimited. */
  maxComments?: number;
}

export interface NormalizedRow {
  kind: DataKind;
  date: string;
  author: string;
  title: string;
  text: string;
  score: number | null;
  link_id: string;
  id: string;
  parent_id: string;
  timestamp_raw: number;
}

export type SseEventName = "log" | "stats" | "rows" | "done" | "error" | "ping";

export interface LogEvent {
  level: "info" | "warn" | "error" | "success";
  message: string;
  ts: number;
}

export interface StatsEvent {
  posts: number;
  comments: number;
}

export interface RowsEvent {
  rows: NormalizedRow[];
}

export interface ErrorEvent {
  message: string;
}
