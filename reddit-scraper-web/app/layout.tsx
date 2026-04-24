import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reddit Scraper · Corpus for discourse analysis",
  description:
    "Collect public Reddit posts and comments with a premium real-time interface. Export to CSV, XLSX or TXT.",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml;utf8," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23ff8b5a'/><stop offset='1' stop-color='%23ff5a1f'/></linearGradient></defs><rect width='64' height='64' rx='14' fill='%23ffffff'/><path d='M14 38c0-9 8-16 18-16s18 7 18 16c0 9-8 14-18 14S14 47 14 38z' fill='url(%23g)'/><circle cx='24' cy='38' r='3' fill='%23ffffff'/><circle cx='40' cy='38' r='3' fill='%23ffffff'/><path d='M22 44c3 3 7 4 10 4s7-1 10-4' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round' fill='none'/></svg>`
          ),
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="app-shell">
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}
