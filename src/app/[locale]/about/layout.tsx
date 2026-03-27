import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Backing & Score — The Interactive Music Ecosystem",
  description:
    "Practice with real-time feedback, learn through structured courses, explore a curated music library, and connect with a community of music lovers. All in your browser.",
  openGraph: {
    title: "Backing & Score — The Interactive Music Ecosystem",
    description:
      "Practice · Learn · Discover · Connect — A comprehensive music platform with interactive sheet music, Wait Mode, Academy courses, and a social community for music lovers.",
    type: "website",
    siteName: "Backing & Score",
    images: [
      {
        url: "/og-about.png",
        width: 1200,
        height: 630,
        alt: "Backing & Score — Practice · Learn · Discover · Connect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backing & Score — The Interactive Music Ecosystem",
    description:
      "Practice · Learn · Discover · Connect — Interactive sheet music with real-time feedback, courses, and community.",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
