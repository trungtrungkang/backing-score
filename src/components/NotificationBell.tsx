"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: "like" | "share" | "follow" | "comment";
  message: string;
  timestamp: string;
  read: boolean;
}

/**
 * NotificationBell — displays a bell icon with unread count badge.
 * Currently shows mock data; in production, connect to a real notifications API.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications] = useState<Notification[]>([
    // Mock notifications — replace with real data from API
  ]);

  if (!user) return null;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-sm">Notifications</h3>
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                No notifications yet
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${
                      !n.read ? "bg-blue-50/50 dark:bg-blue-500/5" : ""
                    }`}
                  >
                    <p className="text-sm text-zinc-900 dark:text-white">{n.message}</p>
                    <p className="text-[10px] text-zinc-400 mt-1">{n.timestamp}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
