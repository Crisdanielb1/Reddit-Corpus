import { Header } from "@/components/Header";
import { ScraperApp } from "@/components/ScraperApp";

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
      <Header />

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-line bg-white text-[0.78rem] text-muted shadow-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulseDot" />
          Real-time streaming · Export to CSV / XLSX / TXT
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight max-w-2xl text-ink">
          Build Reddit corpora with a{" "}
          <span className="bg-gradient-to-r from-[#ff8b5a] to-[#ff5a1f] bg-clip-text text-transparent">
            polished interface
          </span>
          .
        </h2>
        <p className="mt-4 text-[0.95rem] text-muted max-w-2xl leading-relaxed">
          Collect posts and comments from any public community with automatic
          pagination, configurable date ranges, hard limits and exports ready
          for discourse analysis.
        </p>
      </div>

      <ScraperApp />

      <footer className="mt-16 pt-6 border-t border-line text-xs text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p>
          Reddit Scraper · Built for academic discourse analysis. Please respect
          Reddit&apos;s and PullPush&apos;s terms of use.
        </p>
        <p className="opacity-80">
          By <strong>Christopher Brenes Fernández</strong> · Open Source
        </p>
      </footer>
    </main>
  );
}
