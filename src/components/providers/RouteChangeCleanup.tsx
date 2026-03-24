"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MidiPlayerSingleton } from "@/lib/audio/MidiPlayerSingleton";

/**
 * Invisible component that stops all audio/MIDI when the route changes.
 * Uses THREE mechanisms to ensure complete coverage:
 * 1. usePathname — Next.js client-side navigation (Link clicks, router.push)
 * 2. popstate — browser Back/Forward buttons (fires immediately)
 * 3. history.pushState/replaceState patches — catches programmatic navigation
 */
export function RouteChangeCleanup() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  // 1. Stop audio whenever pathname actually changes (Next.js client-side navigation)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      MidiPlayerSingleton.stopAll();
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // 2+3. Listen to popstate AND patch history methods
  useEffect(() => {
    const handleNavigation = () => {
      MidiPlayerSingleton.stopAll();
    };

    // Browser Back/Forward
    window.addEventListener("popstate", handleNavigation);

    // Patch pushState and replaceState to catch Next.js soft navigation
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      handleNavigation();
      return originalPushState(...args);
    };

    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      handleNavigation();
      return originalReplaceState(...args);
    };

    return () => {
      window.removeEventListener("popstate", handleNavigation);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  return null;
}
