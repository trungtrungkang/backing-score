import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artists — Music Encyclopedia",
  description:
    "Explore composers and musicians in the Backing & Score music encyclopedia. Biographies, nationalities, and compositions.",
  openGraph: {
    title: "Artists — Music Encyclopedia — Backing & Score",
    description: "Explore composers and musicians. Biographies, nationalities, and compositions.",
    type: "website",
  },
};

export default function ArtistsListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
