"use client";

import { useUser, useNotifications } from "@/lib/hooks";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import Icon from "@/components/ui/Icon";
import Logo from "@/components/ui/Logo";
import Avatar from "@/components/ui/Avatar";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

const NAV_ITEMS: Record<string, Array<{ href: string; label: string; icon: string }>> = {
  admin: [
    { href: "/dashboard", label: "Overview", icon: "chart" },
    { href: "/dashboard/users", label: "Users", icon: "users" },
    { href: "/dashboard/pairings", label: "Pairings", icon: "link" },
    { href: "/dashboard/universities", label: "Universities", icon: "graduation" },
  ],
  mentor: [
    { href: "/dashboard", label: "My Mentees", icon: "graduation" },
    { href: "/dashboard/mentor-profile", label: "Profile", icon: "user" },
    { href: "/dashboard/universities", label: "Universities", icon: "school" },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  ],
  mentee: [
    { href: "/dashboard", label: "My Journey", icon: "map" },
    { href: "/dashboard/profile", label: "Profile", icon: "user" },
    { href: "/dashboard/universities", label: "Universities", icon: "school" },
    { href: "/dashboard/settings", label: "Settings", icon: "settings" },
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useUser();
  const { notifications, unreadCount, markRead } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifs]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16 bg-white/90 backdrop-blur-sm border-b border-border" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  const navItems = NAV_ITEMS[user.role] || NAV_ITEMS.mentee;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-[var(--shadow-xs)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Hamburger menu - mobile only */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 text-gray-500 hover:bg-brand-blue-soft rounded-lg transition"
                aria-label="Toggle menu"
              >
                <Icon name={mobileMenuOpen ? "x" : "menu"} size={22} />
              </button>

              {/* Logo */}
              <Link href="/dashboard" className="flex items-center">
                <Image src="/logo-wordmark.png" alt="Satu Tuju" width={120} height={40} className="object-contain" priority />
              </Link>

              {/* Desktop nav */}
              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-blue-soft text-primary"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      }`}
                    >
                      <Icon name={item.icon} size={16} className={isActive ? "text-primary" : ""} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifs(!showNotifs)}
                  className="relative p-2 text-gray-500 hover:bg-brand-blue-soft hover:text-primary rounded-lg transition"
                >
                  <Icon name="bell" size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifs && (
                  <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[var(--shadow-lg)] border border-border overflow-hidden z-50 animate-slide-down">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-50/50">
                      <span className="font-semibold text-sm font-[family-name:var(--font-heading)]">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markRead()}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-400">
                          <Icon name="bell" size={24} className="mx-auto mb-2 text-brand-lavender" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              markRead(n.id);
                              if (n.link) router.push(n.link);
                              setShowNotifs(false);
                            }}
                            className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition flex gap-3 ${
                              !n.read ? "bg-primary-50/50" : ""
                            }`}
                          >
                            {!n.read && (
                              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            )}
                            <div className={!n.read ? "" : "ml-5"}>
                              <p className="text-sm font-medium text-foreground">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
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

              {/* User menu */}
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-danger hover:bg-danger-light rounded-lg transition ml-1"
                  title="Logout"
                >
                  <Icon name="logout" size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-out navigation drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-primary-900/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed top-0 left-0 bottom-0 w-72 bg-white shadow-[var(--shadow-xl)] z-50 flex flex-col animate-slide-in-left">
            <div className="flex items-center justify-between px-5 h-16 border-b border-border">
              <Image src="/logo-wordmark.png" alt="Satu Tuju" width={120} height={40} className="object-contain" priority />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                aria-label="Close menu"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* User info in drawer */}
            <div className="px-5 py-4 bg-brand-blue-soft/30 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="md" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-1 p-4 flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? "bg-brand-blue-soft text-primary"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Icon name={item.icon} size={18} className={isActive ? "text-primary" : ""} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border p-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 text-sm text-danger font-medium hover:underline w-full px-3 py-2"
              >
                <Icon name="logout" size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
