import Link from "next/link";
import Icon from "@/components/ui/Icon";

const RESOURCES = [
  {
    href: "/dashboard/curriculum",
    icon: "book",
    title: "Curriculum Guide",
    description:
      "Explore all 10 mentoring sessions across 5 phases — objectives, deliverables, prep tasks, and required documents.",
    badge: null,
    color: "text-primary",
    bg: "bg-primary-50",
  },
  // ── Upcoming resources ───────────────────────────────────────────
  {
    href: null,
    icon: "document",
    title: "Document Templates",
    description: "Ready-to-use templates for CVs, motivation letters, application trackers, and more.",
    badge: "Coming soon",
    color: "text-text-muted",
    bg: "bg-surface-elevated",
  },
  {
    href: null,
    icon: "lightbulb",
    title: "Tips & Best Practices",
    description: "Curated advice from alumni mentors on writing, interviews, and scholarship applications.",
    badge: "Coming soon",
    color: "text-text-muted",
    bg: "bg-surface-elevated",
  },
  {
    href: null,
    icon: "graduation",
    title: "University Database",
    description: "In-depth guides for top universities — requirements, deadlines, and success tips.",
    badge: "Coming soon",
    color: "text-text-muted",
    bg: "bg-surface-elevated",
  },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Resources</h1>
        <p className="text-text-muted text-sm mt-1">
          Guides, templates, and tools to support your mentoring journey
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RESOURCES.map((r) => {
          const card = (
            <div
              className={`card-hover h-full flex flex-col gap-3 ${
                r.href ? "cursor-pointer" : "opacity-60 cursor-default"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.bg}`}>
                <Icon name={r.icon} size={20} className={r.color} />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-foreground">{r.title}</h2>
                  {r.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-text-muted-2">
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">{r.description}</p>
              </div>

              {r.href && (
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  Open <Icon name="chevron-right" size={13} />
                </div>
              )}
            </div>
          );

          return r.href ? (
            <Link key={r.title} href={r.href} className="block rounded-2xl">
              {card}
            </Link>
          ) : (
            <div key={r.title}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
