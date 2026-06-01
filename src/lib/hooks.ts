"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  userId: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
}

// Session is identified by an httpOnly cookie that doesn't change while
// the tab is open, yet useUser() is called from the dashboard layout AND
// from almost every page — so a single dashboard load fired /api/auth/me
// 2+ times, and every client navigation fired it again. Cache the result
// (and the in-flight request) at module scope so it's fetched once per
// tab. `undefined` = not yet fetched; `null` = fetched, not logged in.
let userCache: User | null | undefined = undefined;
let userPromise: Promise<User | null> | null = null;

function fetchMe(): Promise<User | null> {
  if (userPromise) return userPromise;
  userPromise = fetch("/api/auth/me")
    .then((r) => r.json())
    .then((d) => {
      userCache = (d.user as User) || null;
      return userCache;
    })
    .catch(() => {
      // Reset so a transient failure can retry on the next mount instead
      // of being cached as "logged out" forever.
      userPromise = null;
      userCache = null;
      return null;
    });
  return userPromise;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(userCache ?? null);
  const [loading, setLoading] = useState(userCache === undefined);

  useEffect(() => {
    if (userCache !== undefined) {
      setUser(userCache);
      setLoading(false);
      return;
    }
    let active = true;
    fetchMe().then((u) => {
      if (!active) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Invalidate the shared cache so a re-login in the same tab re-fetches.
    userCache = undefined;
    userPromise = null;
    setUser(null);
    window.location.href = "/login";
  }, []);

  const updateAvatar = useCallback((avatar: string) => {
    if (userCache) userCache = { ...userCache, avatar };
    setUser((prev) => (prev ? { ...prev, avatar } : prev));
  }, []);

  return { user, loading, logout, updateAvatar };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      read: boolean;
      link?: string;
      createdAt: string;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(
        (data.notifications || []).filter(
          (n: { read: boolean }) => !n.read
        ).length
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Poll while the tab is visible; pause entirely when backgrounded so
    // idle/hidden tabs stop hammering /api/notifications. Refetch once on
    // return to visible so the badge is fresh.
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval === null) interval = setInterval(fetchNotifications, 60000);
    };
    const stop = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchNotifications();
        start();
      }
    };

    fetchNotifications();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchNotifications]);

  const markRead = useCallback(
    async (id?: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { readAll: true }),
      });
      fetchNotifications();
    },
    [fetchNotifications]
  );

  return { notifications, unreadCount, markRead, refresh: fetchNotifications };
}
