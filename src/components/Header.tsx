"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Library, Compass, Search, Bell, User, LogOut, ShieldAlert, Users, GraduationCap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (pathname?.startsWith("/play")) return null;

  if (loading) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/60 text-black dark:text-white flex justify-center h-14 items-center">
        <div className="flex w-full px-6 md:px-8 max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Backing Score Logo" width={24} height={24} className="rounded-md" />
            <span className="font-bold tracking-tight text-lg">Backing Score</span>
          </div>
          <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-black dark:border-t-white rounded-full animate-spin"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-[#1A1A1E] border-b border-black/5 dark:border-white/5 text-black dark:text-white flex justify-center transition-all h-20 items-center">
      <div className="flex w-full px-6 md:px-12 max-w-[1400px] items-center justify-between">
        {/* Left Logo */}
        <Link href="/" className="flex items-center gap-2.5 focus:outline-none transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="Backing Score Logo" width={36} height={36} className="rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.4)]" />
          <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">Backing <span className="font-light text-zinc-500 dark:text-zinc-400">Score</span></span>
        </Link>
        
        {/* Center Navigation */}
        <nav className="absolute left-1/2 -translate-x-1/2 h-full hidden md:flex items-center gap-8">
            <Link href="/" className={`h-full flex px-2 items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${pathname === '/' ? 'text-[#C8A856] border-[#C8A856]' : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
              <Home className="w-[18px] h-[18px]" />
              Home
            </Link>
            <Link href="/dashboard" className={`h-full flex px-2 items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${pathname.startsWith('/dashboard') ? 'text-[#C8A856] border-[#C8A856]' : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
              <Library className="w-[18px] h-[18px]" />
              Library
            </Link>
            <Link href="/discover" className={`h-full flex px-2 items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${pathname.startsWith('/discover') ? 'text-[#C8A856] border-[#C8A856]' : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
              <Compass className="w-[18px] h-[18px]" />
              Explore
            </Link>
            <Link href="/academy" className={`h-full flex px-2 items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${pathname.startsWith('/academy') ? 'text-[#C8A856] border-[#C8A856]' : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
              <GraduationCap className="w-[18px] h-[18px]" />
              Academy
            </Link>
            {user && (
              <Link href="/feed" className={`h-full flex px-2 items-center gap-2 text-sm font-semibold transition-colors border-b-2 ${pathname.startsWith('/feed') ? 'text-[#C8A856] border-[#C8A856]' : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'}`}>
                <Users className="w-[18px] h-[18px]" />
                Community
              </Link>
            )}
            {user?.labels?.includes("admin") && (
              <Link href="/admin" className={`h-full flex px-2 items-center gap-2 text-sm font-extrabold transition-colors border-b-2 ${pathname.startsWith('/admin') ? 'text-red-500 border-red-500' : 'text-red-400/50 dark:text-red-900/50 border-transparent hover:text-red-500 dark:hover:text-red-500'}`}>
                <ShieldAlert className="w-[18px] h-[18px]" />
                Admin
              </Link>
            )}
        </nav>

        {/* Right Icons */}
        <div className="flex items-center gap-3 sm:gap-5">
          <button 
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full transition-colors text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <ThemeToggle hideBg className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hidden sm:flex" />
          
          {user ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href={`/u/${user.$id}`} className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs shadow-sm hover:scale-105 transition-transform overflow-hidden" title="My Profile">
                {(user.prefs as any)?.avatarUrl ? (
                   <img src={(user.prefs as any).avatarUrl} className="w-full h-full object-cover" alt="User" />
                ) : (
                   (user.name ? user.name.substring(0, 2) : "U").toUpperCase()
                )}
              </Link>
              <button 
                onClick={() => logout()}
                className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                title="Logout"
              >
                <LogOut className="w-[14px] h-[14px] ml-0.5" />
              </button>
            </div>
          ) : (
            <Link href="/login">
              <button className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <User className="w-[18px] h-[18px]" />
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-20 left-0 w-full bg-white dark:bg-[#1A1A1E] border-b border-black/5 dark:border-white/5 shadow-xl flex flex-col p-4 gap-2 md:hidden animate-in slide-in-from-top-2">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${pathname === '/' ? 'bg-[#C8A856]/10 text-[#C8A856]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Home className="w-5 h-5" />
              Home
            </Link>
            <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${pathname.startsWith('/dashboard') ? 'bg-[#C8A856]/10 text-[#C8A856]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Library className="w-5 h-5" />
              Library
            </Link>
            <Link href="/discover" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${pathname.startsWith('/discover') ? 'bg-[#C8A856]/10 text-[#C8A856]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <Compass className="w-5 h-5" />
              Explore
            </Link>
            <Link href="/academy" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${pathname.startsWith('/academy') ? 'bg-[#C8A856]/10 text-[#C8A856]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              <GraduationCap className="w-5 h-5" />
              Academy
            </Link>
            {user && (
              <Link href="/feed" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-semibold transition-colors ${pathname.startsWith('/feed') ? 'bg-[#C8A856]/10 text-[#C8A856]' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                <Users className="w-5 h-5" />
                Community
              </Link>
            )}
            {user?.labels?.includes("admin") && (
              <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 p-3 rounded-lg text-sm font-extrabold transition-colors ${pathname.startsWith('/admin') ? 'bg-red-500/10 text-red-500' : 'text-red-400/80 dark:text-red-900/80 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                <ShieldAlert className="w-5 h-5" />
                Admin
              </Link>
            )}
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-center sm:hidden">
              <ThemeToggle className="w-full justify-center" />
            </div>
        </div>
      )}
    </header>
  );
}
