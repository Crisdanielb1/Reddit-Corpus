import { runScraper } from "@/lib/scraper";
import type { ScrapeRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min on Vercel Pro; adjust if needed

function sseLine(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: Request) {
  let body: ScrapeRequest;
  try {
    body = (await req.json()) as ScrapeRequest;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const encoder = new TextEncoder();
  const ac = new AbortController();

  // Pipe client disconnect → AbortController
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Heartbeat to keep proxies/connection alive
      const heartbeat = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`);
      }, 15000);

      try {
        safeEnqueue(
          sseLine("log", {
            level: "info",
            message: `Starting r/${body.subreddit?.replace(/^r\//i, "") ?? ""}`,
            ts: Date.now(),
          })
        );

        await runScraper(
          body,
          {
            log: (level, message) =>
              safeEnqueue(
                sseLine("log", { level, message, ts: Date.now() })
              ),
            stats: (delta) => safeEnqueue(sseLine("stats", delta)),
            rows: (rows) => safeEnqueue(sseLine("rows", { rows })),
            isAborted: () => ac.signal.aborted,
          },
          ac.signal
        );

        if (!ac.signal.aborted) {
          safeEnqueue(
            sseLine("log", {
              level: "success",
              message: "Process finished.",
              ts: Date.now(),
            })
          );
          safeEnqueue(sseLine("done", { ok: true }));
        } else {
          safeEnqueue(
            sseLine("log", {
              level: "warn",
              message: "Process stopped by user.",
              ts: Date.now(),
            })
          );
          safeEnqueue(sseLine("done", { ok: false, aborted: true }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        safeEnqueue(sseLine("error", { message }));
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
