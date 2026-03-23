import { Metadata } from "next";
import { getInstrumentBySlug } from "@/lib/appwrite/instruments";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const inst = await getInstrumentBySlug(slug);

  if (!inst) {
    return { title: "Instrument | Backing & Score" };
  }

  const description = inst.description
    ? inst.description.substring(0, 160)
    : `${inst.name} — ${inst.family || "Musical Instrument"}`;

  return {
    title: `${inst.name} | Music Encyclopedia — Backing & Score`,
    description,
    openGraph: {
      title: `${inst.name} | Music Encyclopedia`,
      description,
      type: "article",
      images: inst.imageUrl ? [{ url: inst.imageUrl, width: 400, height: 400, alt: inst.name }] : [],
    },
    twitter: {
      card: "summary",
      title: `${inst.name} | Music Encyclopedia`,
      description,
    },
  };
}

export default function InstrumentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
