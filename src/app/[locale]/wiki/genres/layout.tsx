import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Genres — Music Encyclopedia",
  description:
    "Explore music genres in the Backing & Score encyclopedia. Classical, jazz, pop, rock, and more — organized by era.",
  openGraph: {
    title: "Genres — Music Encyclopedia — Backing & Score",
    description: "Explore music genres. Classical, jazz, pop, rock, and more — organized by era.",
    type: "website",
  },
};

export default function GenresListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
