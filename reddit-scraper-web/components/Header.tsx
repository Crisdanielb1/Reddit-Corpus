import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ff8b5a] to-[#ff5a1f] grid place-items-center shadow-accent">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-white"
              fill="currentColor"
              aria-hidden
            >
              <path d="M22.5 12c0-1.16-.94-2.1-2.1-2.1-.55 0-1.06.21-1.43.56-1.45-.99-3.42-1.62-5.6-1.7l1.1-3.45 3.04.7c.04.78.69 1.41 1.49 1.41.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5c-.59 0-1.1.34-1.34.84l-3.4-.78c-.18-.04-.36.07-.42.24l-1.23 3.84c-2.18.07-4.16.7-5.62 1.7-.37-.36-.88-.57-1.43-.57-1.16 0-2.1.94-2.1 2.1 0 .82.47 1.53 1.16 1.86-.03.24-.05.49-.05.74 0 3.78 4.4 6.84 9.83 6.84s9.83-3.06 9.83-6.84c0-.25-.02-.5-.06-.74.69-.33 1.16-1.04 1.16-1.86zM7.4 13.55c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm8.3 4.32c-1.05 1.05-3.05 1.13-3.7 1.13s-2.65-.08-3.7-1.13c-.16-.16-.16-.41 0-.57.16-.16.41-.16.57 0 .66.66 2.07.9 3.13.9s2.47-.24 3.13-.9c.16-.16.41-.16.57 0 .15.16.15.41 0 .57zm-.13-2.82c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-[1.15rem] font-semibold tracking-tight leading-none text-ink">
            Reddit Scraper
          </h1>
          <p className="text-[0.78rem] text-muted mt-1.5 leading-none">
            Discourse collection for corpus analysis
          </p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 text-[0.78rem] text-muted">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <span>Powered by PullPush API</span>
      </div>
    </header>
  );
}
