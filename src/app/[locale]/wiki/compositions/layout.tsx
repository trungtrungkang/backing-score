import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compositions — Music Encyclopedia",
  description:
    "Browse musical compositions in the Backing & Score encyclopedia. Filter by genre, period, and difficulty.",
  openGraph: {
    title: "Compositions — Music Encyclopedia — Backing & Score",
    description: "Browse musical compositions. Filter by genre, period, and difficulty.",
    type: "website",
  },
};

export default function CompositionsListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
