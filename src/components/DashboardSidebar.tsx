"use client";

import { Link } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import {
  CloudUpload, Heart, FolderOpen, Globe,
  GraduationCap, Crown,
} from "lucide-react";
import { useTranslations } from "next-intl";

const NAV_ITEMS = [
  { href: "/dashboard", icon: CloudUpload, labelKey: "myUploadsNav", iconColor: "text-blue-400" },
  { href: "/dashboard/collections", icon: FolderOpen, labelKey: "collections", iconColor: "" },
  { href: "/dashboard/favorites", icon: Heart, labelKey: "favorites", iconColor: "" },
];

const EXTRA_ITEMS = [
  { href: "/dashboard/courses", icon: GraduationCap, labelKey: "creatorCourses", iconColor: "text-[#C8A856]", divider: true },
  { href: "/guide", icon: Globe, labelKey: "userGuide", iconColor: "" },
  { href: "/pricing", icon: Crown, label: "Premium", iconColor: "text-[#C8A856]" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Dashboard");

  // Strip locale prefix for matching (e.g. /vi/dashboard -> /dashboard)
  const cleanPath = pathname.replace(/^\/[a-z]{2}(?=\/)/, "");

  const isActive = (href: string) => {
    if (href === "/dashboard") return cleanPath === "/dashboard";
    return cleanPath.startsWith(href);
  };

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-6 hidden md:flex flex-col gap-8 sticky top-16 h-[calc(100vh-4rem)]">
      <div>
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">
          {t("yourLibrary")}
        </h2>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  active
                    ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${active && item.iconColor ? item.iconColor : ""}`} />
                {t(item.labelKey)}
              </Link>
            );
          })}

          {EXTRA_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  item.divider ? "mt-4 border-t border-zinc-200 dark:border-zinc-800/50 pt-3" : ""
                } ${
                  active
                    ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-white font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${item.iconColor || ""}`} />
                {item.label || t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
