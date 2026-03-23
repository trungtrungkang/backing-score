import { Metadata } from "next";
import { getCompositionBySlug } from "@/lib/appwrite/compositions";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comp = await getCompositionBySlug(slug);

  if (!comp) {
    return { title: "Composition | Backing & Score" };
  }

  const description = comp.description
    ? comp.description.substring(0, 160)
    : `${comp.title} — ${comp.period || "Musical Composition"}`;

  return {
    title: `${comp.title} | Music Encyclopedia — Backing & Score`,
    description,
    openGraph: {
      title: `${comp.title} | Music Encyclopedia`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${comp.title} | Music Encyclopedia`,
      description,
    },
    other: {
      "script:ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "MusicComposition",
        name: comp.title,
        ...(comp.year && { dateCreated: comp.year.toString() }),
        ...(comp.keySignature && { musicalKey: comp.keySignature }),
        ...(comp.description && { description: comp.description.substring(0, 500) }),
      }),
    },
  };
}

export default function CompositionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
