import { Metadata } from "next";
import { getGenreBySlug } from "@/lib/appwrite/genres";

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getGenreBySlug(slug);

  if (!genre) {
    return { title: "Genre | Backing & Score" };
  }

  const description = genre.description
    ? genre.description.substring(0, 160)
    : `${genre.name} — Music Genre${genre.era ? ` (${genre.era})` : ""}`;

  return {
    title: `${genre.name} | Music Encyclopedia — Backing & Score`,
    description,
    openGraph: {
      title: `${genre.name} | Music Encyclopedia`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${genre.name} | Music Encyclopedia`,
      description,
    },
  };
}

export default function GenreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
