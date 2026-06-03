"use client";

import { useUser, useNotifications } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import DashboardContractAlert from "@/components/contract/DashboardContractAlert";

// Profile & Settings are removed from main nav — they live in the avatar dropdown.
// `NavGroup` collapses two or more sibling tabs under a single dropdown so the
// admin ribbon doesn't keep growing every time we add a feature. Mentor/mentee
// navs are flat today (4 items each, comfortable in a row).
type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** When set, the tab highlights for any pathname under this prefix (in
   *  addition to exact href match). Use for tabs that own a whole section
   *  with child routes — e.g. Pipeline. */
  activePrefix?: string;
};
type NavGroup = { label: string; icon: string; children: NavLink[] };
type NavItem = NavLink | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return (item as NavGroup).children !== undefined;
}

/** Decide whether a top-level NavLink should be highlighted for the
 *  current pathname. Honors optional `activePrefix` so section-owning
 *  tabs (e.g. Pipeline) light up across their child routes. */
function isLinkActive(item: NavLink, pathname: string): boolean {
  if (pathname === item.href) return true;
  if (item.activePrefix && pathname.startsWith(item.activePrefix + "/")) return true;
  return false;
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { href: "/dashboard",              label: "Overview", icon: "chart" },
    { href: "/dashboard/users",        label: "Users",    icon: "users" },
    {
      label: "Mentor", icon: "user",
      children: [
        { href: "/dashboard/admin/mentors",   label: "Daftar Mentor", icon: "user"     },
        { href: "/dashboard/pairings",        label: "Pairings",      icon: "link"     },
        { href: "/dashboard/admin/contracts", label: "Kontrak",       icon: "document" },
      ],
    },
    // Pipeline → single tab. Sub-navigation (Tambah Lead / Pipeline
    // Steps / Email Templates / Auto-Send) lives inside the pipeline
    // pages via <PipelineSubnav />.
    { href: "/dashboard/admin/new-leads", label: "Pipeline", icon: "chart", activePrefix: "/dashboard/admin/new-leads" },
    { href: "/dashboard/schedule",     label: "Schedule",     icon: "calendar"   },
    { href: "/dashboard/resources",    label: "Resources",    icon: "book"       },
    { href: "/dashboard/universities", label: "Universities", icon: "graduation" },
  ],
  mentor: [
    { href: "/dashboard",              label: "My Mentees",   icon: "graduation"  },
    { href: "/dashboard/leads",        label: "Leads",        icon: "users", activePrefix: "/dashboard/leads" },
    { href: "/dashboard/schedule",     label: "Schedule",     icon: "calendar"    },
    { href: "/dashboard/resources",    label: "Resources",    icon: "book"        },
    { href: "/dashboard/universities", label: "Universities", icon: "school"      },
  ],
  mentee: [
    { href: "/dashboard",              label: "My Journey",   icon: "map"         },
    { href: "/dashboard/schedule",     label: "Schedule",     icon: "calendar"    },
    { href: "/dashboard/resources",    label: "Resources",    icon: "book"        },
    { href: "/dashboard/universities", label: "Universities", icon: "school"      },
  ],
};

// Profile / Settings links per role (shown in avatar dropdown)
const USER_MENU_ITEMS: Record<string, Array<{ href: string; label: string; icon: string }>> = {
  admin:  [],
  mentor: [
    { href: "/dashboard/mentor-profile", label: "Profile",  icon: "user"     },
    { href: "/dashboard/contract",       label: "Kontrak",  icon: "document" },
    { href: "/dashboard/settings",       label: "Settings", icon: "settings" },
  ],
  mentee: [
    { href: "/dashboard/profile",  label: "Profile",  icon: "user"     },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useUser();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-wordmark-white.png" : "/logo-wordmark.png";
  const { notifications, unreadCount, markRead } = useNotifications();
  const router   = useRouter();
  const pathname = usePathname();

  const [showNotifs,     setShowNotifs]     = useState(false);
  const [showUserMenu,   setShowUserMenu]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Active nav-group popover label, or null. Only one nav group can be open
  // at a time, and opening any of {nav-group, notif, avatar} closes the
  // others — see `openOnly` helper below.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const notifRef    = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navGroupRef = useRef<HTMLDivElement>(null);

  function openOnly(panel: "notifs" | "user" | "group" | null, groupLabel?: string) {
    setShowNotifs(panel === "notifs");
    setShowUserMenu(panel === "user");
    setOpenGroup(panel === "group" ? groupLabel ?? null : null);
  }

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);


  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(t)) setShowUserMenu(false);
      if (navGroupRef.current && !navGroupRef.current.contains(t)) setOpenGroup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close any open popover on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") openOnly(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 bg-surface/90 backdrop-blur-sm border-b border-border" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }


  const navItems      = NAV_ITEMS[user.role]      || NAV_ITEMS.mentee;
  const userMenuItems = USER_MENU_ITEMS[user.role] || [];
  const scheduleUnread = notifications.filter(
    (n) => n.link === "/dashboard/schedule" && !n.read
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <header className="bg-surface/90 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-[var(--shadow-xs)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Left: hamburger (mobile) + logo + desktop nav */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 text-text-muted hover:bg-brand-blue-soft rounded-lg transition"
                aria-label="Toggle menu"
              >
                <Icon name={mobileMenuOpen ? "x" : "menu"} size={22} />
              </button>

              <Link href="/dashboard" className="flex items-center">
                <Image src={logoSrc} alt="Satu Tuju" width={120} height={40}
                  className="object-contain" priority />
              </Link>

              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => {
                  if (isGroup(item)) {
                    const childActive = item.children.some((c) => pathname === c.href);
                    const open = openGroup === item.label;
                    return (
                      <div
                        key={item.label}
                        className="relative"
                        // Single shared ref — outside-click handler scopes it
                        // to "click was outside any nav group dropdown". The
                        // assigned ref tracks the most recently rendered open
                        // group, which is enough since only one is open at a
                        // time.
                        ref={open ? navGroupRef : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => openOnly(open ? null : "group", item.label)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            childActive
                              ? "bg-brand-blue-soft text-primary"
                              : "text-text-muted hover:bg-surface-elevated hover:text-foreground"
                          }`}
                          aria-haspopup="menu"
                          aria-expanded={open}
                        >
                          <Icon name={item.icon} size={16} className={childActive ? "text-primary" : ""} />
                          {item.label}
                          <Icon
                            name="chevron-down"
                            size={12}
                            className={`text-text-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
                          />
                        </button>
                        {open && (
                          <div
                            role="menu"
                            className="absolute left-0 top-full mt-2 w-56 bg-surface rounded-2xl shadow-[var(--shadow-lg)] border border-border overflow-hidden z-50 animate-slide-down"
                          >
                            <div className="py-1.5">
                              {item.children.map((child, idx) => {
                                const isActive = pathname === child.href;
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={() => setOpenGroup(null)}
                                    autoFocus={idx === 0}
                                    role="menuitem"
                                    className={`flex items-center gap-2.5 px-4 py-2 text-sm transition ${
                                      isActive
                                        ? "text-primary font-medium bg-brand-blue-soft/50"
                                        : "text-text-muted hover:bg-surface-elevated"
                                    }`}
                                  >
                                    <Icon name={child.icon} size={15} className={isActive ? "text-primary" : "text-text-muted-2"} />
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const isActive   = isLinkActive(item, pathname);
                  const isSchedule = item.href === "/dashboard/schedule";
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-blue-soft text-primary"
                          : "text-text-muted hover:bg-surface-elevated hover:text-foreground"
                      }`}
                    >
                      <Icon name={item.icon} size={16} className={isActive ? "text-primary" : ""} />
                      {item.label}
                      {isSchedule && scheduleUnread > 0 && (
                        <span className="ml-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                          {scheduleUnread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: notifications + avatar dropdown */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => openOnly(showNotifs ? null : "notifs")}
                  className="relative p-2 text-text-muted hover:bg-brand-blue-soft hover:text-primary rounded-lg transition"
                >
                  <Icon name="bell" size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[18px] min-h-[18px] flex items-center justify-center px-0.5">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface rounded-2xl shadow-[var(--shadow-lg)] border border-border overflow-hidden z-50 animate-slide-down">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated/50">
                      <span className="font-semibold text-sm font-[family-name:var(--font-heading)]">Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={() => markRead()} className="text-xs text-primary font-medium hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-text-muted-2">
                          <Icon name="bell" size={24} className="mx-auto mb-2 text-brand-lavender" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div key={n.id}
                            onClick={() => { markRead(n.id); if (n.link) router.push(n.link); setShowNotifs(false); }}
                            className={`px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-surface-elevated transition flex gap-3 ${!n.read ? "bg-primary-50/50" : ""}`}
                          >
                            {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                            <div className={!n.read ? "" : "ml-5"}>
                              <p className="text-sm font-medium text-foreground">{n.title}</p>
                              <p className="text-xs text-text-muted mt-0.5">{n.message}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-px h-8 bg-border" />

              {/* Avatar dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => openOnly(showUserMenu ? null : "user")}
                  className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-surface-elevated ${showUserMenu ? "bg-surface-elevated" : ""}`}
                >
                  <Avatar name={user.name} size="sm" src={user.avatar || undefined} />
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-foreground leading-tight">{user.name}</p>
                    <p className="text-xs text-text-muted-2 capitalize leading-tight">{user.role}</p>
                  </div>
                  <Icon name="chevron-down" size={14}
                    className={`hidden sm:block text-text-muted-2 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-2xl shadow-[var(--shadow-lg)] border border-border overflow-hidden z-50 animate-slide-down">
                    {/* User identity */}
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-text-muted-2 truncate">{user.email}</p>
                    </div>

                    {/* View landing page — visible to every role */}
                    <div className="py-1.5 border-b border-border">
                      <Link
                        href="/"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-text-muted hover:bg-surface-elevated transition"
                      >
                        <Icon name="external-link" size={15} className="text-text-muted-2" />
                        View landing page
                      </Link>
                    </div>

                    {/* Profile + Settings links */}
                    {userMenuItems.length > 0 && (
                      <div className="py-1.5">
                        {userMenuItems.map((item) => {
                          const isActive = pathname === item.href;
                          return (
                            <Link key={item.href} href={item.href}
                              onClick={() => setShowUserMenu(false)}
                              className={`flex items-center gap-2.5 px-4 py-2 text-sm transition ${
                                isActive
                                  ? "text-primary font-medium bg-brand-blue-soft/50"
                                  : "text-text-muted hover:bg-surface-elevated"
                              }`}
                            >
                              <Icon name={item.icon} size={15} className={isActive ? "text-primary" : "text-text-muted-2"} />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {/* Logout */}
                    <div className="border-t border-border py-1.5">
                      <button
                        onClick={() => { setShowUserMenu(false); logout(); }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition"
                      >
                        <Icon name="logout" size={15} className="text-red-400" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-out drawer ───────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-primary-900/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-surface shadow-[var(--shadow-xl)] z-50 flex flex-col animate-slide-in-left">
            <div className="flex items-center justify-between px-5 h-16 border-b border-border">
              <Image src="/logo-wordmark.png" alt="Satu Tuju" width={120} height={40}
                className="object-contain" priority />
              <button onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-text-muted-2 hover:bg-surface-elevated rounded-lg transition" aria-label="Close menu">
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* User info */}
            <div className="px-5 py-4 bg-brand-blue-soft/30 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="md" src={user.avatar || undefined} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-text-muted capitalize">{user.role}</p>
                </div>
              </div>
            </div>

            {/* Main nav */}
            <nav className="flex flex-col gap-1 p-4 flex-1">
              {navItems.map((item) => {
                if (isGroup(item)) {
                  return (
                    <div key={item.label} className="pt-2 first:pt-0">
                      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted-2">
                        {item.label}
                      </p>
                      {item.children.map((child) => {
                        const isActive = pathname === child.href;
                        return (
                          <Link key={child.href} href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center gap-3 pl-6 pr-3 py-2.5 rounded-xl text-sm font-medium transition ${
                              isActive ? "bg-brand-blue-soft text-primary" : "text-text-muted hover:bg-surface-elevated"
                            }`}
                          >
                            <Icon name={child.icon} size={18} className={isActive ? "text-primary" : ""} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }

                const isActive   = isLinkActive(item, pathname);
                const isSchedule = item.href === "/dashboard/schedule";
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive ? "bg-brand-blue-soft text-primary" : "text-text-muted hover:bg-surface-elevated"
                    }`}
                  >
                    <Icon name={item.icon} size={18} className={isActive ? "text-primary" : ""} />
                    {item.label}
                    {isSchedule && scheduleUnread > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {scheduleUnread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Profile + Settings + Logout at bottom */}
            <div className="border-t border-border p-4 space-y-1">
              {/* View landing page — visible to every role */}
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-muted hover:bg-surface-elevated transition"
              >
                <Icon name="external-link" size={18} />
                View landing page
              </Link>

              {userMenuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive ? "bg-brand-blue-soft text-primary" : "text-text-muted hover:bg-surface-elevated"
                    }`}
                  >
                    <Icon name={item.icon} size={18} className={isActive ? "text-primary" : ""} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
              >
                <Icon name="logout" size={18} className="text-red-400" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global contract alert (mentor-only, hides on /dashboard/contract) ─ */}
      <DashboardContractAlert role={user.role} />

      {/* ── Main content ───────────────────────────────────────────────────
          The contract route drops the max-width cap entirely so its
          three-column reader fills whatever the viewport offers. Other
          dashboard routes stay capped at 7xl because they're card grids
          that get sparse on very wide screens. */}
      <main
        className={
          pathname.startsWith("/dashboard/contract")
            ? "mx-auto max-w-none px-3 sm:px-4 lg:px-4 py-8"
            : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
