"use client";

/**
 * Renders HTML content from the TipTap editor with proper styling.
 * Intercepts clicks on internal wiki links to route through Next.js (locale-aware).
 */

import { useCallback } from "react";
import { useRouter } from "@/i18n/routing";

interface RichTextRendererProps {
  content: string;
  className?: string;
}

export function RichTextRenderer({ content, className }: RichTextRendererProps) {
  const router = useRouter();

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // Internal wiki links (e.g. /wiki/artists/bach) — route through Next.js
    if (href.startsWith("/wiki/") || href.startsWith("/play/") || href.startsWith("/c/")) {
      e.preventDefault();
      router.push(href);
    }
  }, [router]);

  if (!content) return null;

  // If content is plain text (no HTML tags), wrap paragraphs
  const isHTML = /<[a-z][\s\S]*>/i.test(content);
  const html = isHTML
    ? content
    : content.split("\n").filter(Boolean).map(p => `<p>${p}</p>`).join("");

  return (
    <div
      onClick={handleClick}
      className={`prose prose-zinc dark:prose-invert max-w-none
        prose-headings:font-bold prose-headings:tracking-tight
        prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
        prose-a:text-[#C8A856] prose-a:no-underline hover:prose-a:underline prose-a:cursor-pointer
        prose-img:rounded-xl prose-img:shadow-lg
        prose-blockquote:border-l-[#C8A856] prose-blockquote:bg-zinc-50 dark:prose-blockquote:bg-zinc-900/50 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:px-4
        prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-zinc-900 dark:prose-pre:bg-zinc-950 prose-pre:rounded-xl
        [&_iframe]:rounded-xl [&_iframe]:w-full [&_iframe]:aspect-video
        text-[15px] leading-relaxed
        ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
