import { FileText, MessageSquare, Layers, Timer } from "lucide-react";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

interface Props {
  posts: number;
  comments: number;
  total: number;
  elapsed: string;
}

export function StatsRow({ posts, comments, total, elapsed }: Props) {
  const items = [
    {
      label: "Posts",
      value: formatNumber(posts),
      icon: <FileText className="w-4 h-4" />,
      glow: "rgba(255, 90, 31, 0.16)",
    },
    {
      label: "Comments",
      value: formatNumber(comments),
      icon: <MessageSquare className="w-4 h-4" />,
      glow: "rgba(99, 102, 241, 0.14)",
    },
    {
      label: "Total rows",
      value: formatNumber(total),
      icon: <Layers className="w-4 h-4" />,
      glow: "rgba(34, 197, 94, 0.14)",
    },
    {
      label: "Elapsed",
      value: elapsed,
      icon: <Timer className="w-4 h-4" />,
      glow: "rgba(245, 158, 11, 0.14)",
    },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="stat"
          style={{ ["--stat-glow" as string]: it.glow }}
        >
          <div className="flex items-center justify-between">
            <span className="stat-label">{it.label}</span>
            <span className="text-soft">{it.icon}</span>
          </div>
          <div className="stat-value">{it.value}</div>
        </div>
      ))}
    </section>
  );
}
