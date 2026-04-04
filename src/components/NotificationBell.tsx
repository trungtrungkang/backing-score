"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "next-intl";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDoc,
} from "@/app/actions/notifications";

export function NotificationBell() {
  const { user } = useAuth();
  const t = useTranslations("Notifications");
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Position dropdown relative to button
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [open]);

  // Load notifications on mount
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const docs = await listMyNotifications(user.$id);
      setNotifications(docs);
    } catch {
      // Collection might not exist yet — gracefully ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user, loadNotifications]);

  // Handle mark all read
  const handleMarkAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsRead(user.$id);
  };

  // Build navigation URL for a notification
  const getNotificationUrl = (n: NotificationDoc): string | null => {
    switch (n.type) {
      case "follow":
        return n.sourceUserId ? `/${locale}/u/${n.sourceUserId}` : null;
      case "comment":
      case "like":
        if (n.targetType === "project" && n.targetId) {
          return `/${locale}/play/${n.targetId}`;
        }
        if (n.targetType === "post" && n.targetId) {
          return `/${locale}/feed/post/${n.targetId}`;
        }
        return null;
      case "assignment_new":
      case "submission_new":
      case "feedback_new": {
        // targetId format: "classroomId/assignmentId"
        if (n.targetId && n.targetId.includes("/")) {
          const [classroomId, assignmentId] = n.targetId.split("/");
          return `/${locale}/classroom/${classroomId}/assignment/${assignmentId}`;
        }
        return null;
      }
      case "material_new": {
        // targetId format: "classroomId/materialId"
        if (n.targetId && n.targetId.includes("/")) {
          const [classroomId] = n.targetId.split("/");
          return `/${locale}/classroom/${classroomId}`;
        }
        return null;
      }
      case "classroom_join_request":
        if (n.targetId) return `/${locale}/dashboard/classrooms/${n.targetId}/manage`;
        return null;
      case "classroom_join_approved":
        if (n.targetId) return `/${locale}/classroom/${n.targetId}`;
        return null;
      default:
        return null;
    }
  };

  // Handle click on notification item
  const handleNotificationClick = (n: NotificationDoc) => {
    const url = getNotificationUrl(n);
    if (!n.read) {
      markNotificationRead(n.$id).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) => (item.$id === n.$id ? { ...item, read: true } : item))
      );
    }
    setOpen(false);
    if (url) router.push(url);
  };

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Format message using i18n templates
  const formatMessage = (n: NotificationDoc): string => {
    try {
      return t(n.type, {
        userName: n.sourceUserName || "Someone",
        sourceUserName: n.sourceUserName || "Someone",
        targetName: n.targetName || "",
      });
    } catch {
      // Fallback if translation key missing
      return `${n.sourceUserName} — ${n.type}`;
    }
  };

  // Relative time
  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200]"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed w-80 max-h-[28rem] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[201]"
              style={{ top: pos.top, right: pos.right }}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                  {t("title")}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    {t("markAllRead")}
                  </button>
                )}
              </div>

              {/* Content */}
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                  {t("noNotifications")}
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((n) => {
                    const hasLink = !!getNotificationUrl(n);
                    return (
                      <div
                        key={n.$id}
                        onClick={() => handleNotificationClick(n)}
                        className={`px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-colors ${
                          hasLink ? "cursor-pointer" : ""
                        } ${
                          !n.read
                            ? "bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Unread dot */}
                          <div className="mt-1.5 shrink-0">
                            {!n.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-900 dark:text-white leading-snug">
                              {formatMessage(n)}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-1">
                              {timeAgo(n.$createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

