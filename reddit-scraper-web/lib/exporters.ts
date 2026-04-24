import type { DataKind, ExportFormat, NormalizedRow } from "./types";

const CSV_COLUMNS = [
  "kind",
  "date",
  "author",
  "title",
  "text",
  "score",
  "link_id",
  "id",
] as const;

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(rows: NormalizedRow[]): Blob {
  const header = CSV_COLUMNS.join(",");
  const body = rows
    .map((r) =>
      CSV_COLUMNS.map((c) =>
        escapeCsv((r as unknown as Record<string, unknown>)[c])
      ).join(",")
    )
    .join("\n");
  // BOM so Excel opens it as UTF-8.
  const csv = `﻿${header}\n${body}\n`;
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export async function buildXlsx(rows: NormalizedRow[]): Promise<Blob> {
  // Lazy-load to keep the initial JS bundle small.
  const XLSX = await import("xlsx");
  const data = rows.map((r) => ({
    kind: r.kind,
    date: r.date,
    author: r.author,
    title: r.title,
    text: r.text,
    score: r.score,
    link_id: r.link_id,
    id: r.id,
  }));
  const ws = XLSX.utils.json_to_sheet(data, { header: [...CSV_COLUMNS] });
  ws["!cols"] = [
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 40 },
    { wch: 60 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reddit");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function buildTxt(rows: NormalizedRow[]): Blob {
  // Only the post/comment text content, joined by blank lines.
  // For posts, prefer the body (text); fall back to the title.
  const parts: string[] = [];
  for (const r of rows) {
    const piece = (r.text || "").trim() || (r.title || "").trim();
    if (piece) parts.push(piece);
  }
  const content = parts.join("\n\n");
  return new Blob([`﻿${content}\n`], {
    type: "text/plain;charset=utf-8",
  });
}

export async function buildExport(
  rows: NormalizedRow[],
  format: ExportFormat
): Promise<{ blob: Blob; ext: string }> {
  switch (format) {
    case "xlsx":
      return { blob: await buildXlsx(rows), ext: "xlsx" };
    case "txt":
      return { blob: buildTxt(rows), ext: "txt" };
    case "csv":
    default:
      return { blob: buildCsv(rows), ext: "csv" };
  }
}

export function filterByKind(
  rows: NormalizedRow[],
  kind: DataKind
): NormalizedRow[] {
  return rows.filter((r) => r.kind === kind);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
