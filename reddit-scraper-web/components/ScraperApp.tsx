"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Database,
  Download,
  FileText,
  Hash,
  MessageSquare,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import type {
  ExportFormat,
  LogEvent,
  NormalizedRow,
  ScrapeRequest,
} from "@/lib/types";
import { LogConsole } from "./LogConsole";
import { StatsRow } from "./StatsRow";
import { DateTimePicker } from "./DateTimePicker";
import { buildExport, downloadBlob, filterByKind } from "@/lib/exporters";

type RunState = "idle" | "running" | "done" | "error";

// Real PullPush dump coverage (verified against the API):
// Jun 23, 2005 (Reddit launch) – May 19, 2025.
const DATA_MIN_DATE = new Date(2005, 5, 23, 0, 0); // Jun 23, 2005
const DATA_MAX_DATE = new Date(2025, 4, 19, 23, 59); // May 19, 2025

export function ScraperApp() {
  // Form state
  const [subreddit, setSubreddit] = useState("Ticos");
  const [collectPosts, setCollectPosts] = useState(true);
  const [collectComments, setCollectComments] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxPosts, setMaxPosts] = useState<string>("");
  const [maxComments, setMaxComments] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [splitFiles, setSplitFiles] = useState(false);

  // Run state
  const [state, setState] = useState<RunState>("idle");
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const rowsRef = useRef<NormalizedRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [state]);

  const elapsedFmt = useMemo(() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsed]);

  const canStart =
    state !== "running" && subreddit.trim() && (collectPosts || collectComments);

  const canDownload = rowsTotal > 0 && !exporting;
  const canSplit = collectPosts && collectComments;

  function pushLog(entry: LogEvent) {
    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > 500) next.shift();
      return next;
    });
  }

  function resetRun() {
    rowsRef.current = [];
    setRowsTotal(0);
    setPostsCount(0);
    setCommentsCount(0);
    setLogs([]);
    setErrorMsg(null);
    setElapsed(0);
  }

  function parseLimit(v: string): number | undefined {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.floor(n);
  }

  async function handleStart() {
    if (!canStart) return;
    resetRun();
    setState("running");
    startTimeRef.current = Date.now();

    const ac = new AbortController();
    abortRef.current = ac;

    const body: ScrapeRequest = {
      subreddit: subreddit.trim(),
      collectPosts,
      collectComments,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      maxPosts: parseLimit(maxPosts),
      maxComments: parseLimit(maxComments),
    };

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server responded ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          handleSseBlock(raw);
        }
      }
      if (buffer.trim()) handleSseBlock(buffer);

      setState((curr) => (curr === "error" ? curr : "done"));
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        pushLog({
          level: "warn",
          message: "Request cancelled locally.",
          ts: Date.now(),
        });
        setState((curr) => (curr === "error" ? curr : "done"));
      } else {
        const m = (err as Error).message;
        setErrorMsg(m);
        pushLog({ level: "error", message: m, ts: Date.now() });
        setState("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function handleSseBlock(raw: string) {
    let event: string | null = null;
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!event || dataLines.length === 0) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    switch (event) {
      case "log":
        pushLog(payload as LogEvent);
        break;
      case "stats": {
        const s = payload as { posts?: number; comments?: number };
        if (typeof s.posts === "number") setPostsCount(s.posts);
        if (typeof s.comments === "number") setCommentsCount(s.comments);
        break;
      }
      case "rows": {
        const r = (payload as { rows: NormalizedRow[] }).rows;
        if (r?.length) {
          rowsRef.current.push(...r);
          setRowsTotal(rowsRef.current.length);
        }
        break;
      }
      case "error": {
        const m = (payload as { message: string }).message;
        setErrorMsg(m);
        pushLog({ level: "error", message: m, ts: Date.now() });
        setState("error");
        break;
      }
      case "done":
        setState("done");
        break;
    }
  }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
  }

  function makeFilename(suffix: string, ext: string) {
    const safeName = subreddit.replace(/[^a-zA-Z0-9_-]/g, "_") || "reddit";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
    const tail = suffix ? `_${suffix}` : "";
    return `${safeName}_${stamp}${tail}.${ext}`;
  }

  async function handleDownload() {
    if (rowsRef.current.length === 0 || exporting) return;
    setExporting(true);
    try {
      const all = rowsRef.current;
      const splittingActive = splitFiles && canSplit;

      if (splittingActive) {
        const posts = filterByKind(all, "POST");
        const comments = filterByKind(all, "COMMENT");

        if (posts.length === 0 && comments.length === 0) {
          throw new Error("No data to export.");
        }

        if (posts.length > 0) {
          const { blob, ext } = await buildExport(posts, format);
          downloadBlob(blob, makeFilename("posts", ext));
        }
        if (comments.length > 0) {
          const { blob, ext } = await buildExport(comments, format);
          downloadBlob(blob, makeFilename("comments", ext));
        }

        const downloaded =
          (posts.length > 0 ? 1 : 0) + (comments.length > 0 ? 1 : 0);
        pushLog({
          level: "success",
          message: `Exported ${downloaded} separate file${
            downloaded === 1 ? "" : "s"
          } (${posts.length} posts / ${comments.length} comments).`,
          ts: Date.now(),
        });
      } else {
        const { blob, ext } = await buildExport(all, format);
        downloadBlob(blob, makeFilename("", ext));
      }
    } catch (e) {
      pushLog({
        level: "error",
        message: `Export failed: ${(e as Error).message}`,
        ts: Date.now(),
      });
    } finally {
      setExporting(false);
    }
  }

  function handleClear() {
    if (state === "running") return;
    resetRun();
  }

  return (
    <div className="space-y-7">
      {/* Form Card */}
      <section className="card p-6 sm:p-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Configuration
            </h2>
            <p className="text-sm text-muted mt-1">
              Pick the community, what to collect, the time window and the
              limits.
            </p>
          </div>
          <StatusPill state={state} elapsed={elapsedFmt} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Subreddit */}
          <div className="md:col-span-2">
            <FieldLabel>Community</FieldLabel>
            <div className="field-prefix">
              <span>r/</span>
              <input
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value)}
                placeholder="Ticos"
                disabled={state === "running"}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Data type */}
          <div className="md:col-span-2">
            <FieldLabel>Data to collect</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <CheckPill
                checked={collectPosts}
                onChange={setCollectPosts}
                disabled={state === "running"}
                icon={<FileText className="w-4 h-4" />}
                label="Posts"
              />
              <CheckPill
                checked={collectComments}
                onChange={setCollectComments}
                disabled={state === "running"}
                icon={<MessageSquare className="w-4 h-4" />}
                label="Comments"
              />
            </div>
            {!collectPosts && collectComments && (
              <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                Comments only: global subreddit search (no parent post).
              </p>
            )}
          </div>

          {/* Dates info */}
          <div className="md:col-span-2">
            <p className="text-xs text-muted mb-2 flex items-start gap-1.5">
              <Hash className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                Available coverage:{" "}
                <strong>Jun 23, 2005 – May 19, 2025</strong>. Data comes from
                pre-built PullPush dumps, so anything past May 2025 is not
                available. Leave both dates empty to pull from the most recent
                data backwards.
              </span>
            </p>
          </div>

          <div>
            <FieldLabel icon={<Calendar className="w-3.5 h-3.5" />}>
              From · oldest
            </FieldLabel>
            <DateTimePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="No old cutoff"
              disabled={state === "running"}
              minDate={DATA_MIN_DATE}
              maxDate={DATA_MAX_DATE}
            />
          </div>

          <div>
            <FieldLabel icon={<Calendar className="w-3.5 h-3.5" />}>
              To · newest
            </FieldLabel>
            <DateTimePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Latest available"
              disabled={state === "running"}
              minDate={DATA_MIN_DATE}
              maxDate={DATA_MAX_DATE}
            />
          </div>

          {/* Limits */}
          <div>
            <FieldLabel>Max. posts</FieldLabel>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="No limit"
              value={maxPosts}
              onChange={(e) => setMaxPosts(e.target.value)}
              disabled={state === "running" || !collectPosts}
              className="field"
            />
            {!collectPosts && (
              <p className="text-xs text-soft mt-1.5">
                Enable “Posts” to set a limit.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Max. comments</FieldLabel>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="No limit"
              value={maxComments}
              onChange={(e) => setMaxComments(e.target.value)}
              disabled={state === "running" || !collectComments}
              className="field"
            />
            {!collectComments && (
              <p className="text-xs text-soft mt-1.5">
                Enable “Comments” to set a limit.
              </p>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {state === "running" ? (
            <button onClick={handleStop} className="btn btn-danger">
              <Square className="w-4 h-4" fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="btn btn-primary"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              Start scraping
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Format
            </span>
            <FormatToggle
              value={format}
              onChange={setFormat}
              disabled={state === "running"}
            />
          </div>

          <button
            onClick={handleDownload}
            disabled={!canDownload}
            className="btn btn-secondary"
            title={
              canDownload
                ? splitFiles && canSplit
                  ? `Download two .${format} files`
                  : `Download .${format}`
                : "No data yet"
            }
          >
            <Download className="w-4 h-4" />
            {exporting
              ? "Exporting…"
              : splitFiles && canSplit
              ? `Download .${format} ×2`
              : `Download .${format}`}
            {rowsTotal > 0 && !exporting && (
              <span className="ml-1 text-xs text-muted font-normal">
                ({rowsTotal})
              </span>
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={state === "running" || (logs.length === 0 && rowsTotal === 0)}
            className="btn btn-ghost"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Split files toggle */}
        {canSplit && (
          <div className="mt-4 flex items-start gap-2.5 text-sm">
            <label
              className="check !py-2 !px-3"
              data-checked={splitFiles ? "true" : "false"}
              style={{ opacity: state === "running" ? 0.55 : 1 }}
            >
              <input
                type="checkbox"
                checked={splitFiles}
                disabled={state === "running"}
                onChange={(e) => setSplitFiles(e.target.checked)}
              />
              <span className="text-ink font-medium">
                Split posts and comments into separate files
              </span>
            </label>
          </div>
        )}

        {format === "txt" && (
          <p className="mt-3 text-xs text-muted flex items-start gap-1.5">
            <Hash className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              The <strong>.txt</strong> format exports only the raw text body
              of each post/comment, with no date, author or other metadata.
            </span>
          </p>
        )}
      </section>

      {/* Stats */}
      <StatsRow
        posts={postsCount}
        comments={commentsCount}
        total={rowsTotal}
        elapsed={elapsedFmt}
      />

      {/* Console */}
      <section>
        <div className="section-title">
          <Database className="w-3.5 h-3.5 text-accent" />
          Process log
        </div>
        <LogConsole logs={logs} running={state === "running"} />
        {errorMsg && (
          <p className="mt-3 text-sm text-danger">
            <span className="font-semibold">Error:</span> {errorMsg}
          </p>
        )}
      </section>
    </div>
  );
}

function FieldLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted mb-1.5 uppercase tracking-wider">
      {icon}
      {children}
    </label>
  );
}

function StatusPill({ state, elapsed }: { state: RunState; elapsed: string }) {
  const map: Record<
    RunState,
    { label: string; tag: "idle" | "running" | "done" | "error" }
  > = {
    idle: { label: "Ready", tag: "idle" },
    running: { label: `Running · ${elapsed}`, tag: "running" },
    done: { label: "Completed", tag: "done" },
    error: { label: "Error", tag: "error" },
  };
  const cfg = map[state];
  return (
    <span className="pill" data-state={cfg.tag}>
      <span className="dot" />
      {cfg.label}
    </span>
  );
}

function CheckPill({
  checked,
  onChange,
  disabled,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label
      className="check"
      data-checked={checked ? "true" : "false"}
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-muted">{icon}</span>
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

function FormatToggle({
  value,
  onChange,
  disabled,
}: {
  value: ExportFormat;
  onChange: (v: ExportFormat) => void;
  disabled?: boolean;
}) {
  const opts: { id: ExportFormat; label: string }[] = [
    { id: "csv", label: "CSV" },
    { id: "xlsx", label: "XLSX" },
    { id: "txt", label: "TXT" },
  ];
  return (
    <div className="segmented" role="tablist" aria-label="Export format">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          data-active={value === o.id ? "true" : "false"}
          disabled={disabled}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
