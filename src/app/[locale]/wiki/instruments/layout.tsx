import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instruments — Music Encyclopedia",
  description:
    "Discover musical instruments in the Backing & Score encyclopedia. Filter by family: strings, woodwinds, brass, and more.",
  openGraph: {
    title: "Instruments — Music Encyclopedia — Backing & Score",
    description: "Discover musical instruments. Filter by family: strings, woodwinds, brass, and more.",
    type: "website",
  },
};

export default function InstrumentsListingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
