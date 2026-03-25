import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover — Interactive Sheet Music Library",
  description:
    "Browse and play along with interactive sheet music. Filter by instrument, genre, and difficulty. Free to explore.",
  openGraph: {
    title: "Discover — Backing & Score",
    description:
      "Browse and play along with interactive sheet music. Filter by instrument, genre, and difficulty.",
    type: "website",
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
