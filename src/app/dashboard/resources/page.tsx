"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useUser } from "@/lib/hooks";

interface ResourceCard {
  href: string | null;
  icon: string;
  title: string;
  description: string;
  badge: string | null;
  note: string | null;
  color: string;
  bg: string;
  roles: string[] | null; // null = all roles
}

const ALL_RESOURCES: ResourceCard[] = [
  {
    href: "/dashboard/curriculum",
    icon: "book",
    title: "Curriculum Guide",
    description:
      "Explore all 10 mentoring sessions across 5 phases — objectives, deliverables, prep tasks, and required documents.",
    badge: null,
    note: null,
    color: "text-primary",
    bg: "bg-primary-50",
    roles: null,
  },
  {
    href: "/dashboard/mentor-toolkit",
    icon: "graduation",
    title: "Mentor Toolkit",
    description:
      "A comprehensive guide to mindset, methodology, and best practices for mentors — from understanding mentee psychology to running effective sessions.",
    badge: null,
    note: "Visible to mentors & admins only",
    color: "text-text-purple",
    bg: "bg-surface-purple",
    roles: ["mentor", "admin"],
  },
  {
    href: "/dashboard/mentee-journey",
    icon: "map",
    title: "Mentee Registration Journey",
    description:
      "Swim lane diagram of the 5 stages, 14 core steps, and 4 add-ons from a mentee's first touch with Satu Tuju to the formal handover into the mentor's hands.",
    badge: null,
    note: "Visible to mentors & admins only",
    color: "text-primary",
    bg: "bg-primary-50",
    roles: ["mentor", "admin"],
  },
  {
    href: null,
    icon: "document",
    title: "Document Templates",
    description: "Ready-to-use templates for CVs, motivation letters, application trackers, and more.",
    badge: "Coming soon",
    note: null,
    color: "text-text-muted",
    bg: "bg-surface-elevated",
    roles: null,
  },
  {
    href: null,
    icon: "star",
    title: "1000 Winning Scholarship Essays",
    description: "A curated collection of real essays that secured top scholarships — study what works and inspire your own writing.",
    badge: "Coming soon",
    note: null,
    color: "text-text-muted",
    bg: "bg-surface-elevated",
    roles: null,
  },
];

export default function ResourcesPage() {
  const { user } = useUser();
  const role = user?.role ?? "mentee";

  const visibleResources = ALL_RESOURCES.filter(
    (r) => r.roles === null || r.roles.includes(role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Resources</h1>
        <p className="text-text-muted text-sm mt-1">
          Guides, templates, and tools to support your mentoring journey
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleResources.map((r) => {
          const card = (
            <div
              className={`card-hover h-full flex flex-col gap-4 ${
                r.href ? "cursor-pointer" : "opacity-60 cursor-default"
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${r.bg}`}>
                <Icon name={r.icon} size={22} className={r.color} />
              </div>

              <div className="flex-1">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-foreground leading-snug">{r.title}</h2>
                  {r.badge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-text-muted-2 whitespace-nowrap">
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{r.description}</p>
                {r.note && (
                  <p className="text-[11px] text-text-muted-2 mt-2 flex items-center gap-1">
                    <Icon name="lock" size={11} className="flex-shrink-0" />
                    {r.note}
                  </p>
                )}
              </div>

              {r.href && (
                <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto">
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
