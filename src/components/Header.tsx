"use client";

import { useState, useCallback } from "react";
import { Link, usePathname } from "@/i18n/routing";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Library, Compass, User, LogOut, ShieldAlert,
  Users, GraduationCap, Menu, X, Settings2, BookOpen, Search
} from "lucide-react";
import { WikiSearchDialog } from "@/components/WikiSearchDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { useTranslations } from "next-intl";
import { canAccessAdmin } from "@/lib/auth/roles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// ── Facebook-style icon tab ──────────────────────────────────────────────────
// Icon-only on md (768–1023px), icon+label on lg+ (1024px+)
function NavTab({
  href,
  icon: Icon,
  label,
  active,
  danger,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={`
            relative h-full flex items-center justify-center gap-2 px-5 lg:px-5
            whitespace-nowrap transition-colors group text-sm font-semibold
            ${danger
              ? active ? "text-red-500" : "text-red-400/50 hover:text-red-500"
              : active ? "text-[#C8A856]" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }
          `}
        >
          <span className="absolute inset-x-1 inset-y-3 rounded-xl bg-zinc-100 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Icon className="w-[18px] h-[18px] relative z-10 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
          <span className="relative z-10 hidden lg:inline">{label}</span>
          {active && (
            <span className={`absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full ${danger ? "bg-red-500" : "bg-[#C8A856]"}`} />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="font-semibold text-xs lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Mobile sidebar item ──────────────────────────────────────────────────────
function SidebarItem({
  href, icon: Icon, label, active, danger, onClick,
}: {
  href: string; icon: React.ElementType; label: string;
  active: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all
        ${danger
          ? active ? "bg-red-500/10 text-red-500" : "text-red-400 hover:bg-red-500/10 hover:text-red-500"
          : active ? "bg-[#C8A856]/10 text-[#C8A856]" : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5"
        }
      `}
    >
      <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
      {label}
    </Link>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
export function Header() {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  if (pathname?.startsWith("/play")) return null;

  if (loading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur h-[60px] flex items-center px-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Backing Score Logo" width={24} height={24} className="rounded-md" />
            <span className="font-bold tracking-tight text-lg">Backing Score</span>
          </div>
          <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-black dark:border-t-white rounded-full animate-spin" />
        </div>
      </header>
    );
  }

  const avatarUrl = (user?.prefs as any)?.avatarUrl;
  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : "U";

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Main Header ── */}
      <header className="sticky top-0 z-50 w-full bg-white dark:bg-[#1A1A1E] border-b border-black/5 dark:border-white/5 text-black dark:text-white h-[60px] overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto] h-full w-full max-w-[1400px] mx-auto">

          {/* Col 1 — Logo + hamburger (mobile) */}
          <div className="flex items-center gap-2 px-3 sm:px-5">
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/logo.png" alt="Backing Score Logo" width={30} height={30} className="rounded-lg shadow-[0_0_12px_rgba(0,240,255,0.35)]" />
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white hidden lg:inline">
                Backing <span className="font-light text-zinc-500 dark:text-zinc-400">Score</span>
              </span>
            </Link>
          </div>

          {/* Col 2 — Icon tab nav (md+ only) */}
          <nav className="hidden md:flex items-stretch justify-center overflow-hidden">
            <NavTab href="/"          icon={Home}          label={t("home")}      active={pathname === "/"} />
            <NavTab href="/dashboard" icon={Library}       label={t("library")}   active={pathname.startsWith("/dashboard")} />
            <NavTab href="/discover"  icon={Compass}       label={t("explore")}   active={pathname.startsWith("/discover")} />
            <NavTab href="/academy"   icon={GraduationCap} label={t("academy")}   active={pathname.startsWith("/academy")} />
            <NavTab href="/wiki"      icon={BookOpen}      label={t("wiki")}      active={pathname.startsWith("/wiki")} />
            {user && (
              <NavTab href="/feed"    icon={Users}         label={t("community")} active={pathname.startsWith("/feed")} />
            )}
          </nav>

          {/* Col 3 — Search + Options dropdown */}
          <div className="flex items-center gap-1.5 px-3 sm:px-5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors text-zinc-500 dark:text-zinc-400"
                >
                  <Search className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-semibold text-xs">Search Wiki</TooltipContent>
            </Tooltip>
            {user && <NotificationBell />}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors overflow-hidden">
                      {user ? (
                        avatarUrl
                          ? <img src={avatarUrl} className="w-full h-full object-cover" alt="User" />
                          : <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs">{initials}</span>
                      ) : (
                        <Settings2 className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="font-semibold text-xs">Options</TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="end" className="w-52 mt-1">
                {/* User info */}
                {user && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{user.name || "User"}</span>
                        <span className="text-xs text-zinc-500 truncate">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/u/${user.$id}`} className="flex items-center gap-3 cursor-pointer">
                        <User className="w-4 h-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Language & Theme */}
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-medium">Language</span>
                  <LanguageSwitcher />
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-medium">Theme</span>
                  <ThemeToggle hideBg className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" />
                </div>

                {/* Admin */}
                {canAccessAdmin(user?.labels) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-3 cursor-pointer text-red-500 focus:text-red-500">
                        <ShieldAlert className="w-4 h-4" />
                        {t("admin")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                {/* Login / Logout */}
                <DropdownMenuSeparator />
                {user ? (
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="flex items-center gap-3 cursor-pointer text-red-500 focus:text-red-500"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/login" className="flex items-center gap-3 cursor-pointer">
                      <User className="w-4 h-4" />
                      {t("login")}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>
      </header>

      {/* ── Mobile Sidebar ── */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={closeSidebar}
      />
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-72 bg-white dark:bg-[#1A1A1E] border-r border-black/5 dark:border-white/5 shadow-2xl flex flex-col transition-transform duration-300 ease-out md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 h-[60px] border-b border-black/5 dark:border-white/5 shrink-0">
          <Link href="/" onClick={closeSidebar} className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={28} height={28} className="rounded-lg" />
            <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
              Backing <span className="font-light text-zinc-500 dark:text-zinc-400">Score</span>
            </span>
          </Link>
          <button onClick={closeSidebar} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarItem href="/"          icon={Home}          label={t("home")}      active={pathname === "/"}                  onClick={closeSidebar} />
          <SidebarItem href="/dashboard" icon={Library}       label={t("library")}   active={pathname.startsWith("/dashboard")} onClick={closeSidebar} />
          <SidebarItem href="/discover"  icon={Compass}       label={t("explore")}   active={pathname.startsWith("/discover")}  onClick={closeSidebar} />
          <SidebarItem href="/academy"   icon={GraduationCap} label={t("academy")}   active={pathname.startsWith("/academy")}   onClick={closeSidebar} />
          <SidebarItem href="/wiki"      icon={BookOpen}      label={t("wiki")}      active={pathname.startsWith("/wiki")}      onClick={closeSidebar} />
          {user && (
            <SidebarItem href="/feed"    icon={Users}         label={t("community")} active={pathname.startsWith("/feed")}      onClick={closeSidebar} />
          )}
          {canAccessAdmin(user?.labels) && (
            <SidebarItem href="/admin"   icon={ShieldAlert}   label={t("admin")}     active={pathname.startsWith("/admin")}     onClick={closeSidebar} danger />
          )}
        </nav>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between shrink-0">
          <ThemeToggle className="text-zinc-500 dark:text-zinc-400" />
          {user ? (
            <button
              onClick={() => { logout(); closeSidebar(); }}
              className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          ) : (
            <Link href="/login" onClick={closeSidebar} className="flex items-center gap-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
              <User className="w-4 h-4" />
              {t("login")}
            </Link>
          )}
        </div>
      </aside>

      {/* Wiki Search Dialog */}
      <WikiSearchDialog open={searchOpen} onClose={closeSearch} />
    </TooltipProvider>
  );
}
